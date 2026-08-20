import { useEffect, useRef, useState, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ToastProvider, useToast } from './components/Toast';
import BottomNav from './components/BottomNav';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { usePushNotifications } from './hooks/usePushNotifications';
import { subscribeSentSignals, subscribeFriendRequests, subscribeReceivedSignals, subscribeFriends, getLocation, subscribeNotifications } from './lib/db';
import { getDistanceKm } from './utils/distance';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyEmail from './pages/VerifyEmail';
import MapPage from './pages/MapPage';
import SignalsPage from './pages/SignalsPage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';
import FriendsPage from './pages/FriendsPage';
import FriendChatPage from './pages/FriendChatPage';
import SignalHistoryPage from './pages/SignalHistoryPage';
import UserProfilePage from './pages/UserProfilePage';
import SettingsPage from './pages/SettingsPage';
import BlockedUsersPage from './pages/BlockedUsersPage';
import OnboardingPage from './pages/OnboardingPage';
import EditProfilePage from './pages/EditProfilePage';
import FollowersPage from './pages/FollowersPage';
import FollowingPage from './pages/FollowingPage';
import TermsPage from './pages/TermsPage';
import NotificationsPage from './pages/NotificationsPage';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkBanner from './components/NetworkBanner';

const AUTH_PAGES = ['/splash', '/login', '/signup', '/verify-email'];
const NO_NAV_PAGES = [...AUTH_PAGES, '/chat/', '/messages/', '/onboarding', '/settings', '/edit-profile', '/followers/', '/following/', '/terms'];

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

const DAILY_TIPS = [
  "💡 You can only send one signal per hour. Make it meaningful.",
  "💡 Ghost mode is your superpower. Use it whenever you need a break.",
  "💡 Anonymous signals keep you safe while you explore. Try it.",
  "💡 The 5 minute chat is your window. Be yourself in it.",
  "💡 Cuelyn is not about romance. It's about real human curiosity.",
  "💡 Reveal yourself only when you feel ready. There's no pressure.",
  "💡 Your exact location is never shared. You are always safe here.",
  "💡 See someone interesting nearby? Don't overthink it. Signal them.",
];

function AppShellInner() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const showToast = useToast();
  const { requestPermission, onForegroundMessage } = usePushNotifications();
  useTheme();

  const [friendRequestCount, setFriendRequestCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const navigatedChats = useRef(new Set());
  const profileRef = useRef(profile);
  useEffect(() => { profileRef.current = profile; }, [profile]);

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


  // Sender auto-navigate + notification when signal is accepted
  useEffect(() => {
    if (!user?.uid) return;
    let initialized = false;
    return subscribeSentSignals(user.uid, (sentSignals) => {
      if (!initialized) {
        sentSignals.forEach((s) => {
          if (s.status === 'accepted' && s.chatId) navigatedChats.current.add(s.chatId);
        });
        initialized = true;
        return;
      }
      sentSignals.forEach((sig) => {
        if (sig.status === 'accepted' && sig.chatId && !navigatedChats.current.has(sig.chatId)) {
          navigatedChats.current.add(sig.chatId);
          if (!location.pathname.startsWith('/chat/')) {
            navigate(`/chat/${sig.chatId}`);
          }
          const prefs = profileRef.current?.notificationPrefs || {};
          if (prefs.signalAccepted !== false) {
            const name = sig.toDisplayName;
            const msg = name ? `${name} accepted your Signal ✅` : 'Someone accepted your Signal ✅';
            showToast(msg, 'success');
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

  // Notification unread badge
  useEffect(() => {
    if (!user?.uid) return;
    return subscribeNotifications(user.uid, (notifs) => {
      setUnreadNotifCount(notifs.filter((n) => !n.read).length);
    });
  }, [user?.uid]);

  // In-app notification when a new signal is received
  useEffect(() => {
    if (!user?.uid) return;
    const seen = new Set();
    let initialized = false;
    return subscribeReceivedSignals(user.uid, (sigs) => {
      if (!initialized) {
        sigs.forEach((s) => seen.add(s.id));
        initialized = true;
        return;
      }
      const prefs = profileRef.current?.notificationPrefs || {};
      if (prefs.signalReceived === false) return;
      sigs.forEach((s) => {
        if (!seen.has(s.id)) {
          seen.add(s.id);
          const name = s.anonymous ? null : s.fromDisplayName;
          const msg = name ? `${name} sent you a Signal 👀` : 'Someone sent you a Signal 👀';
          showToast(msg, 'info');
          if (Notification.permission === 'granted') {
            try { new Notification('Cuelyn', { body: msg }); } catch {}
          }
        }
      });
    });
  }, [user?.uid]);

  // Friend nearby alert — polls every 60s when both are Open
  useEffect(() => {
    if (!user?.uid) return;
    let friendsList = [];
    const unsubFriends = subscribeFriends(user.uid, (list) => { friendsList = list; });

    const checkNearby = async () => {
      const prefs = profileRef.current?.notificationPrefs || {};
      if (prefs.friendNearbyAlert === false || friendsList.length === 0) return;

      const myLoc = await getLocation(user.uid).catch(() => null);
      if (!myLoc) return;
      const myExp = myLoc.expiresAt?.toDate?.() ?? (myLoc.expiresAt instanceof Date ? myLoc.expiresAt : null);
      if (!myExp || myExp < new Date()) return;

      for (const friend of friendsList) {
        const key = `sig_friend_alert_${[user.uid, friend.uid].sort().join('_')}`;
        if (Date.now() - parseInt(localStorage.getItem(key) || '0') < 3600000) continue;

        const fLoc = await getLocation(friend.uid).catch(() => null);
        if (!fLoc) continue;
        const fExp = fLoc.expiresAt?.toDate?.() ?? (fLoc.expiresAt instanceof Date ? fLoc.expiresAt : null);
        if (!fExp || fExp < new Date()) continue;

        const dist = getDistanceKm(myLoc.lat, myLoc.lng, fLoc.lat, fLoc.lng);
        if (dist <= 0.15) {
          localStorage.setItem(key, Date.now().toString());
          const msg = `Your friend ${friend.displayName} is nearby 👋`;
          showToast(msg, 'success');
          if (Notification.permission === 'granted') {
            try { new Notification('Cuelyn', { body: `Your friend ${friend.displayName} is nearby — just 20m away 👋` }); } catch {}
          }
        }
      }
    };

    const interval = setInterval(checkNearby, 60000);
    return () => { unsubFriends(); clearInterval(interval); };
  }, [user?.uid]);

  // Daily reminders + random tips (checked every minute)
  useEffect(() => {
    if (!user?.uid) return;

    const check = () => {
      if (!profileRef.current) return;
      const prefs = profileRef.current.notificationPrefs || {};
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = now.toISOString().split('T')[0];

      const fire = (msg, title = 'Cuelyn') => {
        showToast(msg, 'info');
        if (Notification.permission === 'granted') try { new Notification(title, { body: msg }); } catch {}
      };

      if (prefs.dailyOpenReminder !== false) {
        const t = prefs.dailyOpenReminderTime || '09:00';
        const k = `sig_open_${today}`;
        if (hhmm >= t && !localStorage.getItem(k)) {
          localStorage.setItem(k, '1');
          fire("Good morning! Go Open and see who's around you today 🟢");
        }
      }

      if (prefs.dailyCloseReminder !== false) {
        const t = prefs.dailyCloseReminderTime || '21:00';
        const k = `sig_close_${today}`;
        if (hhmm >= t && !localStorage.getItem(k)) {
          localStorage.setItem(k, '1');
          fire("Time to wind down. Don't forget to go Closed 🔴");
        }
      }

      const lastTip = parseInt(localStorage.getItem('sig_tip_ts') || '0');
      const h = now.getHours();
      if (Date.now() - lastTip > 3 * 86400000 && h >= 10 && h < 18) {
        const prev = parseInt(localStorage.getItem('sig_tip_i') || '-1');
        let i;
        do { i = Math.floor(Math.random() * DAILY_TIPS.length); } while (i === prev && DAILY_TIPS.length > 1);
        localStorage.setItem('sig_tip_ts', Date.now().toString());
        localStorage.setItem('sig_tip_i', i.toString());
        fire(DAILY_TIPS[i], 'Cuelyn Tip');
      }
    };

    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, [user?.uid]);

  const isNoNav = NO_NAV_PAGES.some((p) => location.pathname.startsWith(p));
  const showNav = !isNoNav && !!user && user.emailVerified;
  const isOnboardingDone = localStorage.getItem('cuelyn_onboarding_complete') === 'true' || profile?.onboardingComplete === true;
  const defaultRoute = !user ? '/splash' : !user.emailVerified ? '/verify-email' : !isOnboardingDone ? '/onboarding' : '/map';

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route path="/splash" element={<Splash />} />
        <Route path="/login"  element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route path="/map" element={
          <AuthGuard user={user} loading={loading}><ErrorBoundary><MapPage user={user} profile={profile} unreadNotifCount={unreadNotifCount} /></ErrorBoundary></AuthGuard>
        } />
        <Route path="/signals" element={
          <AuthGuard user={user} loading={loading}><SignalsPage user={user} /></AuthGuard>
        } />
        <Route path="/profile" element={
          <AuthGuard user={user} loading={loading}><ProfilePage user={user} profile={profile} refreshProfile={refreshProfile} /></AuthGuard>
        } />
        <Route path="/friends" element={
          <AuthGuard user={user} loading={loading}><FriendsPage user={user} profile={profile} /></AuthGuard>
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
        <Route path="/followers/:uid" element={
          <AuthGuard user={user} loading={loading}><FollowersPage user={user} /></AuthGuard>
        } />
        <Route path="/following/:uid" element={
          <AuthGuard user={user} loading={loading}><FollowingPage user={user} /></AuthGuard>
        } />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/notifications" element={
          <AuthGuard user={user} loading={loading}><NotificationsPage user={user} /></AuthGuard>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {showNav && (
        <BottomNav unreadFriendRequests={friendRequestCount} />
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
