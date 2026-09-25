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

    # Also reload contract if already loaded
    if "contract" in sys.modules:
        del sys.modules["contract"]

    return gl_module


def test_agentlease_lifecycle(mock_gl_env):
    setup_gl_mock(mock_gl_env)

    import contract
    contract.gl = mock_gl_env

    # 1. Initialize Contract
    app = contract.Contract()
    assert app.total_compute_locked == 0
    assert app.total_leases_settled == 0
    assert app.lease_counter == 0

    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host_addr = SimulatedAddress("0xBBBB111122223333444455556666777788889999")

    # 2. Test create_lease_order validation
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 0
    with pytest.raises(Exception, match="greater than 0 GEN"):
        app.create_lease_order("NVIDIA H100 80GB VRAM", 5000)

    # 3. Create valid lease
    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    mock_gl_env.message.value = escrow_amt
    lease_spec = "NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16"
    lease_id = app.create_lease_order(lease_spec, 500)

    assert lease_id == "lease-1"
    assert app.total_compute_locked == escrow_amt
    assert app.get_lease_count() == 1

    # Check state
    lease_json = json.loads(app.get_lease(lease_id))
    assert lease_json["lease_id"] == "lease-1"
    assert lease_json["renter"] == str(renter_addr)
    assert lease_json["status"] == 0  # OPEN
    assert lease_json["verdict"] == "PENDING"

    # 4. Renter cannot claim own lease
    with pytest.raises(Exception, match="cannot claim and host"):
        app.submit_hardware_proof(lease_id, "https://gist.githubusercontent.com/proof/raw/benchmark.txt")

    # 5. Invalid URL validation
    mock_gl_env.message.sender_address = host_addr
    with pytest.raises(Exception, match="Valid public benchmark log URL"):
        app.submit_hardware_proof(lease_id, "ftp://invalid-url.com")

    # 6. Host submits valid hardware proof
    proof_url = "https://gist.githubusercontent.com/host/raw/h100_benchmark.log"
    app.submit_hardware_proof(lease_id, proof_url)

    updated_lease = json.loads(app.get_lease(lease_id))
    assert updated_lease["status"] == 1  # IN_AUDIT
    assert updated_lease["host"] == str(host_addr)
    assert updated_lease["benchmark_log_url"] == proof_url

    # 7. AI Adjudication: HARDWARE_VERIFIED -> Enters status 7: AUDIT_COMPLETED (Challenge cooling-off window)
    app.adjudicate_hardware(lease_id)

    audited_lease = json.loads(app.get_lease(lease_id))
    assert audited_lease["status"] == 7  # AUDIT_COMPLETED
    assert audited_lease["verdict"] == "HARDWARE_VERIFIED"
    assert audited_lease["performance_score"] >= 80

    # 8. Fast-forward past 30 blocks cooling-off window and finalize settlement
    app.lease_counter = 100
    mock_gl_env.message.sender_address = host_addr
    app.finalize_settlement(lease_id)

    settled_lease = json.loads(app.get_lease(lease_id))
    assert settled_lease["status"] == 2  # SETTLED_PAID
    assert app.total_leases_settled == 1
    assert app.total_compute_locked == 0

    # Verify payout transfer went 100% to Host
    host_contract = mock_gl_env.get_contract_at(host_addr)
    assert len(host_contract.transfers) == 1
    assert host_contract.transfers[0]["value"] == escrow_amt


def test_degraded_hardware_partial_payout(mock_gl_env):
    """Verifies Tri-State Partial Payout: 60% to Host, 40% refund to Renter."""
    setup_gl_mock(mock_gl_env)

    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0x1111222233334444555566667777888899990000")
    host_addr = SimulatedAddress("0x2222333344445555666677778888999900001111")

    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = escrow_amt

    lease_id = app.create_lease_order("NVIDIA A100 80GB SXM4 with min 600 TFLOPS", 500)

    # Host submits benchmark that is degraded (measured 700 TFLOPS FP8 instead of FP16, slightly below spec)
    mock_gl_env.message.sender_address = host_addr
    degraded_proof_url = "https://gist.githubusercontent.com/degraded/raw/a100_700_tflops.log"
    mock_gl_env.nondet.web.mock_responses = {
        degraded_proof_url: "Device: NVIDIA A100 80GB. Measured 700 TFLOPS with thermal throttling."
    }

    app.submit_hardware_proof(lease_id, degraded_proof_url)
    app.adjudicate_hardware(lease_id)

    audited = json.loads(app.get_lease(lease_id))
    assert audited["status"] == 7  # AUDIT_COMPLETED
    assert audited["verdict"] == "HARDWARE_DEGRADED"

    # Finalize settlement
    app.lease_counter = 100
    app.finalize_settlement(lease_id)

    settled = json.loads(app.get_lease(lease_id))
    assert settled["status"] == 5  # SETTLED_PARTIAL

    # Host gets 60% = 6 GEN
    host_contract = mock_gl_env.get_contract_at(host_addr)
    assert len(host_contract.transfers) == 1
    assert host_contract.transfers[0]["value"] == 6_000_000_000_000_000_000

    # Renter gets 40% refund = 4 GEN
    renter_contract = mock_gl_env.get_contract_at(renter_addr)
    assert len(renter_contract.transfers) == 1
    assert renter_contract.transfers[0]["value"] == 4_000_000_000_000_000_000


def test_fraudulent_hardware_refund(mock_gl_env):
    setup_gl_mock(mock_gl_env)

    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0x1234123412341234123412341234123412341234")
    host_addr = SimulatedAddress("0x9876987698769876987698769876987698769876")

    escrow_amt = 5_000_000_000_000_000_000  # 5 GEN
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = escrow_amt

    lease_id = app.create_lease_order("NVIDIA H100 80GB VRAM required for Llama-3 70B training", 1000)

    # Host submits proof with fake/low-tier hardware
    mock_gl_env.message.sender_address = host_addr
    fake_proof_url = "https://gist.githubusercontent.com/fraud/raw/fake_h100.log"

    mock_gl_env.nondet.web.mock_responses = {
        fake_proof_url: """
[GPU DIAGNOSTIC REPORT]
Device 0: NVIDIA GeForce GTX 1060 6GB
VRAM Total: 6144 MiB
Severe thermal throttling detected!
"""
    }

    app.submit_hardware_proof(lease_id, fake_proof_url)
    app.adjudicate_hardware(lease_id)

    # Fast forward past 30-block cooling-off window
    app.lease_counter = 100
    mock_gl_env.message.sender_address = renter_addr
    app.finalize_settlement(lease_id)

    fraud_lease = json.loads(app.get_lease(lease_id))
    assert fraud_lease["status"] == 3  # FRAUD_REFUNDED
    assert fraud_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert app.total_compute_locked == 0

    # Verify 100% refund was sent back to Renter
    renter_contract = mock_gl_env.get_contract_at(renter_addr)
    assert len(renter_contract.transfers) == 1
    assert renter_contract.transfers[0]["value"] == escrow_amt


def test_dispute_appeal_mechanism(mock_gl_env):
    """Verifies Dispute Appeal with Staked Bond and strict Escrow Accounting."""
    setup_gl_mock(mock_gl_env)

    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0x3333444455556666777788889999000011112222")
    host_addr = SimulatedAddress("0x4444555566667777888899990000111122223333")

    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = escrow_amt

    lease_id = app.create_lease_order("NVIDIA H100 80GB SXM5 Enterprise Node", 500)
    assert app.total_compute_locked == escrow_amt

    mock_gl_env.message.sender_address = host_addr
    proof_url = "https://gist.githubusercontent.com/host/raw/h100.log"
    app.submit_hardware_proof(lease_id, proof_url)
    app.adjudicate_hardware(lease_id)

    # Host wants to appeal with bond
    mock_gl_env.message.sender_address = host_addr
    bond_amt = 1_000_000_000_000_000_000  # 1 GEN (10% of 10 GEN)
    mock_gl_env.message.value = bond_amt
    appeal_url = "https://gist.githubusercontent.com/host/raw/h100_verified_evidence.log"

    app.appeal_verdict(lease_id, appeal_url)

    # Accounting Check: locked compute must include both escrow AND bond!
    assert app.total_compute_locked == escrow_amt + bond_amt

    disputed = json.loads(app.get_lease(lease_id))
    assert disputed["status"] == 6  # DISPUTED
    assert disputed["dispute_initiator"] == str(host_addr)
    assert disputed["dispute_bond"] == str(bond_amt)

    # High Court AI Jury deliberates on appeal
    app.adjudicate_appeal(lease_id)

    # Accounting Check: all funds settled and total_compute_locked is 0!
    assert app.total_compute_locked == 0

    final_lease = json.loads(app.get_lease(lease_id))
    assert final_lease["status"] == 2  # SETTLED_PAID
    assert final_lease["verdict"] == "HARDWARE_VERIFIED"
    assert final_lease["dispute_bond"] == "0"

    # Host got their bond back + escrow payout
    host_contract = mock_gl_env.get_contract_at(host_addr)
    assert len(host_contract.transfers) == 2
    transferred_values = [t["value"] for t in host_contract.transfers]
    assert bond_amt in transferred_values
    assert escrow_amt in transferred_values


def test_views_and_pagination(mock_gl_env):
    setup_gl_mock(mock_gl_env)

    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = 1_000_000_000_000_000_000

    # Create 3 leases
    for i in range(3):
        app.create_lease_order(f"GPU Cluster Spec #{i}: 8x NVIDIA RTX 4090 24GB", 500)

    assert app.get_lease_count() == 3
    assert app.get_lease_id_by_index(0) == "lease-1"
    assert app.get_lease_id_by_index(2) == "lease-3"

    paginated = json.loads(app.get_leases_paginated(0, 2))
    assert len(paginated) == 2
    assert paginated[0]["lease_id"] == "lease-1"
    assert paginated[1]["lease_id"] == "lease-2"

    paginated_tail = json.loads(app.get_leases_paginated(2, 5))
    assert len(paginated_tail) == 1
    assert paginated_tail[0]["lease_id"] == "lease-3"

    stats = json.loads(app.get_stats())
    assert stats["total_leases"] == 3
    assert stats["total_compute_locked"] == "3000000000000000000"


def test_cancel_or_reclaim(mock_gl_env):
    setup_gl_mock(mock_gl_env)

    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    other_addr = SimulatedAddress("0xCCCC111122223333444455556666777788889999")

    escrow_amt = 2_000_000_000_000_000_000
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = escrow_amt

    lease_id = app.create_lease_order("NVIDIA A100 80GB SXM4 Cluster with InfiniBand", 10)

    # Non-renter cannot cancel
    mock_gl_env.message.sender_address = other_addr
    with pytest.raises(Exception, match="Only the compute renter"):
        app.cancel_or_reclaim(lease_id)

    # Cannot cancel before expiry
    mock_gl_env.message.sender_address = renter_addr
    with pytest.raises(Exception, match="Lease duration has not yet expired"):
        app.cancel_or_reclaim(lease_id)

    # Fast forward counter past expiration
    app.lease_counter = 20
    app.cancel_or_reclaim(lease_id)

    cancelled_lease = json.loads(app.get_lease(lease_id))
    assert cancelled_lease["status"] == 4  # CANCELLED
    assert cancelled_lease["verdict"] == "CANCELLED"
    assert app.total_compute_locked == 0

    # Verify refund was sent back to Renter
    renter_contract = mock_gl_env.get_contract_at(renter_addr)
    assert len(renter_contract.transfers) == 1
    assert renter_contract.transfers[0]["value"] == escrow_amt


def test_renter_appeal_dismissed(mock_gl_env):
    """Verifies that if Renter files frivolous appeal against valid hardware,
    appeal is rejected, Renter's bond is slashed to Host, and Host gets full escrow."""
    setup_gl_mock(mock_gl_env)

    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    renter_addr = SimulatedAddress("0x5555666677778888999900001111222233334444")
    host_addr = SimulatedAddress("0x6666777788889999000011112222333344445555")

    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    mock_gl_env.message.sender_address = renter_addr
    mock_gl_env.message.value = escrow_amt

    lease_id = app.create_lease_order("NVIDIA H100 80GB SXM5 Sovereign Cluster", 500)

    mock_gl_env.message.sender_address = host_addr
    proof_url = "https://gist.githubusercontent.com/host/raw/h100_valid.log"
    app.submit_hardware_proof(lease_id, proof_url)
    app.adjudicate_hardware(lease_id)

    # Renter files frivolous appeal with bad evidence
    mock_gl_env.message.sender_address = renter_addr
    bond_amt = 1_000_000_000_000_000_000  # 1 GEN
    mock_gl_env.message.value = bond_amt
    frivolous_appeal_url = "https://gist.githubusercontent.com/renter/raw/gtx1060_claim.log"
    mock_gl_env.nondet.web.mock_responses = {
        frivolous_appeal_url: "Device: NVIDIA GeForce GTX 1060. False claim."
    }

    app.appeal_verdict(lease_id, frivolous_appeal_url)
    assert app.total_compute_locked == escrow_amt + bond_amt

    # Supreme Court rejects Renter's appeal
    app.adjudicate_appeal(lease_id)

    disputed = json.loads(app.get_lease(lease_id))
    assert disputed["status"] == 2  # SETTLED_PAID to Host!
    assert disputed["verdict"] == "HARDWARE_VERIFIED"
    assert app.total_compute_locked == 0

    # Host received BOTH the 10 GEN escrow AND the 1 GEN slashed bond from Renter!
    host_contract = mock_gl_env.get_contract_at(host_addr)
    assert len(host_contract.transfers) == 2
    transferred_values = [t["value"] for t in host_contract.transfers]
    assert escrow_amt in transferred_values
    assert bond_amt in transferred_values

