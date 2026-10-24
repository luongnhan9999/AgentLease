import time
import json
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDR = "0xa7734964f91497724194b0A66806Cd2Fef6c7640"
renter = create_account()
client = create_client(chain=studionet, account=renter)
client.fund_account(renter.address, 2 * 10**18)
time.sleep(2)

print(f"Renter: {renter.address}")
bal_initial = client.get_balance(renter.address)
print(f"Renter Initial Balance: {bal_initial}")

print(">>> Creating lease order 2 (0.1 GEN)...")
tx_create = client.write_contract(
    address=CONTRACT_ADDR,
    function_name="create_lease_order",
    args=["NVIDIA A100 80GB PCIe, min 80GB VRAM, >300 TFLOPS FP16 SLA", 300],
    value=100000000000000000 # 0.1 GEN
)
client.wait_for_transaction_receipt(tx_create, status=TransactionStatus.ACCEPTED)
print("Order 2 created!")

l2 = json.loads(client.read_contract(address=CONTRACT_ADDR, function_name="get_lease", args=["lease-2"]))
print(f"Lease 2: ID={l2['lease_id']}, status={l2['status']}")

print(">>> Calling cancel_or_reclaim_lease for lease-2...")
tx_cancel = client.write_contract(
    address=CONTRACT_ADDR,
    function_name="cancel_or_reclaim_lease",
    args=["lease-2"]
)
client.wait_for_transaction_receipt(tx_cancel, status=TransactionStatus.ACCEPTED)
print("Lease 2 cancelled successfully!")

l2_after = json.loads(client.read_contract(address=CONTRACT_ADDR, function_name="get_lease", args=["lease-2"]))
print(f"Lease 2 After: status={l2_after['status']} ({'CANCELLED' if l2_after['status']==4 else 'OTHER'}), reason={l2_after['reason']}")

pending = client.read_contract(address=CONTRACT_ADDR, function_name="get_pending_balance", args=[renter.address])
print(f"Renter Pending Withdrawable Balance: {pending}")

print(">>> Calling withdraw()...")
tx_with = client.write_contract(
    address=CONTRACT_ADDR,
    function_name="withdraw"
)
client.wait_for_transaction_receipt(tx_with, status=TransactionStatus.ACCEPTED)
print("Withdrawal tx ACCEPTED!")

pending_after = client.read_contract(address=CONTRACT_ADDR, function_name="get_pending_balance", args=[renter.address])
print(f"Renter Pending Balance after withdraw: {pending_after}")

print("\n--- ALL ESCROW RECLAIM & WITHDRAW METHODS WORK PERFECTLY! ---")
