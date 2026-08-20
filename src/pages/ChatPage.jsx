import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import {
  subscribeChat, subscribeMessages, sendMessage,
  requestPause, acceptPause, declinePause, resumeChat, endChat,
  createFriendRequest, subscribeFriendRequestsByChatId,
  acceptFriendRequest, declineFriendRequest,
  getUserProfile,
} from '../lib/db';
import UserActionMenu from '../components/UserActionMenu';

function formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function timerColor(ms) {
  if (ms > 120000) return 'var(--color-text-secondary)';
  if (ms > 60000)  return '#FF8C42';
  return '#FF3355';
}

function getRemaining(chatData) {
  if (!chatData?.timerStartedAt) return chatData?.timerSeconds * 1000 || 300000;
  const startMs = new Date(chatData.timerStartedAt).getTime();
  const totalMs = (chatData.timerSeconds || 300) * 1000;
  if (chatData.isPaused && chatData.pausedAt) {
    const pausedMs = new Date(chatData.pausedAt).getTime();
    return Math.max(0, totalMs - (pausedMs - startMs));
  }
  return Math.max(0, totalMs - (Date.now() - startMs));
}

function TimerBar({ remaining, total = 300000 }) {
  const pct = Math.max(0, Math.min(1, remaining / total)) * 100;
  const color = timerColor(remaining);
  const isPulsing = remaining < 30000 && remaining > 0;
  return (
    <div style={{ height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden', margin: '4px 0 0' }}>
      <div style={{
        height: '100%', borderRadius: 2,
        width: `${pct}%`, background: color,
        transition: 'width 1s linear, background 0.3s',
        animation: isPulsing ? 'timerPulse 0.8s ease-in-out infinite' : 'none',
      }} />
    </div>
  );
}

function ChatBubble({ msg, isOwn, senderName }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      {senderName && (
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3, marginLeft: isOwn ? 0 : 4, marginRight: isOwn ? 4 : 0 }}>
          {senderName}
        </span>
      )}
      <div style={{
        maxWidth: '75%', padding: '10px 14px',
        borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
        background: isOwn ? 'var(--color-primary)' : 'var(--color-surface-2)',
        color: isOwn ? '#fff' : 'var(--color-text-primary)',
        fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word',
      }}>
        {msg.text}
      </div>
    </div>
  );
}

export default function ChatPage({ user, profile }) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [chatData, setChatData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [remaining, setRemaining] = useState(300000);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [timesUp, setTimesUp] = useState(false);
  const [friendRequest, setFriendRequest] = useState(null);
  const [friendRequestSent, setFriendRequestSent] = useState(false);
  const [otherProfile, setOtherProfile] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const messagesEndRef = useRef(null);
  const timerRef = useRef(null);

  const otherUid = chatData?.participants?.find((p) => p !== user?.uid);

  // Load other user's profile
  useEffect(() => {
    if (!otherUid) return;
    getUserProfile(otherUid).then(setOtherProfile).catch(() => {});
  }, [otherUid]);

  // Subscribe to chat doc
  useEffect(() => {
    if (!chatId) return;
    return subscribeChat(chatId, (data) => {
      setChatData(data);
      if (data.status === 'ended') navigate('/map', { replace: true });
    });
  }, [chatId, navigate]);

  // Subscribe to messages
  useEffect(() => {
    if (!chatId) return;
    return subscribeMessages(chatId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
  }, [chatId]);

  // Subscribe to friend requests for this chat
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    return subscribeFriendRequestsByChatId(chatId, (reqs) => {
      const incoming = reqs.find((r) => r.toUid === user.uid && r.status === 'pending');
      const outgoing = reqs.find((r) => r.fromUid === user.uid);
      setFriendRequest(incoming || null);
      if (outgoing) setFriendRequestSent(true);
    });
  }, [chatId, user?.uid]);

  // Timer tick
  useEffect(() => {
    if (!chatData || timesUp) return;
    if (chatData.isPaused) {
      clearInterval(timerRef.current);
      setRemaining(getRemaining(chatData));
      return;
    }
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const rem = getRemaining(chatData);
      setRemaining(rem);
      if (rem <= 0) {
        clearInterval(timerRef.current);
        setTimesUp(true);
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [chatData, timesUp]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || sending || timesUp) return;
    setSending(true);
    const text = inputText;
    setInputText('');
    try {
      await sendMessage(chatId, user.uid, text);
    } catch {
      showToast('Failed to send', 'error');
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, timesUp, chatId, user?.uid, showToast]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handlePause = async () => {
    try { await requestPause(chatId, user.uid); }
    catch { showToast('Failed', 'error'); }
  };

  const handleAcceptPause = async () => {
    try { await acceptPause(chatId, user.uid); }
    catch { showToast('Failed', 'error'); }
  };

  const handleDeclinePause = async () => {
    try { await declinePause(chatId); }
    catch { showToast('Failed', 'error'); }
  };

  const handleResume = async () => {
    try { await resumeChat(chatId, chatData.timerStartedAt, chatData.pausedAt); }
    catch { showToast('Failed', 'error'); }
  };

  const handleAddFriend = async () => {
    if (friendRequestSent) return;
    try {
      await createFriendRequest(user.uid, otherUid, chatId);
      setFriendRequestSent(true);
      showToast('Friend request sent!', 'success');
    } catch { showToast('Failed', 'error'); }
  };

  const handleAcceptFriendRequest = async () => {
    if (!friendRequest) return;
    try {
      await acceptFriendRequest(friendRequest.id, user.uid, profile, friendRequest.fromUid);
      showToast(`You are now friends with ${otherProfile?.displayName || 'them'}!`, 'success');
      setFriendRequest(null);
    } catch { showToast('Failed', 'error'); }
  };

  const handleDeclineFriendRequest = async () => {
    if (!friendRequest) return;
    try {
      await declineFriendRequest(friendRequest.id);
      setFriendRequest(null);
    } catch {}
  };

  const handleLeave = async () => {
    try { await endChat(chatId); }
    catch {}
    navigate('/map', { replace: true });
  };

  const handleBackPress = () => {
    if (timesUp) { navigate('/map', { replace: true }); return; }
    setShowLeaveConfirm(true);
  };

  const isAnon = chatData?.anonymous;
  const otherName = isAnon ? 'Ghost' : (otherProfile?.displayName || 'Unknown');
  const pauseRequester = chatData?.pauseRequestedBy;
  const isPaused = chatData?.isPaused;
  const otherRequestedPause = pauseRequester && pauseRequester !== user?.uid;
  const iAmRequesting = pauseRequester === user?.uid;

  // Group messages to show sender name only on first in sequence
  const getGroupedMessages = () => {
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const showName = !prev || prev.senderUid !== msg.senderUid;
      return { ...msg, showName };
    });
  };

  const color = timerColor(remaining);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg)', position: 'relative' }}>
      <style>{`
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg)', zIndex: 10 }}>
        <button onClick={handleBackPress} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 4 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{ fontWeight: 700, fontSize: 16, cursor: otherUid && !isAnon ? 'pointer' : 'default' }}
              onClick={() => otherUid && !isAnon && navigate(`/profile/${otherUid}`)}
            >{otherName}</span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isPaused ? '#FF8C42' : '#111111', flexShrink: 0 }} />
          </div>
          {/* Timer */}
          <div>
            <span style={{ fontSize: 22, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums', animation: remaining < 30000 && remaining > 0 ? 'timerPulse 0.8s ease-in-out infinite' : 'none' }}>
              {formatTime(remaining)}
            </span>
            <TimerBar remaining={remaining} />
          </div>
        </div>
        {isPaused && (
          <span style={{ fontSize: 12, color: '#FF8C42', fontWeight: 600, background: 'rgba(255,140,66,0.12)', padding: '4px 10px', borderRadius: 20 }}>PAUSED</span>
        )}
        {otherUid && (
          <UserActionMenu
            myUid={user?.uid}
            targetUid={otherUid}
            targetName={otherName}
            onBlock={() => navigate('/map', { replace: true })}
          />
        )}
      </div>

      {/* Pause request banner */}
      {otherRequestedPause && !isPaused && (
        <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {otherName} wants to pause. Accept?
          </span>
          <button onClick={handleAcceptPause} style={{ background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Accept</button>
          <button onClick={handleDeclinePause} style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Keep Going</button>
        </div>
      )}

      {/* My pause pending */}
      {iAmRequesting && !isPaused && (
        <div style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: '10px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>
          Waiting for {otherName} to accept pause…
        </div>
      )}

      {/* Resume banner */}
      {isPaused && (
        <div style={{ background: 'rgba(255,140,66,0.1)', borderBottom: '1px solid rgba(255,140,66,0.3)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontSize: 13, color: '#FF8C42', fontWeight: 600 }}>Chat is paused</span>
          <button onClick={handleResume} style={{ background: '#FF8C42', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>Resume</button>
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 40 }}>
            Say hi — you have {formatTime(remaining)} to talk!
          </div>
        )}
        {getGroupedMessages().map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.senderUid === user?.uid}
            senderName={msg.showName ? (msg.senderUid === user?.uid ? 'You' : otherName) : null}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Message input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--color-bg)' }}>
        <button
          onClick={isPaused ? handleResume : handlePause}
          disabled={timesUp || iAmRequesting}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '1.5px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
        >
          <i className={`ti ${isPaused ? 'ti-player-play' : 'ti-player-pause'}`} style={{ fontSize: 16 }} />
        </button>

        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value.slice(0, 500))}
          onKeyDown={handleKeyDown}
          disabled={timesUp || isPaused}
          placeholder={timesUp ? "Time's up" : isPaused ? 'Paused…' : 'Type something…'}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 24,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 15, outline: 'none',
            opacity: timesUp || isPaused ? 0.5 : 1,
          }}
        />

        <button
          onClick={handleSend}
          disabled={!inputText.trim() || sending || timesUp || isPaused}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !inputText.trim() || timesUp || isPaused ? 0.5 : 1 }}
        >
          <i className="ti ti-send" style={{ fontSize: 16 }} />
        </button>
      </div>

      {/* Time's up overlay */}
      {timesUp && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 24, padding: 32, textAlign: 'center', width: '100%', maxWidth: 320 }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⏱️</div>
            <h2 style={{ marginBottom: 8 }}>Time's up</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24, fontSize: 15 }}>You talked for 5 minutes</p>

            {/* Friend request incoming */}
            {friendRequest && (
              <div style={{ background: 'var(--color-surface-2)', borderRadius: 16, padding: 16, marginBottom: 16 }}>
                <p style={{ fontSize: 14, marginBottom: 12, fontWeight: 600 }}>
                  {otherName} sent you a friend request
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={handleAcceptFriendRequest} style={{ flex: 1, padding: '10px', background: 'var(--color-success)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }}>
                    Accept Friend
                  </button>
                  <button onClick={handleDeclineFriendRequest} style={{ flex: 1, padding: '10px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                    Decline
                  </button>
                </div>
              </div>
            )}

            {/* Add friend / Leave */}
            {!friendRequest && (
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={handleAddFriend}
                  disabled={friendRequestSent}
                  style={{ flex: 1, padding: '12px', background: friendRequestSent ? 'var(--color-surface-2)' : 'var(--color-primary)', color: friendRequestSent ? 'var(--color-text-secondary)' : '#fff', border: 'none', borderRadius: 14, fontWeight: 700, cursor: friendRequestSent ? 'default' : 'pointer', fontSize: 14 }}
                >
                  {friendRequestSent ? 'Request Sent' : 'Add as Friend'}
                </button>
                <button onClick={handleLeave} style={{ flex: 1, padding: '12px', background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 14, fontWeight: 700, cursor: 'pointer', fontSize: 14, color: 'var(--color-text-primary)' }}>
                  Leave
                </button>
              </div>
            )}

            {friendRequest && (
              <button onClick={handleLeave} style={{ width: '100%', padding: '12px', marginTop: 8, background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 14 }}>
                Leave chat
              </button>
            )}
          </div>
        </div>
      )}

      {/* Leave confirm dialog */}
      {showLeaveConfirm && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24 }}>
          <div style={{ background: 'var(--color-surface)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 300, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 8 }}>Leave chat?</h3>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14, marginBottom: 24 }}>The conversation will end for both of you.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowLeaveConfirm(false)} style={{ flex: 1, padding: '12px', background: 'var(--color-surface-2)', border: '1.5px solid var(--color-border)', borderRadius: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-primary)' }}>
                Stay
              </button>
              <button onClick={handleLeave} style={{ flex: 1, padding: '12px', background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, cursor: 'pointer' }}>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
