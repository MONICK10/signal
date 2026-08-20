import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import SignalCard from '../components/SignalCard';
import EmptyState from '../components/EmptyState';
import { useToast } from '../components/Toast';
import { useSignals } from '../hooks/useSignals';
import { acceptSignal, declineSignal } from '../lib/db';

export default function SignalsPage({ user }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const { signals, loading } = useSignals(user?.uid);

  const handleAccept = async (signalId, fromUid) => {
    try {
      const chatId = await acceptSignal(signalId, user.uid, fromUid);
      navigate(`/chat/${chatId}`);
    } catch {
      showToast('Something went wrong', 'error');
    }
  };

  const handleDecline = async (signalId) => {
    try {
      await declineSignal(signalId);
      showToast('Signal declined');
    } catch {
      showToast('Something went wrong', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Signals</h2>
        <ThemeToggle />
      </div>

      <div className="page-content">
        {loading && (
          <>{[1, 2, 3].map((i) => <div key={i} className="skeleton" style={{ height: 120, borderRadius: 16 }} />)}</>
        )}

        {!loading && signals.length === 0 && (
          <EmptyState
            icon="ti-radar"
            title="No signals yet"
            subtitle={"Go visible on the map\nand let people discover you"}
            actionLabel="Go Visible"
            onAction={() => navigate('/map')}
          />
        )}

        {!loading && signals.map((signal) => (
          <SignalCard
            key={signal.id}
            signal={signal}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        ))}
      </div>
    </div>
  );
}
