import time
import json
import base64
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0x5C39a2b91a81317c9024735f034B778d19aebeE5"
print(f"=== SEEDING CONTRACT {CONTRACT_ADDRESS} ===")

renter = create_account()
host = create_account()
client_renter = create_client(chain=studionet, account=renter)
client_host = create_client(chain=studionet, account=host)

print(f"Renter: {renter.address}")
print(f"Host:   {host.address}")

print("\n--- Funding accounts on StudioNet ---")
client_renter.fund_account(renter.address, 5 * 10**18)
client_host.fund_account(host.address, 5 * 10**18)
time.sleep(3)

# -------------------------------------------------------------
# Case 1: Lease 1 (NVIDIA H100 80GB SXM5) -> Claim -> Submit Proof -> Audit
# -------------------------------------------------------------
print("\n>>> [CASE 1] Creating Lease 1 (0.1 GEN)...")
tx1 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16 benchmark SLA", 86400],
    value=100000000000000000
)
client_renter.wait_for_transaction_receipt(tx1, status=TransactionStatus.ACCEPTED)
print("Lease 1 created.")

print(">>> [CASE 1] Host claiming Lease 1...")
tx1_claim = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="claim_lease",
    args=["lease-1"]
)
client_host.wait_for_transaction_receipt(tx1_claim, status=TransactionStatus.ACCEPTED)
print("Lease 1 claimed by host.")

print(">>> [CASE 1] Host submitting benchmark proof & adjudicating...")
tx1_proof = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    args=["lease-1", "https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt"]
)
client_host.wait_for_transaction_receipt(tx1_proof, status=TransactionStatus.ACCEPTED)

tx1_adj = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    args=["lease-1"]
)
client_host.wait_for_transaction_receipt(tx1_adj, status=TransactionStatus.ACCEPTED)
l1 = json.loads(client_renter.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
print(f"Lease 1 Audited: status={l1['status']} (AUDIT_COMPLETED), verdict={l1['verdict']}")

# -------------------------------------------------------------
# Case 2: Lease 2 (NVIDIA A100 80GB PCIe) -> Claim -> Submit Proof -> Audit
# -------------------------------------------------------------
print("\n>>> [CASE 2] Creating Lease 2 (0.1 GEN)...")
tx2 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    args=["NVIDIA A100 80GB PCIe, min 80GB VRAM, >300 TFLOPS FP16 SLA", 86400],
    value=100000000000000000
)
client_renter.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED)

tx2_claim = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="claim_lease",
    args=["lease-2"]
)
client_host.wait_for_transaction_receipt(tx2_claim, status=TransactionStatus.ACCEPTED)

tx2_proof = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    args=["lease-2", "https://raw.githubusercontent.com/yeou/public-logs/main/a100_valid_benchmark.txt"]
)
client_host.wait_for_transaction_receipt(tx2_proof, status=TransactionStatus.ACCEPTED)

tx2_adj = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    args=["lease-2"]
)
client_host.wait_for_transaction_receipt(tx2_adj, status=TransactionStatus.ACCEPTED)
l2 = json.loads(client_renter.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-2"]))
print(f"Lease 2 Audited: status={l2['status']} (AUDIT_COMPLETED), verdict={l2['verdict']}")

# -------------------------------------------------------------
# Case 3: Lease 3 -> Cancel Unclaimed & Withdraw Escrow
# -------------------------------------------------------------
print("\n>>> [CASE 3] Creating Lease 3 for cancel & pull-payment withdraw test...")
tx3 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    args=["NVIDIA RTX 4090 24GB, min 24GB VRAM, ephemeral batch inference", 3600],
    value=100000000000000000
)
client_renter.wait_for_transaction_receipt(tx3, status=TransactionStatus.ACCEPTED)

print(">>> [CASE 3] Renter cancelling unclaimed order lease-3...")
tx3_cancel = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="cancel_or_reclaim_lease",
    args=["lease-3"]
)
client_renter.wait_for_transaction_receipt(tx3_cancel, status=TransactionStatus.ACCEPTED)

tx3_with = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="withdraw"
)
client_renter.wait_for_transaction_receipt(tx3_with, status=TransactionStatus.ACCEPTED)
print("Lease 3 Escrow successfully reclaimed & withdrawn by renter!")

# -------------------------------------------------------------
# Case 4: Lease 4 -> Active OPEN order for Judge
# -------------------------------------------------------------
print("\n>>> [CASE 4] Creating active OPEN order lease-4 for Judge/Evaluator...")
tx4 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, enterprise cluster for judge evaluation", 86400],
    value=200000000000000000 # 0.2 GEN
)
client_renter.wait_for_transaction_receipt(tx4, status=TransactionStatus.ACCEPTED)
print("Lease 4 created and OPEN for evaluator!")

# -------------------------------------------------------------
# Wait cooling-off and finalize lease-1 and lease-2
# -------------------------------------------------------------
print("\n>>> Waiting cooling-off window (5 min) to finalize lease-1 & lease-2...")
for lease_id in ["lease-1", "lease-2"]:
    while True:
        tx_fin = client_renter.write_contract(
            address=CONTRACT_ADDRESS,
            function_name="finalize_settlement",
            args=[lease_id]
        )
        client_renter.wait_for_transaction_receipt(tx_fin, status=TransactionStatus.ACCEPTED)
        tx_data = client_renter.get_transaction(tx_fin)
        is_success = False
        val_err = ""
        for v in tx_data.get("consensus_data", {}).get("validators", []):
            if v.get("execution_result") == "SUCCESS":
                is_success = True
            elif v.get("result"):
                raw = base64.b64decode(v["result"])
                val_err = str(raw)
        
        if is_success:
            print(f"SUCCESS: {lease_id} finalized on-chain!")
            break
        else:
            print(f"Waiting cooling-off: {val_err[:80]}")
            time.sleep(25)

stats = json.loads(client_renter.read_contract(address=CONTRACT_ADDRESS, function_name="get_stats"))
print(f"\nContract Final Stats: {json.dumps(stats, indent=2)}")
print("=== SEEDING COMPLETED SUCCESSFULLY! ===")
