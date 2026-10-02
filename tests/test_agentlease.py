import sys
import os
import json
import pytest
from conftest import make_benchmark_log, make_attestation_seal

# Add contracts to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "contracts")))


class SimulatedAddress:
    def __init__(self, hex_addr: str):
        self.as_hex = hex_addr.lower()

    def __str__(self):
        return self.as_hex

    def __eq__(self, other):
        return str(self) == str(other)


# Mock GenLayer primitives if genlayer module is not installed locally
def setup_gl_mock(mock_env):
    import types
    gl_module = types.ModuleType("genlayer")

    class UserError(Exception):
        pass

    class ContractStorageBase:
        def __new__(cls, *args, **kwargs):
            instance = super().__new__(cls)
            instance.leases = {}
            instance.lease_ids = []
            instance.authorized_machines = {}
            instance.authorized_machine_ids = []
            return instance

    mock_env.Contract = ContractStorageBase

    gl_module.UserError = UserError
    gl_module.Address = SimulatedAddress
    gl_module.bigint = lambda x: int(x)
    gl_module.u8 = lambda x: int(x)
    gl_module.u32 = lambda x: int(x)
    gl_module.u64 = lambda x: int(x)
    gl_module.u256 = lambda x: int(x)
    gl_module.TreeMap = dict
    gl_module.DynArray = list
    gl_module.allow_storage = lambda cls: cls
    gl_module.Contract = ContractStorageBase
    gl_module.gl = mock_env

    sys.modules["genlayer"] = gl_module

    if "contract" in sys.modules:
        del sys.modules["contract"]

    return gl_module


# =============================================================================
# TEST 1: Full Lifecycle with Manipulation-Resistant Time & Attestation
# =============================================================================
def test_agentlease_lifecycle(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    assert app.total_compute_locked == 0
    assert app.total_leases_settled == 0

    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    # 1. Create order
    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    mock_gl_env.message.value = escrow_amt
    lease_spec = "NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16"
    lease_id = app.create_lease_order(lease_spec, 86400)

    assert lease_id == "lease-1"
    assert app.total_compute_locked == escrow_amt
    assert app.get_lease_count() == 1

    lease_json = json.loads(app.get_lease(lease_id))
    assert lease_json["status"] == 0  # OPEN
    assert lease_json["verdict"] == "PENDING"
    challenge_nonce = lease_json["challenge_nonce"]
    session_id = lease_json["session_id"]
    assert "CHALLENGE-" in challenge_nonce
    assert "SESS-" in session_id

    # 2. Host submits proof with authentic cryptographic machine seal
    mock_gl_env.message.sender_address = host_addr
    proof_url = "https://gist.githubusercontent.com/host/raw/h100_benchmark.log"
    mock_gl_env.nondet.web.mock_responses[proof_url] = make_benchmark_log(
        challenge_nonce, session_id, host_addr, "NODE-GPU-H100-US-EAST-42", "NVIDIA H100 80GB HBM3", 989.4, 81920
    )
    app.submit_hardware_proof(lease_id, proof_url)

    updated_lease = json.loads(app.get_lease(lease_id))
    assert updated_lease["status"] == 1  # IN_AUDIT
    assert updated_lease["host"] == str(host_addr)

    # 3. Adjudicate hardware -> enters status 7: AUDIT_COMPLETED
    app.adjudicate_hardware(lease_id)
    audited_lease = json.loads(app.get_lease(lease_id))
    assert audited_lease["status"] == 7  # AUDIT_COMPLETED
    assert audited_lease["verdict"] == "HARDWARE_VERIFIED"
    assert audited_lease["initial_verdict"] == "HARDWARE_VERIFIED"

    # 4. Premature finalize settlement must be blocked by cooling-off window (5 min)
    with pytest.raises(Exception, match="cooling-off window"):
        app.finalize_settlement(lease_id)

    # 5. Extraneous transactions cannot advance time
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 1_000_000_000_000_000_000
    app.create_lease_order("NVIDIA A100 80GB SLA test order dummy", 86400)
    with pytest.raises(Exception, match="cooling-off window"):
        app.finalize_settlement(lease_id)

    # 6. Advance consensus time by 301 seconds (past 300s cooling window)
    mock_gl_env.advance_time(301)
    app.finalize_settlement(lease_id)

    final_lease = json.loads(app.get_lease(lease_id))
    assert final_lease["status"] == 2  # SETTLED_PAID
    assert final_lease["verdict"] == "HARDWARE_VERIFIED"
    assert app.total_compute_locked == 1_000_000_000_000_000_000  # only dummy order remains

    # Check Host received 100% of escrow
    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    assert len(host_transfers) == 1
    assert host_transfers[0]["value"] == escrow_amt


# =============================================================================
# TEST 2: Fresh Challenge Nonce, Session Binding, & Signed Source Verification
# =============================================================================
def test_fresh_challenge_and_signed_telemetry_verifications(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0x1111111111111111111111111111111111111111")
    host_addr = SimulatedAddress("0x2222222222222222222222222222222222222222")

    # A. Replay attack: Mismatched challenge nonce
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 5_000_000_000_000_000_000
    lid_replay = app.create_lease_order("NVIDIA H100 80GB SXM5 Enterprise", 86400)

    mock_gl_env.message.sender_address = host_addr
    app.submit_hardware_proof(lid_replay, "https://replay.com/log.txt")

    mock_gl_env.nondet.web.mock_responses["https://replay.com/log.txt"] = make_benchmark_log(
        "CHALLENGE-OLD-EXPIRED-NONCE", "SESS-lease-1-1790424000", host_addr
    )
    app.adjudicate_hardware(lid_replay)
    r_lease = json.loads(app.get_lease(lid_replay))
    assert r_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert "Replay attack" in r_lease["reason"]

    # B. Session unbound
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 5_000_000_000_000_000_000
    lid_unbound = app.create_lease_order("NVIDIA H100 80GB SXM5 Enterprise", 86400)
    unbound_lease = json.loads(app.get_lease(lid_unbound))
    valid_nonce = unbound_lease["challenge_nonce"]

    mock_gl_env.message.sender_address = host_addr
    app.submit_hardware_proof(lid_unbound, "https://unbound.com/log.txt")

    mock_gl_env.nondet.web.mock_responses["https://unbound.com/log.txt"] = make_benchmark_log(
        valid_nonce, "SESS-DIFFERENT-UNBOUND-SESSION", host_addr
    )
    app.adjudicate_hardware(lid_unbound)
    u_lease = json.loads(app.get_lease(lid_unbound))
    assert u_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert "SESSION_UNBOUND" in u_lease["reason"]

    # C. Unauthenticated source / Invalid signature
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 5_000_000_000_000_000_000
    lid_unsigned = app.create_lease_order("NVIDIA H100 80GB SXM5 Enterprise", 86400)
    unsigned_lease = json.loads(app.get_lease(lid_unsigned))

    mock_gl_env.message.sender_address = host_addr
    app.submit_hardware_proof(lid_unsigned, "https://unsigned.com/log.txt")

    mock_gl_env.nondet.web.mock_responses["https://unsigned.com/log.txt"] = make_benchmark_log(
        unsigned_lease["challenge_nonce"], unsigned_lease["session_id"], host_addr, is_valid_signature=False
    )
    app.adjudicate_hardware(lid_unsigned)
    s_lease = json.loads(app.get_lease(lid_unsigned))
    assert s_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert "Cryptographic attestation failed" in s_lease["reason"]


# =============================================================================
# TEST 3: Asymmetric Machine Origin & Unforgeable Attestation Verification
# =============================================================================
def test_cryptographic_attestation_seal_and_machine_origin_verification(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    owner_addr = SimulatedAddress("0x9999111122223333444455556666777788889999")
    mock_gl_env.message.sender_address = owner_addr
    app = contract.Contract()

    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    # 1. Verify pre-enrolled authorized hardware registry
    all_machines = json.loads(app.get_all_authorized_machines())
    assert len(all_machines) >= 2
    machine_ids = [m["machine_id"] for m in all_machines]
    assert "NODE-GPU-H100-US-EAST-42" in machine_ids
    assert "NODE-GPU-A100-EU-WEST-01" in machine_ids

    # 2. Authentic enrolled machine with genuine digital signature -> VERIFIED
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 5_000_000_000_000_000_000
    lid = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_data = json.loads(app.get_lease(lid))
    nonce = l_data["challenge_nonce"]
    session = l_data["session_id"]

    mock_gl_env.message.sender_address = host_addr
    valid_url = "https://host.com/valid_signed.log"
    mock_gl_env.nondet.web.mock_responses[valid_url] = make_benchmark_log(nonce, session, host_addr)
    app.submit_hardware_proof(lid, valid_url)
    app.adjudicate_hardware(lid)

    audited = json.loads(app.get_lease(lid))
    assert audited["verdict"] == "HARDWARE_VERIFIED"
    assert audited["status"] == 7  # AUDIT_COMPLETED

    # 3. Forged / Unregistered Machine ID by host -> IMMEDIATELY REJECTED
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 5_000_000_000_000_000_000
    lid_forged = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_forged = json.loads(app.get_lease(lid_forged))

    mock_gl_env.message.sender_address = host_addr
    forged_url = "https://host.com/forged_machine.log"
    mock_gl_env.nondet.web.mock_responses[forged_url] = make_benchmark_log(
        l_forged["challenge_nonce"], l_forged["session_id"], host_addr,
        machine_id="FAKE-GPU-H100-UNREGISTERED-NODE"
    )
    app.submit_hardware_proof(lid_forged, forged_url)
    app.adjudicate_hardware(lid_forged)

    forged_lease = json.loads(app.get_lease(lid_forged))
    assert forged_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert "UNREGISTERED_MACHINE_ORIGIN" in forged_lease["reason"]

    # 4. Enrolled Machine ID with Forged/Mismatched Digital Signature -> IMMEDIATELY REJECTED
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 5_000_000_000_000_000_000
    lid_bad_sig = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_bad = json.loads(app.get_lease(lid_bad_sig))

    mock_gl_env.message.sender_address = host_addr
    bad_sig_url = "https://host.com/bad_signature.log"
    mock_gl_env.nondet.web.mock_responses[bad_sig_url] = make_benchmark_log(
        l_bad["challenge_nonce"], l_bad["session_id"], host_addr,
        machine_id="NODE-GPU-H100-US-EAST-42", is_valid_signature=False
    )
    app.submit_hardware_proof(lid_bad_sig, bad_sig_url)
    app.adjudicate_hardware(lid_bad_sig)

    bad_lease = json.loads(app.get_lease(lid_bad_sig))
    assert bad_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert "INVALID_HARDWARE_SIGNATURE" in bad_lease["reason"]

    # 5. Contract Owner can register new authorized hardware cluster
    mock_gl_env.message.sender_address = owner_addr
    new_n = "111222333444555666777888999000111222333"
    app.register_authorized_machine("NODE-GPU-H200-SXM-01", "NVIDIA H200 141GB HBM3e", new_n, 65537)
    new_m = json.loads(app.get_authorized_machine("NODE-GPU-H200-SXM-01"))
    assert new_m["machine_id"] == "NODE-GPU-H200-SXM-01"
    assert new_m["pubkey_n"] == new_n

    # 6. Non-owner cannot register machines
    mock_gl_env.message.sender_address = host_addr
    with pytest.raises(Exception, match="Only contract owner"):
        app.register_authorized_machine("HACKED-NODE", "Fake spec", new_n, 65537)


# =============================================================================
# TEST 4: Tri-State SLA Degraded Hardware Payout (60/40)
# =============================================================================
def test_degraded_hardware_partial_payout(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    mock_gl_env.message.value = escrow_amt
    lease_id = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_data = json.loads(app.get_lease(lease_id))

    mock_gl_env.message.sender_address = host_addr
    throttled_url = "https://gist.githubusercontent.com/host/raw/throttled.log"
    mock_gl_env.nondet.web.mock_responses[throttled_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr,
        model="NVIDIA H100 80GB SXM5 (Degraded Clocks)", tflops=700.0, vram=72000
    )
    app.submit_hardware_proof(lease_id, throttled_url)
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["status"] == 7
    assert audited["verdict"] == "HARDWARE_DEGRADED"
    assert audited["initial_verdict"] == "HARDWARE_DEGRADED"

    # Wait out cooling-off window
    mock_gl_env.advance_time(305)
    app.finalize_settlement(lease_id)

    settled = json.loads(app.get_lease(lease_id))
    assert settled["status"] == 5  # SETTLED_PARTIAL
    assert settled["verdict"] == "HARDWARE_DEGRADED"

    # Verify 60/40 Split
    expected_host = (escrow_amt * 60) // 100
    expected_renter = escrow_amt - expected_host

    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    renter_transfers = mock_gl_env.get_contract_at(renter_addr).transfers
    assert host_transfers[0]["value"] == expected_host
    assert renter_transfers[0]["value"] == expected_renter


# =============================================================================
# TEST 5: Appeal Changed to DEGRADED - Host Loses Bond to Renter (Steward Fix)
# =============================================================================
def test_appeal_changed_to_degraded_host_loses_bond_to_renter(mock_gl_env):
    """
    Steward Gen. Dave Scenario:
    Initial verdict was HARDWARE_FRAUDULENT.
    Host appeals seeking HARDWARE_VERIFIED.
    Court rules HARDWARE_DEGRADED.
    Host failed to prove 100% compliance -> Host is the losing appellant.
    10% dispute bond MUST forfeit to Renter (appellee).
    Escrow is split 60% Host, 40% Renter.
    """
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    mock_gl_env.message.value = escrow_amt
    lease_id = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_data = json.loads(app.get_lease(lease_id))

    # Initial adjudication fails (e.g. 404 URL -> FRAUDULENT)
    mock_gl_env.message.sender_address = host_addr
    mock_gl_env.nondet.web.mock_responses["https://initial_fail.com/log.txt"] = "404 Not Found"
    app.submit_hardware_proof(lease_id, "https://initial_fail.com/log.txt")
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["verdict"] == "HARDWARE_FRAUDULENT"
    assert audited["status"] == 7

    # Host appeals seeking Verified, stakes 10% bond (1 GEN)
    bond_amt = 1_000_000_000_000_000_000
    mock_gl_env.message.sender_address = host_addr
    mock_gl_env.message.value = bond_amt
    appeal_url = "https://host.com/degraded_appeal.log"
    mock_gl_env.nondet.web.mock_responses[appeal_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr,
        model="NVIDIA H100 80GB SXM5 (Degraded Clocks)", tflops=700.0, vram=72000
    )
    app.appeal_verdict(lease_id, appeal_url)

    disputed = json.loads(app.get_lease(lease_id))
    assert disputed["status"] == 6  # DISPUTED

    # High court adjudicates appeal -> results in APPEAL_UPHELD_DEGRADED
    app.adjudicate_appeal(lease_id)

    final_lease = json.loads(app.get_lease(lease_id))
    assert final_lease["status"] == 5  # SETTLED_PARTIAL
    assert final_lease["verdict"] == "HARDWARE_DEGRADED"

    # Verify CRITICAL STEWARD REQUIREMENT:
    # Host (appellant) LOST their claim for 100% Verified.
    # Bond (1 GEN) MUST forfeit to Renter (appellee)!
    renter_transfers = mock_gl_env.get_contract_at(renter_addr).transfers
    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers

    renter_values = [t["value"] for t in renter_transfers]
    host_values = [t["value"] for t in host_transfers]

    # Renter receives the 1 GEN forfeit bond!
    assert bond_amt in renter_values
    # Escrow 60/40 split: Host receives 6 GEN, Renter receives 4 GEN
    expected_host_escrow = (escrow_amt * 60) // 100
    expected_renter_escrow = escrow_amt - expected_host_escrow

    assert expected_host_escrow in host_values
    assert expected_renter_escrow in renter_values


# =============================================================================
# TEST 6: Appeal Changed to DEGRADED - Renter Loses Bond to Host (Steward Fix)
# =============================================================================
def test_appeal_changed_to_degraded_renter_loses_bond_to_host(mock_gl_env):
    """
    Steward Gen. Dave Scenario:
    Initial verdict was HARDWARE_VERIFIED.
    Renter appeals seeking HARDWARE_FRAUDULENT (100% refund).
    Court rules HARDWARE_DEGRADED.
    Renter failed to prove total fraud -> Renter is the losing appellant.
    10% dispute bond MUST forfeit to Host (appellee).
    Escrow is split 60% Host, 40% Renter.
    """
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 10_000_000_000_000_000_000
    mock_gl_env.message.value = escrow_amt
    lease_id = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_data = json.loads(app.get_lease(lease_id))

    # Initial adjudication passes -> HARDWARE_VERIFIED
    mock_gl_env.message.sender_address = host_addr
    proof_url = "https://host.com/valid.log"
    mock_gl_env.nondet.web.mock_responses[proof_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr
    )
    app.submit_hardware_proof(lease_id, proof_url)
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["verdict"] == "HARDWARE_VERIFIED"

    # Renter appeals seeking Fraud, stakes 10% bond (1 GEN)
    bond_amt = 1_000_000_000_000_000_000
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = bond_amt
    appeal_url = "https://renter.com/appeal_degraded.log"
    mock_gl_env.nondet.web.mock_responses[appeal_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr,
        model="NVIDIA H100 80GB SXM5 (Degraded Clocks)", tflops=700.0, vram=72000
    )
    app.appeal_verdict(lease_id, appeal_url)

    # Adjudicate appeal -> outcome is HARDWARE_DEGRADED
    app.adjudicate_appeal(lease_id)

    final_lease = json.loads(app.get_lease(lease_id))
    assert final_lease["status"] == 5  # SETTLED_PARTIAL
    assert final_lease["verdict"] == "HARDWARE_DEGRADED"

    # Verify Renter (appellant) LOST their claim of total fraud!
    # Bond (1 GEN) MUST forfeit to Host (appellee)!
    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    renter_transfers = mock_gl_env.get_contract_at(renter_addr).transfers

    host_values = [t["value"] for t in host_transfers]
    renter_values = [t["value"] for t in renter_transfers]

    # Host received the 1 GEN forfeit bond!
    assert bond_amt in host_values
    # Escrow 60/40 split
    expected_host_escrow = (escrow_amt * 60) // 100
    expected_renter_escrow = escrow_amt - expected_host_escrow
    assert expected_host_escrow in host_values
    assert expected_renter_escrow in renter_values


# =============================================================================
# TEST 7: Appeal Dismissal Preserves DEGRADED Initial Verdict & Forfeits Bond
# =============================================================================
def test_appeal_rejected_preserves_degraded_verdict_and_routes_bond_to_host(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 10_000_000_000_000_000_000
    mock_gl_env.message.value = escrow_amt
    lease_id = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_data = json.loads(app.get_lease(lease_id))

    mock_gl_env.message.sender_address = host_addr
    mock_gl_env.nondet.web.mock_responses["https://degraded.com/log.txt"] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr,
        model="NVIDIA H100 80GB SXM5 (Degraded Clocks)", tflops=700.0, vram=72000
    )
    app.submit_hardware_proof(lease_id, "https://degraded.com/log.txt")
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["verdict"] == "HARDWARE_DEGRADED"

    # Renter files frivolous appeal wanting 100% refund
    mock_gl_env.message.sender_address = renter_addr
    bond_amt = 1_000_000_000_000_000_000
    mock_gl_env.message.value = bond_amt
    mock_gl_env.nondet.web.mock_responses["https://appeal.com/proof.txt"] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr,
        model="1060 appeal_fail unconvincing", tflops=10.0, vram=6000
    )
    app.appeal_verdict(lease_id, "https://appeal.com/proof.txt")

    # High Court adjudicates appeal -> APPEAL_REJECTED
    app.adjudicate_appeal(lease_id)

    final_lease = json.loads(app.get_lease(lease_id))
    assert final_lease["status"] == 5  # SETTLED_PARTIAL
    assert final_lease["verdict"] == "HARDWARE_DEGRADED"

    # Host received bond (1 GEN) + 60% escrow (6 GEN)
    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    host_values = [t["value"] for t in host_transfers]
    assert bond_amt in host_values
    assert ((escrow_amt * 60) // 100) in host_values


# =============================================================================
# TEST 8: Appeal Reversal (APPEAL_UPHELD) Refunds Bond & Reverses Settlement
# =============================================================================
def test_appeal_upheld_refunds_bond_and_reverses_settlement(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 10_000_000_000_000_000_000
    mock_gl_env.message.value = escrow_amt
    lease_id = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_data = json.loads(app.get_lease(lease_id))

    # Initial adjudication fails (404 URL -> FRAUDULENT)
    mock_gl_env.message.sender_address = host_addr
    mock_gl_env.nondet.web.mock_responses["https://missing.com/404.txt"] = "404 Not Found"
    app.submit_hardware_proof(lease_id, "https://missing.com/404.txt")
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["verdict"] == "HARDWARE_FRAUDULENT"

    # Host appeals with certified authentic proof
    mock_gl_env.message.sender_address = host_addr
    bond_amt = 1_000_000_000_000_000_000
    mock_gl_env.message.value = bond_amt
    appeal_url = "https://gist.github.com/host/certified.log"
    mock_gl_env.nondet.web.mock_responses[appeal_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr
    )
    app.appeal_verdict(lease_id, appeal_url)

    # Adjudicate appeal -> APPEAL_UPHELD_VERIFIED
    app.adjudicate_appeal(lease_id)

    final_lease = json.loads(app.get_lease(lease_id))
    assert final_lease["status"] == 2  # SETTLED_PAID
    assert final_lease["verdict"] == "HARDWARE_VERIFIED"

    # Host gets 100% of escrow + their 1 GEN bond refunded
    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    host_values = [t["value"] for t in host_transfers]
    assert escrow_amt in host_values
    assert bond_amt in host_values


# =============================================================================
# TEST 9: Renter Appeal Dismissal Preserves VERIFIED Initial Verdict & Forfeits Bond
# =============================================================================
def test_renter_appeal_dismissed_preserves_verified_and_forfeits_bond(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 10_000_000_000_000_000_000
    mock_gl_env.message.value = escrow_amt
    lease_id = app.create_lease_order("NVIDIA H100 80GB SXM5", 86400)
    l_data = json.loads(app.get_lease(lease_id))

    # Initial adjudication passes -> HARDWARE_VERIFIED
    mock_gl_env.message.sender_address = host_addr
    proof_url = "https://valid.com/log.txt"
    mock_gl_env.nondet.web.mock_responses[proof_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr
    )
    app.submit_hardware_proof(lease_id, proof_url)
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["verdict"] == "HARDWARE_VERIFIED"

    # Renter files frivolous appeal
    mock_gl_env.message.sender_address = renter_addr
    bond_amt = 1_000_000_000_000_000_000
    mock_gl_env.message.value = bond_amt
    mock_gl_env.nondet.web.mock_responses["https://renter_frivolous.com/log.txt"] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr,
        model="1060 appeal_fail unconvincing", tflops=10.0, vram=6000
    )
    app.appeal_verdict(lease_id, "https://renter_frivolous.com/log.txt")

    # High Court dismisses appeal -> preserves initial VERIFIED
    app.adjudicate_appeal(lease_id)

    final_lease = json.loads(app.get_lease(lease_id))
    assert final_lease["status"] == 2  # SETTLED_PAID
    assert final_lease["verdict"] == "HARDWARE_VERIFIED"

    # Host received 100% escrow (10 GEN) + 1 GEN forfeit bond
    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    host_values = [t["value"] for t in host_transfers]
    assert escrow_amt in host_values
    assert bond_amt in host_values


# =============================================================================
# TEST 10: Table Finalize Transaction Path (writeContract route)
# =============================================================================
def test_table_finalize_settlement_transaction_path(mock_gl_env):
    """
    Dedicated test covering the frontend Table View 'Finalize' writeContract path:
    1. Lease in AUDIT_COMPLETED (status 7).
    2. Finalize during 5-minute cooling window reverts with UserError.
    3. Finalize after 5-minute cooling window executes state-modifying write transaction.
    4. Balances, status, and double-finalize protection verified.
    """
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0x1111111111111111111111111111111111111111")
    host_addr = SimulatedAddress("0x2222222222222222222222222222222222222222")

    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 8_000_000_000_000_000_000  # 8 GEN
    mock_gl_env.message.value = escrow_amt
    lease_id = app.create_lease_order("NVIDIA H100 SXM5 80GB", 86400)
    l_data = json.loads(app.get_lease(lease_id))

    mock_gl_env.message.sender_address = host_addr
    proof_url = "https://table_finalize_test.com/log.txt"
    mock_gl_env.nondet.web.mock_responses[proof_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host_addr
    )
    app.submit_hardware_proof(lease_id, proof_url)
    app.adjudicate_hardware(lease_id)

    in_audit = json.loads(app.get_lease(lease_id))
    assert in_audit["status"] == 7  # AUDIT_COMPLETED

    # Action 1: Premature table Finalize click during cooling-off window must revert
    with pytest.raises(Exception, match="cooling-off window"):
        app.finalize_settlement(lease_id)

    # Action 2: Advance time past 300-second cooling window (e.g. +310 seconds)
    mock_gl_env.advance_time(310)

    # Action 3: Table Finalize executed as on-chain write transaction
    app.finalize_settlement(lease_id)

    settled_lease = json.loads(app.get_lease(lease_id))
    assert settled_lease["status"] == 2  # SETTLED_PAID
    assert settled_lease["verdict"] == "HARDWARE_VERIFIED"
    assert app.total_compute_locked == 0
    assert app.total_leases_settled == 1

    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    assert len(host_transfers) == 1
    assert host_transfers[0]["value"] == escrow_amt

    # Action 4: Double-finalize protection (reverts if called again)
    with pytest.raises(Exception, match="not awaiting final settlement"):
        app.finalize_settlement(lease_id)


# =============================================================================
# TEST 11: Cancel or Reclaim with Manipulation-Resistant Time Mechanism
# =============================================================================
def test_cancel_or_reclaim_with_time_mechanism(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    other_addr = SimulatedAddress("0xCCCC111122223333444455556666777788889999")

    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 5_000_000_000_000_000_000
    mock_gl_env.message.value = escrow_amt
    lease_id = app.create_lease_order("NVIDIA A100 80GB SXM4", 86400)

    # Non-renter cannot reclaim
    mock_gl_env.message.sender_address = other_addr
    with pytest.raises(Exception, match="Only the compute renter can cancel or reclaim"):
        app.cancel_or_reclaim(lease_id)

    # Renter cannot cancel before duration expiration
    mock_gl_env.message.sender_address = renter_addr
    with pytest.raises(Exception, match="duration has not yet expired"):
        app.cancel_or_reclaim(lease_id)

    # Advance time past expiration (86401 seconds)
    mock_gl_env.advance_time(86401)
    app.cancel_or_reclaim(lease_id)

    cancelled_lease = json.loads(app.get_lease(lease_id))
    assert cancelled_lease["status"] == 4  # CANCELLED
    assert cancelled_lease["verdict"] == "CANCELLED"
    assert app.total_compute_locked == 0

    renter_transfers = mock_gl_env.get_contract_at(renter_addr).transfers
    assert renter_transfers[0]["value"] == escrow_amt


# =============================================================================
# TEST 12: Contract Views and Pagination
# =============================================================================
def test_views_and_pagination(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")

    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 1_000_000_000_000_000_000

    lid1 = app.create_lease_order("NVIDIA H100 Order 1", 86400)
    lid2 = app.create_lease_order("NVIDIA H100 Order 2", 86400)
    lid3 = app.create_lease_order("NVIDIA H100 Order 3", 86400)

    assert app.get_lease_count() == 3
    assert app.get_lease_id_by_index(0) == lid1
    assert app.get_lease_id_by_index(1) == lid2
    assert app.get_lease_id_by_index(2) == lid3

    with pytest.raises(Exception, match="out of bounds"):
        app.get_lease_id_by_index(99)

    page1 = json.loads(app.get_leases_paginated(0, 2))
    assert len(page1) == 2
    assert page1[0]["lease_id"] == lid1
    assert page1[1]["lease_id"] == lid2

    page2 = json.loads(app.get_leases_paginated(2, 2))
    assert len(page2) == 1
    assert page2[0]["lease_id"] == lid3

    empty_page = json.loads(app.get_leases_paginated(10, 5))
    assert empty_page == []

    stats = json.loads(app.get_stats())
    assert stats["total_leases"] == 3
    assert stats["total_compute_locked"] == "3000000000000000000"
