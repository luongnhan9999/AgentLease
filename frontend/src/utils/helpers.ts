// Utility and telemetry helpers for AgentLease (Obsidian & Luxury Gold Theme)

export interface LeaseOrderData {
  lease_id: string;
  renter: string;
  host: string;
  dispute_initiator?: string;
  escrow_amount: string;
  dispute_bond?: string;
  hardware_spec: string;
  benchmark_log_url: string;
  challenge_nonce?: string;
  session_id?: string;
  status: number; // 0: OPEN, 1: IN_AUDIT, 2: SETTLED_PAID, 3: FRAUD_REFUNDED, 4: CANCELLED, 5: SETTLED_PARTIAL, 6: DISPUTED, 7: AUDIT_COMPLETED
  verdict: string;
  initial_verdict?: string;
  initial_status?: number;
  reason: string;
  confidence: number;
  performance_score: number;
  created_at_time?: string;
  expires_at_time?: string;
  audit_started_time?: string;
  audit_completed_time?: string;
  created_at_block: string;
  expires_at_block: string;
  audit_started_block?: string;
  audit_completed_block?: string;
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

// Parse GPU specs for luxury cards
export function parseGpuSpecs(spec: string) {
  const upper = spec.toUpperCase();
  let model = 'Dedicated AI Hardware Instance';
  let vram = 'Unknown VRAM';
  let tflops = 'Standard Yield';
  let memoryType = 'GDDR';

  if (upper.includes('H100')) {
    model = 'NVIDIA H100 SXM5 Sovereign Cluster';
    vram = '80 GB';
    memoryType = 'HBM3';
    tflops = '950 TFLOPS';
  } else if (upper.includes('A100')) {
    model = 'NVIDIA A100 Tensor Facility';
    vram = '80 GB';
    memoryType = 'HBM2e';
    tflops = '312 TFLOPS';
  } else if (upper.includes('4090')) {
    if (upper.includes('8X')) {
      model = '8x NVIDIA RTX 4090 Dedicated Mesh';
      vram = '192 GB';
      tflops = '660 TFLOPS';
    } else {
      model = 'NVIDIA RTX 4090 Compute Node';
      vram = '24 GB';
      tflops = '82.6 TFLOPS';
    }
    memoryType = 'GDDR6X';
  } else if (upper.includes('L40S')) {
    model = 'NVIDIA L40S Enterprise Engine';
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
        label: 'Open for Host Claim',
        badgeBg: 'bg-[#F5D061]/10',
        badgeText: 'text-[#F5D061]',
        borderColor: 'border-[#F5D061]/40',
        dotColor: 'bg-[#F5D061]',
        description: 'Rental escrow secured in smart vault. Awaiting GPU host benchmark proof submission.',
      };
    case 1:
      return {
        label: 'In AI Jury Audit',
        badgeBg: 'bg-amber-500/10',
        badgeText: 'text-amber-400',
        borderColor: 'border-amber-500/40',
        dotColor: 'bg-amber-400',
        description: 'Hardware proof submitted. GenLayer AI validators are auditing hardware logs on-chain.',
      };
    case 2:
      return {
        label: 'Verified & Disbursed',
        badgeBg: 'bg-emerald-500/10',
        badgeText: 'text-emerald-400',
        borderColor: 'border-emerald-500/40',
        dotColor: 'bg-emerald-400',
        description: 'Hardware benchmark certified on-chain. Escrow settled directly to host node.',
      };
    case 3:
      return {
        label: 'Fraud Discovered / Refunded',
        badgeBg: 'bg-rose-500/10',
        badgeText: 'text-rose-400',
        borderColor: 'border-rose-500/40',
        dotColor: 'bg-rose-400',
        description: 'Hardware spoofing or throttling identified by AI Jury. Full refund executed to renter.',
      };
    case 4:
      return {
        label: 'Cancelled & Withdrawn',
        badgeBg: 'bg-gray-800',
        badgeText: 'text-gray-400',
        borderColor: 'border-gray-700',
        dotColor: 'bg-gray-400',
        description: 'Lease order cancelled. Funds returned to renter vault on-chain.',
      };
    case 5:
      return {
        label: 'Degraded SLA / Partial Payout',
        badgeBg: 'bg-purple-500/10',
        badgeText: 'text-purple-400',
        borderColor: 'border-purple-500/40',
        dotColor: 'bg-purple-400',
        description: 'Partial Hardware SLA verified (score 55-79). 60% paid to Host, 40% refunded to Renter.',
      };
    case 6:
      return {
        label: 'In High Court Dispute',
        badgeBg: 'bg-red-500/10',
        badgeText: 'text-red-400',
        borderColor: 'border-red-500/40',
        dotColor: 'bg-red-400',
        description: 'Verdict contested with staked bond. High Court AI Jury review in progress.',
      };
    case 7:
      return {
        label: 'Audit Completed (Appeal Window)',
        badgeBg: 'bg-yellow-500/10',
        badgeText: 'text-yellow-400',
        borderColor: 'border-yellow-500/40',
        dotColor: 'bg-yellow-400',
        description: 'Initial verdict reached. 30-block cooling-off challenge window active.',
      };
    default:
      return {
        label: 'Unknown State',
        badgeBg: 'bg-gray-800',
        badgeText: 'text-gray-400',
        borderColor: 'border-gray-700',
        dotColor: 'bg-gray-400',
        description: 'Unrecognized lease state.',
      };
  }
}

// Preset Hardware Specifications (Luxury Fintech Style)
export const GPU_SLA_PRESETS = [
  {
    name: 'NVIDIA H100 SXM5 Sovereign Cluster',
    spec: 'NVIDIA H100 80GB SXM5, 80GB HBM3 VRAM, min 950 TFLOPS (FP16), PCIe 5.0, NVLink 900GB/s',
    recommendedEscrow: '5.0',
    durationBlocks: 5000,
    vram: '80 GB HBM3',
    tflops: '950 TFLOPS',
    tier: 'Tier-1 Enterprise',
  },
  {
    name: 'NVIDIA A100 Tensor Facility',
    spec: 'NVIDIA A100-SXM4-80GB, 80GB HBM2e VRAM, min 312 TFLOPS (Tensor FP16), InfiniBand 200Gb/s',
    recommendedEscrow: '2.5',
    durationBlocks: 3500,
    vram: '80 GB HBM2e',
    tflops: '312 TFLOPS',
    tier: 'Tier-1 Enterprise',
  },
  {
    name: '8x NVIDIA RTX 4090 Dedicated Mesh',
    spec: '8x NVIDIA GeForce RTX 4090, 192GB Total GDDR6X VRAM, min 660 TFLOPS, CUDA 12.2, 10GbE Network',
    recommendedEscrow: '1.8',
    durationBlocks: 2000,
    vram: '192 GB GDDR6X',
    tflops: '660 TFLOPS',
    tier: 'DePIN High-Yield',
  },
];

// Sample Benchmark URLs for Host testing
export const SAMPLE_BENCHMARK_PROOFS = [
  {
    title: 'Certified NVIDIA H100 80GB Benchmark Log',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/h100_valid_benchmark.txt',
    desc: 'Passes all SLA metrics: 81920 MiB VRAM, 989 TFLOPS FP16, zero throttling.',
    badge: 'Certified SLA',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  },
  {
    title: 'Spoofed Consumer GPU (GTX 1060 Fraudulent Log)',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/gtx1060_fraud_benchmark.txt',
    desc: 'Host claims enterprise H100 with a 6GB GTX 1060 card.',
    badge: 'Fraud Detected',
    badgeColor: 'text-rose-400 bg-rose-500/10 border-rose-500/30',
  },
  {
    title: 'Thermal Throttling & Degraded Memory Bandwidth Log',
    url: 'https://raw.githubusercontent.com/yeou/public-logs/main/throttled_gpu_log.txt',
    desc: 'Severe thermal throttling and degraded memory throughput.',
    badge: 'Throttling Violation',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  },
];
