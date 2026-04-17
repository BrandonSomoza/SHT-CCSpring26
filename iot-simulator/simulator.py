import random
import time
import json

# ============================================================
# Issue #8: Health risk thresholds and alert logic
# ============================================================

THRESHOLDS = {
    "heart_rate":    {"low": 50,   "high": 100},  # bpm
    "temperature":   {"low": 36.1, "high": 38.5}, # celsius
    "oxygen_level":  {"low": 95,   "high": 100},  # percent
}

def check_alerts(data):
    alerts = []
    for key, value in data.items():
        if key in THRESHOLDS:
            if value < THRESHOLDS[key]["low"]:
                alerts.append(f"WARNING: {key} too LOW ({value})")
            elif value > THRESHOLDS[key]["high"]:
                alerts.append(f"WARNING: {key} too HIGH ({value})")
    return alerts

# ============================================================
# Issue #7: Simulate IoT sensor data
# ============================================================

def generate_sensor_data():
    return {
        "heart_rate":   round(random.uniform(45, 110), 1),  # bpm
        "temperature":  round(random.uniform(35.5, 39.5), 1), # celsius
        "oxygen_level": round(random.uniform(90, 100), 1),  # percent
        "timestamp":    time.strftime("%Y-%m-%d %H:%M:%S")
    }

# ============================================================
# Main loop: generate data every 3 seconds
# ============================================================

print("IoT Simulator started...")
print("Press Ctrl+C to stop\n")

while True:
    data = generate_sensor_data()
    alerts = check_alerts(data)

    print(f"[{data['timestamp']}]")
    print(f"  Heart Rate:   {data['heart_rate']} bpm")
    print(f"  Temperature:  {data['temperature']} °C")
    print(f"  Oxygen Level: {data['oxygen_level']} %")

    if alerts:
        for alert in alerts:
            print(f"  🚨 {alert}")
    else:
        print(f"  ✅ All vitals normal")

    print()
    time.sleep(3)