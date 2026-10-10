import time
import json
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0x49f63B606c0a0c3Be9Eb6B541E2d48df5a0D89c9"
caller = create_account()
client = create_client(chain=studionet, account=caller)
client.fund_account(caller.address, 10**18)
time.sleep(2)

print(f"=== FINALIZING LEASES ON {CONTRACT_ADDRESS} ===")

for lease_id in ["lease-1", "lease-2"]:
    while True:
        try:
            print(f"Calling finalize_settlement for {lease_id}...")
            tx = client.write_contract(
                address=CONTRACT_ADDRESS,
                function_name="finalize_settlement",
                args=[lease_id]
            )
            r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
            print(f"-> {lease_id} finalized! Tx: {tx}")
            break
        except Exception as e:
            err_msg = str(e)
            if "cooling-off" in err_msg or "remaining" in err_msg:
                print(f"[{lease_id}] Waiting: {err_msg}")
                time.sleep(15)
            else:
                print(f"[{lease_id}] Result / Already settled: {err_msg}")
                break

l1 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
l2 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-2"]))
l3 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-3"]))
stats = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_stats"))

print("\n--- FINAL ON-CHAIN REPORT ---")
print(f"Lease 1: Status={l1['status']} ({'FRAUD_REFUNDED' if l1['status'] == 3 else 'SETTLED'}), Verdict={l1['verdict']}")
print(f"Lease 2: Status={l2['status']} ({'FRAUD_REFUNDED' if l2['status'] == 3 else 'SETTLED'}), Verdict={l2['verdict']}")
print(f"Lease 3: Status={l3['status']} (OPEN for evaluation), Escrow={l3['escrow_amount']}")
print(f"Contract Stats: {json.dumps(stats)}")
