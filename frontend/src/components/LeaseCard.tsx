import React, { useState } from 'react';
import { HardDrive, CheckCircle2, AlertTriangle, ShieldCheck, Zap, ArrowRight, RotateCcw, Loader2, Gauge, Microchip } from 'lucide-react';
import { LeaseOrderData, formatGen, shortenAddress, getStatusMeta, parseGpuSpecs } from '../utils/helpers';
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
  const parsedSpecs = parseGpuSpecs(lease.hardware_spec);
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
    <div className={`relative rounded-2xl quantum-glass border ${statusMeta.borderColor} p-6 flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 ${statusMeta.glowClass}`}>
      
      {/* Top Header: Slot ID & Status */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${statusMeta.indicatorColor} group-hover:scale-125 transition-transform duration-300`}></span>
            <span className="font-mono text-xs font-bold text-white bg-[#04070D] px-3 py-1 rounded-xl border border-[#223456]">
              {lease.lease_id}
            </span>
          </div>
          
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.borderColor}`}>
            {lease.status === 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] animate-pulse"></span>}
            {lease.status === 1 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>}
            {lease.status === 2 && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
            {lease.status === 3 && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
            <span>{statusMeta.label}</span>
          </div>
        </div>

        {/* Hardware Spec Visualizer Card */}
        <div className="p-4 rounded-xl bg-[#04070D] border border-[#223456] mb-4">
          <div className="flex items-center justify-between text-[11px] font-mono mb-2">
            <span className="flex items-center gap-1.5 text-obsidian-400 uppercase tracking-wider">
              <Microchip className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span className="font-bold text-white">{parsedSpecs.model}</span>
            </span>
            <span className="text-[#00F0FF] font-bold text-sm">{formatGen(lease.escrow_amount)}</span>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#0C1425] text-obsidian-300 border border-[#192642]">
              VRAM: <span className="text-[#00F0FF] font-semibold">{parsedSpecs.vram}</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[#0C1425] text-obsidian-300 border border-[#192642]">
              SLA: <span className="text-emerald-400 font-semibold">{parsedSpecs.tflops}</span>
            </span>
          </div>

          <p className="text-xs text-obsidian-400 font-mono leading-relaxed line-clamp-2">
            {lease.hardware_spec}
          </p>
        </div>

        {/* Diagnostic Verdict Snapshot (if adjudicated) */}
        {lease.verdict !== 'PENDING' && (
          <div className={`p-3 rounded-xl border mb-4 text-xs font-mono flex items-center justify-between ${
            lease.verdict === 'HARDWARE_VERIFIED'
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-quantum-emerald'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-300 shadow-quantum-rose'
          }`}>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span className="font-bold">{lease.verdict}</span>
            </div>
            <div className="text-[11px]">
              Compliance: <span className="font-bold">{lease.performance_score}/100</span>
            </div>
          </div>
        )}

        {/* Metadata Details Grid */}
        <div className="space-y-2 text-xs font-mono text-obsidian-400 mb-5 pt-1">
          <div className="flex justify-between items-center">
            <span>Renter:</span>
            <span className="text-slate-200 bg-[#04070D] px-2.5 py-0.5 rounded-lg border border-[#192642]">
              {shortenAddress(lease.renter)} {isRenter ? '(You)' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Host Node:</span>
            <span className="text-slate-200 bg-[#04070D] px-2.5 py-0.5 rounded-lg border border-[#192642]">
              {shortenAddress(lease.host)} {isHost ? '(You)' : ''}
            </span>
          </div>
          {lease.benchmark_log_url && (
            <div className="flex justify-between items-center">
              <span>Benchmark Log:</span>
              <span className="text-[#00F0FF] truncate max-w-[170px] text-right underline">
                {lease.benchmark_log_url.replace('https://', '')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {actionError && (
        <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-[11px] font-mono mb-3">
          {actionError}
        </div>
      )}

      {/* Card Action Footer */}
      <div className="pt-3 border-t border-[#223456] flex flex-wrap items-center justify-between gap-2">
        
        {/* Status 0: OPEN - Host can claim & submit proof */}
        {lease.status === 0 && (
          <>
            <button
              onClick={() => onSubmitProof(lease)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-mono text-xs font-bold shadow-quantum-emerald transition-all"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Claim & Submit Proof</span>
            </button>
            {isRenter && (
              <button
                onClick={handleReclaim}
                disabled={isReclaiming}
                title="Cancel & Reclaim Escrow if expired"
                className="p-2.5 rounded-xl bg-[#04070D] hover:bg-rose-950/80 text-obsidian-400 hover:text-rose-400 border border-[#223456] transition-colors"
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-mono text-xs font-bold shadow-quantum-violet transition-all disabled:opacity-50"
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
              className="p-2.5 rounded-xl bg-[#04070D] hover:bg-[#121D33] text-slate-300 border border-[#223456] transition-colors"
              title="Inspect Telemetry"
            >
              <Gauge className="w-4 h-4 text-[#00F0FF]" />
            </button>
          </div>
        )}

        {/* Status 2, 3, 4: Adjudicated / Settled / Cancelled */}
        {(lease.status === 2 || lease.status === 3 || lease.status === 4) && (
          <button
            onClick={() => onInspectDiagnostics(lease)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#04070D] hover:bg-[#121D33] text-[#00F0FF] border border-[#223456] hover:border-[#00F0FF]/50 font-mono text-xs font-bold transition-all"
          >
            <span>View Forensic Telemetry</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

      </div>

    </div>
  );
};
