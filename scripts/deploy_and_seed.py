import time
import json
from pathlib import Path
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0x49f63B606c0a0c3Be9Eb6B541E2d48df5a0D89c9"
print(f"=== SEEDING ON-CHAIN TRANSACTIONS FOR CONTRACT {CONTRACT_ADDRESS} ===")

# Create distinct Renter & Host test accounts
renter = create_account()
host = create_account()
print(f"Renter: {renter.address}")
print(f"Host:   {host.address}")

client_renter = create_client(chain=studionet, account=renter)
client_host = create_client(chain=studionet, account=host)

print("\n--- Funding Renter & Host accounts ---")
client_renter.fund_account(renter.address, 5 * 10**18) # 5 GEN
client_host.fund_account(host.address, 5 * 10**18)   # 5 GEN
time.sleep(3)

# =========================================================================
# CASE 1: Standard Verified Compute Lease
# =========================================================================
print("\n>>> [CASE 1] Creating Lease 1 (NVIDIA H100 80GB SXM5)...")
tx1 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16 benchmark SLA", 86400],
    value=100000000000000000 # 0.1 GEN
)
print("Create Tx:", tx1)
r1 = client_renter.wait_for_transaction_receipt(tx1, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Create Receipt Status:", r1.get("status_name", r1.get("status")))

# Read lease-1
lease1_raw = client_renter.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"])
lease1 = json.loads(lease1_raw)
print(f"Lease 1 Created: ID={lease1['lease_id']}, Nonce={lease1['challenge_nonce']}, Session={lease1['session_id']}")

print("\n>>> [CASE 1] Host claiming lease-1...")
tx1_claim = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="claim_lease",
    account=host,
    args=["lease-1"]
)
r1_claim = client_host.wait_for_transaction_receipt(tx1_claim, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Claim Receipt Status:", r1_claim.get("status_name", r1_claim.get("status")))

print("\n>>> [CASE 1] Host submitting benchmark telemetry proof for lease-1...")
proof_url_1 = "https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt"
tx1_proof = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    account=host,
    args=["lease-1", proof_url_1]
)
r1_proof = client_host.wait_for_transaction_receipt(tx1_proof, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Proof Receipt Status:", r1_proof.get("status_name", r1_proof.get("status")))

print("\n>>> [CASE 1] Running AI Consensus Adjudication for lease-1...")
tx1_adj = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    account=host,
    args=["lease-1"]
)
r1_adj = client_host.wait_for_transaction_receipt(tx1_adj, status=TransactionStatus.ACCEPTED, retries=60, interval=4000)
print("Adjudicate Receipt Status:", r1_adj.get("status_name", r1_adj.get("status")))

lease1_post = json.loads(client_renter.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
print(f"Lease 1 Post-Audit: Status={lease1_post['status']}, Verdict={lease1_post['verdict']}, Reason={lease1_post['reason'][:80]}")

# =========================================================================
# CASE 2: Second Lease
# =========================================================================
print("\n>>> [CASE 2] Creating Lease 2 (Enterprise GPU Cluster SLA)...")
tx2 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["Enterprise High-Performance AI Cluster SLA (NVIDIA A100)", 86400],
    value=100000000000000000 # 0.1 GEN
)
print("Create Tx 2:", tx2)
r2 = client_renter.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Create 2 Receipt Status:", r2.get("status_name", r2.get("status")))

print("\n>>> [CASE 2] Host claiming lease-2...")
tx2_claim = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="claim_lease",
    account=host,
    args=["lease-2"]
)
r2_claim = client_host.wait_for_transaction_receipt(tx2_claim, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Claim 2 Receipt Status:", r2_claim.get("status_name", r2_claim.get("status")))

print("\n>>> [CASE 2] Host submitting benchmark telemetry proof for lease-2...")
proof_url_2 = "https://raw.githubusercontent.com/yeou/public-logs/main/telemetry_unregistered.txt"
tx2_proof = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    account=host,
    args=["lease-2", proof_url_2]
)
r2_proof = client_host.wait_for_transaction_receipt(tx2_proof, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Proof 2 Receipt Status:", r2_proof.get("status_name", r2_proof.get("status")))

print("\n>>> [CASE 2] Running AI Consensus Adjudication for lease-2...")
tx2_adj = client_host.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    account=host,
    args=["lease-2"]
)
r2_adj = client_host.wait_for_transaction_receipt(tx2_adj, status=TransactionStatus.ACCEPTED, retries=60, interval=4000)
print("Adjudicate 2 Receipt Status:", r2_adj.get("status_name", r2_adj.get("status")))

lease2_post = json.loads(client_renter.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-2"]))
print(f"Lease 2 Post-Audit: Status={lease2_post['status']}, Verdict={lease2_post['verdict']}, Reason={lease2_post['reason'][:80]}")

# =========================================================================
# CASE 3: Open Lease for Evaluator Testing
# =========================================================================
print("\n>>> [CASE 3] Creating Lease 3 (Active OPEN for Evaluators)...")
tx3 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16 (Awaiting Host Claim)", 86400],
    value=200000000000000000 # 0.2 GEN
)
r3 = client_renter.wait_for_transaction_receipt(tx3, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Create 3 Receipt Status:", r3.get("status_name", r3.get("status")))

# Update frontend config files
config_file = Path(__file__).resolve().parent.parent / "frontend" / "src" / "config" / "genlayer.ts"
config_content = config_file.read_text(encoding="utf-8")
import re
new_config = re.sub(r"DEFAULT_CONTRACT_ADDRESS = '[^']+'", f"DEFAULT_CONTRACT_ADDRESS = '{CONTRACT_ADDRESS}'", config_content)
config_file.write_text(new_config, encoding="utf-8")

env_file = Path(__file__).resolve().parent.parent / "frontend" / ".env"
env_file.write_text(f"VITE_AGENTLEASE_CONTRACT_ADDRESS={CONTRACT_ADDRESS}\n", encoding="utf-8")

print(f"\nSuccessfully seeded on-chain transactions on: {CONTRACT_ADDRESS}")
