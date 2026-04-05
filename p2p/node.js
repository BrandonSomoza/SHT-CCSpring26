import { createLibp2p } from 'libp2p'
import { tcp } from '@libp2p/tcp'
import { yamux } from '@libp2p/yamux'
import { noise } from '@chainsafe/libp2p-noise'

const NODE_ID = process.env.NODE_ID || 'A'
const PORT = parseInt(process.env.PORT) || 3001

const node = await createLibp2p({
  addresses: {
    listen: ['/ip4/0.0.0.0/tcp/' + PORT]
  },
  transports: [tcp()],
  streamMuxers: [yamux()],
  connectionEncryption: [noise()]
})

await node.start()

console.log('Node ' + NODE_ID + ' started')
console.log('Peer ID: ' + node.peerId.toString())
console.log('Listening on port ' + PORT)

node.addEventListener('peer:connect', (evt) => {
  console.log('[' + NODE_ID + '] Connected to: ' + evt.detail.toString())
})
