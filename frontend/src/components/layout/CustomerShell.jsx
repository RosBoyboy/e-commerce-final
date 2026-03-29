import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import {
  LayoutGrid,
  Package,
  Heart,
  User,
  MessageCircle,
  LogOut,
  Menu,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMessageUnread } from '@/context/MessageUnreadContext';
import styles from '@/styles/dashboard.module.scss';

const NAV = [
  { key: 'overview', label: 'Overview', href: '/dashboard/customer', icon: LayoutGrid },
  { key: 'orders', label: 'Orders', href: '/dashboard/customer?tab=orders', icon: Package },
  { key: 'wishlist', label: 'Wishlist', href: '/dashboard/customer?tab=wishlist', icon: Heart },
  { key: 'profile', label: 'Profile', href: '/dashboard/customer?tab=profile', icon: User },
  { key: 'messages', label: 'Messages', href: '/messages', icon: MessageCircle },
];

export default function CustomerShell({ activeKey, children, sidebarExtra }) {
  const router = useRouter();
  const { logout } = useAuth();
  const { unreadCount } = useMessageUnread();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <div className={styles.customerApp}>
      <button
        type="button"
        className={`${styles.customerSidebarBackdrop} ${mobileNavOpen ? styles.customerSidebarBackdropVisible : ''}`}
        aria-label="Close menu"
        onClick={() => setMobileNavOpen(false)}
      />
      <aside
        className={`${styles.customerSidebarFixed} ${mobileNavOpen ? styles.customerSidebarOpen : ''}`}
      >
        <Link href="/" className={styles.customerSidebarBrand} onClick={() => setMobileNavOpen(false)}>
          <span className={styles.customerSidebarBrandN}>N</span>
          <span>urbanNxt</span>
        </Link>
        <nav className={styles.customerNav} aria-label="Account">
          {NAV.map(({ key, label, href, icon: Icon }) => (
            <Link
              key={key}
              href={href}
              className={`${styles.customerNavItem} ${activeKey === key ? styles.customerNavItemActive : ''}`}
              onClick={() => setMobileNavOpen(false)}
            >
              {key === 'messages' ? (
                <span className={styles.customerNavIconWrap}>
                  <Icon size={20} strokeWidth={1.35} aria-hidden />
                  {unreadCount > 0 && (
                    <span className={styles.customerNavMsgBadge} aria-label={`${unreadCount} unread messages`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
              ) : (
                <Icon size={20} strokeWidth={1.35} aria-hidden />
              )}
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        {sidebarExtra ? (
          <div className={styles.customerSidebarScroll}>{sidebarExtra}</div>
        ) : null}
        <div className={styles.customerSidebarFooter}>
          <button type="button" className={styles.customerLogoutBtn} onClick={handleLogout}>
            <LogOut size={20} strokeWidth={1.35} aria-hidden />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      <div className={styles.customerMain}>
        <header className={styles.customerMobileBar}>
          <button
            type="button"
            className={styles.customerMenuBtn}
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={1.35} />
          </button>
          <Link href="/" className={styles.customerMobileBrand} onClick={() => setMobileNavOpen(false)}>
            urbanNxt
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
