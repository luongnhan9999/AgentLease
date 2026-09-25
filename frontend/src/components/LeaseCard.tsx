import React, { useState } from 'react';
import { HardDrive, AlertTriangle, ShieldCheck, Zap, ArrowRight, RotateCcw, Loader2, Gauge, Microchip } from 'lucide-react';
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
    <div className="rounded-xl bg-gray-900 border border-gray-800 p-5 hover:border-gray-700 transition-all flex flex-col justify-between shadow-sm">
      
      {/* Top Header: Instance ID & Status Badge */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-gray-200 bg-gray-800/80 px-2.5 py-1 rounded border border-gray-700">
              {lease.lease_id}
            </span>
          </div>
          
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.borderColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotColor}`}></span>
            <span>{statusMeta.label}</span>
          </div>
        </div>

        {/* GPU Model & Price Title (RunPod Style) */}
        <div className="mb-3">
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <Microchip className="w-4 h-4 text-blue-400" />
              <span>{parsedSpecs.model}</span>
            </h4>
            <div className="text-sm font-bold font-mono text-blue-400">
              {formatGen(lease.escrow_amount)}
            </div>
          </div>
        </div>

        {/* Spec Badges Grid */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
            VRAM: <span className="text-white font-medium">{parsedSpecs.vram}</span>
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
            SLA: <span className="text-emerald-400 font-medium">{parsedSpecs.tflops}</span>
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
            Memory: <span className="text-gray-200 font-medium">{parsedSpecs.memoryType}</span>
          </span>
        </div>

        {/* Full Spec Note */}
        <div className="p-3 rounded-lg bg-gray-950 border border-gray-800/80 mb-3 text-xs text-gray-400 font-mono line-clamp-2 leading-relaxed">
          {lease.hardware_spec}
        </div>

        {/* Diagnostic Snapshot (if adjudicated) */}
        {lease.verdict !== 'PENDING' && (
          <div className={`p-2.5 rounded-lg border mb-3 text-xs font-mono flex items-center justify-between ${
            lease.verdict === 'HARDWARE_VERIFIED'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-red-950/40 border-red-800 text-red-300'
          }`}>
            <div className="flex items-center gap-1.5">
              {lease.verdict === 'HARDWARE_VERIFIED' ? (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              <span className="font-semibold">{lease.verdict}</span>
            </div>
            <div className="text-[11px]">
              Compliance: <span className="font-bold">{lease.performance_score}/100</span>
            </div>
          </div>
        )}

        {/* Metadata Details */}
        <div className="space-y-1.5 text-xs font-mono text-gray-400 mb-4 pt-1 border-t border-gray-800/60">
          <div className="flex justify-between items-center">
            <span>Renter:</span>
            <span className="text-gray-300 bg-gray-800/60 px-2 py-0.5 rounded text-[11px]">
              {shortenAddress(lease.renter)} {isRenter ? '(You)' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span>Host Provider:</span>
            <span className="text-gray-300 bg-gray-800/60 px-2 py-0.5 rounded text-[11px]">
              {shortenAddress(lease.host)} {isHost ? '(You)' : ''}
            </span>
          </div>
          {lease.benchmark_log_url && (
            <div className="flex justify-between items-center">
              <span>Proof URL:</span>
              <span className="text-blue-400 truncate max-w-[160px] text-right underline">
                {lease.benchmark_log_url.replace('https://', '')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Error Notice */}
      {actionError && (
        <div className="p-2 rounded bg-red-950/80 border border-red-800 text-red-300 text-[11px] font-mono mb-3">
          {actionError}
        </div>
      )}

      {/* Card Action Buttons */}
      <div className="pt-3 border-t border-gray-800 flex items-center justify-between gap-2">
        
        {/* Status 0: OPEN - Host can claim & submit proof */}
        {lease.status === 0 && (
          <>
            <button
              onClick={() => onSubmitProof(lease)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-sm transition-colors"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>Claim & Submit Proof</span>
            </button>
            {isRenter && (
              <button
                onClick={handleReclaim}
                disabled={isReclaiming}
                title="Cancel & Reclaim Escrow if expired"
                className="p-2 rounded-lg bg-gray-800 hover:bg-red-950 text-gray-400 hover:text-red-400 border border-gray-700 transition-colors"
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
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-sans text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isAdjudicating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI Jury Auditing...</span>
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
              className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
              title="Inspect Telemetry"
            >
              <Gauge className="w-4 h-4 text-blue-400" />
            </button>
          </div>
        )}

        {/* Status 2, 3, 4: Adjudicated / Settled / Cancelled */}
        {(lease.status === 2 || lease.status === 3 || lease.status === 4) && (
          <button
            onClick={() => onInspectDiagnostics(lease)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-750 text-gray-200 border border-gray-700 hover:border-gray-600 font-sans text-xs font-medium transition-colors"
          >
            <span>View Hardware Diagnostics</span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}

      </div>

    </div>
  );
};
