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
      setPreviewError('Browser CORS prevented local preview or URL is unreachable. GenLayer validators fetch directly via backend.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#0B0F19] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Submit Node Benchmark Diagnostic Proof</h3>
              <p className="text-xs text-gray-400">
                Claim order <span className="text-blue-400 font-mono font-semibold">{lease.lease_id}</span> as GPU Node Provider
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          
          {/* Target Spec Summary Banner */}
          <div className="p-3.5 rounded-lg bg-gray-950 border border-gray-800">
            <div className="flex items-center justify-between text-xs font-mono uppercase text-gray-400 mb-1">
              <span>Required SLA Benchmark Targets:</span>
              <span className="text-white font-semibold">{parsedSpecs.model}</span>
            </div>
            <p className="text-xs text-gray-300 font-mono leading-relaxed bg-gray-900 p-2.5 rounded border border-gray-800">
              {lease.hardware_spec}
            </p>
          </div>

          {/* Quick Benchmark Presets */}
          <div>
            <label className="block text-xs font-mono uppercase text-gray-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
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
                    className={`w-full p-2.5 rounded-lg border text-left transition-all text-xs font-mono flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500 text-white'
                        : 'bg-gray-950 border-gray-800 text-gray-300 hover:border-gray-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{sample.title}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded border ${sample.badgeColor} font-medium`}>
                          {sample.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">{sample.desc}</div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Benchmark Log URL Input & Inspector */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono uppercase text-gray-300 mb-1.5">
              <span className="flex items-center gap-1">
                <LinkIcon className="w-3.5 h-3.5 text-blue-400" />
                <span>Live Benchmark Diagnostic Log URL</span>
              </span>
              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={!logUrl || isPreviewing}
                className="text-[11px] text-blue-400 hover:underline flex items-center gap-1 disabled:opacity-50"
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
              className="w-full px-3.5 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
              required
            />
            
            <p className="text-[11px] text-gray-400 mt-1">
              GenLayer intelligent contract will render this log on-chain using <code className="text-blue-400">gl.nondet.web.render</code>.
            </p>
          </div>

          {/* Raw Log Preview Window */}
          {previewContent && (
            <div className="p-3 rounded-lg bg-gray-950 border border-gray-800 font-mono text-[11px]">
              <div className="flex items-center justify-between text-gray-400 mb-2 border-b border-gray-800 pb-1.5">
                <span className="flex items-center gap-1 text-blue-400">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Telemetry Log Preview</span>
                </span>
                <span className="text-[10px]">First 1500 bytes</span>
              </div>
              <pre className="text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto leading-relaxed">
                {previewContent}
              </pre>
            </div>
          )}

          {previewError && (
            <div className="p-2.5 rounded bg-gray-950 border border-amber-800 text-amber-300 text-xs font-mono">
              {previewError}
            </div>
          )}

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 font-sans text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !logUrl}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-sans text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
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
