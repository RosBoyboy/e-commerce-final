import Link from 'next/link';
import { useRouter } from 'next/router';
import { ClipboardList, LogOut, User, Wallet } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from '@/styles/riderPortal.module.scss';

const SIDENAV = [
  { key: 'tasks', label: 'Tracking', href: '/dashboard/rider', icon: ClipboardList },
  { key: 'earnings', label: 'Earnings', href: '/dashboard/rider/earnings', icon: Wallet },
  { key: 'profile', label: 'Profile', href: '/dashboard/rider/profile', icon: User },
];

export default function RiderLayout({ children, activeKey = 'tasks' }) {
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  return (
    <div className={styles.riderApp}>
      <aside className={styles.riderSidebar} aria-label="Rider navigation">
        <div className={styles.riderSidebarBrand}>
          <span className={styles.riderSidebarLogo}>N</span>
          <div>
            <span className={styles.riderSidebarTitle}>urbanNxt</span>
            <span className={styles.riderSidebarSub}>Rider</span>
          </div>
        </div>
        <nav className={styles.riderSidebarNav}>
          {SIDENAV.map(({ key, label, href, icon: Icon }) => {
            const active = activeKey === key;
            return (
              <Link
                key={key}
                href={href}
                className={`${styles.riderSidebarLink} ${active ? styles.riderSidebarLinkActive : ''}`}
              >
                <Icon size={22} strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.riderSidebarFooter}>
          <button type="button" className={styles.riderSidebarLogout} onClick={handleLogout}>
            <LogOut size={20} strokeWidth={1.75} aria-hidden />
            Log out
          </button>
        </div>
      </aside>

      <div className={styles.riderMainWrap}>
        <header className={styles.riderMobileTopbar}>
          <span className={styles.riderMobileBrand}>urbanNxt Rider</span>
        </header>
        <main className={styles.riderMain}>{children}</main>
      </div>

      <nav className={styles.riderBottomNav} aria-label="Primary">
        {SIDENAV.map(({ key, label, href, icon: Icon }) => {
          const active = activeKey === key;
          return (
            <Link
              key={key}
              href={href}
              className={`${styles.riderBottomNavItem} ${active ? styles.riderBottomNavItemActive : ''}`}
            >
              <Icon size={22} strokeWidth={1.75} aria-hidden />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
