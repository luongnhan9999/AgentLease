import json
from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

acc = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)

code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

@gl.contract
class Test:
    @gl.public.view
    def test(self) -> str:
        attrs = [x for x in dir(gl) if not x.startswith('_')]
        return json.dumps(attrs)
"""

tx = client.deploy_contract(code=code)
r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED)
print("Keys in receipt:", list(r.keys()))
for k, v in r.items():
    if k not in ['genvm_result', 'data']:
        print(f"  {k}: {v}")
