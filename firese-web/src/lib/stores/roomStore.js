import { writable } from 'svelte/store';

/**
 * Generate session-unique 8-char Peer ID
 * @returns {string}
 */
export function generatePeerId() {
  return 'peer_' + Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6);
}

/**
 * @typedef {Object} Peer
 * @property {string} peerId
 * @property {string} nickname
 * @property {string} ip
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} peerId
 * @property {string} nickname
 * @property {string} ip
 */

/**
 * @typedef {Object} ChatMessage
 * @property {string} id
 * @property {string} sender
 * @property {string} [senderPeerId]
 * @property {string} target
 * @property {string} [targetPeerId]
 * @property {string} text
 * @property {string} timestamp
 * @property {string} [roomId]
 */

/**
 * @typedef {Object} RoomHistoryItem
 * @property {string} roomId
 * @property {string} lastConnected
 */

/**
 * @typedef {Object} TransferItem
 * @property {string} [id]
 * @property {string} name
 * @property {number} size
 * @property {string} [mime]
 * @property {string} [type]
 * @property {string} [sender]
 * @property {string} [senderPeerId]
 * @property {string} [targetPeerId]
 * @property {boolean} [useWebRTC]
 * @property {string} [chunkSizeLabel]
 * @property {boolean} [isSending]
 * @property {boolean} [isProcessing]
 * @property {string} [speed]
 * @property {number} progress
 * @property {string} [status]
 * @property {string} [blobUrl]
 */

/**
 * @typedef {Object} RoomState
 * @property {string} roomId
 * @property {boolean} isConnected
 * @property {boolean} isConnecting
 * @property {number} peerCount
 * @property {Peer[]} peers
 * @property {UserProfile} userProfile
 * @property {ChatMessage[]} chatMessages
 * @property {RoomHistoryItem[]} roomHistory
 * @property {TransferItem | null} activeTransfer
 * @property {TransferItem | null} receivedFile
 * @property {TransferItem[]} transfersHistory
 * @property {'websocket' | 'webrtc'} transportMode
 * @property {'idle' | 'connecting' | 'connected' | 'failed'} webrtcStatus
 */

/**
 * Get initial transport mode setting from localStorage ('websocket' | 'webrtc')
 * @returns {'websocket' | 'webrtc'}
 */
function getInitialTransportMode() {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('firese_transport_mode');
    if (saved === 'webrtc') return 'webrtc';
  }
  return 'websocket';
}

/** @type {RoomState} */
const initialState = {
  roomId: '',
  isConnected: false,
  isConnecting: false,
  peerCount: 1,
  peers: [],
  userProfile: {
    peerId: generatePeerId(),
    nickname: '',
    ip: '127.0.0.1'
  },
  chatMessages: [],
  roomHistory: [],
  activeTransfer: null,
  receivedFile: null,
  transfersHistory: [],
  transportMode: getInitialTransportMode(),
  webrtcStatus: 'idle'
};

function createRoomStore() {
  const { subscribe, set, update } = writable(initialState);

  return {
    subscribe,
    set,
    update,
    reset: () => set({
      ...initialState,
      userProfile: {
        ...initialState.userProfile,
        peerId: generatePeerId()
      }
    })
  };
}

export const roomStore = createRoomStore();
