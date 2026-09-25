import React, { useState } from 'react';
import { X, HardDrive, Link as LinkIcon, Sparkles, AlertCircle, Loader2, Check } from 'lucide-react';
import { SAMPLE_BENCHMARK_PROOFS, LeaseOrderData } from '../utils/helpers';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !lease) return null;

  const handleSelectSample = (sampleUrl: string) => {
    setLogUrl(sampleUrl);
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
      // Contract write: submit_hardware_proof(lease_id: str, benchmark_log_url: str)
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
      <div className="relative w-full max-w-xl bg-[#15222E] border border-[#2A3B4D] rounded-2xl shadow-2xl overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A3B4D] bg-[#0E1721]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-950 border border-teal-800 text-teal-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono">Submit Hardware Benchmark SLA Proof</h3>
              <p className="text-xs text-slate-400">Claim <span className="text-cyan-300 font-mono">{lease.lease_id}</span> as GPU Node Host</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#2A3B4D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {/* Renter Hardware Spec Recap */}
          <div className="p-3.5 rounded-lg bg-[#0B131A] border border-[#2A3B4D]">
            <span className="block text-[11px] font-mono uppercase text-slate-400 mb-1">
              Required Hardware SLA to Satisfy:
            </span>
            <p className="text-xs text-slate-200 font-mono leading-relaxed bg-[#15222E] p-2 rounded border border-[#233342]">
              {lease.hardware_spec}
            </p>
          </div>

          {/* Sample Benchmark Presets */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-teal-400" />
              <span>Select Sample Benchmark Proof URL for Testing:</span>
            </label>
            <div className="space-y-1.5">
              {SAMPLE_BENCHMARK_PROOFS.map((sample, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectSample(sample.url)}
                  className={`w-full p-2.5 rounded-lg border text-left transition-all text-xs font-mono flex items-start justify-between gap-2 ${
                    logUrl === sample.url
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
                      : 'bg-[#0B131A] border-[#2A3B4D] hover:border-slate-500 text-slate-300'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-slate-200">{sample.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{sample.desc}</div>
                  </div>
                  {logUrl === sample.url && <Check className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Benchmark Log URL input */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 flex items-center gap-1">
              <LinkIcon className="w-3.5 h-3.5 text-teal-400" />
              <span>Live Public Benchmark Log URL</span>
            </label>
            <input
              type="url"
              value={logUrl}
              onChange={(e) => setLogUrl(e.target.value)}
              placeholder="https://gist.githubusercontent.com/.../raw/benchmark.txt"
              className="w-full px-3 py-2 rounded-lg bg-[#0B131A] border border-[#2A3B4D] text-white focus:outline-none focus:border-teal-500 font-mono text-xs"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              GenLayer intelligent contract will render and inspect this URL directly on-chain using <code className="text-cyan-400">gl.nondet.web.render</code>.
            </p>
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2A3B4D]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#0B131A] hover:bg-[#1A2633] text-slate-300 font-mono text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !logUrl}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white font-mono text-xs font-semibold shadow-rack-glow transition-all disabled:opacity-50"
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
