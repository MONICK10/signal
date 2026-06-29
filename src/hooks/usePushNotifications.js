import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { messaging } from '../firebase/config';
import { db } from '../firebase/firestore';

export function usePushNotifications() {
  const requestPermission = async (uid) => {
    if (!messaging) return;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const token = await getToken(messaging, { vapidKey });
      if (token) {
        // Store in array so multiple devices and token rotations are handled cleanly.
        // arrayUnion is idempotent — no duplicates written if the token didn't change.
        await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
      }
    } catch {
      // Push notifications are optional — silently ignore setup failures
    }
  };

  const onForegroundMessage = (callback) => {
    if (!messaging) return () => {};
    return onMessage(messaging, callback);
  };

  return { requestPermission, onForegroundMessage };
}
