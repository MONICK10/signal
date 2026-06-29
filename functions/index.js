const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();

// ── FCM helpers ────────────────────────────────────────────────

async function getTokens(uid) {
  const snap = await db.doc(`users/${uid}`).get();
  const data = snap.data() || {};
  // Support new array field; fall back to legacy single-token field
  if (Array.isArray(data.fcmTokens) && data.fcmTokens.length > 0) return data.fcmTokens;
  if (data.fcmToken) return [data.fcmToken];
  return [];
}

async function sendPush(tokens, title, body, data = {}) {
  const list = Array.isArray(tokens) ? tokens : [tokens];
  const valid = list.filter(Boolean);
  if (valid.length === 0) return;
  // FCM data values must all be strings
  const strData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)]));
  try {
    await fcm.sendEachForMulticast({ tokens: valid, notification: { title, body }, data: strData });
  } catch (e) {
    console.error('FCM sendEachForMulticast error:', e.message);
  }
}

// ── Notification helper ────────────────────────────────────────
// Writes to notifications/{userId}/items and fires a push.
// Extra fields in payload (e.g. score) are stored on the doc.

async function createNotification(userId, payload) {
  const { title, body, type, fromUserId = null, refId = null, ...extra } = payload;
  const ref = db.collection('notifications').doc(userId).collection('items').doc();
  await ref.set({
    type,
    fromUserId,
    refId,
    title,
    body,
    ...extra,
    read: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const tokens = await getTokens(userId);
  await sendPush(tokens, title, body, { type, refId: refId || '', notifId: ref.id });
}

// ── Vibe similarity: TF-IDF cosine ────────────────────────────
// Raw text never leaves this function — only the score is returned.

const STOPWORDS = new Set([
  'i','me','my','myself','we','our','ours','ourselves','you','your','yours',
  'yourself','yourselves','he','him','his','himself','she','her','hers',
  'herself','it','its','itself','they','them','their','theirs','themselves',
  'what','which','who','whom','this','that','these','those','am','is','are',
  'was','were','be','been','being','have','has','had','having','do','does',
  'did','doing','a','an','the','and','but','if','or','because','as','until',
  'while','of','at','by','for','with','about','against','between','into',
  'through','during','before','after','above','below','to','from','up','down',
  'in','out','on','off','over','under','again','further','then','once','here',
  'there','when','where','why','how','all','both','each','few','more','most',
  'other','some','such','no','nor','not','only','own','same','so','than',
  'too','very','can','will','just','should','now','also','get','like','love',
  'really','much','many','always','never','usually','often','still','even',
  'though','might','may','would','could','people','things','person','way',
]);

function computeVibeSimilarity(text1, text2) {
  const tokenize = (t) =>
    (t || '').toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const t1 = tokenize(text1);
  const t2 = tokenize(text2);

  // Both empty → neutral mid-score; one empty → low match
  if (t1.length === 0 && t2.length === 0) return 50;
  if (t1.length === 0 || t2.length === 0) return 15;

  const freq = (arr) => arr.reduce((f, w) => { f[w] = (f[w] || 0) + 1; return f; }, {});
  const f1 = freq(t1);
  const f2 = freq(t2);
  const vocab = new Set([...Object.keys(f1), ...Object.keys(f2)]);

  let dot = 0, mag1 = 0, mag2 = 0;
  for (const term of vocab) {
    const v1 = f1[term] || 0;
    const v2 = f2[term] || 0;
    dot += v1 * v2;
    mag1 += v1 * v1;
    mag2 += v2 * v2;
  }
  if (mag1 === 0 || mag2 === 0) return 15;
  const cosine = dot / (Math.sqrt(mag1) * Math.sqrt(mag2));
  return Math.round(cosine * 100);
}

// ── Callable: sendVibeRequest ─────────────────────────────────

exports.sendVibeRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }
  const fromUserId = context.auth.uid;
  const { toUserId } = data;

  if (!toUserId || typeof toUserId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'toUserId is required');
  }
  if (fromUserId === toUserId) {
    throw new functions.https.HttpsError('invalid-argument', 'Cannot vibe-check yourself');
  }

  // Rate-limit: no duplicate pending requests in either direction
  const [outSnap, inSnap] = await Promise.all([
    db.collection('vibeRequests')
      .where('fromUserId', '==', fromUserId)
      .where('toUserId', '==', toUserId)
      .where('status', '==', 'pending')
      .limit(1).get(),
    db.collection('vibeRequests')
      .where('fromUserId', '==', toUserId)
      .where('toUserId', '==', fromUserId)
      .where('status', '==', 'pending')
      .limit(1).get(),
  ]);
  if (!outSnap.empty || !inSnap.empty) {
    throw new functions.https.HttpsError('already-exists', 'A vibe check is already pending between you two');
  }

  const fromSnap = await db.doc(`users/${fromUserId}`).get();
  const fromName = fromSnap.data()?.displayName || 'Someone';

  const ref = db.collection('vibeRequests').doc();
  await ref.set({
    fromUserId,
    toUserId,
    status: 'pending',
    result: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    resolvedAt: null,
  });

  await createNotification(toUserId, {
    type: 'vibeRequest',
    fromUserId,
    refId: ref.id,
    title: '🔮 Vibe Check',
    body: `${fromName} wants to check your vibe compatibility!`,
  });

  return { requestId: ref.id };
});

// ── Callable: respondToVibeRequest ────────────────────────────

exports.respondToVibeRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Login required');
  }
  const myUid = context.auth.uid;
  const { requestId, accept } = data;

  if (!requestId || typeof accept !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'requestId and accept (boolean) are required');
  }

  const reqRef = db.collection('vibeRequests').doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Vibe request not found');
  }

  const req = reqSnap.data();
  if (req.toUserId !== myUid) {
    throw new functions.https.HttpsError('permission-denied', 'Only the recipient can respond');
  }
  if (req.status !== 'pending') {
    throw new functions.https.HttpsError('failed-precondition', 'Request already resolved');
  }

  if (!accept) {
    // Declined: update status only — do NOT notify requester (avoid surfacing rejection)
    await reqRef.update({ status: 'declined', resolvedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { accepted: false };
  }

  // Accepted: read both private vibe texts via admin SDK (bypasses client rules)
  // Raw text never leaves this function — only the computed score is returned/stored
  const [vibe1Snap, vibe2Snap, fromSnap, mySnap] = await Promise.all([
    db.doc(`users/${req.fromUserId}/private/vibe`).get(),
    db.doc(`users/${myUid}/private/vibe`).get(),
    db.doc(`users/${req.fromUserId}`).get(),
    db.doc(`users/${myUid}`).get(),
  ]);

  const score = computeVibeSimilarity(
    vibe1Snap.data()?.content || '',
    vibe2Snap.data()?.content || '',
  );

  const fromName = fromSnap.data()?.displayName || 'Someone';
  const myName = mySnap.data()?.displayName || 'Someone';

  await reqRef.update({
    status: 'accepted',
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    result: { score },
  });

  // Notify both users — score only, never raw vibe text
  await Promise.all([
    createNotification(req.fromUserId, {
      type: 'vibeResult',
      fromUserId: myUid,
      refId: requestId,
      score,
      title: '🔮 Vibe Check Result',
      body: `You and ${myName} are ${score}% vibe compatible!`,
    }),
    createNotification(myUid, {
      type: 'vibeResult',
      fromUserId: req.fromUserId,
      refId: requestId,
      score,
      title: '🔮 Vibe Check Result',
      body: `You and ${fromName} are ${score}% vibe compatible!`,
    }),
  ]);

  return { accepted: true, score };
});

// ── Existing triggers (updated to use array tokens) ────────────

exports.onSignalCreated = functions.firestore
  .document('signals/{signalId}')
  .onCreate(async (snap) => {
    const signal = snap.data();
    const tokens = await getTokens(signal.toUid);
    const title = signal.anonymous
      ? 'Someone signaled you'
      : `${signal.fromDisplayName} signaled you`;
    await Promise.all([
      sendPush(tokens, title, 'Tap to accept or decline', { type: 'signal', signalId: snap.id }),
      db.doc(`users/${signal.toUid}`).update({
        signalsReceivedTotal: admin.firestore.FieldValue.increment(1),
      }).catch(() => {}),
    ]);
  });

exports.onSignalAccepted = functions.firestore
  .document('signals/{signalId}')
  .onUpdate(async (change) => {
    const before = change.before.data();
    const after = change.after.data();
    if (before.status !== 'pending' || after.status !== 'accepted') return;
    const tokens = await getTokens(after.fromUid);
    const body = after.anonymous ? 'Someone accepted your signal' : 'Your signal was accepted';
    await sendPush(tokens, 'Cuelyn — signal accepted!', body, {
      type: 'chat', chatId: after.chatId || '',
    });
  });

exports.onFriendRequest = functions.firestore
  .document('friendRequests/{requestId}')
  .onCreate(async (snap) => {
    const req = snap.data();
    const [tokens, senderSnap] = await Promise.all([
      getTokens(req.toUid),
      db.doc(`users/${req.fromUid}`).get(),
    ]);
    const senderName = senderSnap.data()?.displayName || 'Someone';
    await sendPush(tokens, 'Friend request', `${senderName} wants to be friends`, {
      type: 'friendRequest', requestId: snap.id,
    });
  });

exports.scheduledDeleteOldMessages = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    );
    const snap = await db.collectionGroup('messages').where('createdAt', '<', cutoff).get();
    let batch = db.batch();
    let count = 0;
    const commits = [];
    snap.forEach((d) => {
      batch.delete(d.ref);
      if (++count === 500) { commits.push(batch.commit()); batch = db.batch(); count = 0; }
    });
    if (count > 0) commits.push(batch.commit());
    await Promise.all(commits);
    return null;
  });

exports.scheduledDeleteExpiredGlimpses = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    const now = admin.firestore.Timestamp.now();
    const snap = await db.collection('glimpses').where('expiresAt', '<', now).get();
    let batch = db.batch();
    let count = 0;
    const commits = [];
    snap.forEach((d) => {
      batch.delete(d.ref);
      if (++count === 500) { commits.push(batch.commit()); batch = db.batch(); count = 0; }
    });
    if (count > 0) commits.push(batch.commit());
    await Promise.all(commits);
    return null;
  });

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
    const tokens = await getTokens(receiverUid);
    const senderName = senderSnap.data()?.displayName || 'Friend';
    await sendPush(tokens, senderName, message.text.substring(0, 100), {
      type: 'friendChat', chatId: context.params.chatId,
    });
  });
