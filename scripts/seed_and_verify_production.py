import time
import json
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0xb8A7BF70d1B45A62612350E52a2A0879AC88330C"
print(f"=== SEEDING MULTIPLE REAL CASES ON CONTRACT {CONTRACT_ADDRESS} ===")

renter = create_account()
host = create_account()
print(f"Renter: {renter.address}")
print(f"Host:   {host.address}")

client = create_client(chain=studionet, account=renter)
client.fund_account(renter.address, 5 * 10**18)
client.fund_account(host.address, 5 * 10**18)
time.sleep(3)

# =========================================================================
# CASE 1: Lease-1 claim, proof submission, adjudication, settlement
# =========================================================================
print("\n>>> [CASE 1] Host claiming lease-1...")
tx1_claim = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="claim_lease",
    account=host,
    args=["lease-1"]
)
r1_claim = client.wait_for_transaction_receipt(tx1_claim, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Claim Status:", r1_claim.get("status_name", r1_claim.get("status")))

print(">>> [CASE 1] Host submitting proof for lease-1...")
proof_url_1 = "https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt"
tx1_proof = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    account=host,
    args=["lease-1", proof_url_1]
)
r1_proof = client.wait_for_transaction_receipt(tx1_proof, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Proof Status:", r1_proof.get("status_name", r1_proof.get("status")))

print(">>> [CASE 1] Running AI Consensus Adjudication for lease-1...")
tx1_adj = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    account=host,
    args=["lease-1"]
)
r1_adj = client.wait_for_transaction_receipt(tx1_adj, status=TransactionStatus.ACCEPTED, retries=60, interval=4000)
print("Adjudicate Status:", r1_adj.get("status_name", r1_adj.get("status")))

l1 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
print(f"Lease-1: status={l1.get('status')}, verdict={l1.get('verdict')}")

# =========================================================================
# CASE 2: Create Lease-2, Fraudulent Hardware Adjudication
# =========================================================================
print("\n>>> [CASE 2] Creating Lease-2 (Fraudulent Hardware)...")
tx2 = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA A100 80GB PCIe, min 80GB VRAM, >300 TFLOPS FP16 SLA", 86400],
    value=150000000000000000 # 0.15 GEN
)
client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)

tx2_claim = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="claim_lease",
    account=host,
    args=["lease-2"]
)
client.wait_for_transaction_receipt(tx2_claim, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)

tx2_proof = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    account=host,
    args=["lease-2", "https://raw.githubusercontent.com/yeou/public-logs/main/fake_gpu_log.txt"]
)
client.wait_for_transaction_receipt(tx2_proof, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)

print(">>> [CASE 2] Running Adjudication for lease-2...")
tx2_adj = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    account=renter,
    args=["lease-2"]
)
r2_adj = client.wait_for_transaction_receipt(tx2_adj, status=TransactionStatus.ACCEPTED, retries=60, interval=4000)
print("Adjudicate 2 Status:", r2_adj.get("status_name", r2_adj.get("status")))

l2 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-2"]))
print(f"Lease-2: status={l2.get('status')}, verdict={l2.get('verdict')}")

# =========================================================================
# CASE 3: Create Lease-3, active open lease
# =========================================================================
print("\n>>> [CASE 3] Creating Open Lease-3 ready for live judge testing...")
tx3 = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, Distributed LLM Inference SLA", 86400],
    value=200000000000000000 # 0.2 GEN
)
client.wait_for_transaction_receipt(tx3, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)

stats = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_stats", args=[]))
print("\n=== CURRENT CONTRACT STATS ===")
print(json.dumps(stats, indent=2))
