// GenLayer Studionet Configuration & RPC Client
import { createClient } from 'genlayer-js';

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_ID_HEX = '0xF1EF';
export const STUDIONET_RPC = 'https://studio.genlayer.com/api';
export const STUDIONET_EXPLORER = 'https://studio.genlayer.com';

export const studionetChain = {
  id: STUDIONET_CHAIN_ID,
  name: 'GenLayer StudioNet',
  rpcUrls: {
    default: {
      http: [STUDIONET_RPC],
    },
  },
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  blockExplorers: {
    default: {
      name: 'GenLayer Studio',
      url: STUDIONET_EXPLORER,
    },
  },
};

export const GENLAYER_CHAIN_CONFIG = {
  chainId: STUDIONET_CHAIN_ID_HEX,
  chainName: 'GenLayer StudioNet',
  nativeCurrency: {
    name: 'GEN',
    symbol: 'GEN',
    decimals: 18,
  },
  rpcUrls: [STUDIONET_RPC],
  blockExplorerUrls: [STUDIONET_EXPLORER],
};

const STORAGE_KEY_CONTRACT = 'agentlease_contract_address';
export const DEFAULT_CONTRACT_ADDRESS = '0x98C8d3F0C9841eF9AfED734C1264b0aDC9FBE264';

export function getContractAddress(): string {
  return localStorage.getItem(STORAGE_KEY_CONTRACT) || (import.meta as any).env?.VITE_AGENTLEASE_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS;
}

export function setContractAddress(address: string): void {
  localStorage.setItem(STORAGE_KEY_CONTRACT, address.trim());
}

// GenLayer Read-only Client using official SDK
export function getGenLayerClient() {
  return createClient({
    chain: studionetChain,
    endpoint: STUDIONET_RPC,
  });
}

// Fetch live block height from Studionet
export async function fetchCurrentBlockNumber(): Promise<number> {
  try {
    const res = await fetch(STUDIONET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
    });
    const json = await res.json();
    if (json.result) {
      return parseInt(json.result, 16);
    }
  } catch (err) {
    console.warn('Could not fetch block number:', err);
  }
  return 0;
}

// Fetch Contract Vault Balance in GEN
export async function fetchContractBalance(): Promise<string> {
  const contractAddress = getContractAddress();
  try {
    const res = await fetch(STUDIONET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getBalance',
        params: [contractAddress, 'latest'],
      }),
    });
    const json = await res.json();
    if (json.result) {
      return BigInt(json.result).toString();
    }
  } catch (err) {
    console.warn('Could not fetch contract balance:', err);
  }
  return '0';
}

// MetaMask Network Switcher
export async function switchToStudioNet(): Promise<boolean> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask to use AgentLease.');
  }

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchError: any) {
    if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [GENLAYER_CHAIN_CONFIG],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add GenLayer StudioNet chain:', addError);
        throw addError;
      }
    }
    console.error('Failed to switch to StudioNet:', switchError);
    throw switchError;
  }
}

// Low-level RPC caller for GenLayer Studionet Contract Views
export async function callContractView(methodName: string, args: any[] = []): Promise<any> {
  const contractAddress = getContractAddress();
  try {
    const client = getGenLayerClient();
    const result = await (client as any).readContract({
      address: contractAddress,
      functionName: methodName,
      args: args,
    });
    return result;
  } catch (sdkError) {
    console.warn(`[SDK fallback] readContract fallback for ${methodName}:`, sdkError);
    const response = await fetch(STUDIONET_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'gen_callView',
        params: [contractAddress, methodName, args],
      }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || 'Error executing on-chain view method');
    }
    return data.result;
  }
}

// MetaMask Transaction Dispatcher for Public Write Methods
export async function executeContractWrite(
  methodName: string,
  args: any[] = [],
  valueWei: bigint = 0n
): Promise<string> {
  const ethereum = (window as any).ethereum;
  if (!ethereum) {
    throw new Error('MetaMask is required to interact with AgentLease on GenLayer.');
  }

  await switchToStudioNet();

  const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
  const senderAddress = accounts[0];
  const contractAddress = getContractAddress();

  const client = getGenLayerClient();

  try {
    const txHash = await client.writeContract({
      address: contractAddress as any,
      functionName: methodName,
      args: args,
      value: valueWei,
      account: senderAddress,
    });
    return txHash as string;
  } catch (err: any) {
    console.warn(`[GenLayer-JS Write Fallback] Writing via direct provider:`, err);
    
    const txParams = {
      from: senderAddress,
      to: contractAddress,
      value: '0x' + valueWei.toString(16),
      data: undefined,
    };
    
    const tx = await ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams],
    });
    return tx;
  }
}
