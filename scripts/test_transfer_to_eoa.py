import time
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

acc = create_account()
recipient = create_account()
print(f"Deployer/Sender: {acc.address}")
print(f"Recipient EOA:   {recipient.address}")

client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 2 * 10**18)
time.sleep(2)

code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class TransferTest(gl.Contract):
    @gl.public.write.payable
    def send_to(self, to_addr: Address) -> None:
        val = gl.message.value
        gl.get_contract_at(to_addr).emit_transfer(value=val)
"""

print("Deploying test contract...")
tx = client.deploy_contract(code=code)
r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
print("Receipt keys:", list(r.keys()))
tx_data = client.get_transaction(tx)
c_addr = tx_data.get("recipient") or tx_data.get("to_address")
print(f"Deployed test contract at: {c_addr}")

print(f"Recipient balance before: {client.get_balance(recipient.address)}")

print("Calling send_to with 0.5 GEN...")
tx2 = client.write_contract(
    address=c_addr,
    function_name="send_to",
    args=[recipient.address],
    value=500000000000000000 # 0.5 GEN
)
r2 = client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED)
print(f"Send tx receipt status: {r2.get('status')}")

tx_full = client.get_transaction(tx2)
print("Tx execution result:", tx_full.get("result_name"), tx_full.get("status_name"))
if "consensus_data" in tx_full and "validators" in tx_full["consensus_data"]:
    for v in tx_full["consensus_data"]["validators"]:
        print("Validator exec result:", v.get("execution_result"), v.get("genvm_result"), "calldata:", v.get("result"))

time.sleep(5)
print(f"Recipient balance after:  {client.get_balance(recipient.address)}")
print(f"Contract balance after:   {client.get_balance(c_addr)}")
