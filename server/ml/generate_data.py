import os
import random
import datetime
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv

# Load env variables
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

def generate_records(num_records=600):
    mongo_uri = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/doctor_queue")
    client = MongoClient(mongo_uri)
    db = client.get_database("doctor_queue")
    collection = db["consultationhistories"]
    
    # Clear existing history to reset test state
    collection.delete_many({})
    
    print(f"Connecting to MongoDB at {mongo_uri}...")
    print(f"Generating {num_records} synthetic consultation history records...")
    
    records = []
    base_time = datetime.datetime.now() - datetime.timedelta(days=90)
    
    # We will assume a single doctor for simplicity in testing
    doctor_id = ObjectId("66914b48bcde36814b72648a")
    
    for i in range(num_records):
        patient_id = ObjectId()
        appointment_id = ObjectId()
        
        # Simulate timeline going forward
        record_date = base_time + datetime.timedelta(hours=i * 0.5)
        
        queue_pos = random.randint(1, 20)
        weekday = record_date.weekday()
        month = record_date.month
        
        holiday_flag = 1 if random.random() < 0.05 else 0
        peak_hour_flag = 1 if record_date.hour in [10, 11, 12, 16, 17] else 0
        
        doctor_delay = random.randint(0, 15) if random.random() < 0.3 else 0
        lunch_delay = random.randint(20, 45) if random.random() < 0.15 else 0
        emergency_delay = random.randint(15, 35) if random.random() < 0.05 else 0
        
        walkins = random.randint(0, 3)
        cancelled = random.randint(0, 2)
        
        # Define consultation duration formula: base 7.5 mins + features + noise
        duration = 7.5
        if peak_hour_flag:
            duration += 2.0
        if weekday in [0, 4]: # Mon, Fri are busier
            duration += 1.0
        duration += 0.1 * queue_pos
        duration += random.uniform(-1.5, 2.5)
        duration = max(2.0, min(30.0, round(duration, 1)))
        
        # Waiting duration simulation
        waiting = (queue_pos - 1) * 7.5 + doctor_delay + lunch_delay + emergency_delay
        waiting = max(0.0, waiting)
        
        record = {
            "patientId": patient_id,
            "doctorId": doctor_id,
            "appointmentId": appointment_id,
            "queuePosition": queue_pos,
            "weekday": weekday,
            "month": month,
            "holidayFlag": holiday_flag,
            "peakHourFlag": peak_hour_flag,
            "doctorDelay": doctor_delay,
            "lunchDelay": lunch_delay,
            "emergencyDelay": emergency_delay,
            "walkInsBefore": walkins,
            "cancelledBefore": cancelled,
            "consultationDuration": duration,
            "waitingDuration": waiting,
            "createdAt": record_date,
            "updatedAt": record_date
        }
        records.append(record)
        
    collection.insert_many(records)
    client.close()
    print("Database seeding completed successfully.")

if __name__ == "__main__":
    generate_records()
