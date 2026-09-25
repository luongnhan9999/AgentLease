import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { LeaseCard } from './components/LeaseCard';
import { CreateLease } from './components/CreateLease';
import { SubmitProof } from './components/SubmitProof';
import { DiagnosticInspectorModal } from './components/DiagnosticInspectorModal';
import { Plus, Search, Server, Terminal, Radio, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { LeaseOrderData, ClusterStats, shortenAddress } from './utils/helpers';
import {
  callContractView,
  fetchCurrentBlockNumber,
  fetchContractBalance,
  switchToStudioNet,
  getContractAddress,
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

    // Live block & telemetry poller every 8 seconds
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
    // Tab filter
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

    // Search query
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
    <div className="min-h-screen bg-[#04070D] text-slate-100 flex flex-col font-sans bg-quantum-grid relative selection:bg-[#00F0FF] selection:text-black">
      
      {/* Top Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-radial-gradient-hero pointer-events-none"></div>

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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        
        {/* Hero Section */}
        <div className="mb-8 p-6 sm:p-10 rounded-3xl quantum-glass relative overflow-hidden">
          <div className="max-w-3xl relative z-10">
            
            {/* Live Telemetry Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] text-xs font-mono mb-4 shadow-quantum-cyan">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              <span>Studionet Live • Subjective AI Consensus Hardware Escrow</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white mb-4 font-mono leading-tight">
              Autonomous AI Compute <br />
              <span className="bg-gradient-to-r from-[#00F0FF] via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                SLA & Hashrate Escrow
              </span>
            </h1>

            <p className="text-sm sm:text-base text-obsidian-300 leading-relaxed font-sans mb-6 max-w-2xl">
              Eliminate hardware spoofing and VRAM throttling in decentralized GPU clouds. 
              AI agents lock rental funds in escrow; GenLayer intelligent contracts render live benchmark logs directly on-chain 
              to verify GPU models, VRAM capacity, and TFLOPS before releasing payments.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-mono text-sm font-bold shadow-quantum-cyan transition-all hover:scale-105"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Create Compute Lease Order</span>
              </button>

              <div className="text-xs font-mono text-obsidian-400 bg-[#04070D]/80 px-4 py-3 rounded-xl border border-[#223456] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#00F0FF]" />
                <span className="text-obsidian-400">Contract:</span>
                <span className="text-[#00F0FF] font-semibold">
                  {shortenAddress(getContractAddress())}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Aggregated Telemetry Stats */}
        <StatsBar stats={stats} activeCount={activeCount} contractVaultBal={contractVaultBal} />

        {/* Control Bar: Workspace Tabs & Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 mb-6">
          
          {/* Workspace Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0C1425] border border-[#223456] overflow-x-auto text-xs font-mono">
            {[
              { id: 'ALL', label: `All Leases (${leases.length})` },
              { id: 'OPEN', label: 'Open for Host' },
              { id: 'IN_AUDIT', label: 'In AI Audit' },
              { id: 'SETTLED', label: 'Settled & Verified' },
              { id: 'MY_RENTER', label: 'My Renter Orders' },
              { id: 'MY_HOST', label: 'My Host Claims' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl whitespace-nowrap transition-all font-semibold ${
                  activeTab === tab.id
                    ? 'bg-[#00F0FF] text-black shadow-quantum-cyan font-bold'
                    : 'text-obsidian-400 hover:text-white hover:bg-[#121D33]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-obsidian-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Lease ID, GPU, or Address..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-[#0C1425] border border-[#223456] text-white text-xs font-mono placeholder-obsidian-500 focus:outline-none focus:border-[#00F0FF] transition-all"
            />
          </div>

        </div>

        {/* Error notification if direct view call had issues */}
        {fetchError && (
          <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-700/80 text-amber-200 text-xs font-mono mb-6 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">On-Chain Sync Notice:</span> {fetchError}
              <div className="mt-1 text-[11px] text-amber-300">
                You can configure the target contract address anytime using the Settings icon in the navbar.
              </div>
            </div>
          </div>
        )}

        {/* Leases Grid (Zero Mock: Displays Real On-Chain Leases) */}
        {filteredLeases.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
          <div className="p-16 rounded-3xl quantum-glass text-center flex flex-col items-center justify-center border-dashed border-[#223456]">
            <div className="w-16 h-16 rounded-2xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] flex items-center justify-center mb-4 shadow-quantum-cyan">
              <Server className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono mb-2">
              {activeTab === 'MY_RENTER' || activeTab === 'MY_HOST'
                ? 'No Associated Compute Orders in Current Wallet'
                : 'Genesis Compute State — 0 Leases on Smart Contract'}
            </h3>
            <p className="text-xs text-obsidian-400 max-w-md mb-6 font-mono leading-relaxed">
              {activeTab === 'MY_RENTER' || activeTab === 'MY_HOST'
                ? `Wallet ${shortenAddress(account || '')} has not participated in this role yet.`
                : 'The deployed contract on Studionet is active and waiting for its first compute lease order. Create an order to lock GEN and initiate decentralized AI hardware verification!'}
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#00F0FF] hover:bg-cyan-400 text-black font-mono text-xs font-bold shadow-quantum-cyan transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create First On-Chain Order</span>
            </button>
          </div>
        )}

      </main>

      {/* High-Tech Footer */}
      <footer className="border-t border-[#223456]/60 bg-[#04070D]/90 py-8 text-xs font-mono text-obsidian-400 mt-16 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00F0FF]" />
            <span className="text-white font-bold">AgentLease</span>
            <span>• DePIN AI Hardware SLA Verification Engine on GenLayer</span>
          </div>
          <div className="flex items-center gap-4 text-obsidian-400">
            <span>Studionet (61999)</span>
            <span>•</span>
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#00F0FF] hover:underline"
            >
              GenLayer Studio IDE
            </a>
            <span>•</span>
            <a
              href="https://github.com/luongnhan9999/AgentLease"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white underline"
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

    </div>
  );
};

export default App;
