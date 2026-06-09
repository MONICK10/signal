const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

async function sendPush(token, title, body, data = {}) {
  if (!token) return;
  try {
    await fcm.send({ token, notification: { title, body }, data });
  } catch {}
}

async function getToken(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  return snap.data()?.fcmToken || null;
}

// Signal received notification
exports.onSignalCreated = functions.firestore
  .document('signals/{signalId}')
  .onCreate(async (snap) => {
    const signal = snap.data();
    const token = await getToken(signal.toUid);
    const title = signal.anonymous
      ? 'Someone signaled you'
      : `${signal.fromDisplayName} signaled you`;
    await sendPush(token, title, 'Tap to accept or decline', {
      type: 'signal', signalId: snap.id,
    });
  });

// Signal accepted — notify sender
exports.onSignalAccepted = functions.firestore
  .document('signals/{signalId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status !== 'pending' || after.status !== 'accepted') return;

    const token = await getToken(after.fromUid);
    const body = after.anonymous
      ? 'Someone accepted your signal'
      : 'Your signal was accepted';
    await sendPush(token, 'Signal accepted!', body, {
      type: 'chat', chatId: after.chatId || '',
    });
  });

// Friend request notification
exports.onFriendRequest = functions.firestore
  .document('friendRequests/{requestId}')
  .onCreate(async (snap) => {
    const req = snap.data();
    const [receiverToken, senderSnap] = await Promise.all([
      getToken(req.toUid),
      db.doc(`users/${req.fromUid}`).get(),
    ]);
    const senderName = senderSnap.data()?.displayName || 'Someone';
    await sendPush(receiverToken, 'Friend request', `${senderName} wants to be friends`, {
      type: 'friendRequest', requestId: snap.id,
    });
  });

// New friend message notification
exports.onFriendMessage = functions.firestore
  .document('friendChats/{chatId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const [chatSnap, senderSnap] = await Promise.all([
      db.doc(`friendChats/${context.params.chatId}`).get(),
      db.doc(`users/${message.senderUid}`).get(),
    ]);

    const participants = chatSnap.data()?.participants || [];
    const receiverUid = participants.find((p) => p !== message.senderUid);
    if (!receiverUid) return;

    const [token] = await Promise.all([getToken(receiverUid)]);
    const senderName = senderSnap.data()?.displayName || 'Friend';
    await sendPush(token, senderName, message.text.substring(0, 100), {
      type: 'friendChat', chatId: context.params.chatId,
    });
  });
