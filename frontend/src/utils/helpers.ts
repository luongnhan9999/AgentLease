// Utility and telemetry helpers for AgentLease (RunPod / Cloud Console Theme)

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

// Parse GPU specs for cloud-style chips
export function parseGpuSpecs(spec: string) {
  const upper = spec.toUpperCase();
  let model = 'Custom GPU Instance';
  let vram = 'Unknown VRAM';
  let tflops = 'Standard Compute';
  let memoryType = 'GDDR';

  if (upper.includes('H100')) {
    model = '1x NVIDIA H100 SXM5';
    vram = '80 GB';
    memoryType = 'HBM3';
    tflops = '950 TFLOPS';
  } else if (upper.includes('A100')) {
    model = '1x NVIDIA A100 Tensor';
    vram = '80 GB';
    memoryType = 'HBM2e';
    tflops = '312 TFLOPS';
  } else if (upper.includes('4090')) {
    if (upper.includes('8X')) {
      model = '8x NVIDIA RTX 4090';
      vram = '192 GB';
      tflops = '660 TFLOPS';
    } else {
      model = '1x NVIDIA RTX 4090';
      vram = '24 GB';
      tflops = '82.6 TFLOPS';
    }
    memoryType = 'GDDR6X';
  } else if (upper.includes('L40S')) {
    model = '1x NVIDIA L40S';
    vram = '48 GB';
    memoryType = 'GDDR6';
    tflops = '733 TFLOPS';
  }

  const vramMatch = spec.match(/(\d+)\s*(?:GB|GiB)/i);
  if (vramMatch && vram === 'Unknown VRAM') {
    vram = `${vramMatch[1]} GB`;
  }

  return { model, vram, memoryType, tflops };
}

export interface StatusMeta {
  label: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  dotColor: string;
  description: string;
}

export function getStatusMeta(status: number): StatusMeta {
  switch (status) {
    case 0:
      return {
        label: 'Available for Rent',
        badgeBg: 'bg-blue-500/10',
        badgeText: 'text-blue-400',
        borderColor: 'border-blue-500/30',
        dotColor: 'bg-blue-400',
        description: 'Escrow locked in contract. GPU Node Providers can claim and submit benchmark logs.',
      };
    case 1:
      return {
        label: 'Verifying Hardware SLA',
        badgeBg: 'bg-amber-500/10',
        badgeText: 'text-amber-400',
        borderColor: 'border-amber-500/30',
        dotColor: 'bg-amber-400',
        description: 'Benchmark proof submitted. GenLayer AI validators are auditing hardware logs on-chain.',
      };
    case 2:
      return {
        label: 'Active & Verified',
        badgeBg: 'bg-emerald-500/10',
        badgeText: 'text-emerald-400',
        borderColor: 'border-emerald-500/30',
        dotColor: 'bg-emerald-400',
        description: 'Hardware verified. Rental payment disbursed to host automatically.',
      };
    case 3:
      return {
        label: 'SLA Failed / Refunded',
        badgeBg: 'bg-red-500/10',
        badgeText: 'text-red-400',
        borderColor: 'border-red-500/30',
        dotColor: 'bg-red-400',
        description: 'Hardware mismatch or throttling detected. Escrow refunded to renter.',
      };
    case 4:
      return {
        label: 'Cancelled',
        badgeBg: 'bg-gray-800',
        badgeText: 'text-gray-400',
        borderColor: 'border-gray-700',
        dotColor: 'bg-gray-400',
        description: 'Lease cancelled and funds reclaimed by renter.',
      };
    default:
      return {
        label: 'Unknown',
        badgeBg: 'bg-gray-800',
        badgeText: 'text-gray-400',
        borderColor: 'border-gray-700',
        dotColor: 'bg-gray-400',
        description: 'Unrecognized lease state.',
      };
  }
}

// Preset Hardware Instances (RunPod / Cloud Style)
export const GPU_SLA_PRESETS = [
  {
    name: '1x NVIDIA H100 SXM5',
    spec: '1x NVIDIA H100 80GB SXM5, 80GB HBM3 VRAM, min 950 TFLOPS (FP16), PCIe 5.0, NVLink 900GB/s',
    recommendedEscrow: '5.0',
    durationBlocks: 5000,
    vram: '80 GB',
    memoryType: 'HBM3',
    tflops: '950 TFLOPS',
    vCpu: '16 vCPU',
    ram: '128 GB RAM',
    category: 'Enterprise Training',
  },
  {
    name: '1x NVIDIA A100-SXM4',
    spec: '1x NVIDIA A100-SXM4-80GB, 80GB HBM2e VRAM, min 312 TFLOPS (Tensor FP16), InfiniBand 200Gb/s',
    recommendedEscrow: '2.5',
    durationBlocks: 3500,
    vram: '80 GB',
    memoryType: 'HBM2e',
    tflops: '312 TFLOPS',
    vCpu: '12 vCPU',
    ram: '85 GB RAM',
    category: 'LLM Fine-Tuning',
  },
  {
    name: '8x NVIDIA RTX 4090',
    spec: '8x NVIDIA GeForce RTX 4090, 192GB Total GDDR6X VRAM, min 660 TFLOPS, CUDA 12.2, 10GbE Network',
    recommendedEscrow: '1.8',
    durationBlocks: 2000,
    vram: '192 GB',
    memoryType: 'GDDR6X',
    tflops: '660 TFLOPS',
    vCpu: '32 vCPU',
    ram: '256 GB RAM',
    category: 'Distributed Inference',
  },
];

// Sample Benchmark URLs for Host testing
export const SAMPLE_BENCHMARK_PROOFS = [
  {
    title: 'Authentic NVIDIA H100 80GB Benchmark Log',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt',
    desc: 'Passes all SLA metrics: 81920 MiB VRAM, 989 TFLOPS FP16, zero throttling.',
    badge: 'Passes SLA',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    title: 'Spoofed Low-End GPU (GTX 1060 Fraud)',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/gtx1060_fraud_benchmark.txt',
    desc: 'Host claims H100 with a 6GB GTX 1060 consumer card.',
    badge: 'Fraud Detected',
    badgeColor: 'text-red-400 bg-red-500/10 border-red-500/30',
  },
  {
    title: 'Thermal Throttling & Degraded Memory Bandwidth Log',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/throttled_gpu_log.txt',
    desc: 'Severe thermal throttling and degraded memory throughput.',
    badge: 'Throttled',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
];
