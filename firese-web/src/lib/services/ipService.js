import { roomStore } from '../stores/roomStore.js';

/**
 * Fetch Public WAN IP via lightweight HTTPS API
 */
export async function fetchPublicIp() {
  let publicIp = '127.0.0.1';

  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    if (data && data.ip) {
      publicIp = data.ip;
    }
  } catch {
    try {
      const fallbackRes = await fetch('https://api.seeip.org/jsonip');
      const fallbackData = await fallbackRes.json();
      if (fallbackData && fallbackData.ip) {
        publicIp = fallbackData.ip;
      }
    } catch {
      // Fallback default
    }
  }

  roomStore.update(s => ({
    ...s,
    userProfile: {
      ...s.userProfile,
      ip: publicIp
    }
  }));

  return publicIp;
}
