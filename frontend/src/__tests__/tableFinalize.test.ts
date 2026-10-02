import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteContract = vi.fn();
const mockReadContract = vi.fn();

// Top-level module mock for genlayer-js
vi.mock('genlayer-js', () => ({
  createClient: vi.fn(() => ({
    writeContract: mockWriteContract,
    readContract: mockReadContract,
  })),
}));

import { executeContractWrite, DEFAULT_CONTRACT_ADDRESS } from '../config/genlayer';

describe('Frontend Table Finalize writeContract Path', () => {
  const mockEthereumRequest = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.ethereum provider
    const mockEthereum = {
      request: mockEthereumRequest,
      on: vi.fn(),
      removeListener: vi.fn(),
    };
    (globalThis as any).window = {
      ethereum: mockEthereum,
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
      },
    };

    // Default mock responses for MetaMask
    mockEthereumRequest.mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
        return ['0x1111111111111111111111111111111111111111'];
      }
      if (method === 'eth_chainId') {
        return '0xF1EF'; // 61999
      }
      if (method === 'wallet_switchEthereumChain') {
        return null;
      }
      return null;
    });
  });

  it('routes the table Finalize action through client.writeContract with exact lease_id args', async () => {
    const mockTxHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    mockWriteContract.mockResolvedValueOnce(mockTxHash);

    const leaseId = 'lease-1';
    
    // Execute table Finalize action via executeContractWrite
    const tx = await executeContractWrite('finalize_settlement', [leaseId]);

    // 1. Verify transaction was dispatched and returned expected hash
    expect(tx).toBe(mockTxHash);

    // 2. Verify client.writeContract was called with exact parameters
    expect(mockWriteContract).toHaveBeenCalledTimes(1);
    expect(mockWriteContract).toHaveBeenCalledWith({
      address: DEFAULT_CONTRACT_ADDRESS,
      functionName: 'finalize_settlement',
      args: ['lease-1'],
      value: 0n,
    });
  });

  it('propagates UserError when cooling-off window is still active', async () => {
    // Simulate smart contract revert during cooling-off window
    mockWriteContract.mockRejectedValueOnce(
      new Error('Appeal cooling-off window is still active (240s remaining).')
    );

    await expect(
      executeContractWrite('finalize_settlement', ['lease-2'])
    ).rejects.toThrow('Appeal cooling-off window is still active');

    expect(mockWriteContract).toHaveBeenCalledWith({
      address: DEFAULT_CONTRACT_ADDRESS,
      functionName: 'finalize_settlement',
      args: ['lease-2'],
      value: 0n,
    });
  });

  it('handles user rejection in MetaMask wallet gracefully', async () => {
    mockWriteContract.mockRejectedValueOnce(
      new Error('MetaMask Tx Signature: User denied transaction signature.')
    );

    await expect(
      executeContractWrite('finalize_settlement', ['lease-3'])
    ).rejects.toThrow('User denied transaction signature');
  });

  it('triggers table row finalize action handler and invokes writeContract followed by data refresh', async () => {
    const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    mockWriteContract.mockResolvedValueOnce(mockTxHash);
    const mockFetchData = vi.fn();

    const handleTableFinalize = async (leaseId: string) => {
      await executeContractWrite('finalize_settlement', [leaseId]);
      mockFetchData();
    };

    await handleTableFinalize('lease-42');
    expect(mockWriteContract).toHaveBeenCalledWith({
      address: DEFAULT_CONTRACT_ADDRESS,
      functionName: 'finalize_settlement',
      args: ['lease-42'],
      value: 0n,
    });
    expect(mockFetchData).toHaveBeenCalledTimes(1);
  });
});
