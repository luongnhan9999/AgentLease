import pytest
import json
import calendar
from datetime import datetime, timezone, timedelta


class MockReturn:
    def __init__(self, calldata):
        self.calldata = calldata


class MockMessage:
    def __init__(self, sender_address="0x1111111111111111111111111111111111111111", value=0):
        self.sender_address = sender_address
        self.value = value


class MockTransferContract:
    def __init__(self, address):
        self.address = address
        self.transfers = []

    def emit_transfer(self, value):
        self.transfers.append({"to": self.address, "value": value})
        return True


class MockWeb:
    def __init__(self, mock_responses=None):
        self.mock_responses = mock_responses or {}

    def render(self, url, mode="text"):
        if url in self.mock_responses:
            return self.mock_responses[url]
        # Return default authentic, signed, challenge-bound benchmark log
        return """
[SOVEREIGN COMPUTE BENCHMARK DAEMON v2.4]
Contract Challenge Nonce: CHALLENGE-lease-1-1790424000
Bound Session ID: SESS-lease-1-1790424000
Machine ID: NODE-GPU-H100-US-EAST-42
Cryptographic Attestation Seal: SIG-ED25519-948f29ea17b849c0d2948cba47291048
Device 0: NVIDIA H100 80GB HBM3
Device ID: 0x2330
VRAM Total: 81920 MiB
Driver Version: 535.104.05
CUDA Version: 12.2
GEMM Peak TFLOPS (FP16): 989.4 TFLOPS
Memory Bandwidth: 3.35 TB/s
ECC Errors: 0
PCIe Link: Gen5 x16 (64 GB/s)
Status: Healthy, Authentic, No Throttling detected.
"""


class MockGenVM:
    Return = MockReturn

    def run_nondet(self, leader_fn, validator_fn):
        leader_res = leader_fn()
        ret = MockReturn(leader_res)
        valid = validator_fn(ret)
        if not valid:
            raise RuntimeError("Consensus validator rejected leader output")
        return leader_res


class MockPublicWrite:
    def __call__(self, fn):
        return fn

    @property
    def payable(self):
        return lambda fn: fn


class MockPublic:
    def __init__(self):
        self.write = MockPublicWrite()
        self.view = lambda fn: fn


class MockContractBase:
    pass


class MockGenLayerEnv:
    def __init__(self):
        self.Contract = MockContractBase
        self.public = MockPublic()
        self.message = MockMessage()
        self.current_dt = datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc)
        self.message_raw = {"datetime": self.current_dt.isoformat()}
        self.nondet = type("NonDet", (), {})()
        self.vm = MockGenVM()
        self.contracts = {}
        self.UserError = Exception

        self.nondet.web = MockWeb()
        self.exec_prompt_override = None

        def _exec_prompt(prompt, response_format="json"):
            if self.exec_prompt_override:
                return self.exec_prompt_override(prompt, response_format)
            canary = "CANARY_AGENT_LEASE_V2"
            
            import re
            data_match = re.search(r"<benchmark_telemetry>(.*?)</benchmark_telemetry>", prompt, re.DOTALL)
            if not data_match:
                data_match = re.search(r"<appellate_evidence>(.*?)</appellate_evidence>", prompt, re.DOTALL)
            bench_data = data_match.group(1).lower() if data_match else prompt.lower()
            
            # 1. Challenge Nonce / Replay Attack check
            if "replay_attack" in bench_data or "mismatched_challenge" in bench_data or "missing_challenge" in bench_data:
                return {
                    "canary": canary,
                    "verdict": "HARDWARE_FRAUDULENT",
                    "confidence": 100,
                    "performance_score": 0,
                    "reason": "Replay attack detected: Contract challenge nonce is missing or mismatched."
                }

            # 2. Session / Machine binding check
            if "unbound_session" in bench_data or "wrong_machine" in bench_data:
                return {
                    "canary": canary,
                    "verdict": "HARDWARE_FRAUDULENT",
                    "confidence": 100,
                    "performance_score": 0,
                    "reason": "Telemetry unbound: Benchmark does not originate from the designated leased machine session."
                }

            # 3. Cryptographic signature / authentication check
            if "unsigned_source" in bench_data or "fake_signature" in bench_data:
                return {
                    "canary": canary,
                    "verdict": "HARDWARE_FRAUDULENT",
                    "confidence": 100,
                    "performance_score": 0,
                    "reason": "Unauthenticated source: Missing cryptographic attestation signature."
                }

            # Appeal prompt check
            if "Supreme Magistrate" in prompt:
                if "1060" in bench_data or "severe thermal" in bench_data or "appeal_fail" in bench_data:
                    return {
                        "canary": canary,
                        "verdict": "APPEAL_REJECTED",
                        "confidence": 95,
                        "performance_score": 10,
                        "reason": "Appeal dismissed: Hardware benchmark evidence fails authentication standards."
                    }
                elif "degraded" in bench_data or "700 tflops" in bench_data:
                    return {
                        "canary": canary,
                        "verdict": "APPEAL_UPHELD_DEGRADED",
                        "confidence": 92,
                        "performance_score": 68,
                        "reason": "Appeal partially upheld: Hardware operating in degraded capacity."
                    }
                elif "fraud_proven" in bench_data:
                    return {
                        "canary": canary,
                        "verdict": "APPEAL_UPHELD_FRAUDULENT",
                        "confidence": 96,
                        "performance_score": 10,
                        "reason": "Appeal upheld: Counterfeit hardware conclusively proven."
                    }
                return {
                    "canary": canary,
                    "verdict": "APPEAL_UPHELD_VERIFIED",
                    "confidence": 98,
                    "performance_score": 92,
                    "reason": "Appeal upheld: Verified hardware authenticated."
                }

            # Standard Adjudication prompt check
            if "1060" in bench_data or "severe thermal" in bench_data or "404" in bench_data or "fraud" in bench_data:
                return {
                    "canary": canary,
                    "verdict": "HARDWARE_FRAUDULENT",
                    "confidence": 99,
                    "performance_score": 15,
                    "reason": "Hardware mismatch detected. Host provided low-tier consumer GPU failing enterprise SLA requirements."
                }
            elif "degraded" in bench_data or "700 tflops" in bench_data or "throttled" in bench_data:
                return {
                    "canary": canary,
                    "verdict": "HARDWARE_DEGRADED",
                    "confidence": 92,
                    "performance_score": 68,
                    "reason": "Hardware partially compliant: 72GB VRAM available and 710 TFLOPS measured."
                }
            return {
                "canary": canary,
                "verdict": "HARDWARE_VERIFIED",
                "confidence": 98,
                "performance_score": 95,
                "reason": "Authentic NVIDIA H100 80GB SXM5 verified with valid challenge nonce and cryptographic attestation."
            }

        self.nondet.exec_prompt = _exec_prompt

    def advance_time(self, seconds: int):
        """Advances consensus block time deterministically."""
        self.current_dt += timedelta(seconds=seconds)
        self.message_raw = {"datetime": self.current_dt.isoformat()}

    def get_contract_at(self, address):
        addr_str = str(address)
        if addr_str not in self.contracts:
            self.contracts[addr_str] = MockTransferContract(addr_str)
        return self.contracts[addr_str]


@pytest.fixture
def mock_gl_env():
    """Provides a mocked GenLayer execution environment."""
    return MockGenLayerEnv()
