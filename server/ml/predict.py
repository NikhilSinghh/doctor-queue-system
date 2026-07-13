import os
import sys
import json
import joblib
import pandas as pd

def main():
    try:
        # Read JSON from stdin
        if len(sys.argv) > 1:
            # Try reading from argument if provided
            input_data = json.loads(sys.argv[1])
        else:
            # Fallback to stdin
            input_data = json.loads(sys.stdin.read())
            
        model_path = os.path.join(os.path.dirname(__file__), 'models', 'best_model.joblib')
        
        if not os.path.exists(model_path):
            # Fallback when model is not trained yet (Stage 1 or Stage 2)
            # Just return doctorConfiguredDefault passed in input_data
            default_time = input_data.get('doctorConfiguredDefault', 7.0)
            print(json.dumps({
                "success": True,
                "prediction": float(default_time),
                "source": "fallback_default"
            }))
            return

        # Load best model
        model = joblib.load(model_path)
        
        # Build features DataFrame with exact column ordering
        feature_cols = [
            'queuePosition', 'weekday', 'month', 'holidayFlag', 
            'peakHourFlag', 'doctorDelay', 'lunchDelay', 'emergencyDelay',
            'walkInsBefore', 'cancelledBefore'
        ]
        
        features = {}
        for col in feature_cols:
            features[col] = float(input_data.get(col, 0))
            
        df = pd.DataFrame([features])
        
        # Predict
        prediction = float(model.predict(df)[0])
        
        # Ensure minimum consultation duration is 1 minute
        prediction = max(1.0, prediction)
        
        print(json.dumps({
            "success": True,
            "prediction": prediction,
            "source": "machine_learning"
        }))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))

if __name__ == '__main__':
    main()
