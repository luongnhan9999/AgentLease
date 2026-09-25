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

    # 7. AI Adjudication: HARDWARE_VERIFIED
    app.adjudicate_hardware(lease_id)

    settled_lease = json.loads(app.get_lease(lease_id))
    assert settled_lease["status"] == 2  # SETTLED_PAID
    assert settled_lease["verdict"] == "HARDWARE_VERIFIED"
    assert settled_lease["performance_score"] >= 70
    assert app.total_leases_settled == 1
    assert app.total_compute_locked == 0

    # Verify payout transfer went to Host
    host_contract = mock_gl_env.get_contract_at(host_addr)
    assert len(host_contract.transfers) == 1
    assert host_contract.transfers[0]["value"] == escrow_amt


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

    # Configure web renderer to return low-end consumer GPU
    mock_gl_env.nondet.web.mock_responses = {
        fake_proof_url: """
[GPU DIAGNOSTIC REPORT]
Device 0: NVIDIA GeForce GTX 1060 6GB
VRAM Total: 6144 MiB
Driver Version: 470.57
GEMM Peak TFLOPS (FP16): 4.4 TFLOPS
Severe thermal throttling detected!
"""
    }

    app.submit_hardware_proof(lease_id, fake_proof_url)

    # Run AI Adjudication
    app.adjudicate_hardware(lease_id)

    fraud_lease = json.loads(app.get_lease(lease_id))
    assert fraud_lease["status"] == 3  # FRAUD_REFUNDED
    assert fraud_lease["verdict"] == "HARDWARE_FRAUDULENT"
    assert fraud_lease["performance_score"] < 70

    # Verify refund was sent back to Renter
    renter_contract = mock_gl_env.get_contract_at(renter_addr)
    assert len(renter_contract.transfers) == 1
    assert renter_contract.transfers[0]["value"] == escrow_amt


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

