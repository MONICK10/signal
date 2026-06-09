import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ToastProvider, useToast } from './components/Toast';
import BottomNav from './components/BottomNav';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useSignals } from './hooks/useSignals';
import { usePushNotifications } from './hooks/usePushNotifications';
import { subscribeSentSignals, subscribeFriendRequests } from './firebase/firestore';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import FeedPage from './pages/FeedPage';
import MapPage from './pages/MapPage';
import SignalsPage from './pages/SignalsPage';
import MatchesPage from './pages/MatchesPage';
import ProfilePage from './pages/ProfilePage';
import CreatePostPage from './pages/CreatePostPage';
import ChatPage from './pages/ChatPage';
import FriendsPage from './pages/FriendsPage';
import FriendChatPage from './pages/FriendChatPage';
import SignalHistoryPage from './pages/SignalHistoryPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LeaderboardPage from './pages/LeaderboardPage';
import UserProfilePage from './pages/UserProfilePage';
import SettingsPage from './pages/SettingsPage';
import BlockedUsersPage from './pages/BlockedUsersPage';
import OnboardingPage from './pages/OnboardingPage';
import EditProfilePage from './pages/EditProfilePage';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkBanner from './components/NetworkBanner';

const AUTH_PAGES = ['/splash', '/login', '/signup', '/verify-email'];
const NO_NAV_PAGES = [...AUTH_PAGES, '/create-post', '/chat/', '/messages/', '/onboarding', '/settings', '/edit-profile'];

function AuthGuard({ children, user, loading }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/splash', { replace: true }); return; }
    if (!user.emailVerified) { navigate('/verify-email', { replace: true }); return; }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }
  if (!user || !user.emailVerified) return null;
  return children;
}

function AppShellInner() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const showToast = useToast();
  const { signals } = useSignals(user?.uid);
  const { requestPermission, onForegroundMessage } = usePushNotifications();
  useTheme();

  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [userCoords, setUserCoords] = useState(null);
  const navigatedChats = useRef(new Set());

  // Request push notification permission after login
  useEffect(() => {
    if (user?.uid && user.emailVerified) {
      requestPermission(user.uid);
    }
  }, [user?.uid]);

  // Handle foreground push messages
  useEffect(() => {
    return onForegroundMessage((payload) => {
      const { title, body } = payload.notification || {};
      if (title) showToast(`${title}: ${body || ''}`, 'info');
    });
  }, []);

  // Watch GPS position at app level (shared with leaderboard)
  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Sender auto-navigate when signal is accepted
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeSentSignals(user.uid, (sentSignals) => {
      sentSignals.forEach((sig) => {
        if (sig.status === 'accepted' && sig.chatId && !navigatedChats.current.has(sig.chatId)) {
          if (!location.pathname.startsWith('/chat/')) {
            navigatedChats.current.add(sig.chatId);
            navigate(`/chat/${sig.chatId}`);
          }
        }
      });
    });
  }, [user?.uid]);

  // Friend request badge
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeFriendRequests(user.uid, (reqs) => setFriendRequestCount(reqs.length));
  }, [user?.uid]);

  const isNoNav = NO_NAV_PAGES.some((p) => location.pathname.startsWith(p));
  const showNav = !isNoNav && !!user && user.emailVerified;
  const unreadSignals = signals.filter((s) => s.status === 'pending').length;
  const isOnboardingDone = localStorage.getItem('signal_onboarding_complete') === 'true';
  const defaultRoute = !user ? '/splash' : !user.emailVerified ? '/verify-email' : !isOnboardingDone ? '/onboarding' : '/feed';

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/splash" element={<Splash />} />
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route path="/feed" element={
          <AuthGuard user={user} loading={loading}><FeedPage user={user} profile={profile} /></AuthGuard>
        } />
        <Route path="/create-post" element={
          <AuthGuard user={user} loading={loading}><CreatePostPage user={user} profile={profile} /></AuthGuard>
        } />
        <Route path="/map" element={
          <AuthGuard user={user} loading={loading}><ErrorBoundary><MapPage user={user} profile={profile} /></ErrorBoundary></AuthGuard>
        } />
        <Route path="/signals" element={
          <AuthGuard user={user} loading={loading}><SignalsPage user={user} /></AuthGuard>
        } />
        <Route path="/matches" element={
          <AuthGuard user={user} loading={loading}><MatchesPage user={user} /></AuthGuard>
        } />
        <Route path="/profile" element={
          <AuthGuard user={user} loading={loading}><ProfilePage user={user} profile={profile} refreshProfile={refreshProfile} /></AuthGuard>
        } />
        <Route path="/friends" element={
          <AuthGuard user={user} loading={loading}><FriendsPage user={user} /></AuthGuard>
        } />
        <Route path="/chat/:chatId" element={
          <AuthGuard user={user} loading={loading}><ChatPage user={user} profile={profile} /></AuthGuard>
        } />
        <Route path="/messages/:chatId" element={
          <AuthGuard user={user} loading={loading}><FriendChatPage user={user} /></AuthGuard>
        } />
        <Route path="/signal-history" element={
          <AuthGuard user={user} loading={loading}><SignalHistoryPage user={user} /></AuthGuard>
        } />
        <Route path="/analytics" element={
          <AuthGuard user={user} loading={loading}><AnalyticsPage user={user} /></AuthGuard>
        } />
        <Route path="/leaderboard" element={
          <AuthGuard user={user} loading={loading}><LeaderboardPage user={user} userCoords={userCoords} profile={profile} /></AuthGuard>
        } />
        <Route path="/profile/:uid" element={
          <AuthGuard user={user} loading={loading}><UserProfilePage user={user} profile={profile} /></AuthGuard>
        } />
        <Route path="/settings" element={
          <AuthGuard user={user} loading={loading}><SettingsPage user={user} profile={profile} refreshProfile={refreshProfile} /></AuthGuard>
        } />
        <Route path="/settings/blocked" element={
          <AuthGuard user={user} loading={loading}><BlockedUsersPage user={user} /></AuthGuard>
        } />
        <Route path="/onboarding" element={
          <AuthGuard user={user} loading={loading}><OnboardingPage user={user} /></AuthGuard>
        } />
        <Route path="/edit-profile" element={
          <AuthGuard user={user} loading={loading}><EditProfilePage user={user} profile={profile} refreshProfile={refreshProfile} /></AuthGuard>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showNav && (
        <BottomNav unreadSignals={unreadSignals} unreadFriendRequests={friendRequestCount} />
      )}
      <InstallPrompt />
      <NetworkBanner />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AppShellInner />
      </ToastProvider>
    </ErrorBoundary>
  );
}
