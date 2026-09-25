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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      
      {/* 1. Total Compute Escrow Locked */}
      <div className="fintech-card p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase text-luxury-sandDark tracking-wider">Treasury Escrow Locked</span>
          <div className="p-2 rounded-xl bg-[#F5D061]/10 text-[#F5D061] border border-[#F5D061]/30 shadow-gold-sm">
            <Lock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-[#F5D061] tracking-tight">
          {formatGen(stats.total_compute_locked)}
        </div>
        <div className="text-[11px] text-luxury-sandDark font-mono mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F5D061] animate-pulse"></span>
          <span>Vault Reserve: {formatGen(contractVaultBal)}</span>
        </div>
      </div>

      {/* 2. Leases Settled */}
      <div className="fintech-card p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase text-luxury-sandDark tracking-wider">Certified SLA Payouts</span>
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
          {stats.total_leases_settled}
        </div>
        <div className="text-[11px] text-luxury-sandDark font-mono mt-1.5 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Zero-chargeback sovereign settlement</span>
        </div>
      </div>

      {/* 3. Active Compute Leases */}
      <div className="fintech-card p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase text-luxury-sandDark tracking-wider">Active Compute Orders</span>
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-amber-300 tracking-tight">
          {activeCount} <span className="text-xs text-luxury-sandDark font-normal">/ {stats.total_leases} Total</span>
        </div>
        <div className="text-[11px] text-luxury-sandDark font-mono mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
          <span>Awaiting proof or in AI consensus audit</span>
        </div>
      </div>

      {/* 4. Subjective AI Consensus Engine */}
      <div className="fintech-card p-5 relative overflow-hidden group">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-mono uppercase text-luxury-sandDark tracking-wider">Subjective Consensus</span>
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="text-xl font-bold font-mono text-purple-300 flex items-center gap-2 tracking-tight">
          <span>gl.nondet</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950 text-purple-200 border border-purple-800">
            AI Jury
          </span>
        </div>
        <div className="text-[11px] text-luxury-sandDark font-mono mt-1.5 flex items-center gap-1.5">
          <span>Direct web rendering & benchmark audit</span>
        </div>
      </div>

    </div>
  );
};
