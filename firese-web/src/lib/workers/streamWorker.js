/**
 * Background Stream Receiver & Single-Pass WebCrypto Decryptor Worker
 * Runs on a dedicated OS background thread, un-throttled by tab switches or backgrounding.
 */

/** @type {ArrayBuffer[]} */
let chunks = [];
let receivedBytes = 0;
let totalSize = 0;
let startTime = 0;
let lastUIUpdate = 0;
let fileMeta = null;

self.onmessage = async function(e) {
  const data = e.data;
  if (!data) return;

  if (data.type === 'init') {
    chunks = [];
    receivedBytes = 0;
    fileMeta = data.meta;
    totalSize = fileMeta.size || 0;
    startTime = Date.now();
    lastUIUpdate = 0;

    self.postMessage({
      type: 'started',
      meta: fileMeta
    });
  } else if (data.type === 'chunk') {
    /** @type {ArrayBuffer} */
    const chunk = data.chunk;
    chunks.push(chunk);
    receivedBytes += chunk.byteLength;

    const now = Date.now();
    if (now - lastUIUpdate >= 100 || receivedBytes >= totalSize) {
      lastUIUpdate = now;
      const elapsedTime = (now - startTime) / 1000 || 0.001;
      const progress = totalSize > 0 ? Math.min(100, Math.round((receivedBytes / totalSize) * 100)) : 0;
      const speed = (receivedBytes / (1024 * 1024)) / elapsedTime;

      self.postMessage({
        type: 'progress',
        progress,
        speed: speed.toFixed(2),
        receivedBytes,
        totalSize
      });
    }

    if (totalSize > 0 && receivedBytes >= totalSize) {
      self.postMessage({
        type: 'assembly_start'
      });

      // Assemble ArrayBuffers
      const combinedBuffer = new Uint8Array(receivedBytes);
      let pos = 0;
      for (let i = 0; i < chunks.length; i++) {
        combinedBuffer.set(new Uint8Array(chunks[i]), pos);
        pos += chunks[i].byteLength;
      }

      chunks = [];

      self.postMessage({
        type: 'complete',
        buffer: combinedBuffer.buffer,
        meta: fileMeta
      });
    }
  } else if (data.type === 'reset') {
    chunks = [];
    receivedBytes = 0;
    totalSize = 0;
    fileMeta = null;
  }
};
