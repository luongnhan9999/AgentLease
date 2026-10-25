# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

def _to_address(addr) -> Address:
    if isinstance(addr, Address):
        return addr
    if isinstance(addr, str):
        hex_str = addr.strip()
        if not hex_str.startswith("0x") and not hex_str.startswith("0X"):
            hex_str = "0x" + hex_str
        return Address(hex_str)
    if hasattr(addr, "as_bytes"):
        return Address(addr.as_bytes)
    return Address(bytes(addr))

class TestStoredTransfer(gl.Contract):
    @gl.public.write.payable
    def deposit(self) -> None:
        pass

    @gl.public.write
    def withdraw_to(self, to_addr: str, amount: u256) -> str:
        try:
            target = _to_address(to_addr)
            gl.get_contract_at(target).emit_transfer(value=amount)
            return "SUCCESS"
        except Exception as e:
            return f"FAIL: {e}"
"""

from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus
import time, base64

acc = create_account()
recipient = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 2 * 10**18)
time.sleep(2)

print("Deploying contract...")
tx = client.deploy_contract(code=code)
client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
c_addr = client.get_transaction(tx)['recipient']
print("Deployed at:", c_addr)

print("Depositing 0.5 GEN...")
tx1 = client.write_contract(address=c_addr, function_name="deposit", value=500000000000000000)
client.wait_for_transaction_receipt(tx1, status=TransactionStatus.ACCEPTED)
print("Contract balance:", client.get_balance(c_addr))

print("Calling withdraw_to WITHOUT value attached (transferring from contract balance)...")
tx2 = client.write_contract(address=c_addr, function_name="withdraw_to", args=[recipient.address, 100000000000000000])
client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED)

tx2_data = client.get_transaction(tx2)
print("Tx2 status:", tx2_data.get("status_name"), "result:", tx2_data.get("result_name"))
for v in tx2_data.get("consensus_data", {}).get("validators", []):
    res_bytes = base64.b64decode(v.get("result", "")) if v.get("result") else b""
    print("Validator:", v.get("execution_result"), res_bytes, v.get("genvm_result"))
