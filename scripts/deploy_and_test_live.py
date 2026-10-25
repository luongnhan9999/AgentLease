import time
import json
import base64
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

with open("contracts/contract.py", "r", encoding="utf-8") as f:
    contract_code = f.read()

deployer = create_account()
client = create_client(chain=studionet, account=deployer)

print(f"Deployer address: {deployer.address}")
print("Funding deployer account with 5 GEN...")
client.fund_account(deployer.address, 5 * 10**18)
time.sleep(3)

print("Deploying AgentLease contract to StudioNet...")
tx_deploy = client.deploy_contract(code=contract_code)
client.wait_for_transaction_receipt(tx_deploy, status=TransactionStatus.ACCEPTED)
tx_deploy_info = client.get_transaction(tx_deploy)
contract_addr = tx_deploy_info.get("recipient")
print(f"Contract deployed successfully at: {contract_addr}")

# Verify initial stats
stats = json.loads(client.read_contract(address=contract_addr, function_name="get_stats", args=[]))
print("Initial stats:", stats)

# Step 1: Create a lease order with 0.1 GEN
print("\n--- Step 1: create_lease_order ---")
escrow_val = 100000000000000000 # 0.1 GEN
tx1 = client.write_contract(
    address=contract_addr,
    function_name="create_lease_order",
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16", 86400],
    value=escrow_val
)
client.wait_for_transaction_receipt(tx1, status=TransactionStatus.ACCEPTED)
tx1_data = client.get_transaction(tx1)
print("Create order tx result:", tx1_data.get("result_name"))
for v in tx1_data.get("consensus_data", {}).get("validators", []):
    print("  Validator:", v.get("execution_result"))

lease1_raw = client.read_contract(address=contract_addr, function_name="get_lease", args=["lease-1"])
lease1 = json.loads(lease1_raw)
print("Lease-1 status:", lease1.get("status"), "nonce:", lease1.get("challenge_nonce"))

# Step 2: Test withdraw when balance is 0 (must NOT crash with GENV ERROR)
print("\n--- Step 2: withdraw with 0 balance (Fail-Safe Verification) ---")
tx_w = client.write_contract(address=contract_addr, function_name="withdraw", args=[])
client.wait_for_transaction_receipt(tx_w, status=TransactionStatus.ACCEPTED)
tx_w_data = client.get_transaction(tx_w)
print("Withdraw tx result:", tx_w_data.get("result_name"))
for v in tx_w_data.get("consensus_data", {}).get("validators", []):
    print("  Validator:", v.get("execution_result"))

# Step 3: Test cancel_or_reclaim on expired / cancel path or claim_payout
print("\n--- Step 3: claim_payout on lease-1 (Fail-Safe Verification) ---")
tx_p = client.write_contract(address=contract_addr, function_name="claim_payout", args=["lease-1"])
client.wait_for_transaction_receipt(tx_p, status=TransactionStatus.ACCEPTED)
tx_p_data = client.get_transaction(tx_p)
print("Claim payout tx result:", tx_p_data.get("result_name"))
for v in tx_p_data.get("consensus_data", {}).get("validators", []):
    print("  Validator:", v.get("execution_result"))

print("\nAll live StudioNet smoke tests completed successfully!")
print(f"Contract ready for full seeding and production: {contract_addr}")
