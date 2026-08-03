/**
 * Format a peer's display name cleanly:
 * - Returns peer nickname if unique.
 * - Appends short #4-char tag if duplicate nicknames exist in the room or matches user's nickname.
 * - Fallbacks to Peer (#4-char) if unknown raw peerId.
 * - Handles 'group' -> 'Group (All Peers)' or 'Group'.
 * 
 * @param {string | null | undefined} targetKey
 * @param {import('../stores/roomStore.js').Peer[]} [peers]
 * @param {string} [myNickname]
 * @param {boolean} [isFullLabel]
 * @returns {string}
 */
export function formatPeerName(targetKey, peers = [], myNickname = '', isFullLabel = false) {
  if (!targetKey || targetKey === 'group') {
    return isFullLabel ? 'Group (All Peers)' : 'Group';
  }

  const peerList = Array.isArray(peers) ? peers : [];
  const peer = peerList.find(p => p.peerId === targetKey || p.nickname === targetKey);

  if (peer) {
    const duplicateCount = peerList.filter(p => p.nickname === peer.nickname).length;
    const sameAsMyNickname = Boolean(myNickname && myNickname === peer.nickname);

    if (duplicateCount > 1 || sameAsMyNickname) {
      const shortTag = peer.peerId ? peer.peerId.slice(-4) : '';
      return `${peer.nickname} (#${shortTag})`;
    }
    return peer.nickname;
  }

  // If target is raw peer ID (e.g. peer_13f9lg2c) but not in active peer list
  if (typeof targetKey === 'string' && targetKey.startsWith('peer_')) {
    const shortTag = targetKey.slice(-4);
    return `Peer (#${shortTag})`;
  }

  return targetKey;
}
