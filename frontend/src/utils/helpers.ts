// Utility and helper functions for AgentLease

export interface LeaseOrderData {
  lease_id: string;
  renter: string;
  host: string;
  escrow_amount: string;
  hardware_spec: string;
  benchmark_log_url: string;
  status: number; // 0: OPEN, 1: IN_AUDIT, 2: SETTLED_PAID, 3: FRAUD_REFUNDED, 4: CANCELLED
  verdict: string;
  reason: string;
  confidence: number;
  performance_score: number;
  created_at_block: string;
  expires_at_block: string;
}

export interface ClusterStats {
  total_leases: number;
  total_compute_locked: string;
  total_leases_settled: number;
}

export function shortenAddress(addr: string): string {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return 'Unassigned';
  if (addr.length < 12) return addr;
  return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
}

export function formatGen(weiVal: string | bigint | number): string {
  try {
    const b = BigInt(weiVal.toString());
    const whole = b / 10n ** 18n;
    const fraction = b % 10n ** 18n;
    const fractionPadded = fraction.toString().padStart(18, '0').slice(0, 4);
    return `${whole.toString()}.${fractionPadded} GEN`;
  } catch {
    return '0.0000 GEN';
  }
}

export function parseGenToWei(genStr: string): bigint {
  try {
    const parts = genStr.trim().split('.');
    const whole = BigInt(parts[0] || '0');
    let fracStr = parts[1] || '0';
    if (fracStr.length > 18) {
      fracStr = fracStr.slice(0, 18);
    } else {
      fracStr = fracStr.padEnd(18, '0');
    }
    const frac = BigInt(fracStr);
    return whole * 10n ** 18n + frac;
  } catch {
    return 0n;
  }
}

export interface StatusMeta {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  iconColor: string;
  description: string;
}

export function getStatusMeta(status: number): StatusMeta {
  switch (status) {
    case 0:
      return {
        label: 'OPEN FOR HOST',
        badgeBg: 'bg-cyan-950/70',
        badgeText: 'text-cyan-400',
        borderColor: 'border-cyan-700/60',
        iconColor: 'text-cyan-400',
        description: 'Escrow locked. Waiting for GPU Host to claim and submit benchmark log proof.',
      };
    case 1:
      return {
        label: 'IN AI AUDIT',
        badgeBg: 'bg-amber-950/70',
        badgeText: 'text-amber-400',
        borderColor: 'border-amber-700/60',
        iconColor: 'text-amber-400',
        description: 'Benchmark proof submitted. GenLayer AI validators analyzing hardware telemetry.',
      };
    case 2:
      return {
        label: 'VERIFIED & PAID',
        badgeBg: 'bg-emerald-950/70',
        badgeText: 'text-emerald-400',
        borderColor: 'border-emerald-700/60',
        iconColor: 'text-emerald-400',
        description: 'Hardware verified. Host paid out automatically from escrow.',
      };
    case 3:
      return {
        label: 'FRAUD REFUNDED',
        badgeBg: 'bg-rose-950/70',
        badgeText: 'text-rose-400',
        borderColor: 'border-rose-700/60',
        iconColor: 'text-rose-400',
        description: 'Hardware fraud or throttling detected. Escrow refunded to Renter.',
      };
    case 4:
      return {
        label: 'CANCELLED',
        badgeBg: 'bg-slate-800/70',
        badgeText: 'text-slate-400',
        borderColor: 'border-slate-700',
        iconColor: 'text-slate-400',
        description: 'Lease order cancelled and funds returned to Renter.',
      };
    default:
      return {
        label: 'UNKNOWN',
        badgeBg: 'bg-slate-900',
        badgeText: 'text-slate-400',
        borderColor: 'border-slate-800',
        iconColor: 'text-slate-500',
        description: 'Unrecognized lease state.',
      };
  }
}

// Preset Hardware Specifications for Fast Ordering
export const GPU_SLA_PRESETS = [
  {
    name: 'NVIDIA H100 80GB SXM5 (LLM Training)',
    spec: 'NVIDIA H100 80GB SXM5, 80GB HBM3 VRAM, min 950 TFLOPS (FP16), PCIe 5.0, NVLink 900GB/s',
    recommendedEscrow: '5.0',
    durationBlocks: 5000,
    category: 'Enterprise AI',
  },
  {
    name: 'NVIDIA A100 80GB Tensor Core (Fine-tuning)',
    spec: 'NVIDIA A100-SXM4-80GB, 80GB HBM2e VRAM, min 312 TFLOPS (Tensor FP16), InfiniBand 200Gb/s',
    recommendedEscrow: '2.5',
    durationBlocks: 3500,
    category: 'Enterprise AI',
  },
  {
    name: '8x NVIDIA RTX 4090 24GB (Distributed Inference)',
    spec: '8x NVIDIA GeForce RTX 4090, 192GB Total GDDR6X VRAM, min 660 TFLOPS, CUDA 12.2, 10GbE Network',
    recommendedEscrow: '1.8',
    durationBlocks: 2000,
    category: 'DePIN Compute',
  },
];

// Sample Benchmark Log URLs for Testing on Studionet
export const SAMPLE_BENCHMARK_PROOFS = [
  {
    title: '✅ Authentic H100 SXM5 80GB Benchmark Log',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt',
    desc: 'Passes all SLA metrics: 81920 MiB VRAM, 989 TFLOPS FP16, zero throttling.',
  },
  {
    title: '⚠️ Spoofed / Low-End GPU (GTX 1060 Fraud)',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/gtx1060_fraud_benchmark.txt',
    desc: 'Simulates a host attempting to claim an H100 lease with a cheap 6GB GTX 1060 card.',
  },
  {
    title: '❌ Throttling & Degraded Memory Bandwidth Log',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/throttled_gpu_log.txt',
    desc: 'Contains thermal throttling warnings and failing TFLOPS thresholds.',
  },
];
