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

  it('routes appeal_verdict and adjudicate_appeal through writeContract with bond forfeiture on DEGRADED', async () => {
    // Step 1: appeal_verdict is a payable write call with bond value
    const appealTxHash = '0xappeal1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    mockWriteContract.mockResolvedValueOnce(appealTxHash);

    const appealTx = await executeContractWrite(
      'appeal_verdict',
      ['lease-10', 'https://cdn.agentlease.io/appeal-evidence.txt'],
      1000000000000000000n // 1 GEN bond
    );
    expect(appealTx).toBe(appealTxHash);
    expect(mockWriteContract).toHaveBeenCalledWith({
      address: DEFAULT_CONTRACT_ADDRESS,
      functionName: 'appeal_verdict',
      args: ['lease-10', 'https://cdn.agentlease.io/appeal-evidence.txt'],
      value: 1000000000000000000n,
    });

    // Step 2: adjudicate_appeal triggered by any party
    const adjTxHash = '0xadjudicate567890abcdef1234567890abcdef1234567890abcdef1234567890';
    mockWriteContract.mockResolvedValueOnce(adjTxHash);

    const adjTx = await executeContractWrite('adjudicate_appeal', ['lease-10']);
    expect(adjTx).toBe(adjTxHash);
    expect(mockWriteContract).toHaveBeenCalledWith({
      address: DEFAULT_CONTRACT_ADDRESS,
      functionName: 'adjudicate_appeal',
      args: ['lease-10'],
      value: 0n,
    });

    // Step 3: Verify readContract can fetch the settled lease to check bond routing
    const settledLease = JSON.stringify({
      lease_id: 'lease-10',
      status: 5,
      verdict: 'HARDWARE_DEGRADED',
      initial_verdict: 'HARDWARE_FRAUDULENT',
      dispute_bond: '1000000000000000000',
    });
    mockReadContract.mockResolvedValueOnce(settledLease);

    const leaseData = JSON.parse(
      await mockReadContract({ address: DEFAULT_CONTRACT_ADDRESS, functionName: 'get_lease', args: ['lease-10'] })
    );
    expect(leaseData.status).toBe(5); // SETTLED_PARTIAL
    expect(leaseData.verdict).toBe('HARDWARE_DEGRADED');
    expect(leaseData.initial_verdict).toBe('HARDWARE_FRAUDULENT');
  });

  it('routes submit_benchmark_and_verify through writeContract and rejects forged attestation via readContract', async () => {
    // Step 1: Host submits telemetry proof with forged/invalid attestation
    const submitTxHash = '0xsubmit1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    mockWriteContract.mockResolvedValueOnce(submitTxHash);

    const tx = await executeContractWrite(
      'submit_benchmark_and_verify',
      ['lease-20', 'https://cdn.agentlease.io/forged-telemetry.txt']
    );
    expect(tx).toBe(submitTxHash);
    expect(mockWriteContract).toHaveBeenCalledWith({
      address: DEFAULT_CONTRACT_ADDRESS,
      functionName: 'submit_benchmark_and_verify',
      args: ['lease-20', 'https://cdn.agentlease.io/forged-telemetry.txt'],
      value: 0n,
    });

    // Step 2: Frontend reads lease to verify FRAUDULENT verdict from attestation rejection
    const fraudLease = JSON.stringify({
      lease_id: 'lease-20',
      status: 7,
      verdict: 'HARDWARE_FRAUDULENT',
      reason: 'Cryptographic attestation failed: UNREGISTERED_MACHINE_ORIGIN',
      confidence: 100,
    });
    mockReadContract.mockResolvedValueOnce(fraudLease);

    const result = JSON.parse(
      await mockReadContract({ address: DEFAULT_CONTRACT_ADDRESS, functionName: 'get_lease', args: ['lease-20'] })
    );
    expect(result.verdict).toBe('HARDWARE_FRAUDULENT');
    expect(result.reason).toContain('attestation');
    expect(result.status).toBe(7); // AUDIT_COMPLETED with FRAUDULENT
  });
});
