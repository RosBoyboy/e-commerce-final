import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Download,
  Package,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import SellerLayout from '@/components/seller/SellerLayout';
import { useToast } from '@/components/ui/ToastProvider';
import { fetchSellerOrders, fetchSellerProducts } from '@/services/api';
import { productImageUrl } from '@/utils/image';
import styles from '@/styles/sellerPortal.module.scss';

function lineTotal(order) {
  return (order.items || []).reduce(
    (s, i) => s + (parseFloat(i.price) || 0) * (i.quantity || 1),
    0,
  );
}

function orderNotCancelled(o) {
  return (o.status || '').toLowerCase() !== 'cancelled';
}

export default function SellerAnalytics() {
  const { showToast } = useToast();
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [or, pr] = await Promise.all([
          fetchSellerOrders(),
          fetchSellerProducts(),
        ]);
        if (!cancelled) {
          setOrders(or.data.orders || []);
          setProducts(pr.data.products || []);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          showToast({ message: 'Could not load analytics data.', type: 'error' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  const totalEarnings = useMemo(
    () => orders.reduce((sum, o) => sum + lineTotal(o), 0),
    [orders],
  );

  const totalOrders = orders.length;

  const uniqueCustomers = useMemo(() => {
    const ids = new Set();
    orders.forEach((o) => {
      if (o.customer_id != null) ids.add(o.customer_id);
    });
    return ids.size;
  }, [orders]);

  const totalProducts = products.length;

  const revenueSeries30d = useMemo(() => {
    const days = 30;
    const map = new Map();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, revenue: 0 });
    }
    orders.forEach((o) => {
      const key = (o.created_at || '').slice(0, 10);
      if (!map.has(key)) return;
      const entry = map.get(key);
      entry.revenue += lineTotal(o);
      map.set(key, entry);
    });
    return Array.from(map.values()).map((row) => ({
      label: new Date(`${row.date}T12:00:00`).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
      }),
      revenue: Number(row.revenue.toFixed(2)),
    }));
  }, [orders]);

  const revenueChangePct = useMemo(() => {
    const raw = orders
      .map((o) => ({ t: new Date(o.created_at || '').getTime(), amt: lineTotal(o) }))
      .filter((x) => !Number.isNaN(x.t));
    if (raw.length === 0) return null;
    const now = Date.now();
    const day = 86400000;
    const last7 = raw.filter((x) => x.t >= now - 7 * day).reduce((s, x) => s + x.amt, 0);
    const prev7 = raw.filter((x) => x.t >= now - 14 * day && x.t < now - 7 * day).reduce((s, x) => s + x.amt, 0);
    if (prev7 === 0) return last7 > 0 ? 100 : 0;
    return ((last7 - prev7) / prev7) * 100;
  }, [orders]);

  const topProducts = useMemo(() => {
    const byId = new Map();
    orders.filter(orderNotCancelled).forEach((o) => {
      (o.items || []).forEach((item) => {
        const pid = item.product_id ?? item.product?.id;
        if (pid == null) return;
        const q = item.quantity || 1;
        const rev = (parseFloat(item.price) || 0) * q;
        const prev = byId.get(pid) || {
          id: pid,
          name: item.product?.name || 'Product',
          image: item.product?.image,
          units: 0,
          revenue: 0,
        };
        prev.units += q;
        prev.revenue += rev;
        prev.name = item.product?.name || prev.name;
        prev.image = item.product?.image ?? prev.image;
        byId.set(pid, prev);
      });
    });
    return Array.from(byId.values())
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);
  }, [orders]);

  const lowStockProducts = useMemo(
    () =>
      products
        .filter((p) => (p.stock ?? 0) <= 5)
        .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0)),
    [products],
  );

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      const { downloadSellerSalesReport } = await import('@/utils/sellerSalesReportPdf');
      await downloadSellerSalesReport({
        summary: {
          earnings: totalEarnings,
          orders: totalOrders,
          customers: uniqueCustomers,
          products: totalProducts,
        },
        bestSellers: topProducts.map((p) => ({
          name: p.name,
          units: p.units,
          revenue: p.revenue,
        })),
        generatedAtLabel: new Date().toLocaleString('en-PH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        storeLabel: 'urbanNxt',
      });
      showToast({ message: 'Sales report downloaded.', type: 'success' });
    } catch (e) {
      console.error(e);
      showToast({ message: 'Could not generate PDF.', type: 'error' });
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <SellerLayout>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/seller">Home</Link>
        <span> / Analytics</span>
      </div>

      <div className={styles.sellerAnalyticsToolbar}>
        <div>
          <h1 className={styles.pageTitle} style={{ marginBottom: 6 }}>
            Analytics
          </h1>
          <p className={styles.pageSubtitle} style={{ marginBottom: 0 }}>
            Revenue, best sellers, and stock alerts — amounts in Philippine Peso (₱).
          </p>
        </div>
        <button
          type="button"
          className={styles.sellerAnalyticsPdfBtn}
          onClick={handleDownloadPdf}
          disabled={pdfLoading || loading}
        >
          <Download size={18} strokeWidth={1.75} aria-hidden />
          {pdfLoading ? 'Preparing…' : 'Download sales report'}
        </button>
      </div>

      {loading ? (
        <div className={styles.sellerAnalyticsSection}>
          <p className={styles.pageSubtitle} style={{ margin: 0 }}>Loading analytics…</p>
        </div>
      ) : (
        <>
          <div className={styles.sellerAnalyticsKpiGrid}>
            <div className={styles.sellerAnalyticsKpiCard}>
              <div className={styles.sellerAnalyticsKpiTop}>
                <span className={`${styles.sellerAnalyticsKpiIcon} ${styles.sellerAnalyticsKpiIconEarnings}`}>
                  <Banknote size={22} strokeWidth={1.75} aria-hidden />
                </span>
              </div>
              <div className={styles.sellerAnalyticsKpiValue}>
                ₱{totalEarnings.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </div>
              <div className={styles.sellerAnalyticsKpiLabel}>Total earnings (your lines)</div>
            </div>
            <div className={styles.sellerAnalyticsKpiCard}>
              <div className={styles.sellerAnalyticsKpiTop}>
                <span className={`${styles.sellerAnalyticsKpiIcon} ${styles.sellerAnalyticsKpiIconOrders}`}>
                  <ShoppingBag size={22} strokeWidth={1.75} aria-hidden />
                </span>
              </div>
              <div className={styles.sellerAnalyticsKpiValue}>{totalOrders}</div>
              <div className={styles.sellerAnalyticsKpiLabel}>Total orders</div>
            </div>
            <div className={styles.sellerAnalyticsKpiCard}>
              <div className={styles.sellerAnalyticsKpiTop}>
                <span className={`${styles.sellerAnalyticsKpiIcon} ${styles.sellerAnalyticsKpiIconCustomers}`}>
                  <Users size={22} strokeWidth={1.75} aria-hidden />
                </span>
              </div>
              <div className={styles.sellerAnalyticsKpiValue}>{uniqueCustomers}</div>
              <div className={styles.sellerAnalyticsKpiLabel}>Unique customers</div>
            </div>
            <div className={styles.sellerAnalyticsKpiCard}>
              <div className={styles.sellerAnalyticsKpiTop}>
                <span className={`${styles.sellerAnalyticsKpiIcon} ${styles.sellerAnalyticsKpiIconProducts}`}>
                  <Package size={22} strokeWidth={1.75} aria-hidden />
                </span>
              </div>
              <div className={styles.sellerAnalyticsKpiValue}>{totalProducts}</div>
              <div className={styles.sellerAnalyticsKpiLabel}>Products in catalog</div>
            </div>
          </div>

          <div className={styles.sellerAnalyticsSection}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 className={styles.sellerAnalyticsSectionTitle}>Revenue trend</h2>
                <p className={styles.sellerAnalyticsSectionSub}>Last 30 days, based on your order line totals.</p>
              </div>
              {revenueChangePct != null && (
                <span className={styles.sellerAnalyticsTrend}>
                  {revenueChangePct >= 0 ? (
                    <TrendingUp size={14} strokeWidth={2} aria-hidden />
                  ) : (
                    <TrendingDown size={14} strokeWidth={2} aria-hidden />
                  )}
                  {revenueChangePct >= 0 ? '+' : ''}
                  {revenueChangePct.toFixed(1)}% vs prior 7 days
                </span>
              )}
            </div>
            <div className={styles.sellerAnalyticsChart}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueSeries30d} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148,163,184,0.25)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} minTickGap={12} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(v) => `₱${v}`} width={56} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                    formatter={(v) => [`₱${Number(v).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`, 'Revenue']}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={styles.sellerAnalyticsTwoCol}>
            <div className={styles.sellerAnalyticsSection} style={{ marginBottom: 0 }}>
              <h2 className={styles.sellerAnalyticsSectionTitle}>Top products</h2>
              <p className={styles.sellerAnalyticsSectionSub}>By units sold (excluding cancelled orders).</p>
              {topProducts.length === 0 ? (
                <p className={styles.pageSubtitle} style={{ margin: 0 }}>No sales yet.</p>
              ) : (
                <ul className={styles.sellerAnalyticsTopList}>
                  {topProducts.map((p, idx) => (
                    <li key={p.id} className={styles.sellerAnalyticsTopRow}>
                      <span className={styles.sellerAnalyticsTopRank}>{idx + 1}</span>
                      <img
                        className={styles.sellerAnalyticsTopThumb}
                        src={productImageUrl(p.image) || 'https://placehold.co/48x48'}
                        alt=""
                        onError={(e) => {
                          e.target.src = 'https://placehold.co/48x48';
                        }}
                      />
                      <div className={styles.sellerAnalyticsTopMeta}>
                        <div className={styles.sellerAnalyticsTopName}>{p.name}</div>
                        <div className={styles.sellerAnalyticsTopStat}>
                          {p.units} units · ₱{p.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className={styles.sellerAnalyticsLowStock}>
              <h2 className={styles.sellerAnalyticsLowStockTitle}>
                <AlertTriangle size={18} strokeWidth={1.75} aria-hidden />
                Low stock (≤ 5)
              </h2>
              {lowStockProducts.length === 0 ? (
                <p className={styles.pageSubtitle} style={{ margin: 0, color: '#64748b' }}>
                  All products above 5 units.
                </p>
              ) : (
                <ul className={styles.sellerAnalyticsLowStockList}>
                  {lowStockProducts.slice(0, 12).map((p) => (
                    <li key={p.id} className={styles.sellerAnalyticsLowStockItem}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                      <span className={styles.sellerAnalyticsLowBadge}>{p.stock ?? 0} left</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </SellerLayout>
  );
}
