# SHT-CCSpring26 — Smart Health Tracker

A multi-cloud IoT health monitoring platform built on a P2P network foundation.

## Architecture

Each user device is an independent P2P node. Nodes communicate directly with each other (no central broker) while independently calling cloud PaaS services. A backend service aggregates data for the React dashboard.

```
Node A                    Node B                    Node C
├── IoT Sensor Sim        ├── IoT Sensor Sim        ├── IoT Sensor Sim
├── Azure IoT Hub    ──── ├── Azure IoT Hub    ──── ├── Azure IoT Hub
├── AWS SageMaker         ├── AWS SageMaker         ├── AWS SageMaker
├── AWS SNS               ├── AWS SNS               ├── AWS SNS
└── P2P Alert ◄────────── └── P2P Alert ◄────────── └── P2P Alert
         │                         │                         │
         └─────────────────────────┴─────────────────────────┘
                                   │
                            Backend API (port 8080)
                                   │
                          React Dashboard (WebSocket)
```

## Cloud Services

| Service | Platform | Purpose |
|---|---|---|
| Azure IoT Hub | Microsoft Azure | Receive simulated sensor data via MQTT |
| AWS SageMaker | Amazon AWS | Health risk prediction (Low / Medium / High) |
| AWS SNS | Amazon AWS | Per-node email alerts when High risk detected |

## P2P Network

- Built with **libp2p** (TCP transport, Yamux multiplexing, Noise encryption)
- Each node has a unique **Peer ID**
- Nodes discover each other via DNS within Docker network
- Health alerts broadcast directly peer-to-peer — no central server

## AWS SNS Alerting

Each node has its own SNS Topic. When High risk is detected:

1. **Self-alert**: The node that detects High risk sends an email to its own user
2. **P2P broadcast**: The alert is broadcast to all connected peer nodes
3. **Peer alert**: Each receiving node sends an email to its own user via its own SNS Topic

This ensures both the affected user and their connected peers (e.g., family, doctors) are notified.

## React Dashboard

A real-time monitoring dashboard served at `http://localhost:8080`.

- **Live vitals**: Heart rate, temperature, and oxygen level for each node, updated in real time
- **Risk level indicator**: Color-coded badge per node — green (Low), orange (Medium), red (High)
- **Anomaly highlighting**: Out-of-range values highlighted in orange or red automatically
- **P2P Alert History**: Live feed of all health alerts, tagged by source node and type (LOCAL self-detected vs P2P received from peer)
- **WebSocket connection**: Instant push updates from the backend; auto-fallback to HTTP polling every 5 seconds if WebSocket drops
- Built with vanilla React (CDN) — no build step required

## Project Structure

```
SHT-CCSpring26/
├── p2p/
│   ├── nodes/
│   │   ├── nodeA.js
│   │   ├── nodeB.js
│   │   └── nodeC.js
│   ├── protocols/
│   ├── utils/
│   ├── node.js          # P2P node + sensor data receiver + AWS SNS alerts
│   ├── config.js
│   └── peerIds.js
├── iot-simulator/
│   ├── simulator.py     # Python IoT sensor simulation
│   ├── Dockerfile
│   └── requirements.txt
├── backend/
│   ├── index.js         # Express REST API + WebSocket server
│   └── Dockerfile
├── frontend/
│   └── index.html       # React dashboard (CDN, no build step)
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── health_data.csv
├── README.md
└── .env                 # AWS credentials + IoT Hub connection strings (not in repo)
```

## Quick Start

**Requirements:** Docker Desktop

1. Create a `.env` file in the project root with:
```
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-2
SNS_TOPIC_ARN_A=arn:aws:sns:us-east-2:xxxx:sht-health-alerts
SNS_TOPIC_ARN_B=arn:aws:sns:us-east-2:xxxx:sht-alerts-node-b
SNS_TOPIC_ARN_C=arn:aws:sns:us-east-2:xxxx:sht-alerts-node-c
IOTHUB_DEVICE_CONNECTION_STRING_A=your_connection_string
IOTHUB_DEVICE_CONNECTION_STRING_B=your_connection_string
IOTHUB_DEVICE_CONNECTION_STRING_C=your_connection_string
```

2. Run:
```bash
docker compose down
docker compose build --no-cache
docker compose up
```

3. Open `http://localhost:8080` to view the real-time dashboard.

This starts 7 containers: 3 P2P nodes, 3 IoT simulators, and 1 backend dashboard service. Each simulator sends health data to its node every 30 seconds. When High risk is detected, the node sends an SNS email alert and broadcasts the alert to all peers via P2P. The dashboard updates in real time via WebSocket.

## Expected Output

```
[A] Sensor data | Heart rate: 77 bpm | Temp: 36.6 C | Oxygen: 98.5% | Risk: Low
[B] Sensor data | Heart rate: 145 bpm | Temp: 38.6 C | Oxygen: 91.2% | Risk: High
[B] SNS email alert sent to topic: sht-alerts-node-b
[B] Broadcasting alert to 2 peers...
[A] *** RECEIVED ALERT: HEALTH ALERT from Node B: High risk detected! ***
[A] SNS email alert sent to topic: sht-alerts-node-a
[C] *** RECEIVED ALERT: HEALTH ALERT from Node B: High risk detected! ***
[C] SNS email alert sent to topic: sht-alerts-node-c
```

Dashboard accessible at `http://localhost:8080` — displays live vitals, risk levels, and P2P alert history for all three nodes.

## Status

- [x] P2P node network — 3 nodes, full mesh, health alert broadcasting
- [x] IoT sensor simulation — heart rate, temperature, oxygen level
- [x] AWS SNS alerts — per-node email notifications for High risk events
- [x] Azure IoT Hub integration
- [x] AWS SageMaker ML model
- [x] React frontend dashboard — real-time vitals, risk level, P2P alert log
- [x] Backend API — REST endpoints + WebSocket server (port 8080)
