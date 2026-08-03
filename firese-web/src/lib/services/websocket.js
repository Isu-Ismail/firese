import { roomStore, generatePeerId } from '../stores/roomStore.js';
import { handleIncomingChunk, handleIncomingMetadata } from './fileStreamer.js';
import { initiateWebRTCConnection, handleWebRTCOffer, handleWebRTCAnswer, handleWebRTCIce, closeAllWebRTC } from './webrtcService.js';
import { fetchPublicIp } from './ipService.js';
import { loadChatHistory, addChatMessage } from './chatService.js';
import { deriveRoomKey, decryptText } from './cryptoService.js';
import { get } from 'svelte/store';

/** @type {WebSocket | null} */
let socket = null;

/** @type {any} */
let idlePeerTimer = null;

/**
 * Manage 120-second idle timer when peerCount <= 1
 * @param {boolean} isConnected
 * @param {number} peerCount
 */
function manageIdlePeerTimer(isConnected, peerCount) {
  if (isConnected && peerCount <= 1) {
    if (!idlePeerTimer) {
      console.log('[WebSocket] Single peer in room. Starting 120s idle auto-disconnect timer...');
      idlePeerTimer = setTimeout(() => {
        console.warn('[WebSocket] 120s idle timeout reached without additional peers. Disconnecting...');
        disconnectWebSocket();
        alert('Disconnected from room: No other peers joined within 120 seconds.');
        idlePeerTimer = null;
      }, 120000);
    }
  } else {
    if (idlePeerTimer) {
      console.log('[WebSocket] Multiple peers present or disconnected. Resetting 120s idle timer.');
      clearTimeout(idlePeerTimer);
      idlePeerTimer = null;
    }
  }
}

/**
 * @param {string} roomId
 * @returns {string}
 */
export function getWebSocketUrl(roomId) {
  let baseUrl = '';

  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('firese_custom_ws_url');
    if (customUrl && customUrl.trim()) {
      baseUrl = customUrl.trim();
    }
  }

  if (!baseUrl) {
    baseUrl = import.meta.env.VITE_WS_URL;
  }
  
  if (!baseUrl) {
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    if (isHttps) {
      baseUrl = 'wss://firese-server.onrender.com/ws';
    } else {
      const host = (typeof window !== 'undefined' && window.location.hostname) || 'localhost';
      baseUrl = `ws://${host}:8080/ws`;
    }
  }

  const url = new URL(baseUrl);
  url.searchParams.set('room', roomId);
  return url.toString();
}

/**
 * Save room connection to room history list
 * @param {string} roomId
 */
function recordRoomHistory(roomId) {
  if (!roomId || typeof window === 'undefined') return;

  const timestamp = new Date().toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const state = get(roomStore);
  
  const existingIndex = state.roomHistory.findIndex(r => r.roomId === roomId);
  let updatedHistory = [...state.roomHistory];

  if (existingIndex >= 0) {
    updatedHistory[existingIndex] = { roomId, lastConnected: timestamp };
  } else {
    updatedHistory.unshift({ roomId, lastConnected: timestamp });
  }

  // Keep last 15 rooms max
  updatedHistory = updatedHistory.slice(0, 15);
  roomStore.update(s => ({ ...s, roomHistory: updatedHistory }));

  try {
    localStorage.setItem('firese_room_history', JSON.stringify(updatedHistory));
  } catch {
    // Ignore
  }
}

/**
 * Send self identity frame (peerId + nickname + IP)
 */
export function broadcastSelfPeerInfo() {
  const state = get(roomStore);
  sendWebSocketMessage({
    type: 'peer_info',
    peerId: state.userProfile.peerId,
    nickname: state.userProfile.nickname,
    ip: state.userProfile.ip
  });
}

/**
 * Connect to WebSocket room
 * @param {string} roomId
 * @returns {WebSocket | null}
 */
export function connectWebSocket(roomId) {
  if (!roomId || !roomId.trim()) return null;

  const cleanRoomId = roomId.trim();

  if (socket) {
    socket.close();
  }

  // Persist last room ID in localStorage permanently
  if (typeof window !== 'undefined') {
    localStorage.setItem('firese_last_room', cleanRoomId);
  }

  recordRoomHistory(cleanRoomId);

  const wsUrl = getWebSocketUrl(cleanRoomId);
  socket = new WebSocket(wsUrl);
  socket.binaryType = 'arraybuffer';

  loadChatHistory(cleanRoomId);
  roomStore.update(s => ({ ...s, roomId: cleanRoomId, isConnected: false, isConnecting: true }));

  socket.onopen = async () => {
    console.log(`[WebSocket] Connected to room ${cleanRoomId} via ${wsUrl}`);
    roomStore.update(s => ({ ...s, isConnected: true, isConnecting: false }));
    manageIdlePeerTimer(true, 1);

    // Fetch IP and broadcast identity to room peers
    await fetchPublicIp();
    broadcastSelfPeerInfo();
  };

  /**
   * @param {MessageEvent<string | ArrayBuffer>} event
   */
  socket.onmessage = async (event) => {
    if (typeof event.data === 'string') {
      try {
        const data = JSON.parse(event.data);
        const state = get(roomStore);

        if (data.type === 'peer_count') {
          const count = typeof data.count === 'number' ? data.count : 1;
          roomStore.update(s => ({ ...s, peerCount: count }));
          manageIdlePeerTimer(state.isConnected, count);
        } else if (data.type === 'peer_info') {
          const peerId = data.peerId || data.id || ('peer_' + (data.nickname || 'user'));
          if (data.nickname && data.nickname !== state.userProfile.nickname) {
            roomStore.update(s => {
              const existingIndex = s.peers.findIndex(p => p.peerId === peerId || p.nickname === data.nickname);
              const updatedPeers = [...s.peers];
              const peerItem = {
                peerId: peerId,
                nickname: data.nickname || 'Peer',
                ip: data.ip || '127.0.0.1'
              };
              if (existingIndex >= 0) {
                updatedPeers[existingIndex] = peerItem;
              } else {
                updatedPeers.push(peerItem);
              }
              return { ...s, peers: updatedPeers };
            });

            // Re-announce self so newly connected peer receives self info
            broadcastSelfPeerInfo();

            // If WebRTC mode is active, initiate WebRTC P2P DataChannel connection
            if (state.transportMode === 'webrtc') {
              initiateWebRTCConnection(peerId);
            }
          }
        } else if (data.type === 'webrtc_offer') {
          await handleWebRTCOffer(data);
        } else if (data.type === 'webrtc_answer') {
          await handleWebRTCAnswer(data);
        } else if (data.type === 'webrtc_ice') {
          await handleWebRTCIce(data);
        } else if (data.type === 'chat_message') {
          const isTargetMe = data.targetPeerId ? data.targetPeerId === state.userProfile.peerId : (data.target === state.userProfile.nickname);
          const isSenderMe = data.senderPeerId ? data.senderPeerId === state.userProfile.peerId : (data.sender === state.userProfile.nickname);
          const isGroup = data.target === 'group' || data.targetPeerId === 'group';

          if (isGroup || isTargetMe || isSenderMe) {
            let plainText = data.text;
            if (state.roomId && data.iv) {
              try {
                const roomKey = await deriveRoomKey(state.roomId);
                plainText = await decryptText(data.text, data.iv, roomKey);
              } catch (e) {
                console.error('[E2EE] Decryption error for chat message', e);
              }
            }
            addChatMessage(state.roomId, {
              ...data,
              text: plainText
            });
          }
        } else if (data.type === 'file_meta') {
          handleIncomingMetadata(data);
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing JSON text frame', err);
      }
    } else if (event.data instanceof ArrayBuffer) {
      handleIncomingChunk(event.data);
    }
  };

  socket.onclose = () => {
    console.log('[WebSocket] Connection closed');
    manageIdlePeerTimer(false, 0);
    closeAllWebRTC();
    roomStore.update(s => ({ ...s, isConnected: false, isConnecting: false, peerCount: 0, peers: [] }));
  };

  /**
   * @param {Event} error
   */
  socket.onerror = (error) => {
    console.error('[WebSocket] Error:', error);
    manageIdlePeerTimer(false, 0);
    roomStore.update(s => ({ ...s, isConnected: false, isConnecting: false }));
  };

  return socket;
}

/**
 * @param {string | ArrayBuffer | Record<string, unknown>} data
 */
export function sendWebSocketMessage(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    if (typeof data === 'string' || data instanceof ArrayBuffer) {
      socket.send(data);
    } else {
      socket.send(JSON.stringify(data));
    }
  }
}

export function disconnectWebSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
  manageIdlePeerTimer(false, 0);
  closeAllWebRTC();
  roomStore.update(s => ({ ...s, isConnected: false, isConnecting: false, peerCount: 0, peers: [] }));
}

/**
 * End Session & Clear All Local Cache
 */
export function endSessionAndClearCache() {
  if (socket) {
    socket.close();
    socket = null;
  }
  manageIdlePeerTimer(false, 0);
  closeAllWebRTC();
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
  }
  roomStore.set({
    roomId: '',
    isConnected: false,
    isConnecting: false,
    peerCount: 0,
    userProfile: {
      peerId: generatePeerId(),
      nickname: '',
      ip: 'Detecting...'
    },
    peers: [],
    chatMessages: [],
    roomHistory: [],
    activeTransfer: null,
    receivedFile: null,
    transfersHistory: [],
    transportMode: 'websocket',
    webrtcStatus: 'idle'
  });
}

// Silent disconnect on page unload or browser close without wiping stored room code
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (socket) {
      socket.close();
    }
  });
}
