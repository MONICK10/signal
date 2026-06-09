import { formatDistanceToNow } from 'date-fns';

function Avatar({ name, gender, size = 56 }) {
  const colors = { male: 'var(--color-male)', female: 'var(--color-female)', other: 'var(--color-other)' };
  const bg = colors[gender] || 'var(--color-primary)';

  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.38,
      border: `3px solid ${bg}`,
      flexShrink: 0,
    }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  );
}

export default function MatchCard({ match, profile, onClick }) {
  const matchedAt = match.matchedAt?.toDate?.() || new Date();
  const timeAgo = formatDistanceToNow(matchedAt, { addSuffix: true });

  return (
    <div className="match-card" onClick={onClick}>
      <Avatar name={profile?.displayName} gender={profile?.gender} size={60} />
      <div style={{ fontWeight: 600, fontSize: 15 }}>{profile?.displayName || 'User'}</div>
      {profile?.vibeTags?.[0] && (
        <span className="chip" style={{ fontSize: 12 }}>{profile.vibeTags[0]}</span>
      )}
      <span className="caption">Matched {timeAgo}</span>
    </div>
  );
}
