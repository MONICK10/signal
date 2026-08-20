const SIZE_MAP = { sm: 32, md: 48, lg: 80 };

function Icon({ px }) {
  const id = `lg_${px}`;
  return (
    <svg width={px} height={px} viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`front_${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7CA8FF" />
          <stop offset="50%" stopColor="#2F6FED" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <linearGradient id={`right_${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <linearGradient id={`bottom_${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#172554" />
          <stop offset="100%" stopColor="#0B1330" />
        </linearGradient>
      </defs>

      {/* Bottom depth face */}
      <path d="M 12 72 L 72 72 L 80 80 L 20 80 Z" fill={`url(#bottom_${id})`} />
      {/* Right depth face */}
      <path d="M 72 8 L 80 16 L 80 80 L 72 72 Z" fill={`url(#right_${id})`} />
      {/* Front face */}
      <rect x="4" y="4" width="68" height="68" rx="14" fill={`url(#front_${id})`} />
      {/* Top-left corner highlight */}
      <path d="M 4 20 Q 4 4 20 4" stroke="white" strokeWidth="3" fill="none" opacity="0.25" strokeLinecap="round" />

      {/* Signal arcs */}
      <path d="M 18 52 Q 18 28 38 28 Q 58 28 58 52" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.3" />
      <path d="M 23 52 Q 23 33 38 33 Q 53 33 53 52" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M 28 52 Q 28 38 38 38 Q 48 38 48 52" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.95" />

      {/* Center dot */}
      <circle cx="38" cy="55" r="5" fill="white" />
      <circle cx="38" cy="55" r="2.5" fill="rgba(255,255,255,0.55)" />
    </svg>
  );
}

export default function Logo({ variant = 'icon', size = 'md' }) {
  const px = typeof size === 'number' ? size : (SIZE_MAP[size] || 48);
  const iconPx = variant === 'icon' ? px : Math.min(px, 40);

  if (variant === 'icon') {
    return <Icon px={px} />;
  }

  const isDark = variant === 'dark';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Icon px={iconPx} />
      <svg
        width={iconPx * 3.2}
        height={iconPx}
        viewBox={`0 0 ${iconPx * 3.2} ${iconPx}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <text
          x="0"
          y={iconPx * 0.58}
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontWeight="800"
          fontSize={iconPx * 0.52}
          letterSpacing="-1"
          fill={isDark ? '#FFFFFF' : '#101828'}
        >
          Cuelyn
        </text>
        <text
          x="0"
          y={iconPx * 0.92}
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontWeight="600"
          fontSize={iconPx * 0.17}
          letterSpacing="2.2"
          fill={isDark ? 'rgba(255,255,255,0.5)' : '#667085'}
        >
          NOTICE · CUELYN · CONNECT
        </text>
      </svg>
    </div>
  );
}
