import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { yamux } from '@libp2p/yamux'
import { noise } from '@chainsafe/libp2p-noise'
import { identify } from '@libp2p/identify'
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns'
import dns from 'dns/promises'
import http from 'http'
import net from 'net'

const NODE_ID = process.env.NODE_ID || 'A'
const PORT = parseInt(process.env.PORT) || 3001
const HTTP_PORT = PORT + 1000
const SENSOR_PORT = PORT + 3000  // A:6001, B:6002, C:6003
const ALERT_PORT = PORT + 2000  // A:5001, B:5002, C:5003
const PEER_HOSTS = process.env.PEER_HOSTS ? process.env.PEER_HOSTS.split(',') : []
const PEER_PORTS = process.env.PEER_PORTS ? process.env.PEER_PORTS.split(',') : []

// ── AWS SNS Setup (each node has its own Topic) ──────────────────────────
const SNS_TOPIC_ARN = process.env['SNS_TOPIC_ARN_' + NODE_ID] || ''
const snsClient = SNS_TOPIC_ARN ? new SNSClient({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
}) : null

async function sendSNSAlert(subject, message) {
  if (!snsClient) {
    console.log('[' + NODE_ID + '] SNS not configured, skipping email alert')
    return
  }
  try {
    const command = new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: subject,
      Message: message
    })
    await snsClient.send(command)
    console.log('[' + NODE_ID + '] SNS email alert sent to topic: sht-alerts-node-' + NODE_ID.toLowerCase())
  } catch (err) {
    console.error('[' + NODE_ID + '] SNS error: ' + err.message)
  }
}

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
if (snsClient) {
  console.log('[' + NODE_ID + '] AWS SNS enabled, topic: ' + SNS_TOPIC_ARN)
} else {
  console.log('[' + NODE_ID + '] AWS SNS not configured (no SNS_TOPIC_ARN_' + NODE_ID + ')')
}


// ── Alert server (receives P2P alerts from other nodes) ───────────────────
const alertServer = net.createServer((socket) => {
  let data = ''
  socket.on('data', chunk => data += chunk)
  socket.on('end', async () => {
    if (data) {
      const msg = data.trim()
      console.log('[' + NODE_ID + '] *** RECEIVED ALERT: ' + msg + ' ***')

      // Send SNS email when receiving alert from another node
      if (msg.includes('HEALTH ALERT')) {
        await sendSNSAlert(
          'Smart Health Tracker - Alert Received by Node ' + NODE_ID,
          'Node ' + NODE_ID + ' received the following health alert:\n\n' +
          msg + '\n\n' +
          'This alert was broadcast via the P2P network.\n' +
          'Time: ' + new Date().toISOString()
        )
      }
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
// ── Sensor data receiver (from Python simulator) ──────────────────────────
const sensorServer = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/sensor-data') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', async () => {
      try {
        const data = JSON.parse(body)
        console.log(
          '[' + NODE_ID + '] Sensor data | ' +
          'Heart rate: ' + data.heart_rate + ' bpm | ' +
          'Temp: ' + data.temperature + ' C | ' +
          'Oxygen: ' + data.oxygen_level + '% | ' +
          'Risk: ' + data.risk
        )
        if (data.risk === 'High') {
          const alertMsg =
            'HEALTH ALERT from Node ' + NODE_ID + ': ' +
            'High risk detected! ' +
            'Heart rate: ' + data.heart_rate + ' bpm, ' +
            'Temp: ' + data.temperature + ' C, ' +
            'Oxygen: ' + data.oxygen_level + '%'

          // Send SNS email for self-detected High risk
          await sendSNSAlert(
            'Smart Health Tracker - High Risk on Node ' + NODE_ID,
            'Node ' + NODE_ID + ' detected abnormal health data:\n\n' +
            'Heart rate: ' + data.heart_rate + ' bpm\n' +
            'Temperature: ' + data.temperature + ' C\n' +
            'Oxygen level: ' + data.oxygen_level + '%\n' +
            'Risk level: HIGH\n\n' +
            'Immediate attention may be required.\n' +
            'Time: ' + new Date().toISOString()
          )

          // Broadcast to peers via P2P
          if (connectedPeers.length > 0) {
            await broadcastAlert(alertMsg)
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok' }))
      } catch (err) {
        res.writeHead(400); res.end('Bad request')
      }
    })
  } else {
    res.writeHead(404); res.end()
  }
})
sensorServer.listen(SENSOR_PORT, () => {
  console.log('[' + NODE_ID + '] Sensor receiver on port ' + SENSOR_PORT)
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

  }, 5000)
}
