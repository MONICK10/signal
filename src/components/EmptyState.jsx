export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', textAlign: 'center',
    }}>
      {icon && (
        <i className={`ti ${icon}`} style={{ fontSize: 48, color: 'var(--color-text-secondary)', opacity: 0.4 }} />
      )}
      {title && (
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text-primary)', marginTop: 16 }}>{title}</div>
      )}
      {subtitle && (
        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 8, maxWidth: 240, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{subtitle}</div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="btn btn-secondary"
          style={{ marginTop: 24 }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
