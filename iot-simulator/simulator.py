import random
import time
import json
import requests
<<<<<<< HEAD
import boto3
=======
import os
>>>>>>> main

# ============================================================
# Issue #18: Replace local risk assessment with SageMaker
# ============================================================

<<<<<<< HEAD
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
=======
THRESHOLDS = {
    "heart_rate":    {"low": 50,   "high": 100},  # bpm
    "temperature":   {"low": 36.1, "high": 38.5}, # celsius
    "oxygen_level":  {"low": 95,   "high": 100},  # percent
}

def assess_risk(data):
    for key, value in data.items():
        if key in THRESHOLDS:
            if value < THRESHOLDS[key]["low"] or value > THRESHOLDS[key]["high"]:
                return "High"
    return "Low"
>>>>>>> main

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
<<<<<<< HEAD
# Issue #9: Send data to P2P node via HTTP POST
# ============================================================

NODE_URL = "http://localhost:6001/sensor-data"
=======
# Azure IoT Hub client setup
# ============================================================

iot_client = None
connection_string = os.environ.get("IOTHUB_CONNECTION_STRING", "")

if connection_string:
    try:
        from azure.iot.device import IoTHubDeviceClient, Message as IotMessage
        iot_client = IoTHubDeviceClient.create_from_connection_string(connection_string)
        iot_client.connect()
        print("Connected to Azure IoT Hub")
    except Exception as e:
        print(f"Could not connect to IoT Hub: {e}")
else:
    print("No IoT Hub connection string, skipping IoT Hub")

def send_to_iot_hub(data):
    if not iot_client:
        return
    try:
        msg = IotMessage(json.dumps(data))
        msg.content_type = "application/json"
        msg.content_encoding = "utf-8"
        iot_client.send_message(msg)
        print(f"  → Sent to Azure IoT Hub")
    except Exception as e:
        print(f"  → IoT Hub send error: {e}")

# ============================================================
# Issue #9: Send data to P2P node via HTTP POST
# ============================================================

NODE_URL = os.environ.get("NODE_URL", "http://localhost:6001/sensor-data")
>>>>>>> main

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
<<<<<<< HEAD

=======

    # Send to Azure IoT Hub
    send_to_iot_hub(data)

    # Send to P2P node
>>>>>>> main
    try:
        response = requests.post(NODE_URL, json=data, timeout=3)
        print(f"  → Sent to node.js: {response.status_code}")
    except Exception as e:
        print(f"  → Could not reach node.js: {e}")

    print()
<<<<<<< HEAD
    time.sleep(30)
=======
    time.sleep(30)
>>>>>>> main
