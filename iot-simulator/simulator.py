import random
import time
import json
import requests

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
# Issue #9: Send data to P2P node via HTTP POST
# ============================================================

NODE_URL = "http://localhost:6001/sensor-data"  # node.js 接收端口

print("IoT Simulator started...")
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