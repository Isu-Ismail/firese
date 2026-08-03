/**
 * WebRTC P2P Mesh Service with STUN + Free TURN Relay Servers
 * TURN servers enable P2P on symmetric NAT (college/corporate networks)
 */

import { sendWebSocketMessage } from './websocket.js';
import { roomStore } from '../stores/roomStore.js';
import { handleIncomingMetadata, handleIncomingChunk, handleTransferAck, handleTransferCancel } from './fileStreamer.js';
import { get } from 'svelte/store';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' }
];

/**
 * Get ICE servers (Pure STUN for direct 0-cost P2P testing)
 * @returns {Promise<RTCIceServer[]>}
 */
export async function getIceServers() {
  return STUN_SERVERS;
}

/** @type {Map<string, RTCPeerConnection>} */
const peerConnections = new Map();

/** @type {Map<string, RTCDataChannel>} */
const dataChannels = new Map();

/** @type {Map<string, any>} */
const connectionTimers = new Map();

/** @type {Map<string, RTCIceCandidate[]>} */
const pendingIceCandidates = new Map();

/**
 * Test STUN server connectivity directly over raw UDP without HTTP
 * @returns {Promise<{ success: boolean, candidate?: string, error?: string }>}
 */
export function testStunServer() {
  return new Promise(async (resolve) => {
    try {
      const iceServers = await getIceServers();
      const pc = new RTCPeerConnection({ iceServers });
      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          resolve({ success: false, error: 'STUN UDP Timeout (Port 19302 blocked)' });
        }
      }, 3000);

      pc.createDataChannel('stunTest');
      pc.onicecandidate = (e) => {
        if (e.candidate && e.candidate.candidate.includes('srflx')) {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            const candidateStr = e.candidate.candidate;
            pc.close();
            resolve({ success: true, candidate: candidateStr });
          }
        }
      };

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(err => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            pc.close();
            resolve({ success: false, error: err.message });
          }
        });
    } catch (e) {
      resolve({ success: false, error: e.message });
    }
  });
}

/**
 * Update global roomStore WebRTC connection status based on active mesh
 */
function updateWebRTCStatus() {
  const state = get(roomStore);
  if (state.transportMode !== 'webrtc') return;

  const newPeerStatuses = { ...state.peerStatuses };
  peerConnections.forEach((pc, peerId) => {
    const isConnected = pc.connectionState === 'connected' || pc.iceConnectionState === 'connected';
    const isFailed = pc.connectionState === 'failed' || pc.iceConnectionState === 'failed';

    if (isConnected) {
      newPeerStatuses[peerId] = 'p2p_connected';
    } else if (isFailed) {
      newPeerStatuses[peerId] = 'p2p_failed';
    } else {
      newPeerStatuses[peerId] = 'p2p_connecting';
    }
  });

  const pcs = Array.from(peerConnections.values());
  if (pcs.length === 0) {
    roomStore.update(s => ({ ...s, webrtcStatus: 'idle', peerStatuses: newPeerStatuses }));
    return;
  }

  const hasConnected = pcs.some(pc => pc.connectionState === 'connected' || pc.iceConnectionState === 'connected');
  const hasFailed = pcs.some(pc => pc.connectionState === 'failed' || pc.iceConnectionState === 'failed');

  if (hasConnected) {
    roomStore.update(s => ({ ...s, webrtcStatus: 'connected', peerStatuses: newPeerStatuses }));
  } else if (hasFailed) {
    roomStore.update(s => ({ ...s, webrtcStatus: 'failed', peerStatuses: newPeerStatuses }));
  } else {
    roomStore.update(s => ({ ...s, webrtcStatus: 'connecting', peerStatuses: newPeerStatuses }));
  }
}

/**
 * Clean up WebRTC connection for a specific peer
 * @param {string} peerId
 */
export function removePeerWebRTC(peerId) {
  if (connectionTimers.has(peerId)) {
    clearTimeout(connectionTimers.get(peerId));
    connectionTimers.delete(peerId);
  }

  const dc = dataChannels.get(peerId);
  if (dc) {
    try { dc.close(); } catch {}
    dataChannels.delete(peerId);
  }

  const pc = peerConnections.get(peerId);
  if (pc) {
    try { pc.close(); } catch {}
    peerConnections.delete(peerId);
  }

  pendingIceCandidates.delete(peerId);
  updateWebRTCStatus();
}

/**
 * Close all active WebRTC connections and reset state
 */
export function closeAllWebRTC() {
  connectionTimers.forEach(timer => clearTimeout(timer));
  connectionTimers.clear();

  dataChannels.forEach(dc => {
    try { dc.close(); } catch {}
  });
  dataChannels.clear();

  peerConnections.forEach(pc => {
    try { pc.close(); } catch {}
  });
  peerConnections.clear();

  pendingIceCandidates.clear();
  roomStore.update(s => ({ ...s, webrtcStatus: 'idle' }));
}

/**
 * Configure event listeners for a WebRTC DataChannel
 * @param {string} peerId
 * @param {RTCDataChannel} dc
 */
function setupDataChannel(peerId, dc) {
  dc.binaryType = 'arraybuffer';
  dataChannels.set(peerId, dc);

  dc.onopen = () => {
    if (connectionTimers.has(peerId)) {
      clearTimeout(connectionTimers.get(peerId));
      connectionTimers.delete(peerId);
    }
    updateWebRTCStatus();
  };

  dc.onclose = () => {
    dataChannels.delete(peerId);
    updateWebRTCStatus();
  };

  dc.onerror = (err) => {
    console.error(`[WebRTC] DataChannel error with ${peerId}:`, err);
  };

  dc.onmessage = async (event) => {
    if (typeof event.data === 'string') {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'file_meta') {
           await handleIncomingMetadata(payload);
        } else if (payload.type === 'transfer_ack') {
          handleTransferAck(payload);
        } else if (payload.type === 'transfer_cancel') {
          handleTransferCancel(payload);
        } else if (payload.type === 'chat_message') {
          // Direct P2P chat message
          roomStore.update(s => ({
            ...s,
            chatMessages: [...s.chatMessages, payload.message]
          }));
        }
      } catch (e) {
        console.error('[WebRTC] Error parsing text message:', e);
      }
    } else if (event.data instanceof ArrayBuffer) {
      await handleIncomingChunk(event.data);
    }
  };
}

/**
 * Initiate WebRTC P2P connection to a target peer (Caller / Offerer)
 * @param {string} targetPeerId
 */
export async function initiateWebRTCConnection(targetPeerId) {
  if (!targetPeerId || peerConnections.has(targetPeerId)) return;

  roomStore.update(s => ({ ...s, webrtcStatus: 'connecting' }));

  const iceServers = await getIceServers();
  const pc = new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 10
  });
  peerConnections.set(targetPeerId, pc);

  // Set 15-second fallback timeout for firewall / NAT blocks
  const timer = setTimeout(() => {
    if (pc.connectionState !== 'connected' && pc.iceConnectionState !== 'connected') {
      console.warn(`[WebRTC] Connection to ${targetPeerId} timed out after 15s. Auto-falling back to WebSocket Relay...`);
      roomStore.update(s => ({ ...s, webrtcStatus: 'failed' }));
    }
  }, 15000);
  connectionTimers.set(targetPeerId, timer);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateStr = event.candidate.candidate;
      if (candidateStr.includes('relay')) {
        console.log('[WebRTC] 🌐 TURN Relay candidate gathered:', candidateStr);
      } else if (candidateStr.includes('srflx')) {
        console.log('[WebRTC] 📡 STUN candidate gathered:', candidateStr);
      }
      const state = get(roomStore);
      sendWebSocketMessage({
        type: 'webrtc_ice',
        targetPeerId,
        senderPeerId: state.userProfile.peerId,
        candidate: event.candidate
      });
    }
  };

  pc.onconnectionstatechange = () => {
    updateWebRTCStatus();
  };

  pc.oniceconnectionstatechange = () => {
    updateWebRTCStatus();
  };

  // Create DataChannel
  const dc = pc.createDataChannel('firese_datachannel', { ordered: true });
  setupDataChannel(targetPeerId, dc);

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const state = get(roomStore);
    sendWebSocketMessage({
      type: 'webrtc_offer',
      targetPeerId,
      senderPeerId: state.userProfile.peerId,
      offer
    });
  } catch (err) {
    console.error(`[WebRTC] Failed to create offer for ${targetPeerId}:`, err);
    removePeerWebRTC(targetPeerId);
    roomStore.update(s => ({ ...s, webrtcStatus: 'failed' }));
  }
}

/**
 * Handle incoming SDP Offer (Receiver / Answerer)
 * @param {any} payload
 */
export async function handleWebRTCOffer(payload) {
  const senderPeerId = payload.senderPeerId;
  if (!senderPeerId) return;

  if (peerConnections.has(senderPeerId)) {
    removePeerWebRTC(senderPeerId);
  }

  roomStore.update(s => ({ ...s, webrtcStatus: 'connecting' }));

  const iceServers = await getIceServers();
  const pc = new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 10
  });
  peerConnections.set(senderPeerId, pc);

  const timer = setTimeout(() => {
    if (pc.connectionState !== 'connected' && pc.iceConnectionState !== 'connected') {
      console.warn(`[WebRTC] Connection from ${senderPeerId} timed out after 8s`);
      roomStore.update(s => ({ ...s, webrtcStatus: 'failed' }));
    }
  }, 15000);
  connectionTimers.set(senderPeerId, timer);

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      const candidateStr = event.candidate.candidate;
      if (candidateStr.includes('relay')) {
        console.log('[WebRTC] 🌐 TURN Relay candidate gathered:', candidateStr);
      } else if (candidateStr.includes('srflx')) {
        console.log('[WebRTC] 📡 STUN candidate gathered:', candidateStr);
      }
      const state = get(roomStore);
      sendWebSocketMessage({
        type: 'webrtc_ice',
        targetPeerId: senderPeerId,
        senderPeerId: state.userProfile.peerId,
        candidate: event.candidate
      });
    }
  };

  pc.onconnectionstatechange = () => updateWebRTCStatus();
  pc.oniceconnectionstatechange = () => updateWebRTCStatus();

  pc.ondatachannel = (event) => {
    setupDataChannel(senderPeerId, event.channel);
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));

    // Flush any ICE candidates that arrived before remoteDescription was set
    const queued = pendingIceCandidates.get(senderPeerId);
    if (queued && queued.length > 0) {
      for (const candidate of queued) {
        try { await pc.addIceCandidate(candidate); } catch {}
      }
      pendingIceCandidates.delete(senderPeerId);
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const state = get(roomStore);
    sendWebSocketMessage({
      type: 'webrtc_answer',
      targetPeerId: senderPeerId,
      senderPeerId: state.userProfile.peerId,
      answer
    });
  } catch (err) {
    console.error(`[WebRTC] Failed to handle offer from ${senderPeerId}:`, err);
    removePeerWebRTC(senderPeerId);
    roomStore.update(s => ({ ...s, webrtcStatus: 'failed' }));
  }
}

/**
 * Handle incoming SDP Answer
 * @param {any} payload
 */
export async function handleWebRTCAnswer(payload) {
  const senderPeerId = payload.senderPeerId;
  const pc = peerConnections.get(senderPeerId);
  if (pc && payload.answer) {
    if (pc.signalingState === 'have-local-offer') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));

        // Flush any ICE candidates that arrived before remoteDescription was set
        const queued = pendingIceCandidates.get(senderPeerId);
        if (queued && queued.length > 0) {
          for (const candidate of queued) {
            try { await pc.addIceCandidate(candidate); } catch {}
          }
          pendingIceCandidates.delete(senderPeerId);
        }
      } catch (err) {
        console.error(`[WebRTC] Failed to set remote answer from ${senderPeerId}:`, err);
      }
    }
  }
}

/**
 * Handle incoming ICE Candidate
 * @param {any} payload
 */
export async function handleWebRTCIce(payload) {
  const senderPeerId = payload.senderPeerId;
  const pc = peerConnections.get(senderPeerId);
  if (pc && payload.candidate) {
    const candidate = new RTCIceCandidate(payload.candidate);
    if (pc.remoteDescription && pc.remoteDescription.type) {
      // Remote description already set — apply immediately
      try {
        await pc.addIceCandidate(candidate);
      } catch {}
    } else {
      // Queue candidate until remoteDescription is set
      if (!pendingIceCandidates.has(senderPeerId)) {
        pendingIceCandidates.set(senderPeerId, []);
      }
      pendingIceCandidates.get(senderPeerId).push(candidate);
    }
  }
}

/**
 * Check if WebRTC DataChannel is ready for transmission
 * @param {string} [targetPeerId]
 * @returns {boolean}
 */
export function isWebRTCReady(targetPeerId = 'group') {
  if (dataChannels.size === 0) return false;
  if (!targetPeerId || targetPeerId === 'group') {
    return Array.from(dataChannels.values()).some(dc => dc.readyState === 'open');
  }
  const dc = dataChannels.get(targetPeerId);
  return Boolean(dc && dc.readyState === 'open');
}

/**
 * Send JSON frame over WebRTC DataChannel(s)
 * @param {any} payload
 * @param {string} [targetPeerId]
 * @returns {boolean} Success status
 */
export function sendWebRTCJson(payload, targetPeerId = 'group') {
  const jsonStr = JSON.stringify(payload);
  let sent = false;

  if (!targetPeerId || targetPeerId === 'group') {
    dataChannels.forEach(dc => {
      if (dc.readyState === 'open') {
        dc.send(jsonStr);
        sent = true;
      }
    });
  } else {
    const dc = dataChannels.get(targetPeerId);
    if (dc && dc.readyState === 'open') {
      dc.send(jsonStr);
      sent = true;
    }
  }
  return sent;
}

/**
 * Send binary ArrayBuffer chunk over WebRTC DataChannel(s)
 * Automatically sub-slices large logical chunks (e.g. 8MB/16MB) into 256KB frames
 * to prevent browser maxMessageSize errors while maintaining high throughput.
 * @param {ArrayBuffer} chunk
 * @param {string} [targetPeerId]
 * @returns {boolean} Success status
 */
export function sendWebRTCBinary(chunk, targetPeerId = 'group') {
  if (!chunk || chunk.byteLength === 0) return false;
  let sent = false;
  const MAX_FRAME_SIZE = 256 * 1024; // 256KB safe browser protocol frame limit

  const sendToChannel = (/** @type {RTCDataChannel} */ dc) => {
    if (dc.readyState !== 'open') return;
    
    if (chunk.byteLength <= MAX_FRAME_SIZE) {
      dc.send(chunk);
    } else {
      let offset = 0;
      while (offset < chunk.byteLength) {
        const end = Math.min(offset + MAX_FRAME_SIZE, chunk.byteLength);
        const subSlice = chunk.slice(offset, end);
        dc.send(subSlice);
        offset = end;
      }
    }
    sent = true;
  };

  if (!targetPeerId || targetPeerId === 'group') {
    dataChannels.forEach(dc => sendToChannel(dc));
  } else {
    const dc = dataChannels.get(targetPeerId);
    if (dc) sendToChannel(dc);
  }

  return sent;
}

/**
 * Get DataChannel output buffer size in bytes
 * @param {string} [targetPeerId]
 * @returns {number}
 */
export function getWebRTCBufferedAmount(targetPeerId = 'group') {
  if (dataChannels.size === 0) return 0;
  if (!targetPeerId || targetPeerId === 'group') {
    let max = 0;
    dataChannels.forEach(dc => {
      if (dc.bufferedAmount > max) max = dc.bufferedAmount;
    });
    return max;
  }
  const dc = dataChannels.get(targetPeerId);
  return dc ? dc.bufferedAmount : 0;
}

/**
 * Wait until WebRTC DataChannel output buffer drops below threshold
 * @param {string} [targetPeerId]
 * @param {number} [threshold=1048576] - 1MB buffer threshold
 * @returns {Promise<void>}
 */
export function waitForWebRTCDrain(targetPeerId = 'group', threshold = 1024 * 1024) {
  return new Promise((resolve) => {
    const check = () => {
      const buffered = getWebRTCBufferedAmount(targetPeerId);
      if (buffered <= threshold) {
        resolve();
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
}
