code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class InspectGenvm(gl.Contract):
    @gl.public.view
    def inspect(self) -> str:
        import inspect
        from genlayer.gl import genvm_contracts
        src = inspect.getsource(genvm_contracts._ContractAt)
        return src[:500]
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

val = client.read_contract(address=c_addr, function_name="inspect")
print("SOURCE:", val)
