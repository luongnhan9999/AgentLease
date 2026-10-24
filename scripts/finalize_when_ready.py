import time
import json
import base64
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

CONTRACT_ADDRESS = "0xc53586E16c4481EF43E78f41eba66F41DC73921a"
caller = create_account()
client = create_client(chain=studionet, account=caller)
client.fund_account(caller.address, 10**18)
time.sleep(2)

l1 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
audit_time = int(l1["audit_completed_time"])
cooling_end = audit_time + 300
print(f"Lease 1 audit_completed_time: {audit_time}, cooling ends at: {cooling_end}")

for lease_id in ["lease-1", "lease-2"]:
    print(f"\n--- Finalizing {lease_id} ---")
    while True:
        tx = client.write_contract(
            address=CONTRACT_ADDRESS,
            function_name="finalize_settlement",
            args=[lease_id]
        )
        client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
        tx_data = client.get_transaction(tx)
        
        # Check validators
        is_success = False
        val_err = ""
        for v in tx_data.get("consensus_data", {}).get("validators", []):
            if v.get("execution_result") == "SUCCESS":
                is_success = True
            elif v.get("result"):
                raw = base64.b64decode(v["result"])
                val_err = str(raw)
        
        if is_success:
            print(f"SUCCESS: {lease_id} finalized on-chain!")
            break
        else:
            print(f"Waiting cooling-off: {val_err[:80]}")
            time.sleep(25)

print("\n=== FINAL CONTRACT STATE ===")
l1 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-1"]))
l2 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-2"]))
l3 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-3"]))
l4 = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_lease", args=["lease-4"]))
stats = json.loads(client.read_contract(address=CONTRACT_ADDRESS, function_name="get_stats"))

print(f"Lease 1 Status: {l1['status']} ({'FRAUD_REFUNDED' if l1['status'] == 3 else 'SETTLED'})")
print(f"Lease 2 Status: {l2['status']} ({'FRAUD_REFUNDED' if l2['status'] == 3 else 'SETTLED'})")
print(f"Lease 3 Status: {l3['status']} ({'CANCELLED' if l3['status'] == 4 else 'OTHER'})")
print(f"Lease 4 Status: {l4['status']} (OPEN)")
print(f"Stats: {json.dumps(stats, indent=2)}")
