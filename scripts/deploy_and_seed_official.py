import time
import json
from pathlib import Path
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

with open("contracts/contract.py", "r", encoding="utf-8") as f:
    contract_code = f.read()

deployer = create_account()
renter = create_account()
host = create_account()

print(f"Deployer: {deployer.address}")
print(f"Renter:   {renter.address}")
print(f"Host:     {host.address}")

client = create_client(chain=studionet, account=deployer)
client_renter = create_client(chain=studionet, account=renter)
client_host = create_client(chain=studionet, account=host)

print("\n--- Funding accounts on StudioNet ---")
client.fund_account(deployer.address, 5 * 10**18)
client.fund_account(renter.address, 5 * 10**18)
client.fund_account(host.address, 5 * 10**18)
time.sleep(3)

print("\n=== DEPLOYING OFFICIAL AGENTLEASE CONTRACT ===")
tx_deploy = client.deploy_contract(code=contract_code)
client.wait_for_transaction_receipt(tx_deploy, status=TransactionStatus.ACCEPTED)
tx_dep_data = client.get_transaction(tx_deploy)
CONTRACT_ADDRESS = tx_dep_data.get("recipient") or tx_dep_data.get("to_address")
print(f"\n=======================================================")
print(f"OFFICIAL CONTRACT DEPLOYED AT: {CONTRACT_ADDRESS}")
print(f"=======================================================\n")

# =========================================================================
# CASE 1: Lease 1 - Verified Audit Pipeline -> Settled
# =========================================================================
print("\n>>> [CASE 1] Creating Lease 1 (NVIDIA H100 80GB SXM5)...")
tx1 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16 benchmark SLA", 86400],
    value=100000000000000000 # 0.1 GEN
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

tx1_adj = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    args=["lease-1"]
)
client.wait_for_transaction_receipt(tx1_adj, status=TransactionStatus.ACCEPTED)
l1 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
print(f"Lease 1 Audited: status={l1['status']} (AUDIT_COMPLETED), verdict={l1['verdict']}")

# =========================================================================
# CASE 2: Lease 2 - High Performance Cluster SLA -> Audited
# =========================================================================
print("\n>>> [CASE 2] Creating Lease 2 (NVIDIA A100 80GB PCIe)...")
tx2 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    args=["NVIDIA A100 80GB PCIe, min 80GB VRAM, >300 TFLOPS FP16 SLA", 86400],
    value=100000000000000000 # 0.1 GEN
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

tx2_adj = client.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="adjudicate_hardware",
    args=["lease-2"]
)
client.wait_for_transaction_receipt(tx2_adj, status=TransactionStatus.ACCEPTED)
l2 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-2"]))
print(f"Lease 2 Audited: status={l2['status']} (AUDIT_COMPLETED), verdict={l2['verdict']}")

# =========================================================================
# CASE 3: Lease 3 - Unclaimed Order -> Cancelled & Escrow Withdrawn
# =========================================================================
print("\n>>> [CASE 3] Creating Lease 3 for instant cancel/reclaim test...")
tx3 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    args=["NVIDIA RTX 4090 24GB, min 24GB VRAM, ephemeral batch inference", 3600],
    value=100000000000000000 # 0.1 GEN
)
client_renter.wait_for_transaction_receipt(tx3, status=TransactionStatus.ACCEPTED)

print(">>> [CASE 3] Renter cancelling unclaimed order lease-3...")
tx3_cancel = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="cancel_or_reclaim_lease",
    args=["lease-3"]
)
client_renter.wait_for_transaction_receipt(tx3_cancel, status=TransactionStatus.ACCEPTED)
print("Lease 3 cancelled! Reclaim credited to pending withdrawals.")

tx3_with = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="withdraw"
)
client_renter.wait_for_transaction_receipt(tx3_with, status=TransactionStatus.ACCEPTED)
print("Lease 3 Escrow successfully withdrawn by renter!")

# =========================================================================
# CASE 4: Lease 4 - Active OPEN order awaiting evaluator claim
# =========================================================================
print("\n>>> [CASE 4] Creating active OPEN order lease-4 for Judge/Evaluator...")
tx4 = client_renter.write_contract(
    address=CONTRACT_ADDRESS,
    function_name="create_lease_order",
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, enterprise cluster for judge evaluation", 86400],
    value=200000000000000000 # 0.2 GEN
)
client_renter.wait_for_transaction_receipt(tx4, status=TransactionStatus.ACCEPTED)
print("Lease 4 created and OPEN for evaluator interaction!")

stats = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_stats"))
print(f"\nContract Final Stats: {json.dumps(stats, indent=2)}")

# Save contract address to file
with open("contracts/deployed_contract.txt", "w", encoding="utf-8") as f:
    f.write(CONTRACT_ADDRESS)

print(f"\nContract address written to contracts/deployed_contract.txt: {CONTRACT_ADDRESS}")
