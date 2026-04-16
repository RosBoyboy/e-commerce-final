import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

let echoSingleton = null;

/**
 * Laravel Echo + Pusher (or Soketi / compatible host). Requires:
 * - Backend: BROADCAST_DRIVER=pusher, PUSHER_* in .env, `composer require pusher/pusher-php-server`
 * - Frontend: NEXT_PUBLIC_PUSHER_APP_KEY, NEXT_PUBLIC_PUSHER_APP_CLUSTER
 *
 * Returns null when Pusher key is missing (UI falls back to polling).
 */
export function getEcho() {
  if (typeof window === 'undefined') return null;

  const key = process.env.NEXT_PUBLIC_PUSHER_APP_KEY;
  if (!key) return null;

  if (echoSingleton) return echoSingleton;

  window.Pusher = Pusher;

  const rawBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
  const hostRoot = rawBase.replace(/\/api\/?$/, '');

  echoSingleton = new Echo({
    broadcaster: 'pusher',
    key,
    cluster: process.env.NEXT_PUBLIC_PUSHER_APP_CLUSTER || 'mt1',
    forceTLS: true,
    encrypted: true,
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel) => ({
      authorize: (socketId, callback) => {
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        fetch(`${hostRoot}/broadcasting/auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            socket_id: socketId,
            channel_name: channel.name,
          }),
        })
          .then((res) => {
            if (!res.ok) {
              return res.text().then((t) => {
                throw new Error(t || res.statusText);
              });
            }
            return res.json();
          })
          .then((data) => callback(false, data))
          .catch((err) => callback(true, err));
      },
    }),
  });

  return echoSingleton;
}

export function leaveEchoChannel(conversationId) {
  if (!echoSingleton || conversationId == null) return;
  try {
    echoSingleton.leave(`conversation.${conversationId}`);
  } catch {
    /* ignore */
  }
}

export function disconnectEcho() {
  if (echoSingleton && typeof echoSingleton.disconnect === 'function') {
    try {
      echoSingleton.disconnect();
    } catch {
      /* ignore */
    }
  }
  echoSingleton = null;
}
