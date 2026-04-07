import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { yamux } from '@libp2p/yamux'
import { noise } from '@chainsafe/libp2p-noise'
import { identify } from '@libp2p/identify'
import dns from 'dns/promises'
import http from 'http'
import net from 'net'

const NODE_ID = process.env.NODE_ID || 'A'
const PORT = parseInt(process.env.PORT) || 3001
const HTTP_PORT = PORT + 1000
const ALERT_PORT = PORT + 2000  // A:5001, B:5002, C:5003
const PEER_HOSTS = process.env.PEER_HOSTS ? process.env.PEER_HOSTS.split(',') : []
const PEER_PORTS = process.env.PEER_PORTS ? process.env.PEER_PORTS.split(',') : []

// Start libp2p node
const node = await createLibp2p({
  addresses: { listen: ['/ip4/0.0.0.0/tcp/' + PORT] },
  transports: [tcp()],
  streamMuxers: [yamux()],
  connectionEncryption: [noise()],
  services: { identify: identify() }
})

await node.start()
console.log('Node ' + NODE_ID + ' started')
console.log('Peer ID: ' + node.peerId.toString())
console.log('Listening on port ' + PORT)

// ── IoT Sensor Simulator ───────────────────────────────────────────────────
// Simulates a health monitoring wearable device
function generateSensorData() {
  // Occasionally generate high-risk values for demo purposes (20% chance)
  const isHighRisk = Math.random() < 0.2

  const heartRate = isHighRisk
    ? Math.floor(Math.random() * 30) + 120   // 120-150 bpm (high)
    : Math.floor(Math.random() * 40) + 60    // 60-100 bpm (normal)

  const temperature = isHighRisk
    ? parseFloat((Math.random() * 1.5 + 37.5).toFixed(1))  // 37.5-39.0 C (fever)
    : parseFloat((Math.random() * 1.0 + 36.0).toFixed(1))  // 36.0-37.0 C (normal)

  const steps = Math.floor(Math.random() * 200)

  return { heartRate, temperature, steps }
}

function assessRisk(data) {
  // Simple rule-based risk assessment (will be replaced by SageMaker later)
  if (data.heartRate > 120 || data.temperature > 37.5) return 'High'
  if (data.heartRate > 100 || data.temperature > 37.0) return 'Medium'
  return 'Low'
}

// ── Alert server (receives P2P alerts from other nodes) ───────────────────
const alertServer = net.createServer((socket) => {
  let data = ''
  socket.on('data', chunk => data += chunk)
  socket.on('end', () => {
    if (data) {
      console.log('[' + NODE_ID + '] *** RECEIVED ALERT: ' + data.trim() + ' ***')
    }
  })
})
alertServer.listen(ALERT_PORT, () => {
  console.log('[' + NODE_ID + '] Alert server on port ' + ALERT_PORT)
})

// ── HTTP server for peer ID exchange ──────────────────────────────────────
const httpServer = http.createServer((req, res) => {
  if (req.url === '/peerid') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(node.peerId.toString())
  } else {
    res.writeHead(404); res.end()
  }
})
httpServer.listen(HTTP_PORT, () => {
  console.log('[' + NODE_ID + '] HTTP info server on port ' + HTTP_PORT)
})

function fetchPeerId(host, port) {
  return new Promise((resolve, reject) => {
    const req = http.get('http://' + host + ':' + port + '/peerid', (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data.trim()))
    })
    req.on('error', reject)
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

// Send P2P alert via TCP
function sendAlert(ip, alertPort, message) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(alertPort, ip, () => {
      socket.write(message)
      socket.end()
      resolve()
    })
    socket.on('error', reject)
    socket.setTimeout(3000, () => { socket.destroy(); reject(new Error('timeout')) })
  })
}

// Broadcast alert to all connected peers
async function broadcastAlert(message) {
  console.log('[' + NODE_ID + '] Broadcasting alert to ' + connectedPeers.length + ' peers...')
  for (const peer of connectedPeers) {
    try {
      await sendAlert(peer.ip, peer.alertPort, message)
      console.log('[' + NODE_ID + '] Alert sent to peer ' + peer.peerId.slice(0, 16) + '...')
    } catch (err) {
      console.error('[' + NODE_ID + '] Failed to send alert: ' + err.message)
    }
  }
}

// ── Connect to peers ───────────────────────────────────────────────────────
const connectedPeers = []

if (PEER_HOSTS.length > 0) {
  setTimeout(async () => {
    for (let i = 0; i < PEER_HOSTS.length; i++) {
      try {
        const result = await dns.lookup(PEER_HOSTS[i])
        const ip = result.address
        const port = parseInt(PEER_PORTS[i]) || 3001
        const httpPort = port + 1000
        const alertPort = port + 2000

        console.log('[' + NODE_ID + '] Resolved ' + PEER_HOSTS[i] + ' -> ' + ip)

        const peerId = await fetchPeerId(ip, httpPort)
        console.log('[' + NODE_ID + '] Connected to peer: ' + peerId.slice(0, 16) + '...')

        await sendAlert(ip, alertPort, 'Node ' + NODE_ID + ' joined the network (PeerID: ' + node.peerId.toString().slice(0, 16) + '...)')

        connectedPeers.push({ ip, alertPort, peerId })
      } catch (err) {
        console.error('[' + NODE_ID + '] Failed to connect to ' + PEER_HOSTS[i] + ': ' + err.message)
      }
    }

    // Start sensor simulation after connecting to peers
    startSensorSimulation()
  }, 5000)
} else {
  // Nodes with no peers (B and C) also simulate sensors
  setTimeout(startSensorSimulation, 5000)
}

// ── IoT Sensor Simulation Loop ─────────────────────────────────────────────
function startSensorSimulation() {
  console.log('[' + NODE_ID + '] Starting IoT sensor simulation (every 30s)...')

  async function runSensor() {
    const data = generateSensorData()
    const risk = assessRisk(data)

    console.log(
      '[' + NODE_ID + '] Sensor data | ' +
      'Heart rate: ' + data.heartRate + ' bpm | ' +
      'Temp: ' + data.temperature + ' C | ' +
      'Steps: ' + data.steps + ' | ' +
      'Risk: ' + risk
    )

    // If High risk, broadcast alert to all peers via P2P
    if (risk === 'High' && connectedPeers.length > 0) {
      const alertMsg =
        'HEALTH ALERT from Node ' + NODE_ID + ': ' +
        'High risk detected! ' +
        'Heart rate: ' + data.heartRate + ' bpm, ' +
        'Temp: ' + data.temperature + ' C'
      await broadcastAlert(alertMsg)
    }
  }

  // Run immediately, then every 30 seconds
  runSensor()
  setInterval(runSensor, 30000)
}
