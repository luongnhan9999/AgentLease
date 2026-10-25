import time
import json
import base64
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0x0adeDc5c3B1Fc59FBB8e5aB8d55aC71fCb75B464"
print(f"=== SEEDING ON-CHAIN TRANSACTIONS FOR USER CONTRACT {CONTRACT_ADDRESS} ===")

renter = create_account()
host = create_account()
print(f"Renter: {renter.address}")
print(f"Host:   {host.address}")

client = create_client(chain=studionet, account=renter)
client.fund_account(renter.address, 5 * 10**18)
client.fund_account(host.address, 5 * 10**18)
time.sleep(3)

# =========================================================================
# CASE 1: Lease-1 Creation, Claim, Proof, Adjudication
# =========================================================================
print("\n>>> [CASE 1] Creating Lease-1 (NVIDIA H100 80GB SXM5, 0.1 GEN Escrow)...")
tx1 = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16 SLA", 86400],
    value=100000000000000000 # 0.1 GEN
)
r1 = client.wait_for_transaction_receipt(tx1, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Create Lease-1 Status:", r1.get("status_name"))

print(">>> [CASE 1] Host claiming lease-1...")
tx1_claim = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="claim_lease",
    account=host,
    args=["lease-1"]
)
client.wait_for_transaction_receipt(tx1_claim, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)

print(">>> [CASE 1] Host submitting proof for lease-1...")
proof_url_1 = "https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt"
tx1_proof = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="submit_hardware_proof",
    account=host,
    args=["lease-1", proof_url_1]
)
client.wait_for_transaction_receipt(tx1_proof, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)

print(">>> [CASE 1] Running AI Consensus Adjudication for lease-1...")
tx1_adj = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    account=host,
    args=["lease-1"]
)
r1_adj = client.wait_for_transaction_receipt(tx1_adj, status=TransactionStatus.ACCEPTED, retries=60, interval=4000)
print("Adjudicate Lease-1 Status:", r1_adj.get("status_name"))

# =========================================================================
# CASE 2: Lease-2 Creation, Claim, Proof, Adjudication
# =========================================================================
print("\n>>> [CASE 2] Creating Lease-2 (NVIDIA A100 80GB PCIe, 0.15 GEN Escrow)...")
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

print(">>> [CASE 2] Running AI Consensus Adjudication for lease-2...")
tx2_adj = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    account=renter,
    args=["lease-2"]
)
r2_adj = client.wait_for_transaction_receipt(tx2_adj, status=TransactionStatus.ACCEPTED, retries=60, interval=4000)
print("Adjudicate Lease-2 Status:", r2_adj.get("status_name"))

# =========================================================================
# CASE 3: Lease-3 Open for Evaluator
# =========================================================================
print("\n>>> [CASE 3] Creating Open Lease-3 (0.2 GEN Escrow) for live evaluator testing...")
tx3 = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    account=renter,
    args=["NVIDIA H100 80GB SXM5, Distributed LLM Inference High Throughput SLA", 86400],
    value=200000000000000000 # 0.2 GEN
)
client.wait_for_transaction_receipt(tx3, status=TransactionStatus.ACCEPTED, retries=40, interval=3000)
print("Lease-3 Open order created successfully!")

# Test fail-safe withdraw
print("\n>>> Testing fail-safe withdraw (0 balance)...")
tx_w = client.write_contract(address=CONTRACT_ADDRESS, function_name="withdraw", account=renter, args=[])
client.wait_for_transaction_receipt(tx_w, status=TransactionStatus.ACCEPTED)
print("Withdraw test passed with 0 errors!")

stats = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_stats", args=[]))
print("\n=== CURRENT CONTRACT STATS ===")
print(json.dumps(stats, indent=2))
