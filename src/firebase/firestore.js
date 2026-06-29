import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  increment,
  getDocs,
  Timestamp,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { app } from './config';

export const db = getFirestore(app);

/* ─── Users ──────────────────────────────────────────────────── */
export async function createUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), {
    username: null, nickname: null, bio: null,
    photoURL: null, coverURL: null,
    signalsReceivedTotal: 0, matchesTotal: 0,
    createdAt: serverTimestamp(),
    ...data,
  }, { merge: true });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

/* ─── Usernames ──────────────────────────────────────────────── */
export async function checkUsernameAvailable(username) {
  const snap = await getDoc(doc(db, 'usernames', username));
  return !snap.exists();
}

export async function setUsername(uid, oldUsername, newUsername) {
  if (oldUsername) await deleteDoc(doc(db, 'usernames', oldUsername));
  await setDoc(doc(db, 'usernames', newUsername), { uid });
  await updateDoc(doc(db, 'users', uid), { username: newUsername });
}

/* ─── Locations ──────────────────────────────────────────────── */
export async function setLocation(uid, data) {
  await setDoc(doc(db, 'locations', uid), data);
}

export async function updateLocation(uid, data) {
  await updateDoc(doc(db, 'locations', uid), data);
}

export async function deleteLocation(uid) {
  await deleteDoc(doc(db, 'locations', uid));
}

export async function getLocation(uid) {
  const snap = await getDoc(doc(db, 'locations', uid));
  return snap.exists() ? snap.data() : null;
}

export function subscribeNearbyUsers(callback) {
  const q = query(collection(db, 'locations'), where('expiresAt', '>', new Date()));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/* ─── Signal cooldowns ───────────────────────────────────────── */
export async function checkSignalCooldown(senderUid, targetUid) {
  const snap = await getDoc(doc(db, 'signalCooldowns', `${senderUid}_${targetUid}`));
  if (!snap.exists()) return { canSend: true };
  const lastSent = snap.data().lastSent.toDate();
  const diffMinutes = (Date.now() - lastSent) / 1000 / 60;
  if (diffMinutes < 60) return { canSend: false, remaining: Math.ceil(60 - diffMinutes) };
  return { canSend: true };
}

export async function setSignalCooldown(senderUid, targetUid) {
  await setDoc(doc(db, 'signalCooldowns', `${senderUid}_${targetUid}`), {
    senderUid, targetUid, lastSent: serverTimestamp(),
  });
}

/* ─── Global signal cooldown (1 per hour total) ─────────────── */
export async function checkGlobalSignalCooldown(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return { canSend: true };
  const last = snap.data().lastSignalSentAt;
  if (!last) return { canSend: true };
  const lastMs = last.toDate ? last.toDate().getTime() : last.seconds * 1000;
  const diff = (Date.now() - lastMs) / 1000 / 60;
  if (diff < 60) return { canSend: false, remaining: Math.ceil(60 - diff) };
  return { canSend: true };
}

export async function setGlobalSignalCooldown(uid) {
  await setDoc(doc(db, 'users', uid), { lastSignalSentAt: serverTimestamp() }, { merge: true });
}

/* ─── Signals ────────────────────────────────────────────────── */
export async function sendSignalDoc(fromUid, toUid, anonymous, profile) {
  const ref = await addDoc(collection(db, 'signals'), {
    fromUid, toUid, anonymous, status: 'pending',
    fromDisplayName: anonymous ? null : profile?.displayName || null,
    fromPhotoURL: anonymous ? null : profile?.photoURL || null,
    fromGender: profile?.gender || null,
    fromVibeTag: profile?.vibeTags?.[0] || null,
    toDisplayName: profile?.toDisplayName || null,
    senderQuote: profile?.senderQuote || null,
    locationLabel: profile?.locationLabel || null,
    chatId: null,
    createdAt: serverTimestamp(),
  });
  // Increment receiver's total without blocking the send
  updateDoc(doc(db, 'users', toUid), { signalsReceivedTotal: increment(1) }).catch(() => {});
  return ref.id;
}

export function subscribeReceivedSignals(uid, callback) {
  const q = query(
    collection(db, 'signals'),
    where('toUid', '==', uid),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeSentSignals(uid, callback) {
  const q = query(collection(db, 'signals'), where('fromUid', '==', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function acceptSignal(signalId, uid, fromUid) {
  const signalSnap = await getDoc(doc(db, 'signals', signalId));
  const signalData = signalSnap.data();

  const chatRef = doc(collection(db, 'chats'));
  const chatId = chatRef.id;

  await setDoc(chatRef, {
    id: chatId,
    participants: [uid, fromUid],
    signalId,
    anonymous: signalData?.anonymous || false,
    status: 'active',
    timerSeconds: 300,
    timerRunning: true,
    timerStartedAt: serverTimestamp(),
    pauseRequestedBy: null,
    pauseAcceptedBy: null,
    isPaused: false,
    pausedAt: null,
    createdAt: serverTimestamp(),
    endedAt: null,
  });

  await updateDoc(doc(db, 'signals', signalId), { status: 'accepted', chatId });
  return chatId;
}

export async function declineSignal(signalId) {
  await updateDoc(doc(db, 'signals', signalId), { status: 'declined' });
}

export async function ignoreSignal(signalId) {
  await deleteDoc(doc(db, 'signals', signalId));
}

/* ─── Matches (legacy) ───────────────────────────────────────── */
export function subscribeMatches(uid, callback) {
  const q1 = query(collection(db, 'matches'), where('user1', '==', uid));
  const q2 = query(collection(db, 'matches'), where('user2', '==', uid));
  let r1 = [], r2 = [];
  const merge = () => {
    const all = [...r1, ...r2];
    all.sort((a, b) => (b.matchedAt?.seconds || 0) - (a.matchedAt?.seconds || 0));
    callback(all);
  };
  const u1 = onSnapshot(q1, (s) => { r1 = s.docs.map((d) => ({ id: d.id, ...d.data() })); merge(); });
  const u2 = onSnapshot(q2, (s) => { r2 = s.docs.map((d) => ({ id: d.id, ...d.data() })); merge(); });
  return () => { u1(); u2(); };
}

/* ─── Chats ──────────────────────────────────────────────────── */
export function subscribeChat(chatId, callback) {
  return onSnapshot(doc(db, 'chats', chatId), (snap) => {
    if (snap.exists()) callback({ id: snap.id, ...snap.data() });
  });
}

export function subscribeMessages(chatId, callback) {
  const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendMessage(chatId, senderUid, text) {
  const msgRef = doc(collection(db, 'chats', chatId, 'messages'));
  await setDoc(msgRef, { id: msgRef.id, senderUid, text: text.trim(), createdAt: serverTimestamp() });
}

export async function requestPause(chatId, uid) {
  await updateDoc(doc(db, 'chats', chatId), { pauseRequestedBy: uid });
}

export async function acceptPause(chatId, uid) {
  await updateDoc(doc(db, 'chats', chatId), {
    isPaused: true, pauseAcceptedBy: uid,
    pausedAt: serverTimestamp(), pauseRequestedBy: null,
  });
}

export async function declinePause(chatId) {
  await updateDoc(doc(db, 'chats', chatId), { pauseRequestedBy: null });
}

export async function resumeChat(chatId, timerStartedAt, pausedAt) {
  const elapsed = pausedAt.toMillis() - timerStartedAt.toMillis();
  const newStart = Timestamp.fromDate(new Date(Date.now() - elapsed));
  await updateDoc(doc(db, 'chats', chatId), {
    isPaused: false, timerStartedAt: newStart,
    pausedAt: null, pauseAcceptedBy: null,
  });
}

export async function endChat(chatId) {
  await updateDoc(doc(db, 'chats', chatId), {
    status: 'ended', endedAt: serverTimestamp(),
  });
}

/* ─── Friend requests ────────────────────────────────────────── */
export async function createFriendRequest(fromUid, toUid, chatId = null) {
  const ref = doc(collection(db, 'friendRequests'));
  await setDoc(ref, { id: ref.id, fromUid, toUid, chatId, status: 'pending', createdAt: serverTimestamp() });
  return ref.id;
}

export async function cancelFriendRequest(requestId) {
  await deleteDoc(doc(db, 'friendRequests', requestId));
}

export function subscribeConnectionStatus(myUid, targetUid, callback) {
  let isFriend = false;
  let outgoing = null;
  let incoming = null;
  const emit = () => callback({ isFriend, outgoing, incoming });

  const unsubFriend = onSnapshot(
    doc(db, 'friends', myUid, 'friendList', targetUid),
    (snap) => { isFriend = snap.exists(); emit(); }
  );

  const qOut = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', myUid),
    where('toUid', '==', targetUid),
    where('status', '==', 'pending')
  );
  const unsubOut = onSnapshot(qOut, (snap) => {
    outgoing = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    emit();
  });

  const qIn = query(
    collection(db, 'friendRequests'),
    where('fromUid', '==', targetUid),
    where('toUid', '==', myUid),
    where('status', '==', 'pending')
  );
  const unsubIn = onSnapshot(qIn, (snap) => {
    incoming = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    emit();
  });

  return () => { unsubFriend(); unsubOut(); unsubIn(); };
}

export function subscribeFriendRequests(uid, callback) {
  const q = query(
    collection(db, 'friendRequests'),
    where('toUid', '==', uid),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeFriendRequestsByChatId(chatId, callback) {
  const q = query(collection(db, 'friendRequests'), where('chatId', '==', chatId));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function acceptFriendRequest(requestId, myUid, myProfile, fromUid) {
  const fromProfile = await getUserProfile(fromUid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'friends', myUid, 'friendList', fromUid), {
    uid: fromUid,
    displayName: fromProfile?.displayName || 'Unknown',
    photoURL: fromProfile?.photoURL || null,
    gender: fromProfile?.gender || null,
    vibeTags: fromProfile?.vibeTags || [],
    addedAt: serverTimestamp(),
  });
  batch.set(doc(db, 'friends', fromUid, 'friendList', myUid), {
    uid: myUid,
    displayName: myProfile?.displayName || 'Unknown',
    photoURL: myProfile?.photoURL || null,
    gender: myProfile?.gender || null,
    vibeTags: myProfile?.vibeTags || [],
    addedAt: serverTimestamp(),
  });
  batch.update(doc(db, 'friendRequests', requestId), { status: 'accepted', respondedAt: serverTimestamp() });
  batch.update(doc(db, 'users', myUid), { friendsCount: increment(1) });
  batch.update(doc(db, 'users', fromUid), { friendsCount: increment(1) });
  await batch.commit();
}

export async function declineFriendRequest(requestId) {
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'declined' });
}

/* ─── Friends ────────────────────────────────────────────────── */
export function subscribeFriends(uid, callback) {
  return onSnapshot(collection(db, 'friends', uid, 'friendList'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function checkIsFriend(myUid, targetUid) {
  const snap = await getDoc(doc(db, 'friends', myUid, 'friendList', targetUid));
  return snap.exists();
}

export async function removeFriend(uid, friendUid) {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'friends', uid, 'friendList', friendUid));
  batch.delete(doc(db, 'friends', friendUid, 'friendList', uid));
  batch.update(doc(db, 'users', uid), { friendsCount: increment(-1) });
  batch.update(doc(db, 'users', friendUid), { friendsCount: increment(-1) });
  await batch.commit();
}

/* ─── Friend chats ───────────────────────────────────────────── */
export function getFriendChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export async function ensureFriendChat(uid1, uid2) {
  const chatId = getFriendChatId(uid1, uid2);
  const snap = await getDoc(doc(db, 'friendChats', chatId));
  if (!snap.exists()) {
    await setDoc(doc(db, 'friendChats', chatId), {
      id: chatId, participants: [uid1, uid2], createdAt: serverTimestamp(),
    });
  }
  return chatId;
}

export function subscribeFriendMessages(chatId, callback) {
  const q = query(collection(db, 'friendChats', chatId, 'messages'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function sendFriendMessage(chatId, senderUid, text) {
  const ref = doc(collection(db, 'friendChats', chatId, 'messages'));
  await setDoc(ref, { id: ref.id, senderUid, text: text.trim(), createdAt: serverTimestamp() });
}

/* ─── Daily signals (legacy) ─────────────────────────────────── */
export async function getDailySignalCount(uid) {
  const today = new Date().toISOString().split('T')[0];
  const snap = await getDoc(doc(db, 'dailySignals', `${uid}_${today}`));
  return snap.exists() ? snap.data().count : 0;
}

export async function incrementDailySignal(uid) {
  const today = new Date().toISOString().split('T')[0];
  const ref = doc(db, 'dailySignals', `${uid}_${today}`);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { count: increment(1) });
  } else {
    await setDoc(ref, { count: 1, date: today });
  }
}

export async function getTotalSignalsReceived(uid) {
  const snap = await getDocs(query(collection(db, 'signals'), where('toUid', '==', uid)));
  return snap.size;
}

export async function getTotalMatches(uid) {
  const [s1, s2] = await Promise.all([
    getDocs(query(collection(db, 'matches'), where('user1', '==', uid))),
    getDocs(query(collection(db, 'matches'), where('user2', '==', uid))),
  ]);
  return s1.size + s2.size;
}

/* ─── Posts ──────────────────────────────────────────────────── */
export function subscribeFeed(callback) {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

const PAGE_SIZE = 10;

export async function getPaginatedPosts(lastDoc = null) {
  let q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
  if (lastDoc) q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(PAGE_SIZE));
  const snap = await getDocs(q);
  return {
    posts: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length === PAGE_SIZE,
  };
}

export function subscribeUserPosts(uid, callback) {
  const q = query(collection(db, 'posts'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function createPost(data) {
  return addDoc(collection(db, 'posts'), {
    ...data, likes: 0, commentsCount: 0, createdAt: serverTimestamp(),
  });
}

export async function deletePost(postId) {
  return deleteDoc(doc(db, 'posts', postId));
}

export async function toggleLike(postId, uid, isLiked) {
  const likeRef = doc(db, 'posts', postId, 'likes', uid);
  const postRef = doc(db, 'posts', postId);
  if (isLiked) {
    await deleteDoc(likeRef);
    await updateDoc(postRef, { likes: increment(-1) });
  } else {
    await setDoc(likeRef, { uid, likedAt: serverTimestamp() });
    await updateDoc(postRef, { likes: increment(1) });
  }
}

export async function checkLiked(postId, uid) {
  const snap = await getDoc(doc(db, 'posts', postId, 'likes', uid));
  return snap.exists();
}

/* ─── Block / Report ─────────────────────────────────────────── */
export async function blockUser(myUid, targetUid) {
  await setDoc(doc(db, 'blocks', myUid, 'blockedUsers', targetUid), {
    blockedUid: targetUid, blockedAt: serverTimestamp(),
  });
}

export async function unblockUser(myUid, targetUid) {
  await deleteDoc(doc(db, 'blocks', myUid, 'blockedUsers', targetUid));
}

export function subscribeBlockedUsers(uid, callback) {
  return onSnapshot(collection(db, 'blocks', uid, 'blockedUsers'), (snap) => {
    callback(new Set(snap.docs.map((d) => d.id)));
  });
}

export async function getBlockedSet(uid) {
  const snap = await getDocs(collection(db, 'blocks', uid, 'blockedUsers'));
  return new Set(snap.docs.map((d) => d.id));
}

export async function reportUser(reporterUid, reportedUid, reason, details) {
  await addDoc(collection(db, 'reports'), {
    reporterUid, reportedUid, reason,
    details: details || null,
    createdAt: serverTimestamp(),
    status: 'pending',
  });
}

export async function submitProblemReport(uid, description) {
  await addDoc(collection(db, 'reports'), {
    type: 'problem_report',
    reporterUid: uid,
    reportedUid: null,
    description: description.trim(),
    createdAt: serverTimestamp(),
    status: 'pending',
  });
}

/* ─── Signal history queries ─────────────────────────────────── */
export async function getReceivedSignals(uid) {
  const snap = await getDocs(
    query(collection(db, 'signals'), where('toUid', '==', uid), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getSentSignals(uid) {
  const snap = await getDocs(
    query(collection(db, 'signals'), where('fromUid', '==', uid), orderBy('createdAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/* ─── Blocked users with profiles ───────────────────────────── */
export async function getBlockedUsersWithProfiles(uid) {
  const snap = await getDocs(collection(db, 'blocks', uid, 'blockedUsers'));
  const items = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
  const profiles = await Promise.all(
    items.map(async (item) => {
      try {
        const p = await getUserProfile(item.uid);
        return { uid: item.uid, displayName: p?.displayName || 'Unknown', photoURL: p?.photoURL || null, gender: p?.gender || null };
      } catch {
        return { uid: item.uid, displayName: 'Unknown', photoURL: null, gender: null };
      }
    })
  );
  return profiles;
}

/* ─── Delete all user's friend list entries ──────────────────── */
export async function deleteFriendList(uid) {
  const snap = await getDocs(collection(db, 'friends', uid, 'friendList'));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}

/* ─── Real-time feed ─────────────────────────────────────────── */
export function subscribeLatestPosts(callback, count = 40) {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(count));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

/* ─── Follow system ──────────────────────────────────────────── */
export async function followUser(myUid, targetUid) {
  await setDoc(doc(db, 'follows', `${myUid}_${targetUid}`), {
    followerId: myUid, followingId: targetUid, createdAt: serverTimestamp(),
  });
}

export async function unfollowUser(myUid, targetUid) {
  await deleteDoc(doc(db, 'follows', `${myUid}_${targetUid}`));
}

export function subscribeMyFollowing(uid, callback) {
  const q = query(collection(db, 'follows'), where('followerId', '==', uid));
  return onSnapshot(q, (snap) => {
    callback(new Set(snap.docs.map((d) => d.data().followingId)));
  });
}

export function subscribeMyFollowers(uid, callback) {
  const q = query(collection(db, 'follows'), where('followingId', '==', uid));
  return onSnapshot(q, (snap) => {
    callback(new Set(snap.docs.map((d) => d.data().followerId)));
  });
}

export function subscribeUserFollowersList(uid, callback) {
  const q = query(collection(db, 'follows'), where('followingId', '==', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data().followerId));
  });
}

export function subscribeUserFollowingList(uid, callback) {
  const q = query(collection(db, 'follows'), where('followerId', '==', uid));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data().followingId));
  });
}

/* ─── Comments ───────────────────────────────────────────────── */
export async function addComment(postId, uid, displayName, photoURL, gender, text) {
  const ref = doc(collection(db, 'posts', postId, 'comments'));
  await setDoc(ref, {
    id: ref.id, uid, displayName,
    photoURL: photoURL || null, gender: gender || null,
    text: text.trim(), createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) });
  return ref.id;
}

export function subscribeComments(postId, callback) {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function deleteComment(postId, commentId, uid) {
  const ref = doc(db, 'posts', postId, 'comments', commentId);
  const snap = await getDoc(ref);
  if (!snap.exists() || snap.data().uid !== uid) return;
  await deleteDoc(ref);
  await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-1) });
}

export async function getLatestPost(uid) {
  const snap = await getDocs(
    query(collection(db, 'posts'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(1))
  );
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export function subscribeLocation(uid, callback) {
  return onSnapshot(doc(db, 'locations', uid), (snap) => {
    callback(snap.exists() ? snap.data() : null);
  });
}

/* ─── Glimpses ───────────────────────────────────────────────── */
const GLIMPSE_TTL_MS = 24 * 60 * 60 * 1000;

export async function createGlimpse(userId, mediaUrl, mediaType) {
  const expiresAt = Timestamp.fromDate(new Date(Date.now() + GLIMPSE_TTL_MS));
  const ref = doc(collection(db, 'glimpses'));
  await setDoc(ref, {
    id: ref.id, userId, mediaUrl, mediaType,
    createdAt: serverTimestamp(), expiresAt, viewedBy: [],
  });
  return ref.id;
}

export function subscribeMyGlimpses(userId, callback) {
  const now = Timestamp.now();
  const q = query(
    collection(db, 'glimpses'),
    where('userId', '==', userId),
    where('expiresAt', '>', now)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeActiveGlimpses(friendUids, callback) {
  if (!friendUids || friendUids.length === 0) {
    callback([]);
    return () => {};
  }
  const now = Timestamp.now();
  const chunks = [];
  for (let i = 0; i < friendUids.length; i += 30) chunks.push(friendUids.slice(i, i + 30));
  const results = new Array(chunks.length).fill([]);
  const unsubs = chunks.map((chunk, idx) => {
    const q = query(
      collection(db, 'glimpses'),
      where('userId', 'in', chunk),
      where('expiresAt', '>', now)
    );
    return onSnapshot(q, (snap) => {
      results[idx] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback([...results.flat()]);
    });
  });
  return () => unsubs.forEach((u) => u());
}

export async function markGlimpseViewed(glimpseId, viewerUid) {
  await updateDoc(doc(db, 'glimpses', glimpseId), { viewedBy: arrayUnion(viewerUid) });
}

export async function deleteGlimpse(glimpseId) {
  await deleteDoc(doc(db, 'glimpses', glimpseId));
}

/* ─── Vibe ───────────────────────────────────────────────────── */

export async function saveMyVibe(uid, content) {
  // TODO: moderation hook — insert content check here before saving
  await setDoc(doc(db, 'users', uid, 'private', 'vibe'), {
    content: content.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function getMyVibe(uid) {
  const snap = await getDoc(doc(db, 'users', uid, 'private', 'vibe'));
  return snap.exists() ? snap.data() : null;
}

// Real-time vibe request status between two users.
// Callback receives: { phase: 'none'|'pending-out'|'pending-in'|'result', score, requestId }
export function subscribeVibeStatus(myUid, targetUid, callback) {
  let out = null;
  let inc = null;

  const emit = () => {
    const accepted = [out, inc].find((r) => r?.status === 'accepted');
    if (accepted) {
      callback({ phase: 'result', score: accepted.result?.score ?? null, requestId: accepted.id });
      return;
    }
    if (out?.status === 'pending') { callback({ phase: 'pending-out', requestId: out.id }); return; }
    if (inc?.status === 'pending') { callback({ phase: 'pending-in', requestId: inc.id }); return; }
    callback({ phase: 'none' });
  };

  const qOut = query(collection(db, 'vibeRequests'), where('fromUserId', '==', myUid), where('toUserId', '==', targetUid));
  const unOut = onSnapshot(qOut, (snap) => {
    out = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    emit();
  });

  const qIn = query(collection(db, 'vibeRequests'), where('fromUserId', '==', targetUid), where('toUserId', '==', myUid));
  const unIn = onSnapshot(qIn, (snap) => {
    inc = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    emit();
  });

  return () => { unOut(); unIn(); };
}

/* ─── Notifications ──────────────────────────────────────────── */

export function subscribeNotifications(uid, callback) {
  const q = query(
    collection(db, 'notifications', uid, 'items'),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function markNotificationRead(uid, notifId) {
  await updateDoc(doc(db, 'notifications', uid, 'items', notifId), { read: true });
}

export async function markAllNotificationsRead(uid) {
  const q = query(collection(db, 'notifications', uid, 'items'), where('read', '==', false));
  const snap = await getDocs(q);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

/* ─── User search ─────────────────────────────────────────────── */
export async function searchUsers(term) {
  if (!term || term.trim().length < 2) return [];
  const t = term.trim();
  const tLower = t.toLowerCase();

  const [nameSnap, usernameSnap] = await Promise.all([
    getDocs(query(
      collection(db, 'users'),
      where('displayName', '>=', t),
      where('displayName', '<=', t + ''),
      limit(10)
    )),
    getDocs(query(
      collection(db, 'users'),
      where('username', '>=', tLower),
      where('username', '<=', tLower + ''),
      limit(10)
    )),
  ]);

  const seen = new Set();
  const results = [];
  [...nameSnap.docs, ...usernameSnap.docs].forEach((d) => {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      results.push({ id: d.id, ...d.data() });
    }
  });
  return results.slice(0, 10);
}
