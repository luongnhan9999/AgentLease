# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json


def _addr_str(addr: Address) -> str:
    """Safely format an Address instance into a hex string."""
    try:
        return addr.as_hex
    except Exception:
        return str(addr)


@allow_storage
@dataclass
class LeaseOrder:
    """Storage struct representing an autonomous compute hardware lease escrow."""
    lease_id: str
    renter: Address
    host: Address
    escrow_amount: bigint
    hardware_spec: str            # Required GPU model, min VRAM, compute benchmark thresholds
    benchmark_log_url: str        # Live proof URL containing hardware benchmark and diagnostic log
    status: u8                    # 0: OPEN, 1: IN_AUDIT, 2: SETTLED_PAID, 3: FRAUD_REFUNDED, 4: CANCELLED
    verdict: str                  # "PENDING", "HARDWARE_VERIFIED", "HARDWARE_FRAUDULENT"
    reason: str                   # Juror hardware diagnostic justification
    confidence: u8                # 0 - 100: Validator consensus confidence
    performance_score: u8         # 0 - 100: Hardware benchmark compliance score
    created_at_block: u256
    expires_at_block: u256
    audit_started_block: u256


class Contract(gl.Contract):
    """
    AgentLease: Autonomous AI Compute Hardware SLA & Hashrate Verification Escrow
    Target Network: studionet (Chain ID: 61999)
    """
    leases: TreeMap[str, LeaseOrder]
    lease_ids: DynArray[str]
    total_compute_locked: bigint
    total_leases_settled: u32
    lease_counter: u64

    def __init__(self):
        # GenVM auto-initializes TreeMap and DynArray. Do NOT reassign in __init__.
        self.total_compute_locked = bigint(0)
        self.total_leases_settled = u32(0)
        self.lease_counter = u64(0)

    @gl.public.write.payable
    def create_lease_order(self, hardware_spec: str, duration_blocks: int) -> str:
        """
        AI Renter locks compute rental funds in GEN and defines hardware SLA specs.
        """
        escrow = bigint(gl.message.value)
        if escrow <= bigint(0):
            raise gl.UserError("Lease rental escrow must be greater than 0 GEN.")

        clean_spec = str(hardware_spec).strip()
        if not clean_spec or len(clean_spec) < 10:
            raise gl.UserError("Hardware specification requirements must be at least 10 characters.")

        duration = u256(duration_blocks if duration_blocks > 0 else 5000)

        self.lease_counter = self.lease_counter + u64(1)
        lease_id = f"lease-{int(self.lease_counter)}"
        current_block = u256(int(self.lease_counter))
        expires_at = current_block + duration
        empty_host = Address("0x0000000000000000000000000000000000000000")

        new_lease = LeaseOrder(
            lease_id=lease_id,
            renter=gl.message.sender_address,
            host=empty_host,
            escrow_amount=escrow,
            hardware_spec=clean_spec,
            benchmark_log_url="",
            status=u8(0),  # OPEN
            verdict="PENDING",
            reason="Lease order open. Awaiting GPU host benchmark proof submission.",
            confidence=u8(0),
            performance_score=u8(0),
            created_at_block=current_block,
            expires_at_block=expires_at,
            audit_started_block=u256(0),
        )

        self.leases[lease_id] = new_lease
        self.lease_ids.append(lease_id)
        self.total_compute_locked = self.total_compute_locked + escrow

        return lease_id

    @gl.public.write
    def submit_hardware_proof(self, lease_id: str, benchmark_log_url: str) -> None:
        """
        GPU Host claims the lease and submits the live hardware benchmark proof URL.
        """
        if lease_id not in self.leases:
            raise gl.UserError(f"Lease {lease_id} does not exist.")

        l = self.leases[lease_id]
        if l.status != u8(0):
            raise gl.UserError(f"Lease {lease_id} is not open for submission.")

        if gl.message.sender_address == l.renter:
            raise gl.UserError("Renter cannot claim and host their own compute lease.")

        clean_url = str(benchmark_log_url).strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            raise gl.UserError("Valid public benchmark log URL (http/https) is required.")

        self.lease_counter = self.lease_counter + u64(1)
        l.host = gl.message.sender_address
        l.benchmark_log_url = clean_url
        l.status = u8(1)  # IN_AUDIT
        l.audit_started_block = u256(int(self.lease_counter))
        l.reason = "Hardware proof submitted. AI jury verifying GPU benchmarks and SLA compliance."

    @gl.public.write
    def adjudicate_hardware(self, lease_id: str) -> None:
        """
        AI Jury fetches benchmark log directly on-chain via gl.nondet.web.render,
        evaluates GPU model validity, VRAM capacity, and synthetic benchmark scores,
        and reaches consensus on VERDICT (HARDWARE_VERIFIED or HARDWARE_FRAUDULENT).
        """
        if lease_id not in self.leases:
            raise gl.UserError(f"Lease {lease_id} does not exist.")

        l = self.leases[lease_id]
        if l.status != u8(1):
            raise gl.UserError(f"Lease {lease_id} is not awaiting hardware adjudication.")

        log_url = l.benchmark_log_url
        spec_requirements = l.hardware_spec

        def leader_fn():
            raw_log = ""
            fetch_error = False
            try:
                raw_log = gl.nondet.web.render(log_url, mode="text")
            except Exception:
                fetch_error = True

            if fetch_error or not raw_log or len(raw_log.strip()) == 0:
                return {
                    "verdict": "HARDWARE_FRAUDULENT",
                    "confidence": 100,
                    "performance_score": 0,
                    "reason": "Could not access or render benchmark log URL. Evidence is missing or 404."
                }

            truncated_log = raw_log[:6500] if len(raw_log) > 6500 else raw_log

            prompt = f"""You are the Chief Hardware Inspector of the AgentLease Compute Court on GenLayer.
Evaluate whether the submitted GPU/hardware benchmark log satisfies the Renter's Service Level Agreement.

RENTER HARDWARE REQUIREMENTS:
{spec_requirements}

LIVE EXTRACTED BENCHMARK EVIDENCE:
{truncated_log}

EVALUATION CRITERIA:
1. Hardware Authenticity: Verify GPU model names, total memory (VRAM), and device IDs. Check for spoofing or throttling.
2. Performance Invariants: Does the benchmark score (TFLOPS, memory bandwidth, compute throughput) meet the demanded criteria?
3. Compute performance_score (0-100).
4. Output "HARDWARE_VERIFIED" if performance_score >= 70 and specs match.
   Otherwise output "HARDWARE_FRAUDULENT".

Respond ONLY with valid JSON without markdown fences:
{{
  "verdict": "HARDWARE_VERIFIED"|"HARDWARE_FRAUDULENT",
  "confidence": <0-100>,
  "performance_score": <0-100>,
  "reason": "<rigorous hardware inspection and benchmark diagnostic justification>"
}}"""

            raw_res = gl.nondet.exec_prompt(prompt, response_format="json")

            parsed = None
            if isinstance(raw_res, dict):
                parsed = raw_res
            elif isinstance(raw_res, str):
                cleaned = raw_res.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                elif cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()
                try:
                    parsed = json.loads(cleaned)
                except Exception:
                    pass

            if not parsed or "verdict" not in parsed:
                return {
                    "verdict": "HARDWARE_FRAUDULENT",
                    "confidence": 50,
                    "performance_score": 0,
                    "reason": "Consensus failed to parse validator output."
                }

            verdict_str = str(parsed.get("verdict", "")).strip().upper()
            if verdict_str not in ("HARDWARE_VERIFIED", "HARDWARE_FRAUDULENT"):
                verdict_str = "HARDWARE_FRAUDULENT"

            def _clean_num(val, default):
                try:
                    s = int(val)
                    return max(0, min(100, s))
                except Exception:
                    return default

            conf_val = _clean_num(parsed.get("confidence"), 85)
            score_val = _clean_num(parsed.get("performance_score"), 85 if verdict_str == "HARDWARE_VERIFIED" else 20)
            reason_str = str(parsed.get("reason", "Hardware verification audit concluded."))

            return {
                "verdict": verdict_str,
                "confidence": conf_val,
                "performance_score": score_val,
                "reason": reason_str
            }

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader = leader_res.calldata
            if isinstance(leader, str):
                try:
                    leader = json.loads(leader)
                except Exception:
                    return False
            if not isinstance(leader, dict) or "verdict" not in leader:
                return False

            mine = leader_fn()
            # Semantic Consensus: Compare VERDICT ONLY!
            return mine["verdict"] == leader["verdict"]

        adjudication_res = gl.vm.run_nondet(leader_fn, validator_fn)

        verdict = adjudication_res["verdict"]
        reason = adjudication_res["reason"]
        confidence = u8(int(adjudication_res["confidence"]))
        performance_score = u8(int(adjudication_res["performance_score"]))

        l.verdict = verdict
        l.reason = reason
        l.confidence = confidence
        l.performance_score = performance_score

        escrow_val = l.escrow_amount
        self.total_compute_locked = self.total_compute_locked - escrow_val
        self.total_leases_settled = self.total_leases_settled + u32(1)

        if verdict == "HARDWARE_VERIFIED":
            l.status = u8(2)  # SETTLED_PAID
            gl.get_contract_at(l.host).emit_transfer(value=u256(escrow_val))
        else:
            l.status = u8(3)  # FRAUD_REFUNDED
            # Refund escrowed funds back to the renter
            gl.get_contract_at(l.renter).emit_transfer(value=u256(escrow_val))

    @gl.public.write
    def cancel_or_reclaim(self, lease_id: str) -> None:
        """
        Renter can cancel an unclaimed lease after expiration, or if audit stalled.
        """
        if lease_id not in self.leases:
            raise gl.UserError(f"Lease {lease_id} does not exist.")

        l = self.leases[lease_id]
        if gl.message.sender_address != l.renter:
            raise gl.UserError("Only the compute renter can cancel or reclaim.")

        self.lease_counter = self.lease_counter + u64(1)
        current_block = u256(int(self.lease_counter))

        if l.status == u8(1):
            if current_block < (l.audit_started_block + u256(50)):
                raise gl.UserError("Cannot reclaim: Hardware benchmark is under active jury evaluation.")
        elif l.status == u8(0):
            if current_block < l.expires_at_block:
                raise gl.UserError("Cannot cancel: Lease duration has not yet expired.")
        else:
            raise gl.UserError("Lease is already settled or reclaimed.")

        l.status = u8(4)  # CANCELLED
        l.verdict = "CANCELLED"
        l.reason = "Lease cancelled and funds reclaimed by renter."

        escrow_val = l.escrow_amount
        self.total_compute_locked = self.total_compute_locked - escrow_val

        gl.get_contract_at(l.renter).emit_transfer(value=u256(escrow_val))

    # --- Read-only Views ---

    @gl.public.view
    def get_lease(self, lease_id: str) -> str:
        """Returns JSON serialized representation of a compute lease order."""
        if lease_id not in self.leases:
            raise gl.UserError(f"Lease {lease_id} does not exist.")

        l = self.leases[lease_id]
        data = {
            "lease_id": l.lease_id,
            "renter": _addr_str(l.renter),
            "host": _addr_str(l.host),
            "escrow_amount": str(l.escrow_amount),
            "hardware_spec": l.hardware_spec,
            "benchmark_log_url": l.benchmark_log_url,
            "status": int(l.status),
            "verdict": l.verdict,
            "reason": l.reason,
            "confidence": int(l.confidence),
            "performance_score": int(l.performance_score),
            "created_at_block": str(l.created_at_block),
            "expires_at_block": str(l.expires_at_block),
        }
        return json.dumps(data)

    @gl.public.view
    def get_lease_count(self) -> int:
        return len(self.lease_ids)

    @gl.public.view
    def get_lease_id_by_index(self, idx: int) -> str:
        if idx < 0 or idx >= len(self.lease_ids):
            raise gl.UserError("Index out of bounds.")
        return self.lease_ids[idx]

    @gl.public.view
    def get_leases_paginated(self, offset: int, limit: int) -> str:
        total = len(self.lease_ids)
        if offset < 0 or offset >= total or limit <= 0:
            return json.dumps([])

        end = min(offset + limit, total)
        leases_list = []
        for i in range(offset, end):
            lid = self.lease_ids[i]
            l = self.leases[lid]
            leases_list.append({
                "lease_id": l.lease_id,
                "renter": _addr_str(l.renter),
                "host": _addr_str(l.host),
                "escrow_amount": str(l.escrow_amount),
                "hardware_spec": l.hardware_spec,
                "benchmark_log_url": l.benchmark_log_url,
                "status": int(l.status),
                "verdict": l.verdict,
                "reason": l.reason,
                "confidence": int(l.confidence),
                "performance_score": int(l.performance_score),
                "created_at_block": str(l.created_at_block),
                "expires_at_block": str(l.expires_at_block),
            })
        return json.dumps(leases_list)

    @gl.public.view
    def get_stats(self) -> str:
        data = {
            "total_leases": len(self.lease_ids),
            "total_compute_locked": str(self.total_compute_locked),
            "total_leases_settled": int(self.total_leases_settled),
        }
        return json.dumps(data)
