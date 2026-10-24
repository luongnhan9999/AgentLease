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

print("\n--- Funding accounts ---")
client.fund_account(deployer.address, 3 * 10**18)
client.fund_account(renter.address, 3 * 10**18)
client.fund_account(host.address, 3 * 10**18)
time.sleep(2)

print("\n--- Deploying patched contract to StudioNet ---")
tx_deploy = client.deploy_contract(code=contract_code)
client.wait_for_transaction_receipt(tx_deploy, status=TransactionStatus.ACCEPTED)
tx_dep_data = client.get_transaction(tx_deploy)
contract_addr = tx_dep_data.get("recipient") or tx_dep_data.get("to_address")
print(f"Contract deployed at: {contract_addr}")

# Test 1: Create lease order
print("\n>>> [Test 1] Renter creates lease order (0.1 GEN)...")
tx_order = client_renter.write_contract(
    address=contract_addr,
    function_name="create_lease_order",
    args=["NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16 SLA", 300], # 5 min dur
    value=100000000000000000
)
client_renter.wait_for_transaction_receipt(tx_order, status=TransactionStatus.ACCEPTED)
print("Order created successfully!")

# Read lease-1
l1_raw = client.read_contract(address=contract_addr, function_name="get_lease", args=["lease-1"])
l1 = json.loads(l1_raw)
print(f"Lease 1: ID={l1['lease_id']}, status={l1['status']}, escrow={l1['escrow_amount']}")

# Test 2: Host claims lease
print("\n>>> [Test 2] Host claims lease...")
tx_claim = client_host.write_contract(
    address=contract_addr,
    function_name="claim_lease",
    args=["lease-1"]
)
client_host.wait_for_transaction_receipt(tx_claim, status=TransactionStatus.ACCEPTED)
print("Lease claimed!")

# Test 3: Check pending balances initially
b_renter_pending = client.read_contract(address=contract_addr, function_name="get_pending_balance", args=[renter.address])
b_host_pending = client.read_contract(address=contract_addr, function_name="get_pending_balance", args=[host.address])
print(f"Initial Pending Balances: Renter={b_renter_pending}, Host={b_host_pending}")

# Test 4: Host submits hardware proof & runs audit
print("\n>>> [Test 4] Host submits proof...")
tx_proof = client_host.write_contract(
    address=contract_addr,
    function_name="submit_hardware_proof",
    args=["lease-1", "https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt"]
)
client_host.wait_for_transaction_receipt(tx_proof, status=TransactionStatus.ACCEPTED)

print("Running adjudicate_hardware...")
tx_adj = client.write_contract(
    address=contract_addr,
    function_name="adjudicate_hardware",
    args=["lease-1"]
)
client.wait_for_transaction_receipt(tx_adj, status=TransactionStatus.ACCEPTED)

l1_after = json.loads(client.read_contract(address=contract_addr, function_name="get_lease", args=["lease-1"]))
print(f"Audit Complete: status={l1_after['status']}, verdict={l1_after['verdict']}, score={l1_after['performance_score']}")

print("\n--- TEST COMPLETED SUCCESSFULLY! ---")
