import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getReceivedSignals, getSentSignals, subscribeFriends } from '../firebase/firestore';
import { format, subDays, startOfDay } from 'date-fns';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const MILESTONES = [
  { key: 'firstSent',     icon: 'ti-send',   label: 'First signal sent',     check: (s, r) => s.length >= 1 },
  { key: 'firstReceived', icon: 'ti-inbox',  label: 'First signal received',  check: (s, r) => r.length >= 1 },
  { key: 'firstAccepted', icon: 'ti-check',  label: 'First accepted signal',  check: (s, r) => r.some((sig) => sig.status === 'accepted') },
  { key: 'firstFriend',   icon: 'ti-heart',  label: 'First friend made',      check: (s, r, f) => f >= 1 },
  { key: 'ten',           icon: 'ti-star',   label: '10 signals received',    check: (s, r) => r.length >= 10 },
  { key: 'fifty',         icon: 'ti-trophy', label: '50 signals received',    check: (s, r) => r.length >= 50 },
  { key: 'hundred',       icon: 'ti-crown',  label: '100 signals received',   check: (s, r) => r.length >= 100 },
];

function StatCard({ value, label }) {
  return (
    <div className="stat-card" style={{ flex: 1 }}>
      <span className="stat-value">{value}</span>
      <span className="stat-label" style={{ fontSize: 11, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

function MilestoneCard({ milestone, unlocked }) {
  return (
    <div style={{
      flex: '1 0 calc(50% - 6px)',
      padding: '14px 12px',
      borderRadius: 14,
      border: unlocked ? '1.5px solid var(--color-primary)' : '1.5px dashed var(--color-border)',
      background: unlocked ? 'rgba(0,102,255,0.06)' : 'var(--color-surface)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      opacity: unlocked ? 1 : 0.5,
      position: 'relative', overflow: 'hidden',
    }}>
      <i className={`ti ${milestone.icon}`} style={{ fontSize: 24, color: unlocked ? 'var(--color-primary)' : 'var(--color-text-secondary)' }} />
      <span style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', lineHeight: 1.3 }}>{milestone.label}</span>
      {!unlocked && (
        <span style={{ position: 'absolute', top: 6, right: 8, fontSize: 14, color: 'var(--color-text-secondary)' }}>?</span>
      )}
    </div>
  );
}

export default function AnalyticsPage({ user }) {
  const navigate = useNavigate();
  const [sent, setSent] = useState([]);
  const [received, setReceived] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    // Try cache first
    const cacheKey = `analytics_${user.uid}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) {
          setSent(data.sent); setReceived(data.received);
          setLoading(false);
        }
      } catch {}
    }

    Promise.all([
      getSentSignals(user.uid),
      getReceivedSignals(user.uid),
    ]).then(([s, r]) => {
      setSent(s); setReceived(r);
      setLoading(false);
      localStorage.setItem(cacheKey, JSON.stringify({ data: { sent: s, received: r }, ts: Date.now() }));
    }).catch(() => setLoading(false));

    return subscribeFriends(user.uid, (list) => setFriendCount(list.length));
  }, [user?.uid]);

  // Last 7 days chart data
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const label = format(day, 'EEE');
    const dayStart = startOfDay(day).getTime();
    const dayEnd = dayStart + 86400000;
    const toMs = (sig) => sig.createdAt?.toDate ? sig.createdAt.toDate().getTime() : (sig.createdAt?.seconds || 0) * 1000;
    return {
      day: label,
      received: received.filter((s) => { const t = toMs(s); return t >= dayStart && t < dayEnd; }).length,
      sent: sent.filter((s) => { const t = toMs(s); return t >= dayStart && t < dayEnd; }).length,
    };
  });

  // Hour heatmap
  const hourCounts = Array(24).fill(0);
  received.forEach((s) => {
    if (s.createdAt?.toDate) {
      const h = s.createdAt.toDate().getHours();
      hourCounts[h]++;
    }
  });
  const maxHour = hourCounts.indexOf(Math.max(...hourCounts));
  const maxHourCount = Math.max(...hourCounts);

  // Stats
  const totalReceived = received.length;
  const totalSent = sent.length;
  const acceptedCount = received.filter((s) => s.status === 'accepted').length;
  const acceptanceRate = totalReceived > 0 ? Math.round((acceptedCount / totalReceived) * 100) : 0;

  const hourLabel = (h) => {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
  };

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
            <i className="ti ti-arrow-left" />
          </button>
          <h2>My Signal Stats</h2>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 80, borderRadius: 16 }} />)}
        </div>
      ) : (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Overview */}
          <div className="stats-row" style={{ gap: 8, marginTop: 8 }}>
            <StatCard value={totalReceived} label="Received" />
            <StatCard value={totalSent} label="Sent" />
            <StatCard value={`${acceptanceRate}%`} label="Acceptance" />
            <StatCard value={friendCount} label="Friends made" />
          </div>

          {/* 7-day bar chart */}
          <div className="card" style={{ padding: '16px 12px' }}>
            <h3 style={{ marginBottom: 12, fontSize: 15 }}>Last 7 Days</h3>
            <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 600 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: 'var(--color-primary)', marginRight: 4 }} />Received</span>
              <span style={{ fontSize: 12, color: '#FF4B6E', fontWeight: 600 }}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#FF4B6E', marginRight: 4 }} />Sent</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={last7} barGap={2}>
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} />
                <YAxis hide allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
                  cursor={{ fill: 'rgba(0,102,255,0.05)' }}
                />
                <Bar dataKey="received" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="sent" fill="#FF4B6E" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hour heatmap */}
          <div className="card" style={{ padding: '16px 12px' }}>
            <h3 style={{ marginBottom: 4, fontSize: 15 }}>Time of Day</h3>
            {maxHourCount > 0 && (
              <p className="caption" style={{ marginBottom: 10 }}>
                Most active at {hourLabel(maxHour)}
              </p>
            )}
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {hourCounts.map((count, h) => {
                const intensity = maxHourCount > 0 ? count / maxHourCount : 0;
                return (
                  <div
                    key={h}
                    title={`${hourLabel(h)}: ${count} signals`}
                    style={{
                      width: 'calc((100% - 69px) / 24)',
                      minWidth: 10,
                      height: 28,
                      borderRadius: 4,
                      background: `rgba(0,102,255,${0.1 + intensity * 0.85})`,
                      transition: 'background 0.3s',
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: 'var(--color-text-secondary)' }}>
              <span>12a</span><span>6a</span><span>12p</span><span>6p</span><span>11p</span>
            </div>
          </div>

          {/* Milestones */}
          <div>
            <h3 style={{ marginBottom: 12, fontSize: 15 }}>Milestones</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {MILESTONES.map((m) => (
                <MilestoneCard
                  key={m.key}
                  milestone={m}
                  unlocked={m.check(sent, received, friendCount)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
