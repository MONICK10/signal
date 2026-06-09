import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import ThemeToggle from '../components/ThemeToggle';
import { createPost } from '../firebase/firestore';
import { uploadFile } from '../firebase/storage';

export default function CreatePostPage({ user, profile }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const fileInputRef = useRef(null);

  const [mode, setMode] = useState(null);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (mode === 'photo' && !imageFile) { showToast('Select a photo', 'error'); return; }
    if (mode === 'text' && !content.trim()) { showToast('Write something', 'error'); return; }
    setSubmitting(true);
    try {
      let imageURL = null;
      const postId = `${user.uid}_${Date.now()}`;

      if (mode === 'photo' && imageFile) {
        imageURL = await uploadFile(`posts/${user.uid}/${postId}`, imageFile);
      }

      await createPost({
        uid: user.uid,
        username: profile?.username || null,
        displayName: profile?.displayName || 'User',
        photoURL: profile?.photoURL || null,
        gender: profile?.gender || null,
        isPrivate: profile?.isPrivate || false,
        type: mode,
        content: content.trim() || null,
        imageURL,
      });

      navigate('/feed', { replace: true });
    } catch {
      showToast('Failed to create post', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 0 }}>
          <i className="ti ti-arrow-left" />
        </button>
        <h3>New Quick</h3>
        <ThemeToggle />
      </div>

      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!mode ? (
          <>
            <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginBottom: 8 }}>What would you like to share?</p>
            <button
              className="card"
              onClick={() => { setMode('photo'); setTimeout(() => fileInputRef.current?.click(), 50); }}
              style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 24, cursor: 'pointer', border: '1.5px solid var(--color-border)', textAlign: 'left', background: 'var(--color-surface)' }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ti ti-photo" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Photo Quick</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Share a photo with a caption</div>
              </div>
            </button>

            <button
              className="card"
              onClick={() => setMode('text')}
              style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 24, cursor: 'pointer', border: '1.5px solid var(--color-border)', textAlign: 'left', background: 'var(--color-surface)' }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--color-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="ti ti-align-left" style={{ fontSize: 28, color: 'var(--color-primary)' }} />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Text Quick</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Share a thought or story</div>
              </div>
            </button>
          </>
        ) : (
          <>
            {mode === 'photo' && (
              <div>
                <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileSelect} />
                {imagePreview ? (
                  <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                    <img src={imagePreview} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'cover', display: 'block' }} />
                    <button onClick={() => fileInputRef.current?.click()} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 8, padding: '6px 12px', color: '#fff', cursor: 'pointer', fontSize: 13 }}>
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{ width: '100%', height: 200, background: 'var(--color-surface)', border: '2px dashed var(--color-border)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', color: 'var(--color-text-secondary)', marginBottom: 12 }}
                  >
                    <i className="ti ti-upload" style={{ fontSize: 36 }} />
                    <span style={{ fontSize: 14 }}>Tap to select a photo</span>
                  </button>
                )}
                <div className="input-group">
                  <label className="input-label">Caption (optional)</label>
                  <input className="input-field" type="text" placeholder="Add a caption..." value={content} onChange={(e) => setContent(e.target.value)} maxLength={300} />
                </div>
              </div>
            )}

            {mode === 'text' && (
              <div className="input-group">
                <label className="input-label">What's on your mind?</label>
                <textarea
                  className="input-field"
                  style={{ minHeight: 160, resize: 'vertical' }}
                  placeholder="Share a thought..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={500}
                  autoFocus
                />
                <span className="caption" style={{ textAlign: 'right' }}>{content.length}/500</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setMode(null); setContent(''); setImageFile(null); setImagePreview(null); }}>
                Back
              </button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleSubmit} disabled={submitting || (mode === 'photo' && !imageFile) || (mode === 'text' && !content.trim())}>
                {submitting ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Quick'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
