import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import {
  CheckCircle2,
  ImageIcon,
  Navigation,
  Package,
  PackageCheck,
  Phone,
  X,
} from 'lucide-react';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { fetchRiderOrders, riderMarkDelivered } from '@/services/api';
import { useToast } from '@/components/ui/ToastProvider';
import RiderLayout from '@/components/rider/RiderLayout';
import { productImageUrl } from '@/utils/image';
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

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
}

export default function RiderTasks() {
  useProtectedRoute('rider');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState([]);
  const [recentDelivered, setRecentDelivered] = useState([]);
  const [deliveringId, setDeliveringId] = useState(null);
  const [detailOrder, setDetailOrder] = useState(null);

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
      setDetailOrder(null);
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

  const openDetail = (order) => setDetailOrder(order);
  const closeDetail = () => setDetailOrder(null);

  const renderOrderCard = (order, { isActive }) => {
    const addr = formatAddressForMaps(order);
    const tel = customerPhone(order);
    const mapsHref = mapsSearchUrl(addr);
    return (
      <div
        key={order.id}
        className={`${styles.riderCard} ${styles.riderCardClickable}`}
        onClick={() => openDetail(order)}
      >
        <div className={styles.riderOrderMeta}>
          <span className={styles.riderOrderId}>#{order.order_number || order.id}</span>
          <span
            className={`${styles.riderOrderStatus} ${
              isActive ? styles.riderStatusActive : styles.riderStatusDone
            }`}
          >
            {isActive ? 'Out for delivery' : 'Delivered'}
          </span>
        </div>
        <h2 className={styles.riderCustomerName}>{order.customer?.name || 'Customer'}</h2>
        {addr ? (
          <p className={styles.riderAddress}>{addr}</p>
        ) : (
          <p className={styles.riderAddress}>No address on file — open details or contact support.</p>
        )}
        {isActive ? (
          <div className={styles.riderBtnStack} onClick={(e) => e.stopPropagation()}>
            <a
              className={`${styles.riderBtn} ${styles.riderBtnPrimary}`}
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={20} strokeWidth={2} aria-hidden />
              Navigate
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
        ) : (
          <p className={styles.riderMuted} style={{ margin: 0, fontSize: 13 }}>
            Tap for order summary, timeline, and proof placeholder.
          </p>
        )}
      </div>
    );
  };

  const d = detailOrder;
  const detailTel = d ? customerPhone(d) : '';
  const detailAddr = d ? formatAddressForMaps(d) : '';
  const detailMaps = d ? mapsSearchUrl(detailAddr) : '';
  const isDetailActive = d && (d.status || '').toLowerCase() === 'shipped';
  const items = d?.items || [];

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
                No active deliveries. You&apos;ll see new tasks here when an order is marked shipped and assigned
                to you.
              </div>
            ) : (
              <div className={styles.riderGrid}>{active.map((order) => renderOrderCard(order, { isActive: true }))}</div>
            )}

            <p className={styles.riderSectionLabel}>Recent delivered</p>
            {recentDelivered.length === 0 ? (
              <div className={styles.riderEmpty} style={{ marginBottom: 8 }}>
                <span className={styles.riderEmptyIcon} aria-hidden>
                  <PackageCheck size={48} strokeWidth={1.35} />
                </span>
                <p className={styles.riderEmptyText}>
                  No completed deliveries yet. Finished drops you&apos;ve marked as delivered will show here (up to 20).
                </p>
              </div>
            ) : (
              <div className={styles.riderGrid}>
                {recentDelivered.map((order) => renderOrderCard(order, { isActive: false }))}
              </div>
            )}
          </>
        )}
      </RiderLayout>

      {d && (
        <>
          <div
            className={styles.riderModalBackdrop}
            role="presentation"
            onClick={closeDetail}
          />
          <div
            className={styles.riderModalPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rider-detail-title"
          >
            <div className={styles.riderModalHeader}>
              <div>
                <h2 id="rider-detail-title" className={styles.riderModalTitle}>
                  #{d.order_number || d.id}
                </h2>
                <p className={styles.riderMuted} style={{ margin: '4px 0 0', fontSize: 13 }}>
                  {(d.status || '').toLowerCase() === 'shipped' ? 'Out for delivery' : 'Delivered'}
                </p>
              </div>
              <button type="button" className={styles.riderModalClose} onClick={closeDetail} aria-label="Close">
                <X size={22} strokeWidth={1.75} />
              </button>
            </div>

            <div className={styles.riderModalBody}>
              <div className={styles.riderModalSection}>
                <h3 className={styles.riderModalSectionTitle}>Order summary</h3>
                {items.length === 0 ? (
                  <p className={styles.riderMuted}>No line items returned.</p>
                ) : (
                  <>
                    <ul className={styles.riderDetailLineList}>
                      {items.map((line) => {
                        const name = line.product?.name || 'Product';
                        const img = productImageUrl(line.product?.image);
                        const lineTotal = line.line_total ?? (Number(line.price) || 0) * (line.quantity || 1);
                        return (
                          <li key={line.id} className={styles.riderDetailLineItem}>
                            <img
                              className={styles.riderDetailThumb}
                              src={img || 'https://placehold.co/44x44'}
                              alt=""
                              onError={(e) => {
                                e.target.src = 'https://placehold.co/44x44';
                              }}
                            />
                            <div className={styles.riderDetailLineMeta}>
                              <div className={styles.riderDetailLineName}>{name}</div>
                              <div className={styles.riderDetailLineSub}>
                                ₱{Number(line.price || 0).toFixed(2)} × {line.quantity || 1}
                              </div>
                            </div>
                            <div className={styles.riderDetailLinePrice}>
                              ₱{Number(lineTotal).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className={styles.riderDetailTotal}>
                      <span>Order total</span>
                      <span>
                        ₱{Number(d.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className={styles.riderModalSection}>
                <h3 className={styles.riderModalSectionTitle}>Customer</h3>
                <p className={styles.riderDetailLineName} style={{ margin: '0 0 4px' }}>
                  {d.customer?.name || '—'}
                </p>
                {d.customer?.email ? (
                  <p className={styles.riderMuted} style={{ margin: 0, fontSize: 13 }}>
                    {d.customer.email}
                  </p>
                ) : null}
                {detailTel ? (
                  <a className={styles.riderDetailCallBtn} href={`tel:${detailTel}`}>
                    <Phone size={18} strokeWidth={1.75} aria-hidden />
                    Call
                  </a>
                ) : (
                  <p className={styles.riderMuted} style={{ marginTop: 8 }}>
                    No phone on file
                  </p>
                )}
              </div>

              <div className={styles.riderModalSection}>
                <h3 className={styles.riderModalSectionTitle}>Delivery address</h3>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#334155' }}>
                  {detailAddr || '—'}
                </p>
                {detailAddr ? (
                  <a
                    href={detailMaps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.riderBtn} ${styles.riderBtnPrimary}`}
                    style={{ marginTop: 12 }}
                  >
                    <Navigation size={20} strokeWidth={2} aria-hidden />
                    Open in Maps
                  </a>
                ) : null}
              </div>

              <div className={styles.riderModalSection}>
                <h3 className={styles.riderModalSectionTitle}>Delivery timeline</h3>
                <div className={styles.riderTimeline}>
                  <div className={styles.riderTimelineRow}>
                    <span className={styles.riderTimelineLabel}>Order placed</span>
                    <span className={styles.riderTimelineVal}>{formatWhen(d.created_at)}</span>
                  </div>
                  <div className={styles.riderTimelineRow}>
                    <span className={styles.riderTimelineLabel}>Out for delivery (last update)</span>
                    <span className={styles.riderTimelineVal}>
                      {isDetailActive ? formatWhen(d.updated_at) : '—'}
                    </span>
                  </div>
                  <div className={styles.riderTimelineRow}>
                    <span className={styles.riderTimelineLabel}>Picked up</span>
                    <span className={styles.riderTimelineVal}>Not recorded</span>
                  </div>
                  <div className={styles.riderTimelineRow}>
                    <span className={styles.riderTimelineLabel}>Delivered</span>
                    <span className={styles.riderTimelineVal}>
                      {(d.status || '').toLowerCase() === 'delivered' ? formatWhen(d.updated_at) : '—'}
                    </span>
                  </div>
                  {d.received_at ? (
                    <div className={styles.riderTimelineRow}>
                      <span className={styles.riderTimelineLabel}>Receipt confirmed</span>
                      <span className={styles.riderTimelineVal}>{formatWhen(d.received_at)}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className={styles.riderModalSection}>
                <h3 className={styles.riderModalSectionTitle}>Proof of delivery</h3>
                <div className={styles.riderProofPlaceholder}>
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <ImageIcon size={28} strokeWidth={1.5} opacity={0.45} aria-hidden />
                    Photo not attached for this order.
                    <span style={{ fontSize: 12 }}>Future uploads will appear here.</span>
                  </span>
                </div>
              </div>

              {isDetailActive ? (
                <div className={styles.riderModalSection}>
                  <button
                    type="button"
                    className={`${styles.riderBtn} ${styles.riderBtnSuccess}`}
                    disabled={deliveringId === d.id}
                    onClick={() => handleDeliver(d.id)}
                  >
                    {deliveringId === d.id ? (
                      <span className={styles.riderSpinner} aria-hidden />
                    ) : (
                      <CheckCircle2 size={20} strokeWidth={2} aria-hidden />
                    )}
                    Mark as delivered
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
