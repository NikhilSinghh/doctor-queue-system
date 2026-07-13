import os
import sys
import json
import numpy as np
import pandas as pd
from pymongo import MongoClient
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
from dotenv import load_dotenv

# Load env variables from parent server directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def get_mongo_data():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/doctor_queue")
    client = MongoClient(mongo_uri)
    db = client.get_database("doctor_queue")
    
    # Collection name matching schema
    collection = db["consultationhistories"]
    cursor = collection.find({})
    
    data = list(cursor)
    client.close()
    return data

def main():
    try:
        data = get_mongo_data()
        
        if len(data) < 20:
            print(json.dumps({
                "success": False,
                "error": f"Insufficient training data. Need at least 20 records, found {len(data)}."
            }))
            sys.exit(0)
            
        df = pd.DataFrame(data)
        
        # Define features and target
        feature_cols = [
            'queuePosition', 'weekday', 'month', 'holidayFlag', 
            'peakHourFlag', 'doctorDelay', 'lunchDelay', 'emergencyDelay',
            'walkInsBefore', 'cancelledBefore'
        ]
        
        # Ensure columns exist in DataFrame, fill missing with defaults
        for col in feature_cols:
            if col not in df.columns:
                df[col] = 0
            df[col] = pd.to_numeric(df[col]).fillna(0)
            
        if 'consultationDuration' not in df.columns:
            print(json.dumps({
                "success": False,
                "error": "Target column 'consultationDuration' not found in historical data."
            }))
            sys.exit(0)
            
        df['consultationDuration'] = pd.to_numeric(df['consultationDuration']).fillna(7.0)
        
        X = df[feature_cols]
        y = df['consultationDuration']
        
        # Train-Test Split (if dataset is very small, use simple split or cross-validation)
        test_size = 0.2 if len(df) >= 10 else 0.1
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=test_size, random_state=42)
        
        # Define Models
        models = {
            'linear_regression': LinearRegression(),
            'random_forest': RandomForestRegressor(n_estimators=100, random_state=42),
            'gradient_boosting': GradientBoostingRegressor(n_estimators=100, random_state=42)
        }
        
        results = {}
        best_model_name = None
        best_score = float('inf')  # Lower MAE is better
        trained_models = {}
        
        # Train & Evaluate
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
            
            # Select best model based on lowest MAE
            if mae < best_score:
                best_score = mae
                best_model_name = name
                
        # Ensure model directory exists
        model_dir = os.path.join(os.path.dirname(__file__), 'models')
        os.makedirs(model_dir, exist_ok=True)
        
        # Save best model
        best_model = trained_models[best_model_name]
        model_path = os.path.join(model_dir, 'best_model.joblib')
        joblib.dump(best_model, model_path)
        
        # Save metrics file
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
            
        print(json.dumps(metrics_data, indent=4))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == '__main__':
    main()
