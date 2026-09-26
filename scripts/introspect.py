from genlayer_py import create_client, studionet, create_account
from genlayer_py.types.transactions import TransactionStatus

acc = create_account()
client = create_client(chain=studionet, account=acc)
client.fund_account(acc.address, 10**18)

code = """# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

@gl.contract
class Introspect:
    @gl.public.view
    def get_info(self) -> str:
        attrs = [x for x in dir(gl) if not x.startswith('_')]
        msg_attrs = [x for x in dir(gl.message) if not x.startswith('_')]
        res = {'gl': attrs, 'gl.message': msg_attrs}
        return str(res)
"""

print("Deploying introspection contract...")
tx = client.deploy_contract(code=code)
r = client.wait_for_transaction_receipt(tx, status=TransactionStatus.ACCEPTED, retries=25, interval=3000)
print('Receipt keys:', list(r.keys()) if isinstance(r, dict) else dir(r))
addr = r.get('contract_address') or (r.get('data') and r['data'].get('contract_address')) or r.get('recipient_address') or r.get('to')
print('Found address:', addr)
if not addr:
    print('Full receipt:', r)
else:
    info = client.read_contract(address=addr, function_name='get_info', args=[])
    print('INTROSPECTION RESULT:', info)
