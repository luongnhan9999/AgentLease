import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Cpu, Zap, ExternalLink, Terminal, Loader2, Gauge, CheckCircle2, AlertTriangle } from 'lucide-react';
import { LeaseOrderData, formatGen, shortenAddress, getStatusMeta } from '../utils/helpers';
import { executeContractWrite, STUDIONET_EXPLORER } from '../config/genlayer';

interface DiagnosticInspectorModalProps {
  isOpen: boolean;
  lease: LeaseOrderData | null;
  onClose: () => void;
  onAdjudicated: () => void;
}

export const DiagnosticInspectorModal: React.FC<DiagnosticInspectorModalProps> = ({
  isOpen,
  lease,
  onClose,
  onAdjudicated,
}) => {
  const [isAdjudicating, setIsAdjudicating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!isOpen || !lease) return null;

  const statusMeta = getStatusMeta(lease.status);
  const isVerified = lease.verdict === 'HARDWARE_VERIFIED';
  const isFraud = lease.verdict === 'HARDWARE_FRAUDULENT';
  const isAwaitingAudit = lease.status === 1;

  const handleTriggerAdjudication = async () => {
    setActionError(null);
    try {
      setIsAdjudicating(true);
      await executeContractWrite('adjudicate_hardware', [lease.lease_id]);
      onAdjudicated();
      onClose();
    } catch (err: any) {
      console.error('Adjudication error:', err);
      setActionError(err.message || 'AI Jury adjudication failed on-chain.');
    } finally {
      setIsAdjudicating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#0B0F19] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg border ${
              isVerified ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              isFraud ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-blue-500/10 border-blue-500/20 text-blue-400'
            }`}>
              {isVerified ? <ShieldCheck className="w-5 h-5" /> :
               isFraud ? <ShieldAlert className="w-5 h-5" /> :
               <Cpu className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Hardware SLA Diagnostic Telemetry</span>
                <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                  {lease.lease_id}
                </span>
              </h3>
              <p className="text-xs text-gray-400">On-Chain Subjective AI Consensus Health Audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-4 overflow-y-auto font-mono text-xs">
          
          {/* Verdict Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isVerified ? 'bg-emerald-950/40 border-emerald-800' :
            isFraud ? 'bg-red-950/40 border-red-800' :
            'bg-gray-950 border-gray-800'
          }`}>
            <div>
              <span className="text-[10px] uppercase text-gray-400 block mb-0.5">
                Consensus Verdict
              </span>
              <div className="text-base font-bold flex items-center gap-2 font-mono">
                {isVerified && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {isFraud && <AlertTriangle className="w-4 h-4 text-red-400" />}
                <span className={isVerified ? 'text-emerald-300' : isFraud ? 'text-red-300' : 'text-gray-300'}>
                  {lease.verdict}
                </span>
              </div>
            </div>

            {/* Score Badges */}
            <div className="flex items-center gap-5">
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block uppercase">SLA Score</span>
                <span className={`text-lg font-bold font-mono ${
                  lease.performance_score >= 70 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {lease.performance_score}<span className="text-xs text-gray-500">/100</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block uppercase">Confidence</span>
                <span className="text-lg font-bold font-mono text-blue-400">
                  {lease.confidence}%
                </span>
              </div>
            </div>
          </div>

          {/* Compliance Progress Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-gray-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                <span>Benchmark Compliance Level</span>
              </span>
              <span className="text-white font-bold">{lease.performance_score}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-950 border border-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  lease.performance_score >= 70
                    ? 'bg-emerald-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.max(4, lease.performance_score)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-500 mt-1">
              <span>0 (Deficient / Fake GPU)</span>
              <span className="text-amber-400">70 (Pass Threshold)</span>
              <span className="text-emerald-400">100 (Optimal)</span>
            </div>
          </div>

          {/* AI Diagnostic Reasoning Log */}
          <div>
            <div className="flex items-center gap-1.5 text-gray-300 font-semibold mb-1.5 font-sans">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span>AI Jury Hardware Forensic Findings</span>
            </div>
            <div className="p-3.5 rounded-lg bg-gray-950 border border-gray-800 text-gray-300 leading-relaxed text-xs font-mono whitespace-pre-wrap">
              {lease.reason || 'Hardware audit pending jury evaluation.'}
            </div>
          </div>

          {/* SLA Specifications Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-lg bg-gray-950 border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase block mb-1">Renter Hardware SLA Spec</span>
              <p className="text-xs text-gray-200 leading-relaxed font-sans">{lease.hardware_spec}</p>
            </div>
            <div className="p-3.5 rounded-lg bg-gray-950 border border-gray-800">
              <span className="text-[10px] text-gray-400 uppercase block mb-1">Submitted Benchmark Proof</span>
              {lease.benchmark_log_url ? (
                <a
                  href={lease.benchmark_log_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline break-all flex items-center gap-1 mt-1 text-xs"
                >
                  <span className="truncate">{lease.benchmark_log_url}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-gray-500 text-xs italic">No benchmark log submitted yet.</span>
              )}
            </div>
          </div>

          {/* Parties & Escrow Ledger */}
          <div className="p-3.5 rounded-lg bg-gray-950 border border-gray-800 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">Renter Node:</span>
              <span className="text-gray-200">{shortenAddress(lease.renter)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">GPU Host Node:</span>
              <span className="text-gray-200">{shortenAddress(lease.host)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Escrow Locked:</span>
              <span className="text-blue-400 font-bold">{formatGen(lease.escrow_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">State:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusMeta.badgeBg} ${statusMeta.badgeText}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          {actionError && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-300 text-xs">
              {actionError}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-800 bg-[#0B0F19] flex-shrink-0">
          <a
            href={`${STUDIONET_EXPLORER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-sans text-gray-400 hover:text-blue-400 transition-colors"
          >
            <span>GenLayer Studio Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-sans text-xs transition-colors"
            >
              Close
            </button>

            {isAwaitingAudit && (
              <button
                onClick={handleTriggerAdjudication}
                disabled={isAdjudicating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-sans text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
              >
                {isAdjudicating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI Jury Auditing...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Audit Hardware SLA</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
