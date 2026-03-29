import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bike } from 'lucide-react';
import SellerLayout from '@/components/seller/SellerLayout';
import { fetchSellerOrders, updateSellerOrderStatus, fetchSellerRiders, assignSellerOrderRider } from '@/services/api';
import { productImageUrl } from '@/utils/image';
import styles from '@/styles/sellerPortal.module.scss';

const statusTabs = [
  { id: 'all', label: 'All Orders' },
  { id: 'pending', label: 'Pending' },
  { id: 'ready', label: 'Ready to Ship' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'returns', label: 'Returns' },
];

const refetch = (setOrders, setLoading) => {
  setLoading(true);
  return fetchSellerOrders()
    .then((res) => setOrders(res.data.orders || []))
    .catch(console.error)
    .finally(() => setLoading(false));
};

export default function SellerOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [fleetRiders, setFleetRiders] = useState([]);
  const [assigningRiderOrderId, setAssigningRiderOrderId] = useState(null);

  useEffect(() => {
    refetch(setOrders, setLoading);
    fetchSellerRiders()
      .then((res) => setFleetRiders(res.data.riders || []))
      .catch(() => setFleetRiders([]));
  }, []);

  const getStatus = (o) => (o.status || '').toLowerCase();

  const filtered = orders.filter((o) => {
    // Completed (delivered) orders are surfaced in Inventory instead
    if (getStatus(o) === 'delivered') return false;
    const matchStatus = statusFilter === 'all' || getStatus(o) === statusFilter;
    const matchSearch = !search || (o.order_number || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleUpdateStatus = async (orderId, status) => {
    setUpdatingOrderId(orderId);
    try {
      await updateSellerOrderStatus(orderId, status);
      await refetch(setOrders, setLoading);
      const rr = await fetchSellerRiders().catch(() => ({ data: { riders: [] } }));
      setFleetRiders(rr.data.riders || []);
    } catch (e) {
      console.error(e);
      await refetch(setOrders, setLoading);
      const msg =
        e.response?.data?.message ||
        'Failed to update status.';
      alert(
        e.response?.status === 422
          ? `${msg} The order list was refreshed — it may already be shipped or delivered.`
          : msg,
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleAssignRider = async (orderId, riderId) => {
    setAssigningRiderOrderId(orderId);
    try {
      await assignSellerOrderRider(orderId, riderId);
      await refetch(setOrders, setLoading);
      const rr = await fetchSellerRiders();
      setFleetRiders(rr.data.riders || []);
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'Failed to assign rider.');
    } finally {
      setAssigningRiderOrderId(null);
    }
  };

  const pendingCount = orders.filter((o) => getStatus(o) === 'pending').length;
  const totalRevenue = orders.reduce(
    (sum, o) => sum + (o.items || []).reduce((s, i) => s + (parseFloat(i.price) || 0) * (i.quantity || 1), 0),
    0
  );

  return (
    <SellerLayout>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/seller">Home</Link>
        <span> / Orders</span>
      </div>
      <div className={styles.actionRow}>
        <div>
          <h1 className={styles.pageTitle}>Manage My Orders</h1>
          <p className={styles.pageSubtitle}>
            Track pending shipments and mark orders shipped. Delivery completion is recorded by your assigned rider.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="button" className={styles.secondaryButton}>Export CSV</button>
          <button type="button" className={styles.primaryButton}>Batch Print</button>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#dc2626' }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 125" width="22" height="22" aria-hidden>
              <path d="m64.08,38.2c.2.2.45.29.71.29s.51-.1.71-.29c.39-.39.39-1.02,0-1.41l-3.7-3.7v-9.32c0-.55-.45-1-1-1s-1,.45-1,1v9.73c0,.27.11.52.29.71l4,4Z" />
              <path d="m90,90.9h-1.27c-3.65,0-6.62-2.97-6.62-6.62v-12.7c0-4.75-3.87-8.62-8.62-8.62h-21.86v-10.26c2.78,1.33,5.88,2.1,9.16,2.1,11.75,0,21.32-9.56,21.32-21.32s-9.56-21.32-21.32-21.32c-3.28,0-6.38.77-9.16,2.1v-6.18c0-.4-.24-.77-.62-.92-.37-.15-.8-.07-1.09.22l-4.38,4.37-4.38-4.37c-.39-.39-1.02-.39-1.41,0l-4.37,4.37-4.37-4.37c-.38-.38-1.04-.38-1.41,0l-4.37,4.37-4.37-4.37c-.19-.19-.44-.29-.71-.29s-.52.11-.71.29l-4.36,4.37-4.37-4.37c-.29-.29-.71-.37-1.09-.22-.37.15-.62.52-.62.92v63.49c0,4.75,3.87,8.62,8.62,8.62h21.86v4.08c0,4.75,3.87,8.62,8.62,8.62h41.91c.55,0,1-.45,1-1s-.45-1-1-1Zm-9.89-57.41c0,10.65-8.67,19.32-19.32,19.32s-19.32-8.67-19.32-19.32,8.67-19.32,19.32-19.32,19.32,8.67,19.32,19.32ZM11,71.59V10.51l3.37,3.37c.19.19.44.29.71.29s.52-.11.71-.29l4.36-4.37,4.37,4.37c.19.19.44.29.71.29s.52-.11.71-.29l4.37-4.37,4.37,4.37c.39.39,1.02.39,1.41,0l4.38-4.37,4.38,4.37c.39.39,1.02.39,1.41,0l3.38-3.38v4.86c-5.82,3.59-9.77,9.89-10.11,17.13h-14.29c-.55,0-1,.45-1,1s.45,1,1,1h14.29c.09,1.96.43,3.85,1.02,5.63-.02,0-.05-.01-.07-.01h-15.24c-.55,0-1,.45-1,1s.45,1,1,1h15.24c.27,0,.52-.11.7-.29,1.74,4.08,4.72,7.49,8.46,9.8v11.35h-16.78c-4.75,0-8.62,3.87-8.62,8.62,0,3.65-2.97,6.62-6.62,6.62s-6.62-2.97-6.62-6.62Zm12.13,6.62c1.9-1.58,3.11-3.96,3.11-6.62,0-3.65,2.97-6.62,6.62-6.62s6.62,2.97,6.62,6.62v6.62h-16.35Zm24.96,12.7c-3.65,0-6.62-2.97-6.62-6.62v-12.7c0-2.66-1.21-5.04-3.11-6.62h35.12c3.65,0,6.62,2.97,6.62,6.62v12.7c0,2.66,1.21,5.04,3.1,6.62h-35.12Z" />
              <path d="m17.62,24.33h10.16c.55,0,1-.45,1-1s-.45-1-1-1h-10.16c-.55,0-1,.45-1,1s.45,1,1,1Z" />
              <path d="m17.62,34.49h2.54c.55,0,1-.45,1-1s-.45-1-1-1h-2.54c-.55,0-1,.45-1,1s.45,1,1,1Z" />
              <path d="m17.62,42.11h2.54c.55,0,1-.45,1-1s-.45-1-1-1h-2.54c-.55,0-1,.45-1,1s.45,1,1,1Z" />
              <path d="m50.63,73.13h-2.54c-.55,0-1,.45-1,1s.45,1,1,1h2.54c.55,0,1-.45,1-1s-.45-1-1-1Z" />
              <path d="m73.49,73.13h-17.78c-.55,0-1,.45-1,1s.45,1,1,1h17.78c.55,0,1-.45,1-1s-.45-1-1-1Z" />
              <path d="m50.63,80.75h-2.54c-.55,0-1,.45-1,1s.45,1,1,1h2.54c.55,0,1-.45,1-1s-.45-1-1-1Z" />
              <path d="m73.49,80.75h-17.78c-.55,0-1,.45-1,1s.45,1,1,1h17.78c.55,0,1-.45,1-1s-.45-1-1-1Z" />
              <path d="m17.62,49.73h2.54c.55,0,1-.45,1-1s-.45-1-1-1h-2.54c-.55,0-1,.45-1,1s.45,1,1,1Z" />
              <path d="m25.24,49.73h17.78c.55,0,1-.45,1-1s-.45-1-1-1h-17.78c-.55,0-1,.45-1,1s.45,1,1,1Z" />
              <path d="m20.16,57.35c.55,0,1-.45,1-1s-.45-1-1-1h-2.54c-.55,0-1,.45-1,1s.45,1,1,1h2.54Z" />
              <path d="m43.02,55.35h-17.78c-.55,0-1,.45-1,1s.45,1,1,1h17.78c.55,0,1-.45,1-1s-.45-1-1-1Z" />
              <path d="m60.9,50.21c9.19,0,16.66-7.47,16.66-16.66s-7.47-16.66-16.66-16.66-16.66,7.47-16.66,16.66,7.47,16.66,16.66,16.66Zm0-31.32c8.08,0,14.66,6.58,14.66,14.66s-6.58,14.66-14.66,14.66-14.66-6.58-14.66-14.66,6.58-14.66,14.66-14.66Z" />
            </svg>
          </div>
          <p className={styles.statValue}>{pendingCount}</p>
          <p className={styles.statLabel}>Pending Orders</p>
          <span className={styles.statMeta} style={{ color: '#dc2626', fontWeight: 600 }}>Needs action</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>📦</div>
          <p className={styles.statValue}>0</p>
          <p className={styles.statLabel}>Ready for Courier</p>
          <span className={styles.statMeta}>Awaiting pickup</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#059669' }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
              <path d="M15 18H9" />
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
              <circle cx="17" cy="18" r="2" />
              <circle cx="7" cy="18" r="2" />
            </svg>
          </div>
          <p className={styles.statValue}>0</p>
          <p className={styles.statLabel}>Shipped Today</p>
          <span className={styles.statTrend}>+0% vs yesterday</span>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}>₱</div>
          <p className={styles.statValue}>₱{totalRevenue.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p>
          <p className={styles.statLabel}>Total Revenue</p>
          <span className={styles.statMeta}>This week</span>
        </div>
      </div>

      <div className={styles.tabRow}>
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`${styles.tabBtn} ${statusFilter === tab.id ? styles.tabBtnActive : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        placeholder="Search orders..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={styles.searchInput}
        style={{ maxWidth: 320, marginBottom: 20 }}
      />

      <div className={styles.card}>
        <div className={styles.cardBody} style={{ padding: 0 }}>
          {loading ? (
            <p className={styles.emptyState}>Loading...</p>
          ) : filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>📋</div>
              <p style={{ margin: 0 }}>No orders match your filters.</p>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94a3b8' }}>Try a different status or search term.</p>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Rider</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) =>
                  (order.items || []).map((item, idx) => (
                    <tr
                      key={`${order.id}-${idx}`}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        setSelectedOrder(order);
                        setSelectedItem(item);
                      }}
                    >
                      <td>
                        <div>#{order.order_number || order.id}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{order.created_at ? new Date(order.created_at).toLocaleString() : ''}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <img
                            src={productImageUrl(item.product?.image) || 'https://placehold.co/48x48'}
                            alt=""
                            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8 }}
                            onError={(e) => { e.target.src = 'https://placehold.co/48x48'; }}
                          />
                          <div>
                            <div style={{ fontWeight: 500 }}>{item.product?.name || 'Product'}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>Size / variant</div>
                          </div>
                        </div>
                      </td>
                      <td>{item.quantity || 1}</td>
                      <td>
                        <span className={`${styles.badge} ${styles.blue}`}>{order.status || 'Pending'}</span>
                      </td>
                      {idx === 0 ? (
                        <td
                          rowSpan={(order.items || []).length || 1}
                          style={{ verticalAlign: 'top', minWidth: 160 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {getStatus(order) === 'shipped' ? (
                            <div>
                              <label htmlFor={`seller-rider-${order.id}`} style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                                Assign rider
                              </label>
                              <select
                                id={`seller-rider-${order.id}`}
                                value={order.rider_id ? String(order.rider_id) : ''}
                                disabled={assigningRiderOrderId === order.id}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  if (!v || Number(v) === Number(order.rider_id)) return;
                                  handleAssignRider(order.id, Number(v));
                                }}
                                style={{
                                  width: '100%',
                                  maxWidth: 200,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  fontSize: 13,
                                }}
                              >
                                <option value="">Select rider…</option>
                                {fleetRiders.map((r) => (
                                  <option key={r.id} value={String(r.id)}>
                                    {r.name}
                                    {r.status === 'busy' ? ' (busy)' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : order.rider?.user?.name ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#0f172a' }}>
                              <Bike size={16} strokeWidth={2} aria-hidden />
                              {order.rider.user.name}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                      ) : null}
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                          {idx === 0 && (
                            <>
                              {['pending', 'confirmed', 'processing'].includes(getStatus(order)) && (
                                <button
                                  type="button"
                                  className={styles.primaryButton}
                                  style={{ padding: '6px 12px', fontSize: 13 }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateStatus(order.id, 'shipped');
                                  }}
                                  disabled={updatingOrderId === order.id}
                                >
                                  {updatingOrderId === order.id ? '…' : 'Mark Shipped'}
                                </button>
                              )}
                              {getStatus(order) === 'shipped' && (
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#64748b',
                                    padding: '6px 10px',
                                    background: '#f1f5f9',
                                    borderRadius: 8,
                                  }}
                                  title="Only the assigned rider can mark this order delivered"
                                >
                                  Awaiting rider delivery
                                </span>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            style={{ padding: '6px 12px', fontSize: 13 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // future: open print preview
                            }}
                          >
                            Print Label
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {filtered.length > 0 && (
        <p style={{ fontSize: 14, color: '#6b7280', marginTop: 16 }}>
          Showing 1–{Math.min(filtered.length, 10)} of {filtered.length} orders
        </p>
      )}
      {selectedOrder && selectedItem && (
        <div className={styles.modalOverlay} onClick={() => { setSelectedOrder(null); setSelectedItem(null); }}>
          <div
            className={styles.modal}
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Order details</h2>
            <p style={{ fontSize: 14, color: '#6b7280', marginTop: -8, marginBottom: 16 }}>
              #{selectedOrder.order_number || selectedOrder.id}
            </p>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <img
                src={productImageUrl(selectedItem.product?.image) || 'https://placehold.co/96x96'}
                alt=""
                style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10 }}
                onError={(e) => { e.target.src = 'https://placehold.co/96x96'; }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  {selectedItem.product?.name || 'Product'}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
                  Qty {selectedItem.quantity || 1}
                </div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Status:{' '}
                  <span style={{ textTransform: 'capitalize' }}>
                    {selectedOrder.status || 'pending'}
                  </span>
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12, marginTop: 4 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px', color: '#111827' }}>
                Customer
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Name</p>
              <p style={{ margin: '2px 0 8px', fontSize: 14, color: '#111827' }}>
                {selectedOrder.customer?.name || 'Customer'}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Address</p>
              <p style={{ margin: '2px 0 8px', fontSize: 14, color: '#111827' }}>
                {selectedOrder.shipping_address || 'No address on file'}
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Price</p>
              <p style={{ margin: '2px 0 0', fontSize: 14, color: '#111827', fontWeight: 600 }}>
                ₱
                {(
                  (parseFloat(selectedItem.price) || 0) * (selectedItem.quantity || 1)
                ).toFixed(2)}
              </p>
              {selectedOrder.received_by && (
                <>
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: '#6b7280' }}>Received by</p>
                  <p style={{ margin: '2px 0 0', fontSize: 14, color: '#111827' }}>
                    {selectedOrder.received_by}
                  </p>
                </>
              )}
              {selectedOrder.customer_feedback && (
                <>
                  <p style={{ margin: '10px 0 0', fontSize: 13, color: '#6b7280' }}>Customer feedback</p>
                  <p style={{ margin: '2px 0 0', fontSize: 14, color: '#111827', whiteSpace: 'pre-wrap' }}>
                    {selectedOrder.customer_feedback}
                  </p>
                </>
              )}
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setSelectedOrder(null);
                  setSelectedItem(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}
