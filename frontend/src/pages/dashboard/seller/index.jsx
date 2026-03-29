import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import SellerLayout from '@/components/seller/SellerLayout';
import { fetchSellerProducts, fetchSellerOrders } from '@/services/api';
import styles from '@/styles/sellerPortal.module.scss';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function SellerDashboardHome() {
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifCount, setNotifCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [productsRes, ordersRes] = await Promise.all([
          fetchSellerProducts(),
          fetchSellerOrders(),
        ]);
        setProducts(productsRes.data.products || []);
        setOrders(ordersRes.data.orders || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const lowStockThreshold = 5;
  const lowStockProducts = products.filter((p) => (p.stock ?? 0) <= lowStockThreshold && (p.stock ?? 0) > 0);
  const outOfStock = products.filter((p) => (p.stock ?? 0) === 0);

  const totalEarnings = orders.reduce(
    (sum, o) => sum + (o.items || []).reduce((s, i) => s + (parseFloat(i.price) || 0) * (i.quantity || 1), 0),
    0
  );
  const revenueSeries = useMemo(() => {
    if (!Array.isArray(orders) || orders.length === 0) return [];

    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'short' }),
        total: 0,
      });
    }

    const byKey = new Map(months.map((m) => [m.key, m]));

    orders.forEach((order) => {
      if (!order.created_at) return;
      const d = new Date(order.created_at);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = byKey.get(key);
      if (!bucket) return;
      const orderTotal = (order.items || []).reduce(
        (s, i) => s + (parseFloat(i.price) || 0) * (i.quantity || 1),
        0
      );
      bucket.total += orderTotal;
    });

    return months.map((m) => ({
      name: m.label,
      total: Number(m.total.toFixed(2)),
    }));
  }, [orders]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/products');
    }
  };

  const orderEventIds = useMemo(() => {
    if (!Array.isArray(orders)) return [];
    return orders
      .filter((o) => {
        const status = (o.status || '').toLowerCase();
        return status === 'pending' || status === 'delivered';
      })
      .map((o) => `order-${o.id}-${(o.status || '').toLowerCase()}`);
  }, [orders]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!orderEventIds.length) {
      setNotifCount(0);
      return;
    }
    try {
      const raw = window.localStorage.getItem('seller_notif_seen_v1');
      const seen = new Set(raw ? JSON.parse(raw) : []);
      const unseen = orderEventIds.filter((id) => !seen.has(id));
      setNotifCount(unseen.length);
    } catch {
      setNotifCount(0);
    }
  }, [orderEventIds]);

  const handleNotificationsClick = () => {
    const nextOpen = !notifOpen;
    setNotifOpen(nextOpen);
    if (!nextOpen) {
      // just closing the panel, don't change counts
      return;
    }

    if (typeof window !== 'undefined' && orderEventIds.length) {
      try {
        const raw = window.localStorage.getItem('seller_notif_seen_v1');
        const seen = new Set(raw ? JSON.parse(raw) : []);
        orderEventIds.forEach((id) => seen.add(id));
        window.localStorage.setItem('seller_notif_seen_v1', JSON.stringify(Array.from(seen)));
      } catch {
        // ignore storage errors
      }
    }
    setNotifCount(0);
  };

  return (
    <SellerLayout>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="search"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            style={{ maxWidth: 260 }}
          />
          <button type="submit" aria-label="Search" className={styles.secondaryButton} style={{ padding: '8px 10px', minWidth: 'auto' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21 21-4.34-4.34" />
              <circle cx="11" cy="11" r="8" />
            </svg>
          </button>
        </form>
        <Link href="/messages" aria-label="Messages" className={styles.secondaryButton} style={{ padding: '8px 10px', minWidth: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
          </svg>
        </Link>
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            aria-label="Notifications"
            className={styles.secondaryButton}
            style={{ padding: '8px 10px', minWidth: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
            onClick={handleNotificationsClick}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.268 21a2 2 0 0 0 3.464 0" />
              <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
            </svg>
            {notifCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  borderRadius: 999,
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {notifCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div
              style={{
                position: 'absolute',
                top: '110%',
                right: 0,
                width: 280,
                maxHeight: 320,
                borderRadius: 16,
                border: '1px solid #e2e8f0',
                boxShadow: '0 10px 25px rgba(15,23,42,0.18)',
                background: '#ffffff',
                padding: 12,
                zIndex: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Notifications</span>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/seller/orders')}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    fontSize: 12,
                    color: '#6366f1',
                    cursor: 'pointer',
                  }}
                >
                  View orders
                </button>
              </div>
              {orderEventIds.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8', margin: '8px 0' }}>No recent order activity.</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {orders
                    .filter((o) => {
                      const status = (o.status || '').toLowerCase();
                      return status === 'pending' || status === 'delivered';
                    })
                    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
                    .slice(0, 6)
                    .map((o) => (
                      <li key={o.id} style={{ padding: '8px 6px', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>Order #{o.order_number || o.id}</div>
                        <div style={{ color: '#6b7280' }}>
                          {((o.status || '').toLowerCase() === 'pending' && 'New order placed') ||
                            (((o.status || '').toLowerCase() === 'delivered') && 'Delivered (rider completed)') ||
                            'Order updated'}
                        </div>
                        <div style={{ color: '#94a3b8', marginTop: 2 }}>
                          {o.created_at ? new Date(o.created_at).toLocaleString() : ''}
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      <h1 className={styles.pageTitle}>Welcome back</h1>
      <p className={styles.pageSubtitle}>Here is what&apos;s happening with your store today.</p>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>₱</div>
          <p className={styles.statValue}>₱{totalEarnings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          <p className={styles.statLabel}>Total Earnings</p>
          <span className={styles.statTrend}>+0% vs last month</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>📦</div>
          <p className={styles.statValue}>{orders.reduce((acc, o) => acc + (o.items || []).reduce((a, i) => a + (i.quantity || 1), 0), 0)}</p>
          <p className={styles.statLabel}>Items Sold</p>
          <span className={styles.statMeta}>Orders this month</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>★</div>
          <p className={styles.statValue}>4.9 ★★★★☆</p>
          <p className={styles.statLabel}>Store Rating</p>
          <span className={styles.statMeta}>Reviews</span>
        </div>
      </div>

      <div className={styles.dashboardMainGrid}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Revenue</h2>
          </div>
          <div className={styles.cardBody}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, gap: 16 }}>
              <div>
                <p style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: '#94a3b8', margin: 0 }}>Total revenue</p>
                <p style={{ fontSize: 28, fontWeight: 800, margin: '4px 0 0', color: '#0f172a', letterSpacing: '-0.03em' }}>
                  ₱{totalEarnings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <span className={`${styles.badge} ${styles.green}`}>+0% vs last period</span>
            </div>
            <div style={{ height: 220, borderRadius: 12, border: '1px dashed #e2e8f0', background: 'linear-gradient(135deg, #f9fafb, #eff6ff)', padding: 12 }}>
              {revenueSeries.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
                  Not enough data yet to display revenue over time.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} tickFormatter={(v) => `₱${v.toLocaleString('en-PH', { maximumFractionDigits: 0 })}`} />
                    <Tooltip
                      cursor={{ stroke: '#c7d2fe' }}
                      formatter={(value) => [`₱${Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue']}
                    />
                    <Area type="monotone" dataKey="total" stroke="#4f46e5" fill="url(#revenueArea)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                  </span>
                  <span>Low Stock Alerts</span>
                </span>
              </h2>
              {lowStockProducts.length + outOfStock.length > 0 && (
                <span className={`${styles.badge} ${styles.red}`}>{lowStockProducts.length + outOfStock.length}</span>
              )}
            </div>
            <div className={styles.cardBody}>
              {loading ? (
                <p className={styles.emptyState}>Loading...</p>
              ) : lowStockProducts.length === 0 && outOfStock.length === 0 ? (
                <div className={styles.emptyState}>
                  <div className={styles.emptyStateIcon}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                      <path d="M12 9v4" />
                      <path d="M12 17h.01" />
                    </svg>
                  </div>
                  <p style={{ margin: 0 }}>All products are well stocked.</p>
                  <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94a3b8' }}>No low stock or out-of-stock items.</p>
                </div>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {[...outOfStock, ...lowStockProducts].slice(0, 5).map((p) => (
                    <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <img
                        src={p.image || 'https://placehold.co/48x48?text=No+Image'}
                        alt=""
                        style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }}
                        onError={(e) => { e.target.src = 'https://placehold.co/48x48'; }}
                      />
                      <div style={{ flex: 1 }}>
                        <strong style={{ fontSize: 14 }}>{p.name}</strong>
                        <p style={{ margin: 0, fontSize: 12, color: '#6b7280' }}>
                          {p.stock === 0 ? (
                            <span style={{ color: '#dc2626' }}>Out of stock</span>
                          ) : (
                            <span style={{ color: '#d97706' }}>Only {p.stock} left</span>
                          )}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {(lowStockProducts.length > 0 || outOfStock.length > 0) && (
                <Link href="/dashboard/seller/inventory" className={styles.primaryButton} style={{ display: 'inline-block', marginTop: 16, padding: '8px 16px', fontSize: 13 }}>
                  Restock Items
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
