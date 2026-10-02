import os
import sys

# Ensure tests dir is on sys.path
sys.path.insert(0, os.path.dirname(__file__))

from test_agentlease import (
    test_agentlease_lifecycle,
    test_fresh_challenge_and_signed_telemetry_verifications,
    test_cryptographic_attestation_seal_and_machine_origin_verification,
    test_degraded_hardware_partial_payout,
    test_appeal_changed_to_degraded_host_loses_bond_to_renter,
    test_appeal_changed_to_degraded_renter_loses_bond_to_host,
    test_appeal_rejected_preserves_degraded_verdict_and_routes_bond_to_host,
    test_appeal_upheld_refunds_bond_and_reverses_settlement,
    test_renter_appeal_dismissed_preserves_verified_and_forfeits_bond,
    test_table_finalize_settlement_transaction_path,
    test_cancel_or_reclaim_with_time_mechanism,
    test_views_and_pagination,
)
from test_frontend_finalize_path import (
    test_frontend_write_contract_table_finalize_path,
    test_frontend_write_contract_appeal_changed_to_degraded_forfeits_bond,
    test_frontend_write_contract_rejects_unregistered_and_forged_seals,
)

__all__ = [
    "test_agentlease_lifecycle",
    "test_fresh_challenge_and_signed_telemetry_verifications",
    "test_cryptographic_attestation_seal_and_machine_origin_verification",
    "test_degraded_hardware_partial_payout",
    "test_appeal_changed_to_degraded_host_loses_bond_to_renter",
    "test_appeal_changed_to_degraded_renter_loses_bond_to_host",
    "test_appeal_rejected_preserves_degraded_verdict_and_routes_bond_to_host",
    "test_appeal_upheld_refunds_bond_and_reverses_settlement",
    "test_renter_appeal_dismissed_preserves_verified_and_forfeits_bond",
    "test_table_finalize_settlement_transaction_path",
    "test_cancel_or_reclaim_with_time_mechanism",
    "test_views_and_pagination",
    "test_frontend_write_contract_table_finalize_path",
    "test_frontend_write_contract_appeal_changed_to_degraded_forfeits_bond",
    "test_frontend_write_contract_rejects_unregistered_and_forged_seals",
]
