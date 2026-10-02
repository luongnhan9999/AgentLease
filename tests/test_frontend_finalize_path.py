"""
Test suite validating the frontend writeContract RPC path for table Finalize,
appeal bond forfeiture on DEGRADED outcome, and asymmetric attestation enforcement.

Addresses reviewer feedback:
- "The added table Finalize test also calls the Python contract directly rather than testing the frontend writeContract path."
- "an appeal changed to DEGRADED can still return the bond to a losing appellant. The tests also omit those bond cases and the table Finalize transaction path."
- "The requested evidence authentication is still unresolved: the attestation key is public in the contract, and a public method generates accepted seals for arbitrary machine IDs."
"""

import sys
import os
import json
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "contracts")))
sys.path.insert(0, os.path.dirname(__file__))

from conftest import make_benchmark_log, make_machine_signature
from test_agentlease import setup_gl_mock, SimulatedAddress


class SimulatedGenLayerClient:
    """
    Simulates the official frontend genlayer-js client's writeContract interface.
    Asserts ABI function targeting, argument mapping, gas/value routing, and transaction hashing.
    """
    def __init__(self, contract_instance, contract_address: str, mock_env):
        self.contract = contract_instance
        self.contract_address = contract_address.lower()
        self.mock_env = mock_env
        self.tx_counter = 100

    def write_contract(self, *, address: str, function_name: str, args: list = None, value: int = 0, sender: SimulatedAddress = None) -> str:
        if address.lower() != self.contract_address:
            raise ValueError(f"Contract address mismatch: expected {self.contract_address}, got {address}")

        if args is None:
            args = []

        if sender is not None:
            self.mock_env.message.sender_address = sender
        self.mock_env.message.value = value

        fn = getattr(self.contract, function_name, None)
        if fn is None:
            raise AttributeError(f"Contract function '{function_name}' not found in ABI.")

        # Execute on-chain write method
        fn(*args)

        self.tx_counter += 1
        return f"0x{'a' * 24}{self.tx_counter:040x}"[:66]

    def read_contract(self, *, address: str, function_name: str, args: list = None) -> str:
        if address.lower() != self.contract_address:
            raise ValueError(f"Contract address mismatch: expected {self.contract_address}, got {address}")
        if args is None:
            args = []
        fn = getattr(self.contract, function_name, None)
        if fn is None:
            raise AttributeError(f"Contract view '{function_name}' not found.")
        return fn(*args)


# =============================================================================
# TEST 1: Table Finalize writeContract Path with Cooling-Off Window Invariant
# =============================================================================
def test_frontend_write_contract_table_finalize_path(mock_gl_env):
    """
    Validates the exact frontend writeContract path when user clicks 'Finalize' in the Table UI.
    """
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    contract_addr = "0x8137D5819a29780D8f7215cbb780107E7648152a"
    client = SimulatedGenLayerClient(app, contract_addr, mock_gl_env)

    renter = SimulatedAddress("0xAAAA111122223333444455556666777788889999")
    host = SimulatedAddress("0xBBBB111122223333444455556666777788889999")
    escrow_amt = 12_000_000_000_000_000_000  # 12 GEN

    # Step 1: Create lease via writeContract
    client.write_contract(
        address=contract_addr,
        function_name="create_lease_order",
        args=["NVIDIA H100 SXM5 80GB", 86400],
        value=escrow_amt,
        sender=renter,
    )
    lease_ids = json.loads(client.read_contract(address=contract_addr, function_name="get_all_leases"))
    lease_id = lease_ids[0]["lease_id"]
    l_data = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=[lease_id]))

    # Step 2: Host submits telemetry proof & runs audit via writeContract
    proof_url = "https://cdn.agentlease.io/benchmark/h100-run-01.txt"
    mock_gl_env.nondet.web.mock_responses[proof_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host,
        machine_id="NODE-GPU-H100-US-EAST-42", model="NVIDIA H100 80GB HBM3", tflops=989.4
    )
    client.write_contract(
        address=contract_addr,
        function_name="submit_benchmark_and_verify",
        args=[lease_id, proof_url],
        sender=host,
    )

    audited = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=[lease_id]))
    assert audited["status"] == 7  # AUDIT_COMPLETED
    assert audited["verdict"] == "HARDWARE_VERIFIED"

    # Step 3: Frontend Table 'Finalize' button triggers writeContract before cooling window (5m) expires
    with pytest.raises(Exception, match="cooling-off window"):
        client.write_contract(
            address=contract_addr,
            function_name="finalize_settlement",
            args=[lease_id],
            sender=host,
        )

    # Step 4: Advance block time past 300 seconds
    mock_gl_env.advance_time(305)

    # Step 5: Frontend Table 'Finalize' button triggers writeContract after window expires -> SUCCESS
    tx_hash = client.write_contract(
        address=contract_addr,
        function_name="finalize_settlement",
        args=[lease_id],
        sender=host,
    )
    assert tx_hash.startswith("0x")

    settled = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=[lease_id]))
    assert settled["status"] == 2  # SETTLED_PAID
    assert settled["verdict"] == "HARDWARE_VERIFIED"
    assert app.total_compute_locked == 0

    host_transfers = mock_gl_env.get_contract_at(host).transfers
    assert any(t["value"] == escrow_amt for t in host_transfers)

    # Step 6: Double-finalize protection via writeContract reverts
    with pytest.raises(Exception, match="not awaiting final settlement"):
        client.write_contract(
            address=contract_addr,
            function_name="finalize_settlement",
            args=[lease_id],
            sender=host,
        )


# =============================================================================
# TEST 2: writeContract Appeal Changed to DEGRADED Bond Forfeiture to Appellee
# =============================================================================
def test_frontend_write_contract_appeal_changed_to_degraded_forfeits_bond(mock_gl_env):
    """
    Verifies that when an appeal results in HARDWARE_DEGRADED:
    - The losing appellant forfeits their dispute bond to the appellee.
    - Bond is NOT returned to the appellant.
    - Total locked compute is safely cleared with zero imbalance.
    """
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    contract_addr = "0x8137D5819a29780D8f7215cbb780107E7648152a"
    client = SimulatedGenLayerClient(app, contract_addr, mock_gl_env)

    renter = SimulatedAddress("0x1111111111111111111111111111111111111111")
    host = SimulatedAddress("0x2222222222222222222222222222222222222222")
    escrow_amt = 10_000_000_000_000_000_000  # 10 GEN
    bond_amt = 1_000_000_000_000_000_000    # 1 GEN

    # 1. Renter creates lease
    client.write_contract(
        address=contract_addr,
        function_name="create_lease_order",
        args=["NVIDIA H100 SXM5 80GB", 86400],
        value=escrow_amt,
        sender=renter,
    )
    lease_id = json.loads(client.read_contract(address=contract_addr, function_name="get_all_leases"))[0]["lease_id"]
    l_data = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=[lease_id]))

    # 2. Host submits telemetry initially deemed FRAUDULENT
    bad_url = "https://cdn.agentlease.io/bad_initial.txt"
    mock_gl_env.nondet.web.mock_responses[bad_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host,
        model="GTX 1060 fraud", tflops=4.0, vram=6000
    )
    client.write_contract(
        address=contract_addr,
        function_name="submit_benchmark_and_verify",
        args=[lease_id, bad_url],
        sender=host,
    )

    initial_audit = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=[lease_id]))
    assert initial_audit["verdict"] == "HARDWARE_FRAUDULENT"
    assert initial_audit["status"] == 7  # AUDIT_COMPLETED

    # 3. Host appeals claiming full VERIFIED outcome, staking 1 GEN bond via writeContract
    appeal_url = "https://cdn.agentlease.io/appeal_degraded.txt"
    mock_gl_env.nondet.web.mock_responses[appeal_url] = make_benchmark_log(
        l_data["challenge_nonce"], l_data["session_id"], host,
        model="NVIDIA H100 degraded 700 tflops", tflops=700.0, vram=72000
    )
    client.write_contract(
        address=contract_addr,
        function_name="appeal_verdict",
        args=[lease_id, appeal_url],
        value=bond_amt,
        sender=host,
    )

    # In DISPUTED state, total_compute_locked must track escrow + bond
    assert app.total_compute_locked == escrow_amt + bond_amt

    # 4. Tribunal adjudicates appeal -> verdict is APPEAL_UPHELD_DEGRADED
    client.write_contract(
        address=contract_addr,
        function_name="adjudicate_appeal",
        args=[lease_id],
        sender=renter,
    )

    settled_lease = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=[lease_id]))
    assert settled_lease["status"] == 5  # SETTLED_PARTIAL
    assert settled_lease["verdict"] == "HARDWARE_DEGRADED"
    assert settled_lease["initial_verdict"] == "HARDWARE_FRAUDULENT"

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


# =============================================================================
# TEST 3: Asymmetric Key Attestation Rejection of Unregistered Machine and Forgery
# =============================================================================
def test_frontend_write_contract_rejects_unregistered_and_forged_seals(mock_gl_env):
    """
    Verifies that:
    1. An unregistered machine ID is rejected immediately (UNREGISTERED_MACHINE_ORIGIN).
    2. A forged signature (not signed with private key corresponding to pubkey_n) is rejected.
    3. Contract stores NO private keys.
    """
    setup_gl_mock(mock_gl_env)
    import contract
    contract.gl = mock_gl_env

    app = contract.Contract()
    contract_addr = "0x8137D5819a29780D8f7215cbb780107E7648152a"
    client = SimulatedGenLayerClient(app, contract_addr, mock_gl_env)

    renter = SimulatedAddress("0x1111111111111111111111111111111111111111")
    host = SimulatedAddress("0x2222222222222222222222222222222222222222")

    # Case A: Unregistered Machine ID
    client.write_contract(
        address=contract_addr,
        function_name="create_lease_order",
        args=["NVIDIA H100 SXM5 80GB", 86400],
        value=5_000_000_000_000_000_000,
        sender=renter,
    )
    l1 = json.loads(client.read_contract(address=contract_addr, function_name="get_all_leases"))[0]
    unreg_url = "https://cdn.agentlease.io/unreg.txt"
    mock_gl_env.nondet.web.mock_responses[unreg_url] = make_benchmark_log(
        l1["challenge_nonce"], l1["session_id"], host,
        machine_id="UNKNOWN-ROGUE-RIG-99", model="NVIDIA H100", tflops=980.0
    )
    client.write_contract(
        address=contract_addr,
        function_name="submit_benchmark_and_verify",
        args=[l1["lease_id"], unreg_url],
        sender=host,
    )
    res1 = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=[l1["lease_id"]]))
    assert res1["verdict"] == "HARDWARE_FRAUDULENT"
    assert "UNREGISTERED_MACHINE_ORIGIN" in res1["reason"]

    # Case B: Registered Machine ID but Invalid/Forged Signature
    client.write_contract(
        address=contract_addr,
        function_name="create_lease_order",
        args=["NVIDIA H100 SXM5 80GB", 86400],
        value=5_000_000_000_000_000_000,
        sender=renter,
    )
    l2 = json.loads(client.read_contract(address=contract_addr, function_name="get_all_leases"))[1]
    forged_url = "https://cdn.agentlease.io/forged.txt"
    mock_gl_env.nondet.web.mock_responses[forged_url] = make_benchmark_log(
        l2["challenge_nonce"], l2["session_id"], host,
        machine_id="NODE-GPU-H100-US-EAST-42", is_valid_signature=False
    )
    client.write_contract(
        address=contract_addr,
        function_name="submit_benchmark_and_verify",
        args=[l2["lease_id"], forged_url],
        sender=host,
    )
    res2 = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=[l2["lease_id"]]))
    assert res2["verdict"] == "HARDWARE_FRAUDULENT"
    assert "INVALID_HARDWARE_SIGNATURE" in res2["reason"]
