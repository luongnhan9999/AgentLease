import time
import json
import base64
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

addr = "0x0adeDc5c3B1Fc59FBB8e5aB8d55aC71fCb75B464"
acc = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)
time.sleep(2)

print(f"=== WAITING AND FINALIZING SETTLEMENTS ON {addr} ===")

while True:
    l1 = json.loads(client.read_contract(address=addr, function_name="get_lease", args=["lease-1"]))
    s1 = l1.get("status")
    print(f"lease-1 status={s1}, verdict={l1.get('verdict')}")
    if s1 in (2, 3, 4, 5):
        print("lease-1 already settled!")
        break
    try:
        tx = client.write_contract(address=addr, function_name="finalize_settlement", args=["lease-1"])
        r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
        print("Finalized lease-1 receipt status:", r.get("status_name"))
        break
    except Exception as e:
        msg = str(e)
        if "cooling-off" in msg or "remaining" in msg:
            print("Cooling off window active, waiting 20s...")
            time.sleep(20)
        else:
            print("Finalize exception:", e)
            break

# Finalize lease-2
print("\nFinalizing lease-2...")
while True:
    l2 = json.loads(client.read_contract(address=addr, function_name="get_lease", args=["lease-2"]))
    s2 = l2.get("status")
    print(f"lease-2 status={s2}, verdict={l2.get('verdict')}")
    if s2 in (2, 3, 4, 5):
        print("lease-2 already settled!")
        break
    try:
        tx2 = client.write_contract(address=addr, function_name="finalize_settlement", args=["lease-2"])
        r2 = client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
        print("Finalized lease-2 receipt status:", r2.get("status_name"))
        break
    except Exception as e:
        msg = str(e)
        if "cooling-off" in msg or "remaining" in msg:
            print("Cooling off window active for lease-2, waiting 15s...")
            time.sleep(15)
        else:
            print("Finalize lease-2 exception:", e)
            break

stats = json.loads(client.read_contract(address=addr, function_name="get_stats", args=[]))
print("\n=== FINAL STATS FOR 0x0adeDc5c3B1Fc59FBB8e5aB8d55aC71fCb75B464 ===")
print(json.dumps(stats, indent=2))
