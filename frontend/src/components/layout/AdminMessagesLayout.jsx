import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Menu, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMessageUnread } from '@/context/MessageUnreadContext';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import styles from '@/styles/sellerPortal.module.scss';

/**
 * Shell for /messages when logged in as admin (seller portal removed; admin handles store chat).
 */
export default function AdminMessagesLayout({ children }) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { unreadCount } = useMessageUnread();
  useProtectedRoute('admin');

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
        aria-label="Admin navigation"
      >
        <div className={styles.brand}>
          <span className={styles.logo}>urbanNxt</span>
          <span className={styles.portalLabel}>Admin</span>
        </div>
        <nav className={styles.nav}>
          <Link
            href="/dashboard/admin"
            className={`${styles.navItem} ${router.pathname === '/dashboard/admin' ? styles.active : ''}`}
            onClick={closeMobile}
          >
            <span className={styles.navIcon}>▦</span>
            Dashboard
          </Link>
          <Link
            href="/messages"
            className={`${styles.navItem} ${router.pathname === '/messages' ? styles.active : ''}`}
            onClick={closeMobile}
          >
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
          <div className={styles.userProfile} style={{ cursor: 'default' }}>
            <div className={styles.avatar}>{user.name?.charAt(0)?.toUpperCase() || 'A'}</div>
            <div className={styles.userMeta}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.storeName}>Administrator</span>
            </div>
          </div>
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
          <Link href="/dashboard/admin" className={styles.sellerMobileBrand} onClick={closeMobile}>
            urbanNxt Admin
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}
