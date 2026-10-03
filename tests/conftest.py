import pytest
import json
import calendar
import hmac
import hashlib
from datetime import datetime, timezone, timedelta

# ============================================================================
# TEST-ONLY RSA KEYPAIRS — DO NOT USE IN PRODUCTION
# These keys are used EXCLUSIVELY for unit testing signature verification.
# The production contract deployed on-chain uses COMPLETELY DIFFERENT keypairs
# whose private keys are held only by physical hardware nodes and are NEVER
# stored in this repository or any public location.
# ============================================================================
TEST_NODE1_N = int("125055803882412125793798903957061541086038124808870145340309304240497505012993063966826369949569636089119480847968092992887695534482661759338099546048270618290086607841041853145773041742645874366533360307275069872743853431029796621068136392281380553860007141252785422007529758653944575564961465665435431923543")
TEST_NODE1_D = int("13961451267828077580470502371980717390372547006803788649769286703586880871544307053378696107506973222028129680500580543275223242758006549061198432619535730861908604660362064437258312747897159846080409114895122476697944506677893846659992505692025125916464976618543035613608369725714871637900975341814208747073")

TEST_NODE2_N = int("127227212864879978306604942755329668212275970031013386804284296302672325908047306442701140653903325514639921795391935974039658915601921849571809057562854571499081411613385239513967628692422333295731256544765986716367788568840156421717104283661114809757272718078032796785527862603990226384737603934434466793217")
TEST_NODE2_D = int("12902631595965892027672329011176193960119714059460710724038711565049876865085339828770126702680725622432593957960359468078457024660630229228494322672067952485660698654679252283608367907492085320620195213565948824518064911826478645788754253300083971173880954783188075756029111244900186355307621478047119455593")

# Backward-compat aliases used by older test code
NODE1_N = TEST_NODE1_N
NODE1_D = TEST_NODE1_D
NODE2_N = TEST_NODE2_N
NODE2_D = TEST_NODE2_D


def make_machine_signature(nonce, session, machine_id, host):
    canonical = f"{nonce.strip()}:{session.strip()}:{machine_id.strip()}:{str(host).strip().lower()}"
    if machine_id == "NODE-GPU-H100-US-EAST-42":
        n, d = NODE1_N, NODE1_D
    elif machine_id == "NODE-GPU-A100-EU-WEST-01":
        n, d = NODE2_N, NODE2_D
    else:
        # Fallback dummy for unregistered machines
        n, d = NODE1_N, 123456789
    digest_int = int.from_bytes(hashlib.sha256(canonical.encode("utf-8")).digest(), "big") % n
    sig_int = pow(digest_int, d, n)
    return hex(sig_int)


# Backward compatibility alias
def make_attestation_seal(nonce, session, machine_id, host):
    return make_machine_signature(nonce, session, machine_id, host)


def make_benchmark_log(nonce, session, host, machine_id="NODE-GPU-H100-US-EAST-42", model="NVIDIA H100 80GB HBM3", tflops=989.4, vram=81920, is_valid_signature=True):
    sig = make_machine_signature(nonce, session, machine_id, host) if is_valid_signature else "0xdeadbeef0000111122223333444455556666777788889999aaaabbbbccccdddd"
    return f"""[SOVEREIGN COMPUTE BENCHMARK DAEMON v2.4]
Contract Challenge Nonce: {nonce}
Bound Session ID: {session}
Machine ID: {machine_id}
Designated Host: {str(host)}
Attestation Signature: {sig}
Device 0: {model}
Device ID: 0x2330
VRAM Total: {vram} MiB
GEMM Peak TFLOPS (FP16): {tflops} TFLOPS
Status: Healthy, Authentic
"""


class MockReturn:
    def __init__(self, calldata):
        self.calldata = calldata


class MockMessage:
    def __init__(self, sender_address="0x1111111111111111111111111111111111111111", value=0):
        self.sender_address = sender_address
        self.value = value

    @property
    def sender(self):
        return self.sender_address

    @sender.setter
    def sender(self, val):
        self.sender_address = val


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
        default_host = "0xbbbb111122223333444455556666777788889999"
        return make_benchmark_log("CHALLENGE-lease-1-1790424000", "SESS-lease-1-1790424000", default_host)


class MockGenVM:
    Return = MockReturn
    UserError = Exception

    def run_nondet_unsafe(self, leader_fn, validator_fn):
        leader_res = leader_fn()
        ret = MockReturn(leader_res)
        valid = validator_fn(ret)
        if not valid:
            raise RuntimeError("Consensus validator rejected leader output")
        return leader_res

    def run_nondet(self, leader_fn, validator_fn):
        return self.run_nondet_unsafe(leader_fn, validator_fn)


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
        self.get_web_page = lambda url: self.nondet.web.render(url)
        self.exec_prompt = _exec_prompt

    def advance_time(self, seconds: int):
        """Advances consensus block time deterministically."""
        self.current_dt += timedelta(seconds=seconds)
        self.message_raw = {"datetime": self.current_dt.isoformat()}

    def get_contract_at(self, address):
        addr_str = str(address)
        if addr_str not in self.contracts:
            self.contracts[addr_str] = MockTransferContract(addr_str)
        return self.contracts[addr_str]


def patch_contract_with_test_keys(contract_instance):
    """
    Replaces the production RSA public keys in a Contract instance with
    TEST-ONLY keypairs so unit tests can generate valid signatures.
    
    This is necessary because the production contract uses different keypairs
    whose private keys are never in this repository.
    """
    for mid, n_val in [("NODE-GPU-H100-US-EAST-42", str(TEST_NODE1_N)),
                        ("NODE-GPU-A100-EU-WEST-01", str(TEST_NODE2_N))]:
        if mid in contract_instance.authorized_machines:
            m = contract_instance.authorized_machines[mid]
            m.pubkey_n = n_val


@pytest.fixture
def mock_gl_env():
    """Provides a mocked GenLayer execution environment."""
    return MockGenLayerEnv()
