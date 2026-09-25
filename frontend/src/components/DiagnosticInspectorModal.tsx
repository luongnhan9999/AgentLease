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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#090E1A] border border-[#223456] rounded-2xl shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#223456] bg-[#04070D] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              isVerified ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-quantum-emerald' :
              isFraud ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-quantum-rose' :
              'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00F0FF] shadow-quantum-cyan'
            }`}>
              {isVerified ? <ShieldCheck className="w-5 h-5" /> :
               isFraud ? <ShieldAlert className="w-5 h-5" /> :
               <Cpu className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <span>Hardware SLA Diagnostic Telemetry</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#0C1425] text-slate-300 border border-[#223456]">
                  {lease.lease_id}
                </span>
              </h3>
              <p className="text-xs text-obsidian-400">On-Chain Subjective AI Consensus Health Audit</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-obsidian-400 hover:text-white hover:bg-[#121D33] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto font-mono text-xs">
          
          {/* Verdict Banner */}
          <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isVerified ? 'bg-emerald-950/40 border-emerald-500/60 shadow-quantum-emerald' :
            isFraud ? 'bg-rose-950/40 border-rose-500/60 shadow-quantum-rose' :
            'bg-[#0C1425] border-[#223456]'
          }`}>
            <div>
              <span className="text-[10px] uppercase tracking-wider text-obsidian-400 block mb-1">
                Consensus Verdict
              </span>
              <div className="text-lg font-bold flex items-center gap-2 font-mono">
                {isVerified && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isFraud && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                <span className={isVerified ? 'text-emerald-300' : isFraud ? 'text-rose-300' : 'text-slate-300'}>
                  {lease.verdict}
                </span>
              </div>
            </div>

            {/* Score Badges */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] text-obsidian-400 block uppercase">SLA Score</span>
                <span className={`text-xl font-bold font-mono ${
                  lease.performance_score >= 70 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {lease.performance_score}<span className="text-xs text-obsidian-400">/100</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-obsidian-400 block uppercase">Jury Confidence</span>
                <span className="text-xl font-bold font-mono text-[#00F0FF]">
                  {lease.confidence}%
                </span>
              </div>
            </div>
          </div>

          {/* Compliance Progress Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-obsidian-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Benchmark Compliance Level</span>
              </span>
              <span className="text-white font-bold">{lease.performance_score}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-[#04070D] border border-[#223456] overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  lease.performance_score >= 70
                    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-[#00F0FF] shadow-quantum-emerald'
                    : 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 shadow-quantum-rose'
                }`}
                style={{ width: `${Math.max(4, lease.performance_score)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[9px] text-obsidian-500 mt-1">
              <span>0 (Deficient / Fake GPU)</span>
              <span className="text-amber-400 font-semibold">70 (Pass Threshold)</span>
              <span className="text-emerald-400 font-semibold">100 (Optimal)</span>
            </div>
          </div>

          {/* AI Diagnostic Reasoning Log */}
          <div>
            <div className="flex items-center gap-1.5 text-slate-200 font-semibold mb-1.5">
              <Terminal className="w-4 h-4 text-[#00F0FF]" />
              <span>AI Jury Hardware Forensic Justification</span>
            </div>
            <div className="p-4 rounded-xl bg-[#04070D] border border-[#223456] text-slate-300 leading-relaxed text-xs font-mono whitespace-pre-wrap">
              {lease.reason || 'Hardware audit pending jury evaluation.'}
            </div>
          </div>

          {/* SLA Specifications Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[#0C1425] border border-[#223456]">
              <span className="text-[10px] text-obsidian-400 uppercase block mb-1">Renter Hardware SLA Spec</span>
              <p className="text-xs text-slate-200 leading-relaxed font-sans">{lease.hardware_spec}</p>
            </div>
            <div className="p-4 rounded-xl bg-[#0C1425] border border-[#223456]">
              <span className="text-[10px] text-obsidian-400 uppercase block mb-1">Submitted Benchmark Proof</span>
              {lease.benchmark_log_url ? (
                <a
                  href={lease.benchmark_log_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00F0FF] hover:underline break-all flex items-center gap-1 mt-1 text-xs"
                >
                  <span className="truncate">{lease.benchmark_log_url}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-obsidian-500 text-xs italic">No benchmark log submitted yet.</span>
              )}
            </div>
          </div>

          {/* Parties & Escrow Ledger */}
          <div className="p-4 rounded-xl bg-[#0C1425] border border-[#223456] space-y-2.5">
            <div className="flex justify-between">
              <span className="text-obsidian-400">Renter Node:</span>
              <span className="text-slate-200">{shortenAddress(lease.renter)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-obsidian-400">GPU Host Node:</span>
              <span className="text-slate-200">{shortenAddress(lease.host)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-obsidian-400">Escrow Locked:</span>
              <span className="text-[#00F0FF] font-bold">{formatGen(lease.escrow_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-obsidian-400">State:</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${statusMeta.badgeBg} ${statusMeta.badgeText} border ${statusMeta.borderColor}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          {actionError && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs">
              {actionError}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#223456] bg-[#04070D] flex-shrink-0">
          <a
            href={`${STUDIONET_EXPLORER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-mono text-obsidian-400 hover:text-[#00F0FF] transition-colors"
          >
            <span>GenLayer Studio Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#0C1425] hover:bg-[#121D33] text-obsidian-300 font-mono text-xs transition-colors"
            >
              Close
            </button>

            {isAwaitingAudit && (
              <button
                onClick={handleTriggerAdjudication}
                disabled={isAdjudicating}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-mono text-xs font-bold shadow-quantum-violet transition-all disabled:opacity-50"
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
