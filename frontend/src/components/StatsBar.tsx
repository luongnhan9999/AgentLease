import React from 'react';
import { Lock, CheckCircle2, Activity, Zap, Cpu, ShieldCheck } from 'lucide-react';
import { ClusterStats, formatGen } from '../utils/helpers';

interface StatsBarProps {
  stats: ClusterStats;
  activeCount: number;
  contractVaultBal: string;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, activeCount, contractVaultBal }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      
      {/* 1. Total Compute Escrow Locked */}
      <div className="p-5 rounded-2xl quantum-glass relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#00F0FF]/10 rounded-full blur-2xl pointer-events-none group-hover:bg-[#00F0FF]/20 transition-all"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-obsidian-400">Total Compute Escrow</span>
          <div className="p-2 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] shadow-quantum-cyan">
            <Lock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-white tracking-tight">
          {formatGen(stats.total_compute_locked)}
        </div>
        <div className="text-[11px] text-obsidian-400 font-mono mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse"></span>
          <span>Vault: {formatGen(contractVaultBal)}</span>
        </div>
      </div>

      {/* 2. Leases Settled */}
      <div className="p-5 rounded-2xl quantum-glass relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-all"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-obsidian-400">Verified SLA Settlements</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-quantum-emerald">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
          {stats.total_leases_settled}
        </div>
        <div className="text-[11px] text-obsidian-400 font-mono mt-1.5 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero-chargeback hardware payout</span>
        </div>
      </div>

      {/* 3. Active Compute In-Flight */}
      <div className="p-5 rounded-2xl quantum-glass relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-all"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-obsidian-400">Active Compute Leases</span>
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
          {activeCount} <span className="text-xs text-obsidian-400 font-normal">/ {stats.total_leases} Total</span>
        </div>
        <div className="text-[11px] text-obsidian-400 font-mono mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
          <span>Awaiting host or in AI jury audit</span>
        </div>
      </div>

      {/* 4. Subjective AI Consensus Engine */}
      <div className="p-5 rounded-2xl quantum-glass relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/20 transition-all"></div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase tracking-wider text-obsidian-400">Subjective Consensus</span>
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 shadow-quantum-violet">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold font-mono text-indigo-300 flex items-center gap-2 tracking-tight">
          <span>gl.nondet</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/80 text-indigo-200">
            AI Jury
          </span>
        </div>
        <div className="text-[11px] text-obsidian-400 font-mono mt-1.5 flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-indigo-400" />
          <span>Live web rendering & benchmark audit</span>
        </div>
      </div>

    </div>
  );
};
