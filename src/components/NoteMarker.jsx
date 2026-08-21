import { divIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';

// Deliberately not a circular avatar (that's the person-marker language) —
// a pin/speech-bubble shape in amber so Notes read as "content", not "person".
export function makeNoteMarkerIcon(note) {
  const truncated = note.text.length > 28 ? `${note.text.slice(0, 28)}…` : note.text;
  const html = renderToStaticMarkup(
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', animation: 'markerAppear 0.3s ease' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: '#F59E0B', color: '#1A1200',
        border: '2px solid #FFFFFF',
        borderRadius: 14, padding: '6px 10px',
        fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif",
        whiteSpace: 'nowrap', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
        boxShadow: '0 0 0 4px rgba(245,158,11,0.16), 0 4px 14px -2px rgba(245,158,11,0.55)',
      }}>
        <i className="ti ti-note" style={{ fontSize: 15, flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{truncated}</span>
      </div>
      <div style={{
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '7px solid #F59E0B',
        marginTop: -1,
      }} />
    </div>
  );
  return divIcon({ html, className: '', iconSize: [170, 50], iconAnchor: [85, 50] });
}
