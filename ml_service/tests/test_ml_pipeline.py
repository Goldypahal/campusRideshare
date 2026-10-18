import pytest
from fastapi.testclient import TestClient
from ml_service.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"

def test_predict_matches_endpoint():
    payload = {
        "user_id": "test-user-123",
        "candidates": [
            {
                "ride_id": "ride-1",
                "route_overlap_pct": 92.0,
                "departure_diff_mins": 10.0,
                "pickup_dev_km": 0.5,
                "dest_dev_km": 0.2,
                "driver_rating": 4.9,
                "driver_trust_score": 95.0,
                "cancellation_rate": 0.05,
                "gender_pref_match": 1,
            },
            {
                "ride_id": "ride-2",
                "route_overlap_pct": 30.0,
                "departure_diff_mins": 85.0,
                "pickup_dev_km": 4.5,
                "dest_dev_km": 3.8,
                "driver_rating": 3.8,
                "driver_trust_score": 65.0,
                "cancellation_rate": 0.40,
                "gender_pref_match": 0,
            }
        ]
    }
    response = client.post("/predict/matches", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert len(data["ranked_rides"]) == 2
    # Verify highest match score is ranked first
    assert data["ranked_rides"][0]["ride_id"] == "ride-1"
    assert data["ranked_rides"][0]["match_score"] > data["ranked_rides"][1]["match_score"]

def test_predict_eta_endpoint():
    payload = {
        "distance_km": 15.5,
        "departure_hour": 18,
        "day_of_week": 4
    }
    response = client.post("/predict/eta", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["predicted_duration_mins"] > 0
    assert data["traffic_level"] == "High"

def test_predict_demand_endpoint():
    payload = {
        "origin": "Chandigarh Railway Station",
        "hour": 17,
        "day_of_week": 4
    }
    response = client.post("/predict/demand", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["demand_level"] in ["High", "Very High"]

def test_predict_trust_endpoint():
    payload = {
        "user_id": "user-suspicious",
        "total_requests": 20,
        "cancellation_count": 15,
        "unique_drivers_contacted": 12,
        "user_rating": 3.1,
        "account_age_days": 2
    }
    response = client.post("/predict/trust", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["is_suspicious"] is True
    assert len(data["risk_factors"]) > 0
