code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class InspectGL(gl.Contract):
    @gl.public.view
    def inspect(self) -> str:
        attrs = [a for a in dir(gl) if not a.startswith('_')]
        res = ["gl attrs: " + ", ".join(attrs)]
        if hasattr(gl, "chain"):
            res.append("gl.chain: " + ", ".join(dir(gl.chain)))
        if hasattr(gl, "evm"):
            res.append("gl.evm: " + ", ".join(dir(gl.evm)))
        return " | ".join(res)
"""

from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus
import time

acc = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)
time.sleep(2)

tx = client.deploy_contract(code=code)
client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
c_addr = client.get_transaction(tx)['recipient']
print("Deployed:", c_addr)

val = client.read_contract(address=c_addr, function_name="inspect")
print("INSPECT RESULT:", val)
