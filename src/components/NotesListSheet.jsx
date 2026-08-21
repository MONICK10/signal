import { useState, useEffect } from 'react';
import BottomSheet from './BottomSheet';
import EmptyState from './EmptyState';
import { getDistanceKm, fuzzyDistance } from '../utils/distance';

function formatTimeLeft(expiresAt) {
  const rem = new Date(expiresAt).getTime() - Date.now();
  if (rem <= 0) return 'Expired';
  const h = Math.floor(rem / 3600000);
  const m = Math.floor((rem % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

function NoteRow({ note, isOwn, distanceKm, onReply, onDelete, onReport }) {
  return (
    <div
      onClick={() => !isOwn && onReply(note)}
      style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '14px 16px', borderRadius: 16,
        background: isOwn ? 'rgba(245,158,11,0.08)' : 'var(--color-surface)',
        border: `1.5px solid ${isOwn ? 'rgba(245,158,11,0.35)' : 'var(--color-border)'}`,
        cursor: isOwn ? 'default' : 'pointer',
      }}
    >
      <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--color-text-primary)' }}>{note.text}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {distanceKm != null && <span>{fuzzyDistance(distanceKm)} away</span>}
          <span>·</span>
          <span>{formatTimeLeft(note.expiresAt)}</span>
        </div>
        {isOwn ? (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 13, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <i className="ti ti-trash" style={{ fontSize: 14 }} /> Delete
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onReport(note.id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <i className="ti ti-flag" style={{ fontSize: 14 }} /> Report
          </button>
        )}
      </div>
    </div>
  );
}

export default function NotesListSheet({ notes, myUid, userCoords, onClose, onReply, onDelete, onReport }) {
  const [, setTick] = useState(0);

  // Re-render every minute so "5h 12m left" stays accurate while the sheet is open
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const myNote = notes.find((n) => n.uid === myUid);
  const others = notes.filter((n) => n.uid !== myUid);

  const distanceTo = (note) => userCoords
    ? getDistanceKm(userCoords.lat, userCoords.lng, note.lat, note.lng)
    : null;

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '70vh' }}>
        <h3>Notes Nearby</h3>

        {notes.length === 0 ? (
          <EmptyState
            icon="ti-note-off"
            title="No active notes nearby"
            subtitle="Be the first to post one — tap + on the map."
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
            {myNote && (
              <NoteRow
                note={myNote}
                isOwn
                distanceKm={distanceTo(myNote)}
                onReply={onReply}
                onDelete={onDelete}
                onReport={onReport}
              />
            )}
            {others.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                isOwn={false}
                distanceKm={distanceTo(note)}
                onReply={onReply}
                onDelete={onDelete}
                onReport={onReport}
              />
            ))}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
