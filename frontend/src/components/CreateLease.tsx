import React, { useState } from 'react';
import { X, Cpu, Clock, Coins, Sparkles, AlertCircle, Loader2, Gauge, Check } from 'lucide-react';
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
  const [selectedPresetIdx, setSelectedPresetIdx] = useState(0);
  const [hardwareSpec, setHardwareSpec] = useState(GPU_SLA_PRESETS[0].spec);
  const [escrowGen, setEscrowGen] = useState(GPU_SLA_PRESETS[0].recommendedEscrow);
  const [durationBlocks, setDurationBlocks] = useState(GPU_SLA_PRESETS[0].durationBlocks.toString());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (idx: number) => {
    const preset = GPU_SLA_PRESETS[idx];
    setSelectedPresetIdx(idx);
    setHardwareSpec(preset.spec);
    setEscrowGen(preset.recommendedEscrow);
    setDurationBlocks(preset.durationBlocks.toString());
  };

  const handleSetBalancePercent = (pct: number) => {
    try {
      const b = BigInt(userBalance);
      if (b <= 0n) return;
      const amount = (b * BigInt(pct)) / 100n;
      const whole = amount / 10n ** 18n;
      const fraction = (amount % 10n ** 18n).toString().padStart(18, '0').slice(0, 4);
      setEscrowGen(`${whole}.${fraction}`);
    } catch (e) {
      console.error(e);
    }
  };

  const blockCount = parseInt(durationBlocks, 10) || 0;
  const approxSeconds = blockCount * 3;
  const approxHours = (approxSeconds / 3600).toFixed(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanSpec = hardwareSpec.trim();
    if (cleanSpec.length < 10) {
      setErrorMsg('Hardware specification requirements must be at least 10 characters.');
      return;
    }

    const weiValue = parseGenToWei(escrowGen);
    if (weiValue <= 0n) {
      setErrorMsg('Escrow deposit must be greater than 0 GEN.');
      return;
    }

    const blocks = parseInt(durationBlocks, 10);
    if (isNaN(blocks) || blocks <= 0) {
      setErrorMsg('Duration blocks must be a positive integer.');
      return;
    }

    try {
      setIsSubmitting(true);
      await executeContractWrite('create_lease_order', [cleanSpec, blocks], weiValue);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error creating compute lease on-chain:', err);
      setErrorMsg(err.message || 'Transaction failed. Please check your balance and connection to StudioNet.');
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
            <div className="p-2 rounded-lg bg-blue-600/10 text-blue-500 border border-blue-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Deploy GPU Compute SLA Order</h3>
              <p className="text-xs text-gray-400">Lock escrow in GEN and establish on-chain SLA benchmark thresholds</p>
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
          
          {/* Preset GPU Instance Catalog */}
          <div>
            <label className="block text-xs font-mono uppercase text-gray-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Select Cloud Hardware Instance Template</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {GPU_SLA_PRESETS.map((p, idx) => {
                const isSelected = selectedPresetIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(idx)}
                    className={`p-3 rounded-lg border text-left transition-all relative ${
                      isSelected
                        ? 'bg-blue-600/10 border-blue-500 text-white'
                        : 'bg-gray-950 border-gray-800 text-gray-300 hover:border-gray-700'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div className="text-xs font-bold truncate pr-4 text-white">
                      {p.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-gray-400">
                      <span className="text-blue-400 font-medium">{p.vram}</span>
                      <span>•</span>
                      <span>{p.recommendedEscrow} GEN</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hardware Spec Requirements */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono uppercase text-gray-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-blue-400" />
                <span>Service Level Agreement (SLA) Requirements</span>
              </span>
              <span className="text-[10px] text-gray-400 lowercase">Natural Language SLA</span>
            </div>
            <textarea
              rows={3}
              value={hardwareSpec}
              onChange={(e) => setHardwareSpec(e.target.value)}
              placeholder="e.g. NVIDIA H100 80GB SXM5, min 80GB HBM3 VRAM, >950 TFLOPS FP16 throughput"
              className="w-full px-3.5 py-2.5 rounded-lg bg-gray-950 border border-gray-800 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 text-xs font-mono leading-relaxed"
              required
            />
            <p className="text-[11px] text-gray-400 mt-1">
              GenLayer AI validators will inspect the host's raw diagnostic logs directly against these specifications.
            </p>
          </div>

          {/* Escrow Amount & Duration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Escrow Deposit */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono uppercase text-gray-300 mb-1.5">
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-blue-400" />
                  <span>Escrow Deposit (GEN)</span>
                </span>
                <span className="text-[10px] text-gray-400 lowercase">
                  Bal: {formatGen(userBalance)}
                </span>
              </div>
              
              <div className="relative mb-1.5">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={escrowGen}
                  onChange={(e) => setEscrowGen(e.target.value)}
                  className="w-full pl-3 pr-14 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  required
                />
                <span className="absolute right-3 top-2 text-xs font-mono text-blue-400 font-bold">
                  GEN
                </span>
              </div>

              {/* Quick % buttons */}
              <div className="flex items-center gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleSetBalancePercent(pct)}
                    className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-[10px] font-mono text-gray-300 hover:text-white border border-gray-700 transition-colors"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Blocks */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono uppercase text-gray-300 mb-1.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-400" />
                  <span>Claim Window (Blocks)</span>
                </span>
                <span className="text-[10px] text-gray-400 lowercase">
                  ~{approxHours} hrs (~3s/blk)
                </span>
              </div>
              <input
                type="number"
                min="50"
                step="50"
                value={durationBlocks}
                onChange={(e) => setDurationBlocks(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-gray-950 border border-gray-800 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                required
              />
              <p className="text-[10px] text-gray-400 mt-1">
                You can cancel and reclaim 100% of the funds if the order is unclaimed past this block duration.
              </p>
            </div>

          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Footer */}
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
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Locking Escrow on Chain...</span>
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
