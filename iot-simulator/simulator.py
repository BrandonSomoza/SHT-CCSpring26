import random
import time
import json
import requests
import boto3

# ============================================================
# Issue #18: Replace local risk assessment with SageMaker
# ============================================================

ENDPOINT_NAME = 'sagemaker-scikit-learn-2026-04-18-00-24-18-709'
sagemaker_runtime = boto3.client('sagemaker-runtime', region_name='us-east-1')

def assess_risk(data):
    try:
        payload = json.dumps([[data['heart_rate'], data['temperature'], data['oxygen_level']]])
        response = sagemaker_runtime.invoke_endpoint(
            EndpointName=ENDPOINT_NAME,
            ContentType='application/json',
            Body=payload
        )
        result = json.loads(response['Body'].read().decode())
        return 'High' if result[0] == 1 else 'Low'
    except Exception as e:
        print(f"  SageMaker error: {e}")
        if (data['heart_rate'] < 50 or data['heart_rate'] > 100 or
            data['temperature'] < 36.1 or data['temperature'] > 38.5 or
            data['oxygen_level'] < 95):
            return 'High'
        return 'Low'

# ============================================================
# Issue #7: Simulate IoT sensor data
# ============================================================

def generate_sensor_data():
    return {
        "heart_rate":   round(random.uniform(45, 110), 1),
        "temperature":  round(random.uniform(35.5, 39.5), 1),
        "oxygen_level": round(random.uniform(90, 100), 1),
        "timestamp":    time.strftime("%Y-%m-%d %H:%M:%S")
    }

# ============================================================
# Issue #9: Send data to P2P node via HTTP POST
# ============================================================

NODE_URL = "http://localhost:6001/sensor-data"

print("IoT Simulator started...")
print(f"Sending to node: {NODE_URL}")
print("Press Ctrl+C to stop\n")

while True:
    data = generate_sensor_data()
    risk = assess_risk(data)
    data["risk"] = risk

    print(f"[{data['timestamp']}]")
    print(f"  Heart Rate:   {data['heart_rate']} bpm")
    print(f"  Temperature:  {data['temperature']} °C")
    print(f"  Oxygen Level: {data['oxygen_level']} %")
    print(f"  Risk:         {risk}")
    try:
        response = requests.post(NODE_URL, json=data, timeout=3)
        print(f"  → Sent to node.js: {response.status_code}")
    except Exception as e:
        print(f"  → Could not reach node.js: {e}")

    print()
    time.sleep(30)
