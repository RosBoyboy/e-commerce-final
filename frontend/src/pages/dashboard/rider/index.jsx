import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { CheckCircle2, Navigation, Package, Phone } from 'lucide-react';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { fetchRiderOrders, riderMarkDelivered } from '@/services/api';
import { useToast } from '@/components/ui/ToastProvider';
import RiderLayout from '@/components/rider/RiderLayout';
import styles from '@/styles/riderPortal.module.scss';

function formatAddressForMaps(order) {
  const raw = order?.shipping_address;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'string') return raw.trim();
  if (typeof raw === 'object') {
    const o = raw;
    return [
      o.line1,
      o.line2,
      o.street,
      o.city,
      o.region,
      o.state,
      o.postal_code,
      o.zip,
      o.country,
    ]
      .filter(Boolean)
      .join(', ');
  }
  return String(raw);
}

function mapsSearchUrl(address) {
  const q = (address || '').trim();
  if (!q) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function customerPhone(order) {
  const p = order?.customer?.phone || order?.phone;
  return p ? String(p).replace(/\s/g, '') : '';
}

export default function RiderTasks() {
  useProtectedRoute('rider');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState([]);
  const [recentDelivered, setRecentDelivered] = useState([]);
  const [deliveringId, setDeliveringId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await fetchRiderOrders();
      setActive(data?.active || []);
      setRecentDelivered(data?.recent_delivered || []);
    } catch (e) {
      console.error(e);
      showToast({
        message: e.response?.data?.message || 'Could not load your deliveries.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeliver = async (orderId) => {
    setDeliveringId(orderId);
    try {
      await riderMarkDelivered(orderId);
      showToast({ message: 'Marked as delivered.', type: 'success' });
      await load();
    } catch (e) {
      console.error(e);
      showToast({
        message: e.response?.data?.message || 'Could not update order.',
        type: 'error',
      });
    } finally {
      setDeliveringId(null);
    }
  };

  return (
    <>
      <Head>
        <title>My Tasks — Rider</title>
      </Head>
      <RiderLayout activeKey="tasks">
        <h1 className={styles.riderPageTitle}>My Tasks</h1>
        <p className={styles.riderPageSub}>Active deliveries and your latest completed drops.</p>

        {loading ? (
          <p className={styles.riderMuted}>
            <span className={styles.riderSpinner} aria-hidden /> Loading…
          </p>
        ) : (
          <>
            <p className={styles.riderSectionLabel}>Active</p>
            {active.length === 0 ? (
              <div className={styles.riderEmpty}>
                <Package size={40} strokeWidth={1.5} style={{ opacity: 0.35, marginBottom: 12 }} aria-hidden />
                No active deliveries. You&apos;ll see new tasks here when an order is marked shipped and assigned to you.
              </div>
            ) : (
              <div className={styles.riderGrid}>
                {active.map((order) => {
                  const addr = formatAddressForMaps(order);
                  const tel = customerPhone(order);
                  const mapsHref = mapsSearchUrl(addr);
                  return (
                    <article key={order.id} className={styles.riderCard}>
                      <div className={styles.riderOrderMeta}>
                        <span className={styles.riderOrderId}>#{order.order_number || order.id}</span>
                        <span className={`${styles.riderOrderStatus} ${styles.riderStatusActive}`}>Out for delivery</span>
                      </div>
                      <h2 className={styles.riderCustomerName}>{order.customer?.name || 'Customer'}</h2>
                      {addr ? (
                        <p className={styles.riderAddress}>{addr}</p>
                      ) : (
                        <p className={styles.riderAddress}>No address on file — contact support if needed.</p>
                      )}
                      <div className={styles.riderBtnStack}>
                        <a
                          className={`${styles.riderBtn} ${styles.riderBtnPrimary}`}
                          href={mapsHref}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Navigation size={20} strokeWidth={2} aria-hidden />
                          Tap to navigate
                        </a>
                        {tel ? (
                          <a className={`${styles.riderBtn} ${styles.riderBtnGhost}`} href={`tel:${tel}`}>
                            <Phone size={20} strokeWidth={2} aria-hidden />
                            Call customer
                          </a>
                        ) : (
                          <button type="button" className={`${styles.riderBtn} ${styles.riderBtnGhost}`} disabled>
                            <Phone size={20} strokeWidth={2} aria-hidden />
                            No phone on file
                          </button>
                        )}
                        <button
                          type="button"
                          className={`${styles.riderBtn} ${styles.riderBtnSuccess}`}
                          disabled={deliveringId === order.id}
                          onClick={() => handleDeliver(order.id)}
                        >
                          {deliveringId === order.id ? (
                            <span className={styles.riderSpinner} aria-hidden />
                          ) : (
                            <CheckCircle2 size={20} strokeWidth={2} aria-hidden />
                          )}
                          Mark as delivered
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {recentDelivered.length > 0 ? (
              <>
                <p className={styles.riderSectionLabel}>Recent delivered</p>
                <div className={styles.riderGrid}>
                  {recentDelivered.map((order) => (
                    <article key={order.id} className={`${styles.riderCard} ${styles.riderCardElevated}`}>
                      <div className={styles.riderOrderMeta}>
                        <span className={styles.riderOrderId}>#{order.order_number || order.id}</span>
                        <span className={`${styles.riderOrderStatus} ${styles.riderStatusDone}`}>Delivered</span>
                      </div>
                      <h2 className={styles.riderCustomerName}>{order.customer?.name || 'Customer'}</h2>
                      <p className={styles.riderAddress} style={{ marginBottom: 0 }}>
                        {formatAddressForMaps(order) || '—'}
                      </p>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </RiderLayout>
    </>
  );
}
