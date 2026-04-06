# SHT-CCSpring26 — Smart Health Tracker

A multi-cloud IoT health monitoring platform built on a P2P network foundation.

## Architecture

Each user device is an independent P2P node. Nodes communicate directly with each other (no central broker) while independently calling cloud PaaS services.

```
Node A                    Node B                    Node C
├── IoT Sensor Sim        ├── IoT Sensor Sim        ├── IoT Sensor Sim
├── Azure IoT Hub    ──── ├── Azure IoT Hub    ──── ├── Azure IoT Hub
├── AWS SageMaker         ├── AWS SageMaker         ├── AWS SageMaker
├── AWS SNS               ├── AWS SNS               ├── AWS SNS
└── P2P Alert ◄────────── └── P2P Alert ◄────────── └── P2P Alert
```

## Cloud Services

| Service | Platform | Purpose |
|---|---|---|
| Azure IoT Hub | Microsoft Azure | Receive simulated sensor data |
| AWS SageMaker | Amazon AWS | Health risk prediction (Low / Medium / High) |
| AWS SNS | Amazon AWS | Email alert when High risk detected |

## P2P Network

- Built with **libp2p** (TCP transport, Yamux multiplexing, Noise encryption)
- Each node has a unique **Peer ID**
- Nodes discover each other via DNS within Docker network
- Health alerts broadcast directly peer-to-peer — no central server

## Project Structure

```
SHT-CCSpring26/
├── p2p/
│   └── node.js          # P2P node + IoT sensor simulation
├── backend/             # Node.js API (in progress)
├── frontend/            # React dashboard (in progress)
├── iot-simulator/       # Standalone IoT scripts (in progress)
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Quick Start

**Requirements:** Docker Desktop

```bash
git clone https://github.com/BrandonSomoza/SHT-CCSpring26.git
cd SHT-CCSpring26
docker compose up
```

This starts 3 P2P nodes. Each node simulates health sensor data every 30 seconds and broadcasts alerts to all peers when High risk is detected.

## Expected Output

```
[A] Sensor data | Heart rate: 77 bpm | Temp: 36.6 C | Steps: 129 | Risk: Low
[A] Sensor data | Heart rate: 145 bpm | Temp: 38.6 C | Steps: 103 | Risk: High
[A] Broadcasting alert to 2 peers...
[B] *** RECEIVED ALERT: HEALTH ALERT from Node A: High risk detected! Heart rate: 145 bpm, Temp: 38.6 C ***
[C] *** RECEIVED ALERT: HEALTH ALERT from Node A: High risk detected! Heart rate: 145 bpm, Temp: 38.6 C ***
```

## Status

- [x] P2P node network — 3 nodes, full mesh, health alert broadcasting
- [x] IoT sensor simulation — heart rate, temperature, steps (every 30s)
- [ ] Azure IoT Hub integration
- [ ] AWS SageMaker ML model
- [ ] AWS SNS alerts
- [ ] React frontend dashboard
