import pytest
from ml_service.main import (
    health_check,
    predict_matches,
    predict_eta,
    predict_demand,
    predict_trust,
    MatchRequest,
    CandidateFeatures,
    ETARequest,
    DemandRequest,
    TrustRequest,
)

def test_health_endpoint():
    data = health_check()
    assert data["status"] == "online"
    assert "service" in data

def test_predict_matches_endpoint():
    req = MatchRequest(
        user_id="test-user-123",
        candidates=[
            CandidateFeatures(
                ride_id="ride-1",
                route_overlap_pct=92.0,
                departure_diff_mins=10.0,
                pickup_dev_km=0.5,
                dest_dev_km=0.2,
                driver_rating=4.9,
                driver_trust_score=95.0,
                cancellation_rate=0.05,
                gender_pref_match=1,
            ),
            CandidateFeatures(
                ride_id="ride-2",
                route_overlap_pct=30.0,
                departure_diff_mins=85.0,
                pickup_dev_km=4.5,
                dest_dev_km=3.8,
                driver_rating=3.8,
                driver_trust_score=65.0,
                cancellation_rate=0.40,
                gender_pref_match=0,
            ),
        ],
    )
    res = predict_matches(req)
    assert len(res.ranked_rides) == 2
    # Verify highest match score is ranked first
    assert res.ranked_rides[0].ride_id == "ride-1"
    assert res.ranked_rides[0].match_score > res.ranked_rides[1].match_score

def test_predict_eta_endpoint():
    req = ETARequest(
        distance_km=15.5,
        departure_hour=18,
        day_of_week=4,
    )
    res = predict_eta(req)
    assert res.predicted_duration_mins > 0
    assert res.traffic_level == "High"

def test_predict_demand_endpoint():
    req = DemandRequest(
        origin="Chandigarh Railway Station",
        hour=17,
        day_of_week=4,
    )
    res = predict_demand(req)
    assert res.demand_level in ["High", "Very High"]

def test_predict_trust_endpoint():
    req = TrustRequest(
        user_id="user-suspicious",
        total_requests=20,
        cancellation_count=15,
        unique_drivers_contacted=12,
        user_rating=3.1,
        account_age_days=2,
    )
    res = predict_trust(req)
    assert res.is_suspicious is True
    assert len(res.risk_factors) > 0
