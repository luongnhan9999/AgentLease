import React, { useState } from 'react';
import { HardDrive, AlertTriangle, ShieldCheck, Zap, ArrowRight, RotateCcw, Loader2, Gauge, Microchip, Clock } from 'lucide-react';
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
    <div className="fintech-card p-6 flex flex-col justify-between hover:-translate-y-1">
      
      {/* Top Header: Instance ID & Status Badge */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-[#F5D061] bg-[#0A0B0E] px-3 py-1 rounded-lg border border-[#383226]">
              {lease.lease_id}
            </span>
            {isRenter && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                YOU ARE RENTER
              </span>
            )}
            {isHost && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                YOU ARE HOST
              </span>
            )}
          </div>
          
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.borderColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`}></span>
            <span>{statusMeta.label}</span>
          </div>
        </div>

        {/* GPU Model & Price Title */}
        <div className="mb-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Microchip className="w-4 h-4 text-[#F5D061]" />
              <span>{parsedSpecs.model}</span>
            </h4>
            <div className="text-base font-bold font-mono text-[#F5D061]">
              {formatGen(lease.escrow_amount)}
            </div>
          </div>
        </div>

        {/* Spec Badges Grid */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-[#1C1E26] text-luxury-sand border border-[#383226]">
            VRAM: <span className="text-[#F5D061] font-bold">{parsedSpecs.vram}</span>
          </span>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-[#1C1E26] text-luxury-sand border border-[#383226]">
            SLA: <span className="text-emerald-400 font-bold">{parsedSpecs.tflops}</span>
          </span>
          <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-[#1C1E26] text-luxury-sand border border-[#383226]">
            Type: <span className="text-white font-medium">{parsedSpecs.memoryType}</span>
          </span>
        </div>

        {/* Full Natural Language SLA Requirement */}
        <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-[#2C261C] mb-4 text-xs text-luxury-sandDark font-mono line-clamp-2 leading-relaxed">
          {lease.hardware_spec}
        </div>

        {/* Diagnostic Snapshot (if adjudicated) */}
        {lease.verdict !== 'PENDING' && (
          <div className={`p-3 rounded-xl border mb-4 text-xs font-mono flex items-center justify-between ${
            lease.verdict === 'HARDWARE_VERIFIED'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-rose-950/40 border-rose-800 text-rose-300'
          }`}>
            <div className="flex items-center gap-2">
              {lease.verdict === 'HARDWARE_VERIFIED' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              )}
              <span className="font-bold">{lease.verdict}</span>
            </div>
            <div className="text-[11px]">
              Compliance: <span className="font-bold text-white">{lease.performance_score}/100</span>
            </div>
          </div>
        )}

        {/* Metadata Details */}
        <div className="space-y-2 text-xs font-mono text-luxury-sandDark mb-5 pt-1 border-t border-[#2C261C]">
          <div className="flex justify-between items-center">
            <span>Renter:</span>
            <span className="text-luxury-sand bg-[#0A0B0E] px-2 py-0.5 rounded text-[11px] border border-[#2C261C]">
              {shortenAddress(lease.renter)} {isRenter ? '(You)' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Host Provider:</span>
            <span className="text-luxury-sand bg-[#0A0B0E] px-2 py-0.5 rounded text-[11px] border border-[#2C261C]">
              {shortenAddress(lease.host)} {isHost ? '(You)' : ''}
            </span>
          </div>
          {lease.benchmark_log_url && (
            <div className="flex justify-between items-center">
              <span>Proof URL:</span>
              <span className="text-[#F5D061] truncate max-w-[170px] text-right underline">
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

      {/* Card Action Buttons */}
      <div className="pt-3 border-t border-[#2C261C] flex items-center justify-between gap-2.5">
        
        {/* Status 0: OPEN - Host can claim & submit proof */}
        {lease.status === 0 && (
          <>
            {isRenter ? (
              <div className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#0A0B0E] text-luxury-sandDark text-xs font-mono border border-[#2C261C]">
                <Clock className="w-3.5 h-3.5 text-[#F5D061] animate-pulse" />
                <span>Awaiting GPU Host Claim</span>
              </div>
            ) : (
              <button
                onClick={() => onSubmitProof(lease)}
                className="btn-gold flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-sans tracking-wide"
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Claim & Submit Proof</span>
              </button>
            )}
            {isRenter && (
              <button
                onClick={handleReclaim}
                disabled={isReclaiming}
                title="Cancel & Reclaim Escrow if expired"
                className="p-2.5 rounded-xl bg-[#0A0B0E] hover:bg-rose-950 text-luxury-sandDark hover:text-rose-400 border border-[#2C261C] transition-colors"
              >
                {isReclaiming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
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
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 via-yellow-600 to-[#D99B26] hover:from-amber-500 hover:to-[#F5D061] text-black font-sans text-xs font-bold shadow-gold-sm transition-all disabled:opacity-50"
            >
              {isAdjudicating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI Jury Deliberating...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Audit Hardware SLA</span>
                </>
              )}
            </button>
            <button
              onClick={() => onInspectDiagnostics(lease)}
              className="p-2.5 rounded-xl bg-[#0A0B0E] hover:bg-[#1C1E26] text-[#F5D061] border border-[#2C261C] transition-colors"
              title="Inspect Forensic Telemetry"
            >
              <Gauge className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Status 2, 3, 4: Adjudicated / Settled / Cancelled */}
        {(lease.status === 2 || lease.status === 3 || lease.status === 4) && (
          <button
            onClick={() => onInspectDiagnostics(lease)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0A0B0E] hover:bg-[#1C1E26] text-[#F5D061] border border-[#2C261C] hover:border-[#F5D061]/50 font-sans text-xs font-bold transition-all"
          >
            <span>View Forensic Diagnostics</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#F5D061]" />
          </button>
        )}

      </div>

    </div>
  );
};
