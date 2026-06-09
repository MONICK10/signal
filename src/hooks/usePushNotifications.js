import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { messaging } from '../firebase/config';
import { db } from '../firebase/firestore';

export function usePushNotifications() {
  const requestPermission = async (uid) => {
    if (!messaging) return;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return; // VAPID key not configured yet

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;

      const token = await getToken(messaging, { vapidKey });
      if (token) {
        await updateDoc(doc(db, 'users', uid), { fcmToken: token });
      }
    } catch {
      // Silently fail — push notifications are optional
    }
  };

  const onForegroundMessage = (callback) => {
    if (!messaging) return () => {};
    return onMessage(messaging, callback);
  };

  return { requestPermission, onForegroundMessage };
}
