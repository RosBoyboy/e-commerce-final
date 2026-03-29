import Link from 'next/link';
import { useState } from 'react';
import {
  BarChart3,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Settings2,
  Tag,
  Users as UsersIcon,
} from 'lucide-react';
import { useMessageUnread } from '@/context/MessageUnreadContext';
import styles from '@/styles/dashboard.module.scss';

const TABS = [
  { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'products', label: 'Products', icon: Tag },
  { key: 'categories', label: 'Categories', icon: Layers },
  { key: 'customers', label: 'Customers', icon: UsersIcon },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings2 },
];

export default function AdminShell({ activeTab, onTabChange, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { unreadCount } = useMessageUnread();

  const select = (key) => {
    onTabChange(key);
    setMobileOpen(false);
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.adminSidebarBackdrop} ${mobileOpen ? styles.adminSidebarBackdropVisible : ''}`}
        aria-label="Close menu"
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`${styles.adminSidebarFixed} ${mobileOpen ? styles.adminSidebarOpen : ''}`}
        aria-label="Admin navigation"
      >
        <div className={styles.adminSidebarBrand}>
          <span className={styles.adminSidebarLogo}>urbanNxt</span>
          <span className={styles.adminSidebarPortalLabel}>Admin console</span>
          <Link href="/" className={styles.adminSidebarStoreLink} onClick={() => setMobileOpen(false)}>
            View storefront
          </Link>
        </div>
        <div className={styles.adminSidebarBody}>
          <div className={styles.accountSection}>
            <div className={styles.sectionTitle}>Menu</div>
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`${styles.navItemPro} ${activeTab === key ? styles.active : ''}`}
                onClick={() => select(key)}
              >
                <Icon size={20} strokeWidth={1.5} className={styles.adminNavIcon} aria-hidden />
                {label}
              </button>
            ))}
            <Link
              href="/messages"
              className={styles.adminNavMessagesLink}
              onClick={() => setMobileOpen(false)}
            >
              <span className={styles.adminNavMessagesIconWrap}>
                <MessageCircle size={20} strokeWidth={1.5} className={styles.adminNavIcon} aria-hidden />
                {unreadCount > 0 && (
                  <span className={styles.adminNavMsgBadge} aria-label={`${unreadCount} unread messages`}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </span>
              Messages
            </Link>
          </div>
        </div>
        <div className={styles.adminSidebarFooter}>
          <button type="button" className={styles.logoutBtn} onClick={onLogout}>
            <LogOut size={20} strokeWidth={1.5} className={styles.adminNavIcon} aria-hidden />
            Logout
          </button>
        </div>
      </aside>

      <div className={styles.adminMainWrap}>
        <header className={styles.adminMobileBar}>
          <button
            type="button"
            className={styles.adminMenuBtn}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} strokeWidth={1.35} />
          </button>
          <Link href="/" className={styles.adminMobileBrand} onClick={() => setMobileOpen(false)}>
            urbanNxt Admin
          </Link>
        </header>
        {children}
      </div>
    </>
  );
}
