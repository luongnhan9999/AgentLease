import sys
import time
import json
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0x98C8d3F0C9841eF9AfED734C1264b0aDC9FBE264"

def main():
    print(f"Connecting to GenLayer StudioNet with contract: {CONTRACT_ADDRESS}")
    
    # Generate Renter & Host accounts
    renter = create_account()
    host = create_account()
    print(f"Renter Address: {renter.address}")
    print(f"Host Address:   {host.address}")

    client = create_client(chain=studionet, account=renter)

    # Fund accounts
    print("\n--- Funding Test Accounts via Studio Faucet ---")
    client.fund_account(renter.address, 2 * 10**18)
    client.fund_account(host.address, 2 * 10**18)
    time.sleep(3)

    # Check current leases
    leases_raw = client.read_contract(address=CONTRACT_ADDRESS, function_name="get_leases_paginated", args=[0, 10])
    leases = json.loads(leases_raw) if isinstance(leases_raw, str) else leases_raw
    print(f"Current leases on contract: {len(leases)}")
    
    lease1_id = "lease-1"
    
    # -------------------------------------------------------------
    # STEP 2: Host claims lease-1 and submits benchmark proof
    # -------------------------------------------------------------
    print(f"\n=======================================================")
    print(f">>> STEP 2: Host Submitting Hardware Proof for {lease1_id}")
    print(f"=======================================================")
    valid_log_url = "https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt"
    tx_proof = client.write_contract(
        address=CONTRACT_ADDRESS,
        function_name="submit_hardware_proof",
        account=host,
        args=[lease1_id, valid_log_url]
    )
    print(f"Submit Proof Tx Hash: {tx_proof}")
    receipt_proof = client.wait_for_transaction_receipt(tx_proof, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
    print("Submit Proof Receipt:", receipt_proof.get("status") if isinstance(receipt_proof, dict) else getattr(receipt_proof, "status", "OK"))

    time.sleep(2)

    # -------------------------------------------------------------
    # STEP 3: Trigger AI Jury Adjudication on lease-1
    # -------------------------------------------------------------
    print(f"\n=======================================================")
    print(f">>> STEP 3: AI Jury Adjudication on StudioNet for {lease1_id}")
    print(f"=======================================================")
    tx_adj = client.write_contract(
        address=CONTRACT_ADDRESS,
        function_name="adjudicate_hardware",
        account=host,
        args=[lease1_id]
    )
    print(f"Adjudicate Hardware Tx Hash: {tx_adj}")
    print("AI Jury is fetching benchmark log via web render and reaching consensus...")
    receipt_adj = client.wait_for_transaction_receipt(tx_adj, status=TransactionStatus.ACCEPTED, retries=40, interval=4000)
    print("Adjudicate Hardware Receipt:", receipt_adj.get("status") if isinstance(receipt_adj, dict) else getattr(receipt_adj, "status", "OK"))

    time.sleep(2)

    # Read Task 1 post-adjudication state
    lease1_state = client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=[lease1_id])
    print(f"\n>>> TASK 1 ({lease1_id}) ADJUDICATED STATE:")
    print(lease1_state)

    # -------------------------------------------------------------
    # STEP 4: Create Task 2 (Open Lease Order for User Testing)
    # -------------------------------------------------------------
    print(f"\n=======================================================")
    print(f">>> STEP 4: Creating Task 2 (Open Lease Order for User Testing)")
    print(f"=======================================================")
    spec_task2 = "NVIDIA A100 80GB SXM4, 19.5 TFLOPS FP32, High Throughput Distributed Training SLA, 80GB HBM2e"
    escrow_wei = 100000000000000000  # 0.1 GEN
    tx2 = client.write_contract(
        address=CONTRACT_ADDRESS,
        function_name="create_lease_order",
        account=renter,
        args=[spec_task2, 1000],
        value=escrow_wei
    )
    print(f"Create Lease 2 Tx Hash: {tx2}")
    receipt2 = client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
    print("Create Lease 2 Receipt:", receipt2.get("status") if isinstance(receipt2, dict) else getattr(receipt2, "status", "OK"))

    time.sleep(2)

    # -------------------------------------------------------------
    # Final Contract State
    # -------------------------------------------------------------
    print(f"\n=======================================================")
    print(f">>> FINAL CONTRACT ON-CHAIN SUMMARY")
    print(f"=======================================================")
    final_stats = client.read_contract(address=CONTRACT_ADDRESS, function_name="get_stats", args=[])
    final_leases = client.read_contract(address=CONTRACT_ADDRESS, function_name="get_leases_paginated", args=[0, 10])
    print(f"Stats: {final_stats}")
    print(f"Orders: {final_leases}")

if __name__ == "__main__":
    main()
