import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/feed',    label: 'Feed',    icon: 'ti-home' },
  { to: '/map',     label: 'Map',     icon: 'ti-map-2' },
  { to: '/signals', label: 'Signals', icon: 'ti-bell',    signalBadge: true },
  { to: '/friends', label: 'Friends', icon: 'ti-users',   friendBadge: true },
  { to: '/profile', label: 'Profile', icon: 'ti-user' },
];

export default function BottomNav({ unreadSignals = 0, unreadFriendRequests = 0 }) {
  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, label, icon, signalBadge, friendBadge }) => {
        const badgeCount = signalBadge ? unreadSignals : friendBadge ? unreadFriendRequests : 0;
        return (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `bottom-nav__item${isActive ? ' active' : ''}`}
          >
            <span className="bottom-nav__icon">
              <i className={`ti ${icon}`} style={{ fontSize: 22 }} />
              {badgeCount > 0 && (
                <span className="badge nav-badge">{badgeCount > 9 ? '9+' : badgeCount}</span>
              )}
            </span>
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
