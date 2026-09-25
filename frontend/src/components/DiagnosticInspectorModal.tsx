import React, { useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Cpu, Zap, ExternalLink, Terminal, Loader2, Gauge, CheckCircle2, AlertTriangle, Scale, Clock } from 'lucide-react';
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
  const isDegraded = lease.verdict === 'HARDWARE_DEGRADED' || lease.status === 5;
  const isFraud = lease.verdict === 'HARDWARE_FRAUDULENT';
  const isDisputed = lease.status === 6;
  const isAuditCompleted = lease.status === 7;
  const isAwaitingAudit = lease.status === 1;

  const escrowVal = BigInt(lease.escrow_amount || '0');
  const hostDegradedShare = (escrowVal * 60n) / 100n;
  const renterDegradedRefund = escrowVal - hostDegradedShare;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#111318] border border-[#383226] rounded-2xl shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C261C] bg-[#0A0B0E] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl border ${
              isVerified ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
              isDegraded ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' :
              isFraud ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
              'bg-[#F5D061]/10 border-[#F5D061]/30 text-[#F5D061]'
            }`}>
              {isVerified ? <ShieldCheck className="w-5 h-5" /> :
               isDegraded ? <Scale className="w-5 h-5" /> :
               isFraud ? <ShieldAlert className="w-5 h-5" /> :
               <Cpu className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Hardware SLA Forensic Certificate</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1C1E26] text-[#F5D061] border border-[#383226] font-mono">
                  {lease.lease_id}
                </span>
              </h3>
              <p className="text-xs text-luxury-sandDark">GenLayer Subjective AI Consensus Diagnostic Telemetry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-luxury-sandDark hover:text-white hover:bg-[#1E202B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-4 overflow-y-auto font-mono text-xs">
          
          {/* Verdict Banner */}
          <div className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            isVerified ? 'bg-emerald-950/40 border-emerald-800' :
            isDegraded ? 'bg-purple-950/40 border-purple-800' :
            isFraud ? 'bg-rose-950/40 border-rose-800' :
            isDisputed ? 'bg-red-950/40 border-red-800' :
            'bg-[#0A0B0E] border-[#2C261C]'
          }`}>
            <div>
              <span className="text-[10px] uppercase text-luxury-sandDark block mb-1">
                Consensus Verdict
              </span>
              <div className="text-base font-bold flex items-center gap-2 font-mono">
                {isVerified && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {isDegraded && <Scale className="w-5 h-5 text-purple-400" />}
                {isFraud && <AlertTriangle className="w-5 h-5 text-rose-400" />}
                <span className={
                  isVerified ? 'text-emerald-300' :
                  isDegraded ? 'text-purple-300' :
                  isFraud ? 'text-rose-300' : 'text-[#F5D061]'
                }>
                  {lease.verdict}
                </span>
              </div>
            </div>

            {/* Score Badges */}
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] text-luxury-sandDark block uppercase">SLA Score</span>
                <span className={`text-xl font-bold font-mono ${
                  lease.performance_score >= 80 ? 'text-emerald-400' :
                  lease.performance_score >= 55 ? 'text-purple-400' : 'text-rose-400'
                }`}>
                  {lease.performance_score}<span className="text-xs text-luxury-sandDark">/100</span>
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-luxury-sandDark block uppercase">Confidence</span>
                <span className="text-xl font-bold font-mono text-[#F5D061]">
                  {lease.confidence}%
                </span>
              </div>
            </div>
          </div>

          {/* Canary Token Security Seal */}
          <div className="p-2.5 rounded-xl bg-[#0A0B0E] border border-[#2C261C] flex items-center justify-between text-[11px] font-mono">
            <span className="text-luxury-sandDark flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Steward Anti-Injection Shield:</span>
            </span>
            <span className="text-emerald-400 font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60">
              CANARY_AGENT_LEASE_V2 TAMPER-PROOF
            </span>
          </div>

          {/* Degraded 60/40 Split Card */}
          {isDegraded && (
            <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-800/60 text-xs font-mono text-purple-200">
              <div className="font-bold text-purple-300 mb-1.5 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-purple-400" />
                <span>Partial Hardware SLA Resolution (60/40 Ratio)</span>
              </div>
              <div className="flex justify-between text-[11px] pt-1 border-t border-purple-900/50">
                <span className="text-luxury-sandDark">Host Payout (60%): <strong className="text-purple-300 font-mono">{formatGen(hostDegradedShare.toString())}</strong></span>
                <span className="text-luxury-sandDark">Renter Refund (40%): <strong className="text-[#F5D061] font-mono">{formatGen(renterDegradedRefund.toString())}</strong></span>
              </div>
            </div>
          )}

          {/* Disputed High Court Card */}
          {isDisputed && (
            <div className="p-3.5 rounded-xl bg-red-950/30 border border-red-800 text-xs font-mono text-red-200 space-y-1">
              <div className="font-bold text-red-300 flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-red-400" />
                <span>Supreme Court Appeal In Session</span>
              </div>
              <div className="text-[11px] text-luxury-sandDark flex justify-between">
                <span>Appellant: <span className="text-white">{shortenAddress(lease.dispute_initiator || '')}</span></span>
                <span>Bond Staked: <span className="text-[#F5D061] font-bold">{formatGen(lease.dispute_bond || '0')}</span></span>
              </div>
            </div>
          )}

          {/* Audit Completed Appeal Window Notice */}
          {isAuditCompleted && (
            <div className="p-3.5 rounded-xl bg-yellow-950/30 border border-yellow-800/60 text-xs font-mono text-yellow-200 space-y-1">
              <div className="font-bold text-yellow-300 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-yellow-400 animate-pulse" />
                <span>Appeal Challenge Window (30 Blocks Active)</span>
              </div>
              <div className="text-[11px] text-luxury-sandDark leading-relaxed">
                Initial verdict delivered. Renter or Host may file a formal dispute with 10% staked bond before final settlement is disbursed.
              </div>
            </div>
          )}

          {/* Compliance Progress Bar */}
          <div>
            <div className="flex justify-between text-[11px] mb-1.5">
              <span className="text-luxury-sand flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#F5D061]" />
                <span>Benchmark Compliance Yield</span>
              </span>
              <span className="text-white font-bold">{lease.performance_score}%</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-[#0A0B0E] border border-[#2C261C] overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  lease.performance_score >= 70
                    ? 'bg-gradient-to-r from-emerald-500 to-[#F5D061]'
                    : 'bg-gradient-to-r from-rose-600 to-amber-500'
                }`}
                style={{ width: `${Math.max(4, lease.performance_score)}%` }}
              ></div>
            </div>
            <div className="flex justify-between text-[10px] text-luxury-sandDark mt-1">
              <span>0 (Fake / Throttled)</span>
              <span className="text-amber-400 font-semibold">70 (Pass Threshold)</span>
              <span className="text-emerald-400 font-semibold">100 (Optimal)</span>
            </div>
          </div>

          {/* AI Diagnostic Reasoning Log */}
          <div>
            <div className="flex items-center gap-1.5 text-luxury-sand font-semibold mb-1.5 font-sans">
              <Terminal className="w-4 h-4 text-[#F5D061]" />
              <span>AI Jury Hardware Forensic Findings</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-[#2C261C] text-luxury-sand leading-relaxed text-xs font-mono whitespace-pre-wrap">
              {lease.reason || 'Hardware audit pending jury evaluation.'}
            </div>
          </div>

          {/* SLA Specifications Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-[#2C261C]">
              <span className="text-[10px] text-luxury-sandDark uppercase block mb-1">Renter Hardware SLA Spec</span>
              <p className="text-xs text-luxury-sand leading-relaxed font-sans">{lease.hardware_spec}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-[#2C261C]">
              <span className="text-[10px] text-luxury-sandDark uppercase block mb-1">Submitted Benchmark Proof</span>
              {lease.benchmark_log_url ? (
                <a
                  href={lease.benchmark_log_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#F5D061] hover:underline break-all flex items-center gap-1 mt-1 text-xs"
                >
                  <span className="truncate">{lease.benchmark_log_url}</span>
                  <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                </a>
              ) : (
                <span className="text-luxury-sandDark text-xs italic">No benchmark log submitted yet.</span>
              )}
            </div>
          </div>

          {/* Parties & Escrow Ledger */}
          <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-[#2C261C] space-y-2">
            <div className="flex justify-between">
              <span className="text-luxury-sandDark">Renter Node:</span>
              <span className="text-luxury-sand">{shortenAddress(lease.renter)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-luxury-sandDark">GPU Host Provider:</span>
              <span className="text-luxury-sand">{shortenAddress(lease.host)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-luxury-sandDark">Escrow Locked:</span>
              <span className="text-[#F5D061] font-bold">{formatGen(lease.escrow_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-luxury-sandDark">State:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${statusMeta.badgeBg} ${statusMeta.badgeText} ${statusMeta.borderColor}`}>
                {statusMeta.label}
              </span>
            </div>
          </div>

          {actionError && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs">
              {actionError}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#2C261C] bg-[#0A0B0E] flex-shrink-0">
          <a
            href={`${STUDIONET_EXPLORER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-sans text-luxury-sandDark hover:text-[#F5D061] transition-colors"
          >
            <span>GenLayer Studio Explorer</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#111318] hover:bg-[#1E202B] text-luxury-sand font-sans text-xs transition-colors"
            >
              Close
            </button>

            {isAwaitingAudit && (
              <button
                onClick={handleTriggerAdjudication}
                disabled={isAdjudicating}
                className="btn-gold flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide shadow-gold-sm transition-all disabled:opacity-50"
              >
                {isAdjudicating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    <span>AI Jury Deliberating...</span>
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
