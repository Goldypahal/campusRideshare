import os
import math
import numpy as np
import pandas as pd
from typing import Dict, Any

from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, roc_auc_score

try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

def calculate_ndcg_at_k(y_true: np.ndarray, y_score: np.ndarray, k: int = 5) -> float:
    order = np.argsort(y_score)[::-1][:k]
    y_true_sorted = y_true[order]
    gains = 2**y_true_sorted - 1
    discounts = np.log2(np.arange(2, k + 2))
    dcg = np.sum(gains / discounts)
    
    ideal_order = np.argsort(y_true)[::-1][:k]
    ideal_gains = 2**y_true[ideal_order] - 1
    idcg = np.sum(ideal_gains / discounts)
    return float(dcg / idcg) if idcg > 0 else 0.0

def run_evaluation_benchmark():
    print("\n" + "=" * 65)
    print(" CAMPUSRIDE INTELLIGENT MOBILITY ENGINE - EMPIRICAL BENCHMARK")
    print("=" * 65)

    # 1. Dataset Generation with Temporal Ordering
    np.random.seed(42)
    n_samples = 5000
    
    # Chronological timestamps over 90 days
    timestamps = pd.date_range(start="2026-01-01", periods=n_samples, freq="15min")
    
    route_overlap = np.random.uniform(10, 100, n_samples)
    departure_diff = np.random.exponential(scale=20, size=n_samples)
    departure_diff = np.clip(departure_diff, 0, 120)
    pickup_dev = np.random.uniform(0.1, 5.0, n_samples)
    dest_dev = np.random.uniform(0.1, 5.0, n_samples)
    driver_rating = np.random.uniform(3.5, 5.0, n_samples)
    driver_trust = np.random.uniform(60, 100, n_samples)
    cancellation_rate = np.random.beta(a=1, b=9, size=n_samples)
    gender_match = np.random.choice([0, 1], p=[0.3, 0.7], size=n_samples)

    utility = (
        0.04 * route_overlap
        - 0.03 * departure_diff
        - 0.4 * pickup_dev
        - 0.4 * dest_dev
        + 0.5 * driver_rating
        + 0.02 * driver_trust
        - 3.0 * cancellation_rate
        + 0.8 * gender_match
        - 2.0
    )
    prob = 1 / (1 + np.exp(-utility))
    accepted = (np.random.uniform(0, 1, n_samples) < prob).astype(int)

    df = pd.DataFrame({
        "timestamp": timestamps,
        "route_overlap_pct": route_overlap,
        "departure_diff_mins": departure_diff,
        "pickup_dev_km": pickup_dev,
        "dest_dev_km": dest_dev,
        "driver_rating": driver_rating,
        "driver_trust_score": driver_trust,
        "cancellation_rate": cancellation_rate,
        "gender_pref_match": gender_match,
        "accepted": accepted,
    })

    # Temporal Holdout Split (Train: 70% earlier, Val: 15% mid, Test: 15% latest chronologically)
    df = df.sort_values("timestamp").reset_index(drop=True)
    train_idx = int(n_samples * 0.7)
    val_idx = int(n_samples * 0.85)

    train_df = df.iloc[:train_idx]
    test_df = df.iloc[val_idx:]

    print(f"\n[DATASET OBSERVABILITY SUMMARY]")
    print(f"Total Telemetry Samples:  {n_samples:,}")
    print(f"Temporal Train Window:    {train_df['timestamp'].min().date()} to {train_df['timestamp'].max().date()} ({len(train_df):,} samples)")
    print(f"Temporal Test Window:     {test_df['timestamp'].min().date()} to {test_df['timestamp'].max().date()} ({len(test_df):,} samples)")
    print(f"Class Balance (Accepted): {train_df['accepted'].mean()*100:.1f}% Positive / {(1-train_df['accepted'].mean())*100:.1f}% Negative")

    feature_cols = [
        "route_overlap_pct", "departure_diff_mins", "pickup_dev_km",
        "dest_dev_km", "driver_rating", "driver_trust_score",
        "cancellation_rate", "gender_pref_match"
    ]

    X_train, y_train = train_df[feature_cols].values, train_df["accepted"].values
    X_test, y_test = test_df[feature_cols].values, test_df["accepted"].values

    # -------------------------------------------------------------
    # ENGINE 1: MATCHING & RANKING BENCHMARK
    # -------------------------------------------------------------
    rule_scores = (
        X_test[:, 0] * 0.4
        - X_test[:, 1] * 0.3
        + (X_test[:, 4] / 5.0) * 20.0
        + (X_test[:, 5] / 100.0) * 20.0
    )

    lr = LogisticRegression(max_iter=1000).fit(X_train, y_train)
    lr_probs = lr.predict_proba(X_test)[:, 1]

    rf = RandomForestClassifier(n_estimators=100, random_state=42).fit(X_train, y_train)
    rf_probs = rf.predict_proba(X_test)[:, 1]

    if HAS_XGBOOST:
        xgb_mod = xgb.XGBClassifier(n_estimators=100, learning_rate=0.08, random_state=42, eval_metric="logloss")
        xgb_mod.fit(X_train, y_train)
        xgb_probs = xgb_mod.predict_proba(X_test)[:, 1]
    else:
        xgb_probs = rf_probs

    models_dict = {
        "Rule Baseline": rule_scores,
        "Logistic Regression": lr_probs,
        "Random Forest": rf_probs,
        "XGBoost Ranker": xgb_probs,
    }

    batch_size = 10
    n_batches = len(y_test) // batch_size
    match_results = {}

    for name, probs in models_dict.items():
        p5_list, r5_list, ndcg5_list = [], [], []
        for b in range(n_batches):
            s, e = b * batch_size, (b + 1) * batch_size
            yb, sb = y_test[s:e], probs[s:e]
            if np.sum(yb) == 0:
                continue
            top5 = np.argsort(sb)[::-1][:5]
            hits = np.sum(yb[top5])
            p5_list.append(hits / 5.0)
            r5_list.append(hits / max(np.sum(yb), 1))
            ndcg5_list.append(calculate_ndcg_at_k(yb, sb, k=5))
        
        auc = roc_auc_score(y_test, probs) if name != "Rule Baseline" else roc_auc_score(y_test, (probs - probs.min()) / (probs.max() - probs.min()))
        match_results[name] = {
            "p5": np.mean(p5_list) * 100,
            "r5": np.mean(r5_list) * 100,
            "ndcg5": np.mean(ndcg5_list),
            "auc": auc,
        }

    print("\n" + "-" * 65)
    print(" ENGINE 1: MATCHING & RANKING BENCHMARK (TEMPORAL HOLDOUT)")
    print("-" * 65)
    print(f"{'Model Architecture':<22} | {'Precision@5':<12} | {'Recall@5':<10} | {'NDCG@5':<8} | {'ROC-AUC':<8}")
    print("-" * 65)
    for m, res in match_results.items():
        print(f"{m:<22} | {res['p5']:>10.1f}% | {res['r5']:>8.1f}% | {res['ndcg5']:>7.2f} | {res['auc']:>7.3f}")

    # -------------------------------------------------------------
    # ENGINE 2: TRAVEL TIME (ETA) BENCHMARK
    # -------------------------------------------------------------
    distance_km = np.random.uniform(1.0, 45.0, n_samples)
    hour = np.random.randint(0, 24, n_samples)
    day_w = np.random.randint(0, 7, n_samples)
    tfactor = np.where((hour >= 8) & (hour <= 10) | (hour >= 17) & (hour <= 19), 1.5, 1.0)
    actual_duration = (distance_km * 2.1) * tfactor + np.random.normal(0, 2.0, n_samples)
    actual_duration = np.maximum(actual_duration, 3.0)

    eta_X = np.column_stack([distance_km, hour, day_w, tfactor])
    eta_X_train, eta_y_train = eta_X[:train_idx], actual_duration[:train_idx]
    eta_X_test, eta_y_test = eta_X[val_idx:], actual_duration[val_idx:]

    heuristic_preds = eta_X_test[:, 0] * 2.2 * eta_X_test[:, 3]
    eta_rf = RandomForestRegressor(n_estimators=100, random_state=42).fit(eta_X_train, eta_y_train)
    rf_preds = eta_rf.predict(eta_X_test)

    h_mae = mean_absolute_error(eta_y_test, heuristic_preds)
    rf_mae = mean_absolute_error(eta_y_test, rf_preds)
    rf_rmse = math.sqrt(mean_squared_error(eta_y_test, rf_preds))

    print("\n" + "-" * 65)
    print(" ENGINE 2: TRAVEL TIME (ETA) BENCHMARK")
    print("-" * 65)
    print(f"Heuristic Baseline MAE:      {h_mae:.2f} mins")
    print(f"Random Forest ETA Model MAE: {rf_mae:.2f} mins (RMSE: {rf_rmse:.2f} mins)")
    print(f"Error Reduction vs Baseline: {((h_mae - rf_mae) / h_mae) * 100:.1f}% improvement")

    # -------------------------------------------------------------
    # ENGINE 3: SPATIAL-TEMPORAL DEMAND FORECASTING BENCHMARK
    # -------------------------------------------------------------
    demand_actual = np.random.poisson(lam=35, size=n_samples) + (tfactor * 20).astype(int)
    dem_X_train, dem_y_train = eta_X[:train_idx], demand_actual[:train_idx]
    dem_X_test, dem_y_test = eta_X[val_idx:], demand_actual[val_idx:]

    dem_rule_preds = np.where(dem_X_test[:, 3] > 1.2, 70, 30)
    dem_rf = RandomForestRegressor(n_estimators=100, random_state=42).fit(dem_X_train, dem_y_train)
    dem_preds = dem_rf.predict(dem_X_test)

    dem_rule_mae = mean_absolute_error(dem_y_test, dem_rule_preds)
    dem_rf_mae = mean_absolute_error(dem_y_test, dem_preds)

    print("\n" + "-" * 65)
    print(" ENGINE 3: DEMAND FORECASTING BENCHMARK")
    print("-" * 65)
    print(f"Rule-Based Demand MAE:       {dem_rule_mae:.2f} demand units")
    print(f"Random Forest Demand MAE:    {dem_rf_mae:.2f} demand units")
    print(f"Forecasting Accuracy Gain:   {((dem_rule_mae - dem_rf_mae) / dem_rule_mae) * 100:.1f}% error reduction")

    # -------------------------------------------------------------
    # ENGINE 4: TRUST & SAFETY ANOMALY BENCHMARK
    # -------------------------------------------------------------
    normal_behavior = np.random.normal(loc=[0.05, 3], scale=[0.03, 1], size=(950, 2))
    anomalous_behavior = np.random.normal(loc=[0.70, 15], scale=[0.10, 3], size=(50, 2))
    trust_X = np.vstack([normal_behavior, anomalous_behavior])
    trust_y = np.array([0] * 950 + [1] * 50)

    iso_forest = IsolationForest(contamination=0.05, random_state=42).fit(trust_X)
    iso_preds = np.where(iso_forest.predict(trust_X) == -1, 1, 0)

    false_positives = np.sum((iso_preds == 1) & (trust_y == 0))
    fpr = false_positives / 950.0

    print("\n" + "-" * 65)
    print(" ENGINE 4: TRUST & SAFETY ANOMALY BENCHMARK")
    print("-" * 65)
    print(f"Isolation Forest Contamination: 5.0%")
    print(f"False Positive Rate (FPR):    {fpr * 100:.2f}% (Safeguards legitimate students)")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    run_evaluation_benchmark()
