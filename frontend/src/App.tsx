import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { LeaseCard } from './components/LeaseCard';
import { CreateLease } from './components/CreateLease';
import { SubmitProof } from './components/SubmitProof';
import { DiagnosticInspectorModal } from './components/DiagnosticInspectorModal';
import { AppealModal } from './components/AppealModal';
import { Plus, Search, Server, Terminal, Radio, Shield, LayoutGrid, List, AlertCircle, Coins } from 'lucide-react';
import { LeaseOrderData, ClusterStats, shortenAddress, formatGen, getStatusMeta, parseGpuSpecs } from './utils/helpers';
import {
  callContractView,
  executeContractWrite,
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
  const [appealLease, setAppealLease] = useState<LeaseOrderData | null>(null);

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
      if (l.status !== 2 && l.status !== 3 && l.status !== 5) return false;
    } else if (activeTab === 'APPEALS') {
      if (l.status !== 6 && l.status !== 7) return false;
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
    <div className="min-h-screen bg-[#0A0B0E] text-luxury-sand flex flex-col font-sans selection:bg-[#F5D061] selection:text-black">
      
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Executive Fintech Hero Banner */}
        <div className="mb-8 p-7 sm:p-10 rounded-2xl fintech-card flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-[#F5D061]/10 text-[#F5D061] border border-[#F5D061]/30">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>GenLayer StudioNet • Autonomous Compute SLA Escrow</span>
              </span>
              <span className="text-xs font-mono text-luxury-sandDark hidden sm:inline">
                Vault: <span className="text-[#F5D061] font-semibold">{shortenAddress(getContractAddress())}</span>
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 font-sans">
              Autonomous AI Compute <span className="text-[#F5D061]">SLA Treasury</span>
            </h1>
            <p className="text-sm text-luxury-sandDark leading-relaxed">
              Decentralized hardware escrow verifying GPU models, VRAM capacity, and TFLOPS throughput directly on-chain 
              via GenLayer Subjective AI Consensus before releasing settlement payouts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto relative z-10">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-gold flex-1 md:flex-initial flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-xs font-bold tracking-wide shadow-gold-sm"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Deploy Compute Order</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3.5 py-3 rounded-xl bg-[#0A0B0E] border border-[#2C261C] text-xs font-mono text-luxury-sandDark">
              <Terminal className="w-3.5 h-3.5 text-[#F5D061]" />
              <span className="text-luxury-sand font-medium truncate max-w-[170px]">{STUDIONET_RPC.replace('https://', '')}</span>
            </div>
          </div>
        </div>

        {/* Aggregate Stats Bar */}
        <StatsBar stats={stats} activeCount={activeCount} contractVaultBal={contractVaultBal} />

        {/* Filter Toolbar & View Toggle */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6">
          
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#111318] border border-[#2C261C] text-xs font-medium overflow-x-auto">
            {[
              { id: 'ALL', label: `All Orders (${leases.length})` },
              { id: 'OPEN', label: 'Open for Claim' },
              { id: 'IN_AUDIT', label: 'In AI Audit' },
              { id: 'APPEALS', label: 'Appeals & Cooling Window' },
              { id: 'SETTLED', label: 'Settled & Degraded' },
              { id: 'MY_RENTER', label: 'My Renter Orders' },
              { id: 'MY_HOST', label: 'My Host Claims' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'btn-gold font-bold shadow-sm'
                    : 'text-luxury-sandDark hover:text-white hover:bg-[#1C1E26]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right: Search Box + View Switcher */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 lg:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-luxury-sandDark" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by GPU, ID, or Address..."
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#111318] border border-[#2C261C] text-white text-xs placeholder-luxury-sandDark focus:outline-none focus:border-[#F5D061] transition-colors"
              />
            </div>

            {/* Grid vs Table View Mode */}
            <div className="flex items-center rounded-xl bg-[#111318] border border-[#2C261C] p-1">
              <button
                onClick={() => setViewMode('GRID')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'GRID' ? 'bg-[#F5D061] text-black font-bold' : 'text-luxury-sandDark hover:text-white'}`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === 'TABLE' ? 'bg-[#F5D061] text-black font-bold' : 'text-luxury-sandDark hover:text-white'}`}
                title="Table View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Sync Notice if applicable */}
        {fetchError && (
          <div className="p-4 rounded-xl bg-[#1A1408] border border-[#433A2A] text-[#F5D061] text-xs font-mono mb-5 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#F5D061] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span>{fetchError}</span>
            </div>
          </div>
        )}

        {/* Leases Display: Grid View or Table View */}
        {filteredLeases.length > 0 ? (
          viewMode === 'GRID' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredLeases.map((lease) => (
                <LeaseCard
                  key={lease.lease_id}
                  lease={lease}
                  currentUser={account}
                  onSubmitProof={(l) => setProofLease(l)}
                  onInspectDiagnostics={(l) => setDiagnosticLease(l)}
                  onOpenAppeal={(l) => setAppealLease(l)}
                  onRefresh={fetchData}
                />
              ))}
            </div>
          ) : (
            /* Table View (Executive Ledger Style) */
            <div className="rounded-2xl fintech-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#0A0B0E] text-luxury-sandDark uppercase text-[10px] tracking-wider border-b border-[#2C261C]">
                    <tr>
                      <th className="px-5 py-3.5">Order ID</th>
                      <th className="px-5 py-3.5">Hardware Cluster</th>
                      <th className="px-5 py-3.5">Escrow (GEN)</th>
                      <th className="px-5 py-3.5">Clearance Status</th>
                      <th className="px-5 py-3.5">Participants</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2C261C] text-luxury-sand">
                    {filteredLeases.map((lease) => {
                      const statusMeta = getStatusMeta(lease.status);
                      const specs = parseGpuSpecs(lease.hardware_spec);
                      const isParty = account && (lease.renter.toLowerCase() === account.toLowerCase() || lease.host.toLowerCase() === account.toLowerCase());
                      return (
                        <tr key={lease.lease_id} className="hover:bg-[#181A22] transition-colors">
                          <td className="px-5 py-3.5 font-bold text-[#F5D061] whitespace-nowrap">
                            {lease.lease_id}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-white font-sans">{specs.model}</div>
                            <div className="text-[11px] text-luxury-sandDark">{specs.vram} • {specs.tflops}</div>
                          </td>
                          <td className="px-5 py-3.5 text-[#F5D061] font-bold whitespace-nowrap">
                            {formatGen(lease.escrow_amount)}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-medium border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.borderColor}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`}></span>
                              <span>{statusMeta.label}</span>
                            </span>
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-luxury-sandDark text-[11px]">
                            <div>Renter: {shortenAddress(lease.renter)}</div>
                            <div>Host: {shortenAddress(lease.host)}</div>
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              {lease.status === 0 && (
                                lease.renter.toLowerCase() === account?.toLowerCase() ? (
                                  <span className="text-[11px] text-amber-400/80 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                    Your Order
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setProofLease(lease)}
                                    className="btn-gold px-3 py-1 rounded-lg text-xs"
                                  >
                                    Claim & Submit
                                  </button>
                                )
                              )}
                              {lease.status === 1 && (
                                <button
                                  onClick={() => setDiagnosticLease(lease)}
                                  className="px-3 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-[#D99B26] hover:to-[#F5D061] text-black font-bold text-xs"
                                >
                                  Audit SLA
                                </button>
                              )}
                              {lease.status === 7 && (
                                <>
                                  <button
                                    onClick={async () => {
                                      try {
                                        await executeContractWrite('finalize_settlement', [lease.lease_id]);
                                        fetchData();
                                      } catch (e: any) {
                                        console.error('Table Finalize Error:', e);
                                        alert(e?.message || 'Cannot finalize settlement yet. Cooling-off window (5 min) is still active.');
                                      }
                                    }}
                                    className="btn-gold px-2.5 py-1 rounded-lg text-xs"
                                  >
                                    Finalize
                                  </button>
                                  {isParty && (
                                    <button
                                      onClick={() => setAppealLease(lease)}
                                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs"
                                    >
                                      Appeal
                                    </button>
                                  )}
                                </>
                              )}
                              {lease.status === 6 && (
                                <button
                                  onClick={() => setDiagnosticLease(lease)}
                                  className="px-2.5 py-1 rounded-lg bg-red-500/20 text-red-300 border border-red-500/40 text-xs font-bold"
                                >
                                  In Court
                                </button>
                              )}
                              <button
                                onClick={() => setDiagnosticLease(lease)}
                                className="px-3 py-1 rounded-lg bg-[#0A0B0E] hover:bg-[#1E202B] text-luxury-sand border border-[#2C261C] hover:border-[#F5D061]/50 text-xs transition-colors"
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
          /* Clean Executive Empty State */
          <div className="p-16 rounded-2xl fintech-card text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-[#F5D061]/10 border border-[#F5D061]/30 text-[#F5D061] flex items-center justify-center mb-4 shadow-gold-sm">
              <Server className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1 font-sans">
              {activeTab === 'MY_RENTER' || activeTab === 'MY_HOST'
                ? 'No Associated Compute Orders in Current Wallet'
                : 'Genesis Compute Treasury — 0 Leases Recorded'}
            </h3>
            <p className="text-xs text-luxury-sandDark max-w-md mb-6 font-sans leading-relaxed">
              {activeTab === 'MY_RENTER' || activeTab === 'MY_HOST'
                ? `Treasury account ${shortenAddress(account || '')} does not have any active compute orders in this portfolio.`
                : 'The deployed contract on Studionet is active and waiting for its first compute lease order. Deploy an order to lock GEN escrow and initiate decentralized hardware SLA verification!'}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="btn-gold flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold tracking-wide shadow-gold-sm"
            >
              <Coins className="w-4 h-4" />
              <span>Deploy First Compute Order</span>
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-[#2C261C] bg-[#0A0B0E] py-6 text-xs font-sans text-luxury-sandDark mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#F5D061]" />
            <span className="text-white font-semibold">AgentLease</span>
            <span>• Autonomous AI Hardware SLA & Hashrate Treasury on GenLayer</span>
          </div>
          <div className="flex items-center gap-4 text-luxury-sandDark font-mono text-[11px]">
            <span>Studionet (61999)</span>
            <span>•</span>
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#F5D061] hover:underline"
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
              GitHub Source
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

      {appealLease && (
        <AppealModal
          isOpen={Boolean(appealLease)}
          lease={appealLease}
          onClose={() => setAppealLease(null)}
          onSuccess={fetchData}
        />
      )}

    </div>
  );
};

export default App;
