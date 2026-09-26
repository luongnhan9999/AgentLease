# AgentLease: Autonomous AI Compute Hardware SLA & Hashrate Verification Escrow

> **Track:** Agentic Economy Infrastructure / DePIN / Subjective Consensus  
> **Target Network:** GenLayer StudioNet (Chain ID: `61999` / `0xF1EF`, RPC: `https://studio.genlayer.com/api`)  
> **Deployed Contract Address:** [`0xeBBf1671418Fee88Cc52a16125BBA3382Eb56158`](https://studio.genlayer.com)  
> **Live Production dApp:** [https://agentlease.vercel.app](https://agentlease.vercel.app)  
> **Ecosystem:** Agent Tank Hackathon

---

## 🚀 1. The Core Problem: The DePIN AI Compute Trust Barrier

As the autonomous agentic economy expands, AI Agents and developers face an urgent need to rent decentralized GPU compute clusters (NVIDIA H100, A100, RTX 4090) for model training, LoRA fine-tuning, and low-latency inference.

However, decentralized compute networks (DePIN) suffer from a critical **Hardware Asymmetry Dilemma**:
1. **The AI Renter's Nightmare (Hardware Spoofing & Throttling):**
   - Untrusted node providers may advertise enterprise H100 80GB SXM5 GPUs, but deliver consumer-grade cards (e.g., GTX 1060 or RTX 3060) spoofed with modified vBIOS or drivers.
   - Providers may artificially throttle PCIe bandwidth, under-clock memory, or kill compute processes prematurely.
2. **The GPU Host's Dilemma (Unfair Chargebacks):**
   - Legitimate node hosts commit thousands of dollars of compute and electricity. If renters can dispute charges arbitrarily, hosts risk providing 100% compute with zero compensation.

### Why Traditional Solidity Smart Contracts Fail
Traditional EVM blockchains cannot bridge this gap:
- Solidity contracts **cannot fetch external web links** or benchmark logs.
- Smart contracts **cannot parse diagnostic telemetry** (`nvidia-smi`, CUDA memory bandwidth, GEMM FP16 TFLOPS).
- EVM lacks subjective semantic reasoning to determine whether a benchmark log is authentic or forged.

---

## ⚡ 2. The GenLayer Solution: On-Chain Hardware Inspection

**AgentLease** leverages GenLayer's **Intelligent Contracts** and **Subjective Consensus** to create a zero-trust, automated hardware SLA escrow:

```
+---------------------------------------------------------------------------------------+
|                                      AgentLease Flow                                  |
+---------------------------------------------------------------------------------------+

 [AI Renter]                                                           [GPU Host Node]
      |                                                                       |
      | 1. create_lease_order(spec, duration) + locks GEN                     |
      |    (Defines GPU model, VRAM threshold, TFLOPS target)                 |
      +---------------------------------------------------------------------> |
                                                                              |
                                     2. Claims lease & submits live proof URL |
                                        submit_hardware_proof(url)            |
                                      <---------------------------------------+
                                      |
                         [GenLayer Intelligent Contract]
                                      |
                      3. gl.nondet.web.render(url, mode="text")
                         (Fetches live benchmark diagnostic log)
                                      |
                      4. gl.nondet.exec_prompt(prompt, json)
                         (AI Jury inspects device IDs, VRAM, and TFLOPS)
                                      |
                      5. gl.vm.run_nondet(leader_fn, validator_fn)
                         (Semantic Consensus: mine["verdict"] == leader["verdict"])
                                      |
             +------------------------+------------------------+
             |                                                 |
   [HARDWARE_VERIFIED]                               [HARDWARE_FRAUDULENT]
             |                                                 |
  * Status: SETTLED_PAID                            * Status: FRAUD_REFUNDED
  * Escrow GEN paid to Host                         * Escrow GEN refunded to Renter
  * Performance score & proof saved on-chain        * Host flagged on-chain
```

---

## 🧠 3. Intelligent Contract Architecture (`contracts/contract.py`)

- **GenLayer Pragma & SDK:**
  ```python
  # { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
  from genlayer import *
  from dataclasses import dataclass
  ```
- **Strict Storage Types:**
  - `LeaseOrder` struct decorated with `@allow_storage` and `@dataclass`.
  - Storage mapping using `TreeMap[str, LeaseOrder]` and index tracking with `DynArray[str]`.
  - Pure integer types: `bigint`, `u8`, `u32`, `u64`, `u256`. No bare `int` or `float`.
- **Live On-Chain Telemetry Extraction:**
  - `gl.nondet.web.render(log_url, mode="text")` extracts raw benchmark logs (e.g. GitHub Gist, node diagnostic endpoint).
- **Subjective AI Consensus Jury:**
  - Chief Hardware Inspector prompt evaluates hardware authenticity, VRAM allocation, and TFLOPS invariants.
  - Multi-validator verification: `validator_fn` compares `mine["verdict"] == leader["verdict"]` ensuring tamper-proof consensus.
- **Automated Native Settlement:**
  - `gl.get_contract_at(l.host).emit_transfer(value=u256(escrow_val))` upon verification.
  - `gl.get_contract_at(l.renter).emit_transfer(value=u256(escrow_val))` upon fraud detection.

---

## 🖥️ 4. HPC Supercomputer Cluster Dashboard (Frontend)

The frontend features a **High-Performance Oceanic Server Rack** design system:
- **Palette:** Abyssal slate background (`#0B131A`), server rack cards (`#15222E`), titanium borders (`#2A3B4D`).
- **Telemetry Accents:** VRAM Cyan (`#38BDF8`), Verified Green (`#10B981`), Thermal Alert Red (`#F43F5E`).
- **Typography:** JetBrains Mono & Space Grotesk for real-time compute telemetry.
- **Key Components:**
  - `Navbar.tsx`: StudioNet network status (`0xF1EF`), balance readout, deployed contract configurator, studio faucet guide.
  - `StatsBar.tsx`: Aggregated on-chain telemetry (Escrow locked, Leases settled, Active audits).
  - `CreateLease.tsx`: Renter portal with 1-click GPU SLA presets (NVIDIA H100 SXM5, A100 Tensor Core, RTX 4090).
  - `SubmitProof.tsx`: GPU Host claim portal with sample benchmark proof URLs.
  - `DiagnosticInspectorModal.tsx`: Comprehensive AI jury diagnostic inspector displaying compliance scores, confidence levels, and full reasoning justifications.
  - `LeaseCard.tsx`: Individual server rack unit displaying GPU SLA requirements and state-dependent action triggers.

---

## 📂 5. Directory Structure

```
AgentLease/
├── contracts/
│   └── contract.py            # Intelligent Contract with gl.nondet & consensus
├── tests/
│   ├── conftest.py            # Pytest execution harness and GenLayer mocks
│   └── test_agentlease.py     # 100% test coverage suite (4/4 tests passing)
├── frontend/
│   ├── package.json           # Vite + React 18 + TS + TailwindCSS + genlayer-js
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── config/
│       │   └── genlayer.ts    # StudioNet RPC configuration & contract caller
│       ├── utils/
│       │   └── helpers.ts     # Formatters, GPU presets & sample benchmark URLs
│       └── components/
│           ├── Navbar.tsx
│           ├── StatsBar.tsx
│           ├── CreateLease.tsx
│           ├── SubmitProof.tsx
│           ├── DiagnosticInspectorModal.tsx
│           └── LeaseCard.tsx
└── README.md
```

---

## 🧪 6. Testing & Verification

The contract and business logic are tested using `pytest` across all lifecycle stages:

```bash
pytest tests/test_agentlease.py -v
```

### Verified Test Cases:
1. `test_agentlease_lifecycle`: Validates lease creation, escrow locking, host claiming, and automatic payout upon `HARDWARE_VERIFIED`.
2. `test_fraudulent_hardware_refund`: Verifies that fake GPUs (e.g. GTX 1060 claimed as H100) are flagged `HARDWARE_FRAUDULENT` by the AI Jury, triggering an immediate refund to the renter.
3. `test_views_and_pagination`: Validates `get_lease`, `get_leases_paginated`, and `get_stats` view methods.
4. `test_cancel_or_reclaim`: Validates renter reclaim functionality after expiration.

---

## 🛠️ 7. How to Deploy to GenLayer StudioNet

1. Open [GenLayer Studio](https://studio.genlayer.com).
2. Create a new contract file `contracts/contract.py` and paste the contents of `contracts/contract.py`.
3. Select **StudioNet** network.
4. Deploy the contract with `GEN` funding.
5. Copy the deployed contract address and paste it into the **AgentLease** frontend configuration modal (Settings icon in the header).

---

## 🌐 8. Running the Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` to interact with the high-performance compute escrow dashboard.
