import React from 'react';
import { Lock, CheckCircle2, Activity, Zap, Cpu } from 'lucide-react';
import { ClusterStats, formatGen } from '../utils/helpers';

interface StatsBarProps {
  stats: ClusterStats;
  activeCount: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({ stats, activeCount }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      
      {/* Total Compute Locked */}
      <div className="p-4 rounded-xl bg-[#15222E] border border-[#2A3B4D] hover:border-cyan-500/40 transition-all shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase text-slate-400">Compute Escrow Locked</span>
          <div className="p-1.5 rounded-md bg-cyan-950/80 border border-cyan-800 text-cyan-400">
            <Lock className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-cyan-300">
          {formatGen(stats.total_compute_locked)}
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
          Guaranteed via GenVM Intelligent Escrow
        </div>
      </div>

      {/* Leases Settled */}
      <div className="p-4 rounded-xl bg-[#15222E] border border-[#2A3B4D] hover:border-emerald-500/40 transition-all shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase text-slate-400">SLA Leases Settled</span>
          <div className="p-1.5 rounded-md bg-emerald-950/80 border border-emerald-800 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-emerald-400">
          {stats.total_leases_settled}
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          Automatic payout on hardware verification
        </div>
      </div>

      {/* Active In-Flight Audits */}
      <div className="p-4 rounded-xl bg-[#15222E] border border-[#2A3B4D] hover:border-amber-500/40 transition-all shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase text-slate-400">Active Compute Leases</span>
          <div className="p-1.5 rounded-md bg-amber-950/80 border border-amber-800 text-amber-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-amber-300">
          {activeCount} <span className="text-xs text-slate-400 font-normal">/ {stats.total_leases} total</span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
          Pending claim or in jury evaluation
        </div>
      </div>

      {/* AI Jury Consensus */}
      <div className="p-4 rounded-xl bg-[#15222E] border border-[#2A3B4D] hover:border-purple-500/40 transition-all shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono uppercase text-slate-400">Subjective Consensus</span>
          <div className="p-1.5 rounded-md bg-purple-950/80 border border-purple-800 text-purple-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl font-bold font-mono text-purple-300 flex items-center gap-2">
          <span>gl.nondet</span>
          <span className="text-xs px-2 py-0.5 rounded bg-purple-900/60 border border-purple-700 text-purple-200">
            AI Jury
          </span>
        </div>
        <div className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          Direct web log rendering & semantic checks
        </div>
      </div>

    </div>
  );
};
