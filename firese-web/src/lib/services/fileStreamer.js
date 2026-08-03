/**
 * @typedef {Object} FileMetaPayload
 * @property {string} [type]
 * @property {string} name
 * @property {string} [iv]
 * @property {string} [fileIv]
 * @property {number} size
 * @property {number} [originalSize]
 * @property {string} mime
 * @property {string} [sender]
 * @property {string} [senderPeerId]
 * @property {string} [target]
 * @property {string} [targetPeerId]
 */

/**
 * @typedef {Object} ReceiverState
 * @property {string} name
 * @property {number} size
 * @property {number} originalSize
 * @property {string} mime
 * @property {string} sender
 * @property {string} [senderPeerId]
 * @property {string} target
 * @property {string} [targetPeerId]
 * @property {ArrayBuffer[]} chunks
 * @property {number} receivedBytes
 * @property {number} startTime
 * @property {number} lastUIUpdate
 * @property {import('crypto').webcrypto.CryptoKey | CryptoKey | null} [key]
 * @property {string} [fileIv]
 */

import { sendWebSocketMessage, getWebSocketBufferedAmount, waitForWebSocketDrain } from './websocket.js';
import { sendWebRTCJson, sendWebRTCBinary, isWebRTCReady } from './webrtcService.js';
import { roomStore } from '../stores/roomStore.js';
import { deriveRoomKey, encryptText, decryptText, encryptBuffer, decryptBuffer } from './cryptoService.js';
import { get } from 'svelte/store';

const CHUNK_SIZE_WEBRTC = 512 * 1024;   // 512KB for WebRTC DataChannel (local/fast)
const CHUNK_SIZE_RELAY  = 64 * 1024;    // 64KB for WebSocket relay (free Render, higher latency)
const UI_THROTTLE_MS = 100;             // Throttle UI store updates to max 10 FPS during transfers

/** @type {ReceiverState | null} */
let receiverState = null;

/** @type {ArrayBuffer[]} */
let earlyBuffer = [];

/**
 * Abort active transfer and clear file streamer state
 */
export function cancelFileTransfer() {
  receiverState = null;
  earlyBuffer = [];
  roomStore.update(s => ({
    ...s,
    activeTransfer: null
  }));
}

/**
 * Send file over WebSocket or WebRTC DataChannel in real-time encrypted with single-pass AES-256 E2EE
 * @param {File} file
 * @param {string} [targetRecipient]
 * @returns {Promise<void>}
 */
export async function sendFile(file, targetRecipient = 'group') {
  if (!file) return;

  const state = get(roomStore);
  const roomId = state.roomId;
  const senderName = state.userProfile.nickname || 'You';
  const myPeerId = state.userProfile.peerId;

  let roomKey = null;
  let encryptedName = file.name;
  let nameIv = '';
  let fileIv = '';

  const rawFileBuffer = await file.arrayBuffer();
  let streamingBuffer = rawFileBuffer;

  // Single-pass WebCrypto AES-GCM Encryption (~150ms for 250MB)
  if (roomId) {
    try {
      roomKey = await deriveRoomKey(roomId);
      const encryptedNameObj = await encryptText(file.name, roomKey);
      encryptedName = encryptedNameObj.ciphertext;
      nameIv = encryptedNameObj.iv;

      const encryptedDataObj = await encryptBuffer(rawFileBuffer, roomKey);
      streamingBuffer = encryptedDataObj.encryptedBuffer;
      fileIv = encryptedDataObj.iv;
    } catch (e) {
      console.error('[E2EE] Single-pass file encryption error:', e);
    }
  }

  const totalBytes = streamingBuffer.byteLength;

  /** @type {FileMetaPayload} */
  const fileMeta = {
    type: 'file_meta',
    name: encryptedName,
    iv: nameIv,
    fileIv,
    size: totalBytes,
    originalSize: file.size,
    mime: file.type || 'application/octet-stream',
    sender: senderName,
    senderPeerId: myPeerId,
    target: targetRecipient || 'group',
    targetPeerId: targetRecipient || 'group'
  };

  const useWebRTC = state.transportMode === 'webrtc' && isWebRTCReady(targetRecipient);
  const CHUNK_SIZE = useWebRTC ? CHUNK_SIZE_WEBRTC : CHUNK_SIZE_RELAY;

  // 1. Send JSON metadata frame via WebRTC or WebSocket
  if (useWebRTC) {
    sendWebRTCJson(fileMeta, targetRecipient);
  } else {
    sendWebSocketMessage(fileMeta);
  }

  let offset = 0;
  let lastUIUpdate = 0;
  const startTime = Date.now();
  activeSenderAckBytes = 0;
  // Smaller window for relay to prevent buffer bloat on free Render
  const WINDOW_SIZE_BYTES = useWebRTC ? 4 * 1024 * 1024 : 512 * 1024;

  roomStore.update(s => ({
    ...s,
    activeTransfer: {
      name: file.name,
      size: file.size,
      mime: fileMeta.mime,
      sender: senderName,
      senderPeerId: myPeerId,
      progress: 0,
      speed: '0.00',
      isSending: true
    }
  }));

  // 2. Stream binary chunks with ACK Flow Control & backpressure
  while (offset < totalBytes) {
    // Lockstep Backpressure: If sender is too far ahead of Receiver ACK, pause
    while (offset - activeSenderAckBytes > WINDOW_SIZE_BYTES) {
      await new Promise(r => setTimeout(r, 20));
    }

    const end = Math.min(offset + CHUNK_SIZE, totalBytes);
    const chunk = streamingBuffer.slice(offset, end);

    if (useWebRTC) {
      sendWebRTCBinary(chunk, targetRecipient);
    } else {
      // Wait for WS buffer to drain before sending next chunk (relay backpressure)
      await waitForWebSocketDrain();
      sendWebSocketMessage(chunk);
    }
    offset = end;

    const now = Date.now();
    if (now - lastUIUpdate >= UI_THROTTLE_MS || offset === totalBytes) {
      lastUIUpdate = now;
      const elapsedTime = (now - startTime) / 1000 || 0.001;
      const currentBytes = Math.min(offset, activeSenderAckBytes);
      const rawProgress = Math.min(99, Math.round((currentBytes / totalBytes) * 99));
      const calculatedSpeed = (currentBytes / (1024 * 1024)) / elapsedTime;

      roomStore.update(s => ({
        ...s,
        activeTransfer: s.activeTransfer ? {
          ...s.activeTransfer,
          progress: Math.max(s.activeTransfer.progress || 0, rawProgress),
          speed: calculatedSpeed.toFixed(2)
        } : null
      }));
    }

    // Micro-task yielding every 4 chunks for throughput
    if (offset % (CHUNK_SIZE * 4) === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // 3. STRICT LOCKSTEP COMPLETION: Wait for receiver to confirm 100% receipt before completing sender UI
  let waitAckCounter = 0;
  while (activeSenderAckBytes < totalBytes && activeSenderAckCallback && waitAckCounter < 1200) {
    await new Promise(r => setTimeout(r, 50));
    waitAckCounter++;
  }

  /** @type {import('../stores/roomStore.js').TransferItem} */
  const completedItem = {
    name: file.name,
    size: file.size,
    mime: fileMeta.mime,
    sender: senderName,
    senderPeerId: myPeerId,
    progress: 100,
    type: 'sent'
  };

  if (activeSenderAckCallback) {
    activeSenderAckCallback();
    activeSenderAckCallback = null;
  } else {
    roomStore.update(s => ({
      ...s,
      activeTransfer: null,
      transfersHistory: [completedItem, ...s.transfersHistory]
    }));
  }
}

/** @type {(() => void) | null} */
let activeSenderAckCallback = null;
let activeSenderAckBytes = 0;

/**
 * Handle incoming transfer_ack progress frame from receiver peer
 * @param {any} ack
 */
export function handleTransferAck(ack) {
  if (!ack) return;

  if (ack.receivedBytes !== undefined) {
    activeSenderAckBytes = Math.max(activeSenderAckBytes, ack.receivedBytes);
  }

  if (ack.progress !== undefined) {
    roomStore.update(s => ({
      ...s,
      activeTransfer: (s.activeTransfer && s.activeTransfer.isSending) ? {
        ...s.activeTransfer,
        progress: Math.max(s.activeTransfer.progress || 0, ack.progress),
        speed: ack.speed || s.activeTransfer.speed
      } : s.activeTransfer
    }));
  }

  if (ack.status === 'complete' && activeSenderAckCallback) {
    activeSenderAckCallback();
    activeSenderAckCallback = null;
  }
}

/** @type {Worker | null} */
let worker = null;

function getStreamWorker() {
  if (typeof window === 'undefined') return null;
  if (!worker) {
    worker = new Worker(new URL('../workers/streamWorker.js', import.meta.url), { type: 'module' });
    worker.onmessage = async (e) => {
      const data = e.data;
      if (!data) return;

      if (data.type === 'progress') {
        if (receiverState && receiverState.senderPeerId) {
          sendWebSocketMessage({
            type: 'transfer_ack',
            targetPeerId: receiverState.senderPeerId,
            progress: data.progress,
            speed: data.speed,
            receivedBytes: data.receivedBytes
          });
        }

        roomStore.update(s => ({
          ...s,
          activeTransfer: s.activeTransfer ? {
            ...s.activeTransfer,
            progress: data.progress,
            speed: data.speed
          } : null
        }));
      } else if (data.type === 'assembly_start') {
        roomStore.update(s => ({
          ...s,
          activeTransfer: s.activeTransfer ? {
            ...s.activeTransfer,
            progress: 100,
            isProcessing: true,
            status: 'Decrypting file...'
          } : null
        }));
      } else if (data.type === 'complete') {
        if (receiverState.senderPeerId) {
          sendWebSocketMessage({
            type: 'transfer_ack',
            targetPeerId: receiverState.senderPeerId,
            progress: 100,
            status: 'complete'
          });
        }

        let finalBuffer = data.buffer;
        if (receiverState.key && receiverState.fileIv) {
          try {
            finalBuffer = await decryptBuffer(data.buffer, receiverState.fileIv, receiverState.key);
          } catch (err) {
            console.error('[E2EE] Background worker file decryption error:', err);
          }
        }

        const blob = new Blob([finalBuffer], { type: receiverState.mime });
        const blobUrl = URL.createObjectURL(blob);

        /** @type {import('../stores/roomStore.js').TransferItem} */
        const completedItem = {
          name: receiverState.name,
          size: receiverState.originalSize || receiverState.size,
          mime: receiverState.mime,
          sender: receiverState.sender,
          senderPeerId: receiverState.senderPeerId,
          progress: 100,
          type: 'received',
          blobUrl
        };

        // Automatic Download trigger if Auto-Save is ON
        const autoSaveOn = localStorage.getItem('firese_auto_download') === 'true';
        if (autoSaveOn && typeof window !== 'undefined') {
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = receiverState.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        receiverState = null;

        roomStore.update(s => ({
          ...s,
          activeTransfer: null,
          receivedFile: completedItem,
          transfersHistory: [completedItem, ...s.transfersHistory]
        }));
      }
    };
  }
  return worker;
}

/**
 * Handle incoming file_meta JSON frame on receiver side
 * @param {FileMetaPayload} meta
 */
export async function handleIncomingMetadata(meta) {
  const state = get(roomStore);
  const myName = state.userProfile.nickname;
  const myPeerId = state.userProfile.peerId;

  // 1. SENDER GUARD: Never receive or process your own sent files!
  if (meta.senderPeerId === myPeerId) {
    return;
  }

  // 2. TARGET GUARD: Verify private transfer target matches
  const isTargetGroup = meta.target === 'group' || meta.targetPeerId === 'group';
  const isTargetMe = (meta.targetPeerId && meta.targetPeerId === myPeerId) || (meta.target && meta.target === myName);
  if (!isTargetGroup && !isTargetMe) {
    return;
  }

  const roomId = state.roomId;
  let roomKey = null;
  let decryptedName = meta.name || 'Shared File';

  if (roomId) {
    try {
      roomKey = await deriveRoomKey(roomId);
      if (meta.iv) {
        decryptedName = await decryptText(meta.name, meta.iv, roomKey);
      }
    } catch (e) {
      console.error('[E2EE] Failed to decrypt incoming file metadata', e);
    }
  }

  const parsedSize = Number(meta.size) || 0;
  const origSize = Number(meta.originalSize) || parsedSize;
  const peerSender = meta.sender || (state.peers.length > 0 ? state.peers[0].nickname : 'Peer');

  receiverState = {
    name: decryptedName,
    size: parsedSize,
    originalSize: origSize,
    mime: meta.mime || 'application/octet-stream',
    sender: peerSender,
    senderPeerId: meta.senderPeerId,
    target: meta.target || 'group',
    targetPeerId: meta.targetPeerId || 'group',
    chunks: [],
    receivedBytes: 0,
    startTime: Date.now(),
    lastUIUpdate: 0,
    key: roomKey,
    fileIv: meta.fileIv
  };

  const w = getStreamWorker();
  if (w) {
    w.postMessage({
      type: 'init',
      meta: {
        ...meta,
        name: decryptedName,
        size: parsedSize
      }
    });
  }

  roomStore.update(s => ({
    ...s,
    activeTransfer: {
      name: decryptedName,
      size: origSize,
      mime: meta.mime || 'application/octet-stream',
      sender: peerSender,
      senderPeerId: meta.senderPeerId,
      progress: 0,
      speed: '0.00',
      isSending: false
    }
  }));

  // Process any early binary chunks queued before metadata
  if (earlyBuffer.length > 0) {
    const queued = [...earlyBuffer];
    earlyBuffer = [];
    for (const chunk of queued) {
      await handleIncomingChunk(chunk);
    }
  }
}

/**
 * Handle incoming binary ArrayBuffer chunk on receiver side
 * @param {ArrayBuffer} arrayBuffer
 */
export async function handleIncomingChunk(arrayBuffer) {
  if (!receiverState || receiverState.size <= 0) {
    earlyBuffer.push(arrayBuffer);
    return;
  }

  const w = getStreamWorker();
  if (w) {
    w.postMessage({
      type: 'chunk',
      chunk: arrayBuffer
    }, [arrayBuffer]);
  }
}
