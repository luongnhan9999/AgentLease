from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus
import time

code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

def _to_address(addr) -> Address:
    if isinstance(addr, Address):
        return addr
    if isinstance(addr, str):
        hex_str = addr.strip()
        if not hex_str.startswith("0x"):
            hex_str = "0x" + hex_str
        return Address(hex_str)
    if hasattr(addr, "as_bytes"):
        return Address(addr.as_bytes)
    return Address(bytes(addr))

class TestEmitTrack(gl.Contract):
    @gl.public.write.payable
    def do_send(self, target: str) -> str:
        val = gl.message.value
        addr = _to_address(target)
        gl.get_contract_at(addr).emit_transfer(value=val, on="accepted")
        return "SUCCESS"
"""

acc = create_account()
target = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)
time.sleep(2)

print(f"Deployer: {acc.address}")
print(f"Target EOA: {target.address}")
print(f"Target initial balance: {client.get_balance(target.address)}")

tx = client.deploy_contract(code=code)
client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
c_addr = client.get_transaction(tx)['recipient']
print("Deployed at:", c_addr)

print("Calling do_send with 0.1 GEN...")
tx2 = client.write_contract(address=c_addr, function_name="do_send", args=[target.address], value=100000000000000000)
client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED)
print("Tx2 ACCEPTED:", tx2)

for i in range(10):
    time.sleep(3)
    b_c = client.get_balance(c_addr)
    b_t = client.get_balance(target.address)
    print(f"[{i+1}] Contract bal={b_c}, Target bal={b_t}")
