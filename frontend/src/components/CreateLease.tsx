import React, { useState } from 'react';
import { X, Cpu, Clock, Coins, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { GPU_SLA_PRESETS, parseGenToWei, formatGen } from '../utils/helpers';
import { executeContractWrite } from '../config/genlayer';

interface CreateLeaseProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userBalance: string;
}

export const CreateLease: React.FC<CreateLeaseProps> = ({
  isOpen,
  onClose,
  onSuccess,
  userBalance,
}) => {
  const [hardwareSpec, setHardwareSpec] = useState(
    'NVIDIA H100 80GB SXM5, min 80GB VRAM, >950 TFLOPS FP16 throughput, NVLink enabled'
  );
  const [escrowGen, setEscrowGen] = useState('2.5');
  const [durationBlocks, setDurationBlocks] = useState('3000');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: typeof GPU_SLA_PRESETS[0]) => {
    setHardwareSpec(preset.spec);
    setEscrowGen(preset.recommendedEscrow);
    setDurationBlocks(preset.durationBlocks.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanSpec = hardwareSpec.trim();
    if (cleanSpec.length < 10) {
      setErrorMsg('Hardware specification must be at least 10 characters long.');
      return;
    }

    const weiValue = parseGenToWei(escrowGen);
    if (weiValue <= 0n) {
      setErrorMsg('Escrow amount must be greater than 0 GEN.');
      return;
    }

    const blocks = parseInt(durationBlocks, 10);
    if (isNaN(blocks) || blocks <= 0) {
      setErrorMsg('Duration blocks must be a positive integer.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Contract write: create_lease_order(hardware_spec: str, duration_blocks: int)
      await executeContractWrite(
        'create_lease_order',
        [cleanSpec, blocks],
        weiValue
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating compute lease:', err);
      setErrorMsg(err.message || 'Transaction failed. Please check your balance and connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#15222E] border border-[#2A3B4D] rounded-2xl shadow-2xl overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2A3B4D] bg-[#0E1721]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono">Create Compute SLA Lease Order</h3>
              <p className="text-xs text-slate-400">Lock escrow in GEN & define required hardware specifications</p>
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
          
          {/* Preset Buttons */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quick GPU Hardware Templates</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {GPU_SLA_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="p-2.5 rounded-lg bg-[#0B131A] border border-[#2A3B4D] hover:border-cyan-500/60 text-left transition-all group"
                >
                  <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 font-mono truncate">
                    {p.name.split(' ')[1]} {p.name.split(' ')[2]}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{p.recommendedEscrow} GEN / {p.durationBlocks} blks</div>
                </button>
              ))}
            </div>
          </div>

          {/* Hardware Spec Requirements */}
          <div>
            <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Hardware & Benchmark SLA Specifications</span>
              <span className="text-[10px] text-slate-400">Natural Language SLA</span>
            </label>
            <textarea
              rows={3}
              value={hardwareSpec}
              onChange={(e) => setHardwareSpec(e.target.value)}
              placeholder="e.g. NVIDIA H100 80GB SXM5, minimum 80GB VRAM, >900 TFLOPS FP16 benchmark throughput"
              className="w-full px-3 py-2 rounded-lg bg-[#0B131A] border border-[#2A3B4D] text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-sm font-mono leading-relaxed"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              GenLayer AI validators will analyze the host's raw benchmark logs directly against this spec.
            </p>
          </div>

          {/* Escrow Amount & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Escrow Amount */}
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Compute Escrow Deposit (GEN)</span>
                </span>
                <span className="text-[10px] text-slate-400 lowercase">
                  Bal: {formatGen(userBalance)}
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={escrowGen}
                  onChange={(e) => setEscrowGen(e.target.value)}
                  className="w-full pl-3 pr-16 py-2 rounded-lg bg-[#0B131A] border border-[#2A3B4D] text-white focus:outline-none focus:border-cyan-500 font-mono text-sm"
                  required
                />
                <span className="absolute right-3 top-2.5 text-xs font-mono text-cyan-400 font-semibold">
                  GEN
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                Locked securely in intelligent escrow until verification.
              </div>
            </div>

            {/* Duration Blocks */}
            <div>
              <label className="block text-xs font-mono uppercase text-slate-300 mb-1.5 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>Lease Claim Window (Blocks)</span>
              </label>
              <input
                type="number"
                min="100"
                step="100"
                value={durationBlocks}
                onChange={(e) => setDurationBlocks(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#0B131A] border border-[#2A3B4D] text-white focus:outline-none focus:border-cyan-500 font-mono text-sm"
                required
              />
              <div className="text-[10px] text-slate-400 font-mono mt-1">
                Renter can reclaim funds if no host claims before expiry.
              </div>
            </div>

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
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white font-mono text-xs font-semibold shadow-hpc-glow transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking Escrow on Studionet...</span>
                </>
              ) : (
                <span>Confirm & Lock Escrow</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
