/**
 * Firese Zero-Knowledge AES-GCM 256-bit End-to-End Encryption (E2EE) Module
 * Native Web Crypto API (Zero external dependencies)
 */

/** @type {Map<string, CryptoKey>} */
const keyCache = new Map();

/**
 * Convert string to Uint8Array
 * @param {string} str
 * @returns {Uint8Array}
 */
function encodeText(str) {
  return new TextEncoder().encode(str);
}

/**
 * Convert ArrayBuffer to string
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function decodeText(buffer) {
  return new TextDecoder().decode(buffer);
}

/**
 * Convert ArrayBuffer/Uint8Array to Base64 string
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {string}
 */
function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 * @param {string} base64
 * @returns {Uint8Array}
 */
function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Derive 256-bit AES-GCM CryptoKey from Room ID
 * @param {string} roomId
 * @returns {Promise<CryptoKey>}
 */
export async function deriveRoomKey(roomId) {
  if (!roomId) throw new Error('Room ID required for encryption key derivation');
  
  const cleanId = roomId.trim();
  if (keyCache.has(cleanId)) {
    return /** @type {CryptoKey} */ (keyCache.get(cleanId));
  }

  const rawKeyMaterial = encodeText(cleanId + '_firese_e2ee_salt_v1');
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', /** @type {any} */ (rawKeyMaterial.buffer));

  const key = await window.crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  keyCache.set(cleanId, key);
  return key;
}

/**
 * Encrypt plain text using AES-GCM
 * @param {string} plainText
 * @param {CryptoKey} key
 * @returns {Promise<{ ciphertext: string, iv: string }>}
 */
export async function encryptText(plainText, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = encodeText(plainText);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: /** @type {any} */ (iv) },
    key,
    /** @type {any} */ (encoded.buffer)
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypt ciphertext using AES-GCM
 * @param {string} ciphertextBase64
 * @param {string} ivBase64
 * @param {CryptoKey} key
 * @returns {Promise<string>}
 */
export async function decryptText(ciphertextBase64, ivBase64, key) {
  try {
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const iv = base64ToBuffer(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: /** @type {any} */ (iv) },
      key,
      /** @type {any} */ (ciphertext.buffer)
    );

    return decodeText(decryptedBuffer);
  } catch (err) {
    console.error('[E2EE] Failed to decrypt text frame:', err);
    return ciphertextBase64;
  }
}

/**
 * Encrypt binary ArrayBuffer chunk (Prepends 12-byte IV to returned ArrayBuffer)
 * @param {ArrayBuffer} chunkBuffer
 * @param {CryptoKey} key
 * @returns {Promise<ArrayBuffer>}
 */
export async function encryptChunk(chunkBuffer, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: /** @type {any} */ (iv) },
    key,
    /** @type {any} */ (chunkBuffer)
  );

  // Combine IV (12 bytes) + encrypted bytes into single ArrayBuffer
  const encryptedBytes = new Uint8Array(encryptedBuffer);
  const combined = new Uint8Array(12 + encryptedBytes.byteLength);
  combined.set(iv, 0);
  combined.set(encryptedBytes, 12);

  return combined.buffer;
}

/**
 * Decrypt binary ArrayBuffer chunk (Extracts 12-byte IV from head)
 * @param {ArrayBuffer} combinedBuffer
 * @param {CryptoKey} key
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptChunk(combinedBuffer, key) {
  try {
    const combinedBytes = new Uint8Array(combinedBuffer);
    if (combinedBytes.byteLength < 12) return combinedBuffer;

    const iv = combinedBytes.slice(0, 12);
    const ciphertext = combinedBytes.slice(12);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: /** @type {any} */ (iv) },
      key,
      /** @type {any} */ (ciphertext.buffer)
    );

    return decryptedBuffer;
  } catch (err) {
    console.error('[E2EE] Failed to decrypt binary chunk:', err);
    return combinedBuffer;
  }
}

/**
 * Encrypt an entire ArrayBuffer in one single pass using AES-GCM (Ultra-high speed)
 * @param {ArrayBuffer} buffer
 * @param {CryptoKey} key
 * @returns {Promise<{ encryptedBuffer: ArrayBuffer, iv: string }>}
 */
export async function encryptBuffer(buffer, key) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: /** @type {any} */ (iv) },
    key,
    buffer
  );

  return {
    encryptedBuffer,
    iv: bufferToBase64(iv)
  };
}

/**
 * Decrypt an entire ArrayBuffer in one single pass using AES-GCM (Ultra-high speed)
 * @param {ArrayBuffer} encryptedBuffer
 * @param {string} ivBase64
 * @param {CryptoKey} key
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptBuffer(encryptedBuffer, ivBase64, key) {
  try {
    const iv = base64ToBuffer(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: /** @type {any} */ (iv) },
      key,
      encryptedBuffer
    );

    return decryptedBuffer;
  } catch (err) {
    console.error('[E2EE] Failed to decrypt buffer:', err);
    return encryptedBuffer;
  }
}
