import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useMessageUnread } from '@/context/MessageUnreadContext';
import { useCart } from '@/context/CartContext';

export default function Navbar() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { items } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const { unreadCount } = useMessageUnread();

  const getDashboardPath = () => {
    if (!user?.role?.name) return '/dashboard/customer';
    const role = user.role.name;
    if (role === 'customer') return '/dashboard/customer';
    if (role === 'seller') return '/dashboard/seller';
    if (role === 'admin') return '/dashboard/admin';
    if (role === 'rider') return '/dashboard/rider';
    return '/dashboard/customer';
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/products');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/products');
  };

  const isAbout = router.pathname === '/about';
  const isHome = router.pathname === '/';
  const isHomeContact = isHome && router.asPath.includes('#contact');
  const isDashboard = router.pathname.startsWith('/dashboard');

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`navbar ${navScrolled ? 'navbar--solid' : ''}`}>
      <div className="nav-inner">
        <Link href={user ? getDashboardPath() : '/'} className="brand">
          <span className="brand-n">N</span>
          <span className="brand-name">urbanNxt</span>
        </Link>
        {!user && (
          <button
            type="button"
            className="nav-toggle"
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={22} strokeWidth={1.5} /> : <Menu size={22} strokeWidth={1.5} />}
          </button>
        )}
        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          {!user && (
            <>
              <Link
                href="/about"
                className={isAbout ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                About us
              </Link>
              <Link
                href="/#contact"
                className={isHomeContact ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                Contact us
              </Link>
            </>
          )}
        </nav>
        <div className="nav-center">
          <form className="nav-search" onSubmit={handleSearch}>
            <input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
            />
            <button type="submit" aria-label="Search">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21 21-4.34-4.34" />
                <circle cx="11" cy="11" r="8" />
              </svg>
            </button>
          </form>
        </div>
        <div className="nav-actions">
          {/* Cart should appear only for customers */}
          {user?.role?.name === 'customer' && (
            <Link href="/cart" aria-label="Cart" className="nav-cart">
              <span className="nav-cart-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <circle cx="8" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
              </span>
              {cartCount > 0 && <span className="nav-cart-count">{cartCount}</span>}
            </Link>
          )}
          {user ? (
            <>
              <Link href="/messages" className="nav-messages" aria-label="Messages">
                <span className="nav-messages-icon-wrap">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="nav-messages-badge" aria-label={`${unreadCount} unread messages`}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </span>
              </Link>
              {router.pathname === '/messages' && user?.role?.name === 'seller' && (
                <Link href="/dashboard/seller" aria-label="Back to seller dashboard" className="nav-icon-link">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 -10 110 135" width="20" height="20" fill="currentColor" aria-hidden>
                    <path d="m15.625 50h-4.1211c-2.6133 0-4.9453-1.6211-5.8594-4.0664-0.91016-2.4414-0.20703-5.1992 1.7656-6.9062l36.449-31.59c3.5234-3.0547 8.7539-3.0547 12.277 0l36.453 31.59c1.9727 1.707 2.6719 4.4648 1.7617 6.9062-0.91016 2.4453-3.2461 4.0664-5.8555 4.0664h-4.1211v34.375c0 5.1797-4.1992 9.375-9.375 9.375h-15.625c-1.7266 0-3.125-1.3984-3.125-3.125v-18.75c0-1.7266-1.4023-3.125-3.125-3.125h-6.25c-1.7266 0-3.125 1.3984-3.125 3.125v18.75c0 1.7266-1.4023 3.125-3.125 3.125h-15.625c-5.1797 0-9.375-4.1953-9.375-9.375z" />
                  </svg>
                </Link>
              )}
              <button type="button" className="nav-bell" aria-label="Notifications">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                  <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" aria-label="Login" className="nav-icon-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 11v6" />
                  <path d="M19 13h2" />
                  <path d="M2 21a8 8 0 0 1 12.868-6.349" />
                  <circle cx="10" cy="8" r="5" />
                  <circle cx="19" cy="19" r="2" />
                </svg>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
