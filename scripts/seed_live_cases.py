import time
import json
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0xAc22D02B0dCb1392762e602ca3515F52E0855977"

print(f"=== SEEDING ON-CHAIN TRANSACTIONS FOR CONTRACT {CONTRACT_ADDRESS} ===")

# Create distinct Renter & Host test accounts
renter = create_account()
host = create_account()
print(f"Renter: {renter.address}")
print(f"Host:   {host.address}")

client = create_client(chain=studionet, account=renter)

print("\n--- Funding Renter & Host accounts ---")
client.fund_account(renter.address, 5 * 10**18) # 5 GEN
client.fund_account(host.address, 5 * 10**18)   # 5 GEN
time.sleep(3)

# =========================================================================
# CASE 1: Standard Verified Compute Lease
# =========================================================================
print("\n>>> [CASE 1] Creating Lease 1 (NVIDIA H100 80GB SXM5)...")
tx1 = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16 benchmark SLA", 86400],
    value=100000000000000000 # 0.1 GEN
)
print("Create Tx:", tx1)
r1 = client.wait_for_transaction_receipt(tx1, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Create Receipt Status:", r1.get("status_name", r1.get("status")))

# Read lease-1 nonce and session
lease1_raw = client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"])
lease1 = json.loads(lease1_raw)
print(f"Lease 1 Created: ID={lease1['lease_id']}, Nonce={lease1['challenge_nonce']}, Session={lease1['session_id']}")

print("\n>>> [CASE 1] Host claiming lease-1...")
tx1_claim = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="claim_lease",
    account=host,
    args=["lease-1"]
)
r1_claim = client.wait_for_transaction_receipt(tx1_claim, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Claim Receipt Status:", r1_claim.get("status_name", r1_claim.get("status")))

print("\n>>> [CASE 1] Host submitting benchmark telemetry proof for lease-1...")
proof_url_1 = "https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt"
tx1_proof = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    account=host,
    args=["lease-1", proof_url_1]
)
r1_proof = client.wait_for_transaction_receipt(tx1_proof, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Proof Receipt Status:", r1_proof.get("status_name", r1_proof.get("status")))

print("\n>>> [CASE 1] Running AI Consensus Adjudication for lease-1...")
tx1_adj = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    account=host,
    args=["lease-1"]
)
r1_adj = client.wait_for_transaction_receipt(tx1_adj, status=TransactionStatus.ACCEPTED, retries=60, interval=4000)
print("Adjudicate Receipt Status:", r1_adj.get("status_name", r1_adj.get("status")))

lease1_post = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
print(f"Lease 1 Post-Audit: Status={lease1_post['status']}, Verdict={lease1_post['verdict']}, Reason={lease1_post['reason'][:80]}")

# =========================================================================
# CASE 2: Fraudulent / Mismatched Telemetry Lease
# =========================================================================
print("\n>>> [CASE 2] Creating Lease 2 (Enterprise GPU Cluster SLA)...")
tx2 = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA A100 80GB PCIe, min 80GB VRAM, >300 TFLOPS FP16 SLA", 86400],
    value=150000000000000000 # 0.15 GEN
)
r2 = client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Lease 2 Created:", r2.get("status_name", r2.get("status")))

print("\n>>> [CASE 2] Host claims and submits telemetry for lease-2...")
client.write_contract(address=CONTRACT_ADDRESS, function_name="claim_lease", account=host, args=["lease-2"])
time.sleep(2)
tx2_proof = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    account=host,
    args=["lease-2", "https://raw.githubusercontent.com/yeou/public-logs/main/fake_gpu_log.txt"]
)
client.wait_for_transaction_receipt(tx2_proof, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)

print("\n>>> [CASE 2] Running Adjudication for lease-2...")
tx2_adj = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    account=renter,
    args=["lease-2"]
)
r2_adj = client.wait_for_transaction_receipt(tx2_adj, status=TransactionStatus.ACCEPTED, retries=60, interval=4000)
print("Adjudicate 2 Receipt Status:", r2_adj.get("status_name", r2_adj.get("status")))

lease2_post = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-2"]))
print(f"Lease 2 Post-Audit: Status={lease2_post['status']}, Verdict={lease2_post['verdict']}")

# =========================================================================
# CASE 3: Active Open Lease Ready for Evaluator / Steward Interactive Testing
# =========================================================================
print("\n>>> [CASE 3] Creating Open Lease 3 for live user testing on frontend...")
tx3 = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, High Throughput Distributed Training SLA", 86400],
    value=200000000000000000 # 0.2 GEN
)
r3 = client.wait_for_transaction_receipt(tx3, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Lease 3 Created (Status OPEN):", r3.get("status_name", r3.get("status")))

# =========================================================================
# Summary
# =========================================================================
stats = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_stats", args=[]))
print("\n=== FINAL CONTRACT ON-CHAIN SUMMARY ===")
print(f"Total Leases: {stats['total_leases']}")
print(f"Total Compute Locked: {stats['total_compute_locked']} wei")
print(f"Total Leases Settled: {stats['total_leases_settled']}")
print("All cases seeded successfully!")
