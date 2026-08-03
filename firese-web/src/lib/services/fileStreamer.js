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

import { sendWebSocketMessage } from './websocket.js';
import { sendWebRTCJson, sendWebRTCBinary, isWebRTCReady } from './webrtcService.js';
import { roomStore } from '../stores/roomStore.js';
import { deriveRoomKey, encryptText, decryptText, encryptBuffer, decryptBuffer } from './cryptoService.js';
import { get } from 'svelte/store';

const CHUNK_SIZE = 512 * 1024; // 512KB high-speed binary chunks
const UI_THROTTLE_MS = 100;    // Throttle UI store updates to max 10 FPS during transfers

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

  // 1. Send JSON metadata frame via WebRTC or WebSocket
  if (useWebRTC) {
    sendWebRTCJson(fileMeta, targetRecipient);
  } else {
    sendWebSocketMessage(fileMeta);
  }

  let offset = 0;
  let lastUIUpdate = 0;
  const startTime = Date.now();

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

  // 2. Stream binary 512KB chunks with UI reactivity throttling
  while (offset < totalBytes) {
    const end = Math.min(offset + CHUNK_SIZE, totalBytes);
    const chunk = streamingBuffer.slice(offset, end);

    if (useWebRTC) {
      sendWebRTCBinary(chunk, targetRecipient);
    } else {
      sendWebSocketMessage(chunk);
    }
    offset = end;

    const now = Date.now();
    if (now - lastUIUpdate >= UI_THROTTLE_MS || offset === totalBytes) {
      lastUIUpdate = now;
      const elapsedTime = (now - startTime) / 1000 || 0.001;
      const progress = Math.min(100, Math.round((offset / totalBytes) * 100));
      const speed = (offset / (1024 * 1024)) / elapsedTime;

      roomStore.update(s => ({
        ...s,
        activeTransfer: s.activeTransfer ? {
          ...s.activeTransfer,
          progress,
          speed: speed.toFixed(2)
        } : null
      }));
    }

    if (offset % (CHUNK_SIZE * 8) === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
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

  roomStore.update(s => ({
    ...s,
    activeTransfer: null,
    transfersHistory: [completedItem, ...s.transfersHistory]
  }));
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
  if ((meta.senderPeerId && meta.senderPeerId === myPeerId) || (meta.sender === myName && !meta.senderPeerId)) {
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

  receiverState.chunks.push(arrayBuffer);
  receiverState.receivedBytes += arrayBuffer.byteLength;

  const now = Date.now();
  if (now - receiverState.lastUIUpdate >= UI_THROTTLE_MS || receiverState.receivedBytes >= receiverState.size) {
    receiverState.lastUIUpdate = now;
    const elapsedTime = (now - receiverState.startTime) / 1000 || 0.001;
    const rawProgress = (receiverState.receivedBytes / receiverState.size) * 100;
    const progress = Math.min(100, Math.round(rawProgress));
    const speed = (receiverState.receivedBytes / (1024 * 1024)) / elapsedTime;

    roomStore.update(s => ({
      ...s,
      activeTransfer: s.activeTransfer ? {
        ...s.activeTransfer,
        progress,
        speed: speed.toFixed(2)
      } : null
    }));
  }

  // When all bytes are received, combine and decrypt in single-pass
  if (receiverState.receivedBytes >= receiverState.size && receiverState.size > 0) {
    let combinedBuffer = new Uint8Array(receiverState.size);
    let offset = 0;
    for (const c of receiverState.chunks) {
      combinedBuffer.set(new Uint8Array(c), offset);
      offset += c.byteLength;
    }

    let finalBuffer = combinedBuffer.buffer;
    if (receiverState.key && receiverState.fileIv) {
      try {
        finalBuffer = await decryptBuffer(combinedBuffer.buffer, receiverState.fileIv, receiverState.key);
      } catch (e) {
        console.error('[E2EE] Single-pass file decryption error:', e);
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

    roomStore.update(s => ({
      ...s,
      activeTransfer: null,
      receivedFile: completedItem,
      transfersHistory: [completedItem, ...s.transfersHistory]
    }));

    // Auto-download file if Save: ON setting is enabled
    if (typeof window !== 'undefined' && localStorage.getItem('firese_auto_download') === 'true') {
      try {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = receiverState.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error('[Auto-Save] Automatic file download failed:', err);
      }
    }

    receiverState = null;
    earlyBuffer = [];
  }
}
