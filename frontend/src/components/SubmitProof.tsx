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
      setPreviewError('Browser CORS prevented direct preview or URL is unreachable. GenLayer validators fetch directly via backend.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#111318] border border-[#383226] rounded-2xl shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2C261C] bg-[#0A0B0E] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#F5D061]/10 text-[#F5D061] border border-[#F5D061]/30">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Submit Sovereign Node Benchmark Diagnostic</h3>
              <p className="text-xs text-luxury-sandDark">
                Claim order <span className="text-[#F5D061] font-mono font-semibold">{lease.lease_id}</span> as GPU Node Provider
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-luxury-sandDark hover:text-white hover:bg-[#1E202B] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          
          {/* Target Spec Summary Banner */}
          <div className="p-4 rounded-xl bg-[#0A0B0E] border border-[#2C261C]">
            <div className="flex items-center justify-between text-xs font-mono uppercase text-luxury-sandDark mb-1.5">
              <span>Required SLA Benchmark Targets:</span>
              <span className="text-[#F5D061] font-bold">{parsedSpecs.model}</span>
            </div>
            <p className="text-xs text-luxury-sand font-mono leading-relaxed bg-[#111318] p-3 rounded-lg border border-[#2C261C]">
              {lease.hardware_spec}
            </p>
            {lease.challenge_nonce && (
              <div className="mt-2.5 pt-2.5 border-t border-[#2C261C] grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div>
                  <span className="text-luxury-sandDark">Contract Challenge Nonce:</span>
                  <div className="text-[#F5D061] font-semibold truncate" title={lease.challenge_nonce}>{lease.challenge_nonce}</div>
                </div>
                <div>
                  <span className="text-luxury-sandDark">Session Binding ID:</span>
                  <div className="text-luxury-sand truncate" title={lease.session_id}>{lease.session_id || 'Auto-bound'}</div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Benchmark Presets */}
          <div>
            <label className="block text-xs font-mono uppercase text-luxury-sandDark mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#F5D061]" />
              <span>Select Sample Benchmark Proof URL for Testing:</span>
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
                        ? 'bg-[#F5D061]/10 border-[#F5D061] text-white shadow-gold-sm'
                        : 'bg-[#0A0B0E] border-[#2C261C] text-luxury-sand hover:border-[#433A2A]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{sample.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${sample.badgeColor} font-medium`}>
                          {sample.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-luxury-sandDark mt-1">{sample.desc}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-[#F5D061] flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Benchmark Log URL Input & Inspector */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono uppercase text-luxury-sand mb-1.5">
              <span className="flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-[#F5D061]" />
                <span>Live Benchmark Diagnostic Log URL</span>
              </span>
              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={!logUrl || isPreviewing}
                className="text-[11px] text-[#F5D061] hover:underline flex items-center gap-1 disabled:opacity-50"
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
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0A0B0E] border border-[#2C261C] text-white focus:outline-none focus:border-[#F5D061] font-mono text-xs"
              required
            />
            
            <p className="text-[11px] text-luxury-sandDark mt-1">
              GenLayer intelligent contract will render this log on-chain using <code className="text-[#F5D061]">gl.nondet.web.render</code>.
            </p>
          </div>

          {/* Raw Log Preview Window */}
          {previewContent && (
            <div className="p-3.5 rounded-xl bg-[#0A0B0E] border border-[#2C261C] font-mono text-[11px]">
              <div className="flex items-center justify-between text-luxury-sandDark mb-2 border-b border-[#2C261C] pb-1.5">
                <span className="flex items-center gap-1 text-[#F5D061]">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Telemetry Diagnostic Log Preview</span>
                </span>
                <span className="text-[10px]">First 1500 bytes</span>
              </div>
              <pre className="text-luxury-sand whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {previewContent}
              </pre>
            </div>
          )}

          {previewError && (
            <div className="p-3 rounded-xl bg-[#0A0B0E] border border-amber-800/80 text-amber-300 text-xs font-mono">
              {previewError}
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2C261C]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-[#0A0B0E] hover:bg-[#1C1E26] text-luxury-sand font-sans text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !logUrl}
              className="btn-gold flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold tracking-wide shadow-gold-sm transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Submitting to Chain...</span>
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
