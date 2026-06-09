export default function VibeTagChip({ label, selected, onClick, selectable = false }) {
  const style = selected && selectable
    ? { background: 'var(--color-primary)', color: '#fff', border: 'none' }
    : {};

  return (
    <button
      className="chip"
      style={{ cursor: selectable ? 'pointer' : 'default', ...style }}
      onClick={selectable ? onClick : undefined}
      type="button"
    >
      {label}
    </button>
  );
}
