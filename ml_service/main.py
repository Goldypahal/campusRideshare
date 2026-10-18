import os
import pickle
import numpy as np
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(
    title="CampusRideshare ML Intelligence Microservice",
    description="Microservice for spatial route ranking, ETA prediction, spatial-temporal demand forecasting, and trust anomaly detection.",
    version="1.0.0"
)

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")

# Lazy-loaded model references
matching_model = None
eta_model = None

# Model Registry mapping
MODEL_REGISTRY = {
    "xgb": "matching_xgb.pkl",
    "rf": "matching_rf.pkl",
    "lr": "matching_lr.pkl",
}

def load_models():
    global matching_model, eta_model
    selected_type = os.getenv("MATCHING_MODEL_TYPE", "xgb")
    
    # Order of preference: selected env -> xgb -> rf -> lr
    candidate_paths = [
        os.path.join(MODEL_DIR, MODEL_REGISTRY.get(selected_type, "matching_xgb.pkl")),
        os.path.join(MODEL_DIR, "matching_xgb.pkl"),
        os.path.join(MODEL_DIR, "matching_rf.pkl"),
        os.path.join(MODEL_DIR, "matching_lr.pkl"),
    ]

    for path in candidate_paths:
        if os.path.exists(path):
            try:
                with open(path, "rb") as f:
                    matching_model = pickle.load(f)
                break
            except Exception:
                continue

    eta_path = os.path.join(MODEL_DIR, "eta_rf.pkl")
    if os.path.exists(eta_path):
        try:
            with open(eta_path, "rb") as f:
                eta_model = pickle.load(f)
        except Exception:
            eta_model = None

@app.on_event("startup")
def startup_event():
    load_models()

# --- Request / Response Schemas ---

class CandidateFeatures(BaseModel):
    ride_id: str
    route_overlap_pct: float = Field(..., ge=0, le=100)
    departure_diff_mins: float = Field(..., ge=0)
    pickup_dev_km: float = Field(..., ge=0)
    dest_dev_km: float = Field(..., ge=0)
    driver_rating: float = Field(4.5, ge=1.0, le=5.0)
    driver_trust_score: float = Field(85.0, ge=0, le=100)
    cancellation_rate: float = Field(0.0, ge=0, le=1.0)
    gender_pref_match: int = Field(1, ge=0, le=1)

class MatchRequest(BaseModel):
    user_id: Optional[str] = None
    candidates: List[CandidateFeatures]

class MatchPrediction(BaseModel):
    ride_id: str
    match_score: int
    match_probability: float
    reasons: List[str]

class MatchResponse(BaseModel):
    ranked_rides: List[MatchPrediction]
    model_version: str

class ETARequest(BaseModel):
    distance_km: float = Field(..., gt=0)
    departure_hour: int = Field(12, ge=0, le=23)
    day_of_week: int = Field(1, ge=0, le=6)

class ETAResponse(BaseModel):
    predicted_duration_mins: int
    confidence: float
    traffic_level: str

class DemandRequest(BaseModel):
    origin: str
    date: Optional[str] = None
    hour: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)

class DemandResponse(BaseModel):
    demand_index: int
    demand_level: str
    recommendation_prompt: str

class TrustRequest(BaseModel):
    user_id: str
    total_requests: int
    cancellation_count: int
    unique_drivers_contacted: int
    user_rating: float
    account_age_days: int

class TrustResponse(BaseModel):
    trust_score: int
    is_suspicious: bool
    risk_factors: List[str]


# --- Endpoints ---

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "CampusRideshare ML Intelligence Core",
        "matching_model_loaded": matching_model is not None,
        "eta_model_loaded": eta_model is not None,
    }

@app.post("/predict/matches", response_model=MatchResponse)
def predict_matches(req: MatchRequest):
    if not req.candidates:
        return MatchResponse(ranked_rides=[], model_version="v2-ml-ranker")

    feature_matrix = []
    for c in req.candidates:
        feature_matrix.append([
            c.route_overlap_pct,
            c.departure_diff_mins,
            c.pickup_dev_km,
            c.dest_dev_km,
            c.driver_rating,
            c.driver_trust_score,
            c.cancellation_rate,
            c.gender_pref_match,
        ])
    
    X = np.array(feature_matrix)
    
    if matching_model is not None:
        try:
            probs = matching_model.predict_proba(X)[:, 1]
        except Exception:
            probs = [0.5] * len(X)
    else:
        # Heuristic fallback if model binary is missing
        probs = []
        for c in req.candidates:
            raw = (c.route_overlap_pct * 0.4 - c.departure_diff_mins * 0.3 + c.driver_rating * 10) / 100
            probs.append(float(np.clip(raw, 0.1, 0.99)))

    predictions = []
    for c, prob in zip(req.candidates, probs):
        score = int(round(float(prob) * 100))
        reasons = []
        if c.route_overlap_pct >= 80:
            reasons.append(f"High route overlap ({int(c.route_overlap_pct)}%)")
        elif c.route_overlap_pct >= 50:
            reasons.append(f"{int(c.route_overlap_pct)}% route similarity")

        if c.departure_diff_mins <= 15:
            reasons.append(f"Departure within {int(c.departure_diff_mins)} mins")

        if c.driver_rating >= 4.5:
            reasons.append(f"{c.driver_rating}★ highly rated driver")

        if c.driver_trust_score >= 85:
            reasons.append("Verified high trust rating")

        predictions.append(MatchPrediction(
            ride_id=c.ride_id,
            match_score=score,
            match_probability=round(float(prob), 4),
            reasons=reasons,
        ))

    # Sort descending by match score
    predictions.sort(key=lambda x: x.match_score, reverse=True)
    return MatchResponse(ranked_rides=predictions, model_version="v2-ml-ranker")



@app.post("/predict/eta", response_model=ETAResponse)
def predict_eta(req: ETARequest):
    traffic_factor = 1.6 if (8 <= req.departure_hour <= 10 or 17 <= req.departure_hour <= 19) else 1.0
    traffic_level = "High" if traffic_factor > 1.2 else "Normal"

    if eta_model is not None:
        try:
            X = np.array([[req.distance_km, req.departure_hour, req.day_of_week, traffic_factor]])
            duration = float(eta_model.predict(X)[0])
        except Exception:
            duration = req.distance_km * 2.2 * traffic_factor
    else:
        duration = req.distance_km * 2.2 * traffic_factor

    duration_mins = max(5, int(round(duration)))
    confidence = 0.88 if req.distance_km <= 30 else 0.75

    return ETAResponse(
        predicted_duration_mins=duration_mins,
        confidence=confidence,
        traffic_level=traffic_level,
    )


@app.post("/predict/demand", response_model=DemandResponse)
def predict_demand(req: DemandRequest):
    # Spatial-temporal heuristics
    is_friday_evening = (req.day_of_week == 4) and (16 <= req.hour <= 19)
    is_monday_morning = (req.day_of_week == 0) and (7 <= req.hour <= 9)
    is_station_or_airport = any(term in req.origin.lower() for term in ["railway", "station", "airport", "gate"])

    if is_friday_evening and is_station_or_airport:
        index = 92
        level = "Very High"
        prompt = "🔥 Very high demand expected for campus outflow! Post your ride early to lock in riders."
    elif is_monday_morning:
        index = 78
        level = "High"
        prompt = "📈 High morning commute demand expected. Drivers earn 20% more matches."
    elif 11 <= req.hour <= 15:
        index = 45
        level = "Medium"
        prompt = "Moderate activity expected around campus."
    else:
        index = 22
        level = "Low"
        prompt = "Low demand window."

    return DemandResponse(
        demand_index=index,
        demand_level=level,
        recommendation_prompt=prompt,
    )


@app.post("/predict/trust", response_model=TrustResponse)
def predict_trust(req: TrustRequest):
    risk_factors = []
    
    # Calculate anomaly signals
    cancel_ratio = req.cancellation_count / max(req.total_requests, 1)
    if cancel_ratio > 0.6 and req.total_requests >= 5:
        risk_factors.append(f"High cancellation rate ({int(cancel_ratio * 100)}%)")

    if req.unique_drivers_contacted >= 10 and req.cancellation_count >= 5:
        risk_factors.append("Mass request & cancellation pattern detected")

    if req.user_rating < 3.5 and req.total_requests >= 3:
        risk_factors.append(f"Below average rating ({req.user_rating}★)")

    base_score = 100
    base_score -= int(cancel_ratio * 40)
    base_score -= len(risk_factors) * 15
    if req.account_age_days < 7:
        base_score -= 10
        
    final_trust = max(10, min(100, base_score))
    is_suspicious = len(risk_factors) >= 2 or final_trust < 40

    return TrustResponse(
        trust_score=final_trust,
        is_suspicious=is_suspicious,
        risk_factors=risk_factors,
    )
