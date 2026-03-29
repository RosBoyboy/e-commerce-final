import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Menu, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMessageUnread } from '@/context/MessageUnreadContext';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import styles from '@/styles/sellerPortal.module.scss';

const navItems = [
  { href: '/dashboard/seller', label: 'Dashboard', icon: '▦' },
  { href: '/dashboard/seller/inventory', label: 'My Inventory', icon: '▤' },
  { href: '/dashboard/seller/orders', label: 'Manage Orders', icon: '🛒' },
  { href: '/dashboard/seller/analytics', label: 'Analytics', icon: '▥' },
  { href: '/dashboard/seller/payouts', label: 'Payouts', icon: '₱' },
];

export default function SellerLayout({ children }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useMessageUnread();
  useProtectedRoute('seller');

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  if (!user) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className={styles.portal}>
      <button
        type="button"
        className={`${styles.sellerSidebarBackdrop} ${mobileOpen ? styles.sellerSidebarBackdropVisible : ''}`}
        aria-label="Close menu"
        onClick={closeMobile}
      />
      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}
        aria-label="Seller navigation"
      >
        <div className={styles.brand}>
          <span className={styles.logo}>urbanNxt</span>
          <span className={styles.portalLabel}>Seller Portal</span>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item) => {
            const isActive = item.href === '/dashboard/seller'
              ? router.pathname === '/dashboard/seller'
              : router.pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                onClick={closeMobile}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <Link href="/messages" className={styles.navItem} onClick={closeMobile}>
            <span className={styles.navMessagesIconWrap}>
              <MessageCircle size={20} strokeWidth={1.5} className={styles.navMessagesLucide} aria-hidden />
              {unreadCount > 0 && (
                <span className={styles.navMessagesIconBadge} aria-label={`${unreadCount} unread messages`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </span>
            Messages
          </Link>
        </nav>
        <div className={styles.sidebarFooter}>
          <Link
            href="/dashboard/seller/settings"
            className={styles.userProfile}
            aria-label="Open store settings"
            onClick={closeMobile}
          >
            <div className={styles.avatar}>{user.name?.charAt(0)?.toUpperCase() || 'S'}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.storeName}>Urban Store • Settings</span>
            </div>
          </Link>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.sellerMobileBar}>
          <button
            type="button"
            className={styles.sellerMenuBtn}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={1.35} aria-hidden />
          </button>
          <Link href="/dashboard/seller" className={styles.sellerMobileBrand} onClick={closeMobile}>
            urbanNxt Seller
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}
