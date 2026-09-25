// Upgraded Utility and telemetry helpers for AgentLease

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

// Extract GPU specifications from text
export function parseGpuSpecs(spec: string) {
  const upper = spec.toUpperCase();
  let model = 'Generic AI Accelerator';
  let vram = 'Unknown';
  let tflops = 'Standard';

  if (upper.includes('H100')) {
    model = 'NVIDIA H100 SXM5';
    vram = '80 GB HBM3';
    tflops = '>950 TFLOPS';
  } else if (upper.includes('A100')) {
    model = 'NVIDIA A100 Tensor';
    vram = '80 GB HBM2e';
    tflops = '>312 TFLOPS';
  } else if (upper.includes('4090')) {
    model = upper.includes('8X') ? '8x RTX 4090' : 'RTX 4090';
    vram = upper.includes('8X') ? '192 GB GDDR6X' : '24 GB GDDR6X';
    tflops = '>660 TFLOPS';
  } else if (upper.includes('L40S')) {
    model = 'NVIDIA L40S';
    vram = '48 GB GDDR6';
    tflops = '>733 TFLOPS';
  }

  // Regex fallback for VRAM
  const vramMatch = spec.match(/(\d+)\s*(?:GB|GiB)/i);
  if (vramMatch && vram === 'Unknown') {
    vram = `${vramMatch[1]} GB`;
  }

  return { model, vram, tflops };
}

export interface StatusMeta {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  glowClass: string;
  indicatorColor: string;
  description: string;
}

export function getStatusMeta(status: number): StatusMeta {
  switch (status) {
    case 0:
      return {
        label: 'OPEN FOR HOST CLAIM',
        badgeBg: 'bg-cyan-950/70',
        badgeText: 'text-[#00F0FF]',
        borderColor: 'border-cyan-500/40',
        glowClass: 'shadow-quantum-cyan',
        indicatorColor: 'bg-[#00F0FF]',
        description: 'GEN Escrow locked on-chain. Waiting for GPU node provider to submit live benchmark proof.',
      };
    case 1:
      return {
        label: 'ACTIVE AI JURY AUDIT',
        badgeBg: 'bg-amber-950/70',
        badgeText: 'text-amber-400',
        borderColor: 'border-amber-500/50',
        glowClass: 'shadow-[0_0_20px_-3px_rgba(245,158,11,0.3)]',
        indicatorColor: 'bg-amber-400',
        description: 'Hardware proof submitted. GenLayer AI validators inspecting benchmark logs on-chain.',
      };
    case 2:
      return {
        label: 'VERIFIED & SETTLED',
        badgeBg: 'bg-emerald-950/70',
        badgeText: 'text-emerald-400',
        borderColor: 'border-emerald-500/50',
        glowClass: 'shadow-quantum-emerald',
        indicatorColor: 'bg-emerald-400',
        description: 'Hardware benchmark meets SLA. Rental escrow automatically disbursed to Host.',
      };
    case 3:
      return {
        label: 'FRAUD DISCOVERED - REFUNDED',
        badgeBg: 'bg-rose-950/70',
        badgeText: 'text-rose-400',
        borderColor: 'border-rose-500/50',
        glowClass: 'shadow-quantum-rose',
        indicatorColor: 'bg-rose-400',
        description: 'Hardware spoofing or throttling identified by AI Jury. Full refund executed to Renter.',
      };
    case 4:
      return {
        label: 'CANCELLED & RECLAIMED',
        badgeBg: 'bg-slate-900/80',
        badgeText: 'text-slate-400',
        borderColor: 'border-slate-700',
        glowClass: '',
        indicatorColor: 'bg-slate-500',
        description: 'Lease order cancelled. Funds returned to Renter on-chain.',
      };
    default:
      return {
        label: 'UNKNOWN STATE',
        badgeBg: 'bg-slate-900',
        badgeText: 'text-slate-400',
        borderColor: 'border-slate-800',
        glowClass: '',
        indicatorColor: 'bg-slate-500',
        description: 'Unrecognized compute lease state.',
      };
  }
}

// Preset Hardware Specifications for Fast Ordering
export const GPU_SLA_PRESETS = [
  {
    name: 'NVIDIA H100 80GB SXM5 (Ultra-Scale LLM)',
    spec: 'NVIDIA H100 80GB SXM5, 80GB HBM3 VRAM, min 950 TFLOPS (FP16), PCIe 5.0 x16, NVLink 900GB/s',
    recommendedEscrow: '5.0',
    durationBlocks: 5000,
    vram: '80 GB',
    tflops: '950 TFLOPS',
    category: 'Enterprise Cluster',
  },
  {
    name: 'NVIDIA A100 80GB Tensor Core (Fine-Tuning)',
    spec: 'NVIDIA A100-SXM4-80GB, 80GB HBM2e VRAM, min 312 TFLOPS (Tensor FP16), InfiniBand 200Gb/s',
    recommendedEscrow: '2.5',
    durationBlocks: 3500,
    vram: '80 GB',
    tflops: '312 TFLOPS',
    category: 'Enterprise Cluster',
  },
  {
    name: '8x NVIDIA RTX 4090 24GB (Distributed Inference)',
    spec: '8x NVIDIA GeForce RTX 4090, 192GB Total GDDR6X VRAM, min 660 TFLOPS, CUDA 12.2, 10GbE Network',
    recommendedEscrow: '1.8',
    durationBlocks: 2000,
    vram: '192 GB',
    tflops: '660 TFLOPS',
    category: 'DePIN Compute',
  },
];

// Sample Benchmark Log URLs for Live Testing on Studionet
export const SAMPLE_BENCHMARK_PROOFS = [
  {
    title: 'Authentic NVIDIA H100 80GB SXM5 Benchmark Log',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt',
    desc: 'Passes all SLA metrics: 81920 MiB VRAM, 989 TFLOPS FP16, zero ECC errors.',
    badge: 'PASSES SLA',
    badgeColor: 'text-emerald-400 bg-emerald-950/80 border-emerald-700',
  },
  {
    title: 'Spoofed Low-End GPU (GTX 1060 Fraud)',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/gtx1060_fraud_benchmark.txt',
    desc: 'Fraudulent node provider attempting to claim H100 escrow with a 6GB GTX 1060 card.',
    badge: 'SPOOF DETECTED',
    badgeColor: 'text-rose-400 bg-rose-950/80 border-rose-700',
  },
  {
    title: 'Thermal Throttling & Degraded Memory Bandwidth Log',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/throttled_gpu_log.txt',
    desc: 'Degraded memory throughput and thermal throttling violating SLA minimums.',
    badge: 'THROTTLED',
    badgeColor: 'text-amber-400 bg-amber-950/80 border-amber-700',
  },
];
