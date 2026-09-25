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

  // Convert blocks to approximate real-world duration (approx 3 seconds per block on GenLayer)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#090E1A] border border-[#223456] rounded-2xl shadow-2xl overflow-hidden font-sans max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#223456] bg-[#04070D] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#00F0FF]/10 border border-[#00F0FF]/30 text-[#00F0FF] shadow-quantum-cyan">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                <span>Lock On-Chain Compute SLA Escrow</span>
              </h3>
              <p className="text-xs text-obsidian-400">Deploy a tamper-proof hardware rental order to GenLayer Studionet</p>
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
          
          {/* Quick Hardware Presets */}
          <div>
            <label className="block text-xs font-mono uppercase text-obsidian-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00F0FF]" />
              <span>1-Click Enterprise GPU Cluster Presets</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {GPU_SLA_PRESETS.map((p, idx) => {
                const isSelected = selectedPresetIdx === idx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(idx)}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      isSelected
                        ? 'bg-[#00F0FF]/10 border-[#00F0FF] text-white shadow-quantum-cyan'
                        : 'bg-[#0C1425] border-[#223456] text-obsidian-300 hover:border-obsidian-500'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#00F0FF] text-black flex items-center justify-center text-[10px]">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                    <div className="text-xs font-bold font-mono truncate pr-4 text-white">
                      {p.name.split(' ')[1]} {p.name.split(' ')[2]}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-obsidian-400">
                      <span className="text-[#00F0FF] font-semibold">{p.vram}</span>
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
            <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-[#00F0FF]" />
                <span>GPU SLA Hardware & Hashrate Requirements</span>
              </span>
              <span className="text-[10px] text-obsidian-400 lowercase">natural language SLA</span>
            </div>
            <textarea
              rows={3}
              value={hardwareSpec}
              onChange={(e) => setHardwareSpec(e.target.value)}
              placeholder="e.g. NVIDIA H100 80GB SXM5, min 80GB HBM3 VRAM, >950 TFLOPS FP16 throughput"
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#04070D] border border-[#223456] text-white placeholder-obsidian-500 focus:outline-none focus:border-[#00F0FF] text-xs font-mono leading-relaxed"
              required
            />
            <p className="text-[11px] text-obsidian-400 mt-1">
              GenLayer AI validators will execute <code className="text-[#00F0FF]">gl.nondet.web.render</code> to parse raw benchmark logs against these requirements.
            </p>
          </div>

          {/* Escrow Amount & Duration Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Escrow Deposit */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-300 mb-1.5">
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Escrow Deposit (GEN)</span>
                </span>
                <span className="text-[10px] text-obsidian-400 lowercase">
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
                  className="w-full pl-3 pr-14 py-2.5 rounded-xl bg-[#04070D] border border-[#223456] text-white focus:outline-none focus:border-[#00F0FF] font-mono text-sm font-semibold"
                  required
                />
                <span className="absolute right-3 top-3 text-xs font-mono text-[#00F0FF] font-bold">
                  GEN
                </span>
              </div>

              {/* Quick Percentage Chips */}
              <div className="flex items-center gap-1.5">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleSetBalancePercent(pct)}
                    className="px-2 py-0.5 rounded-md bg-[#0C1425] hover:bg-[#192642] text-[10px] font-mono text-obsidian-400 hover:text-white border border-[#223456]"
                  >
                    {pct === 100 ? 'MAX' : `${pct}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Duration Blocks */}
            <div>
              <div className="flex items-center justify-between text-xs font-mono uppercase text-slate-300 mb-1.5">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>Lease Window (Blocks)</span>
                </span>
                <span className="text-[10px] text-obsidian-400 lowercase">
                  ~{approxHours} hrs (~3s/blk)
                </span>
              </div>
              <input
                type="number"
                min="50"
                step="50"
                value={durationBlocks}
                onChange={(e) => setDurationBlocks(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-[#04070D] border border-[#223456] text-white focus:outline-none focus:border-[#00F0FF] font-mono text-sm font-semibold"
                required
              />
              <p className="text-[10px] text-obsidian-400 mt-1">
                If no host claims before expiration, you can reclaim 100% of your escrow on-chain.
              </p>
            </div>

          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-700/80 text-rose-300 text-xs font-mono flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Modal Footer */}
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
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-indigo-600 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-mono text-xs font-bold shadow-quantum-cyan transition-all disabled:opacity-50"
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
