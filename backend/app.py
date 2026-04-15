#C:\Users\acer\Desktop\pj\Final Year Project\backend\app.py
from __future__ import annotations
import os

# from flask import Flask
# from flask_cors import CORS   # 👈 import

# app = Flask(__name__)

# CORS(app, supports_credentials=True)   # 👈 AFTER app is created

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__)

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

@app.after_request
def after_request(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
    return response

# @app.after_request
# def after_request(response):
#     response.headers["Access-Control-Allow-Origin"] = "*"
#     response.headers["Access-Control-Allow-Headers"] = "*"
#     response.headers["Access-Control-Allow-Methods"] = "*"
#     return response


# from flask_cors import CORS
# CORS(app)



import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd

# -----------------------------------------------------------------------------
# Paths
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent

# Support both uppercase and lowercase folder names just in case you rename them
MODEL_PATH_CANDIDATES = [
    BASE_DIR / "Model" / "best_model.pkl",
    BASE_DIR / "model" / "best_model.pkl",
]

FRONTEND_DIR_CANDIDATES = [
    BASE_DIR / "Frontend",
    BASE_DIR / "frontend",
]

FEATURES_PATH_CANDIDATES = [
    BASE_DIR / "Model" / "feature_columns.json",
    BASE_DIR / "model" / "feature_columns.json",
]

# -----------------------------------------------------------------------------
# App setup
# -----------------------------------------------------------------------------
# app = Flask(__name__) reason tor fetch problem (duplilcate)

# -----------------------------------------------------------------------------
# Load model
# -----------------------------------------------------------------------------
def _first_existing_path(paths: List[Path]) -> Optional[Path]:
    for path in paths:
        if path.exists():
            return path
    return None


MODEL_PATH = _first_existing_path(MODEL_PATH_CANDIDATES)
FRONTEND_DIR = _first_existing_path(FRONTEND_DIR_CANDIDATES)
FEATURES_PATH = _first_existing_path(FEATURES_PATH_CANDIDATES)

if MODEL_PATH is None:
    raise FileNotFoundError(
        "Could not find best_model.pkl. Put it in Model/ or model/ folder."
    )

try:
    model = joblib.load(MODEL_PATH)
except Exception as exc:
    raise RuntimeError(f"Failed to load model from {MODEL_PATH}: {exc}") from exc

# Try to read expected feature columns from the fitted model.
# This usually works because your training script fit the model on a DataFrame.
EXPECTED_FEATURE_COLUMNS: List[str] = []
if hasattr(model, "feature_names_in_"):
    EXPECTED_FEATURE_COLUMNS = list(model.feature_names_in_)
elif FEATURES_PATH is not None:
    try:
        with open(FEATURES_PATH, "r", encoding="utf-8") as f:
            EXPECTED_FEATURE_COLUMNS = json.load(f)
    except Exception:
        EXPECTED_FEATURE_COLUMNS = []

MODEL_CLASSES = list(getattr(model, "classes_", [0, 1]))


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def clean_column_names(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    return df


def label_encoding(df: pd.DataFrame) -> pd.DataFrame:
    """
    Replicates the training-time preprocessing idea:
    - Convert Yes/No to 1/0
    - One-hot encode remaining categorical columns
    - Force numeric output
    - Fill missing values with 0
    """
    df = clean_column_names(df)

    # Replace common boolean-like text values
    replace_map = {
        "Yes": 1,
        "No": 0,
        "yes": 1,
        "no": 0,
        "TRUE": 1,
        "FALSE": 0,
        "True": 1,
        "False": 0,
        True: 1,
        False: 0,
    }
    df = df.replace(replace_map)

    # Remove obvious index columns from uploads
    unnamed_cols = [c for c in df.columns if str(c).startswith("Unnamed:")]
    if unnamed_cols:
        df = df.drop(columns=unnamed_cols, errors="ignore")

    # Drop target column if the user accidentally includes it in an inference request
    if "fake" in df.columns:
        df = df.drop(columns=["fake"], errors="ignore")

    # One-hot encode remaining object/category columns
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    if cat_cols:
        df = pd.get_dummies(df, columns=cat_cols, drop_first=True)

    # Convert everything to numeric; non-convertible entries become NaN
    df = df.apply(pd.to_numeric, errors="coerce")

    # Fill missing values
    df = df.fillna(0)

    return df


def align_to_expected_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aligns incoming data to the model's training columns.
    Missing columns are added as 0, extra columns are dropped.
    """
    if EXPECTED_FEATURE_COLUMNS:
        df = df.reindex(columns=EXPECTED_FEATURE_COLUMNS, fill_value=0)
    return df


def preprocess_input(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = label_encoding(raw_df)
    df = align_to_expected_features(df)

    # Final safeguard: make sure no missing values remain
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
    return df


def get_class_index(target_class: int) -> Optional[int]:
    try:
        return MODEL_CLASSES.index(target_class)
    except ValueError:
        return None


def confidence_level(score: float) -> str:
    if score >= 0.80:
        return "High"
    if score >= 0.60:
        return "Medium"
    return "Low"


def confidence_color(label: str, score: float) -> str:
    """
    Returns a simple color key for the frontend.
    """
    level = confidence_level(score)
    if label == "Fake Account":
        if level == "High":
            return "danger"
        if level == "Medium":
            return "warning"
        return "neutral"
    else:
        if level == "High":
            return "success"
        if level == "Medium":
            return "warning"
        return "neutral"


def predict_rows(df: pd.DataFrame) -> List[Dict[str, Any]]:
    processed = preprocess_input(df)

    if processed.empty:
        raise ValueError("No usable columns found after preprocessing.")

    # Model predictions
    preds = model.predict(processed)

    # Probabilities
    if hasattr(model, "predict_proba"):
        probas = model.predict_proba(processed)
    else:
        # Fallback, though your LogisticRegression pipeline should support predict_proba
        probas = None

    fake_class_index = get_class_index(1)
    real_class_index = get_class_index(0)

    results: List[Dict[str, Any]] = []

    for i in range(len(processed)):
        pred_value = int(preds[i]) if np.isscalar(preds[i]) else int(preds[i].item())

        # Default probabilities if predict_proba is not available
        real_prob = None
        fake_prob = None
        score = None

        if probas is not None:
            row_proba = probas[i]

            if real_class_index is not None and real_class_index < len(row_proba):
                real_prob = float(row_proba[real_class_index])

            if fake_class_index is not None and fake_class_index < len(row_proba):
                fake_prob = float(row_proba[fake_class_index])

            if pred_value == 1 and fake_prob is not None:
                score = fake_prob
            elif pred_value == 0 and real_prob is not None:
                score = real_prob
            else:
                # Fallback to the maximum probability
                score = float(np.max(row_proba))

        label = "Fake Account" if pred_value == 1 else "Real Account"

        if score is None:
            score = 0.0

        level = confidence_level(score)
        color_key = confidence_color(label, score)

        results.append(
            {
                "prediction": pred_value,
                "label": label,
                "confidence": {
                    "score": round(score, 4),
                    "percentage": round(score * 100, 2),
                    "level": level,
                    "color": color_key,
                },
                "probabilities": {
                    "real": round(real_prob, 4) if real_prob is not None else None,
                    "fake": round(fake_prob, 4) if fake_prob is not None else None,
                },
            }
        )

    return results


def parse_json_or_form_payload() -> Dict[str, Any]:
    payload = request.get_json(silent=True)

    if payload is None:
        payload = request.form.to_dict(flat=True)

    if isinstance(payload, dict) and "account" in payload and isinstance(payload["account"], dict):
        payload = payload["account"]

    if not isinstance(payload, dict):
        raise ValueError("Request body must be a JSON object or form data.")

    return payload


def dataframe_from_uploaded_file(uploaded_file) -> pd.DataFrame:
    filename = (uploaded_file.filename or "").lower()

    if filename.endswith(".csv"):
        return pd.read_csv(uploaded_file)

    if filename.endswith(".json"):
        raw = uploaded_file.read().decode("utf-8")
        content = json.loads(raw)

        if isinstance(content, list):
            return pd.DataFrame(content)
        if isinstance(content, dict):
            # If it looks like one record, wrap it in a list
            if all(not isinstance(v, (list, dict)) for v in content.values()):
                return pd.DataFrame([content])
            return pd.DataFrame(content)

        raise ValueError("JSON file must contain an object or a list of objects.")

    raise ValueError("Only CSV or JSON files are supported.")


def summarize_predictions(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    total = len(results)
    fake_count = sum(1 for r in results if r["prediction"] == 1)
    real_count = total - fake_count

    average_confidence = (
        round(float(np.mean([r["confidence"]["score"] for r in results])), 4)
        if results
        else 0.0
    )

    return {
        "total": total,
        "fake": fake_count,
        "real": real_count,
        "average_confidence": average_confidence,
    }


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------
@app.route("/", methods=["GET"])
def home():
    if FRONTEND_DIR is None:
        return jsonify(
            {
                "success": True,
                "message": "Backend is running. Frontend folder not found.",
            }
        )

    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        return jsonify(
            {
                "success": True,
                "message": "Backend is running. index.html not found in frontend folder.",
            }
        )

    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/health", methods=["GET"])
def health():
    return jsonify(
        {
            "success": True,
            "status": "running",
            "model_loaded": True,
            "model_path": str(MODEL_PATH),
            "expected_features_count": len(EXPECTED_FEATURE_COLUMNS),
        }
    )


@app.route("/schema", methods=["GET"])
def schema():
    return jsonify(
        {
            "success": True,
            "manual_input_hint": {
                "core_numeric_features": [
                    "ratio_numlen_username",
                    "len_fullname",
                    "ratio_numlen_fullname",
                    "len_desc",
                    "num_posts",
                    "num_followers",
                    "num_following",
                ],
                "note": (
                    "You can send these fields for manual testing. "
                    "If your model expects more columns, missing ones are filled with 0."
                ),
            },
            "expected_features_count": len(EXPECTED_FEATURE_COLUMNS),
            "expected_features_sample": EXPECTED_FEATURE_COLUMNS[:25],
        }
    )


@app.route("/predict", methods=["POST"])
def predict():
    try:
        payload = parse_json_or_form_payload()

        # Accept either:
        # 1) {"field1": value, "field2": value, ...}
        # 2) {"account": {...}}
        raw_df = pd.DataFrame([payload])
        results = predict_rows(raw_df)

        return jsonify(
            {
                "success": True,
                "mode": "single",
                "result": results[0],
            }
        )

    except Exception as exc:
        return jsonify(
            {
                "success": False,
                "error": str(exc),
            }
        ), 400


@app.route("/predict-file", methods=["POST"])
def predict_file():
    try:
        if "file" not in request.files:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "No file uploaded. Use form-data field name 'file'.",
                    }
                ),
                400,
            )

        uploaded_file = request.files["file"]

        if not uploaded_file.filename:
            return (
                jsonify(
                    {
                        "success": False,
                        "error": "Uploaded file has no filename.",
                    }
                ),
                400,
            )

        raw_df = dataframe_from_uploaded_file(uploaded_file)
        results = predict_rows(raw_df)
        summary = summarize_predictions(results)

        return jsonify(
            {
                "success": True,
                "mode": "bulk",
                "summary": summary,
                "predictions": results,
            }
        )

    except Exception as exc:
        return jsonify(
            {
                "success": False,
                "error": str(exc),
            }
        ), 400


# Optional: serve static files directly if you open the frontend from Flask
@app.route("/frontend/<path:filename>", methods=["GET"])
def serve_frontend_file(filename: str):
    if FRONTEND_DIR is None:
        return jsonify({"success": False, "error": "Frontend folder not found."}), 404
    return send_from_directory(FRONTEND_DIR, filename)


# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    print("====================================================")
    print(" Fake Account Detection Backend")
    print("====================================================")
    print(f"Model path: {MODEL_PATH}")
    print(f"Expected feature columns: {len(EXPECTED_FEATURE_COLUMNS)}")
    # print("Starting server on http://127.0.0.1:5000")
    print("====================================================")

    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
    # app.run(host="127.0.0.1", port=5000, debug=True)