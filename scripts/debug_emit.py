code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class TestEmit(gl.Contract):
    @gl.public.write.payable
    def do_send(self, target: Address) -> None:
        val = gl.message.value
        gl.get_contract_at(target).emit_transfer(value=val, on="accepted")
"""

from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus
import time
import json

acc = create_account()
target = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)
time.sleep(2)

tx = client.deploy_contract(code=code)
client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
c_addr = client.get_transaction(tx)['recipient']

tx2 = client.write_contract(address=c_addr, function_name="do_send", args=[target.address], value=100000000000000000)
client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED)

tx_data = client.get_transaction(tx2)
print("TX2 KEYS:", list(tx_data.keys()))
for k, v in tx_data.items():
    if k != "consensus_data":
        print(f"{k}: {v}")
try:
    triggered = client.get_triggered_transaction_ids(tx2)
    print("TRIGGERED TXS:", triggered)
except Exception as e:
    print("GET TRIGGERED ERR:", e)
