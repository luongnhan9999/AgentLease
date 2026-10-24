code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class TestType(gl.Contract):
    @gl.public.write
    def check_addr(self, addr_str: str) -> str:
        # Test 1: Address(addr_str)
        # Test 2: Address(bytes)
        # Test 3: get_contract_at
        errs = []
        try:
            a = Address(addr_str)
            gl.get_contract_at(a)
            errs.append("SUCCESS_WITH_Address(addr_str)")
        except Exception as e:
            errs.append(f"ERR_Address(str): {type(e).__name__} {e}")

        try:
            a2 = Address(bytes.fromhex(addr_str[2:] if addr_str.startswith('0x') else addr_str))
            gl.get_contract_at(a2)
            errs.append("SUCCESS_WITH_Address(bytes)")
        except Exception as e:
            errs.append(f"ERR_Address(bytes): {type(e).__name__} {e}")

        try:
            gl.get_contract_at(addr_str)
            errs.append("SUCCESS_WITH_raw_str")
        except Exception as e:
            errs.append(f"ERR_raw_str: {type(e).__name__} {e}")

        raise gl.vm.UserError(" | ".join(errs))
"""

from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus
acc = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)
import time
time.sleep(2)
tx = client.deploy_contract(code=code)
r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
tx_data = client.get_transaction(tx)
c_addr = tx_data.get("recipient")
print("Deployed to:", c_addr)

try:
    tx2 = client.write_contract(address=c_addr, function_name="check_addr", args=[acc.address])
    client.wait_for_transaction_receipt(tx2, status=TransactionStatus.ACCEPTED)
    t = client.get_transaction(tx2)
    for v in t["consensus_data"]["validators"]:
        print("Result:", v.get("execution_result"), v.get("genvm_result"))
except Exception as e:
    print("Err:", e)
