import { useEffect, useState } from 'react';
import Link from 'next/link';
import SellerLayout from '@/components/seller/SellerLayout';
import {
  fetchSellerProducts,
  updateSellerProduct,
  fetchCategories,
  createSellerProduct,
  deleteSellerProduct,
  fetchSellerOrders,
} from '@/services/api';
import { productImageUrl } from '@/utils/image';
import styles from '@/styles/sellerPortal.module.scss';

const emptyProduct = { name: '', description: '', price: '', stock: '', category_id: '', image: '', sizes: '' };

function riderDeliverySummary(order) {
  const name = order?.rider?.user?.name?.trim();
  if (name) {
    const bits = [order?.rider?.phone, order?.rider?.vehicle_plate].filter(Boolean);
    return { title: name, detail: bits.length ? bits.join(' · ') : null };
  }
  if (order?.rider_id) {
    return {
      title: 'Rider on file',
      detail: [order?.rider?.phone, order?.rider?.vehicle_plate].filter(Boolean).join(' · ') || null,
    };
  }
  return { title: null, detail: null };
}

export default function SellerInventory() {
  const [products, setProducts] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [selectedCompletedOrder, setSelectedCompletedOrder] = useState(null);
  const [showAllCompletedOrders, setShowAllCompletedOrders] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [stockEdits, setStockEdits] = useState({});

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [productsRes, catRes, ordersRes] = await Promise.all([
        fetchSellerProducts(),
        fetchCategories().catch(() => ({ data: [] })),
        fetchSellerOrders().catch(() => ({ data: { orders: [] } })),
      ]);
      const rawProducts = productsRes.data.products || [];
      setProducts(
        rawProducts.map((p) => ({
          ...p,
          image:
            productImageUrl(p.image) ||
            'https://placehold.co/56x56?text=' +
              encodeURIComponent(p.name || 'Product'),
        })),
      );
      setCategories(Array.isArray(catRes.data) ? catRes.data : catRes.data?.data || []);
      const allOrders = ordersRes.data?.orders || [];
      const delivered = allOrders.filter((o) => {
        const s = (o.status || '').toLowerCase();
        return s === 'delivered' || s === 'completed';
      });
      setCompletedOrders(delivered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const persistStockChange = async (product, newStock) => {
    try {
      await updateSellerProduct(product.id, { stock: newStock });
      setStockEdits((prev) => {
        const next = { ...prev };
        delete next[product.id];
        return next;
      });
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || (filterStatus === 'live' && (p.stock ?? 0) > 0) || (filterStatus === 'out' && (p.stock ?? 0) === 0);
    const matchCat = filterCategory === 'all' || String(p.category_id) === filterCategory;
    return matchSearch && matchStatus && matchCat;
  });

  const openAdd = () => {
    setEditingProduct(null);
    setForm(emptyProduct);
    setError('');
    setShowModal(true);
  };

  const openEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      stock: String(p.stock),
      category_id: String(p.category_id || ''),
      image: p.image || '',
      sizes: Array.isArray(p.sizes) && p.sizes.length ? p.sizes.join(', ') : (p.sizes || ''),
    });
    setError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitLoading(true);
    try {
      const sizesArr = form.sizes ? form.sizes.split(',').map((s) => s.trim()).filter(Boolean) : null;
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        stock: parseInt(form.stock, 10),
        category_id: parseInt(form.category_id, 10),
        image: form.image.trim() || null,
        sizes: sizesArr && sizesArr.length ? sizesArr : null,
      };
      if (editingProduct) {
        await updateSellerProduct(editingProduct.id, payload);
      } else {
        await createSellerProduct(payload);
      }
      await load();
      setShowModal(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleStockChange = async (product, delta) => {
    const base = stockEdits[product.id] ?? product.stock ?? 0;
    const newStock = Math.max(0, base + delta);
    await persistStockChange(product, newStock);
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await deleteSellerProduct(p.id);
      await load();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (p) => {
    const stock = p.stock ?? 0;
    if (stock === 0) return { label: 'Out of Stock', className: styles.blue };
    if (stock <= 5) return { label: 'Low Stock', className: styles.orange };
    return { label: '• Live', className: styles.green };
  };

  return (
    <SellerLayout>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/seller">Home</Link>
        <span> / Inventory</span>
      </div>
      <div className={styles.actionRow}>
        <div>
          <h1 className={styles.pageTitle}>My Inventory</h1>
          <p className={styles.pageSubtitle}>Manage your products and stock levels.</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={openAdd}>
          + Quick Add Product
        </button>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Completed Orders</h2>
          <button
            type="button"
            className={styles.secondaryButton}
            style={{ padding: '6px 14px', fontSize: 13 }}
            onClick={() => setShowAllCompletedOrders(true)}
          >
            View completed orders
          </button>
        </div>
        <div className={styles.cardBody} style={{ paddingTop: 16 }}>
          {loading ? (
            <p className={styles.emptyState}>Loading...</p>
          ) : completedOrders.length === 0 ? (
            <div className={styles.emptyState} style={{ padding: 20 }}>
              <p style={{ margin: 0 }}>No completed orders yet.</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>Delivered orders will appear here.</p>
            </div>
          ) : (
            <>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {completedOrders.slice(0, 5).map((o) => {
                const firstItem = (o.items || [])[0];
                const total = (o.items || []).reduce((s, i) => s + (parseFloat(i.price) || 0) * (i.quantity || 1), 0);
                return (
                  <li
                    key={o.id}
                    className={styles.completedOrderRow}
                    onClick={() => setSelectedCompletedOrder(o)}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>#{o.order_number || o.id}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</div>
                      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img
                          src={productImageUrl(firstItem?.product?.image) || 'https://placehold.co/36x36'}
                          alt=""
                          width={28}
                          height={28}
                          style={{ borderRadius: 6, objectFit: 'cover' }}
                          onError={(e) => { e.target.src = 'https://placehold.co/36x36'; }}
                        />
                        <span style={{ fontSize: 12, color: '#475569' }}>
                          {firstItem?.product?.name || 'Product'}
                        </span>
                      </div>
                    </div>
                    <span className={`${styles.badge} ${styles.green} ${styles.completedOrderRowStatus}`}>Delivered</span>
                    <div className={styles.completedOrderRowTotal}>₱{total.toFixed(2)}</div>
                  </li>
                );
              })}
            </ul>
            {completedOrders.length > 5 && (
              <p style={{ margin: '12px 0 0', fontSize: 13, fontWeight: 500, color: '#64748b' }}>
                Showing 5 of {completedOrders.length} — use &quot;View completed orders&quot; for the full list.
              </p>
            )}
            </>
          )}
        </div>
      </div>

      {showAllCompletedOrders && (
        <div className={styles.modalOverlay} onClick={() => setShowAllCompletedOrders(false)}>
          <div className={styles.modal} style={{ maxWidth: 720 }} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>All completed orders</h2>
            <p style={{ marginTop: -8, color: '#64748b', fontSize: 13, marginBottom: 14 }}>
              Total completed orders: {completedOrders.length}
            </p>
            {completedOrders.length === 0 ? (
              <p className={styles.emptyState}>No completed orders yet.</p>
            ) : (
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {completedOrders.map((o) => {
                    const firstItem = (o.items || [])[0];
                    const total = (o.items || []).reduce((s, i) => s + (parseFloat(i.price) || 0) * (i.quantity || 1), 0);
                    return (
                      <li
                        key={`all-${o.id}`}
                        className={styles.completedOrderRow}
                        onClick={() => {
                          setSelectedCompletedOrder(o);
                          setShowAllCompletedOrders(false);
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>#{o.order_number || o.id}</div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</div>
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img
                              src={productImageUrl(firstItem?.product?.image) || 'https://placehold.co/36x36'}
                              alt=""
                              width={28}
                              height={28}
                              style={{ borderRadius: 6, objectFit: 'cover' }}
                              onError={(e) => { e.target.src = 'https://placehold.co/36x36'; }}
                            />
                            <span style={{ fontSize: 12, color: '#475569' }}>
                              {firstItem?.product?.name || 'Product'}
                            </span>
                          </div>
                        </div>
                        <span className={`${styles.badge} ${styles.green} ${styles.completedOrderRowStatus}`}>Delivered</span>
                        <div className={styles.completedOrderRowTotal}>₱{total.toFixed(2)}</div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className={styles.secondaryButton} onClick={() => setShowAllCompletedOrders(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCompletedOrder && (
        <div className={styles.modalOverlay} onClick={() => setSelectedCompletedOrder(null)}>
          <div className={styles.modal} style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Completed order details</h2>
            <p style={{ marginTop: -8, color: '#64748b', fontSize: 13 }}>
              #{selectedCompletedOrder.order_number || selectedCompletedOrder.id}
            </p>
            {(selectedCompletedOrder.items || []).map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <img
                    src={productImageUrl(item.product?.image) || 'https://placehold.co/48x48'}
                    alt=""
                    width={48}
                    height={48}
                    style={{ borderRadius: 8, objectFit: 'cover' }}
                    onError={(e) => { e.target.src = 'https://placehold.co/48x48'; }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.product?.name || 'Product'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>Qty {item.quantity || 1}</div>
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>
                  ₱{((parseFloat(item.price) || 0) * (item.quantity || 1)).toFixed(2)}
                </div>
              </div>
            ))}
            {(() => {
              const r = riderDeliverySummary(selectedCompletedOrder);
              return (
                <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
                  <strong>Delivered by (rider):</strong>{' '}
                  {r.title ? (
                    <span>{r.title}</span>
                  ) : (
                    <span style={{ color: '#94a3b8', fontWeight: 500 }}>Not assigned or not recorded</span>
                  )}
                  {r.detail ? (
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{r.detail}</div>
                  ) : null}
                </div>
              );
            })()}
            {selectedCompletedOrder.received_by && (
              <div style={{ marginTop: 12, fontSize: 14, color: '#334155' }}>
                <strong>Received by:</strong> {selectedCompletedOrder.received_by}
              </div>
            )}
            {selectedCompletedOrder.customer_feedback && (
              <div style={{ marginTop: 8, fontSize: 14, color: '#334155', whiteSpace: 'pre-wrap' }}>
                <strong>Customer feedback:</strong> {selectedCompletedOrder.customer_feedback}
              </div>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className={styles.secondaryButton} onClick={() => setSelectedCompletedOrder(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          type="search"
          placeholder="Search by product name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="all">Status: All</option>
          <option value="live">Live</option>
          <option value="out">Out of Stock</option>
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={styles.filterSelect}
        >
          <option value="all">Category: All</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className={styles.card}>
        <div className={styles.cardBody} style={{ padding: 0 }}>
          {loading ? (
            <p className={styles.emptyState}>Loading...</p>
          ) : filteredProducts.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyStateIcon}>📦</div>
              <p style={{ margin: 0 }}>No products match.</p>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94a3b8' }}>Try different filters or add your first product above.</p>
            </div>
          ) : (
            <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stock Level</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const status = getStatusBadge(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <img
                            src={p.image || 'https://placehold.co/56x56?text=No+Image'}
                            alt=""
                            style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8 }}
                            onError={(e) => { e.target.src = 'https://placehold.co/56x56'; }}
                          />
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>SKU: {p.slug?.toUpperCase() || p.id}</div>
                          </div>
                        </div>
                      </td>
                      <td>₱{parseFloat(p.price).toFixed(2)}</td>
                      <td>
                        <div className={styles.stockControl}>
                          <button type="button" onClick={() => handleStockChange(p, -1)} aria-label="Decrease stock">−</button>
                          <input
                            type="number"
                            min={0}
                            value={stockEdits[p.id] ?? (p.stock ?? 0)}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const parsed = parseInt(raw, 10);
                              const safe = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
                              setStockEdits((prev) => ({ ...prev, [p.id]: safe }));
                            }}
                            onBlur={async (e) => {
                              const parsed = parseInt(e.target.value, 10);
                              const safe = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
                              if (safe === (p.stock ?? 0)) return;
                              await persistStockChange(p, safe);
                            }}
                          />
                          <button type="button" onClick={() => handleStockChange(p, 1)} aria-label="Increase stock">+</button>
                        </div>
                        {(p.stock ?? 0) <= 5 && (p.stock ?? 0) > 0 && <div style={{ fontSize: 12, color: '#d97706', marginTop: 4 }}>Low Stock</div>}
                        {(p.stock ?? 0) === 0 && <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>Out of Stock</div>}
                      </td>
                      <td><span className={`${styles.badge} ${status.className}`}>{status.label}</span></td>
                      <td>
                        <button type="button" className={styles.secondaryButton} style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => openEdit(p)}>Edit</button>
                        <button type="button" className={styles.dangerBtn} style={{ marginLeft: 8 }} onClick={() => handleDelete(p)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add Product'}</h2>
            {error && <p style={{ color: '#dc2626', marginBottom: 12, fontSize: 14 }}>{error}</p>}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label className={styles.formLabel}>Name *</label>
                <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Product name" className={styles.formInput} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className={styles.formLabel}>Price (₱) *</label>
                <input type="number" step="0.01" min={0} required value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} className={styles.formInput} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className={styles.formLabel}>Stock *</label>
                <input type="number" min={0} required value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} className={styles.formInput} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className={styles.formLabel}>Category *</label>
                <select required value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))} className={styles.formInput}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className={styles.formLabel}>Sizes</label>
                <input value={form.sizes} onChange={(e) => setForm((f) => ({ ...f, sizes: e.target.value }))} placeholder="e.g. S, M, L, XL" className={styles.formInput} />
                <span className={styles.formHint}>Comma-separated. Leave empty if no sizes.</span>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label className={styles.formLabel}>Image URL</label>
                <input value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} placeholder="https://..." className={styles.formInput} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="submit" className={styles.primaryButton} disabled={submitLoading}>{submitLoading ? 'Saving...' : 'Save'}</button>
                <button type="button" className={styles.secondaryButton} onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </SellerLayout>
  );
}
