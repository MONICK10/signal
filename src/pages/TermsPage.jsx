import { useNavigate } from 'react-router-dom';

const SECTIONS = [
  {
    title: '1. What Cuelyn Is',
    body: `Cuelyn is a proximity-based connection app. It helps you discover and break the ice with real people nearby — for conversations, collaborations, hangouts, or anything wholesome.\n\nCuelyn is NOT a dating app. It is NOT a platform for romantic solicitation, harassment, or any kind of inappropriate behavior.`,
  },
  {
    title: '2. Who Can Use Cuelyn',
    body: `You must be 18 years or older to use Cuelyn.\n\nBy signing up, you confirm that you are at least 18 years old. If we find out you're underage, your account will be permanently deleted immediately.`,
  },
  {
    title: '3. What Cuelyn Is Not For',
    body: `Cuelyn is strictly not for:\n• Sending unwanted romantic or sexual messages\n• Harassment of any kind\n• Stalking or tracking someone without their consent\n• Sharing someone else's location or personal information without permission\n• Impersonating another person\n• Any illegal activity\n\nIf you use Cuelyn for any of the above, your account will be actioned immediately.`,
  },
  {
    title: '4. What Happens If You Violate These Terms',
    body: `We take misuse seriously. Here's how we handle it:\n\nFirst violation — You will receive a formal warning. Your account may be temporarily restricted.\n\nSecond violation — Your account will be banned for 30 days.\n\nExtreme cases — If your behavior involves threats, violence, sexual harassment, or any criminal activity, we will report you to the relevant authorities without hesitation. No warnings. No second chances.\n\nWe want Cuelyn to feel safe for everyone. One bad actor ruins it for thousands of good people. We won't allow that.`,
  },
  {
    title: '5. Your Safety Is Your Responsibility Too',
    body: `Cuelyn shows your approximate location — never your exact position. But please use common sense:\n\n• Meet people in public places first\n• Don't share your personal contact details too early\n• Trust your instincts — if something feels wrong, block and report immediately\n• Tell someone you trust when you're meeting someone new\n\nYour safety matters more than any connection this app can create.`,
  },
  {
    title: '6. What Data We Collect',
    body: `To make Cuelyn work, we collect:\n• Your name and username\n• Your date of birth (to verify you are 18+)\n• Your profile photo and cover photo\n• Your approximate location (when you are Open)\n• Your bio and vibe tags\n• Your chat messages\n• Your signal history (sent and received)\n\nWe collect this data only to make the app work for you. We do not sell your data to anyone. Ever.`,
  },
  {
    title: '7. Your Data and Privacy',
    body: `• Your exact location is never shown to anyone\n• You are only visible to people nearby when you choose to be Open\n• When you are in ghost mode, you are completely invisible\n• You can delete your account anytime and all your data will be permanently removed within 30 days`,
  },
  {
    title: '8. Block and Report',
    body: `If someone makes you uncomfortable:\n• Block them instantly — they won't know you blocked them\n• Report them — we will review every report seriously\n• You can report anonymously\n\nWe review every report. We do not ignore them.`,
  },
  {
    title: '9. Changes to These Terms',
    body: `We may update these terms as Cuelyn grows. If we make big changes, we'll notify you inside the app. Continuing to use Cuelyn after changes means you accept the new terms.`,
  },
  {
    title: '10. Contact',
    body: `Have a question or concern? Reach out to us at:\nmonicks@karunya.edu.in\n\nWe're real people. We'll respond.`,
  },
];

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="page" style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.9)', fontSize: 22, padding: 0 }}
          >
            <i className="ti ti-arrow-left" />
          </button>
          <h2 style={{ color: '#fff' }}>Terms of Service</h2>
        </div>
      </div>

      {/* Last updated */}
      <div style={{ padding: '16px 20px 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
        Last updated: June 2026
      </div>

      {/* Intro */}
      <div style={{ padding: '12px 20px 20px', background: 'var(--color-surface-2)', margin: '12px 20px', borderRadius: 14, border: '1px solid var(--color-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <i className="ti ti-file-description" style={{ fontSize: 20, color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>Hey, welcome to Cuelyn.</span>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
          Before you start, please read this carefully. It's written simply so you actually understand what you're agreeing to.
        </p>
      </div>

      {/* Sections */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {SECTIONS.map((s) => (
          <div key={s.title}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)', marginBottom: 8 }}>
              {s.title}
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.75, whiteSpace: 'pre-line' }}>
              {s.body}
            </div>
          </div>
        ))}

        {/* Footer agreement note */}
        <div style={{ marginTop: 8, padding: '16px', background: 'var(--color-surface)', borderRadius: 14, border: '1px solid var(--color-border)', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
            By signing up for Cuelyn, you confirm that you have read, understood, and agreed to these terms.
          </p>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)', marginTop: 8, marginBottom: 0 }}>
            Be curious. Be kind. Be real.
          </p>
        </div>
      </div>
    </div>
  );
}
