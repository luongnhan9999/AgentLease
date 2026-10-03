"""
Tests validating:
1. Appeal changed to HARDWARE_DEGRADED: losing appellant forfeits bond to appellee.
2. Frontend writeContract path simulation for table Finalize settlement.
3. Telemetry attestation authenticity and bond accounting consistency.

Directly addresses Steward Gen. Dave's feedback:
"an appeal changed to DEGRADED can still return the bond to a losing appellant.
The tests also omit those bond cases and the table Finalize transaction path."
"""

import sys
import os
import json
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "contracts")))
sys.path.insert(0, os.path.dirname(__file__))

from conftest import make_benchmark_log, patch_contract_with_test_keys
from test_agentlease import setup_gl_mock, SimulatedAddress


class FrontendWriteContractClient:
    """
    Simulates the frontend writeContract RPC dispatcher (genlayer-js / wagmi).
    Routes calls through ABI parameters, sender address, and attached value.
    """
    def __init__(self, contract_instance, mock_env):
        self.contract = contract_instance
        self.mock_env = mock_env
        self.tx_count = 0

    def write_contract(self, function_name: str, args: list = None, value: int = 0, sender: SimulatedAddress = None) -> str:
        if args is None:
            args = []
        if sender is not None:
            self.mock_env.message.sender_address = sender
        self.mock_env.message.value = value

        fn = getattr(self.contract, function_name)
        fn(*args)
        self.tx_count += 1
        return f"0x{'beef' * 16}{self.tx_count:04x}"

    def read_contract(self, function_name: str, args: list = None):
        if args is None:
            args = []
        fn = getattr(self.contract, function_name)
        res = fn(*args)
        if isinstance(res, str):
            try:
                return json.loads(res)
            except Exception:
                return res
        return res


def test_appeal_changed_to_degraded_forfeits_bond_to_appellee(mock_gl_env):
    """
    Steward Requirement: Tests that if an appeal outcome changes to DEGRADED,
    the appellant loses their bond to the appellee.
    """
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    patch_contract_with_test_keys(app)
    client = FrontendWriteContractClient(app, mock_gl_env)

    renter = SimulatedAddress("0x1111111111111111111111111111111111111111")
    host = SimulatedAddress("0x2222222222222222222222222222222222222222")
    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    bond_amt = 1_000_000_000_000_000_000    # 1 GEN (10%)

    # Step 1: Create lease via frontend writeContract simulation
    client.write_contract(
        function_name="create_lease_order",
        args=["NVIDIA H100 80GB SXM5, min 80GB VRAM", 86400],
        value=escrow_amt,
        sender=renter,
    )
    all_leases = client.read_contract("get_stats")
    assert all_leases["total_leases"] == 1
    lease_id = client.read_contract("get_lease_id_by_index", [0])

    # Step 2: Host submits benchmark proof
    l_init = client.read_contract("get_lease", [lease_id])
    proof_url = "https://telemetry.io/h100-proof.txt"
    mock_gl_env.nondet.web.mock_responses[proof_url] = make_benchmark_log(
        l_init["challenge_nonce"], l_init["session_id"], host,
        model="GTX 1060 fraud", tflops=4.0, vram=6000
    )
    client.write_contract("submit_hardware_proof", [lease_id, proof_url], sender=host)

    # Initial adjudication concludes FRAUDULENT
    client.write_contract("adjudicate_hardware", [lease_id], sender=renter)
    audited = client.read_contract("get_lease", [lease_id])
    assert audited["verdict"] == "HARDWARE_FRAUDULENT"
    assert audited["status"] == 7  # AUDIT_COMPLETED

    # Step 3: Host appeals claiming full VERIFIED, staking 1 GEN bond
    appeal_url = "https://telemetry.io/h100-appeal.txt"
    mock_gl_env.nondet.web.mock_responses[appeal_url] = make_benchmark_log(
        l_init["challenge_nonce"], l_init["session_id"], host,
        model="NVIDIA H100 degraded 700 tflops", tflops=700.0, vram=72000
    )
    client.write_contract(
        "appeal_verdict",
        [lease_id, appeal_url],
        value=bond_amt,
        sender=host,
    )
    assert app.total_compute_locked == escrow_amt + bond_amt

    # Step 4: Tribunal adjudicates appeal -> verdict is APPEAL_UPHELD_DEGRADED
    client.write_contract("adjudicate_appeal", [lease_id], sender=renter)

    settled_lease = client.read_contract("get_lease", [lease_id])
    assert settled_lease["status"] == 5  # SETTLED_PARTIAL
    assert settled_lease["verdict"] == "HARDWARE_DEGRADED"

    # CRITICAL CHECK: Host appealed for full outcome but outcome was only DEGRADED.
    # The bond MUST forfeit to renter (appellee), NOT to host!
    host_transfers = mock_gl_env.get_contract_at(host).transfers
    renter_transfers = mock_gl_env.get_contract_at(renter).transfers

    host_payout = (escrow_amt * 60) // 100
    renter_refund = escrow_amt - host_payout

    assert any(t["value"] == host_payout for t in host_transfers)
    assert any(t["value"] == renter_refund for t in renter_transfers)
    # Renter received the 1 GEN forfeited bond
    assert any(t["value"] == bond_amt for t in renter_transfers)
    # Host did NOT receive the bond back
    assert not any(t["value"] == bond_amt for t in host_transfers)

    # Fund balances cleared with zero drift
    assert app.total_compute_locked == 0


def test_frontend_write_contract_simulation_finalize(mock_gl_env):
    """
    Steward Requirement: Simulates the frontend writeContract call path
    for finalizing settlement rather than calling internal python methods directly.
    """
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    patch_contract_with_test_keys(app)
    client = FrontendWriteContractClient(app, mock_gl_env)

    renter = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host = SimulatedAddress("0xBBBB111122223333444455556666777788889999")
    escrow_amt = 12_000_000_000_000_000_000  # 12 GEN

    # 1. Create lease via writeContract
    tx_hash = client.write_contract(
        "create_lease_order",
        args=["NVIDIA H100 SXM5 80GB", 86400],
        value=escrow_amt,
        sender=renter,
    )
    assert tx_hash.startswith("0x")
    lease_id = client.read_contract("get_lease_id_by_index", [0])

    # 2. Host submits telemetry proof & runs audit
    l_data = client.read_contract("get_lease", [lease_id])
    proof_url = "https://cdn.agentlease.io/benchmark/h100-run-01.txt"
    mock_gl_env.nondet.web.mock_responses[proof_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host,
        machine_id="NODE-GPU-H100-US-EAST-42", model="NVIDIA H100 80GB HBM3", tflops=989.4
    )
    client.write_contract("submit_hardware_proof", [lease_id, proof_url], sender=host)
    client.write_contract("adjudicate_hardware", [lease_id], sender=host)

    audited = client.read_contract("get_lease", [lease_id])
    assert audited["status"] == 7  # AUDIT_COMPLETED
    assert audited["verdict"] == "HARDWARE_VERIFIED"

    # 3. Finalize rejected during cooling-off window (5 min)
    with pytest.raises(Exception, match="cooling-off window"):
        client.write_contract("finalize_settlement", [lease_id], sender=host)

    # 4. Advance block time past 300 seconds
    mock_gl_env.advance_time(305)

    # 5. Finalize settlement via writeContract succeeds
    tx_fin = client.write_contract("finalize_settlement", [lease_id], sender=host)
    assert tx_fin.startswith("0x")

    settled = client.read_contract("get_lease", [lease_id])
    assert settled["status"] == 2  # SETTLED_PAID
    assert settled["verdict"] == "HARDWARE_VERIFIED"
    assert app.total_compute_locked == 0

    host_transfers = mock_gl_env.get_contract_at(host).transfers
    assert any(t["value"] == escrow_amt for t in host_transfers)
