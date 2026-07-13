import os
import sys
import json
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
from pymongo import MongoClient
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from dotenv import load_dotenv

# Load env variables from parent server directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI(title="Smart Doctor Queue Prediction ML Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictionFeatures(BaseModel):
    queuePosition: int
    weekday: int
    month: int
    holidayFlag: int
    peakHourFlag: int
    doctorDelay: int
    lunchDelay: int
    emergencyDelay: int
    walkInsBefore: int
    cancelledBefore: int
    doctorConfiguredDefault: float = 7.0

def get_mongo_data():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/doctor_queue")
    client = MongoClient(mongo_uri)
    db = client.get_database("doctor_queue")
    collection = db["consultationhistories"]
    data = list(collection.find({}))
    client.close()
    return data

@app.get("/status")
def get_status():
    metrics_path = os.path.join(os.path.dirname(__file__), 'models', 'metrics.json')
    if os.path.exists(metrics_path):
        with open(metrics_path, 'r') as f:
            try:
                return json.load(f)
            except Exception:
                pass
    return {
        "success": False,
        "message": "Model not trained yet.",
        "bestModel": "WMA (Weighted Moving Average) Baseline",
        "trainingSamples": 0,
        "metrics": None
    }

@app.post("/predict")
def predict(features: PredictionFeatures):
    model_path = os.path.join(os.path.dirname(__file__), 'models', 'best_model.joblib')
    
    if not os.path.exists(model_path):
        # Fallback if no model is trained yet (Stage 1 or 2)
        return {
            "success": True,
            "prediction": float(features.doctorConfiguredDefault),
            "source": "fallback_default"
        }
    
    try:
        model = joblib.load(model_path)
        feature_cols = [
            'queuePosition', 'weekday', 'month', 'holidayFlag', 
            'peakHourFlag', 'doctorDelay', 'lunchDelay', 'emergencyDelay',
            'walkInsBefore', 'cancelledBefore'
        ]
        
        # Build features DataFrame with exact column ordering
        features_dict = features.dict()
        df = pd.DataFrame([{col: float(features_dict[col]) for col in feature_cols}])
        
        prediction = float(model.predict(df)[0])
        prediction = max(1.0, prediction) # minimum 1 minute
        
        return {
            "success": True,
            "prediction": prediction,
            "source": "machine_learning"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/train")
def train_model():
    try:
        data = get_mongo_data()
        
        if len(data) < 20:
            return {
                "success": False,
                "error": f"Insufficient training data. Need at least 20 records, found {len(data)}."
            }
            
        df = pd.DataFrame(data)
        
        feature_cols = [
            'queuePosition', 'weekday', 'month', 'holidayFlag', 
            'peakHourFlag', 'doctorDelay', 'lunchDelay', 'emergencyDelay',
            'walkInsBefore', 'cancelledBefore'
        ]
        
        for col in feature_cols:
            if col not in df.columns:
                df[col] = 0
            df[col] = pd.to_numeric(df[col]).fillna(0)
            
        if 'consultationDuration' not in df.columns:
            return {
                "success": False,
                "error": "Target column 'consultationDuration' not found in historical data."
            }
            
        df['consultationDuration'] = pd.to_numeric(df['consultationDuration']).fillna(7.0)
        
        X = df[feature_cols]
        y = df['consultationDuration']
        
        test_size = 0.2 if len(df) >= 10 else 0.1
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
        
        models = {
            'linear_regression': LinearRegression(),
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42)
        }
        
        results = {}
        best_model_name = None
        best_score = float('inf')
        trained_models = {}
        
        for name, model in models.items():
            model.fit(X_train, y_train)
            preds = model.predict(X_test)
            
            mae = float(mean_absolute_error(y_test, preds))
            rmse = float(np.sqrt(mean_squared_error(y_test, preds)))
            r2 = float(r2_score(y_test, preds))
            
            results[name] = {
                "mae": mae,
                "rmse": rmse,
                "r2": r2
            }
            trained_models[name] = model
            
            if mae < best_score:
                best_score = mae
                best_model_name = name
                
        model_dir = os.path.join(os.path.dirname(__file__), 'models')
        os.makedirs(model_dir, exist_ok=True)
        
        best_model = trained_models[best_model_name]
        model_path = os.path.join(model_dir, 'best_model.joblib')
        joblib.dump(best_model, model_path)
        
        metrics_data = {
            "success": True,
            "bestModel": best_model_name,
            "trainingSamples": len(df),
            "metrics": results,
            "features": feature_cols
        }
        
        metrics_path = os.path.join(model_dir, 'metrics.json')
        with open(metrics_path, 'w') as f:
            json.dump(metrics_data, f, indent=4)
            
        return metrics_data
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }
