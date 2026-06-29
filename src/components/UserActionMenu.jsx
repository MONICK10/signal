import { useState } from 'react';
import BottomSheet from './BottomSheet';
import { useToast } from './Toast';
import { blockUser, reportUser } from '../firebase/firestore';

const REPORT_REASONS = [
  'Harassment',
  'Inappropriate content',
  'Fake profile',
  'Spam',
  'Underage user',
  'Other',
];

export default function UserActionMenu({ myUid, targetUid, targetName, onBlock, children }) {
  const showToast = useToast();
  const [open, setOpen] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportStep, setReportStep] = useState(1);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBlock = async () => {
    setSubmitting(true);
    try {
      await blockUser(myUid, targetUid);
      showToast('User blocked');
      setShowBlockConfirm(false);
      if (onBlock) onBlock();
    } catch { showToast('Failed to block user', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleReport = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await reportUser(myUid, targetUid, reason, details);
      showToast('Report submitted. Thank you.');
      setShowReport(false);
      setReason(''); setDetails(''); setReportStep(1);
    } catch { showToast('Failed to submit report', 'error'); }
    finally { setSubmitting(false); }
  };

  const resetReport = () => { setShowReport(false); setReason(''); setDetails(''); setReportStep(1); };

  return (
    <>
      {/* Trigger — renders children or a default dots button */}
      <div onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
        {children || (
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 4, display: 'flex', alignItems: 'center' }}>
            <i className="ti ti-dots-vertical" style={{ fontSize: 20 }} />
          </button>
        )}
      </div>

      {/* Action menu */}
      {open && (
        <BottomSheet onClose={() => setOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              onClick={() => { setOpen(false); setShowReport(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: 15, borderRadius: 12, width: '100%', textAlign: 'left' }}
            >
              <i className="ti ti-flag" style={{ fontSize: 20, color: 'var(--color-text-secondary)' }} />
              Report {targetName}
            </button>
            <button
              onClick={() => { setOpen(false); setShowBlockConfirm(true); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: 15, borderRadius: 12, width: '100%', textAlign: 'left' }}
            >
              <i className="ti ti-ban" style={{ fontSize: 20 }} />
              Block {targetName}
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Block confirm */}
      {showBlockConfirm && (
        <BottomSheet onClose={() => setShowBlockConfirm(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <h3>Block {targetName}?</h3>
              <p className="caption" style={{ marginTop: 6 }}>They won't be able to signal you or appear on your map.</p>
            </div>
            <button onClick={handleBlock} disabled={submitting} style={{ padding: '14px', background: 'var(--color-danger)', color: '#fff', border: 'none', borderRadius: 14, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
              {submitting ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Block'}
            </button>
            <button onClick={() => setShowBlockConfirm(false)} style={{ padding: '14px', background: 'none', border: 'none', color: 'var(--color-text-secondary)', fontSize: 15, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Report flow */}
      {showReport && (
        <BottomSheet onClose={resetReport}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reportStep === 1 && (
              <>
                <h3>Why are you reporting this account?</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r}
                      onClick={() => { setReason(r); if (r !== 'Other') setReportStep(2); else setReportStep(2); }}
                      style={{ padding: '12px 16px', background: reason === r ? 'rgba(225,29,72,0.10)' : 'var(--color-surface)', border: `1.5px solid ${reason === r ? 'var(--color-primary)' : 'var(--color-border)'}`, borderRadius: 12, cursor: 'pointer', textAlign: 'left', fontWeight: reason === r ? 600 : 400, color: 'var(--color-text-primary)', fontSize: 14 }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <button onClick={() => reason && setReportStep(2)} disabled={!reason} className="btn btn-primary btn-full">Next</button>
              </>
            )}
            {reportStep === 2 && (
              <>
                <div>
                  <h3>Any additional details?</h3>
                  <p className="caption" style={{ marginTop: 4 }}>Reason: {reason}</p>
                </div>
                {reason === 'Other' && (
                  <div className="input-group">
                    <textarea
                      className="input-field"
                      style={{ minHeight: 90, resize: 'none' }}
                      placeholder="Tell us what happened…"
                      value={details}
                      onChange={(e) => setDetails(e.target.value.slice(0, 200))}
                      maxLength={200}
                    />
                    <span className="caption" style={{ textAlign: 'right' }}>{details.length}/200</span>
                  </div>
                )}
                <button onClick={handleReport} disabled={submitting || (reason === 'Other' && !details.trim())} className="btn btn-primary btn-full">
                  {submitting ? <span className="spinner" style={{ width: 18, height: 18 }} /> : 'Submit Report'}
                </button>
                <button onClick={() => setReportStep(1)} style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 14 }}>Back</button>
              </>
            )}
          </div>
        </BottomSheet>
      )}
    </>
  );
}
