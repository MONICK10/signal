import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/feed',    label: 'Nearby',  icon: 'ti-map-pin' },
  { to: '/map',     label: 'Map',     icon: 'ti-map-2' },
  { to: '/friends', label: 'Chats',   icon: 'ti-messages', friendBadge: true },
  { to: '/profile', label: 'Me',      icon: 'ti-user' },
];

export default function BottomNav({ unreadFriendRequests = 0 }) {
  return (
    <nav className="bottom-nav">
      {tabs.map(({ to, label, icon, friendBadge }) => {
        const badgeCount = friendBadge ? unreadFriendRequests : 0;
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
