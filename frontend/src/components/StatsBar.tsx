import React from 'react';
import { Lock, CheckCircle2, Activity, Zap, ShieldCheck } from 'lucide-react';
import { ClusterStats, formatGen } from '../utils/helpers';

interface StatsBarProps {
  stats: ClusterStats;
  activeCount: number;
  contractVaultBal: string;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, activeCount, contractVaultBal }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* 1. Total Compute Escrow Locked */}
      <div className="p-5 rounded-xl bg-gray-900/90 border border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase text-gray-400">Total Escrow Locked</span>
          <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Lock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-white tracking-tight">
          {formatGen(stats.total_compute_locked)}
        </div>
        <div className="text-[11px] text-gray-400 font-mono mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          <span>Contract Vault: {formatGen(contractVaultBal)}</span>
        </div>
      </div>

      {/* 2. Leases Settled */}
      <div className="p-5 rounded-xl bg-gray-900/90 border border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase text-gray-400">SLA Settlements</span>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
          {stats.total_leases_settled}
        </div>
        <div className="text-[11px] text-gray-400 font-mono mt-1.5 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero-chargeback host payouts</span>
        </div>
      </div>

      {/* 3. Active GPU Leases */}
      <div className="p-5 rounded-xl bg-gray-900/90 border border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase text-gray-400">Active Compute Leases</span>
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
          {activeCount} <span className="text-xs text-gray-400 font-normal">/ {stats.total_leases} total</span>
        </div>
        <div className="text-[11px] text-gray-400 font-mono mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span>Open for claim or in verification</span>
        </div>
      </div>

      {/* 4. Subjective AI Consensus Engine */}
      <div className="p-5 rounded-xl bg-gray-900/90 border border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase text-gray-400">AI Consensus SLA</span>
          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold font-mono text-purple-300 flex items-center gap-2 tracking-tight">
          <span>gl.nondet</span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
            AI Jury
          </span>
        </div>
        <div className="text-[11px] text-gray-400 font-mono mt-1.5 flex items-center gap-1.5">
          <span>Direct web rendering & benchmark audit</span>
        </div>
      </div>

    </div>
  );
};
