import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { saveMyVibe, getMyVibe } from '../firebase/firestore';

const MAX_WORDS = 500;

function countWords(text) {
  const t = text.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

export default function MyVibePage({ user }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    getMyVibe(user.uid)
      .then((data) => { if (data?.content) setContent(data.content); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.uid]);

  const wordCount = countWords(content);
  const overLimit = wordCount > MAX_WORDS;

  const handleChange = (e) => {
    const val = e.target.value;
    // Allow a little slack so the user can see they're over — hard-stop well past
    if (countWords(val) > MAX_WORDS + 20) return;
    setContent(val);
  };

  const handleSave = async () => {
    if (overLimit) return;
    setSaving(true);
    try {
      await saveMyVibe(user.uid, content);
      showToast('Vibe saved', 'success');
    } catch {
      showToast('Failed to save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}
        >
          <i className="ti ti-arrow-left" />
        </button>
        <h2 style={{ flex: 1, textAlign: 'center', margin: 0 }}>My Vibe</h2>
        <div style={{ width: 22 }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <span className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : (
        <div style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Privacy notice */}
          <div style={{
            background: 'var(--color-surface)', borderRadius: 14,
            padding: '14px 16px', border: '1px solid var(--color-border)',
            display: 'flex', alignItems: 'flex-start', gap: 12,
          }}>
            <i className="ti ti-lock" style={{ fontSize: 18, color: 'var(--color-primary)', flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
              Only you can see this. It's used to calculate a vibe match % when someone requests a check.
              No one — not even admins — can read your vibe text. Only the computed score is ever shared.
            </p>
          </div>

          {/* Textarea */}
          <div style={{ position: 'relative' }}>
            <textarea
              value={content}
              onChange={handleChange}
              placeholder="Describe your personality, mood, interests — be honest. This is private."
              rows={14}
              style={{
                width: '100%', padding: '14px', borderRadius: 14,
                border: overLimit
                  ? '2px solid #ef4444'
                  : '1.5px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text-primary)',
                fontSize: 15, lineHeight: 1.7,
                fontFamily: 'inherit', resize: 'none', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{
              position: 'absolute', bottom: 10, right: 14,
              fontSize: 12, fontWeight: overLimit ? 700 : 400,
              color: overLimit ? '#ef4444' : 'var(--color-text-secondary)',
            }}>
              {wordCount} / {MAX_WORDS}
            </div>
          </div>

          {overLimit && (
            <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>
              Over the 500-word limit — trim a little.
            </p>
          )}

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || overLimit || content.trim() === ''}
            style={{ padding: '14px', borderRadius: 14, fontSize: 16, fontWeight: 700 }}
          >
            {saving
              ? <span className="spinner" style={{ width: 20, height: 20 }} />
              : 'Save Vibe'}
          </button>

          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center', margin: 0 }}>
            You can update your vibe anytime. Previous checks aren't affected.
          </p>
        </div>
      )}
    </div>
  );
}
