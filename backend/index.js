import express from 'express'
import http from 'http'
import { WebSocketServer } from 'ws'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../frontend')))

// ── In-memory data store ──────────────────────────────────────────────────
const nodeData = { A: null, B: null, C: null }
const alertHistory = []
const MAX_ALERTS = 100

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

function broadcast(payload) {
  const msg = JSON.stringify(payload)
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg)
  })
}

// ── Receive sensor data from IoT simulators ───────────────────────────────
app.post('/api/sensor-data/:nodeId', async (req, res) => {
  const { nodeId } = req.params
  if (!['A', 'B', 'C'].includes(nodeId)) return res.status(400).json({ error: 'Invalid node' })

  const data = req.body
  nodeData[nodeId] = {
    nodeId,
    heart_rate: data.heart_rate,
    temperature: data.temperature,
    oxygen_level: data.oxygen_level,
    risk: data.risk,
    timestamp: data.timestamp || new Date().toISOString(),
    lastUpdated: new Date().toISOString()
  }

  if (data.risk === 'High') {
    const alert = {
      id: Date.now(),
      nodeId,
      source: 'self',
      message: `High risk detected on Node ${nodeId} — HR: ${data.heart_rate} bpm | Temp: ${data.temperature}°C | O₂: ${data.oxygen_level}%`,
      timestamp: new Date().toISOString()
    }
    alertHistory.unshift(alert)
    if (alertHistory.length > MAX_ALERTS) alertHistory.pop()
    broadcast({ type: 'new-alert', alert })
  }

  broadcast({ type: 'sensor-update', nodeId, data: nodeData[nodeId] })

  const sensorPorts = { A: 6001, B: 6002, C: 6003 }
  const nodeHosts = {
    A: process.env.NODE_HOST_A || 'sht-node-a',
    B: process.env.NODE_HOST_B || 'sht-node-b',
    C: process.env.NODE_HOST_C || 'sht-node-c'
  }
  const fwdUrl = `http://${nodeHosts[nodeId]}:${sensorPorts[nodeId]}/sensor-data`
  fetch(fwdUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(() => {})

  res.json({ status: 'ok' })
})

// ── Receive P2P alert forwarded from node.js ──────────────────────────────
app.post('/api/p2p-alert', (req, res) => {
  const { sourceNodeId, receivingNodeId, message } = req.body
  const alert = {
    id: Date.now(),
    nodeId: sourceNodeId,
    receivingNodeId,
    source: 'p2p',
    message: message || `P2P alert from Node ${sourceNodeId} → Node ${receivingNodeId}`,
    timestamp: new Date().toISOString()
  }
  alertHistory.unshift(alert)
  if (alertHistory.length > MAX_ALERTS) alertHistory.pop()
  broadcast({ type: 'new-alert', alert })
  res.json({ status: 'ok' })
})

// ── REST endpoints ────────────────────────────────────────────────────────
app.get('/api/nodes', (_req, res) => res.json(nodeData))
app.get('/api/alerts', (_req, res) => res.json(alertHistory))

app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'))
})

const PORT = process.env.BACKEND_PORT || 8080
server.listen(PORT, () => {
  console.log(`[Backend] API + dashboard running on http://0.0.0.0:${PORT}`)
})
