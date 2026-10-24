code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class TestPayout(gl.Contract):
    @gl.public.write.payable
    def payout_accepted(self, recipient: Address) -> None:
        val = gl.message.value
        gl.get_contract_at(recipient).emit_transfer(value=val, on="accepted")

    @gl.public.write.payable
    def payout_finalized(self, recipient: Address) -> None:
        val = gl.message.value
        gl.get_contract_at(recipient).emit_transfer(value=val, on="finalized")
"""

from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus
import time

acc = create_account()
rec = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 2 * 10**18)
time.sleep(2)

tx = client.deploy_contract(code=code)
client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
c_addr = client.get_transaction(tx)['recipient']
print("Contract deployed at:", c_addr)
print("Recipient balance start:", client.get_balance(rec.address))

print("Sending payout_accepted...")
tx1 = client.write_contract(address=c_addr, function_name="payout_accepted", args=[rec.address], value=100000000000000000)
client.wait_for_transaction_receipt(tx1, status=TransactionStatus.ACCEPTED)
print("After payout_accepted tx ACCEPTED:")
print("Contract balance:", client.get_balance(c_addr))
print("Recipient balance:", client.get_balance(rec.address))

for i in range(5):
    time.sleep(3)
    b_c = client.get_balance(c_addr)
    b_r = client.get_balance(rec.address)
    print(f"Loop {i+1}: Contract={b_c}, Recipient={b_r}")
