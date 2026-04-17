import random
import time
import json
import requests
import os

# ============================================================
# Issue #8: Health risk thresholds and alert logic
# ============================================================

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

    # Send to Azure IoT Hub
    send_to_iot_hub(data)

    # Send to P2P node
    try:
        response = requests.post(NODE_URL, json=data, timeout=3)
        print(f"  → Sent to node.js: {response.status_code}")
    except Exception as e:
        print(f"  → Could not reach node.js: {e}")

    print()
    time.sleep(30)
