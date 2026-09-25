import pytest
import json


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
        # Return default plausible benchmark log
        return """
[GPU DIAGNOSTIC REPORT]
Device 0: NVIDIA H100 80GB HBM3
Device ID: 0x2330
VRAM Total: 81920 MiB
Driver Version: 535.104.05
CUDA Version: 12.2
GEMM Peak TFLOPS (FP16): 989.4 TFLOPS
Memory Bandwidth: 3.35 TB/s
ECC Errors: 0
PCIe Link: Gen5 x16 (64 GB/s)
Status: Healthy, No Throttling detected.
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
            data_match = re.search(r"<benchmark_data>(.*?)</benchmark_data>", prompt, re.DOTALL)
            bench_data = data_match.group(1).lower() if data_match else prompt.lower()
            
            # Appeal prompt check
            if "Supreme Magistrate" in prompt:
                if "1060" in bench_data or "severe thermal" in bench_data:
                    return {
                        "canary": canary,
                        "verdict": "APPEAL_REJECTED",
                        "confidence": 95,
                        "performance_score": 10,
                        "reason": "Appeal dismissed: Hardware benchmark is fraudulent or sub-par."
                    }
                elif "degraded" in bench_data or "700 tflops" in bench_data:
                    return {
                        "canary": canary,
                        "verdict": "APPEAL_UPHELD_DEGRADED",
                        "confidence": 92,
                        "performance_score": 68,
                        "reason": "Appeal partially upheld: Hardware operating in degraded capacity."
                    }
                return {
                    "canary": canary,
                    "verdict": "APPEAL_UPHELD_VERIFIED",
                    "confidence": 98,
                    "performance_score": 92,
                    "reason": "Appeal upheld: Verified hardware authenticated."
                }

            # Standard Adjudication prompt check
            if "1060" in bench_data or "severe thermal" in bench_data or "404" in bench_data:
                return {
                    "canary": canary,
                    "verdict": "HARDWARE_FRAUDULENT",
                    "confidence": 99,
                    "performance_score": 15,
                    "reason": "Hardware mismatch detected. Host provided low-tier consumer GPU failing enterprise SLA requirements."
                }
            elif "degraded" in bench_data or "700 tflops" in bench_data:
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
                "reason": "Authentic NVIDIA H100 80GB SXM5 verified. Benchmark throughput at 989 TFLOPS satisfies requirements."
            }

        self.nondet.exec_prompt = _exec_prompt

    def get_contract_at(self, address):
        addr_str = str(address)
        if addr_str not in self.contracts:
            self.contracts[addr_str] = MockTransferContract(addr_str)
        return self.contracts[addr_str]


@pytest.fixture
def mock_gl_env():
    """Provides a mocked GenLayer execution environment."""
    return MockGenLayerEnv()
