import time
import base64
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

acc = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)
time.sleep(2)

code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class T(gl.Contract):
    @gl.public.view
    def test_view(self) -> str:
        sender = gl.message.sender_address
        return f"type: {type(sender).__name__}, repr: {repr(sender)}"
"""

tx = client.deploy_contract(code=code)
r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
tx_data = client.get_transaction(tx)
c_addr = tx_data["recipient"]
print("Contract:", c_addr)
res = client.read_contract(address=c_addr, function_name="test_view")
print("Result:", res)
