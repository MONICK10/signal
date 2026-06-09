import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { getReceivedSignals, getSentSignals } from '../firebase/firestore';
import { getAnonymousLabel } from '../utils/anonymousLabels';
import EmptyState from '../components/EmptyState';

const STATUS_STYLES = {
  pending:  { label: 'Pending',  bg: 'rgba(255,140,66,0.15)',  color: '#FF8C42' },
  accepted: { label: 'Accepted', bg: 'rgba(0,200,160,0.15)',   color: '#00C8A0' },
  declined: { label: 'Declined', bg: 'rgba(255,51,85,0.15)',   color: '#FF3355' },
  expired:  { label: 'Expired',  bg: 'rgba(100,100,120,0.15)', color: '#888' },
};

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.expired;
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function AnonAvatar({ label }) {
  return (
    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--color-surface-2)', border: '2px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <i className="ti ti-ghost" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
    </div>
  );
}

function NamedAvatar({ name, gender }) {
  const colors = { male: '#FF4B6E', female: '#00CC88', other: '#AA66FF' };
  const bg = colors[gender] || 'var(--color-primary)';
  return (
    <div style={{ width: 48, height: 48, borderRadius: '50%', background: bg, border: `2px solid ${bg}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18, flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

function SignalHistoryCard({ signal, isReceived, allSignals }) {
  const isAnon = signal.anonymous;
  const anonLabel = isAnon ? getAnonymousLabel(signal.fromUid, allSignals) : null;

  const date = signal.createdAt?.toDate
    ? format(signal.createdAt.toDate(), "MMM d, yyyy · h:mm a")
    : '';

  const name = isAnon
    ? (isReceived ? anonLabel : signal.toDisplayName || 'Someone')
    : (isReceived ? signal.fromDisplayName : signal.toDisplayName) || 'Unknown';

  const gender = isAnon ? null : (isReceived ? signal.fromGender : signal.toGender);

  return (
    <div className="card" style={{ marginBottom: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {isAnon && isReceived
          ? <AnonAvatar />
          : <NamedAvatar name={name} gender={gender} />
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
            <StatusPill status={signal.status} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {isReceived ? 'Signaled you' : 'You signaled'}
          </div>
          {date && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              <i className="ti ti-clock" style={{ fontSize: 11, marginRight: 4 }} />{date}
            </div>
          )}
          {signal.locationLabel && (
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              <i className="ti ti-map-pin" style={{ fontSize: 11, marginRight: 4 }} />{signal.locationLabel}
            </div>
          )}
        </div>
      </div>

      {/* Sender quote (only on sent signals) */}
      {!isReceived && signal.senderQuote && (
        <div style={{ marginTop: 12, borderLeft: '3px solid var(--color-primary)', background: 'var(--color-surface-2)', padding: '8px 12px', borderRadius: '0 8px 8px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 3 }}>Your note</div>
          <div style={{ fontSize: 13, fontStyle: 'italic', color: 'var(--color-text-primary)', lineHeight: 1.5 }}>"{signal.senderQuote}"</div>
        </div>
      )}
    </div>
  );
}

export default function SignalHistoryPage({ user }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('received');
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    Promise.all([
      getReceivedSignals(user.uid),
      getSentSignals(user.uid),
    ]).then(([r, s]) => {
      setReceived(r);
      setSent(s);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [user?.uid]);

  const allSignals = [...received, ...sent];
  const current = tab === 'received' ? received : sent;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <h2>Signal History</h2>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', padding: '0 20px' }}>
        {['received', 'sent'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? 'var(--color-primary)' : 'transparent'}`, color: tab === t ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: tab === t ? 700 : 400, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)} {tab === t && `(${current.length})`}
          </button>
        ))}
      </div>

      <div className="page-content">
        {loading && [1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 90, borderRadius: 16, marginBottom: 10 }} />)}

        {!loading && current.length === 0 && (
          <EmptyState
            icon="ti-clock-history"
            title="No signal history"
            subtitle={"Your past signals\nwill appear here"}
          />
        )}

        {!loading && current.map((signal) => (
          <SignalHistoryCard
            key={signal.id}
            signal={signal}
            isReceived={tab === 'received'}
            allSignals={allSignals}
          />
        ))}
      </div>
    </div>
  );
}
