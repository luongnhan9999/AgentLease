import time
import json
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

addr = "0xb8A7BF70d1B45A62612350E52a2A0879AC88330C"
acc = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)
time.sleep(2)

print("Checking cooling off timer...")
while True:
    l1 = json.loads(client.read_contract(address=addr, function_name="get_lease", args=["lease-1"]))
    status1 = l1.get("status")
    print(f"lease-1 status={status1}, verdict={l1.get('verdict')}")
    if status1 in (2, 3, 4, 5):
        print("lease-1 already settled!")
        break
    try:
        tx = client.write_contract(address=addr, function_name="finalize_settlement", args=["lease-1"])
        r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
        print("Finalized lease-1 successfully:", r.get("status_name"))
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
try:
    tx2 = client.write_contract(address=addr, function_name="finalize_settlement", args=["lease-2"])
    r2 = client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
    print("Finalized lease-2 successfully:", r2.get("status_name"))
except Exception as e:
    print("Finalize lease-2 result:", e)

# Cancel lease-3 test (or create lease-4 as open)
stats = json.loads(client.read_contract(address=addr, function_name="get_stats", args=[]))
print("\n=== FINAL STATS ===")
print(json.dumps(stats, indent=2))
