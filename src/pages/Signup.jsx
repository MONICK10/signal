import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/Logo';
import ThemeToggle from '../components/ThemeToggle';
import VibeTagChip from '../components/VibeTagChip';
import { useToast } from '../components/Toast';
import { registerUser } from '../firebase/auth';
import { createUserProfile } from '../firebase/firestore';

const VIBE_TAGS = [
  'Café person', 'Quiet type', 'Music head', 'Gamer',
  'Nature lover', 'Creative', 'Gym rat', 'Foodie',
  'Movie buff', 'Animal lover', 'Tech nerd', 'Chill vibes',
];

function StepIndicator({ current, total }) {
  return (
    <div className="step-indicator">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`step-dot${i === current ? ' active' : ''}`} />
      ))}
    </div>
  );
}

function checkStrength(pw) {
  return {
    length:    pw.length >= 8,
    uppercase: /[A-Z]/.test(pw),
    number:    /[0-9]/.test(pw),
    special:   /[!@#$%^&*]/.test(pw),
  };
}

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#FF5A6A', '#FF8C42', '#F5C518', '#00CC88'];

function PasswordStrengthBar({ password }) {
  const criteria = checkStrength(password);
  const score = Object.values(criteria).filter(Boolean).length;
  if (!password) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((n) => (
          <div key={n} style={{
            flex: 1, height: 4, borderRadius: 9999,
            background: n <= score ? STRENGTH_COLORS[score] : 'var(--color-border)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 12, color: STRENGTH_COLORS[score] || 'var(--color-text-secondary)', fontWeight: 500 }}>
        {STRENGTH_LABELS[score]}
      </span>
    </div>
  );
}

export default function Signup() {
  const navigate = useNavigate();
  const showToast = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);

  const pwStrength = checkStrength(password);
  const pwScore = Object.values(pwStrength).filter(Boolean).length;
  const pwMismatch = confirmPassword && password !== confirmPassword;

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 5 ? [...prev, tag] : prev
    );
  };

  const handleStep1 = (e) => {
    e.preventDefault();
    if (pwScore < 4) { showToast('Password must be Strong (8+ chars, uppercase, number, special)', 'error'); return; }
    if (password !== confirmPassword) { showToast('Passwords do not match', 'error'); return; }
    setStep(1);
  };

  const handleStep2 = (e) => {
    e.preventDefault();
    if (!displayName.trim()) { showToast('Enter a display name', 'error'); return; }
    if (!age || parseInt(age) < 18) { showToast('Must be 18 or older', 'error'); return; }
    if (!gender) { showToast('Select your gender', 'error'); return; }
    setStep(2);
  };

  const handleCreate = async () => {
    if (selectedTags.length < 3) { showToast('Pick at least 3 vibe tags', 'error'); return; }
    setLoading(true);
    try {
      const cred = await registerUser(email, password);
      // Write full profile synchronously before navigating
      await createUserProfile(cred.user.uid, {
        email: email.trim().toLowerCase(),
        displayName: displayName.trim(),
        age: parseInt(age),
        gender,
        vibeTags: selectedTags,
      });
      navigate('/verify-email', { replace: true });
    } catch (err) {
      setLoading(false);
      const msg = err.code === 'auth/email-already-in-use'
        ? 'Email already in use'
        : 'Registration failed. Try again.';
      showToast(msg, 'error');
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)', padding: '0 24px', overflowY: 'auto' }}>
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <ThemeToggle />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 52, paddingBottom: 24, gap: 16 }}>
        <Logo variant="icon" size={44} />
        <StepIndicator current={step} total={3} />
      </div>

      {step === 0 && (
        <form onSubmit={handleStep1} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Create your account</h3>

          <div className="input-group">
            <label className="input-label">Email</label>
            <input className="input-field" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>

          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input-field" type="password" placeholder="Min. 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            <PasswordStrengthBar password={password} />
            {password && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                {[
                  { key: 'length',    label: '8+ characters' },
                  { key: 'uppercase', label: 'Uppercase letter' },
                  { key: 'number',    label: 'Number' },
                  { key: 'special',   label: 'Special character (!@#$%^&*)' },
                ].map(({ key, label }) => (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: pwStrength[key] ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                    <i className={`ti ${pwStrength[key] ? 'ti-circle-check' : 'ti-circle-x'}`} style={{ fontSize: 13 }} />
                    {label}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">Confirm Password</label>
            <input
              className="input-field"
              type="password"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              style={pwMismatch ? { borderColor: 'var(--color-danger)' } : {}}
            />
            {pwMismatch && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>Passwords do not match</span>}
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={!email || pwScore < 4 || !!pwMismatch} style={{ marginTop: 4 }}>
            Continue
          </button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={handleStep2} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h3 style={{ marginBottom: 4 }}>Your identity</h3>
          <div className="input-group">
            <label className="input-label">Display name</label>
            <input className="input-field" type="text" placeholder="What shows on the map" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={24} />
          </div>
          <div className="input-group">
            <label className="input-label">Age</label>
            <input className="input-field" type="number" placeholder="Your age" value={age} onChange={(e) => setAge(e.target.value)} min={18} max={100} required />
          </div>
          <div className="input-group">
            <label className="input-label">Gender</label>
            <div className="gender-pills">
              {['male', 'female', 'other'].map((g) => (
                <button key={g} type="button" className={`gender-pill${gender === g ? ` selected-${g}` : ''}`} onClick={() => setGender(g)}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(0)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} type="submit" disabled={!displayName || !age || !gender}>Continue</button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <h3 style={{ marginBottom: 4 }}>Your vibe</h3>
            <p className="caption">Pick 3–5 tags that describe you ({selectedTags.length}/5 selected)</p>
          </div>
          <div className="vibe-grid">
            {VIBE_TAGS.map((tag) => (
              <VibeTagChip key={tag} label={tag} selected={selectedTags.includes(tag)} selectable onClick={() => toggleTag(tag)} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreate} disabled={selectedTags.length < 3 || loading}>
              {loading ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Create Account'}
            </button>
          </div>
        </div>
      )}

      <p style={{ textAlign: 'center', marginTop: 20, marginBottom: 24, color: 'var(--color-text-secondary)', fontSize: 15 }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
      </p>
    </div>
  );
}
