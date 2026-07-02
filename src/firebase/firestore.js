import { supabase } from './config';

export { supabase as db };

// ── Transform helpers ──────────────────────────────────────────
const profileFromDb = (r) => !r ? null : ({
  id: r.id, uid: r.id,
  displayName: r.display_name,
  email: r.email,
  bio: r.bio,
  photoURL: r.photo_url,
  coverURL: r.cover_url,
  gender: r.gender,
  username: r.username,
  vibeTags: r.vibe_tags || [],
  friendsCount: r.friends_count || 0,
  followersCount: r.followers_count || 0,
  followingCount: r.following_count || 0,
  signalsReceivedTotal: r.signals_received_total || 0,
  isPrivate: r.is_private || false,
  showOnLeaderboard: r.show_on_leaderboard !== false,
  onboardingComplete: r.onboarding_complete || false,
  notificationPrefs: r.notification_prefs || {},
  fcmTokens: r.fcm_tokens || [],
  lastSignalSentAt: r.last_signal_sent_at,
  createdAt: r.created_at,
});

const signalFromDb = (r) => !r ? null : ({
  id: r.id,
  fromUid: r.from_uid,
  toUid: r.to_uid,
  anonymous: r.anonymous,
  status: r.status,
  fromDisplayName: r.from_display_name,
  fromPhotoURL: r.from_photo_url,
  fromGender: r.from_gender,
  fromVibeTag: r.from_vibe_tag,
  toDisplayName: r.to_display_name,
  senderQuote: r.sender_quote,
  locationLabel: r.location_label,
  chatId: r.chat_id,
  createdAt: r.created_at,
});

const chatFromDb = (r) => !r ? null : ({
  id: r.id,
  participants: r.participants,
  signalId: r.signal_id,
  anonymous: r.anonymous,
  status: r.status,
  timerSeconds: r.timer_seconds,
  timerRunning: r.timer_running,
  timerStartedAt: r.timer_started_at,
  pauseRequestedBy: r.pause_requested_by,
  pauseAcceptedBy: r.pause_accepted_by,
  isPaused: r.is_paused,
  pausedAt: r.paused_at,
  createdAt: r.created_at,
  endedAt: r.ended_at,
});

const msgFromDb = (r) => !r ? null : ({
  id: r.id, senderUid: r.sender_uid, text: r.text, createdAt: r.created_at,
  chatId: r.chat_id,
});

const friendReqFromDb = (r) => !r ? null : ({
  id: r.id, fromUid: r.from_uid, toUid: r.to_uid,
  chatId: r.chat_id, status: r.status,
  createdAt: r.created_at, respondedAt: r.responded_at,
});

const friendFromDb = (r) => !r ? null : ({
  id: r.friend_uid, uid: r.friend_uid,
  displayName: r.display_name,
  photoURL: r.photo_url,
  gender: r.gender,
  vibeTags: r.vibe_tags || [],
  addedAt: r.added_at,
});

const notifFromDb = (r) => !r ? null : ({
  id: r.id,
  type: r.type,
  fromUserId: r.from_user_id,
  refId: r.ref_id,
  title: r.title,
  body: r.body,
  score: r.score,
  read: r.read,
  createdAt: r.created_at,
});

const locationFromDb = (r) => !r ? null : ({
  id: r.user_id,
  uid: r.user_id,
  lat: r.lat, lng: r.lng,
  fuzzyLat: r.fuzzy_lat, fuzzyLng: r.fuzzy_lng,
  expiresAt: r.expires_at,
});

// ── Realtime helper ────────────────────────────────────────────
// Each call gets a unique channel name — Supabase returns the existing channel
// if the name is reused, and calling .on() on an already-subscribed channel throws.
function makeSub(channelName, tableName, filter, fetchFn, callback) {
  const uniqueName = `${channelName}-${Math.random().toString(36).slice(2, 9)}`;
  fetchFn().then(callback);
  const opts = { event: '*', schema: 'public', table: tableName };
  if (filter) opts.filter = filter;
  const ch = supabase
    .channel(uniqueName)
    .on('postgres_changes', opts, () => fetchFn().then(callback))
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ── Users ──────────────────────────────────────────────────────
export async function createUserProfile(uid, data) {
  const row = {
    id: uid,
    display_name: data.displayName || null,
    email: data.email || null,
    gender: data.gender || null,
    vibe_tags: data.vibeTags || [],
    signals_received_total: 0,
    friends_count: 0,
    onboarding_complete: false,
  };
  const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  if (error) throw error;
}

export async function getUserProfile(uid) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw error;
  return profileFromDb(data);
}

export async function updateUserProfile(uid, data) {
  const row = {};
  if (data.displayName !== undefined) row.display_name = data.displayName;
  if (data.photoURL !== undefined)    row.photo_url = data.photoURL;
  if (data.coverURL !== undefined)    row.cover_url = data.coverURL;
  if (data.bio !== undefined)         row.bio = data.bio;
  if (data.gender !== undefined)      row.gender = data.gender;
  if (data.username !== undefined)    row.username = data.username;
  if (data.vibeTags !== undefined)    row.vibe_tags = data.vibeTags;
  if (data.isPrivate !== undefined)   row.is_private = data.isPrivate;
  if (data.showOnLeaderboard !== undefined) row.show_on_leaderboard = data.showOnLeaderboard;
  if (data.onboardingComplete !== undefined) row.onboarding_complete = data.onboardingComplete;
  if (data.notificationPrefs !== undefined) row.notification_prefs = data.notificationPrefs;
  if (data.lastSignalSentAt !== undefined)  row.last_signal_sent_at = data.lastSignalSentAt;
  if (data.fcmTokens !== undefined)   row.fcm_tokens = data.fcmTokens;
  if (data.signalsReceivedTotal !== undefined) row.signals_received_total = data.signalsReceivedTotal;
  if (Object.keys(row).length === 0) return;
  const { error } = await supabase.from('profiles').update(row).eq('id', uid);
  if (error) throw error;
}

// ── Usernames ──────────────────────────────────────────────────
export async function checkUsernameAvailable(username) {
  const { data } = await supabase.from('usernames').select('username').eq('username', username).maybeSingle();
  return !data;
}

export async function setUsername(uid, oldUsername, newUsername) {
  if (oldUsername) await supabase.from('usernames').delete().eq('username', oldUsername);
  await supabase.from('usernames').upsert({ username: newUsername, user_id: uid });
  await supabase.from('profiles').update({ username: newUsername }).eq('id', uid);
}

// ── Locations ──────────────────────────────────────────────────
export async function setLocation(uid, data) {
  const row = {
    user_id: uid,
    lat: data.lat, lng: data.lng,
    fuzzy_lat: data.fuzzyLat ?? null,
    fuzzy_lng: data.fuzzyLng ?? null,
    expires_at: data.expiresAt instanceof Date ? data.expiresAt.toISOString() : data.expiresAt,
  };
  await supabase.from('locations').upsert(row, { onConflict: 'user_id' });
}

export async function updateLocation(uid, data) {
  await setLocation(uid, data);
}

export async function deleteLocation(uid) {
  await supabase.from('locations').delete().eq('user_id', uid);
}

export async function getLocation(uid) {
  const { data } = await supabase.from('locations').select('*').eq('user_id', uid).maybeSingle();
  return locationFromDb(data);
}

export function subscribeNearbyUsers(callback) {
  const fetch = async () => {
    const { data: locs } = await supabase
      .from('locations').select('*')
      .gt('expires_at', new Date().toISOString());
    if (!locs?.length) return [];
    const uids = locs.map((l) => l.user_id);
    const { data: profs } = await supabase
      .from('profiles').select('id, display_name, photo_url, gender, vibe_tags, username')
      .in('id', uids);
    const profMap = Object.fromEntries((profs || []).map((p) => [p.id, p]));
    return locs.map((r) => {
      const p = profMap[r.user_id] || {};
      return {
        id: r.user_id, uid: r.user_id,
        lat: r.lat, lng: r.lng,
        expiresAt: r.expires_at,
        displayName: p.display_name || null,
        photoURL: p.photo_url || null,
        gender: p.gender || null,
        vibeTags: p.vibe_tags || [],
        username: p.username || null,
      };
    });
  };
  return makeSub('nearby-users', 'locations', null, fetch, callback);
}

export function subscribeLocation(uid, callback) {
  return makeSub(
    `location-${uid}`, 'locations', `user_id=eq.${uid}`,
    async () => {
      const { data } = await supabase.from('locations').select('*').eq('user_id', uid).maybeSingle();
      return locationFromDb(data);
    },
    callback
  );
}

// ── Signal cooldowns ───────────────────────────────────────────
export async function checkSignalCooldown(senderUid, targetUid) {
  const { data } = await supabase
    .from('signal_cooldowns').select('last_sent')
    .eq('id', `${senderUid}_${targetUid}`).maybeSingle();
  if (!data) return { canSend: true };
  const diff = (Date.now() - new Date(data.last_sent).getTime()) / 1000 / 60;
  if (diff < 60) return { canSend: false, remaining: Math.ceil(60 - diff) };
  return { canSend: true };
}

export async function setSignalCooldown(senderUid, targetUid) {
  await supabase.from('signal_cooldowns').upsert({
    id: `${senderUid}_${targetUid}`,
    sender_uid: senderUid, target_uid: targetUid,
    last_sent: new Date().toISOString(),
  });
}

export async function checkGlobalSignalCooldown(uid) {
  const { data } = await supabase.from('profiles').select('last_signal_sent_at').eq('id', uid).maybeSingle();
  if (!data?.last_signal_sent_at) return { canSend: true };
  const diff = (Date.now() - new Date(data.last_signal_sent_at).getTime()) / 1000 / 60;
  if (diff < 60) return { canSend: false, remaining: Math.ceil(60 - diff) };
  return { canSend: true };
}

export async function setGlobalSignalCooldown(uid) {
  await supabase.from('profiles').update({ last_signal_sent_at: new Date().toISOString() }).eq('id', uid);
}

// ── Signals ────────────────────────────────────────────────────
export async function sendSignalDoc(fromUid, toUid, anonymous, profile) {
  const { data, error } = await supabase.from('signals').insert({
    from_uid: fromUid, to_uid: toUid, anonymous, status: 'pending',
    from_display_name: anonymous ? null : profile?.displayName || null,
    from_photo_url: anonymous ? null : profile?.photoURL || null,
    from_gender: profile?.gender || null,
    from_vibe_tag: profile?.vibeTags?.[0] || null,
    to_display_name: profile?.toDisplayName || null,
    sender_quote: profile?.senderQuote || null,
    location_label: profile?.locationLabel || null,
  }).select('id').single();
  if (error) throw error;
  // Increment receiver's total without blocking
  supabase.from('profiles')
    .update({ signals_received_total: profile?.signalsReceivedTotal != null ? profile.signalsReceivedTotal + 1 : 1 })
    .eq('id', toUid).then(() => {});
  return data.id;
}

export function subscribeReceivedSignals(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('signals').select('*')
      .eq('to_uid', uid).eq('status', 'pending').order('created_at', { ascending: false });
    return (data || []).map(signalFromDb);
  };
  return makeSub(`signals-recv-${uid}`, 'signals', `to_uid=eq.${uid}`, fetch, callback);
}

export function subscribeSentSignals(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('signals').select('*').eq('from_uid', uid);
    return (data || []).map(signalFromDb);
  };
  return makeSub(`signals-sent-${uid}`, 'signals', `from_uid=eq.${uid}`, fetch, callback);
}

export async function acceptSignal(signalId, uid, fromUid) {
  const { data: sig } = await supabase.from('signals').select('anonymous').eq('id', signalId).single();
  const chatId = crypto.randomUUID();
  await supabase.from('chats').insert({
    id: chatId,
    participants: [uid, fromUid],
    signal_id: signalId,
    anonymous: sig?.anonymous || false,
    status: 'active',
    timer_seconds: 300,
    timer_running: true,
    timer_started_at: new Date().toISOString(),
    is_paused: false,
  });
  await supabase.from('signals').update({ status: 'accepted', chat_id: chatId }).eq('id', signalId);
  return chatId;
}

export async function declineSignal(signalId) {
  await supabase.from('signals').update({ status: 'declined' }).eq('id', signalId);
}

export async function ignoreSignal(signalId) {
  await supabase.from('signals').delete().eq('id', signalId);
}

export async function getReceivedSignals(uid) {
  const { data } = await supabase.from('signals').select('*')
    .eq('to_uid', uid).order('created_at', { ascending: false });
  return (data || []).map(signalFromDb);
}

export async function getSentSignals(uid) {
  const { data } = await supabase.from('signals').select('*')
    .eq('from_uid', uid).order('created_at', { ascending: false });
  return (data || []).map(signalFromDb);
}

// ── Chats ──────────────────────────────────────────────────────
export function subscribeChat(chatId, callback) {
  return makeSub(
    `chat-${chatId}`, 'chats', `id=eq.${chatId}`,
    async () => {
      const { data } = await supabase.from('chats').select('*').eq('id', chatId).maybeSingle();
      return chatFromDb(data);
    },
    callback
  );
}

export function subscribeMessages(chatId, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('chat_messages').select('*')
      .eq('chat_id', chatId).order('created_at', { ascending: true });
    return (data || []).map(msgFromDb);
  };
  return makeSub(`chat-msgs-${chatId}`, 'chat_messages', `chat_id=eq.${chatId}`, fetch, callback);
}

export async function sendMessage(chatId, senderUid, text) {
  await supabase.from('chat_messages').insert({ chat_id: chatId, sender_uid: senderUid, text: text.trim() });
}

export async function requestPause(chatId, uid) {
  await supabase.from('chats').update({ pause_requested_by: uid }).eq('id', chatId);
}

export async function acceptPause(chatId, uid) {
  await supabase.from('chats').update({
    is_paused: true, pause_accepted_by: uid,
    paused_at: new Date().toISOString(), pause_requested_by: null,
  }).eq('id', chatId);
}

export async function declinePause(chatId) {
  await supabase.from('chats').update({ pause_requested_by: null }).eq('id', chatId);
}

export async function resumeChat(chatId, timerStartedAt, pausedAt) {
  const elapsed = new Date(pausedAt).getTime() - new Date(timerStartedAt).getTime();
  const newStart = new Date(Date.now() - elapsed).toISOString();
  await supabase.from('chats').update({
    is_paused: false, timer_started_at: newStart,
    paused_at: null, pause_accepted_by: null,
  }).eq('id', chatId);
}

export async function endChat(chatId) {
  await supabase.from('chats').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', chatId);
}

// ── Friend requests ────────────────────────────────────────────
export async function createFriendRequest(fromUid, toUid, chatId = null) {
  const { data, error } = await supabase.from('friend_requests')
    .insert({ from_uid: fromUid, to_uid: toUid, chat_id: chatId, status: 'pending' })
    .select('id').single();
  if (error) throw error;
  return data.id;
}

export async function cancelFriendRequest(requestId) {
  await supabase.from('friend_requests').delete().eq('id', requestId);
}

export function subscribeConnectionStatus(myUid, targetUid, callback) {
  let isFriend = false, outgoing = null, incoming = null;
  const emit = () => callback({ isFriend, outgoing, incoming });

  const fetchAll = async () => {
    const [{ data: fr }, { data: out }, { data: inc }] = await Promise.all([
      supabase.from('friends').select('friend_uid').eq('user_id', myUid).eq('friend_uid', targetUid).maybeSingle(),
      supabase.from('friend_requests').select('*').eq('from_uid', myUid).eq('to_uid', targetUid).eq('status', 'pending').maybeSingle(),
      supabase.from('friend_requests').select('*').eq('from_uid', targetUid).eq('to_uid', myUid).eq('status', 'pending').maybeSingle(),
    ]);
    isFriend = !!fr;
    outgoing = out ? friendReqFromDb(out) : null;
    incoming = inc ? friendReqFromDb(inc) : null;
    emit();
  };

  fetchAll();
  const ch = supabase.channel(`conn-${myUid}-${targetUid}-${Math.random().toString(36).slice(2, 9)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, fetchAll)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, fetchAll)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

export function subscribeFriendRequests(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('friend_requests').select('*')
      .eq('to_uid', uid).eq('status', 'pending');
    return (data || []).map(friendReqFromDb);
  };
  return makeSub(`freq-${uid}`, 'friend_requests', `to_uid=eq.${uid}`, fetch, callback);
}

export function subscribeFriendRequestsByChatId(chatId, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('friend_requests').select('*').eq('chat_id', chatId);
    return (data || []).map(friendReqFromDb);
  };
  return makeSub(`freq-chat-${chatId}`, 'friend_requests', null, fetch, callback);
}

export async function acceptFriendRequest(requestId, myUid, myProfile, fromUid) {
  const fromProfile = await getUserProfile(fromUid);
  const { error } = await supabase.rpc('accept_friend_request', {
    p_request_id: requestId,
    p_my_uid: myUid,
    p_from_uid: fromUid,
    p_my_display_name: myProfile?.displayName || 'Unknown',
    p_my_photo_url: myProfile?.photoURL || null,
    p_my_gender: myProfile?.gender || null,
    p_my_vibe_tags: myProfile?.vibeTags || [],
    p_from_display_name: fromProfile?.displayName || 'Unknown',
    p_from_photo_url: fromProfile?.photoURL || null,
    p_from_gender: fromProfile?.gender || null,
    p_from_vibe_tags: fromProfile?.vibeTags || [],
  });
  if (error) throw error;
}

export async function declineFriendRequest(requestId) {
  await supabase.from('friend_requests').update({ status: 'declined' }).eq('id', requestId);
}

// ── Friends ────────────────────────────────────────────────────
export function subscribeFriends(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('friends').select('*').eq('user_id', uid);
    return (data || []).map(friendFromDb);
  };
  return makeSub(`friends-${uid}`, 'friends', `user_id=eq.${uid}`, fetch, callback);
}

export async function checkIsFriend(myUid, targetUid) {
  const { data } = await supabase.from('friends').select('friend_uid')
    .eq('user_id', myUid).eq('friend_uid', targetUid).maybeSingle();
  return !!data;
}

export async function removeFriend(uid, friendUid) {
  const { error } = await supabase.rpc('remove_friend', { p_uid1: uid, p_uid2: friendUid });
  if (error) throw error;
}

export async function deleteFriendList(uid) {
  await supabase.from('friends').delete().eq('user_id', uid);
}

// ── Friend chats ───────────────────────────────────────────────
export function getFriendChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

export async function ensureFriendChat(uid1, uid2) {
  const chatId = getFriendChatId(uid1, uid2);
  await supabase.from('friend_chats').upsert(
    { id: chatId, participants: [uid1, uid2] },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  return chatId;
}

export function subscribeFriendMessages(chatId, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('friend_messages').select('*')
      .eq('chat_id', chatId).order('created_at', { ascending: true });
    return (data || []).map((r) => ({ id: r.id, senderUid: r.sender_uid, text: r.text, createdAt: r.created_at }));
  };
  return makeSub(`fmsgs-${chatId}`, 'friend_messages', `chat_id=eq.${chatId}`, fetch, callback);
}

export async function sendFriendMessage(chatId, senderUid, text) {
  await supabase.from('friend_messages').insert({ chat_id: chatId, sender_uid: senderUid, text: text.trim() });
}

// ── Daily signals ──────────────────────────────────────────────
export async function getDailySignalCount(uid) {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await supabase.from('daily_signals').select('count').eq('id', `${uid}_${today}`).maybeSingle();
  return data?.count || 0;
}

export async function incrementDailySignal(uid) {
  const today = new Date().toISOString().split('T')[0];
  const id = `${uid}_${today}`;
  const { data } = await supabase.from('daily_signals').select('count').eq('id', id).maybeSingle();
  if (data) {
    await supabase.from('daily_signals').update({ count: (data.count || 0) + 1 }).eq('id', id);
  } else {
    await supabase.from('daily_signals').insert({ id, uid, count: 1, date: today });
  }
}

export async function getTotalSignalsReceived(uid) {
  const { count } = await supabase.from('signals').select('*', { count: 'exact', head: true }).eq('to_uid', uid);
  return count || 0;
}

export async function getTotalMatches(uid) {
  const { count: c1 } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('user1', uid);
  const { count: c2 } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('user2', uid);
  return (c1 || 0) + (c2 || 0);
}

// ── Posts ──────────────────────────────────────────────────────
const PAGE_SIZE = 10;

export function subscribeFeed(callback) {
  const fetch = async () => {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    return data || [];
  };
  return makeSub('feed', 'posts', null, fetch, callback);
}

export function subscribeLatestPosts(callback, count = 40) {
  const fetch = async () => {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(count);
    return data || [];
  };
  return makeSub('latest-posts', 'posts', null, fetch, callback);
}

export async function getPaginatedPosts(lastCreatedAt = null) {
  let q = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(PAGE_SIZE);
  if (lastCreatedAt) q = q.lt('created_at', lastCreatedAt);
  const { data } = await q;
  const posts = data || [];
  return {
    posts,
    lastDoc: posts.length ? posts[posts.length - 1].created_at : null,
    hasMore: posts.length === PAGE_SIZE,
  };
}

export function subscribeUserPosts(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('posts').select('*')
      .eq('uid', uid).order('created_at', { ascending: false });
    return data || [];
  };
  return makeSub(`posts-${uid}`, 'posts', `uid=eq.${uid}`, fetch, callback);
}

export async function createPost(data) {
  const { data: row, error } = await supabase.from('posts').insert({
    uid: data.uid,
    content: data.content,
    likes: 0, comments_count: 0,
  }).select('id').single();
  if (error) throw error;
  return row;
}

export async function deletePost(postId) {
  await supabase.from('posts').delete().eq('id', postId);
}

export async function toggleLike(postId, uid, isLiked) {
  if (isLiked) {
    await supabase.from('post_likes').delete().eq('post_id', postId).eq('uid', uid);
    const { data } = await supabase.from('posts').select('likes').eq('id', postId).single();
    await supabase.from('posts').update({ likes: Math.max(0, (data?.likes || 1) - 1) }).eq('id', postId);
  } else {
    await supabase.from('post_likes').upsert({ post_id: postId, uid }, { onConflict: 'post_id,uid' });
    const { data } = await supabase.from('posts').select('likes').eq('id', postId).single();
    await supabase.from('posts').update({ likes: (data?.likes || 0) + 1 }).eq('id', postId);
  }
}

export async function checkLiked(postId, uid) {
  const { data } = await supabase.from('post_likes').select('uid').eq('post_id', postId).eq('uid', uid).maybeSingle();
  return !!data;
}

export async function getLatestPost(uid) {
  const { data } = await supabase.from('posts').select('*').eq('uid', uid)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data;
}

// ── Comments ───────────────────────────────────────────────────
export async function addComment(postId, uid, displayName, photoURL, gender, text) {
  const { data, error } = await supabase.from('comments').insert({
    post_id: postId, uid, display_name: displayName,
    photo_url: photoURL || null, gender: gender || null, text: text.trim(),
  }).select('id').single();
  if (error) throw error;
  const { data: p } = await supabase.from('posts').select('comments_count').eq('id', postId).single();
  await supabase.from('posts').update({ comments_count: (p?.comments_count || 0) + 1 }).eq('id', postId);
  return data.id;
}

export function subscribeComments(postId, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('comments').select('*')
      .eq('post_id', postId).order('created_at', { ascending: true });
    return (data || []).map((r) => ({ id: r.id, uid: r.uid, displayName: r.display_name, photoURL: r.photo_url, gender: r.gender, text: r.text, createdAt: r.created_at }));
  };
  return makeSub(`comments-${postId}`, 'comments', `post_id=eq.${postId}`, fetch, callback);
}

export async function deleteComment(postId, commentId, uid) {
  const { data } = await supabase.from('comments').select('uid').eq('id', commentId).maybeSingle();
  if (!data || data.uid !== uid) return;
  await supabase.from('comments').delete().eq('id', commentId);
  const { data: p } = await supabase.from('posts').select('comments_count').eq('id', postId).single();
  await supabase.from('posts').update({ comments_count: Math.max(0, (p?.comments_count || 1) - 1) }).eq('id', postId);
}

// ── Block / Report ─────────────────────────────────────────────
export async function blockUser(myUid, targetUid) {
  await supabase.from('blocks').upsert({ user_id: myUid, blocked_uid: targetUid, blocked_at: new Date().toISOString() });
}

export async function unblockUser(myUid, targetUid) {
  await supabase.from('blocks').delete().eq('user_id', myUid).eq('blocked_uid', targetUid);
}

export function subscribeBlockedUsers(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('blocks').select('blocked_uid').eq('user_id', uid);
    return new Set((data || []).map((r) => r.blocked_uid));
  };
  return makeSub(`blocks-${uid}`, 'blocks', `user_id=eq.${uid}`, fetch, callback);
}

export async function getBlockedSet(uid) {
  const { data } = await supabase.from('blocks').select('blocked_uid').eq('user_id', uid);
  return new Set((data || []).map((r) => r.blocked_uid));
}

export async function getBlockedUsersWithProfiles(uid) {
  const { data } = await supabase.from('blocks').select('blocked_uid').eq('user_id', uid);
  if (!data?.length) return [];
  const ids = data.map((r) => r.blocked_uid);
  const profiles = await Promise.all(ids.map(async (id) => {
    try {
      const p = await getUserProfile(id);
      return { uid: id, displayName: p?.displayName || 'Unknown', photoURL: p?.photoURL || null, gender: p?.gender || null };
    } catch {
      return { uid: id, displayName: 'Unknown', photoURL: null, gender: null };
    }
  }));
  return profiles;
}

export async function reportUser(reporterUid, reportedUid, reason, details) {
  await supabase.from('reports').insert({ reporter_uid: reporterUid, reported_uid: reportedUid, reason, details: details || null, status: 'pending' });
}

export async function submitProblemReport(uid, description) {
  await supabase.from('reports').insert({ type: 'problem_report', reporter_uid: uid, description: description.trim(), status: 'pending' });
}

// ── Follow system ──────────────────────────────────────────────
export async function followUser(myUid, targetUid) {
  await supabase.from('follows').upsert({ follower_id: myUid, following_id: targetUid });
}

export async function unfollowUser(myUid, targetUid) {
  await supabase.from('follows').delete().eq('follower_id', myUid).eq('following_id', targetUid);
}

export function subscribeMyFollowing(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', uid);
    return new Set((data || []).map((r) => r.following_id));
  };
  return makeSub(`following-${uid}`, 'follows', `follower_id=eq.${uid}`, fetch, callback);
}

export function subscribeMyFollowers(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('follows').select('follower_id').eq('following_id', uid);
    return new Set((data || []).map((r) => r.follower_id));
  };
  return makeSub(`followers-${uid}`, 'follows', `following_id=eq.${uid}`, fetch, callback);
}

export function subscribeUserFollowersList(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('follows').select('follower_id').eq('following_id', uid);
    return (data || []).map((r) => r.follower_id);
  };
  return makeSub(`followers-list-${uid}`, 'follows', `following_id=eq.${uid}`, fetch, callback);
}

export function subscribeUserFollowingList(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('follows').select('following_id').eq('follower_id', uid);
    return (data || []).map((r) => r.following_id);
  };
  return makeSub(`following-list-${uid}`, 'follows', `follower_id=eq.${uid}`, fetch, callback);
}

// ── Matches (legacy) ───────────────────────────────────────────
export function subscribeMatches(uid, callback) {
  const fetch = async () => {
    const [{ data: d1 }, { data: d2 }] = await Promise.all([
      supabase.from('matches').select('*').eq('user1', uid),
      supabase.from('matches').select('*').eq('user2', uid),
    ]);
    const all = [...(d1 || []), ...(d2 || [])];
    all.sort((a, b) => new Date(b.matched_at) - new Date(a.matched_at));
    return all;
  };
  return makeSub(`matches-${uid}`, 'matches', null, fetch, callback);
}

// ── Glimpses ───────────────────────────────────────────────────
const GLIMPSE_TTL_MS = 24 * 60 * 60 * 1000;

export async function createGlimpse(userId, mediaUrl, mediaType) {
  const expiresAt = new Date(Date.now() + GLIMPSE_TTL_MS).toISOString();
  const { data, error } = await supabase.from('glimpses').insert({
    user_id: userId, media_url: mediaUrl, media_type: mediaType,
    expires_at: expiresAt, viewed_by: [],
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

export function subscribeMyGlimpses(userId, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('glimpses').select('*')
      .eq('user_id', userId).gt('expires_at', new Date().toISOString());
    return (data || []).map((r) => ({ id: r.id, userId: r.user_id, mediaUrl: r.media_url, mediaType: r.media_type, expiresAt: r.expires_at, viewedBy: r.viewed_by, createdAt: r.created_at }));
  };
  return makeSub(`myglimp-${userId}`, 'glimpses', `user_id=eq.${userId}`, fetch, callback);
}

export function subscribeActiveGlimpses(friendUids, callback) {
  if (!friendUids?.length) { callback([]); return () => {}; }
  const fetch = async () => {
    const { data } = await supabase.from('glimpses').select('*')
      .in('user_id', friendUids).gt('expires_at', new Date().toISOString());
    return (data || []).map((r) => ({ id: r.id, userId: r.user_id, mediaUrl: r.media_url, mediaType: r.media_type, expiresAt: r.expires_at, viewedBy: r.viewed_by, createdAt: r.created_at }));
  };
  return makeSub('active-glimpses', 'glimpses', null, fetch, callback);
}

export async function markGlimpseViewed(glimpseId, viewerUid) {
  const { data } = await supabase.from('glimpses').select('viewed_by').eq('id', glimpseId).single();
  const current = data?.viewed_by || [];
  if (!current.includes(viewerUid)) {
    await supabase.from('glimpses').update({ viewed_by: [...current, viewerUid] }).eq('id', glimpseId);
  }
}

export async function deleteGlimpse(glimpseId) {
  await supabase.from('glimpses').delete().eq('id', glimpseId);
}

// ── Vibe ───────────────────────────────────────────────────────
export async function saveMyVibe(uid, content) {
  await supabase.from('private_vibes').upsert({ user_id: uid, content: content.trim(), updated_at: new Date().toISOString() });
}

export async function getMyVibe(uid) {
  const { data } = await supabase.from('private_vibes').select('*').eq('user_id', uid).maybeSingle();
  return data ? { content: data.content, updatedAt: data.updated_at } : null;
}

export function subscribeVibeStatus(myUid, targetUid, callback) {
  let out = null, inc = null;
  const emit = () => {
    const accepted = [out, inc].find((r) => r?.status === 'accepted');
    if (accepted) { callback({ phase: 'result', score: accepted.score ?? null, requestId: accepted.id }); return; }
    if (out?.status === 'pending') { callback({ phase: 'pending-out', requestId: out.id }); return; }
    if (inc?.status === 'pending') { callback({ phase: 'pending-in', requestId: inc.id }); return; }
    callback({ phase: 'none' });
  };

  const fetchAll = async () => {
    const [{ data: o }, { data: i }] = await Promise.all([
      supabase.from('vibe_requests').select('*').eq('from_user_id', myUid).eq('to_user_id', targetUid).maybeSingle(),
      supabase.from('vibe_requests').select('*').eq('from_user_id', targetUid).eq('to_user_id', myUid).maybeSingle(),
    ]);
    out = o; inc = i; emit();
  };

  fetchAll();
  const ch = supabase.channel(`vibe-${myUid}-${targetUid}-${Math.random().toString(36).slice(2, 9)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vibe_requests' }, fetchAll)
    .subscribe();
  return () => supabase.removeChannel(ch);
}

// ── Notifications ──────────────────────────────────────────────
export function subscribeNotifications(uid, callback) {
  const fetch = async () => {
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(50);
    return (data || []).map(notifFromDb);
  };
  return makeSub(`notifs-${uid}`, 'notifications', `user_id=eq.${uid}`, fetch, callback);
}

export async function markNotificationRead(uid, notifId) {
  await supabase.from('notifications').update({ read: true }).eq('id', notifId).eq('user_id', uid);
}

export async function markAllNotificationsRead(uid) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', uid).eq('read', false);
}

// ── User search ────────────────────────────────────────────────
export async function searchUsers(term) {
  if (!term || term.trim().length < 2) return [];
  const t = term.trim().toLowerCase();
  const { data } = await supabase.from('profiles').select('*')
    .or(`display_name.ilike.${t}%,username.ilike.${t}%`)
    .limit(10);
  return (data || []).map(profileFromDb);
}
