code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass

@allow_storage
@dataclass
class Item:
    user: Address

class TStorage(gl.Contract):
    items: TreeMap[str, Item]

    @gl.public.write
    def save(self) -> None:
        sender = gl.message.sender_address
        self.items["k"] = Item(user=sender)

    @gl.public.write.payable
    def test_transfer(self) -> str:
        item = self.items["k"]
        val = gl.message.value
        t_user = type(item.user).__name__
        try:
            gl.get_contract_at(item.user).emit_transfer(value=val)
            return f"SUCCESS type={t_user}"
        except Exception as e:
            return f"FAIL type={t_user} err={type(e).__name__} {e}"
"""

from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus
import time

acc = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 2 * 10**18)
time.sleep(2)

tx = client.deploy_contract(code=code)
client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
c_addr = client.get_transaction(tx)["recipient"]
print("Contract:", c_addr)

tx1 = client.write_contract(address=c_addr, function_name="save")
client.wait_for_transaction_receipt(tx1, status=TransactionStatus.ACCEPTED)

tx2 = client.write_contract(address=c_addr, function_name="test_transfer", value=100000000000000000)
client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED)

tx2_data = client.get_transaction(tx2)
print("Tx2 result:", tx2_data.get("result_name"))
for v in tx2_data.get("consensus_data", {}).get("validators", []):
    import base64
    raw_res = v.get("result", "")
    print("Validator result:", v.get("execution_result"), base64.b64decode(raw_res) if raw_res else "")
