import React, { useState } from 'react';
import { Cpu, Server, HardDrive, CheckCircle2, AlertTriangle, ShieldCheck, Zap, ArrowRight, RotateCcw, Loader2 } from 'lucide-react';
import { LeaseOrderData, formatGen, shortenAddress, getStatusMeta } from '../utils/helpers';
import { executeContractWrite } from '../config/genlayer';

interface LeaseCardProps {
  lease: LeaseOrderData;
  currentUser: string | null;
  onSubmitProof: (lease: LeaseOrderData) => void;
  onInspectDiagnostics: (lease: LeaseOrderData) => void;
  onRefresh: () => void;
}

export const LeaseCard: React.FC<LeaseCardProps> = ({
  lease,
  currentUser,
  onSubmitProof,
  onInspectDiagnostics,
  onRefresh,
}) => {
  const [isAdjudicating, setIsAdjudicating] = useState(false);
  const [isReclaiming, setIsReclaiming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const statusMeta = getStatusMeta(lease.status);
  const isRenter = currentUser && lease.renter.toLowerCase() === currentUser.toLowerCase();
  const isHost = currentUser && lease.host.toLowerCase() === currentUser.toLowerCase();

  const handleAdjudicate = async () => {
    setActionError(null);
    try {
      setIsAdjudicating(true);
      await executeContractWrite('adjudicate_hardware', [lease.lease_id]);
      onRefresh();
    } catch (err: any) {
      console.error('Adjudicate error:', err);
      setActionError(err.message || 'Adjudication failed');
    } finally {
      setIsAdjudicating(false);
    }
  };

  const handleReclaim = async () => {
    setActionError(null);
    try {
      setIsReclaiming(true);
      await executeContractWrite('cancel_or_reclaim', [lease.lease_id]);
      onRefresh();
    } catch (err: any) {
      console.error('Reclaim error:', err);
      setActionError(err.message || 'Cannot reclaim lease yet. Check expiration or audit block.');
    } finally {
      setIsReclaiming(false);
    }
  };

  return (
    <div className={`relative rounded-xl bg-[#15222E] border ${statusMeta.borderColor} p-5 hover:border-cyan-500/60 transition-all duration-200 flex flex-col justify-between shadow-md hover:shadow-hpc-glow group`}>
      
      {/* Top Header: Slot ID & Status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 group-hover:animate-ping"></span>
            <span className="font-mono text-xs font-bold text-slate-200 bg-[#0B131A] px-2.5 py-1 rounded border border-[#2A3B4D]">
              {lease.lease_id}
            </span>
          </div>
          
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-medium border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.borderColor}`}>
            {lease.status === 0 && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>}
            {lease.status === 1 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>}
            {lease.status === 2 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            {lease.status === 3 && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
            <span>{statusMeta.label}</span>
          </div>
        </div>

        {/* Hardware Spec Requirements Box */}
        <div className="p-3 rounded-lg bg-[#0B131A] border border-[#2A3B4D] mb-4">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase mb-1">
            <span className="flex items-center gap-1">
              <Cpu className="w-3 h-3 text-cyan-400" />
              <span>GPU SLA Requirements</span>
            </span>
            <span className="text-cyan-300 font-semibold">{formatGen(lease.escrow_amount)}</span>
          </div>
          <p className="text-xs text-slate-200 font-mono leading-relaxed line-clamp-2">
            {lease.hardware_spec}
          </p>
        </div>

        {/* Diagnostic verdict preview (if adjudicated) */}
        {lease.verdict !== 'PENDING' && (
          <div className={`p-2.5 rounded-lg border mb-4 text-xs font-mono flex items-center justify-between ${
            lease.verdict === 'HARDWARE_VERIFIED'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold">{lease.verdict}</span>
            </div>
            <div className="text-[11px] opacity-90">
              Score: <span className="font-bold">{lease.performance_score}/100</span> ({lease.confidence}% conf)
            </div>
          </div>
        )}

        {/* Metadata Details Grid */}
        <div className="space-y-1.5 text-xs font-mono text-slate-400 mb-4 pt-1">
          <div className="flex justify-between items-center">
            <span>Renter:</span>
            <span className="text-slate-200 bg-[#0B131A] px-2 py-0.5 rounded border border-[#233342]">
              {shortenAddress(lease.renter)} {isRenter ? '(You)' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Host Node:</span>
            <span className="text-slate-200 bg-[#0B131A] px-2 py-0.5 rounded border border-[#233342]">
              {shortenAddress(lease.host)} {isHost ? '(You)' : ''}
            </span>
          </div>
          {lease.benchmark_log_url && (
            <div className="flex justify-between items-center">
              <span>Benchmark Log:</span>
              <span className="text-cyan-400 truncate max-w-[170px] text-right underline">
                {lease.benchmark_log_url.replace('https://', '')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {actionError && (
        <div className="p-2 rounded bg-rose-950/80 border border-rose-800 text-rose-300 text-[11px] font-mono mb-3">
          {actionError}
        </div>
      )}

      {/* Card Action Footer */}
      <div className="pt-3 border-t border-[#2A3B4D] flex flex-wrap items-center justify-between gap-2">
        
        {/* Status 0: OPEN - Host can claim & submit proof */}
        {lease.status === 0 && (
          <>
            <button
              onClick={() => onSubmitProof(lease)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-mono text-xs font-medium shadow-rack-glow transition-all"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Claim & Submit Proof</span>
            </button>
            {isRenter && (
              <button
                onClick={handleReclaim}
                disabled={isReclaiming}
                title="Cancel & Reclaim if expired"
                className="p-2 rounded-lg bg-[#0B131A] hover:bg-rose-950 text-slate-400 hover:text-rose-400 border border-[#2A3B4D] transition-colors"
              >
                {isReclaiming ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
              </button>
            )}
          </>
        )}

        {/* Status 1: IN_AUDIT - Trigger AI Jury Adjudication */}
        {lease.status === 1 && (
          <div className="w-full flex items-center gap-2">
            <button
              onClick={handleAdjudicate}
              disabled={isAdjudicating}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-semibold shadow-md transition-all disabled:opacity-50"
            >
              {isAdjudicating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI Jury Deliberating...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Adjudicate Hardware</span>
                </>
              )}
            </button>
            <button
              onClick={() => onInspectDiagnostics(lease)}
              className="p-2 rounded-lg bg-[#0B131A] hover:bg-[#1E2E3E] text-slate-300 border border-[#2A3B4D] transition-colors"
              title="Inspect Telemetry"
            >
              <Server className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Status 2, 3, 4: Adjudicated / Settled / Cancelled */}
        {(lease.status === 2 || lease.status === 3 || lease.status === 4) && (
          <button
            onClick={() => onInspectDiagnostics(lease)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#0B131A] hover:bg-[#192736] text-cyan-300 border border-[#2A3B4D] hover:border-cyan-500/60 font-mono text-xs font-medium transition-all"
          >
            <span>View Hardware Diagnostics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

      </div>

    </div>
  );
};
