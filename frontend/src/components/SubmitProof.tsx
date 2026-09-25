import React, { useState } from 'react';
import { X, HardDrive, Link as LinkIcon, Sparkles, AlertCircle, Loader2, Check, Eye, Terminal } from 'lucide-react';
import { SAMPLE_BENCHMARK_PROOFS, LeaseOrderData, parseGpuSpecs } from '../utils/helpers';
import { executeContractWrite } from '../config/genlayer';

interface SubmitProofProps {
  isOpen: boolean;
  lease: LeaseOrderData | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const SubmitProof: React.FC<SubmitProofProps> = ({
  isOpen,
  lease,
  onClose,
  onSuccess,
}) => {
  const [logUrl, setLogUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !lease) return null;

  const parsedSpecs = parseGpuSpecs(lease.hardware_spec);

  const handleSelectSample = (sampleUrl: string) => {
    setLogUrl(sampleUrl);
    setPreviewContent(null);
    setPreviewError(null);
  };

  const handleFetchPreview = async () => {
    const cleanUrl = logUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setPreviewError('Please enter a valid HTTP/HTTPS URL first.');
      return;
    }

    setIsPreviewing(true);
    setPreviewError(null);
    try {
      const res = await fetch(cleanUrl);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to fetch URL.`);
      }
      const text = await res.text();
      setPreviewContent(text.slice(0, 1500));
    } catch (err: any) {
      console.warn('Preview fetch error:', err);
      setPreviewError('CORS prevented direct browser preview or URL is unreachable. GenLayer validators fetch directly via backend.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanUrl = logUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setErrorMsg('Please enter a valid public HTTP or HTTPS log URL.');
      return;
    }

    try {
      setIsSubmitting(true);
      await executeContractWrite('submit_hardware_proof', [lease.lease_id, cleanUrl]);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error submitting hardware benchmark proof:', err);
      setErrorMsg(err.message || 'Transaction failed. Only non-renter accounts can claim leases.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#090E1A] border border-[#223456] rounded-2xl shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#223456] bg-[#04070D] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 shadow-quantum-cyan">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <span>Submit GPU Hardware Proof & Hashrate SLA</span>
              </h3>
              <p className="text-xs text-obsidian-400">
                Claim <span className="text-[#00F0FF] font-mono font-semibold">{lease.lease_id}</span> as Node Provider
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-obsidian-400 hover:text-white hover:bg-[#121D33] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          
          {/* Target Spec Summary Banner */}
          <div className="p-4 rounded-xl bg-[#0C1425] border border-[#223456]">
            <div className="flex items-center justify-between text-xs font-mono uppercase text-obsidian-400 mb-1.5">
              <span>Required SLA Benchmark Targets:</span>
              <span className="text-[#00F0FF] font-semibold">{parsedSpecs.model}</span>
            </div>
            <p className="text-xs text-slate-200 font-mono leading-relaxed bg-[#04070D] p-3 rounded-lg border border-[#192642]">
              {lease.hardware_spec}
            </p>
          </div>

          {/* Quick Benchmark Presets */}
          <div>
            <label className="block text-xs font-mono uppercase text-obsidian-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>Select Sample Benchmark Proof URL for Instant Testing:</span>
            </label>
            <div className="space-y-2">
              {SAMPLE_BENCHMARK_PROOFS.map((sample, idx) => {
                const isSelected = logUrl === sample.url;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSample(sample.url)}
                    className={`w-full p-3 rounded-xl border text-left transition-all text-xs font-mono flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-[#00F0FF]/10 border-[#00F0FF] text-white shadow-quantum-cyan'
                        : 'bg-[#0C1425] border-[#223456] text-obsidian-300 hover:border-obsidian-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{sample.title}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full border ${sample.badgeColor} font-semibold`}>
                          {sample.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-obsidian-400 mt-1">{sample.desc}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#00F0FF] flex-shrink-0 mt-1" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Benchmark Log URL Input & Inspector */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-300 mb-1.5">
              <span className="flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>Live Benchmark Diagnostic Log URL</span>
              </span>
              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={!logUrl || isPreviewing}
                className="text-[11px] text-[#00F0FF] hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {isPreviewing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />}
                <span>Preview Raw Log</span>
              </button>
            </div>
            
            <input
              type="url"
              value={logUrl}
              onChange={(e) => setLogUrl(e.target.value)}
              placeholder="https://gist.githubusercontent.com/.../raw/benchmark.txt"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#04070D] border border-[#223456] text-white focus:outline-none focus:border-[#00F0FF] font-mono text-xs"
              required
            />
            
            <p className="text-[11px] text-obsidian-400 mt-1">
              GenLayer intelligent contract will render and inspect this URL directly on-chain using <code className="text-[#00F0FF]">gl.nondet.web.render</code>.
            </p>
          </div>

          {/* Raw Log Preview Window */}
          {previewContent && (
            <div className="p-3.5 rounded-xl bg-[#04070D] border border-[#223456] font-mono text-[11px]">
              <div className="flex items-center justify-between text-obsidian-400 mb-2 border-b border-[#192642] pb-1.5">
                <span className="flex items-center gap-1.5 text-[#00F0FF]">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Telemetry Log Preview</span>
                </span>
                <span className="text-[10px]">First 1500 bytes</span>
              </div>
              <pre className="text-slate-300 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                {previewContent}
              </pre>
            </div>
          )}

          {previewError && (
            <div className="p-3 rounded-lg bg-obsidian-850 border border-amber-700/60 text-amber-300 text-xs font-mono">
              {previewError}
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#223456]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#04070D] hover:bg-[#121D33] text-obsidian-300 font-mono text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !logUrl}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-mono text-xs font-bold shadow-quantum-emerald transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting to Studionet...</span>
                </>
              ) : (
                <span>Claim Lease & Submit Benchmark</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
