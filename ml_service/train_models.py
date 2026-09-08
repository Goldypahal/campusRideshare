import os
import pickle
import math
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.metrics import mean_absolute_error, mean_squared_error

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

def generate_synthetic_ride_data(n_samples=2000):
    np.random.seed(42)
    
    # Feature columns:
    # 0: route_overlap_pct (0 to 100)
    # 1: departure_diff_mins (0 to 120)
    # 2: pickup_dev_km (0 to 5)
    # 3: dest_dev_km (0 to 5)
    # 4: driver_rating (3.0 to 5.0)
    # 5: driver_trust_score (50 to 100)
    # 6: cancellation_rate (0.0 to 0.5)
    # 7: gender_pref_match (0 or 1)
    
    route_overlap = np.random.uniform(10, 100, n_samples)
    departure_diff = np.random.exponential(scale=20, size=n_samples)
    departure_diff = np.clip(departure_diff, 0, 120)
    pickup_dev = np.random.uniform(0.1, 5.0, n_samples)
    dest_dev = np.random.uniform(0.1, 5.0, n_samples)
    driver_rating = np.random.uniform(3.5, 5.0, n_samples)
    driver_trust = np.random.uniform(60, 100, n_samples)
    cancellation_rate = np.random.beta(a=1, b=9, size=n_samples)
    gender_match = np.random.choice([0, 1], p=[0.3, 0.7], size=n_samples)
    
    # Ground truth acceptance probability (synthetic utility function)
    utility = (
        0.04 * route_overlap
        - 0.03 * departure_diff
        - 0.4 * pickup_dev
        - 0.4 * dest_dev
        + 0.5 * driver_rating
        + 0.02 * driver_trust
        - 3.0 * cancellation_rate
        + 0.8 * gender_match
        - 2.0 # bias
    )
    
    prob = 1 / (1 + np.exp(-utility))
    accepted = (np.random.uniform(0, 1, n_samples) < prob).astype(int)
    
    df = pd.DataFrame({
        "route_overlap_pct": route_overlap,
        "departure_diff_mins": departure_diff,
        "pickup_dev_km": pickup_dev,
        "dest_dev_km": dest_dev,
        "driver_rating": driver_rating,
        "driver_trust_score": driver_trust,
        "cancellation_rate": cancellation_rate,
        "gender_pref_match": gender_match,
        "accepted": accepted,
        "prob": prob,
    })
    return df

def generate_synthetic_eta_data(n_samples=1500):
    np.random.seed(101)
    distance_km = np.random.uniform(1.0, 45.0, n_samples)
    hour = np.random.randint(0, 24, n_samples)
    day_of_week = np.random.randint(0, 7, n_samples)
    traffic_factor = np.where((hour >= 8) & (hour <= 10) | (hour >= 17) & (hour <= 19), 1.6, 1.0)
    
    # Base travel speed ~ 30 km/h -> 2 mins/km + traffic + noise
    duration_mins = (distance_km * 2.0) * traffic_factor + np.random.normal(0, 2.5, n_samples)
    duration_mins = np.maximum(duration_mins, 3.0)
    
    df = pd.DataFrame({
        "distance_km": distance_km,
        "hour": hour,
        "day_of_week": day_of_week,
        "traffic_factor": traffic_factor,
        "duration_mins": duration_mins,
    })
    return df

def calculate_ndcg_at_k(y_true, y_score, k=5):
    order = np.argsort(y_score)[::-1][:k]
    y_true_sorted = y_true[order]
    gains = 2**y_true_sorted - 1
    discounts = np.log2(np.arange(2, k + 2))
    dcg = np.sum(gains / discounts)
    
    ideal_order = np.argsort(y_true)[::-1][:k]
    ideal_gains = 2**y_true[ideal_order] - 1
    idcg = np.sum(ideal_gains / discounts)
    return dcg / idcg if idcg > 0 else 0.0

def evaluate_matching_models(df):
    X = df[["route_overlap_pct", "departure_diff_mins", "pickup_dev_km", "dest_dev_km", "driver_rating", "driver_trust_score", "cancellation_rate", "gender_pref_match"]].values
    y = df["accepted"].values
    
    split = int(len(df) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    
    # 1. Rule-Based Baseline
    rule_scores = (
        X_test[:, 0] * 0.4  # route_overlap
        - X_test[:, 1] * 0.3 # departure_diff
        + (X_test[:, 4] / 5.0) * 20.0 # rating
        + (X_test[:, 5] / 100.0) * 20.0 # trust
    )
    
    # 2. Logistic Regression
    lr = LogisticRegression(max_iter=1000)
    lr.fit(X_train, y_train)
    lr_probs = lr.predict_proba(X_test)[:, 1]
    
    # 3. Random Forest Classifier
    rf = RandomForestClassifier(n_estimators=100, random_state=42)
    rf.fit(X_train, y_train)
    rf_probs = rf.predict_proba(X_test)[:, 1]
    
    # 4. XGBoost Ranker / Classifier
    if HAS_XGBOOST:
        xgb_model = xgb.XGBClassifier(n_estimators=100, learning_rate=0.08, random_state=42, eval_metric="logloss")
        xgb_model.fit(X_train, y_train)
        xgb_probs = xgb_model.predict_proba(X_test)[:, 1]
    else:
        xgb_model = rf
        xgb_probs = rf_probs

    # Evaluate Precision@5 and NDCG@5 in query batches of 10 candidate rides
    batch_size = 10
    n_batches = len(y_test) // batch_size
    
    metrics = {
        "Rule-based": {"p5": [], "r5": [], "ndcg5": []},
        "Logistic Regression": {"p5": [], "r5": [], "ndcg5": []},
        "Random Forest": {"p5": [], "r5": [], "ndcg5": []},
        "XGBoost Ranker": {"p5": [], "r5": [], "ndcg5": []},
    }
    
    models_dict = {
        "Rule-based": rule_scores,
        "Logistic Regression": lr_probs,
        "Random Forest": rf_probs,
        "XGBoost Ranker": xgb_probs,
    }
    
    for i in range(n_batches):
        start = i * batch_size
        end = start + batch_size
        y_b = y_test[start:end]
        if np.sum(y_b) == 0:
            continue
            
        for m_name, scores in models_dict.items():
            s_b = scores[start:end]
            top_k_idx = np.argsort(s_b)[::-1][:5]
            hits = np.sum(y_b[top_k_idx])
            p5 = hits / 5.0
            r5 = hits / max(np.sum(y_b), 1)
            ndcg5 = calculate_ndcg_at_k(y_b, s_b, k=5)
            
            metrics[m_name]["p5"].append(p5)
            metrics[m_name]["r5"].append(r5)
            metrics[m_name]["ndcg5"].append(ndcg5)

    print("\n=======================================================")
    print("MODEL EVALUATION BENCHMARK RESULTS")
    print("=======================================================")
    print(f"{'Model':<22} | {'Precision@5':<12} | {'Recall@5':<10} | {'NDCG@5':<8}")
    print("-" * 60)
    for m_name in metrics:
        avg_p5 = np.mean(metrics[m_name]["p5"]) * 100
        avg_r5 = np.mean(metrics[m_name]["r5"]) * 100
        avg_ndcg = np.mean(metrics[m_name]["ndcg5"])
        print(f"{m_name:<22} | {avg_p5:>10.1f}% | {avg_r5:>8.1f}% | {avg_ndcg:>7.2f}")
    print("=======================================================\n")
    
    # Save trained models
    with open(os.path.join(MODEL_DIR, "matching_lr.pkl"), "wb") as f:
        pickle.dump(lr, f)
    with open(os.path.join(MODEL_DIR, "matching_rf.pkl"), "wb") as f:
        pickle.dump(rf, f)
    if HAS_XGBOOST:
        with open(os.path.join(MODEL_DIR, "matching_xgb.pkl"), "wb") as f:
            pickle.dump(xgb_model, f)
            
    return xgb_model

def train_eta_model(eta_df):
    X = eta_df[["distance_km", "hour", "day_of_week", "traffic_factor"]].values
    y = eta_df["duration_mins"].values
    
    split = int(len(eta_df) * 0.8)
    X_train, X_test = X[:split], X[split:]
    y_train, y_test = y[:split], y[split:]
    
    eta_model = RandomForestRegressor(n_estimators=100, random_state=42)
    eta_model.fit(X_train, y_train)
    
    preds = eta_model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = math.sqrt(mean_squared_error(y_test, preds))
    
    print(f"[ETA Model] Trained successfully: MAE={mae:.2f} mins, RMSE={rmse:.2f} mins")
    
    with open(os.path.join(MODEL_DIR, "eta_rf.pkl"), "wb") as f:
        pickle.dump(eta_model, f)
    return eta_model

if __name__ == "__main__":
    print("[ML Training] Starting Machine Learning Training Pipeline for CampusRideshare...")
    ride_df = generate_synthetic_ride_data()
    evaluate_matching_models(ride_df)
    
    eta_df = generate_synthetic_eta_data()
    train_eta_model(eta_df)
    print("[OK] Model artifacts successfully saved to ml_service/models/")

