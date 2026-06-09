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

/* ─── Signals ────────────────────────────────────────────────── */
export async function sendSignalDoc(fromUid, toUid, anonymous, profile) {
  const ref = await addDoc(collection(db, 'signals'), {
    fromUid, toUid, anonymous, status: 'pending',
    fromDisplayName: anonymous ? null : profile?.displayName || null,
    fromPhotoURL: anonymous ? null : profile?.photoURL || null,
    fromGender: profile?.gender || null,
    fromVibeTag: profile?.vibeTags?.[0] || null,
    senderQuote: profile?.senderQuote || null,
    locationLabel: profile?.locationLabel || null,
    chatId: null,
    createdAt: serverTimestamp(),
  });
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
export async function createFriendRequest(fromUid, toUid, chatId) {
  const ref = doc(collection(db, 'friendRequests'));
  await setDoc(ref, { id: ref.id, fromUid, toUid, chatId, status: 'pending', createdAt: serverTimestamp() });
  return ref.id;
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
  await setDoc(doc(db, 'friends', myUid, 'friendList', fromUid), {
    uid: fromUid,
    displayName: fromProfile?.displayName || 'Unknown',
    photoURL: fromProfile?.photoURL || null,
    gender: fromProfile?.gender || null,
    vibeTags: fromProfile?.vibeTags || [],
    addedAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'friends', fromUid, 'friendList', myUid), {
    uid: myUid,
    displayName: myProfile?.displayName || 'Unknown',
    photoURL: myProfile?.photoURL || null,
    gender: myProfile?.gender || null,
    vibeTags: myProfile?.vibeTags || [],
    addedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'friendRequests', requestId), { status: 'accepted' });
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
  await deleteDoc(doc(db, 'friends', uid, 'friendList', friendUid));
  await deleteDoc(doc(db, 'friends', friendUid, 'friendList', uid));
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

/* ─── Leaderboard ────────────────────────────────────────────── */
export async function getLeaderboardUsers() {
  const snap = await getDocs(
    query(collection(db, 'locations'), where('expiresAt', '>', new Date()))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
