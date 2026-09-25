import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { LeaseCard } from './components/LeaseCard';
import { CreateLease } from './components/CreateLease';
import { SubmitProof } from './components/SubmitProof';
import { DiagnosticInspectorModal } from './components/DiagnosticInspectorModal';
import { Plus, Search, Server, Terminal } from 'lucide-react';
import { LeaseOrderData, ClusterStats } from './utils/helpers';
import {
  callContractView,
  switchToStudioNet,
  getContractAddress,
} from './config/genlayer';

export const App: React.FC = () => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [chainId, setChainId] = useState<number | null>(null);

  const [stats, setStats] = useState<ClusterStats>({
    total_leases: 0,
    total_compute_locked: '0',
    total_leases_settled: 0,
  });

  const [leases, setLeases] = useState<LeaseOrderData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [proofLease, setProofLease] = useState<LeaseOrderData | null>(null);
  const [diagnosticLease, setDiagnosticLease] = useState<LeaseOrderData | null>(null);

  // Fallback demo data to showcase HPC cluster if contract has 0 leases yet
  const fallbackSampleLeases: LeaseOrderData[] = [
    {
      lease_id: 'lease-101',
      renter: '0x32890Ac4B4Fa2bEb35b91C8AfD982F81c47E99A0',
      host: '0x81b7e08f65bdf5648606c89998da2210b5034a24',
      escrow_amount: '5000000000000000000',
      hardware_spec: 'NVIDIA H100 80GB SXM5, min 80GB HBM3, >950 TFLOPS FP16 throughput, NVLink enabled',
      benchmark_log_url: 'https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt',
      status: 2, // SETTLED_PAID
      verdict: 'HARDWARE_VERIFIED',
      reason: 'AI Jury verified NVIDIA H100 80GB SXM5. Device ID matches authentic vendor signatures, 81920 MiB VRAM confirmed, GEMM FP16 peak at 989.4 TFLOPS satisfies SLA criteria.',
      confidence: 98,
      performance_score: 96,
      created_at_block: '1240',
      expires_at_block: '6240',
    },
    {
      lease_id: 'lease-102',
      renter: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
      host: '0x14dC79964da2C08b23698B3D3cc7Ca32193d9955',
      escrow_amount: '2000000000000000000',
      hardware_spec: 'NVIDIA A100-SXM4-80GB, 80GB VRAM required for DeepSeek LLM inference',
      benchmark_log_url: 'https://raw.githubusercontent.com/yeou/public-logs/main/gtx1060_fraud_benchmark.txt',
      status: 3, // FRAUD_REFUNDED
      verdict: 'HARDWARE_FRAUDULENT',
      reason: 'CRITICAL HARDWARE FRAUD DETECTED: Host submitted logs from an NVIDIA GeForce GTX 1060 (6GB VRAM) claiming to be an A100 80GB. Severe memory deficiency & thermal throttling.',
      confidence: 100,
      performance_score: 12,
      created_at_block: '1290',
      expires_at_block: '4290',
    },
    {
      lease_id: 'lease-103',
      renter: '0x976EA74026E72CD55542b2494B62d5563914a1aB',
      host: '0x0000000000000000000000000000000000000000',
      escrow_amount: '3500000000000000000',
      hardware_spec: '8x NVIDIA GeForce RTX 4090 24GB, total 192GB VRAM, CUDA 12.2, min 660 TFLOPS',
      benchmark_log_url: '',
      status: 0, // OPEN
      verdict: 'PENDING',
      reason: 'Lease order open. Awaiting GPU host benchmark proof submission.',
      confidence: 0,
      performance_score: 0,
      created_at_block: '1410',
      expires_at_block: '4410',
    },
  ];

  // Fetch On-Chain Leases and Stats
  const fetchData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch Stats
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
      } catch (statsErr) {
        console.warn('Could not read contract get_stats:', statsErr);
      }

      // 2. Fetch Leases Paginated
      try {
        const rawLeases = await callContractView('get_leases_paginated', [0, 50]);
        if (rawLeases) {
          const list: LeaseOrderData[] = typeof rawLeases === 'string' ? JSON.parse(rawLeases) : rawLeases;
          if (Array.isArray(list) && list.length > 0) {
            setLeases(list);
          } else {
            // If contract is brand new and empty, show sample showcase leases
            setLeases(fallbackSampleLeases);
            setStats({
              total_leases: 3,
              total_compute_locked: '3500000000000000000',
              total_leases_settled: 1,
            });
          }
        } else {
          setLeases(fallbackSampleLeases);
        }
      } catch (leaseErr) {
        console.warn('Could not read contract get_leases_paginated:', leaseErr);
        setLeases(fallbackSampleLeases);
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
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [updateWalletState, fetchData]);

  // Filtered and Searched Leases
  const filteredLeases = leases.filter((l) => {
    // Status filter
    if (statusFilter === 'OPEN' && l.status !== 0) return false;
    if (statusFilter === 'IN_AUDIT' && l.status !== 1) return false;
    if (statusFilter === 'SETTLED' && l.status !== 2) return false;
    if (statusFilter === 'FRAUD' && l.status !== 3) return false;

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
    <div className="min-h-screen bg-[#0B131A] text-slate-100 flex flex-col font-sans">
      
      {/* Navigation Bar */}
      <Navbar
        account={account}
        balance={balance}
        chainId={chainId}
        onConnectWallet={handleConnectWallet}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Hero Section */}
        <div className="mb-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-r from-[#121E2A] via-[#15222E] to-[#101C27] border border-[#2A3B4D] relative overflow-hidden shadow-xl">
          <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-3xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-800 text-cyan-300 text-xs font-mono mb-3">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span>GenLayer Subjective Consensus • DePIN AI Hardware Escrow</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3 font-mono">
              Autonomous AI Compute <span className="text-[#38BDF8]">SLA Escrow</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-sans mb-6">
              Empowering autonomous AI agents and model trainers to rent high-performance GPU nodes 
              (H100, A100, RTX 4090) with zero risk of hardware spoofing or VRAM throttling. 
              GenLayer intelligent contracts verify live benchmark logs directly on-chain before releasing escrowed funds.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setIsCreateOpen(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-mono text-sm font-semibold shadow-hpc-glow transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Compute Lease Order</span>
              </button>
              
              <div className="text-xs font-mono text-slate-400 bg-[#0B131A] px-3 py-2 rounded-xl border border-[#2A3B4D] flex items-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>Target Contract:</span>
                <span className="text-slate-300 font-semibold truncate max-w-[140px] sm:max-w-[200px]">
                  {getContractAddress()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Aggregated Cluster Telemetry Stats */}
        <StatsBar stats={stats} activeCount={activeCount} />

        {/* Control Bar: Search & Filter Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6">
          
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#15222E] border border-[#2A3B4D] overflow-x-auto text-xs font-mono">
            {[
              { id: 'ALL', label: 'All Modules' },
              { id: 'OPEN', label: 'Open for Host' },
              { id: 'IN_AUDIT', label: 'In AI Audit' },
              { id: 'SETTLED', label: 'Verified & Paid' },
              { id: 'FRAUD', label: 'Fraud / Refunded' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                  statusFilter === tab.id
                    ? 'bg-cyan-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#0B131A]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, GPU, or Address..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#15222E] border border-[#2A3B4D] text-white text-xs font-mono placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

        </div>

        {/* Leases Grid */}
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
          <div className="p-12 rounded-2xl bg-[#15222E] border border-[#2A3B4D] text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-cyan-950/60 border border-cyan-800 text-cyan-400 flex items-center justify-center mb-3">
              <Server className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-200 font-mono mb-1">No Compute Orders Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mb-4 font-mono">
              There are no hardware leases matching your filter criteria. Be the first to create one!
            </p>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-semibold"
            >
              Create Compute Order
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A3B4D] bg-[#0E1721] py-6 text-xs font-mono text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-bold">AgentLease</span>
            <span>• Built for Agent Tank Hackathon (DePIN & Agentic Economy)</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>GenLayer StudioNet (Chain ID: 61999)</span>
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-cyan-400 underline"
            >
              Studio IDE
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
