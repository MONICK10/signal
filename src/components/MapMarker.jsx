import { divIcon } from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';

function genderColor(gender) {
  if (gender === 'male') return 'var(--color-male)';
  if (gender === 'female') return 'var(--color-female)';
  return 'var(--color-other)';
}

function genderHex(gender) {
  if (gender === 'male') return '#3B82F6';
  if (gender === 'female') return '#A855F7';
  return '#F59E0B';
}

export function createMarkerIcon(firstName, gender, isDark = false) {
  const color = genderHex(gender);
  const bg = isDark ? '#1A1A1A' : '#ffffff';
  const textColor = isDark ? '#FFFFFF' : '#111111';
  const initial = (firstName || '?')[0].toUpperCase();

  const html = renderToStaticMarkup(
    <div style={{
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      border: `3px solid ${color}`,
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '11px',
      fontWeight: '600',
      color: textColor,
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      cursor: 'pointer',
      boxSizing: 'border-box',
    }}>
      {initial}
    </div>
  );

  return divIcon({
    html,
    className: '',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

export function getGenderColor(gender) {
  return genderColor(gender);
}
