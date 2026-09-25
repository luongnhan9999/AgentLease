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
            # Default mock LLM evaluation
            if "NVIDIA H100" in prompt and "81920 MiB" in prompt:
                return {
                    "verdict": "HARDWARE_VERIFIED",
                    "confidence": 98,
                    "performance_score": 95,
                    "reason": "Authentic NVIDIA H100 80GB SXM5 verified. Benchmark throughput at 989 TFLOPS satisfies requirements."
                }
            elif "GTX 1060" in prompt or "throttling" in prompt.lower() or "404" in prompt:
                return {
                    "verdict": "HARDWARE_FRAUDULENT",
                    "confidence": 99,
                    "performance_score": 15,
                    "reason": "Hardware mismatch detected. Host provided low-tier consumer GPU failing enterprise SLA requirements."
                }
            return {
                "verdict": "HARDWARE_VERIFIED",
                "confidence": 90,
                "performance_score": 88,
                "reason": "Hardware specifications and synthetic benchmark logs validated successfully."
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
