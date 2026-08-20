import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { subscribeFriendMessages, sendFriendMessage, getUserProfile } from '../lib/db';

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

export default function FriendChatPage({ user }) {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherProfile, setOtherProfile] = useState(null);

  const messagesEndRef = useRef(null);

  // Derive other UID from chatId (format: uid1_uid2 sorted)
  const otherUid = chatId?.split('_').find((id) => id !== user?.uid);

  useEffect(() => {
    if (!otherUid) return;
    getUserProfile(otherUid).then(setOtherProfile).catch(() => {});
  }, [otherUid]);

  useEffect(() => {
    if (!chatId) return;
    return subscribeFriendMessages(chatId, (msgs) => {
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
  }, [chatId]);

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || sending) return;
    setSending(true);
    const text = inputText;
    setInputText('');
    try {
      await sendFriendMessage(chatId, user.uid, text);
    } catch {
      showToast('Failed to send', 'error');
      setInputText(text);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, chatId, user?.uid, showToast]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const otherName = otherProfile?.displayName || 'Friend';

  const grouped = messages.map((msg, i) => {
    const prev = messages[i - 1];
    return { ...msg, showName: !prev || prev.senderUid !== msg.senderUid };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--color-bg)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg)' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 4 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          {otherProfile?.photoURL
            ? <img src={otherProfile.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
            : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>{otherName[0]}</div>
          }
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{otherName}</div>
            <div style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600 }}>Friend</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 14, marginTop: 40 }}>
            Start your conversation with {otherName}!
          </div>
        )}
        {grouped.map((msg) => (
          <ChatBubble
            key={msg.id}
            msg={msg}
            isOwn={msg.senderUid === user?.uid}
            senderName={msg.showName ? (msg.senderUid === user?.uid ? 'You' : otherName) : null}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--color-bg)' }}>
        <input
          value={inputText}
          onChange={(e) => setInputText(e.target.value.slice(0, 500))}
          onKeyDown={handleKeyDown}
          placeholder="Type something…"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 24,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-surface)',
            color: 'var(--color-text-primary)',
            fontSize: 15, outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--color-primary)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: !inputText.trim() ? 0.5 : 1 }}
        >
          <i className="ti ti-send" style={{ fontSize: 16 }} />
        </button>
      </div>
    </div>
  );
}
