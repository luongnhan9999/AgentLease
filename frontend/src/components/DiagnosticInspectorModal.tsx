import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Cpu, Zap, ExternalLink, Terminal, Loader2 } from 'lucide-react';
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
      setActionError(err.message || 'AI Jury adjudication failed.');
    } finally {
      setIsAdjudicating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#15222E] border border-[#2A3B4D] rounded-2xl shadow-2xl overflow-hidden font-sans max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A3B4D] bg-[#0E1721] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg border ${
              isVerified ? 'bg-emerald-950/80 border-emerald-700 text-emerald-400' :
              isFraud ? 'bg-rose-950/80 border-rose-700 text-rose-400' :
              'bg-cyan-950/80 border-cyan-700 text-cyan-400'
            }`}>
              {isVerified ? <ShieldCheck className="w-5 h-5" /> :
               isFraud ? <ShieldAlert className="w-5 h-5" /> :
               <Cpu className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <span>Hardware SLA Diagnostic Telemetry</span>
                <span className="text-xs px-2 py-0.5 rounded bg-[#1C2C3C] text-slate-300 border border-[#2E4358]">
                  {lease.lease_id}
                </span>
              </h3>
              <p className="text-xs text-slate-400">On-Chain Subjective AI Consensus Health Audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#2A3B4D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto font-mono text-xs">
          
          {/* Verdict Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isVerified ? 'bg-emerald-950/40 border-emerald-600/70 text-emerald-200' :
            isFraud ? 'bg-rose-950/40 border-rose-600/70 text-rose-200' :
            'bg-slate-900/60 border-slate-700 text-slate-300'
          }`}>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block mb-0.5">
                Consensus Verdict
              </span>
              <div className="text-base font-bold flex items-center gap-2">
                {isVerified && <ShieldCheck className="w-5 h-5 text-emerald-400" />}
                {isFraud && <ShieldAlert className="w-5 h-5 text-rose-400" />}
                <span>{lease.verdict}</span>
              </div>
            </div>

            {/* Score Badges */}
            <div className="flex items-center gap-4">
              <div>
                <span className="text-[10px] text-slate-400 block">SLA Compliance</span>
                <span className={`text-base font-bold ${
                  lease.performance_score >= 70 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {lease.performance_score}/100
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Jury Confidence</span>
                <span className="text-base font-bold text-cyan-300">
                  {lease.confidence}%
                </span>
              </div>
            </div>
          </div>

          {/* Compliance Progress Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Benchmark Compliance Level</span>
              <span className="text-slate-200">{lease.performance_score}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#0B131A] border border-[#2A3B4D] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  lease.performance_score >= 70
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-rack-glow'
                    : 'bg-gradient-to-r from-rose-600 to-orange-500 shadow-thermal-glow'
                }`}
                style={{ width: `${Math.max(5, lease.performance_score)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] text-slate-500 mt-1">
              <span>0 (Deficient / Fraud)</span>
              <span>70 (SLA Approval Threshold)</span>
              <span>100 (Optimal Compute)</span>
            </div>
          </div>

          {/* AI Diagnostic Reasoning Log */}
          <div>
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1.5">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span>AI Jury Hardware Diagnostic Findings</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0B131A] border border-[#2A3B4D] text-slate-300 leading-relaxed text-xs font-mono whitespace-pre-wrap">
              {lease.reason || 'No diagnostic rationale recorded yet.'}
            </div>
          </div>

          {/* SLA Specifications comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-[#0B131A] border border-[#2A3B4D]">
              <span className="text-[10px] text-slate-400 uppercase block mb-1">Renter Hardware SLA Spec</span>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">{lease.hardware_spec}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0B131A] border border-[#2A3B4D]">
              <span className="text-[10px] text-slate-400 uppercase block mb-1">Live Benchmark Log Proof</span>
              {lease.benchmark_log_url ? (
                <a
                  href={lease.benchmark_log_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 underline break-all flex items-center gap-1 mt-1 text-xs"
                >
                  <span className="truncate">{lease.benchmark_log_url}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-slate-500 text-xs italic">No benchmark log submitted yet.</span>
              )}
            </div>
          </div>

          {/* Parties & Escrow Ledger */}
          <div className="p-3.5 rounded-xl bg-[#0B131A] border border-[#2A3B4D] space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400">Renter Node:</span>
              <span className="text-slate-200">{shortenAddress(lease.renter)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">GPU Host Node:</span>
              <span className="text-slate-200">{shortenAddress(lease.host)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Escrow Locked:</span>
              <span className="text-cyan-300 font-bold">{formatGen(lease.escrow_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Current Status:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${statusMeta.badgeBg} ${statusMeta.badgeText}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          {actionError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
              {actionError}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2A3B4D] bg-[#0E1721] flex-shrink-0">
          <a
            href={`${STUDIONET_EXPLORER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs font-mono text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <span>GenLayer Studio</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#0B131A] hover:bg-[#1A2633] text-slate-300 font-mono text-xs transition-colors"
            >
              Close
            </button>

            {isAwaitingAudit && (
              <button
                onClick={handleTriggerAdjudication}
                disabled={isAdjudicating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-semibold shadow-md transition-all disabled:opacity-50"
              >
                {isAdjudicating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI Jury Deliberating...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Trigger AI Jury Adjudication</span>
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
