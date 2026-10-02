# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json

if not hasattr(gl, "UserError"):
    gl.UserError = getattr(gl.vm, "UserError", Exception)

CANARY_TOKEN = "CANARY_AGENT_LEASE_V2"
ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
COOLING_OFF_SECONDS = u256(300)       # 5 minutes challenge / cooling-off window (manipulation-resistant)
DEFAULT_LEASE_DURATION = u256(86400)  # 24 hours default rental duration
STALL_TIMEOUT_SECONDS = u256(3600)    # 1 hour maximum audit lock before renter can reclaim


def _addr_str(addr: Address) -> str:
    """Safely format an Address instance into a hex string."""
    try:
        return addr.as_hex
    except Exception:
        return str(addr)


def _current_timestamp() -> u256:
    """
    Derives manipulation-resistant execution timestamp from consensus block context (gl.message_raw['datetime']).
    Safely parses UTC ISO string including 'Z' suffix across all Python runtime versions.
    """
    import calendar
    from datetime import datetime, timezone
    try:
        if hasattr(gl, "message_raw") and isinstance(gl.message_raw, dict):
            raw_val = gl.message_raw.get("datetime", "")
            if raw_val:
                dt_str = str(raw_val).strip().replace("Z", "+00:00")
                dt = datetime.fromisoformat(dt_str)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                ts = calendar.timegm(dt.utctimetuple())
                if ts > 0:
                    return u256(ts)
    except Exception:
        pass
    raise gl.UserError("Trusted execution timestamp unavailable from runtime context.")


@allow_storage
@dataclass
class MachineIdentity:
    """Storage struct representing an enrolled authentic compute hardware node."""
    machine_id: str
    hardware_spec: str
    pubkey_n: str        # RSA public key modulus (decimal string)
    pubkey_e: u32        # RSA public exponent (e.g. 65537)
    is_active: bool
    registered_at: u256


def _verify_telemetry_attestation(
    raw_log: str,
    expected_nonce: str,
    expected_session: str,
    expected_host: str,
    authorized_machines: TreeMap[str, MachineIdentity],
) -> tuple[bool, str, dict]:
    """
    Programmatically verifies machine origin authenticity, digital signature against enrolled public keys,
    fresh contract challenge nonce, and bound session ID.
    NO secret keys exist in the contract, and arbitrary machine IDs are strictly rejected.
    """
    import re
    import hashlib
    telemetry_data = {}

    clean_text = raw_log.strip()
    json_match = re.search(r"\{[\s\S]*\}", clean_text)
    if json_match:
        try:
            telemetry_data = json.loads(json_match.group(0))
        except Exception:
            telemetry_data = {}

    found_nonce = ""
    found_session = ""
    found_host = ""
    found_sig = ""
    found_machine = ""

    if telemetry_data:
        found_nonce = str(telemetry_data.get("challenge_nonce") or telemetry_data.get("nonce") or "")
        found_session = str(telemetry_data.get("session_id") or "")
        found_host = str(telemetry_data.get("host_address") or telemetry_data.get("host") or "")
        found_sig = str(telemetry_data.get("signature") or telemetry_data.get("attestation_signature") or telemetry_data.get("seal") or "")
        found_machine = str(telemetry_data.get("machine_id") or "")

    if not found_nonce:
        m = re.search(r'CHALLENGE[_-][A-Za-z0-9_-]+', clean_text)
        if m:
            found_nonce = m.group(0)

    if not found_session:
        m = re.search(r'SESS[_-][A-Za-z0-9_-]+', clean_text)
        if m:
            found_session = m.group(0)

    if not found_machine:
        m = re.search(r'(?:machine[_\s]+id|machine)[\"\'\s:=]+([A-Za-z0-9._-]+)', clean_text, re.IGNORECASE)
        if m:
            found_machine = m.group(1)

    if not found_sig:
        m = re.search(r'(?:attestation[_\s]+signature|signature|seal)[\"\'\s:=]+([0-9a-fA-Fx]+)', clean_text, re.IGNORECASE)
        if m:
            found_sig = m.group(1)

    # 1. Nonce Anti-Replay Check
    if not found_nonce or found_nonce.strip() != expected_nonce.strip():
        return (
            False,
            f"Replay attack detected: Expected fresh challenge {expected_nonce}, got {found_nonce or 'MISSING'}",
            telemetry_data,
        )

    # 2. Session ID Check
    if not found_session or found_session.strip() != expected_session.strip():
        return (
            False,
            f"SESSION_UNBOUND: Expected session {expected_session}, got {found_session or 'MISSING'}",
            telemetry_data,
        )

    # 3. Machine Registry Origin Verification
    clean_mid = found_machine.strip()
    if not clean_mid:
        return (
            False,
            "MISSING_MACHINE_ORIGIN: Telemetry log omits machine_id identifier.",
            telemetry_data,
        )

    if clean_mid not in authorized_machines:
        return (
            False,
            f"UNREGISTERED_MACHINE_ORIGIN: Machine '{clean_mid}' is not registered in authorized hardware registry.",
            telemetry_data,
        )

    machine_profile = authorized_machines[clean_mid]
    if not machine_profile.is_active:
        return (
            False,
            f"DEACTIVATED_MACHINE_ORIGIN: Machine '{clean_mid}' is deactivated.",
            telemetry_data,
        )

    # 4. Asymmetric Cryptographic Signature Verification
    if not found_sig:
        return (
            False,
            f"MISSING_HARDWARE_SIGNATURE: Telemetry log lacks digital signature from machine '{clean_mid}'.",
            telemetry_data,
        )

    try:
        # Canonical message: nonce:session:machine_id:host_address
        canonical = f"{expected_nonce.strip()}:{expected_session.strip()}:{clean_mid}:{expected_host.strip().lower()}"
        pub_n = int(machine_profile.pubkey_n)
        pub_e = int(machine_profile.pubkey_e)
        expected_digest = int.from_bytes(hashlib.sha256(canonical.encode("utf-8")).digest(), "big") % pub_n

        clean_sig_str = found_sig.strip()
        sig_val = int(clean_sig_str, 16) if clean_sig_str.startswith(("0x", "0X")) else int(clean_sig_str)

        # Mathematical verification: pow(sig, e, n) == digest
        recovered_digest = pow(sig_val, pub_e, pub_n)
        if recovered_digest != expected_digest:
            return (
                False,
                f"INVALID_HARDWARE_SIGNATURE: Digital signature mismatch for enrolled machine '{clean_mid}'.",
                telemetry_data,
            )
    except Exception as e:
        return (
            False,
            f"CORRUPT_HARDWARE_SIGNATURE: Unable to parse signature for machine '{clean_mid}': {str(e)[:100]}",
            telemetry_data,
        )

    return (True, "ATTESTATION_PASSED", telemetry_data)


@allow_storage
@dataclass
class LeaseOrder:
    """Storage struct representing an autonomous compute hardware lease escrow."""
    lease_id: str
    renter: Address
    host: Address
    dispute_initiator: Address
    escrow_amount: bigint
    dispute_bond: bigint          # Staked bond by appellant
    hardware_spec: str            # Required GPU model, min VRAM, compute benchmark thresholds
    benchmark_log_url: str        # Live proof URL containing hardware benchmark log
    challenge_nonce: str          # Fresh contract-issued challenge nonce for telemetry replay protection
    session_id: str               # Unique leased session / machine binding identifier
    status: u8                    # 0: OPEN, 1: IN_AUDIT, 2: SETTLED_PAID, 3: FRAUD_REFUNDED, 4: CANCELLED, 5: SETTLED_PARTIAL, 6: DISPUTED, 7: AUDIT_COMPLETED
    verdict: str                  # "PENDING", "HARDWARE_VERIFIED", "HARDWARE_DEGRADED", "HARDWARE_FRAUDULENT", "DISPUTED"
    initial_verdict: str          # Preserved initial verdict across any appeal outcome
    initial_status: u8            # Preserved initial status
    reason: str                   # Juror hardware diagnostic justification
    confidence: u8                # 0 - 100: Validator consensus confidence
    performance_score: u8         # 0 - 100: Hardware benchmark compliance score
    created_at_time: u256         # Deterministic creation timestamp from consensus block
    expires_at_time: u256         # Deterministic expiration timestamp
    audit_started_time: u256      # Audit initiation timestamp
    audit_completed_time: u256    # Audit completion timestamp (cooling window baseline)


class Contract(gl.Contract):
    """
    AgentLease: Autonomous AI Compute Hardware SLA & Hashrate Verification Escrow
    Target Network: studionet (Chain ID: 61999)
    """
    leases: TreeMap[str, LeaseOrder]
    lease_ids: DynArray[str]
    authorized_machines: TreeMap[str, MachineIdentity]
    authorized_machine_ids: DynArray[str]
    owner: Address
    total_compute_locked: bigint
    total_leases_settled: u32
    lease_counter: u64

    def __init__(self):
        self.owner = getattr(gl.message, "sender", getattr(gl.message, "sender_address", Address(ZERO_ADDRESS)))
        self.total_compute_locked = bigint(0)
        self.total_leases_settled = u32(0)
        self.lease_counter = u64(0)

        # Pre-enroll verified enterprise hardware benchmark clusters with genuine public keys
        node1_id = "NODE-GPU-H100-US-EAST-42"
        self.authorized_machines[node1_id] = MachineIdentity(
            machine_id=node1_id,
            hardware_spec="NVIDIA H100 80GB SXM5, min 80GB VRAM, >900 TFLOPS FP16",
            pubkey_n="125055803882412125793798903957061541086038124808870145340309304240497505012993063966826369949569636089119480847968092992887695534482661759338099546048270618290086607841041853145773041742645874366533360307275069872743853431029796621068136392281380553860007141252785422007529758653944575564961465665435431923543",
            pubkey_e=u32(65537),
            is_active=True,
            registered_at=u256(0),
        )
        self.authorized_machine_ids.append(node1_id)

        node2_id = "NODE-GPU-A100-EU-WEST-01"
        self.authorized_machines[node2_id] = MachineIdentity(
            machine_id=node2_id,
            hardware_spec="NVIDIA A100 80GB PCIe, min 80GB VRAM, >300 TFLOPS FP16",
            pubkey_n="127227212864879978306604942755329668212275970031013386804284296302672325908047306442701140653903325514639921795391935974039658915601921849571809057562854571499081411613385239513967628692422333295731256544765986716367788568840156421717104283661114809757272718078032796785527862603990226384737603934434466793217",
            pubkey_e=u32(65537),
            is_active=True,
            registered_at=u256(0),
        )
        self.authorized_machine_ids.append(node2_id)

    @gl.public.write
    def register_authorized_machine(self, machine_id: str, hardware_spec: str, pubkey_n: str, pubkey_e: int = 65537) -> None:
        """Enrolls a certified hardware node with its public key (restricted to contract owner)."""
        sender_str = _addr_str(gl.message.sender).lower()
        owner_str = _addr_str(self.owner).lower()
        if sender_str != owner_str:
            raise gl.UserError("Only contract owner can enroll authorized hardware machines.")
        
        clean_id = str(machine_id).strip()
        clean_spec = str(hardware_spec).strip()
        clean_n = str(pubkey_n).strip()
        if not clean_id or len(clean_id) < 3:
            raise gl.UserError("Invalid machine identifier.")
        if not clean_spec:
            raise gl.UserError("Invalid hardware specification.")
        if not clean_n or not clean_n.isdigit() or int(clean_n) <= 0:
            raise gl.UserError("Invalid RSA public key modulus.")

        current_time = _current_timestamp()
        if clean_id not in self.authorized_machines:
            self.authorized_machine_ids.append(clean_id)

        self.authorized_machines[clean_id] = MachineIdentity(
            machine_id=clean_id,
            hardware_spec=clean_spec,
            pubkey_n=clean_n,
            pubkey_e=u32(pubkey_e if pubkey_e > 0 else 65537),
            is_active=True,
            registered_at=current_time,
        )

    @gl.public.view
    def get_authorized_machine(self, machine_id: str) -> str:
        if machine_id not in self.authorized_machines:
            raise gl.UserError("Machine not found in authorized hardware registry.")
        m = self.authorized_machines[machine_id]
        return json.dumps({
            "machine_id": m.machine_id,
            "hardware_spec": m.hardware_spec,
            "pubkey_n": m.pubkey_n,
            "pubkey_e": int(m.pubkey_e),
            "is_active": m.is_active,
            "registered_at": str(m.registered_at),
        })

    @gl.public.view
    def get_all_authorized_machines(self) -> str:
        machines_list = []
        for mid in self.authorized_machine_ids:
            m = self.authorized_machines[mid]
            machines_list.append({
                "machine_id": m.machine_id,
                "hardware_spec": m.hardware_spec,
                "pubkey_n": m.pubkey_n,
                "pubkey_e": int(m.pubkey_e),
                "is_active": m.is_active,
                "registered_at": str(m.registered_at),
            })
        return json.dumps(machines_list)

    @gl.public.write.payable
    def create_lease_order(self, hardware_spec: str, duration_seconds: int = 86400) -> str:
        escrow = bigint(gl.message.value)
        if escrow <= bigint(0):
            raise gl.UserError("Lease rental escrow must be greater than 0 GEN.")

        clean_spec = str(hardware_spec).strip()
        if not clean_spec or len(clean_spec) < 10:
            raise gl.UserError("Hardware specification requirements must be at least 10 characters.")

        dur = u256(duration_seconds if duration_seconds > 0 else 86400)
        current_time = _current_timestamp()

        self.lease_counter = self.lease_counter + u64(1)
        lease_id = f"lease-{int(self.lease_counter)}"
        expires_at = current_time + dur

        challenge_nonce = f"CHALLENGE-{lease_id}-{int(current_time)}"
        session_id = f"SESS-{lease_id}-{int(current_time)}"

        order = LeaseOrder(
            lease_id=lease_id,
            renter=gl.message.sender,
            host=Address(ZERO_ADDRESS),
            dispute_initiator=Address(ZERO_ADDRESS),
            escrow_amount=escrow,
            dispute_bond=bigint(0),
            hardware_spec=clean_spec,
            benchmark_log_url="",
            challenge_nonce=challenge_nonce,
            session_id=session_id,
            status=u8(0),  # 0: OPEN
            verdict="PENDING",
            initial_verdict="PENDING",
            initial_status=u8(0),
            reason="Order created. Awaiting host claim and proof telemetry submission.",
            confidence=u8(0),
            performance_score=u8(0),
            created_at_time=current_time,
            expires_at_time=expires_at,
            audit_started_time=u256(0),
            audit_completed_time=u256(0),
        )

        self.leases[lease_id] = order
        self.lease_ids.append(lease_id)
        self.total_compute_locked = self.total_compute_locked + escrow
        return lease_id

    @gl.public.write
    def claim_lease(self, lease_id: str) -> None:
        if lease_id not in self.leases:
            raise gl.UserError("Lease order not found.")

        l = self.leases[lease_id]
        if l.status != u8(0):
            raise gl.UserError("Lease order is not in OPEN status.")

        current_time = _current_timestamp()
        if current_time >= l.expires_at_time:
            raise gl.UserError("Lease order has expired.")

        sender = gl.message.sender
        if _addr_str(sender).lower() == _addr_str(l.renter).lower():
            raise gl.UserError("Renter cannot claim their own lease order as host.")

        l.host = sender
        l.reason = f"Claimed by host {_addr_str(sender)}. Awaiting benchmark telemetry proof."
        self.leases[lease_id] = l

    @gl.public.write
    def submit_hardware_proof(self, lease_id: str, benchmark_log_url: str) -> None:
        """Host commits benchmark log proof URL for audit (enters IN_AUDIT status 1)."""
        if lease_id not in self.leases:
            raise gl.UserError("Lease order not found.")

        l = self.leases[lease_id]
        if l.status != u8(0):
            raise gl.UserError("Lease order is not open for telemetry submission.")

        sender = gl.message.sender
        host_str = _addr_str(l.host)
        if host_str == ZERO_ADDRESS:
            l.host = sender
            host_str = _addr_str(sender)
        elif host_str.lower() != _addr_str(sender).lower():
            raise gl.UserError("Only designated host can submit benchmark proofs.")

        clean_url = str(benchmark_log_url).strip()
        if not clean_url or len(clean_url) < 8:
            raise gl.UserError("Invalid benchmark telemetry URL.")

        current_time = _current_timestamp()
        l.benchmark_log_url = clean_url
        l.status = u8(1)  # 1: IN_AUDIT
        l.audit_started_time = current_time
        l.reason = "Benchmark telemetry submitted. Awaiting validator adjudication."
        self.leases[lease_id] = l

    @gl.public.write
    def adjudicate_hardware(self, lease_id: str) -> None:
        """Executes intelligent consensus audit and asymmetric attestation verification on submitted telemetry."""
        if lease_id not in self.leases:
            raise gl.UserError("Lease order not found.")

        l = self.leases[lease_id]
        if l.status != u8(1):
            raise gl.UserError("Lease order is not in audit status.")

        host_str = _addr_str(l.host)
        clean_url = l.benchmark_log_url

        web_content = ""
        try:
            web_content = gl.get_web_page(clean_url)
        except Exception as e:
            web_content = f"FETCH_FAILED: {str(e)}"

        # Programmatic Asymmetric Machine Origin & Cryptographic Attestation Verification
        passed_attestation, attestation_reason, telemetry_dict = _verify_telemetry_attestation(
            web_content, l.challenge_nonce, l.session_id, host_str, self.authorized_machines
        )

        audit_done_time = _current_timestamp()

        # If cryptographic attestation fails, immediate FRAUD without burning LLM calls
        if not passed_attestation:
            l.status = u8(7)  # 7: AUDIT_COMPLETED
            l.verdict = "HARDWARE_FRAUDULENT"
            l.initial_verdict = "HARDWARE_FRAUDULENT"
            l.initial_status = u8(7)
            l.reason = f"Cryptographic attestation failed: {attestation_reason}"
            l.confidence = u8(100)
            l.performance_score = u8(0)
            l.audit_completed_time = audit_done_time
            self.leases[lease_id] = l
            return

        task = f"""You are an elite, objective Hardware SLA & Compute Benchmarking Validator on GenLayer.
Evaluate whether the host provided authentic GPU hardware telemetry matching renter specifications.

LEASE DETAILS:
- Lease ID: {l.lease_id}
- Required Spec: {l.hardware_spec}
- Assigned Host: {host_str}
- Contract Challenge Nonce: {l.challenge_nonce}
- Contract Session ID: {l.session_id}
- Canary Security Token: {CANARY_TOKEN}

<benchmark_telemetry>
{web_content[:4000]}
</benchmark_telemetry>

VALIDATION RULES:
1. Anti-Replay: The benchmark log MUST explicitly include the exact challenge nonce '{l.challenge_nonce}' and session ID '{l.session_id}'.
2. Spec Match: Check GPU model name, minimum VRAM, memory bandwidth, or compute scores against requirements.
3. Scoring & Verdicts:
   - score >= 90: "HARDWARE_VERIFIED" (Hardware authentic and meets specs)
   - 60 <= score < 90: "HARDWARE_DEGRADED" (Marginal underperformance or thermal throttling, partial SLA payout)
   - score < 60: "HARDWARE_FRAUDULENT" (Spoofed specs, synthetic device ID, failed benchmark, or spoofed origin)

OUTPUT FORMAT:
Respond with ONLY a raw JSON object:
{{
    "verdict": "HARDWARE_VERIFIED" | "HARDWARE_DEGRADED" | "HARDWARE_FRAUDULENT",
    "score": <integer 0-100>,
    "confidence": <integer 0-100>,
    "canary_echo": "{CANARY_TOKEN}",
    "reason": "<Detailed diagnosis under 180 chars>"
}}"""

        try:
            raw_res = gl.exec_prompt(task)
            if isinstance(raw_res, dict):
                parsed = raw_res
            else:
                clean_res = raw_res.strip()
                if clean_res.startswith("```json"):
                    clean_res = clean_res[7:]
                if clean_res.startswith("```"):
                    clean_res = clean_res[3:]
                if clean_res.endswith("```"):
                    clean_res = clean_res[:-3]
                clean_res = clean_res.strip()
                parsed = json.loads(clean_res)

            v = str(parsed.get("verdict", "HARDWARE_FRAUDULENT")).strip().upper()
            if v not in ["HARDWARE_VERIFIED", "HARDWARE_DEGRADED", "HARDWARE_FRAUDULENT"]:
                v = "HARDWARE_FRAUDULENT"

            score = int(parsed.get("score", 0))
            conf = int(parsed.get("confidence", 0))
            rsn = str(parsed.get("reason", "Automated consensus diagnostic completed."))[:200]

            l.verdict = v
            l.initial_verdict = v
            l.performance_score = u8(max(0, min(100, score)))
            l.confidence = u8(max(0, min(100, conf)))
            l.reason = rsn
            l.status = u8(7)  # 7: AUDIT_COMPLETED
            l.initial_status = u8(7)
            l.audit_completed_time = audit_done_time
        except Exception as e:
            l.verdict = "HARDWARE_FRAUDULENT"
            l.initial_verdict = "HARDWARE_FRAUDULENT"
            l.initial_status = u8(7)
            l.status = u8(7)  # 7: AUDIT_COMPLETED
            l.reason = f"Audit consensus failed: {str(e)[:150]}"
            l.confidence = u8(95)
            l.performance_score = u8(0)
            l.audit_completed_time = audit_done_time

        self.leases[lease_id] = l

    @gl.public.write
    def submit_benchmark_and_verify(self, lease_id: str, benchmark_log_url: str) -> None:
        """Unified method: submits proof and immediately executes audit."""
        self.submit_hardware_proof(lease_id, benchmark_log_url)
        self.adjudicate_hardware(lease_id)

    @gl.public.write
    def finalize_settlement(self, lease_id: str) -> None:
        """
        Executes financial settlement after the cooling-off window (5 min) expires without dispute.
        Preserves manipulation resistance and protects against appeal bypass.
        """
        if lease_id not in self.leases:
            raise gl.UserError("Lease order not found.")

        l = self.leases[lease_id]
        if l.status != u8(7):  # Must be AUDIT_COMPLETED
            raise gl.UserError("Lease is not awaiting final settlement (must be AUDIT_COMPLETED).")

        current_time = _current_timestamp()
        if current_time <= (l.audit_completed_time + COOLING_OFF_SECONDS):
            remaining = int((l.audit_completed_time + COOLING_OFF_SECONDS) - current_time)
            raise gl.UserError(f"Appeal cooling-off window is still active ({remaining}s remaining).")

        escrow_val = int(l.escrow_amount)
        self.total_compute_locked = self.total_compute_locked - l.escrow_amount

        if l.verdict == "HARDWARE_VERIFIED":
            l.status = u8(2)  # 2: SETTLED_PAID
            l.reason = f"Settled: Host verified. Full escrow of {escrow_val} released to host."
            self.leases[lease_id] = l
            self.total_leases_settled = self.total_leases_settled + u32(1)
            gl.get_contract_at(l.host).emit_transfer(value=u256(escrow_val))

        elif l.verdict == "HARDWARE_DEGRADED":
            l.status = u8(5)  # 5: SETTLED_PARTIAL
            host_payout = (escrow_val * 60) // 100
            renter_refund = escrow_val - host_payout
            l.reason = f"Settled: Partial SLA compliance. Host: {host_payout}, Renter: {renter_refund}."
            self.leases[lease_id] = l
            self.total_leases_settled = self.total_leases_settled + u32(1)
            if host_payout > 0:
                gl.get_contract_at(l.host).emit_transfer(value=u256(host_payout))
            if renter_refund > 0:
                gl.get_contract_at(l.renter).emit_transfer(value=u256(renter_refund))

        elif l.verdict == "HARDWARE_FRAUDULENT":
            l.status = u8(3)  # 3: FRAUD_REFUNDED
            l.reason = f"Settled: Hardware fraudulent/failed. Full escrow of {escrow_val} refunded to renter."
            self.leases[lease_id] = l
            self.total_leases_settled = self.total_leases_settled + u32(1)
            gl.get_contract_at(l.renter).emit_transfer(value=u256(escrow_val))

        else:
            raise gl.UserError(f"Invalid settlement verdict: {l.verdict}")

    @gl.public.write.payable
    def appeal_verdict(self, lease_id: str, new_evidence_url: str) -> None:
        """
        Allows renter or host to appeal a verdict during the 5-minute cooling window
        by staking an equal dispute bond.
        """
        if lease_id not in self.leases:
            raise gl.UserError("Lease order not found.")

        l = self.leases[lease_id]
        if l.status != u8(7):
            raise gl.UserError("Only completed audits (status 7) can be appealed.")

        current_time = _current_timestamp()
        if current_time > (l.audit_completed_time + COOLING_OFF_SECONDS):
            raise gl.UserError("Dispute window expired. Verdict is final.")

        sender = gl.message.sender
        sender_str = _addr_str(sender).lower()
        renter_str = _addr_str(l.renter).lower()
        host_str = _addr_str(l.host).lower()

        if sender_str != renter_str and sender_str != host_str:
            raise gl.UserError("Only renter or host can appeal the verdict.")

        bond = bigint(gl.message.value)
        min_bond = l.escrow_amount // bigint(10)
        if bond < min_bond or bond <= bigint(0):
            raise gl.UserError("Dispute bond must be at least 10% of the escrow amount.")

        clean_url = str(new_evidence_url).strip()
        if not clean_url or len(clean_url) < 8:
            raise gl.UserError("Must provide valid new telemetry evidence URL.")

        l.dispute_initiator = sender
        l.dispute_bond = bond
        l.status = u8(6)  # 6: DISPUTED
        l.benchmark_log_url = clean_url
        l.reason = f"Appealed by {_addr_str(sender)}. Staked bond: {int(bond)}. Secondary tribunal auditing..."
        self.leases[lease_id] = l

    @gl.public.write
    def adjudicate_appeal(self, lease_id: str) -> None:
        """
        High-consensus tribunal appeal adjudication.
        Correctly routes dispute bond and escrow based on appeal winner/loser while
        preserving initial_verdict and initial_status across every appeal outcome.
        """
        if lease_id not in self.leases:
            raise gl.UserError("Lease order not found.")

        l = self.leases[lease_id]
        if l.status != u8(6):  # Must be DISPUTED
            raise gl.UserError("Lease is not under dispute.")

        host_str = _addr_str(l.host)
        renter_str = _addr_str(l.renter)
        appellant = l.dispute_initiator
        appellant_str = _addr_str(appellant).lower()
        appellee = l.host if appellant_str == renter_str else l.renter

        # 1. Fetch Appeal Evidence
        appeal_evidence = ""
        try:
            appeal_evidence = gl.get_web_page(l.benchmark_log_url)
        except Exception as e:
            appeal_evidence = f"FETCH_FAILED: {str(e)}"

        # 2. Cryptographic Attestation Verification on Appeal Telemetry against Authorized Registry
        passed_attestation, attestation_reason, _ = _verify_telemetry_attestation(
            appeal_evidence, l.challenge_nonce, l.session_id, host_str, self.authorized_machines
        )

        app_verdict = "APPEAL_DISMISSED"
        app_reason = ""
        app_conf = 95

        if not passed_attestation:
            app_verdict = "APPEAL_DISMISSED"
            app_reason = f"Appeal evidence failed cryptographic attestation: {attestation_reason}"
        else:
            task = f"""You are the Supreme Magistrate and Hardware Appeal Tribunal on GenLayer.
Evaluate this contested compute lease dispute.

LEASE CONTEXT:
- Lease ID: {l.lease_id}
- Preserved Initial Verdict: {l.initial_verdict}
- Appellant: {_addr_str(appellant)} (Role: {'Renter' if appellant_str == renter_str else 'Host'})
- Appellee: {_addr_str(appellee)}
- Required Specs: {l.hardware_spec}
- Challenge Nonce: {l.challenge_nonce}
- Session ID: {l.session_id}

<appellate_evidence>
{appeal_evidence[:4000]}
</appellate_evidence>

VERDICT INSTRUCTIONS:
- 'APPEAL_UPHELD_VERIFIED': Appeal succeeded, proven authentic hardware meets specs.
- 'APPEAL_UPHELD_FRAUDULENT': Appeal succeeded, proven hardware is fraudulent/spoofed.
- 'APPEAL_UPHELD_DEGRADED': Hardware verified but degraded/throttled.
- 'APPEAL_DISMISSED': Appeal rejected. Preserved initial verdict was correct.

OUTPUT FORMAT (JSON ONLY):
{{
    "appeal_verdict": "APPEAL_UPHELD_VERIFIED" | "APPEAL_UPHELD_FRAUDULENT" | "APPEAL_UPHELD_DEGRADED" | "APPEAL_DISMISSED",
    "reason": "<Under 180 chars>",
    "confidence": <integer 0-100>
}}"""

            try:
                raw_res = gl.exec_prompt(task)
                if isinstance(raw_res, dict):
                    parsed = raw_res
                else:
                    clean_res = raw_res.strip()
                    if clean_res.startswith("```json"):
                        clean_res = clean_res[7:]
                    if clean_res.startswith("```"):
                        clean_res = clean_res[3:]
                    if clean_res.endswith("```"):
                        clean_res = clean_res[:-3]
                    clean_res = clean_res.strip()
                    parsed = json.loads(clean_res)

                app_verdict = str(parsed.get("appeal_verdict") or parsed.get("verdict", "APPEAL_DISMISSED")).strip().upper()
                if app_verdict in ["APPEAL_REJECTED", "APPEAL_DISMISSED"]:
                    app_verdict = "APPEAL_DISMISSED"
                app_reason = str(parsed.get("reason", "Supreme tribunal adjudication concluded."))[:200]
                app_conf = int(parsed.get("confidence", 95))
            except Exception as e:
                app_verdict = "APPEAL_DISMISSED"
                app_reason = f"Tribunal consensus error: {str(e)[:150]}"

        escrow_val = int(l.escrow_amount)
        bond_val = int(l.dispute_bond)
        l.confidence = u8(max(0, min(100, app_conf)))
        self.total_compute_locked = self.total_compute_locked - l.escrow_amount

        # Determine winner/loser and route funds safely
        # Note: Initial verdict and initial status are PRESERVED!
        if app_verdict == "APPEAL_UPHELD_VERIFIED":
            l.verdict = "HARDWARE_VERIFIED"
            l.status = u8(2)  # SETTLED_PAID
            appellant_won = (appellant_str == host_str)
            l.reason = f"Appeal upheld: Verified. {app_reason}"
            self.leases[lease_id] = l
            self.total_leases_settled = self.total_leases_settled + u32(1)

            gl.get_contract_at(l.host).emit_transfer(value=u256(escrow_val))
            if appellant_won:
                gl.get_contract_at(appellant).emit_transfer(value=u256(bond_val))
            else:
                gl.get_contract_at(l.host).emit_transfer(value=u256(bond_val))

        elif app_verdict == "APPEAL_UPHELD_FRAUDULENT":
            l.verdict = "HARDWARE_FRAUDULENT"
            l.status = u8(3)  # FRAUD_REFUNDED
            appellant_won = (appellant_str == renter_str)
            l.reason = f"Appeal upheld: Fraudulent. {app_reason}"
            self.leases[lease_id] = l
            self.total_leases_settled = self.total_leases_settled + u32(1)

            gl.get_contract_at(l.renter).emit_transfer(value=u256(escrow_val))
            if appellant_won:
                gl.get_contract_at(appellant).emit_transfer(value=u256(bond_val))
            else:
                gl.get_contract_at(l.renter).emit_transfer(value=u256(bond_val))

        elif app_verdict == "APPEAL_UPHELD_DEGRADED":
            l.verdict = "HARDWARE_DEGRADED"
            l.status = u8(5)  # SETTLED_PARTIAL
            host_payout = (escrow_val * 60) // 100
            renter_refund = escrow_val - host_payout
            l.reason = f"Appeal outcome: Hardware degraded. Host: {host_payout}, Renter: {renter_refund}. {app_reason}"
            self.leases[lease_id] = l
            self.total_leases_settled = self.total_leases_settled + u32(1)

            if host_payout > 0:
                gl.get_contract_at(l.host).emit_transfer(value=u256(host_payout))
            if renter_refund > 0:
                gl.get_contract_at(l.renter).emit_transfer(value=u256(renter_refund))

            # Appellant appealed for full outcome but result is degraded -> bond forfeits to appellee
            gl.get_contract_at(appellee).emit_transfer(value=u256(bond_val))

        else:  # APPEAL_DISMISSED: Preserved initial verdict stands, appellant loses dispute bond!
            l.reason = f"Appeal dismissed. Preserved verdict {l.initial_verdict} upheld. Bond forfeited to appellee. {app_reason}"
            
            # Settlement matches initial verdict
            if l.initial_verdict == "HARDWARE_VERIFIED":
                l.verdict = "HARDWARE_VERIFIED"
                l.status = u8(2)
                self.leases[lease_id] = l
                self.total_leases_settled = self.total_leases_settled + u32(1)
                gl.get_contract_at(l.host).emit_transfer(value=u256(escrow_val))
            elif l.initial_verdict == "HARDWARE_DEGRADED":
                l.verdict = "HARDWARE_DEGRADED"
                l.status = u8(5)
                host_payout = (escrow_val * 60) // 100
                renter_refund = escrow_val - host_payout
                self.leases[lease_id] = l
                self.total_leases_settled = self.total_leases_settled + u32(1)
                if host_payout > 0:
                    gl.get_contract_at(l.host).emit_transfer(value=u256(host_payout))
                if renter_refund > 0:
                    gl.get_contract_at(l.renter).emit_transfer(value=u256(renter_refund))
            else:  # HARDWARE_FRAUDULENT or other
                l.verdict = "HARDWARE_FRAUDULENT"
                l.status = u8(3)
                self.leases[lease_id] = l
                self.total_leases_settled = self.total_leases_settled + u32(1)
                gl.get_contract_at(l.renter).emit_transfer(value=u256(escrow_val))

            # Bond forfeited to appellee
            gl.get_contract_at(appellee).emit_transfer(value=u256(bond_val))

    @gl.public.write
    def cancel_or_reclaim_lease(self, lease_id: str) -> None:
        """
        Allows renter to safely reclaim escrow if order expired unfulfilled
        or if audit stalled past STALL_TIMEOUT_SECONDS (1 hour).
        """
        if lease_id not in self.leases:
            raise gl.UserError("Lease order not found.")

        l = self.leases[lease_id]
        sender_str = _addr_str(gl.message.sender).lower()
        renter_str = _addr_str(l.renter).lower()
        if sender_str != renter_str:
            raise gl.UserError("Only the compute renter can cancel or reclaim the lease.")

        current_time = _current_timestamp()

        # Case 1: Unclaimed order expired
        if l.status == u8(0) and current_time >= l.expires_at_time:
            escrow_val = int(l.escrow_amount)
            self.total_compute_locked = self.total_compute_locked - l.escrow_amount
            l.status = u8(4)  # 4: CANCELLED
            l.verdict = "CANCELLED"
            l.reason = "Lease expired unfulfilled. Escrow reclaimed by renter."
            self.leases[lease_id] = l
            gl.get_contract_at(l.renter).emit_transfer(value=u256(escrow_val))
            return

        # Case 2: Audit stalled > 1 hour
        if l.status == u8(1) and current_time >= (l.audit_started_time + STALL_TIMEOUT_SECONDS):
            escrow_val = int(l.escrow_amount)
            self.total_compute_locked = self.total_compute_locked - l.escrow_amount
            l.status = u8(4)  # 4: CANCELLED
            l.verdict = "CANCELLED"
            l.reason = "Audit stalled past timeout. Escrow reclaimed by renter."
            self.leases[lease_id] = l
            gl.get_contract_at(l.renter).emit_transfer(value=u256(escrow_val))
            return

        raise gl.UserError("Order cannot be cancelled: lease duration has not yet expired and audit is not stalled.")

    @gl.public.write
    def cancel_or_reclaim(self, lease_id: str) -> None:
        self.cancel_or_reclaim_lease(lease_id)

    # ==========================
    # PUBLIC VIEW METHODS
    # ==========================

    @gl.public.view
    def get_lease(self, lease_id: str) -> str:
        if lease_id not in self.leases:
            raise gl.UserError("Lease order not found.")
        l = self.leases[lease_id]
        data = {
            "lease_id": l.lease_id,
            "renter": _addr_str(l.renter),
            "host": _addr_str(l.host),
            "dispute_initiator": _addr_str(l.dispute_initiator),
            "escrow_amount": str(l.escrow_amount),
            "dispute_bond": str(l.dispute_bond),
            "hardware_spec": l.hardware_spec,
            "benchmark_log_url": l.benchmark_log_url,
            "challenge_nonce": l.challenge_nonce,
            "session_id": l.session_id,
            "status": int(l.status),
            "verdict": l.verdict,
            "initial_verdict": l.initial_verdict,
            "initial_status": int(l.initial_status),
            "reason": l.reason,
            "confidence": int(l.confidence),
            "performance_score": int(l.performance_score),
            "created_at_time": str(l.created_at_time),
            "expires_at_time": str(l.expires_at_time),
            "audit_started_time": str(l.audit_started_time),
            "audit_completed_time": str(l.audit_completed_time),
            # Backward compatibility fields
            "created_at_block": str(l.created_at_time),
            "expires_at_block": str(l.expires_at_time),
            "audit_started_block": str(l.audit_started_time),
            "audit_completed_block": str(l.audit_completed_time),
        }
        return json.dumps(data)

    @gl.public.view
    def get_leases_paginated(self, page: int = 0, page_size: int = 10) -> str:
        offset = max(0, page)
        limit = max(1, page_size)
        total = len(self.lease_ids)
        start_idx = offset
        end_idx = min(start_idx + limit, total)

        page_leases = []
        if start_idx < total:
            for idx in range(start_idx, end_idx):
                lid = self.lease_ids[idx]
                l = self.leases[lid]
                page_leases.append({
                    "lease_id": l.lease_id,
                    "renter": _addr_str(l.renter),
                    "host": _addr_str(l.host),
                    "dispute_initiator": _addr_str(l.dispute_initiator),
                    "escrow_amount": str(l.escrow_amount),
                    "dispute_bond": str(l.dispute_bond),
                    "hardware_spec": l.hardware_spec,
                    "benchmark_log_url": l.benchmark_log_url,
                    "challenge_nonce": l.challenge_nonce,
                    "session_id": l.session_id,
                    "status": int(l.status),
                    "verdict": l.verdict,
                    "initial_verdict": l.initial_verdict,
                    "initial_status": int(l.initial_status),
                    "reason": l.reason,
                    "confidence": int(l.confidence),
                    "performance_score": int(l.performance_score),
                    "created_at_time": str(l.created_at_time),
                    "expires_at_time": str(l.expires_at_time),
                    "audit_started_time": str(l.audit_started_time),
                    "audit_completed_time": str(l.audit_completed_time),
                    # Backward compatibility fields
                    "created_at_block": str(l.created_at_time),
                    "expires_at_block": str(l.expires_at_time),
                    "audit_started_block": str(l.audit_started_time),
                    "audit_completed_block": str(l.audit_completed_time),
                })

        return json.dumps(page_leases)

    @gl.public.view
    def get_all_leases(self) -> str:
        leases_list = []
        for lid in self.lease_ids:
            l = self.leases[lid]
            leases_list.append({
                "lease_id": l.lease_id,
                "renter": _addr_str(l.renter),
                "host": _addr_str(l.host),
                "dispute_initiator": _addr_str(l.dispute_initiator),
                "escrow_amount": str(l.escrow_amount),
                "dispute_bond": str(l.dispute_bond),
                "hardware_spec": l.hardware_spec,
                "benchmark_log_url": l.benchmark_log_url,
                "challenge_nonce": l.challenge_nonce,
                "session_id": l.session_id,
                "status": int(l.status),
                "verdict": l.verdict,
                "initial_verdict": l.initial_verdict,
                "initial_status": int(l.initial_status),
                "reason": l.reason,
                "confidence": int(l.confidence),
                "performance_score": int(l.performance_score),
                "created_at_time": str(l.created_at_time),
                "expires_at_time": str(l.expires_at_time),
                "audit_started_time": str(l.audit_started_time),
                "audit_completed_time": str(l.audit_completed_time),
                # Backward compatibility fields
                "created_at_block": str(l.created_at_time),
                "expires_at_block": str(l.expires_at_time),
                "audit_started_block": str(l.audit_started_time),
                "audit_completed_block": str(l.audit_completed_time),
            })
        return json.dumps(leases_list)

    @gl.public.view
    def get_stats(self) -> str:
        data = {
            "total_leases": len(self.lease_ids),
            "total_compute_locked": str(self.total_compute_locked),
            "total_leases_settled": int(self.total_leases_settled),
            "authorized_nodes_count": len(self.authorized_machine_ids),
        }
        return json.dumps(data)

    @gl.public.view
    def get_lease_count(self) -> int:
        return len(self.lease_ids)

    @gl.public.view
    def get_lease_id_by_index(self, index: int) -> str:
        if index < 0 or index >= len(self.lease_ids):
            raise gl.UserError("Index out of bounds.")
        return self.lease_ids[index]
