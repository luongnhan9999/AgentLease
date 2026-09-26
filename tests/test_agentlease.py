import sys
import os
import json
import pytest

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
# TEST 1: Full Lifecycle with Manipulation-Resistant Time
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
    assert "CHALLENGE-" in lease_json["challenge_nonce"]
    assert "SESS-" in lease_json["session_id"]

    # 2. Host submits proof
    mock_gl_env.message.sender_address = host_addr
    proof_url = "https://gist.githubusercontent.com/host/raw/h100_benchmark.log"
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

    mock_gl_env.nondet.web.mock_responses["https://replay.com/log.txt"] = """
    Device: NVIDIA H100 80GB
    VRAM: 81920 MiB
    TFLOPS: 989 TFLOPS
    Replay_Attack: True
    Mismatched_Challenge: True
    """
    app.adjudicate_hardware(lid_replay)
    r_lease = json.loads(app.get_lease(lid_replay))
    assert r_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert "Replay attack" in r_lease["reason"]

    # B. Session unbound
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 5_000_000_000_000_000_000
    lid_unbound = app.create_lease_order("NVIDIA H100 80GB SXM5 Enterprise", 86400)

    mock_gl_env.message.sender_address = host_addr
    app.submit_hardware_proof(lid_unbound, "https://unbound.com/log.txt")

    mock_gl_env.nondet.web.mock_responses["https://unbound.com/log.txt"] = """
    Device: NVIDIA H100 80GB
    VRAM: 81920 MiB
    Unbound_Session: True
    """
    app.adjudicate_hardware(lid_unbound)
    u_lease = json.loads(app.get_lease(lid_unbound))
    assert u_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert "Telemetry unbound" in u_lease["reason"]

    # C. Unauthenticated source / Missing signature
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 5_000_000_000_000_000_000
    lid_unsigned = app.create_lease_order("NVIDIA H100 80GB SXM5 Enterprise", 86400)

    mock_gl_env.message.sender_address = host_addr
    app.submit_hardware_proof(lid_unsigned, "https://unsigned.com/log.txt")

    mock_gl_env.nondet.web.mock_responses["https://unsigned.com/log.txt"] = """
    Device: NVIDIA H100 80GB
    VRAM: 81920 MiB
    Unsigned_Source: True
    """
    app.adjudicate_hardware(lid_unsigned)
    s_lease = json.loads(app.get_lease(lid_unsigned))
    assert s_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert "Unauthenticated source" in s_lease["reason"]


# =============================================================================
# TEST 3: Tri-State SLA Degraded Hardware Payout (60/40)
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

    mock_gl_env.message.sender_address = host_addr
    throttled_url = "https://gist.githubusercontent.com/host/raw/throttled.log"
    mock_gl_env.nondet.web.mock_responses[throttled_url] = """
    Device: NVIDIA H100 80GB SXM5
    VRAM: 72000 MiB
    TFLOPS: 700 TFLOPS (Degraded performance due to thermal limit)
    Attestation Seal: SIG-VALID-12345
    """
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
# TEST 4: Appeal Dismissal Preserves DEGRADED Initial Verdict (60/40) & Forfeits Bond
# =============================================================================
def test_appeal_rejected_preserves_degraded_verdict_and_routes_bond_to_host(mock_gl_env):
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

    mock_gl_env.message.sender_address = host_addr
    mock_gl_env.nondet.web.mock_responses["https://degraded.com/log.txt"] = """
    Device: NVIDIA H100 80GB SXM5
    TFLOPS: 700 TFLOPS (Degraded)
    """
    app.submit_hardware_proof(lease_id, "https://degraded.com/log.txt")
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["verdict"] == "HARDWARE_DEGRADED"
    assert audited["initial_verdict"] == "HARDWARE_DEGRADED"

    # Renter files frivolous appeal wanting 100% refund
    mock_gl_env.message.sender_address = renter_addr
    bond_amt = 1_000_000_000_000_000_000  # 10% bond (1 GEN)
    mock_gl_env.message.value = bond_amt
    mock_gl_env.nondet.web.mock_responses["https://appeal.com/proof.txt"] = "appeal_fail: unconvincing evidence"
    app.appeal_verdict(lease_id, "https://appeal.com/proof.txt")

    disputed = json.loads(app.get_lease(lease_id))
    assert disputed["status"] == 6  # DISPUTED
    assert disputed["initial_verdict"] == "HARDWARE_DEGRADED"

    # High Court adjudicates appeal -> APPEAL_REJECTED
    app.adjudicate_appeal(lease_id)

    final_lease = json.loads(app.get_lease(lease_id))
    # CRITICAL: Verdict MUST be preserved as HARDWARE_DEGRADED (status 5)
    assert final_lease["status"] == 5  # SETTLED_PARTIAL
    assert final_lease["verdict"] == "HARDWARE_DEGRADED"

    # Check Bond Routing: Host (appellee) receives the 1 GEN forfeit bond!
    # Plus Host receives 60% of escrow (6 GEN), Renter receives 40% of escrow (4 GEN)
    expected_host_escrow = (escrow_amt * 60) // 100
    expected_renter_escrow = escrow_amt - expected_host_escrow

    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    renter_transfers = mock_gl_env.get_contract_at(renter_addr).transfers

    # Host received bond (1 GEN) + 60% escrow (6 GEN)
    host_values = [t["value"] for t in host_transfers]
    assert bond_amt in host_values
    assert expected_host_escrow in host_values

    # Renter received 40% escrow (4 GEN)
    renter_values = [t["value"] for t in renter_transfers]
    assert expected_renter_escrow in renter_values


# =============================================================================
# TEST 5: Appeal Reversal (APPEAL_UPHELD) Refunds Bond & Reverses Settlement
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

    # Initial adjudication fails (e.g. 404 URL -> FRAUDULENT)
    mock_gl_env.message.sender_address = host_addr
    mock_gl_env.nondet.web.mock_responses["https://missing.com/404.txt"] = "404 Not Found"
    app.submit_hardware_proof(lease_id, "https://missing.com/404.txt")
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["verdict"] == "HARDWARE_FRAUDULENT"

    # Host appeals with certified authenticated proof
    mock_gl_env.message.sender_address = host_addr
    bond_amt = 1_000_000_000_000_000_000
    mock_gl_env.message.value = bond_amt
    appeal_url = "https://gist.github.com/host/certified.log"
    mock_gl_env.nondet.web.mock_responses[appeal_url] = """
    Certified Authentic NVIDIA H100 80GB SXM5
    VRAM: 81920 MiB
    GEMM TFLOPS: 990 TFLOPS
    """
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
# TEST 6: Renter Appeal Dismissal Preserves VERIFIED Initial Verdict & Forfeits Bond
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

    # Initial adjudication passes -> HARDWARE_VERIFIED
    mock_gl_env.message.sender_address = host_addr
    app.submit_hardware_proof(lease_id, "https://valid.com/log.txt")
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["verdict"] == "HARDWARE_VERIFIED"

    # Renter maliciously appeals to try to extract funds
    mock_gl_env.message.sender_address = renter_addr
    bond_amt = 1_000_000_000_000_000_000
    mock_gl_env.message.value = bond_amt
    mock_gl_env.nondet.web.mock_responses["https://renter/fake_evidence.txt"] = "appeal_fail: unsubstantiated claim"
    app.appeal_verdict(lease_id, "https://renter/fake_evidence.txt")

    # High Court dismisses appeal -> APPEAL_REJECTED
    app.adjudicate_appeal(lease_id)

    final_lease = json.loads(app.get_lease(lease_id))
    assert final_lease["status"] == 2  # SETTLED_PAID
    assert final_lease["verdict"] == "HARDWARE_VERIFIED"

    # Host received 100% escrow (10 GEN) AND the 1 GEN forfeit bond!
    host_transfers = mock_gl_env.get_contract_at(host_addr).transfers
    host_values = [t["value"] for t in host_transfers]
    assert escrow_amt in host_values
    assert bond_amt in host_values


# =============================================================================
# TEST 7: Cancel or Reclaim Governed by Deterministic Time
# =============================================================================
def test_cancel_or_reclaim_with_time_mechanism(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    mock_gl_env.message.sender_address = renter_addr
    escrow_amt = 5_000_000_000_000_000_000
    mock_gl_env.message.value = escrow_amt

    lease_id = app.create_lease_order("NVIDIA RTX 4090 Mesh", 86400)

    # Cannot cancel before expiration
    with pytest.raises(Exception, match="duration has not yet expired"):
        app.cancel_or_reclaim(lease_id)

    # Advance time past 86400 seconds (1 day)
    mock_gl_env.advance_time(86401)
    app.cancel_or_reclaim(lease_id)

    cancelled = json.loads(app.get_lease(lease_id))
    assert cancelled["status"] == 4  # CANCELLED
    assert cancelled["verdict"] == "CANCELLED"
    assert app.total_compute_locked == 0

    # Renter refunded 100% of escrow
    renter_transfers = mock_gl_env.get_contract_at(renter_addr).transfers
    assert renter_transfers[0]["value"] == escrow_amt


# =============================================================================
# TEST 8: Pagination & Stats Verification
# =============================================================================
def test_views_and_pagination(mock_gl_env):
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 1_000_000_000_000_000_000

    app.create_lease_order("NVIDIA Cluster A", 86400)
    app.create_lease_order("NVIDIA Cluster B", 86400)
    app.create_lease_order("NVIDIA Cluster C", 86400)

    assert app.get_lease_count() == 3
    assert app.get_lease_id_by_index(0) == "lease-1"
    assert app.get_lease_id_by_index(1) == "lease-2"
    assert app.get_lease_id_by_index(2) == "lease-3"

    paginated = json.loads(app.get_leases_paginated(0, 2))
    assert len(paginated) == 2
    assert paginated[0]["lease_id"] == "lease-1"
    assert paginated[1]["lease_id"] == "lease-2"

    stats = json.loads(app.get_stats())
    assert stats["total_leases"] == 3
    assert stats["total_compute_locked"] == "3000000000000000000"
