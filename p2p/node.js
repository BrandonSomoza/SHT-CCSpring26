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
// Simple TCP alert port (completely separate from libp2p)
const ALERT_PORT = PORT + 2000  // A:5001, B:5002, C:5003
const PEER_HOSTS = process.env.PEER_HOSTS ? process.env.PEER_HOSTS.split(',') : []
const PEER_PORTS = process.env.PEER_PORTS ? process.env.PEER_PORTS.split(',') : []

// Start libp2p (for P2P identity/transport demonstration)
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

// ── Simple TCP alert server (bypasses libp2p dial issues) ──────────────────
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

// ── HTTP server for peer info exchange ────────────────────────────────────
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

// Send alert via plain TCP directly
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

// ── Connect peers and send health alert ───────────────────────────────────
const connectedPeers = []  // { ip, alertPort, peerId }

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
        console.log('[' + NODE_ID + '] Peer ID of ' + PEER_HOSTS[i] + ': ' + peerId)

        // Test TCP connection with a HELLO message
        await sendAlert(ip, alertPort, 'HELLO from Node ' + NODE_ID + ' (PeerID: ' + node.peerId.toString().slice(0, 16) + '...)')
        console.log('[' + NODE_ID + '] Connected to ' + PEER_HOSTS[i] + ' via P2P TCP')

        connectedPeers.push({ ip, alertPort, peerId })
      } catch (err) {
        console.error('[' + NODE_ID + '] Failed to connect to ' + PEER_HOSTS[i] + ': ' + err.message)
      }
    }

    // Node A sends a health alert to all connected peers
    if (NODE_ID === 'A' && connectedPeers.length > 0) {
      setTimeout(async () => {
        const alert = 'HEALTH ALERT from Node A: High risk! Heart rate: 142 bpm'
        console.log('[A] Broadcasting health alert to ' + connectedPeers.length + ' peers...')
        for (const peer of connectedPeers) {
          try {
            await sendAlert(peer.ip, peer.alertPort, alert)
            console.log('[A] Alert sent to peer ' + peer.peerId.slice(0, 16) + '...')
          } catch (err) {
            console.error('[A] Failed to send alert: ' + err.message)
          }
        }
      }, 3000)
    }
  }, 5000)
}
