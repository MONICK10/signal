import { useState } from 'react';
import BottomSheet from './BottomSheet';

const MAX_LEN = 120;

export default function NotePostSheet({ onClose, onPost }) {
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      await onPost(trimmed);
      onClose();
    } finally {
      setPosting(false);
    }
  };

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3>Post a Note</h3>
        <div className="input-group">
          <input
            className="input-field"
            type="text"
            autoFocus
            placeholder="Need a C-type charger, near lib, will return in 20 min…"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            maxLength={MAX_LEN}
          />
          <span className="caption" style={{ textAlign: 'right' }}>{text.length}/{MAX_LEN}</span>
        </div>
        <p className="caption">Visible to everyone nearby for 6 hours. Your exact location stays hidden — only your fuzzed position is shown, same as the map.</p>
        <button className="btn btn-primary btn-full" onClick={handlePost} disabled={!text.trim() || posting}>
          {posting ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Post'}
        </button>
      </div>
    </BottomSheet>
  );
}
