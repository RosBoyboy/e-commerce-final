import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Heart, Phone, ShoppingBag, UserCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { useWishlist } from '@/context/WishlistContext';
import { useCart, CartAddBlockedError } from '@/context/CartContext';
import { fetchCustomerOrders, fetchProducts, updateOrderStatus } from '@/services/api';
import { useToast } from '@/components/ui/ToastProvider';
import { useMessageUnread } from '@/context/MessageUnreadContext';
import { productImageUrl } from '@/utils/image';
import CustomerShell from '@/components/layout/CustomerShell';
import styles from '@/styles/dashboard.module.scss';

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const COLORS = [
  { name: 'Black', hex: '#111' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'White', hex: '#f3f4f6' },
  { name: 'Gray', hex: '#6b7280' },
  { name: 'Brown', hex: '#92400e' },
  { name: 'Red', hex: '#dc2626' },
];
const CATEGORIES = ['Men', 'Women', 'Kids'];

function formatOrderStatusDisplay(statusRaw) {
  if ((statusRaw || '').toLowerCase() === 'delivered') return 'Completed';
  return statusRaw || '—';
}

export default function CustomerDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { loading } = useProtectedRoute('customer');
  const { wishlistIds, removeFromWishlist, addToWishlist, isInWishlist } = useWishlist();
  const { addItem, items: cartItems } = useCart();
  const cartCount = cartItems.reduce((sum, i) => sum + i.quantity, 0);
  const { showToast } = useToast();
  const { refreshUnread } = useMessageUnread();
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [wishlistProducts, setWishlistProducts] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSize, setFilterSize] = useState('');
  const [filterColor, setFilterColor] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [orderFilter, setOrderFilter] = useState('all');
  const [selectedSize, setSelectedSize] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receivingOrder, setReceivingOrder] = useState(null);
  const [receiverName, setReceiverName] = useState('');
  const [receiverComment, setReceiverComment] = useState('');
  const [updatingReceived, setUpdatingReceived] = useState(false);
  const [showReceiveSuccess, setShowReceiveSuccess] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    address: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [securityExpanded, setSecurityExpanded] = useState(false);

  useEffect(() => {
    const q = router.query.tab;
    const t = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : '';
    if (['orders', 'wishlist', 'profile'].includes(t)) setActiveTab(t);
    else setActiveTab('overview');
  }, [router.query.tab]);

  useEffect(() => {
    if (user && user.role?.name === 'customer') {
      fetchOrders();
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === 'wishlist' && wishlistIds.length > 0) {
      const load = async () => {
        setWishlistLoading(true);
        try {
          const { data } = await fetchProducts();
          const all = (data || []).map((p) => ({
            ...p,
            image: productImageUrl(p.image) || 'https://placehold.co/400x500?text=' + encodeURIComponent(p.name || ''),
          }));
          setWishlistProducts(all.filter((p) => wishlistIds.includes(p.id)));
        } catch (e) {
          console.error('Failed to load wishlist products', e);
        } finally {
          setWishlistLoading(false);
        }
      };
      load();
    } else if (activeTab === 'wishlist') {
      setWishlistProducts([]);
    }
  }, [activeTab, wishlistIds]);

  useEffect(() => {
    if (activeTab === 'overview') {
      const load = async () => {
        setProductsLoading(true);
        try {
          const { data } = await fetchProducts();
          setProducts(
            (data || []).map((p) => ({
              ...p,
              image: productImageUrl(p.image) || 'https://placehold.co/400x500?text=' + encodeURIComponent(p.name || ''),
              sizes: Array.isArray(p.sizes) ? p.sizes : ['S', 'M', 'L', 'XL'],
            })),
          );
        } catch (e) {
          console.error('Failed to load products', e);
        } finally {
          setProductsLoading(false);
        }
      };
      load();
    }
  }, [activeTab]);

  const fetchOrders = async () => {
    setOrdersLoading(true);
    try {
      const { data } = await fetchCustomerOrders();
      const nextOrders = data.orders || [];
      setOrders(nextOrders);
      setSelectedOrder((prev) => {
        if (!prev) return prev;
        return nextOrders.find((o) => o.id === prev.id) || prev;
      });
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const totalSpent = orders.reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

  const getOrderStatus = (order) => (order.status || '').toLowerCase();
  const isAwaitingReceipt = (order) => {
    const status = getOrderStatus(order);
    return status === 'shipped' || (status === 'delivered' && !order.received_by);
  };

  const orderCounts = {
    all: orders.length,
    toShip: orders.filter((o) => ['pending', 'confirmed', 'processing'].includes(getOrderStatus(o))).length,
    toReceive: orders.filter((o) => isAwaitingReceipt(o)).length,
    completed: orders.filter((o) => getOrderStatus(o) === 'delivered' && !!o.received_by).length,
    cancelled: orders.filter((o) => getOrderStatus(o) === 'cancelled').length,
  };

  const filteredOrders = orders.filter((order) => {
    const s = getOrderStatus(order);
    if (orderFilter === 'all') return true;
    if (orderFilter === 'to-ship') return ['pending', 'confirmed', 'processing'].includes(s);
    if (orderFilter === 'to-receive') return isAwaitingReceipt(order);
    if (orderFilter === 'completed') return s === 'delivered' && !!order.received_by;
    if (orderFilter === 'cancelled') return s === 'cancelled';
    return true;
  });

  const [cancellingId, setCancellingId] = useState(null);
  const handleCancelOrder = async (order) => {
    const status = getOrderStatus(order);
    if (!['pending', 'confirmed', 'processing'].includes(status)) return;
    if (!confirm('Cancel this order? This cannot be undone.')) return;
    setCancellingId(order.id);
    try {
      await updateOrderStatus(order.id, 'cancelled');
      await fetchOrders();
    } catch (err) {
      console.error(err);
      showToast({
        message: err.response?.data?.message || 'Failed to cancel order.',
        type: 'error',
      });
    } finally {
      setCancellingId(null);
    }
  };

  let filteredProducts = products;
  if (filterCategory) {
    filteredProducts = filteredProducts.filter((p) => p.category === filterCategory);
  }
  if (priceMin !== '') {
    const min = parseFloat(priceMin);
    if (!isNaN(min)) filteredProducts = filteredProducts.filter((p) => Number(p.price) >= min);
  }
  if (priceMax !== '') {
    const max = parseFloat(priceMax);
    if (!isNaN(max)) filteredProducts = filteredProducts.filter((p) => Number(p.price) <= max);
  }
  if (sortBy === 'price-asc') {
    filteredProducts = [...filteredProducts].sort((a, b) => Number(a.price) - Number(b.price));
  } else if (sortBy === 'price-desc') {
    filteredProducts = [...filteredProducts].sort((a, b) => Number(b.price) - Number(a.price));
  } else {
    filteredProducts = [...filteredProducts].sort((a, b) => (b.id || 0) - (a.id || 0));
  }

  const handleSizeChange = (productId, size) => {
    setSelectedSize((prev) => ({ ...prev, [productId]: size }));
  };

  const handleAddToCart = async (e, product) => {
    e.preventDefault();
    if (!user) {
      router.push('/auth/login');
      return;
    }
    const size = selectedSize[product.id];
    if (!size) {
      showToast({ message: 'Please select a size first.', type: 'error' });
      return;
    }
    try {
      await addItem(product, { size, quantity: 1 });
      showToast({
        message: `Added ${product.name} (Size: ${size}) to your cart.`,
        type: 'success',
        actionLabel: 'View cart',
        onAction: () => router.push('/cart'),
      });
    } catch (e) {
      if (e instanceof CartAddBlockedError) return;
      showToast({ message: 'Could not add to cart. Try again.', type: 'error' });
    }
  };

  const openReceiveDialog = (order) => {
    setReceivingOrder(order);
    setReceiverName(user.name || '');
    setReceiverComment(order.customer_feedback || '');
    setShowReceiveSuccess(false);
  };

  const handleConfirmReceived = async (e) => {
    e.preventDefault();
    if (!receivingOrder) return;
    setUpdatingReceived(true);
    try {
      await updateOrderStatus(receivingOrder.id, 'delivered', {
        received_by: receiverName.trim() || user.name || '',
        customer_feedback: receiverComment.trim(),
      });
      await fetchOrders();
      await refreshUnread();
      setShowReceiveSuccess(true);
      setTimeout(() => {
        setReceivingOrder(null);
        setReceiverName('');
        setReceiverComment('');
        setShowReceiveSuccess(false);
      }, 1200);
    } catch (e) {
      showToast({
        message: e.response?.data?.message || 'Failed to update.',
        type: 'error',
      });
    } finally {
      setUpdatingReceived(false);
    }
  };

  const startEditProfile = () => {
    setProfileForm({
      name: user.name || '',
      phone: user.phone || '',
      address: user.address || '',
    });
    setIsEditingProfile(true);
  };

  const cancelEditProfile = () => {
    setIsEditingProfile(false);
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      // TODO: wire up real API endpoint when available.
      // For now we just show success feedback and close edit mode.
      showToast({
        message: 'Profile updated successfully.',
        type: 'success',
      });
      setIsEditingProfile(false);
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.current_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      showToast({ message: 'Please fill in all password fields.', type: 'error' });
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast({ message: 'New passwords do not match.', type: 'error' });
      return;
    }
    setSavingPassword(true);
    try {
      // TODO: call backend password update endpoint.
      showToast({
        message: 'Password updated successfully.',
        type: 'success',
      });
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Dashboard - urbanNxt</title>
      </Head>
      <CustomerShell
        activeKey={activeTab === 'orders' ? 'orders' : activeTab === 'wishlist' ? 'wishlist' : activeTab === 'profile' ? 'profile' : 'overview'}
        sidebarExtra={
          activeTab === 'overview' ? (
            <>
              <div className={styles.filterSectionPro}>
                <div className={styles.sectionTitle}>Categories</div>
                <div className={styles.categoryList}>
                  <label>
                    <input
                      type="radio"
                      name="cat"
                      checked={filterCategory === ''}
                      onChange={() => setFilterCategory('')}
                    />
                    All
                  </label>
                  {CATEGORIES.map((c) => (
                    <label key={c}>
                      <input
                        type="radio"
                        name="cat"
                        checked={filterCategory === c}
                        onChange={() => setFilterCategory(c)}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.filterSectionPro}>
                <div className={styles.sectionTitle}>Size</div>
                <select
                  value={filterSize}
                  onChange={(e) => setFilterSize(e.target.value)}
                  className={styles.sizeDropdown}
                >
                  <option value="">All</option>
                  {SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className={styles.filterSectionPro}>
                <div className={styles.sectionTitle}>Color</div>
                <div className={styles.colorSwatches}>
                  {COLORS.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      className={`${styles.colorDot} ${filterColor === c.name ? styles.active : ''}`}
                      style={{ background: c.hex }}
                      title={c.name}
                      onClick={() => setFilterColor(filterColor === c.name ? '' : c.name)}
                    />
                  ))}
                </div>
              </div>
              <div className={styles.filterSectionPro}>
                <div className={styles.sectionTitle}>Price</div>
                <div className={styles.priceInputs}>
                  <input
                    type="number"
                    placeholder="0"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    min="0"
                  />
                  <input
                    type="number"
                    placeholder="500"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    min="0"
                  />
                </div>
              </div>
            </>
          ) : null
        }
      >
        <div className={styles.customerPageHeading}>
          <div className={styles.customerPageHeadingText}>
            <h1>
              {activeTab === 'overview'
                ? `Welcome back, ${user.name?.split(' ')[0] || 'there'}`
                : activeTab === 'orders'
                  ? 'My orders'
                  : activeTab === 'wishlist'
                    ? 'Wishlist'
                    : 'Profile'}
            </h1>
            <p className={styles.subtitle}>
              {activeTab === 'overview' && 'Shop the latest drop—curated streetwear, refined.'}
              {activeTab === 'orders' && 'Track shipments and confirm delivery when your package arrives.'}
              {activeTab === 'wishlist' && 'Pieces you are considering—save them for later.'}
              {activeTab === 'profile' && 'Your details and security, in one place.'}
            </p>
          </div>
          <Link
            href="/cart"
            className={styles.customerHeadingCart}
            aria-label={cartCount > 0 ? `Cart, ${cartCount} items` : 'Cart, empty'}
          >
            <ShoppingBag size={22} strokeWidth={1.5} className={styles.customerHeadingCartIcon} aria-hidden />
            {cartCount > 0 && (
              <span className={styles.customerHeadingCartBadge}>{cartCount > 99 ? '99+' : cartCount}</span>
            )}
          </Link>
        </div>

        <div className={styles.mainPro}>
            {activeTab === 'overview' && (
              <>
                <div className={styles.sortRowPro}>
                  <label htmlFor="customer-catalog-sort" className={styles.sortRowLabel}>
                    Sort by
                  </label>
                  <select
                    id="customer-catalog-sort"
                    className={styles.sortRowSelect}
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="newest">Newest arrivals</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                  </select>
                </div>
                {productsLoading ? (
                  <p>Loading products...</p>
                ) : (
                  <div className={styles.productGridPro}>
                    {filteredProducts.map((product, idx) => (
                      <div key={product.id} className={styles.productCardPro}>
                        <div className={styles.imageWrap}>
                          <Link href={`/product/${product.id}`}>
                            <img src={product.image} alt={product.name} onError={(e) => { e.target.src = 'https://placehold.co/400x500'; }} />
                          </Link>
                          {idx % 3 === 0 && <span className={styles.badgeNew}>NEW</span>}
                          {idx % 3 === 1 && <span className={styles.badgeSale}>-20%</span>}
                          <button
                            type="button"
                            className={`${styles.wishBtn} ${isInWishlist(product.id) ? styles.active : ''}`}
                            onClick={() => (isInWishlist(product.id) ? removeFromWishlist(product.id) : addToWishlist(product.id))}
                            aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                          >
                            <Heart size={18} strokeWidth={1.5} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                        <div className={styles.cardBody}>
                          <Link href={`/product/${product.id}`}><h3 className={styles.cardTitle}>{product.name}</h3></Link>
                          <p className={styles.cardCategory}>{product.category}</p>
                          <label className={styles.sizeLabel}>Size</label>
                          <select
                            className={styles.sizeSelect}
                            value={selectedSize[product.id] || ''}
                            onChange={(e) => handleSizeChange(product.id, e.target.value)}
                          >
                            <option value="">Select Size</option>
                            {(Array.isArray(product.sizes) ? product.sizes : ['S', 'M', 'L', 'XL']).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          <div className={styles.priceRow}>
                            <span className={styles.price}>₱{Number(product.price).toFixed(2)}</span>
                            {idx % 3 === 1 && <span className={styles.oldPrice}>₱{(Number(product.price) * 1.25).toFixed(2)}</span>}
                          </div>
                          {(product.stock ?? 0) < 1 && (
                            <p
                              style={{
                                margin: '8px 0 0',
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#b91c1c',
                              }}
                              role="alert"
                            >
                              Out of stock
                            </p>
                          )}
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            style={{ width: '100%', marginTop: 8 }}
                            onClick={(e) => handleAddToCart(e, product)}
                            disabled={(product.stock ?? 0) < 1}
                            aria-disabled={(product.stock ?? 0) < 1}
                          >
                            {(product.stock ?? 0) < 1 ? 'Out of stock' : 'Add to Cart'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!productsLoading && filteredProducts.length === 0 && (
                  <p className={styles.emptyState}>No products match your filters. <Link href="/products">Browse all</Link></p>
                )}
              </>
            )}

            {activeTab === 'orders' && (
              <div className={styles.mainContent}>
                {ordersLoading ? (
                  <p>Loading orders...</p>
                ) : (
                  <>
                    <div className={styles.orderFilters}>
                      <button
                        type="button"
                        className={`${styles.orderFilterBtn} ${orderFilter === 'all' ? styles.active : ''}`}
                        onClick={() => setOrderFilter('all')}
                      >
                        <span className={styles.orderFilterLabel}>All</span>
                        <span className={styles.orderFilterCount}>{orderCounts.all}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.orderFilterBtn} ${orderFilter === 'to-ship' ? styles.active : ''}`}
                        onClick={() => setOrderFilter('to-ship')}
                      >
                        <span className={styles.orderFilterLabel}>To Ship</span>
                        <span className={styles.orderFilterCount}>{orderCounts.toShip}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.orderFilterBtn} ${orderFilter === 'to-receive' ? styles.active : ''}`}
                        onClick={() => setOrderFilter('to-receive')}
                      >
                        <span className={styles.orderFilterLabel}>To Receive</span>
                        <span className={styles.orderFilterCount}>{orderCounts.toReceive}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.orderFilterBtn} ${orderFilter === 'completed' ? styles.active : ''}`}
                        onClick={() => setOrderFilter('completed')}
                      >
                        <span className={styles.orderFilterLabel}>Completed</span>
                        <span className={styles.orderFilterCount}>{orderCounts.completed}</span>
                      </button>
                      <button
                        type="button"
                        className={`${styles.orderFilterBtn} ${orderFilter === 'cancelled' ? styles.active : ''}`}
                        onClick={() => setOrderFilter('cancelled')}
                      >
                        <span className={styles.orderFilterLabel}>Cancelled</span>
                        <span className={styles.orderFilterCount}>{orderCounts.cancelled}</span>
                      </button>
                    </div>
                    {orders.length === 0 ? (
                      <p className={styles.emptyState}>
                        No orders yet. <Link href="/products">Start shopping!</Link>
                      </p>
                    ) : filteredOrders.length === 0 ? (
                      <p className={styles.emptyState}>
                        No orders in this status. Try a different filter.
                      </p>
                    ) : (
                      <div className={styles.ordersList}>
                        {filteredOrders.map((order) => {
                          const status = getOrderStatus(order);
                          const canCancel = ['pending', 'confirmed', 'processing'].includes(status);
                          const canMarkDelivered = isAwaitingReceipt(order);
                          return (
                            <div
                              key={order.id}
                              className={styles.orderCard}
                              onClick={() => setSelectedOrder(order)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className={styles.orderHeader}>
                                <h3>Order #{order.order_number}</h3>
                                <span className={`${styles.status} ${styles[status]}`}>
                                  {formatOrderStatusDisplay(order.status)}
                                </span>
                              </div>
                              <p>Date: {new Date(order.created_at).toLocaleDateString()}</p>
                              <p>Total: ₱{parseFloat(order.total_amount).toFixed(2)}</p>
                              <p>Payment Status: {order.payment_status}</p>
                              {status === 'delivered' && order.received_by && (
                                <p>
                                  Received by: <strong>{order.received_by}</strong>
                                </p>
                              )}
                              <div className={styles.orderActions}>
                                {canMarkDelivered && (
                                  <button
                                    type="button"
                                    className={styles.orderPrimaryCta}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openReceiveDialog(order);
                                    }}
                                  >
                                    Confirm delivery
                                  </button>
                                )}
                                {canCancel && (
                                  <button
                                    type="button"
                                    className={styles.orderCancelLink}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelOrder(order);
                                    }}
                                    disabled={cancellingId === order.id}
                                  >
                                    {cancellingId === order.id ? 'Cancelling…' : 'Cancel this order'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'wishlist' && (
              <div className={styles.mainContent}>
                {wishlistLoading ? (
                  <p>Loading wishlist...</p>
                ) : wishlistProducts.length > 0 ? (
                  <div className={styles.ordersList}>
                    {wishlistProducts.map((product) => (
                      <div key={product.id} className={styles.wishlistRowCard}>
                        <img
                          className={styles.wishlistRowThumb}
                          src={product.image}
                          alt={product.name}
                          onError={(e) => { e.target.src = 'https://placehold.co/80x100'; }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link href={`/product/${product.id}`} style={{ fontWeight: 700, color: '#111827', textDecoration: 'none' }}>{product.name}</Link>
                          <p style={{ margin: '6px 0 0', color: '#64748b', fontWeight: 300, fontSize: '0.9rem' }}>₱{Number(product.price).toFixed(2)}</p>
                        </div>
                        <button type="button" onClick={() => removeFromWishlist(product.id)} className={styles.secondaryBtn}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyState}>Your wishlist is empty. <Link href="/products">Browse products</Link></p>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className={styles.mainContent}>
                <div className={styles.profileLayout}>
                  <div className={styles.profileSidebar}>
                    <div className={styles.profileAvatarCircle}>
                      {user.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className={styles.profileMeta}>
                      <div className={styles.profileName}>{user.name}</div>
                      <div className={styles.profileSince}>User since 2024</div>
                    </div>
                  </div>
                  <div className={styles.profileColumns}>
                    <div className={styles.profileCard}>
                      <div className={styles.profileCardHeader}>
                        <div>
                          <h2>Personal Information</h2>
                          <p>Update your contact details.</p>
                        </div>
                        {!isEditingProfile && (
                          <button
                            type="button"
                            className={styles.primaryBtn}
                            onClick={startEditProfile}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                      <form onSubmit={handleSaveProfile}>
                        <div className={styles.profileFormRow}>
                          <div className={styles.formGroup}>
                            <label htmlFor="name">Full Name</label>
                            {isEditingProfile ? (
                              <input
                                id="name"
                                name="name"
                                value={profileForm.name}
                                onChange={handleProfileChange}
                                required
                              />
                            ) : (
                              <p>{user.name}</p>
                            )}
                          </div>
                          <div className={styles.formGroup}>
                            <label>Email</label>
                            <p>{user.email}</p>
                          </div>
                        </div>
                        <div className={styles.profileFormRow}>
                          <div className={styles.formGroup}>
                            <label htmlFor="phone">Phone</label>
                            {isEditingProfile ? (
                              <input
                                id="phone"
                                name="phone"
                                value={profileForm.phone}
                                onChange={handleProfileChange}
                              />
                            ) : (
                              <p>{user.phone || 'Not set'}</p>
                            )}
                          </div>
                          <div className={styles.formGroup}>
                            <label htmlFor="address">Address</label>
                            {isEditingProfile ? (
                              <input
                                id="address"
                                name="address"
                                value={profileForm.address}
                                onChange={handleProfileChange}
                              />
                            ) : (
                              <p>{user.address || 'Not set'}</p>
                            )}
                          </div>
                        </div>
                        {isEditingProfile && (
                          <div className={styles.profileActions}>
                            <button
                              type="submit"
                              className={styles.primaryBtn}
                              disabled={savingProfile}
                            >
                              {savingProfile ? 'Saving…' : 'Save Changes'}
                            </button>
                            <button
                              type="button"
                              className={styles.secondaryBtn}
                              onClick={cancelEditProfile}
                              disabled={savingProfile}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </form>
                    </div>
                    <div className={styles.profileCard}>
                      <div className={styles.profileCardHeader}>
                        <div>
                          <h2>Security</h2>
                          <p>Password and sign-in. Expand only when you need to make a change.</p>
                        </div>
                        <button
                          type="button"
                          className={styles.securityToggleBtn}
                          onClick={() => setSecurityExpanded((o) => !o)}
                          aria-expanded={securityExpanded}
                        >
                          {securityExpanded ? 'Close' : 'Change password'}
                        </button>
                      </div>
                      {securityExpanded && (
                        <form onSubmit={handleUpdatePassword}>
                          <div className={styles.formGroup}>
                            <label htmlFor="current_password">Current password</label>
                            <input
                              id="current_password"
                              type="password"
                              name="current_password"
                              value={passwordForm.current_password}
                              onChange={handlePasswordChange}
                              autoComplete="current-password"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label htmlFor="new_password">New password</label>
                            <input
                              id="new_password"
                              type="password"
                              name="new_password"
                              value={passwordForm.new_password}
                              onChange={handlePasswordChange}
                              autoComplete="new-password"
                            />
                          </div>
                          <div className={styles.formGroup}>
                            <label htmlFor="confirm_password">Confirm new password</label>
                            <input
                              id="confirm_password"
                              type="password"
                              name="confirm_password"
                              value={passwordForm.confirm_password}
                              onChange={handlePasswordChange}
                              autoComplete="new-password"
                            />
                          </div>
                          <button
                            type="submit"
                            className={styles.primaryBtn}
                            disabled={savingPassword}
                          >
                            {savingPassword ? 'Updating…' : 'Update password'}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </CustomerShell>
      {selectedOrder && (
        <div
          className={styles.modalOverlay}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className={styles.modal}
            style={{ maxWidth: 520 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Order details</h2>
            <p
              style={{
                fontSize: 14,
                color: '#6b7280',
                marginTop: -8,
                marginBottom: 16,
              }}
            >
              #{selectedOrder.order_number}
            </p>
            <div
              style={{
                borderTop: '1px solid #e5e7eb',
                paddingTop: 12,
                marginTop: 4,
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Status</p>
              <p
                style={{
                  margin: '2px 0 8px',
                  fontSize: 14,
                  color: '#111827',
                }}
              >
                {formatOrderStatusDisplay(selectedOrder.status).toUpperCase()}
              </p>
              {selectedOrder.rider &&
                ['shipped', 'delivered'].includes((selectedOrder.status || '').toLowerCase()) && (
                  <div className={styles.customerDeliveryPartner}>
                    <div className={styles.customerDeliveryPartnerTitle}>
                      <UserCircle size={20} strokeWidth={2} className={styles.customerDeliveryPartnerIcon} aria-hidden />
                      Meet your Rider
                    </div>
                    <p className={styles.customerDeliveryPartnerName}>{selectedOrder.rider.user?.name || 'Rider'}</p>
                    <p className={styles.customerDeliveryPartnerRow}>
                      <span className={styles.customerDeliveryPartnerLabel}>Plate</span>
                      <span>{selectedOrder.rider.vehicle_plate || '—'}</span>
                    </p>
                    <p className={styles.customerDeliveryPartnerRow}>
                      <span className={styles.customerDeliveryPartnerLabel}>Phone</span>
                      <span>{selectedOrder.rider.phone || '—'}</span>
                      {selectedOrder.rider.phone ? (
                        <a
                          href={`tel:${String(selectedOrder.rider.phone).replace(/\s/g, '')}`}
                          className={styles.customerCallRiderBtn}
                        >
                          <Phone size={16} strokeWidth={2} aria-hidden />
                          Call
                        </a>
                      ) : null}
                    </p>
                  </div>
                )}
              <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>Items</p>
              {(selectedOrder.items || []).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginTop: 8,
                    fontSize: 14,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <img
                      src={
                        productImageUrl(item.product?.image) ||
                        'https://placehold.co/56x56?text=' +
                          encodeURIComponent(item.product?.name || 'Item')
                      }
                      alt={item.product?.name || 'Product'}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.src = 'https://placehold.co/48x48';
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 500, color: '#111827' }}>
                        {item.product?.name || 'Product'}
                      </span>
                      <span style={{ fontSize: 13, color: '#6b7280' }}>
                        Qty {item.quantity || 1}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    ₱
                    {(
                      (parseFloat(item.price) || 0) * (item.quantity || 1)
                    ).toFixed(2)}
                  </span>
                </div>
              ))}
              <hr style={{ margin: '12px 0' }} />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 600,
                  fontSize: 15,
                }}
              >
                <span>Total</span>
                <span>
                  ₱{parseFloat(selectedOrder.total_amount || 0).toFixed(2)}
                </span>
              </div>
              {selectedOrder.received_by && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>Received by: </span>
                  <span>{selectedOrder.received_by}</span>
                </div>
              )}
              {selectedOrder.customer_feedback && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
                  <span style={{ fontWeight: 600, color: '#111827' }}>Customer feedback: </span>
                  <span>{selectedOrder.customer_feedback}</span>
                </div>
              )}
            </div>
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {receivingOrder && (
        <div
          className={`${styles.modalOverlay} ${styles.receiveOverlay}`}
          onClick={() => {
            if (!updatingReceived) {
              setReceivingOrder(null);
              setReceiverName('');
              setReceiverComment('');
              setShowReceiveSuccess(false);
            }
          }}
        >
          <div
            className={`${styles.modal} ${styles.receiveModal}`}
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            {showReceiveSuccess ? (
              <div className={styles.receiveSuccessWrap}>
                <div className={styles.receiveConfetti} aria-hidden />
                <div className={styles.receiveSuccessIcon} aria-hidden>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h3>Thank you for your feedback!</h3>
                <p>Your receipt confirmation has been saved.</p>
              </div>
            ) : (
              <>
                <h2 className={styles.receiveModalTitle}>Confirm delivery</h2>
                <p className={styles.receiveModalSubtitle}>Who received this order?</p>
                <form onSubmit={handleConfirmReceived}>
                  <div className={`${styles.formGroup} ${styles.receiveFormGroup}`}>
                    <label htmlFor="received_by">Name of receiver</label>
                    <input
                      id="received_by"
                      type="text"
                      className={styles.receiveInput}
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      required
                    />
                  </div>
                  <div className={`${styles.formGroup} ${styles.receiveFormGroup}`}>
                    <label htmlFor="customer_feedback">Comment / feedback (optional)</label>
                    <textarea
                      id="customer_feedback"
                      className={styles.receiveTextarea}
                      value={receiverComment}
                      onChange={(e) => setReceiverComment(e.target.value)}
                      rows={3}
                      placeholder="Share your feedback about this order..."
                    />
                  </div>
                  <div className={styles.receiveActions}>
                    <button
                      type="button"
                      className={styles.receiveCancelBtn}
                      onClick={() => {
                        if (!updatingReceived) {
                          setReceivingOrder(null);
                          setReceiverName('');
                          setReceiverComment('');
                          setShowReceiveSuccess(false);
                        }
                      }}
                      disabled={updatingReceived}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={styles.receiveConfirmBtn}
                      disabled={updatingReceived}
                    >
                      {updatingReceived ? 'Saving…' : 'Confirm received'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
