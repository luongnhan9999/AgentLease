import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { LeaseCard } from './components/LeaseCard';
import { CreateLease } from './components/CreateLease';
import { SubmitProof } from './components/SubmitProof';
import { DiagnosticInspectorModal } from './components/DiagnosticInspectorModal';
import { Plus, Search, Server, Terminal, Radio, Shield, LayoutGrid, List, AlertCircle } from 'lucide-react';
import { LeaseOrderData, ClusterStats, shortenAddress, formatGen, getStatusMeta, parseGpuSpecs } from './utils/helpers';
import {
  callContractView,
  fetchCurrentBlockNumber,
  fetchContractBalance,
  switchToStudioNet,
  getContractAddress,
  STUDIONET_RPC,
} from './config/genlayer';

export const App: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [chainId, setChainId] = useState<number | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [contractVaultBal, setContractVaultBal] = useState<string>('0');

  const [stats, setStats] = useState<ClusterStats>({
    total_leases: 0,
    total_compute_locked: '0',
    total_leases_settled: 0,
  });

  const [leases, setLeases] = useState<LeaseOrderData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [proofLease, setProofLease] = useState<LeaseOrderData | null>(null);
  const [diagnosticLease, setDiagnosticLease] = useState<LeaseOrderData | null>(null);

  // Pure On-Chain Data Fetching (Zero Mocks)
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    setFetchError(null);
    try {
      // 1. Fetch live block height from Studionet
      const blk = await fetchCurrentBlockNumber();
      if (blk > 0) setCurrentBlock(blk);

      // 2. Fetch live contract GEN balance
      const cBal = await fetchContractBalance();
      setContractVaultBal(cBal);

      // 3. Fetch Stats directly from contract
      try {
        const rawStats = await callContractView('get_stats', []);
        if (rawStats) {
          const parsed = typeof rawStats === 'string' ? JSON.parse(rawStats) : rawStats;
          setStats({
            total_leases: Number(parsed.total_leases || 0),
            total_compute_locked: parsed.total_compute_locked?.toString() || '0',
            total_leases_settled: Number(parsed.total_leases_settled || 0),
          });
        }
      } catch (err: any) {
        console.warn('On-chain get_stats call:', err);
      }

      // 4. Fetch Paginated Leases directly from contract
      try {
        const rawLeases = await callContractView('get_leases_paginated', [0, 50]);
        if (rawLeases) {
          const list: LeaseOrderData[] = typeof rawLeases === 'string' ? JSON.parse(rawLeases) : rawLeases;
          if (Array.isArray(list)) {
            setLeases(list);
          } else {
            setLeases([]);
          }
        } else {
          setLeases([]);
        }
      } catch (err: any) {
        console.warn('On-chain get_leases_paginated call:', err);
        setFetchError('Direct contract read failed. Please verify that the contract is deployed on Studionet.');
        setLeases([]);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Update Account & Balance
  const updateWalletState = useCallback(async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;

    try {
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        setChainId(parseInt(chainIdHex, 16));

        const balHex = await ethereum.request({
          method: 'eth_getBalance',
          params: [accounts[0], 'latest'],
        });
        setBalance(balHex ? BigInt(balHex).toString() : '0');
      } else {
        setAccount(null);
        setBalance('0');
      }
    } catch (err) {
      console.error('Error fetching wallet state:', err);
    }
  }, []);

  // Connect Wallet Action
  const handleConnectWallet = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      alert('MetaMask is not detected. Please install MetaMask to interact with AgentLease.');
      return;
    }
    try {
      await switchToStudioNet();
      await ethereum.request({ method: 'eth_requestAccounts' });
      await updateWalletState();
      fetchData();
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
    }
  };

  // Initial Load & Event Listeners
  useEffect(() => {
    updateWalletState();
    fetchData();

    const interval = setInterval(() => {
      fetchCurrentBlockNumber().then((b) => b > 0 && setCurrentBlock(b));
      fetchContractBalance().then((bal) => setContractVaultBal(bal));
    }, 8000);

    const ethereum = (window as any).ethereum;
    if (ethereum && ethereum.on) {
      const handleAccountsChanged = () => updateWalletState();
      const handleChainChanged = () => {
        updateWalletState();
        fetchData();
      };
      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);

      return () => {
        clearInterval(interval);
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }

    return () => clearInterval(interval);
  }, [updateWalletState, fetchData]);

  // Tab and Search Filtering
  const filteredLeases = leases.filter((l) => {
    if (activeTab === 'MY_RENTER') {
      if (!account || l.renter.toLowerCase() !== account.toLowerCase()) return false;
    } else if (activeTab === 'MY_HOST') {
      if (!account || l.host.toLowerCase() !== account.toLowerCase()) return false;
    } else if (activeTab === 'OPEN') {
      if (l.status !== 0) return false;
    } else if (activeTab === 'IN_AUDIT') {
      if (l.status !== 1) return false;
    } else if (activeTab === 'SETTLED') {
      if (l.status !== 2 && l.status !== 3) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = l.lease_id.toLowerCase().includes(q);
      const matchSpec = l.hardware_spec.toLowerCase().includes(q);
      const matchRenter = l.renter.toLowerCase().includes(q);
      const matchHost = l.host.toLowerCase().includes(q);
      const matchVerdict = l.verdict.toLowerCase().includes(q);
      return matchId || matchSpec || matchRenter || matchHost || matchVerdict;
    }

    return true;
  });

  const activeCount = leases.filter((l) => l.status === 0 || l.status === 1).length;

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Navigation Bar */}
      <Navbar
        account={account}
        balance={balance}
        chainId={chainId}
        currentBlock={currentBlock}
        onConnectWallet={handleConnectWallet}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7">
        
        {/* RunPod / Lambda Labs Style Header */}
        <div className="mb-6 p-6 sm:p-7 rounded-xl bg-gray-900 border border-gray-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Radio className="w-3 h-3 animate-pulse" />
                <span>GenLayer StudioNet Connected</span>
              </span>
              <span className="text-xs font-mono text-gray-400">
                Contract: <span className="text-gray-200 font-semibold">{shortenAddress(getContractAddress())}</span>
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2 font-sans">
              GPU Compute SLA Marketplace
            </h1>
            <p className="text-sm text-gray-400 leading-relaxed">
              Decentralized hardware escrow verifying GPU models, VRAM integrity, and TFLOPS directly on-chain 
              via GenLayer Subjective AI Consensus before releasing payment.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Deploy Compute Order</span>
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-xs font-mono text-gray-400">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="truncate max-w-[180px]">{STUDIONET_RPC.replace('https://', '')}</span>
            </div>
          </div>
        </div>

        {/* Aggregate Stats Bar */}
        <StatsBar stats={stats} activeCount={activeCount} contractVaultBal={contractVaultBal} />

        {/* Filter Toolbar & View Toggle */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-5">
          
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-900 border border-gray-800 text-xs font-medium overflow-x-auto">
            {[
              { id: 'ALL', label: `All Instances (${leases.length})` },
              { id: 'OPEN', label: 'Available for Rent' },
              { id: 'IN_AUDIT', label: 'Verifying SLA' },
              { id: 'SETTLED', label: 'Active & Verified' },
              { id: 'MY_RENTER', label: 'My Renter Orders' },
              { id: 'MY_HOST', label: 'My Host Claims' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right: Search Box + View Switcher */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by GPU, ID, or Address..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-gray-900 border border-gray-800 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Grid vs Table View Mode */}
            <div className="flex items-center rounded-lg bg-gray-900 border border-gray-800 p-0.5">
              <button
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded ${viewMode === 'GRID' ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-white'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded ${viewMode === 'TABLE' ? 'bg-gray-800 text-blue-400' : 'text-gray-400 hover:text-white'}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Sync Warning Notice if applicable */}
        {fetchError && (
          <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800 text-amber-200 text-xs font-mono mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{fetchError}</span>
            </div>
          </div>
        )}

        {/* Leases Display: Grid View or Table View */}
        {filteredLeases.length > 0 ? (
          viewMode === 'GRID' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredLeases.map((lease) => (
                <LeaseCard
                  key={lease.lease_id}
                  lease={lease}
                  currentUser={account}
                  onSubmitProof={(l) => setProofLease(l)}
                  onInspectDiagnostics={(l) => setDiagnosticLease(l)}
                  onRefresh={fetchData}
                />
              ))}
            </div>
          ) : (
            /* Table View (RunPod / Vast.ai Style) */
            <div className="rounded-xl bg-gray-900 border border-gray-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0B0F19] text-gray-400 uppercase text-[10px] tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="px-4 py-3">Instance ID</th>
                      <th className="px-4 py-3">GPU Hardware Specs</th>
                      <th className="px-4 py-3">Escrow Deposit</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Parties</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-gray-300">
                    {filteredLeases.map((lease) => {
                      const statusMeta = getStatusMeta(lease.status);
                      const specs = parseGpuSpecs(lease.hardware_spec);
                      return (
                        <tr key={lease.lease_id} className="hover:bg-gray-850/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                            {lease.lease_id}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-bold text-white font-sans">{specs.model}</div>
                            <div className="text-[11px] text-gray-400">{specs.vram} • {specs.tflops}</div>
                          </td>
                          <td className="px-4 py-3 text-blue-400 font-bold whitespace-nowrap">
                            {formatGen(lease.escrow_amount)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.borderColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`}></span>
                              <span>{statusMeta.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-[11px]">
                            <div>R: {shortenAddress(lease.renter)}</div>
                            <div>H: {shortenAddress(lease.host)}</div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {lease.status === 0 && (
                                <button
                                  onClick={() => setProofLease(lease)}
                                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-medium"
                                >
                                  Claim
                                </button>
                              )}
                              <button
                                onClick={() => setDiagnosticLease(lease)}
                                className="px-2.5 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 font-sans text-xs"
                              >
                                Diagnostics
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : (
          /* Clean Empty State */
          <div className="p-12 rounded-xl bg-gray-900 border border-gray-800 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1 font-sans">
              {activeTab === 'MY_RENTER' || activeTab === 'MY_HOST'
                ? 'No Instances Found for Connected Wallet'
                : 'No GPU Orders Deployed Yet'}
            </h3>
            <p className="text-xs text-gray-400 max-w-sm mb-4 font-sans leading-relaxed">
              {activeTab === 'MY_RENTER' || activeTab === 'MY_HOST'
                ? `Account ${shortenAddress(account || '')} does not have any compute orders in this view.`
                : 'Deploy the first GPU compute SLA order to lock GEN escrow and initiate on-chain verification.'}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Deploy Compute Order</span>
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-[#0B0F19] py-5 text-xs font-sans text-gray-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-500" />
            <span className="text-gray-300 font-semibold">AgentLease</span>
            <span>• Decentralized AI Compute SLA Escrow on GenLayer</span>
          </div>
          <div className="flex items-center gap-3 text-gray-400 font-mono text-[11px]">
            <span>Studionet (61999)</span>
            <span>•</span>
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:underline"
            >
              Studio IDE
            </a>
            <span>•</span>
            <a
              href="https://github.com/luongnhan9999/AgentLease"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline font-sans"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CreateLease
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchData}
        userBalance={balance}
      />

      <SubmitProof
        isOpen={Boolean(proofLease)}
        lease={proofLease}
        onClose={() => setProofLease(null)}
        onSuccess={fetchData}
      />

      <DiagnosticInspectorModal
        isOpen={Boolean(diagnosticLease)}
        lease={diagnosticLease}
        onClose={() => setDiagnosticLease(null)}
        onAdjudicated={fetchData}
      />

    </div>
  );
};

export default App;
