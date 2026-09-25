import React, { useState } from 'react';
import { X, Scale, AlertOctagon, Loader2, Link2, DollarSign } from 'lucide-react';
import { LeaseOrderData, formatGen, shortenAddress } from '../utils/helpers';
import { executeContractWrite } from '../config/genlayer';

interface AppealModalProps {
  lease: LeaseOrderData;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AppealModal: React.FC<AppealModalProps> = ({
  lease,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Calculate 10% required bond
  const escrowBigInt = BigInt(lease.escrow_amount || '0');
  const requiredBondWei = (escrowBigInt * 10n) / 100n;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUrl = evidenceUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      setError('Please provide a valid public benchmark evidence URL (http/https).');
      return;
    }

    try {
      setIsSubmitting(true);
      await executeContractWrite(
        'appeal_verdict',
        [lease.lease_id, cleanUrl],
        requiredBondWei
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Appeal error:', err);
      setError(err.message || 'Failed to file appeal on GenLayer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="fintech-card max-w-xl w-full p-6 sm:p-8 rounded-2xl relative border border-[#383226] shadow-2xl">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-[#0A0B0E] hover:bg-[#1E202B] text-luxury-sandDark hover:text-white border border-[#2C261C] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-gold-sm">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white font-sans">
              File Dispute <span className="text-[#F5D061]">& Appeal</span>
            </h3>
            <p className="text-xs text-luxury-sandDark font-mono">
              High Court Appeal Tribunal • {lease.lease_id}
            </p>
          </div>
        </div>

        {/* Current Initial Verdict Notice */}
        <div className="p-4 rounded-xl bg-[#0A0B0E] border border-[#2C261C] mb-6 space-y-2 text-xs font-mono">
          <div className="flex justify-between items-center">
            <span className="text-luxury-sandDark">Initial Verdict:</span>
            <span className={`px-2 py-0.5 rounded font-bold ${
              lease.verdict === 'HARDWARE_VERIFIED'
                ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800'
                : lease.verdict === 'HARDWARE_DEGRADED'
                ? 'text-purple-400 bg-purple-950/40 border border-purple-800'
                : 'text-rose-400 bg-rose-950/40 border border-rose-800'
            }`}>
              {lease.verdict} ({lease.performance_score}/100)
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-luxury-sandDark">Initial Reason:</span>
            <span className="text-luxury-sand text-right truncate max-w-[280px]">
              {lease.reason}
            </span>
          </div>
          <div className="flex justify-between items-center border-t border-[#1C1E26] pt-2">
            <span className="text-luxury-sandDark">Required Dispute Bond (10%):</span>
            <span className="text-[#F5D061] font-bold">
              {formatGen(requiredBondWei.toString())}
            </span>
          </div>
        </div>

        {/* Judicial Game Theory Alert */}
        <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/50 mb-6 text-xs text-amber-200/90 leading-relaxed">
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">Steward Anti-Frivolous Rule: </span>
              If your appeal is upheld by the Supreme Magistrate AI Jury, your 10% bond is{' '}
              <span className="text-emerald-300 font-semibold">100% refunded</span> and settlement is corrected.
              If dismissed, your bond is <span className="text-rose-300 font-semibold">slashed</span> and awarded to counterparty ({shortenAddress(lease.host)}).
            </div>
          </div>
        </div>

        {/* Appeal Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-luxury-sand mb-2">
              New Independent Benchmark Evidence Log URL:
            </label>
            <div className="relative">
              <input
                type="url"
                required
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
                placeholder="https://gist.githubusercontent.com/.../new_benchmark_retest.log"
                className="w-full px-4 py-3 pl-10 rounded-xl bg-[#0A0B0E] border border-[#2C261C] focus:border-[#F5D061] text-xs font-mono text-white placeholder-gray-600 outline-none transition-colors"
              />
              <Link2 className="w-4 h-4 text-gray-500 absolute left-3.5 top-3.5" />
            </div>
            <p className="text-[11px] text-luxury-sandDark mt-1.5 font-mono">
              Provide uncompressed diagnostic logs showing non-throttled sustained throughput.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2C261C]">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-[#0A0B0E] hover:bg-[#1E202B] text-luxury-sand text-xs font-sans border border-[#2C261C] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-gold flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold shadow-gold-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting Appeal & Staking Bond...</span>
                </>
              ) : (
                <>
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Stake {formatGen(requiredBondWei.toString())} & File Appeal</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
