from genlayer_py import create_client, studionet
import base64

client = create_client(chain=studionet)
# Deployed contract was 0x88073A71B8891eca6CCCCaB0da785023054D9D27
print("Contract balance:", client.get_balance("0x88073A71B8891eca6CCCCaB0da785023054D9D27"))
