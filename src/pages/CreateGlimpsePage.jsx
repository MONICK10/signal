import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import { createGlimpse } from '../firebase/firestore';
import { uploadFile } from '../firebase/storage';

export default function CreateGlimpsePage({ user }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showToast('Only photos are supported for Glimpses', 'error');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      showToast('Photo must be under 10MB', 'error');
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleShare = async () => {
    if (!file || !user?.uid) return;
    setUploading(true);
    try {
      const mediaUrl = await uploadFile(`glimpses/${user.uid}`, file);
      await createGlimpse(user.uid, mediaUrl, 'image');
      showToast('Glimpse shared! It expires in 24h', 'success');
      navigate(-1);
    } catch {
      showToast('Failed to share glimpse', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page" style={{ paddingBottom: 24 }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: 12, background: 'var(--color-bg)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: 22, padding: 4 }}
        >
          <i className="ti ti-x" />
        </button>
        <h3 style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 700 }}>New Glimpse</h3>
        <button
          onClick={handleShare}
          disabled={!file || uploading}
          className="btn btn-primary btn-sm"
          style={{ padding: '8px 20px', opacity: !file ? 0.5 : 1 }}
        >
          {uploading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : 'Share'}
        </button>
      </div>

      {/* Preview area */}
      <div
        onClick={() => !file && fileRef.current?.click()}
        style={{
          margin: '20px 16px',
          borderRadius: 20,
          overflow: 'hidden',
          background: 'var(--color-surface)',
          border: '2px dashed var(--color-border)',
          minHeight: 340,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: file ? 'default' : 'pointer',
          position: 'relative',
        }}
      >
        {preview ? (
          <img src={preview} alt="" style={{ width: '100%', maxHeight: 520, objectFit: 'contain', display: 'block' }} />
        ) : (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <i className="ti ti-camera" style={{ fontSize: 52, color: 'var(--color-text-secondary)', display: 'block', marginBottom: 12 }} />
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>Tap to pick a photo</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Disappears after 24 hours · Friends only</div>
          </div>
        )}
        {preview && (
          <button
            onClick={() => { setFile(null); setPreview(null); }}
            style={{
              position: 'absolute', top: 12, right: 12,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <i className="ti ti-x" style={{ fontSize: 16 }} />
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFileChange} />

      {!file && (
        <div style={{ padding: '0 16px' }}>
          <button
            onClick={() => fileRef.current?.click()}
            className="btn btn-secondary btn-full"
            style={{ padding: '14px', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            <i className="ti ti-photo" style={{ fontSize: 18 }} />
            Choose a Photo
          </button>
        </div>
      )}

      <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        <i className="ti ti-lock" style={{ marginRight: 6 }} />
        Only your friends can see your Glimpses
      </div>
    </div>
  );
}
