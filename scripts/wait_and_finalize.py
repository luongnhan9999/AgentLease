import time
import json
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0x9B6C9fb5756B6763645a1079409841B7e2f28796"
caller = create_account()
client = create_client(chain=studionet, account=caller)
client.fund_account(caller.address, 10**18)
time.sleep(2)

print(f"=== CHECKING COOLING-OFF WINDOW FOR {CONTRACT_ADDRESS} ===")
while True:
    l1 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
    completed = l1.get("audit_completed_time", 0)
    print(f"Lease 1 status: {l1.get('status')}, audit_completed_time: {completed}")
    
    # Try calling finalize_settlement
    try:
        tx = client.write_contract(
            address=CONTRACT_ADDRESS,
            function_name="finalize_settlement",
            args=["lease-1"]
        )
        r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
        print("Finalized lease-1! Receipt:", r.get("status_name", r.get("status")))
        break
    except Exception as e:
        err_msg = str(e)
        if "cooling-off" in err_msg or "remaining" in err_msg:
            print(f"Still cooling off... {err_msg}")
            time.sleep(25)
        else:
            print("Error or already finalized:", err_msg)
            break

# Finalize lease-2
try:
    tx2 = client.write_contract(
        address=CONTRACT_ADDRESS,
        function_name="finalize_settlement",
        args=["lease-2"]
    )
    r2 = client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED, retries=30, interval=3000)
    print("Finalized lease-2! Receipt:", r2.get("status_name", r2.get("status")))
except Exception as e:
    print("Finalize lease-2 result:", e)

# Final stats check
stats = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_contract_stats"))
print("\nFINAL CONTRACT STATS ON STUDIONET:")
print(json.dumps(stats, indent=2))
