import { sendWebSocketMessage } from './websocket.js';
import { roomStore } from '../stores/roomStore.js';
import { deriveRoomKey, encryptText, decryptText, deriveServerRoomId } from './cryptoService.js';
import { get } from 'svelte/store';

/**
 * Send text message encrypted with AES-256 E2EE
 * @param {string} text
 * @param {string} [targetRecipient]
 */
export async function sendTextMessage(text, targetRecipient = 'group') {
  if (!text || !text.trim()) return;

  const state = get(roomStore);
  const roomId = state.roomId;
  const senderName = state.userProfile.nickname;
  const myPeerId = state.userProfile.peerId;

  let ciphertext = text.trim();
  let iv = '';
  let serverRoomHash = '';

  if (roomId) {
    try {
      serverRoomHash = await deriveServerRoomId(roomId);
      const roomKey = await deriveRoomKey(roomId);
      const encrypted = await encryptText(ciphertext, roomKey);
      ciphertext = encrypted.ciphertext;
      iv = encrypted.iv;
    } catch (e) {
      console.error('[E2EE] Failed to encrypt chat message', e);
    }
  }

  const messagePayload = {
    type: 'chat_message',
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    roomId: serverRoomHash,
    sender: senderName,
    senderPeerId: myPeerId,
    target: targetRecipient || 'group',
    targetPeerId: targetRecipient || 'group',
    text: ciphertext,
    iv,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  // Add plaintext to local store for self
  addChatMessage(roomId, {
    ...messagePayload,
    text: text.trim()
  });

  sendWebSocketMessage(messagePayload);
}

/**
 * Decrypt incoming chat message before displaying
 * @param {string} roomId
 * @param {any} message
 */
export async function processIncomingChatMessage(roomId, message) {
  let plainText = message.text;

  if (roomId && message.iv) {
    try {
      const roomKey = await deriveRoomKey(roomId);
      plainText = await decryptText(message.text, message.iv, roomKey);
    } catch (e) {
      console.error('[E2EE] Decryption error for chat message', e);
    }
  }

  addChatMessage(roomId, {
    ...message,
    text: plainText
  });
}

/**
 * Add message to local roomStore chat array
 * @param {string} roomId
 * @param {import('../stores/roomStore.js').ChatMessage} message
 */
export function addChatMessage(roomId, message) {
  roomStore.update(state => {
    // Avoid duplicate message IDs
    if (state.chatMessages.some(m => m.id === message.id)) {
      return state;
    }

    const updatedMessages = [...state.chatMessages, message];

    // Persist chat history per room in localStorage
    if (typeof window !== 'undefined' && roomId) {
      try {
        localStorage.setItem(`firese_chat_${roomId}`, JSON.stringify(updatedMessages.slice(-100)));
      } catch {
        // Ignore quota limits
      }
    }

    return {
      ...state,
      chatMessages: updatedMessages
    };
  });
}

/**
 * Load chat history for room from localStorage
 * @param {string} roomId
 */
export function loadChatHistory(roomId) {
  if (typeof window === 'undefined' || !roomId) return;

  try {
    const saved = localStorage.getItem(`firese_chat_${roomId}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      roomStore.update(s => ({ ...s, chatMessages: parsed }));
    } else {
      roomStore.update(s => ({ ...s, chatMessages: [] }));
    }
  } catch {
    roomStore.update(s => ({ ...s, chatMessages: [] }));
  }
}

/**
 * Clear chat history for active room or recipient
 * @param {string} [recipient]
 */
export function clearChatHistory(recipient = 'group') {
  const state = get(roomStore);
  const roomId = state.roomId;

  if (recipient === 'group') {
    roomStore.update(s => ({ ...s, chatMessages: s.chatMessages.filter(m => m.target !== 'group' && m.targetPeerId !== 'group') }));
  } else {
    const myPeerId = state.userProfile.peerId;
    const myName = state.userProfile.nickname;
    roomStore.update(s => ({
      ...s,
      chatMessages: s.chatMessages.filter(m =>
        !((m.senderPeerId === recipient || m.sender === recipient) && (m.targetPeerId === myPeerId || m.target === myName)) &&
        !((m.senderPeerId === myPeerId || m.sender === myName) && (m.targetPeerId === recipient || m.target === recipient))
      )
    }));
  }

  if (typeof window !== 'undefined' && roomId) {
    try {
      const updated = get(roomStore).chatMessages;
      localStorage.setItem(`firese_chat_${roomId}`, JSON.stringify(updated));
    } catch {
      // Ignore
    }
  }
}
