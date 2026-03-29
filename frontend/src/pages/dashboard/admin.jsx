import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import {
  fetchAdminStats,
  fetchAdminUsers,
  fetchAdminOrders,
  fetchAdminProducts,
  fetchAdminCategories,
  fetchAdminSettings,
  updateAdminSettings,
  updateAdminOrderStatus,
  deleteAdminUser,
  deleteAdminProduct,
  deleteAdminCategory,
  createAdminCategory,
  fetchAdminArchivedProducts,
  fetchAdminArchivedUsers,
  fetchAdminRiders,
  assignAdminOrderRider,
  updateAdminRider,
  archiveAdminProduct,
  archiveAdminUser,
  restoreAdminProduct,
  restoreAdminUser,
  archiveAdminProductsBatch,
  archiveAdminUsersBatch,
  permanentDeleteAdminProductsBatch,
  permanentDeleteAdminUsersBatch,
} from '@/services/api';
import AdminShell from '@/components/layout/AdminShell';
import { productImageUrl } from '@/utils/image';
import { useToast } from '@/components/ui/ToastProvider';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  Archive,
  BadgeCheck,
  Bike,
  PackageSearch,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  X,
} from 'lucide-react';
import styles from '@/styles/dashboard.module.scss';

const ADMIN_TAB_KEYS = ['overview', 'orders', 'products', 'categories', 'customers', 'analytics', 'settings'];

const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped'];
const COMPLETED_ORDER_STATUSES = ['delivered', 'cancelled'];

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { loading } = useProtectedRoute('admin');
  const { showToast } = useToast();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
  });
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [dataLoading, setDataLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderSubTab, setOrderSubTab] = useState('active');
  const [activeOrdersStatusFilter, setActiveOrdersStatusFilter] = useState(null);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [productsSearch, setProductsSearch] = useState('');
  const [customersSearch, setCustomersSearch] = useState('');
  const [categoriesSearch, setCategoriesSearch] = useState('');
  const [overviewOrdersSearch, setOverviewOrdersSearch] = useState('');
  const [archiveProductsSearch, setArchiveProductsSearch] = useState('');
  const [archiveCustomersSearch, setArchiveCustomersSearch] = useState('');
  const [archivedProducts, setArchivedProducts] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [selectedArchivedProductIds, setSelectedArchivedProductIds] = useState([]);
  const [selectedArchivedCustomerIds, setSelectedArchivedCustomerIds] = useState([]);
  /** @type {null | { mode: string, id?: number, ids?: number[] }} */
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryCreating, setCategoryCreating] = useState(false);

  const [settingsTab, setSettingsTab] = useState('general'); // general | appearance | notifications | riders | archive
  const [fleetRiders, setFleetRiders] = useState([]);
  const [assigningRiderOrderId, setAssigningRiderOrderId] = useState(null);
  const [riderSavingId, setRiderSavingId] = useState(null);
  const [riderDrafts, setRiderDrafts] = useState({});
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settings, setSettings] = useState({
    storeName: 'urbanNxt',
    supportEmail: '',
    description: 'Premium urban clothing brand for the modern generation.',
    logoDataUrl: '',
    brandPrimary: '#4f46e5',
    brandAccent: '#2563eb',
    bannerText: 'Redefine Your Style',
    bannerEnabled: true,
    maintenanceMode: false,
    enableCoupons: true,
    enable2fa: false,
    emailOnNewOrder: true,
    smsAlerts: false,
  });
  const [initialSettings, setInitialSettings] = useState(null);

  useEffect(() => {
    if (user && user.role.name === 'admin') {
      fetchDashboardData();
    }
  }, [user]);

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.tab;
    const t = typeof q === 'string' ? q : Array.isArray(q) ? q[0] : '';
    if (ADMIN_TAB_KEYS.includes(t)) setActiveTab(t);
    else if (!q) setActiveTab('overview');
  }, [router.isReady, router.query.tab]);

  const setTab = (tab) => {
    setActiveTab(tab);
    router.replace({ pathname: '/dashboard/admin', query: { tab } }, undefined, { shallow: true });
  };

  useEffect(() => {
    if (!user) return;
    setSettings((prev) => {
      const next = { ...prev, supportEmail: prev.supportEmail || user.email || '' };
      return next;
    });
  }, [user]);

  useEffect(() => {
    if (!initialSettings) {
      setInitialSettings(settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSettings]);

  useEffect(() => {
    if (activeTab !== 'settings' || settingsTab !== 'archive' || !user || user.role?.name !== 'admin') {
      return undefined;
    }
    let cancelled = false;
    setArchiveLoading(true);
    Promise.all([fetchAdminArchivedProducts(), fetchAdminArchivedUsers()])
      .then(([pr, ur]) => {
        if (!cancelled) {
          setArchivedProducts(pr.data?.products || []);
          setArchivedUsers(ur.data?.users || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setArchiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, settingsTab, user]);

  const fetchDashboardData = async () => {
    setDataLoading(true);
    try {
      const response = await fetchAdminStats();
      setStats(response.data.stats || {});

      const usersResponse = await fetchAdminUsers();
      setUsers(usersResponse.data.users || []);

      const [ordersRes, productsRes, categoriesRes, ridersRes] = await Promise.all([
        fetchAdminOrders().catch(() => ({ data: { orders: [] } })),
        fetchAdminProducts().catch(() => ({ data: { products: [] } })),
        fetchAdminCategories().catch(() => ({ data: { categories: [] } })),
        fetchAdminRiders().catch(() => ({ data: { riders: [] } })),
      ]);
      setOrders(ordersRes.data.orders || []);
      setProducts(productsRes.data.products || []);
      setCategories(categoriesRes.data.categories || []);
      const ridersList = ridersRes.data.riders || [];
      setFleetRiders(ridersList);
      const drafts = {};
      ridersList.forEach((r) => {
        drafts[r.id] = {
          name: r.name || '',
          phone: r.phone || '',
          vehicle_plate: r.vehicle_plate || '',
        };
      });
      setRiderDrafts(drafts);

      const settingsRes = await fetchAdminSettings().catch(() => null);
      const s = settingsRes?.data?.settings;
      if (s) {
        const mapped = {
          storeName: s.store_name ?? 'urbanNxt',
          supportEmail: s.support_email ?? user?.email ?? '',
          description: s.description ?? '',
          logoDataUrl: s.logo_data_url ?? '',
          brandPrimary: s.brand_primary ?? '#4f46e5',
          brandAccent: s.brand_accent ?? '#2563eb',
          bannerText: s.banner_text ?? '',
          bannerEnabled: !!s.banner_enabled,
          maintenanceMode: !!s.maintenance_mode,
          enableCoupons: !!s.enable_coupons,
          enable2fa: !!s.enable_2fa,
          emailOnNewOrder: !!s.email_on_new_order,
          smsAlerts: !!s.sms_alerts,
        };
        setSettings(mapped);
        setInitialSettings(mapped);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, status) => {
    setUpdatingOrderId(orderId);
    try {
      await updateAdminOrderStatus(orderId, status);
      const [refreshed, ridersRef] = await Promise.all([fetchAdminOrders(), fetchAdminRiders().catch(() => ({ data: { riders: [] } }))]);
      setOrders(refreshed.data.orders || []);
      setFleetRiders(ridersRef.data.riders || []);
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to update order status.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleAssignAdminRider = async (orderId, riderId) => {
    setAssigningRiderOrderId(orderId);
    try {
      await assignAdminOrderRider(orderId, riderId);
      const [refreshed, ridersRef] = await Promise.all([fetchAdminOrders(), fetchAdminRiders()]);
      setOrders(refreshed.data.orders || []);
      setFleetRiders(ridersRef.data.riders || []);
      showToast({ message: 'Rider assigned.', type: 'success' });
    } catch (e) {
      showToast({ message: e.response?.data?.message || e.message || 'Failed to assign rider.', type: 'error' });
    } finally {
      setAssigningRiderOrderId(null);
    }
  };

  const handleSaveRiderProfile = async (riderId) => {
    const d = riderDrafts[riderId];
    if (!d) return;
    setRiderSavingId(riderId);
    try {
      await updateAdminRider(riderId, {
        name: d.name,
        phone: d.phone,
        vehicle_plate: d.vehicle_plate,
      });
      const ridersRef = await fetchAdminRiders();
      setFleetRiders(ridersRef.data.riders || []);
      showToast({ message: 'Rider profile saved.', type: 'success' });
    } catch (e) {
      showToast({ message: e.response?.data?.message || e.message || 'Failed to save rider.', type: 'error' });
    } finally {
      setRiderSavingId(null);
    }
  };

  const handleConfirmDialogYes = async () => {
    const d = confirmDialog;
    if (!d) return;
    setConfirmDialog(null);
    try {
      if (d.mode === 'archive-product') {
        await archiveAdminProduct(d.id);
        const refreshed = await fetchAdminProducts();
        setProducts(refreshed.data.products || []);
        setSelectedProductIds((prev) => prev.filter((x) => x !== d.id));
        showToast({ message: 'Product archived.', type: 'success' });
        const pr = await fetchAdminArchivedProducts();
        setArchivedProducts(pr.data?.products || []);
      } else if (d.mode === 'archive-user') {
        await archiveAdminUser(d.id);
        const refreshed = await fetchAdminUsers();
        setUsers(refreshed.data.users || []);
        setSelectedCustomerIds((prev) => prev.filter((x) => x !== d.id));
        showToast({ message: 'Customer archived.', type: 'success' });
        const ur = await fetchAdminArchivedUsers();
        setArchivedUsers(ur.data?.users || []);
      } else if (d.mode === 'delete-product') {
        await deleteAdminProduct(d.id);
        const refreshed = await fetchAdminProducts();
        setProducts(refreshed.data.products || []);
        setSelectedProductIds((prev) => prev.filter((x) => x !== d.id));
        const pr = await fetchAdminArchivedProducts();
        setArchivedProducts(pr.data?.products || []);
        setSelectedArchivedProductIds((prev) => prev.filter((x) => x !== d.id));
        showToast({ message: 'Product deleted.', type: 'success' });
      } else if (d.mode === 'delete-user') {
        await deleteAdminUser(d.id);
        const refreshed = await fetchAdminUsers();
        setUsers(refreshed.data.users || []);
        setSelectedCustomerIds((prev) => prev.filter((x) => x !== d.id));
        const ur = await fetchAdminArchivedUsers();
        setArchivedUsers(ur.data?.users || []);
        setSelectedArchivedCustomerIds((prev) => prev.filter((x) => x !== d.id));
        showToast({ message: 'Customer deleted.', type: 'success' });
      } else if (d.mode === 'batch-archive-products') {
        await archiveAdminProductsBatch(d.ids);
        const refreshed = await fetchAdminProducts();
        setProducts(refreshed.data.products || []);
        setSelectedProductIds([]);
        showToast({ message: 'Selected products archived.', type: 'success' });
        const pr = await fetchAdminArchivedProducts();
        setArchivedProducts(pr.data?.products || []);
      } else if (d.mode === 'batch-archive-customers') {
        await archiveAdminUsersBatch(d.ids);
        const refreshed = await fetchAdminUsers();
        setUsers(refreshed.data.users || []);
        setSelectedCustomerIds([]);
        showToast({ message: 'Selected customers archived.', type: 'success' });
        const ur = await fetchAdminArchivedUsers();
        setArchivedUsers(ur.data?.users || []);
      }
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Action failed.');
    }
  };

  const requestBatchArchiveProducts = () => {
    if (selectedProductIds.length === 0) return;
    setConfirmDialog({ mode: 'batch-archive-products', ids: [...selectedProductIds] });
  };

  const requestBatchArchiveCustomers = () => {
    if (selectedCustomerIds.length === 0) return;
    setConfirmDialog({ mode: 'batch-archive-customers', ids: [...selectedCustomerIds] });
  };

  const handleRestoreProduct = async (id) => {
    try {
      await restoreAdminProduct(id);
      const [pr, main] = await Promise.all([fetchAdminArchivedProducts(), fetchAdminProducts()]);
      setArchivedProducts(pr.data?.products || []);
      setProducts(main.data?.products || []);
      setSelectedArchivedProductIds((prev) => prev.filter((x) => x !== id));
      showToast({ message: 'Product restored to catalog.', type: 'success' });
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to restore product.');
    }
  };

  const requestDeleteProduct = (id) => {
    setConfirmDialog({ mode: 'delete-product', id });
  };

  const handleRestoreUser = async (id) => {
    try {
      await restoreAdminUser(id);
      const [ur, main] = await Promise.all([fetchAdminArchivedUsers(), fetchAdminUsers()]);
      setArchivedUsers(ur.data?.users || []);
      setUsers(main.data?.users || []);
      setSelectedArchivedCustomerIds((prev) => prev.filter((x) => x !== id));
      showToast({ message: 'Customer restored.', type: 'success' });
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to restore customer.');
    }
  };

  const requestDeleteUser = (id) => {
    setConfirmDialog({ mode: 'delete-user', id });
  };

  const handleBatchPermanentDeleteArchivedProducts = async () => {
    if (selectedArchivedProductIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedArchivedProductIds.length} archived product(s)?`)) return;
    try {
      await permanentDeleteAdminProductsBatch(selectedArchivedProductIds);
      setSelectedArchivedProductIds([]);
      const pr = await fetchAdminArchivedProducts();
      setArchivedProducts(pr.data?.products || []);
      showToast({ message: 'Products permanently deleted.', type: 'success' });
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to delete products.');
    }
  };

  const handleBatchPermanentDeleteArchivedUsers = async () => {
    if (selectedArchivedCustomerIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedArchivedCustomerIds.length} archived customer(s)?`)) return;
    try {
      await permanentDeleteAdminUsersBatch(selectedArchivedCustomerIds);
      setSelectedArchivedCustomerIds([]);
      const ur = await fetchAdminArchivedUsers();
      setArchivedUsers(ur.data?.users || []);
      showToast({ message: 'Customers permanently deleted.', type: 'success' });
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to delete customers.');
    }
  };

  const handleBatchRestoreArchivedProducts = async () => {
    if (selectedArchivedProductIds.length === 0) return;
    try {
      await Promise.all(selectedArchivedProductIds.map((id) => restoreAdminProduct(id)));
      setSelectedArchivedProductIds([]);
      const [pr, main] = await Promise.all([fetchAdminArchivedProducts(), fetchAdminProducts()]);
      setArchivedProducts(pr.data?.products || []);
      setProducts(main.data?.products || []);
      showToast({ message: 'Products restored.', type: 'success' });
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to restore products.');
    }
  };

  const handleBatchRestoreArchivedUsers = async () => {
    if (selectedArchivedCustomerIds.length === 0) return;
    try {
      await Promise.all(selectedArchivedCustomerIds.map((id) => restoreAdminUser(id)));
      setSelectedArchivedCustomerIds([]);
      const [ur, main] = await Promise.all([fetchAdminArchivedUsers(), fetchAdminUsers()]);
      setArchivedUsers(ur.data?.users || []);
      setUsers(main.data?.users || []);
      showToast({ message: 'Customers restored.', type: 'success' });
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to restore customers.');
    }
  };

  const handleDeleteCategory = async (id) => {
    if (!confirm('Delete this category?')) return;
    try {
      await deleteAdminCategory(id);
      const refreshed = await fetchAdminCategories();
      setCategories(refreshed.data.categories || []);
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to delete category.');
    }
  };

  const handleCreateCategory = async (e) => {
    e?.preventDefault();
    const name = newCategoryName.trim();
    if (!name) return;
    setCategoryCreating(true);
    try {
      await createAdminCategory({ name });
      setNewCategoryName('');
      const refreshed = await fetchAdminCategories();
      setCategories(refreshed.data.categories || []);
      showToast({ message: 'Category created.', type: 'success' });
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to create category.');
    } finally {
      setCategoryCreating(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleLogoUpload = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSetting('logoDataUrl', String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      await updateAdminSettings({
        store_name: settings.storeName,
        support_email: settings.supportEmail,
        description: settings.description,
        logo_data_url: settings.logoDataUrl || null,
        brand_primary: settings.brandPrimary,
        brand_accent: settings.brandAccent,
        banner_text: settings.bannerText,
        banner_enabled: settings.bannerEnabled,
        maintenance_mode: settings.maintenanceMode,
        enable_coupons: settings.enableCoupons,
        enable_2fa: settings.enable2fa,
        email_on_new_order: settings.emailOnNewOrder,
        sms_alerts: settings.smsAlerts,
      });
      setInitialSettings(settings);
      showToast({ message: 'Settings saved successfully.', type: 'success' });
    } catch (e) {
      alert(e.message || 'Failed to save settings.');
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDiscardSettings = () => {
    if (!initialSettings) return;
    setSettings(initialSettings);
    showToast({ message: 'Changes discarded.', type: 'success' });
  };

  const hasUnsavedSettings = useMemo(() => {
    if (!initialSettings) return false;
    try {
      return JSON.stringify(settings) !== JSON.stringify(initialSettings);
    } catch {
      return true;
    }
  }, [settings, initialSettings]);

  const Toggle = ({ checked, onChange, label, icon }) => (
    <label className={styles.adminToggle}>
      <span className={styles.adminToggleLabel}>
        {icon ? <span className={styles.adminToggleIcon} aria-hidden>{icon}</span> : null}
        {label}
      </span>
      <span className={styles.adminToggleTrack} data-checked={checked ? '1' : '0'}>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={styles.adminToggleThumb} />
      </span>
    </label>
  );

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  const totalSales = parseFloat(stats.totalRevenue || 0);
  const totalOrders = stats.totalOrders || 0;
  const totalUsers = stats.totalUsers || 0;

  const revenueSeries = useMemo(() => {
    const days = 30;
    const map = new Map();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, revenue: 0, orders: 0 });
    }
    (orders || []).forEach((o) => {
      const key = (o.created_at || '').slice(0, 10);
      if (!map.has(key)) return;
      const entry = map.get(key);
      entry.revenue += Number(o.total_amount || 0);
      entry.orders += 1;
      map.set(key, entry);
    });
    return Array.from(map.values());
  }, [orders]);

  const sparkRevenue = revenueSeries.map((d) => ({ v: d.revenue }));
  const sparkOrders = revenueSeries.map((d) => ({ v: d.orders }));

  const overviewFilteredOrders = useMemo(() => {
    const q = overviewOrdersSearch.trim().toLowerCase();
    if (!q) return orders || [];
    return (orders || []).filter((o) => {
      const customer = `${o.customer?.name || ''} ${o.customer?.email || ''}`.toLowerCase();
      return (
        String(o.order_number || o.id || '').toLowerCase().includes(q)
        || customer.includes(q)
        || String(o.status || '').toLowerCase().includes(q)
      );
    });
  }, [orders, overviewOrdersSearch]);

  const orderMatchesSearch = (o, qRaw) => {
    const q = qRaw.trim().toLowerCase();
    if (!q) return true;
    const customer = `${o.customer?.name || ''} ${o.customer?.email || ''}`.toLowerCase();
    return (
      String(o.order_number || o.id || '').toLowerCase().includes(q)
      || customer.includes(q)
      || String(o.status || '').toLowerCase().includes(q)
    );
  };

  const activeOrdersList = useMemo(() => {
    const q = ordersSearch;
    return (orders || []).filter((o) => {
      const s = (o.status || 'pending').toLowerCase();
      if (!ACTIVE_ORDER_STATUSES.includes(s)) return false;
      if (activeOrdersStatusFilter && s !== activeOrdersStatusFilter) return false;
      return orderMatchesSearch(o, q);
    });
  }, [orders, ordersSearch, activeOrdersStatusFilter]);

  const historyOrdersList = useMemo(() => {
    const q = ordersSearch;
    return (orders || []).filter((o) => {
      const s = (o.status || '').toLowerCase();
      if (!COMPLETED_ORDER_STATUSES.includes(s)) return false;
      return orderMatchesSearch(o, q);
    });
  }, [orders, ordersSearch]);

  const activeOrderStatusCounts = useMemo(() => {
    const c = { pending: 0, confirmed: 0, processing: 0, shipped: 0 };
    (orders || []).forEach((o) => {
      const s = (o.status || 'pending').toLowerCase();
      if (ACTIVE_ORDER_STATUSES.includes(s) && Object.prototype.hasOwnProperty.call(c, s)) {
        c[s] += 1;
      }
    });
    return c;
  }, [orders]);

  const customerUsers = useMemo(
    () => (users || []).filter((u) => u.role?.name === 'customer'),
    [users],
  );

  const filteredProducts = useMemo(() => {
    const q = productsSearch.trim().toLowerCase();
    if (!q) return products || [];
    return (products || []).filter((p) => (
      String(p.name || '').toLowerCase().includes(q)
      || String(p.category?.name || '').toLowerCase().includes(q)
      || String(p.seller?.name || '').toLowerCase().includes(q)
    ));
  }, [products, productsSearch]);

  const filteredCustomerUsers = useMemo(() => {
    const q = customersSearch.trim().toLowerCase();
    if (!q) return customerUsers;
    return customerUsers.filter((u) => (
      String(u.name || '').toLowerCase().includes(q)
      || String(u.email || '').toLowerCase().includes(q)
      || String(u.phone || '').toLowerCase().includes(q)
    ));
  }, [customerUsers, customersSearch]);

  const filteredCategories = useMemo(() => {
    const q = categoriesSearch.trim().toLowerCase();
    if (!q) return categories || [];
    return (categories || []).filter((c) => (
      String(c.name || '').toLowerCase().includes(q)
      || String(c.slug || '').toLowerCase().includes(q)
    ));
  }, [categories, categoriesSearch]);

  const filteredArchivedProducts = useMemo(() => {
    const q = archiveProductsSearch.trim().toLowerCase();
    if (!q) return archivedProducts || [];
    return (archivedProducts || []).filter((p) => (
      String(p.name || '').toLowerCase().includes(q)
      || String(p.category?.name || '').toLowerCase().includes(q)
    ));
  }, [archivedProducts, archiveProductsSearch]);

  const filteredArchivedUsers = useMemo(() => {
    const q = archiveCustomersSearch.trim().toLowerCase();
    if (!q) return archivedUsers || [];
    return (archivedUsers || []).filter((u) => (
      String(u.name || '').toLowerCase().includes(q)
      || String(u.email || '').toLowerCase().includes(q)
    ));
  }, [archivedUsers, archiveCustomersSearch]);

  const analyticsSeries = useMemo(() => (
    revenueSeries.map((d) => ({
      label: new Date(`${d.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      revenue: d.revenue,
      orders: d.orders,
    }))
  ), [revenueSeries]);

  const revenueChangePct = useMemo(() => {
    const arr = revenueSeries;
    if (arr.length < 14) return null;
    const last7 = arr.slice(-7).reduce((s, d) => s + d.revenue, 0);
    const prev7 = arr.slice(-14, -7).reduce((s, d) => s + d.revenue, 0);
    if (prev7 === 0) return last7 > 0 ? 100 : 0;
    return ((last7 - prev7) / prev7) * 100;
  }, [revenueSeries]);

  const statusPillClass = (statusRaw) => {
    const s = (statusRaw || '').toLowerCase();
    if (s === 'delivered') return styles.adminStatusDelivered;
    if (s === 'shipped') return styles.adminStatusShipped;
    if (s === 'cancelled') return styles.adminStatusCancelled;
    return styles.adminStatusPending;
  };

  const getOrderActions = (statusRaw) => {
    const s = (statusRaw || '').toLowerCase();
    return {
      showShip: ['pending', 'confirmed', 'processing'].includes(s),
      showAwaitingRider: s === 'shipped',
      showCancel: !['delivered', 'cancelled'].includes(s),
    };
  };

  const getConfirmDialogMessage = () => {
    if (!confirmDialog) return '';
    const { mode, ids } = confirmDialog;
    switch (mode) {
      case 'archive-product':
        return 'Are you sure you really want to archive this product?';
      case 'archive-user':
        return 'Are you sure you really want to archive this user?';
      case 'delete-product':
        return 'Are you sure you want to delete this product?';
      case 'delete-user':
        return 'Are you sure you want to delete this user?';
      case 'batch-archive-products':
        return `Are you sure you really want to archive ${ids?.length ?? 0} selected product(s)?`;
      case 'batch-archive-customers':
        return `Are you sure you really want to archive ${ids?.length ?? 0} selected customer(s)?`;
      default:
        return '';
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
        <title>Admin Dashboard - urbanNxt</title>
      </Head>
      <div className={`${styles.adminProShell} ${styles.adminPro}`}>
        <AdminShell activeTab={activeTab} onTabChange={setTab} onLogout={handleLogout}>
          <div className={`${styles.pageHeading} ${activeTab === 'orders' ? styles.adminOrdersPageHeading : ''}`}>
            <h1 className={activeTab === 'orders' ? styles.adminOrdersHeroTitle : undefined}>
              {activeTab === 'overview'
                ? 'Overview'
                : activeTab === 'orders'
                ? 'Orders'
                : activeTab === 'products'
                ? 'Products'
                : activeTab === 'categories'
                ? 'Categories'
                : activeTab === 'customers'
                ? 'Customers'
                : activeTab === 'analytics'
                ? 'Analytics'
                : 'Settings'}
            </h1>
            <p className={styles.subtitle}>
              {activeTab === 'overview' && "Welcome back, Admin. Here's what's happening today."}
              {activeTab === 'orders' && 'View and manage all customer orders in one place.'}
              {activeTab === 'products' && 'Manage your catalog, stock, and categories.'}
              {activeTab === 'categories' && 'Manage categories for your storefront.'}
              {activeTab === 'customers' && 'See customer details, status, and value.'}
              {activeTab === 'analytics' && 'Overview of your store performance.'}
              {activeTab === 'settings' && settingsTab === 'archive' && 'Archive & Recovery: restore archived products and customers, or remove them permanently.'}
              {activeTab === 'settings' && settingsTab === 'riders' && 'Manage built-in delivery riders: names, phone, and plate numbers.'}
              {activeTab === 'settings' && settingsTab !== 'archive' && settingsTab !== 'riders' && 'Manage store preferences and system settings.'}
            </p>
          </div>

          <div className={styles.mainPro}>
            {activeTab === 'overview' && (
              <>
                <div className={styles.adminStatsGrid}>
                  <div className={`${styles.adminStatCard} ${styles.adminStatSales}`}>
                    <div className={styles.adminStatTop}>
                      <div className={styles.adminStatIcon} aria-hidden>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                      </div>
                      <div className={styles.adminStatSpark}>
                        <ResponsiveContainer width="100%" height={34}>
                          <LineChart data={sparkRevenue}>
                            <Line type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className={styles.adminStatValue}>₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })} <TrendingUp size={16} strokeWidth={1.5} className={styles.adminStatTrendIcon} aria-hidden /></div>
                    <div className={styles.adminStatLabel}>Total Sales</div>
                    <div className={styles.adminStatMeta}>Last 30 days</div>
                  </div>
                  <div className={`${styles.adminStatCard} ${styles.adminStatOrders}`}>
                    <div className={styles.adminStatTop}>
                      <div className={styles.adminStatIcon} aria-hidden>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 2h12l2 7H4l2-7Z" />
                          <path d="M4 9h16v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
                        </svg>
                      </div>
                      <div className={styles.adminStatSpark}>
                        <ResponsiveContainer width="100%" height={34}>
                          <LineChart data={sparkOrders}>
                            <Line type="monotone" dataKey="v" stroke="#ffffff" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    <div className={styles.adminStatValue}>{totalOrders} <TrendingUp size={16} strokeWidth={1.5} className={styles.adminStatTrendIcon} aria-hidden /></div>
                    <div className={styles.adminStatLabel}>New Orders</div>
                    <div className={styles.adminStatMeta}>Last 30 days</div>
                  </div>
                  <div className={`${styles.adminStatCard} ${styles.adminStatUsers}`}>
                    <div className={styles.adminStatTop}>
                      <div className={styles.adminStatIcon} aria-hidden>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 20a6 6 0 0 0-12 0" />
                          <circle cx="12" cy="10" r="4" />
                          <circle cx="19" cy="9" r="2" />
                          <path d="M21 20c0-2-1-3.5-2.5-4.5" />
                        </svg>
                      </div>
                      <div className={styles.adminStatSpark} />
                    </div>
                    <div className={styles.adminStatValue}>{totalUsers} <TrendingUp size={16} strokeWidth={1.5} className={styles.adminStatTrendIcon} aria-hidden /></div>
                    <div className={styles.adminStatLabel}>Total Users</div>
                    <div className={styles.adminStatMeta}>All time</div>
                  </div>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2>Sales Performance</h2>
                    <button type="button" className={styles.secondaryBtn}>
                      Last 30 Days
                    </button>
                  </div>
                  <div
                    className={styles.cardBody}
                    style={{
                      minHeight: 260,
                    }}
                  >
                    <div style={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueSeries}>
                          <defs>
                            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,23,42,0.08)" />
                          <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 12, fill: '#6b7280' }} />
                          <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(v) => `₱${v}`} width={52} />
                          <Tooltip formatter={(v) => [`₱${Number(v).toFixed(2)}`, 'Revenue']} />
                          <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} fill="url(#rev)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2>Recent Orders</h2>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.adminTableSearchRow}>
                      <div className={styles.adminSearchWrap}>
                        <Search size={20} strokeWidth={1.5} aria-hidden />
                        <input
                          type="search"
                          value={overviewOrdersSearch}
                          onChange={(e) => setOverviewOrdersSearch(e.target.value)}
                          placeholder="Search recent orders…"
                        />
                      </div>
                    </div>
                    {dataLoading ? (
                      <p>Loading…</p>
                    ) : overviewFilteredOrders.length === 0 ? (
                      <p className={styles.emptyState}>No orders yet.</p>
                    ) : (
                      <div className={styles.usersTable}>
                        <table>
                          <thead>
                            <tr>
                              <th>Order</th>
                              <th>Customer</th>
                              <th>Status</th>
                              <th>Total</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {overviewFilteredOrders.slice(0, 6).map((o) => (
                              <tr key={o.id}>
                                <td>#{o.order_number || o.id}</td>
                                <td>{o.customer?.name || '-'}</td>
                                <td><span className={`${styles.adminStatusPill} ${statusPillClass(o.status)}`}>{o.status}</span></td>
                                <td>₱{Number(o.total_amount || 0).toFixed(2)}</td>
                                <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'orders' && (
              <div className={`${styles.card} ${styles.adminOrdersShell}`}>
                <div className={styles.adminOrdersBody}>
                  <div className={styles.adminOrderTabBar} role="tablist" aria-label="Order list scope">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={orderSubTab === 'active'}
                      className={`${styles.adminOrderTabBtn} ${orderSubTab === 'active' ? styles.adminOrderTabBtnActive : ''}`}
                      onClick={() => setOrderSubTab('active')}
                    >
                      Active Orders
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={orderSubTab === 'history'}
                      className={`${styles.adminOrderTabBtn} ${orderSubTab === 'history' ? styles.adminOrderTabBtnActive : ''}`}
                      onClick={() => {
                        setOrderSubTab('history');
                        setActiveOrdersStatusFilter(null);
                      }}
                    >
                      Completed / History
                    </button>
                    <span
                      className={styles.adminOrderTabSlider}
                      data-tab={orderSubTab}
                      aria-hidden
                    />
                  </div>
                  <div className={styles.adminTableSearchRow}>
                    <div className={styles.adminSearchWrap}>
                      <Search size={20} strokeWidth={1.5} aria-hidden />
                      <input
                        type="search"
                        value={ordersSearch}
                        onChange={(e) => setOrdersSearch(e.target.value)}
                        placeholder="Search orders by number, customer, or status…"
                      />
                    </div>
                  </div>
                  {dataLoading ? (
                    <p style={{ marginTop: 12 }}>Loading orders…</p>
                  ) : orderSubTab === 'active' ? (
                    <>
                      <div className={styles.adminOrderStatGrid} role="group" aria-label="Active order counts by status">
                        <button
                          type="button"
                          className={`${styles.adminOrderStatCard} ${activeOrdersStatusFilter === 'pending' ? styles.adminOrderStatCardSelected : ''}`}
                          onClick={() => setActiveOrdersStatusFilter((f) => (f === 'pending' ? null : 'pending'))}
                          aria-pressed={activeOrdersStatusFilter === 'pending'}
                        >
                          <span className={`${styles.adminOrderStatIconWrap} ${styles.adminOrderStatIconWrapPending}`} aria-hidden>
                            <AlertCircle size={24} strokeWidth={2} />
                          </span>
                          <span className={styles.adminOrderStatText}>
                            <span className={styles.adminOrderStatCount}>{activeOrderStatusCounts.pending}</span>
                            <span className={styles.adminOrderStatLabel}>Pending</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.adminOrderStatCard} ${activeOrdersStatusFilter === 'confirmed' ? styles.adminOrderStatCardSelected : ''}`}
                          onClick={() => setActiveOrdersStatusFilter((f) => (f === 'confirmed' ? null : 'confirmed'))}
                          aria-pressed={activeOrdersStatusFilter === 'confirmed'}
                        >
                          <span className={`${styles.adminOrderStatIconWrap} ${styles.adminOrderStatIconWrapConfirmed}`} aria-hidden>
                            <BadgeCheck size={24} strokeWidth={2} />
                          </span>
                          <span className={styles.adminOrderStatText}>
                            <span className={styles.adminOrderStatCount}>{activeOrderStatusCounts.confirmed}</span>
                            <span className={styles.adminOrderStatLabel}>Confirmed</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.adminOrderStatCard} ${activeOrdersStatusFilter === 'processing' ? styles.adminOrderStatCardSelected : ''}`}
                          onClick={() => setActiveOrdersStatusFilter((f) => (f === 'processing' ? null : 'processing'))}
                          aria-pressed={activeOrdersStatusFilter === 'processing'}
                        >
                          <span className={`${styles.adminOrderStatIconWrap} ${styles.adminOrderStatIconWrapProcessing}`} aria-hidden>
                            <RefreshCw size={24} strokeWidth={2} />
                          </span>
                          <span className={styles.adminOrderStatText}>
                            <span className={styles.adminOrderStatCount}>{activeOrderStatusCounts.processing}</span>
                            <span className={styles.adminOrderStatLabel}>Processing</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          className={`${styles.adminOrderStatCard} ${activeOrdersStatusFilter === 'shipped' ? styles.adminOrderStatCardSelected : ''}`}
                          onClick={() => setActiveOrdersStatusFilter((f) => (f === 'shipped' ? null : 'shipped'))}
                          aria-pressed={activeOrdersStatusFilter === 'shipped'}
                        >
                          <span className={`${styles.adminOrderStatIconWrap} ${styles.adminOrderStatIconWrapShipped}`} aria-hidden>
                            <PackageSearch size={24} strokeWidth={2} />
                          </span>
                          <span className={styles.adminOrderStatText}>
                            <span className={styles.adminOrderStatCount}>{activeOrderStatusCounts.shipped}</span>
                            <span className={styles.adminOrderStatLabel}>Shipped</span>
                          </span>
                        </button>
                      </div>
                      {activeOrdersList.length === 0 ? (
                        <p className={styles.emptyState}>No active orders.</p>
                      ) : (
                        <div className={styles.usersTable}>
                          <table>
                            <thead>
                              <tr>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Address</th>
                                <th>Status</th>
                                <th>Rider</th>
                                <th>Total</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeOrdersList.map((o) => {
                                const act = getOrderActions(o.status);
                                const st = (o.status || '').toLowerCase();
                                const riderIdVal = o.rider_id ?? o.rider?.id ?? '';
                                return (
                                  <tr
                                    key={o.id}
                                    onClick={() => setSelectedOrder(o)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <td>#{o.order_number || o.id}</td>
                                    <td>{o.customer?.name || '-'}</td>
                                    <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {o.shipping_address || '-'}
                                    </td>
                                    <td><span className={`${styles.adminStatusPill} ${statusPillClass(o.status)}`}>{o.status}</span></td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                      {st === 'shipped' ? (
                                        <div className={styles.adminOrderRiderCell}>
                                          <label htmlFor={`admin-assign-rider-${o.id}`} className={styles.adminOrderRiderLabel}>
                                            Assign rider
                                          </label>
                                          <select
                                            id={`admin-assign-rider-${o.id}`}
                                            className={styles.adminOrderRiderSelect}
                                            value={riderIdVal ? String(riderIdVal) : ''}
                                            disabled={assigningRiderOrderId === o.id}
                                            onChange={(e) => {
                                              const v = e.target.value;
                                              if (!v || Number(v) === Number(riderIdVal)) return;
                                              handleAssignAdminRider(o.id, Number(v));
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
                                      ) : o.rider?.user?.name ? (
                                        <span className={styles.adminOrderRiderName}>
                                          <Bike size={16} strokeWidth={2} aria-hidden />
                                          {o.rider.user.name}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td>₱{Number(o.total_amount || 0).toFixed(2)}</td>
                                    <td onClick={(e) => e.stopPropagation()}>
                                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                        {act.showShip && (
                                          <button
                                            type="button"
                                            className={styles.adminIconBtn}
                                            title="Mark shipped"
                                            onClick={() => handleUpdateOrderStatus(o.id, 'shipped')}
                                            disabled={updatingOrderId === o.id}
                                            aria-label="Mark shipped"
                                          >
                                            <Truck size={17} strokeWidth={1.5} aria-hidden />
                                            <span className={styles.adminActionText}>Ship</span>
                                          </button>
                                        )}
                                        {act.showAwaitingRider && (
                                          <span
                                            className={styles.adminActionText}
                                            style={{
                                              fontSize: 12,
                                              fontWeight: 600,
                                              color: '#64748b',
                                              padding: '6px 10px',
                                              background: '#f1f5f9',
                                              borderRadius: 8,
                                              whiteSpace: 'nowrap',
                                            }}
                                            title="Only the assigned rider can mark this order delivered"
                                          >
                                            Rider delivers
                                          </span>
                                        )}
                                        {act.showCancel && (
                                          <button
                                            type="button"
                                            className={`${styles.adminIconBtn} ${styles.adminIconDanger}`}
                                            title="Cancel order"
                                            onClick={() => handleUpdateOrderStatus(o.id, 'cancelled')}
                                            disabled={updatingOrderId === o.id}
                                            aria-label="Cancel order"
                                          >
                                            <X size={17} strokeWidth={1.5} aria-hidden />
                                            <span className={styles.adminActionText}>Cancel</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  ) : historyOrdersList.length === 0 ? (
                    <p className={styles.emptyState}>No completed orders in history.</p>
                  ) : (
                    <div className={styles.usersTable}>
                      <table>
                        <thead>
                          <tr>
                            <th>Order</th>
                            <th>Customer</th>
                            <th>Address</th>
                            <th>Status</th>
                            <th>Rider</th>
                            <th>Total</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {historyOrdersList.map((o) => (
                            <tr
                              key={o.id}
                              onClick={() => setSelectedOrder(o)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td>#{o.order_number || o.id}</td>
                              <td>{o.customer?.name || '-'}</td>
                              <td style={{ maxWidth: 220, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {o.shipping_address || '-'}
                              </td>
                              <td><span className={`${styles.adminStatusPill} ${statusPillClass(o.status)}`}>{o.status}</span></td>
                              <td onClick={(e) => e.stopPropagation()}>
                                {o.rider?.user?.name ? (
                                  <span className={styles.adminOrderRiderName}>
                                    <Bike size={16} strokeWidth={2} aria-hidden />
                                    {o.rider.user.name}
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td>₱{Number(o.total_amount || 0).toFixed(2)}</td>
                              <td />
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {selectedOrder && (
              <div
                className={styles.modalOverlay}
                onClick={() => setSelectedOrder(null)}
              >
                <div
                  className={styles.modal}
                  style={{ maxWidth: 560 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h2>Order details</h2>
                  <p style={{ fontSize: 14, color: '#6b7280', marginTop: -8, marginBottom: 16 }}>
                    #{selectedOrder.order_number || selectedOrder.id}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Customer</div>
                      <div>{selectedOrder.customer?.name || '-'}</div>
                      <div style={{ marginTop: 6 }}>{selectedOrder.customer?.email || '-'}</div>
                      <div>{selectedOrder.customer?.phone || '-'}</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280', minWidth: 220 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Shipping address</div>
                      <div style={{ marginTop: 2 }}>{selectedOrder.shipping_address || '-'}</div>
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      <div style={{ fontWeight: 700, color: '#0f172a' }}>Status</div>
                      <div style={{ marginTop: 2 }}>
                        <span className={`${styles.adminStatusPill} ${statusPillClass(selectedOrder.status)}`}>
                          {selectedOrder.status}
                        </span>
                      </div>
                      {selectedOrder.received_by && (
                        <>
                          <div style={{ marginTop: 10, fontWeight: 700, color: '#0f172a' }}>Received by</div>
                          <div style={{ marginTop: 2 }}>{selectedOrder.received_by}</div>
                        </>
                      )}
                      {selectedOrder.customer_feedback && (
                        <>
                          <div style={{ marginTop: 10, fontWeight: 700, color: '#0f172a' }}>Customer feedback</div>
                          <div style={{ marginTop: 2, whiteSpace: 'pre-wrap' }}>{selectedOrder.customer_feedback}</div>
                        </>
                      )}
                      <div style={{ marginTop: 10, fontWeight: 700, color: '#0f172a' }}>Total</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                        ₱{Number(selectedOrder.total_amount || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {selectedOrder.rider?.user && (
                    <div className={styles.adminOrderRiderDetail}>
                      <Bike size={18} strokeWidth={2} aria-hidden />
                      <div>
                        <div className={styles.adminOrderRiderDetailTitle}>Delivery partner</div>
                        <div className={styles.adminOrderRiderDetailName}>{selectedOrder.rider.user.name}</div>
                        <div className={styles.adminOrderRiderDetailMeta}>
                          {selectedOrder.rider.phone || '—'} · Plate {selectedOrder.rider.vehicle_plate || '—'}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#64748b', marginBottom: 10 }}>
                      Items
                    </div>
                    {(selectedOrder.items || []).map((item) => (
                      <div
                        key={item.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <img
                            src={productImageUrl(item.product?.image) || 'https://placehold.co/48x48'}
                            alt=""
                            width={48}
                            height={48}
                            style={{ borderRadius: 10, objectFit: 'cover' }}
                            onError={(e) => { e.target.src = 'https://placehold.co/48x48'; }}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.product?.name || 'Product'}
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7280' }}>Qty {item.quantity || 1}</div>
                          </div>
                        </div>
                        <div style={{ fontWeight: 900, color: '#0f172a' }}>
                          ₱{((parseFloat(item.price) || 0) * (item.quantity || 1)).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button type="button" className={styles.secondaryBtn} onClick={() => setSelectedOrder(null)}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}

            {confirmDialog && (
              <div
                className={styles.modalOverlay}
                onClick={() => setConfirmDialog(null)}
              >
                <div
                  className={styles.modal}
                  style={{ maxWidth: 440 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="admin-confirm-title"
                >
                  <h2 id="admin-confirm-title" style={{ marginTop: 0 }}>Please confirm</h2>
                  <p style={{ fontSize: 15, color: '#334155', lineHeight: 1.55, marginBottom: 22 }}>
                    {getConfirmDialogMessage()}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                    <button type="button" className={styles.secondaryBtn} onClick={() => setConfirmDialog(null)}>
                      No
                    </button>
                    <button type="button" className={styles.adminSaveBtn} onClick={handleConfirmDialogYes}>
                      Yes
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Product Inventory</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.adminTableSearchRow}>
                    <div className={styles.adminSearchWrap}>
                      <Search size={20} strokeWidth={1.5} aria-hidden />
                      <input
                        type="search"
                        value={productsSearch}
                        onChange={(e) => setProductsSearch(e.target.value)}
                        placeholder="Search products by name, category, or seller…"
                      />
                    </div>
                  </div>
                  {selectedProductIds.length > 0 && (
                    <div className={styles.adminBatchBar}>
                      <span className={styles.adminBatchHint}>{selectedProductIds.length} selected</span>
                      <button type="button" className={styles.adminBtnArchive} onClick={requestBatchArchiveProducts}>
                        <Archive size={16} strokeWidth={1.75} aria-hidden />
                        Archive selected
                      </button>
                    </div>
                  )}
                  {dataLoading ? (
                    <p>Loading products…</p>
                  ) : filteredProducts.length === 0 ? (
                    <p className={styles.emptyState}>No products found.</p>
                  ) : (
                    <div className={styles.usersTable}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>
                              <input
                                type="checkbox"
                                className={styles.adminTableCheckbox}
                                checked={
                                  filteredProducts.length > 0
                                  && filteredProducts.every((p) => selectedProductIds.includes(p.id))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProductIds(filteredProducts.map((p) => p.id));
                                  } else {
                                    setSelectedProductIds([]);
                                  }
                                }}
                                aria-label="Select all visible products"
                              />
                            </th>
                            <th>Product</th>
                            <th>Seller</th>
                            <th>Category</th>
                            <th>Stock</th>
                            <th>Price</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProducts.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  className={styles.adminTableCheckbox}
                                  checked={selectedProductIds.includes(p.id)}
                                  onChange={() => {
                                    setSelectedProductIds((prev) => (
                                      prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                                    ));
                                  }}
                                  aria-label={`Select ${p.name}`}
                                />
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                  <img
                                    src={productImageUrl(p.image) || 'https://placehold.co/40x40'}
                                    alt=""
                                    width={46}
                                    height={46}
                                    className={styles.adminProductImg}
                                    onError={(e) => { e.target.src = 'https://placehold.co/40x40'; }}
                                  />
                                  <span>{p.name}</span>
                                </div>
                              </td>
                              <td>{p.seller?.name || '-'}</td>
                              <td>{p.category?.name || '-'}</td>
                              <td>
                                <span
                                  className={`${styles.adminStock} ${
                                    (p.stock ?? 0) === 0
                                      ? styles.adminStockZero
                                      : (p.stock ?? 0) <= 5
                                      ? styles.adminStockLow
                                      : ''
                                  }`}
                                >
                                  {p.stock ?? 0}
                                </span>
                                {(p.stock ?? 0) > 0 && (p.stock ?? 0) <= 5 && (
                                  <span className={styles.adminLowStockLabel}>Low Stock</span>
                                )}
                              </td>
                              <td>₱{Number(p.price || 0).toFixed(2)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className={styles.adminBtnArchive}
                                    title="Archive product"
                                    onClick={() => setConfirmDialog({ mode: 'archive-product', id: p.id })}
                                  >
                                    <Archive size={16} strokeWidth={1.75} aria-hidden />
                                    <span className={styles.adminActionText}>Archive</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.adminBtnDeleteSoft}
                                    title="Delete product permanently"
                                    onClick={() => requestDeleteProduct(p.id)}
                                  >
                                    <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                                    <span className={styles.adminActionText}>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'categories' && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Categories</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.adminTableSearchRow}>
                    <div className={styles.adminSearchWrap}>
                      <Search size={20} strokeWidth={1.5} aria-hidden />
                      <input
                        type="search"
                        value={categoriesSearch}
                        onChange={(e) => setCategoriesSearch(e.target.value)}
                        placeholder="Search categories by name or slug…"
                      />
                    </div>
                  </div>
                  <form
                    onSubmit={handleCreateCategory}
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 10,
                      alignItems: 'flex-end',
                      marginBottom: 20,
                      paddingBottom: 20,
                      borderBottom: '1px solid rgba(148, 163, 184, 0.25)',
                    }}
                  >
                    <div className={styles.formGroup} style={{ flex: '1 1 220px', marginBottom: 0 }}>
                      <label htmlFor="newCatName" className={styles.adminLabel}>
                        <strong>New category</strong>
                      </label>
                      <input
                        id="newCatName"
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="e.g. Accessories"
                        autoComplete="off"
                      />
                    </div>
                    <button
                      type="submit"
                      className={styles.secondaryBtn}
                      disabled={categoryCreating || !newCategoryName.trim()}
                      style={{ minHeight: 44 }}
                    >
                      {categoryCreating ? 'Adding…' : 'Add category'}
                    </button>
                  </form>
                  {dataLoading ? (
                    <p>Loading categories…</p>
                  ) : filteredCategories.length === 0 ? (
                    <p className={styles.emptyState}>No categories found.</p>
                  ) : (
                    <div className={styles.usersTable}>
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Slug</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCategories.map((c) => (
                            <tr key={c.id}>
                              <td>{c.name}</td>
                              <td>{c.slug}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button type="button" className={styles.adminBtnDeleteSoft} onClick={() => handleDeleteCategory(c.id)}>
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'customers' && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Customers</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.adminTableSearchRow}>
                    <div className={styles.adminSearchWrap}>
                      <Search size={20} strokeWidth={1.5} aria-hidden />
                      <input
                        type="search"
                        value={customersSearch}
                        onChange={(e) => setCustomersSearch(e.target.value)}
                        placeholder="Search customers by name, email, or phone…"
                      />
                    </div>
                  </div>
                  {selectedCustomerIds.length > 0 && (
                    <div className={styles.adminBatchBar}>
                      <span className={styles.adminBatchHint}>{selectedCustomerIds.length} selected</span>
                      <button type="button" className={styles.adminBtnArchive} onClick={requestBatchArchiveCustomers}>
                        <Archive size={16} strokeWidth={1.75} aria-hidden />
                        Archive selected
                      </button>
                    </div>
                  )}
                  {dataLoading ? (
                    <p>Loading customers...</p>
                  ) : filteredCustomerUsers.length > 0 ? (
                    <div className={styles.usersTable}>
                      <table>
                        <thead>
                          <tr>
                            <th style={{ width: 40 }}>
                              <input
                                type="checkbox"
                                className={styles.adminTableCheckbox}
                                checked={
                                  filteredCustomerUsers.length > 0
                                  && filteredCustomerUsers.every((u) => selectedCustomerIds.includes(u.id))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCustomerIds(filteredCustomerUsers.map((u) => u.id));
                                  } else {
                                    setSelectedCustomerIds([]);
                                  }
                                }}
                                aria-label="Select all visible customers"
                              />
                            </th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Joined</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCustomerUsers.map((u) => (
                            <tr key={u.id}>
                              <td>
                                <input
                                  type="checkbox"
                                  className={styles.adminTableCheckbox}
                                  checked={selectedCustomerIds.includes(u.id)}
                                  onChange={() => {
                                    setSelectedCustomerIds((prev) => (
                                      prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                                    ));
                                  }}
                                  aria-label={`Select ${u.name}`}
                                />
                              </td>
                              <td>{u.name}</td>
                              <td>{u.email}</td>
                              <td>{u.phone || '-'}</td>
                              <td>{new Date(u.created_at).toLocaleDateString()}</td>
                              <td style={{ textAlign: 'right' }}>
                                <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className={styles.adminBtnArchive}
                                    title="Archive customer"
                                    onClick={() => setConfirmDialog({ mode: 'archive-user', id: u.id })}
                                  >
                                    <Archive size={16} strokeWidth={1.75} aria-hidden />
                                    <span className={styles.adminActionText}>Archive</span>
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.adminBtnDeleteSoft}
                                    title="Delete customer permanently"
                                    onClick={() => requestDeleteUser(u.id)}
                                  >
                                    <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                                    <span className={styles.adminActionText}>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className={styles.emptyState}>No customers found.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>Sales Analytics</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.adminAnalyticsHero}>
                    <div>
                      <div className={styles.adminAnalyticsTitle}>Revenue trend (last 30 days)</div>
                      <div className={styles.adminAnalyticsSubtitle}>Based on orders in the last 30 days.</div>
                    </div>
                    <span className={`${styles.badge} ${styles.adminTrendBadge}`}>
                      {revenueChangePct != null
                        ? `${revenueChangePct >= 0 ? '📈 +' : '📉 '}${revenueChangePct.toFixed(1)}%`
                        : '—'}
                      <span style={{ fontSize: 11, fontWeight: 600, marginLeft: 6, opacity: 0.85 }}>(7d vs prior 7d)</span>
                    </span>
                  </div>
                  <div className={styles.adminAnalyticsChart}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analyticsSeries} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148,163,184,0.28)" />
                        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} minTickGap={16} />
                        <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₱${v}`} />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 14px 36px rgba(15, 23, 42, 0.14)' }}
                          formatter={(v, key) => (key === 'revenue'
                            ? [`₱${Number(v).toLocaleString('en-PH')}`, 'Revenue']
                            : [Number(v), 'Orders'])}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="orders" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className={`${styles.card} ${styles.adminSettingsDarkPage}`}>
                <div className={styles.adminSettingsPageHeader}>
                  <div>
                    <h2>Settings</h2>
                    <p className={styles.adminSettingsSubtitle}>
                      {settingsTab === 'archive'
                        ? 'Restore archived catalog items and customer accounts, or remove them permanently.'
                        : 'General, appearance, and notification preferences.'}
                    </p>
                  </div>
                  <div />
                </div>
                <div className={styles.adminSettingsPageBody}>
                  <div className={styles.adminSettingsShell}>
                  <div className={styles.adminSettingsTabs}>
                    <button
                      type="button"
                      className={`${styles.adminSettingsTab} ${settingsTab === 'general' ? styles.adminSettingsTabActive : ''}`}
                      onClick={() => setSettingsTab('general')}
                    >
                      <svg className={styles.adminTabIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 1v22" />
                        <path d="M17 5H9.5a2.5 2.5 0 0 0 0 5H14a2.5 2.5 0 0 1 0 5H6" />
                      </svg>
                      General
                    </button>
                    <button
                      type="button"
                      className={`${styles.adminSettingsTab} ${settingsTab === 'appearance' ? styles.adminSettingsTabActive : ''}`}
                      onClick={() => setSettingsTab('appearance')}
                    >
                      <svg className={styles.adminTabIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 3v18" />
                        <path d="M3 12h18" />
                        <path d="M7.5 7.5h0" />
                      </svg>
                      Appearance
                    </button>
                    <button
                      type="button"
                      className={`${styles.adminSettingsTab} ${settingsTab === 'notifications' ? styles.adminSettingsTabActive : ''}`}
                      onClick={() => setSettingsTab('notifications')}
                    >
                      <svg className={styles.adminTabIcon} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M10.268 21a2 2 0 0 0 3.464 0" />
                        <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
                      </svg>
                      Notifications
                    </button>
                    <button
                      type="button"
                      className={`${styles.adminSettingsTab} ${settingsTab === 'riders' ? styles.adminSettingsTabActive : ''}`}
                      onClick={() => setSettingsTab('riders')}
                    >
                      <Users className={styles.adminTabIcon} size={16} strokeWidth={1.75} aria-hidden />
                      Riders
                    </button>
                    <button
                      type="button"
                      className={`${styles.adminSettingsTab} ${settingsTab === 'archive' ? styles.adminSettingsTabActive : ''}`}
                      onClick={() => setSettingsTab('archive')}
                    >
                      <Archive className={styles.adminTabIcon} size={16} strokeWidth={1.75} aria-hidden />
                      Archive Recovery
                    </button>
                  </div>

                  {settingsTab === 'riders' && (
                    <div className={styles.adminSettingsGrid}>
                      <div className={styles.adminSettingsCard} style={{ gridColumn: '1 / -1' }}>
                        <div className={styles.adminSettingsSectionTitle}>Manage riders</div>
                        <p className={styles.adminSettingsSubtitle} style={{ marginBottom: 16 }}>
                          Two built-in fleet accounts. Edit names and contact details shown to customers on shipped orders.
                        </p>
                        {fleetRiders.length === 0 ? (
                          <p className={styles.adminSettingsMuted}>No riders found. Run php artisan db:seed --class=RiderSeeder</p>
                        ) : (
                          <div className={styles.adminRiderManageList}>
                            {fleetRiders.map((r) => (
                              <div key={r.id} className={styles.adminRiderManageCard}>
                                <div className={styles.adminRiderManageHead}>
                                  <span
                                    className={`${styles.adminRiderStatusDot} ${r.status === 'busy' ? styles.adminRiderStatusDotBusy : styles.adminRiderStatusDotAvailable}`}
                                    title={r.status === 'busy' ? 'Busy' : 'Available'}
                                    aria-hidden
                                  />
                                  <span className={styles.adminRiderManageEmail}>{r.email}</span>
                                </div>
                                <div className={styles.adminRiderManageFields}>
                                  <div className={styles.formGroup}>
                                    <label className={styles.adminLabel} htmlFor={`rider-name-${r.id}`}>
                                      <strong>Rider name</strong>
                                    </label>
                                    <input
                                      id={`rider-name-${r.id}`}
                                      value={riderDrafts[r.id]?.name ?? ''}
                                      onChange={(e) => setRiderDrafts((prev) => ({
                                        ...prev,
                                        [r.id]: { ...prev[r.id], name: e.target.value, phone: prev[r.id]?.phone ?? '', vehicle_plate: prev[r.id]?.vehicle_plate ?? '' },
                                      }))}
                                    />
                                  </div>
                                  <div className={styles.formGroup}>
                                    <label className={styles.adminLabel} htmlFor={`rider-phone-${r.id}`}>
                                      <strong>Phone</strong>
                                    </label>
                                    <input
                                      id={`rider-phone-${r.id}`}
                                      value={riderDrafts[r.id]?.phone ?? ''}
                                      onChange={(e) => setRiderDrafts((prev) => ({
                                        ...prev,
                                        [r.id]: { ...prev[r.id], phone: e.target.value, name: prev[r.id]?.name ?? '', vehicle_plate: prev[r.id]?.vehicle_plate ?? '' },
                                      }))}
                                    />
                                  </div>
                                  <div className={styles.formGroup}>
                                    <label className={styles.adminLabel} htmlFor={`rider-plate-${r.id}`}>
                                      <strong>Vehicle plate</strong>
                                    </label>
                                    <input
                                      id={`rider-plate-${r.id}`}
                                      value={riderDrafts[r.id]?.vehicle_plate ?? ''}
                                      onChange={(e) => setRiderDrafts((prev) => ({
                                        ...prev,
                                        [r.id]: { ...prev[r.id], vehicle_plate: e.target.value, name: prev[r.id]?.name ?? '', phone: prev[r.id]?.phone ?? '' },
                                      }))}
                                    />
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={styles.adminSaveBtn}
                                  style={{ marginTop: 8 }}
                                  disabled={riderSavingId === r.id}
                                  onClick={() => handleSaveRiderProfile(r.id)}
                                >
                                  {riderSavingId === r.id ? 'Saving…' : 'Save rider'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {settingsTab === 'archive' && (
                    <div className={styles.adminArchiveRecovery}>
                      <div className={styles.adminArchiveSection}>
                        <h3 className={styles.adminArchiveHeading}>Archived Products</h3>
                        <p className={styles.adminArchiveHint}>Items hidden from the storefront and seller inventory lists.</p>
                        <div className={styles.adminTableSearchRow}>
                          <div className={styles.adminSearchWrap}>
                            <Search size={20} strokeWidth={1.5} aria-hidden />
                            <input
                              type="search"
                              value={archiveProductsSearch}
                              onChange={(e) => setArchiveProductsSearch(e.target.value)}
                              placeholder="Search archived products…"
                            />
                          </div>
                        </div>
                        {selectedArchivedProductIds.length > 0 && (
                          <div className={styles.adminBatchBar}>
                            <span className={styles.adminBatchHint}>{selectedArchivedProductIds.length} selected</span>
                            <button type="button" className={styles.adminBtnRestore} onClick={handleBatchRestoreArchivedProducts}>
                              <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
                              Restore selected
                            </button>
                            <button type="button" className={styles.adminBtnDeleteSoft} onClick={handleBatchPermanentDeleteArchivedProducts}>
                              <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                              Delete permanently
                            </button>
                          </div>
                        )}
                        {archiveLoading ? (
                          <p className={styles.adminSettingsMuted}>Loading archived products…</p>
                        ) : filteredArchivedProducts.length === 0 ? (
                          <p className={styles.emptyState}>No archived products.</p>
                        ) : (
                          <div className={styles.usersTable}>
                            <table>
                              <thead>
                                <tr>
                                  <th style={{ width: 40 }}>
                                    <input
                                      type="checkbox"
                                      className={styles.adminTableCheckbox}
                                      checked={
                                        filteredArchivedProducts.length > 0
                                        && filteredArchivedProducts.every((p) => selectedArchivedProductIds.includes(p.id))
                                      }
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedArchivedProductIds(filteredArchivedProducts.map((p) => p.id));
                                        } else {
                                          setSelectedArchivedProductIds([]);
                                        }
                                      }}
                                      aria-label="Select all archived products"
                                    />
                                  </th>
                                  <th>Product</th>
                                  <th>Category</th>
                                  <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredArchivedProducts.map((p) => (
                                  <tr key={p.id}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        className={styles.adminTableCheckbox}
                                        checked={selectedArchivedProductIds.includes(p.id)}
                                        onChange={() => {
                                          setSelectedArchivedProductIds((prev) => (
                                            prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                                          ));
                                        }}
                                        aria-label={`Select ${p.name}`}
                                      />
                                    </td>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <img
                                          src={productImageUrl(p.image) || 'https://placehold.co/40x40'}
                                          alt=""
                                          width={40}
                                          height={40}
                                          style={{ borderRadius: 8, objectFit: 'cover' }}
                                          onError={(e) => { e.target.src = 'https://placehold.co/40x40'; }}
                                        />
                                        {p.name}
                                      </div>
                                    </td>
                                    <td>{p.category?.name || '—'}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <button
                                          type="button"
                                          className={`${styles.adminArchiveIconBtn} ${styles.adminArchiveIconBtnRestore}`}
                                          title="Restore"
                                          aria-label={`Restore product ${p.name}`}
                                          onClick={() => handleRestoreProduct(p.id)}
                                        >
                                          <RotateCcw size={18} strokeWidth={2} aria-hidden />
                                        </button>
                                        <button
                                          type="button"
                                          className={`${styles.adminArchiveIconBtn} ${styles.adminArchiveIconBtnDelete}`}
                                          title="Permanent delete"
                                          aria-label={`Permanently delete product ${p.name}`}
                                          onClick={() => requestDeleteProduct(p.id)}
                                        >
                                          <Trash2 size={18} strokeWidth={2} aria-hidden />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className={styles.adminArchiveSection}>
                        <h3 className={styles.adminArchiveHeading}>Archived Customers</h3>
                        <p className={styles.adminArchiveHint}>Accounts cannot sign in until restored.</p>
                        <div className={styles.adminTableSearchRow}>
                          <div className={styles.adminSearchWrap}>
                            <Search size={20} strokeWidth={1.5} aria-hidden />
                            <input
                              type="search"
                              value={archiveCustomersSearch}
                              onChange={(e) => setArchiveCustomersSearch(e.target.value)}
                              placeholder="Search archived customers…"
                            />
                          </div>
                        </div>
                        {selectedArchivedCustomerIds.length > 0 && (
                          <div className={styles.adminBatchBar}>
                            <span className={styles.adminBatchHint}>{selectedArchivedCustomerIds.length} selected</span>
                            <button type="button" className={styles.adminBtnRestore} onClick={handleBatchRestoreArchivedUsers}>
                              <RotateCcw size={16} strokeWidth={1.75} aria-hidden />
                              Restore selected
                            </button>
                            <button type="button" className={styles.adminBtnDeleteSoft} onClick={handleBatchPermanentDeleteArchivedUsers}>
                              <Trash2 size={16} strokeWidth={1.75} aria-hidden />
                              Delete permanently
                            </button>
                          </div>
                        )}
                        {archiveLoading ? (
                          <p className={styles.adminSettingsMuted}>Loading archived customers…</p>
                        ) : filteredArchivedUsers.length === 0 ? (
                          <p className={styles.emptyState}>No archived customers.</p>
                        ) : (
                          <div className={styles.usersTable}>
                            <table>
                              <thead>
                                <tr>
                                  <th style={{ width: 40 }}>
                                    <input
                                      type="checkbox"
                                      className={styles.adminTableCheckbox}
                                      checked={
                                        filteredArchivedUsers.length > 0
                                        && filteredArchivedUsers.every((u) => selectedArchivedCustomerIds.includes(u.id))
                                      }
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedArchivedCustomerIds(filteredArchivedUsers.map((u) => u.id));
                                        } else {
                                          setSelectedArchivedCustomerIds([]);
                                        }
                                      }}
                                      aria-label="Select all archived customers"
                                    />
                                  </th>
                                  <th>Name</th>
                                  <th>Email</th>
                                  <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filteredArchivedUsers.map((u) => (
                                  <tr key={u.id}>
                                    <td>
                                      <input
                                        type="checkbox"
                                        className={styles.adminTableCheckbox}
                                        checked={selectedArchivedCustomerIds.includes(u.id)}
                                        onChange={() => {
                                          setSelectedArchivedCustomerIds((prev) => (
                                            prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]
                                          ));
                                        }}
                                        aria-label={`Select ${u.name}`}
                                      />
                                    </td>
                                    <td>{u.name}</td>
                                    <td>{u.email}</td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <button
                                          type="button"
                                          className={`${styles.adminArchiveIconBtn} ${styles.adminArchiveIconBtnRestore}`}
                                          title="Restore"
                                          aria-label={`Restore customer ${u.name}`}
                                          onClick={() => handleRestoreUser(u.id)}
                                        >
                                          <RotateCcw size={18} strokeWidth={2} aria-hidden />
                                        </button>
                                        <button
                                          type="button"
                                          className={`${styles.adminArchiveIconBtn} ${styles.adminArchiveIconBtnDelete}`}
                                          title="Permanent delete"
                                          aria-label={`Permanently delete customer ${u.name}`}
                                          onClick={() => requestDeleteUser(u.id)}
                                        >
                                          <Trash2 size={18} strokeWidth={2} aria-hidden />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {settingsTab === 'general' && (
                    <div className={styles.adminSettingsGrid}>
                      <div className={styles.adminSettingsCard}>
                        <div className={styles.adminSettingsSectionTitle}>Store info</div>
                        <div className={styles.adminTwoCol}>
                          <div className={styles.formGroup}>
                            <label htmlFor="storeName" className={styles.adminLabel}>
                              <span className={styles.adminLabelIcon} aria-hidden>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 21h18" />
                                  <path d="M5 21V7l8-4 8 4v14" />
                                  <path d="M9 21v-8h6v8" />
                                </svg>
                              </span>
                              <strong>Store Name</strong>
                            </label>
                            <input
                              id="storeName"
                              type="text"
                              value={settings.storeName}
                              onChange={(e) => updateSetting('storeName', e.target.value)}
                            />
                          </div>
                          <div className={styles.adminLogoBox}>
                            <div className={styles.adminLogoPreview}>
                              {settings.logoDataUrl ? (
                                <img src={settings.logoDataUrl} alt="Logo preview" />
                              ) : (
                                <span>Logo</span>
                              )}
                            </div>
                            <div>
                              <div className={styles.adminSettingsStrongMini}>Logo Preview</div>
                              <label className={styles.adminFileBtn}>
                                Upload Logo
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className={styles.formGroup}>
                          <label htmlFor="supportEmail" className={styles.adminLabel}>
                            <span className={styles.adminLabelIcon} aria-hidden>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                              </svg>
                            </span>
                            <strong>Support Email</strong>
                          </label>
                          <input
                            id="supportEmail"
                            type="email"
                            value={settings.supportEmail}
                            onChange={(e) => updateSetting('supportEmail', e.target.value)}
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label htmlFor="desc" className={styles.adminLabel}>
                            <span className={styles.adminLabelIcon} aria-hidden>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 7h16" />
                                <path d="M4 12h16" />
                                <path d="M4 17h10" />
                              </svg>
                            </span>
                            <strong>Store Description</strong>
                          </label>
                          <textarea
                            id="desc"
                            rows={4}
                            value={settings.description}
                            onChange={(e) => updateSetting('description', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className={styles.adminSettingsCard}>
                        <div className={styles.adminSettingsSectionTitle}>System toggles</div>
                        <Toggle
                          label="Maintenance Mode"
                          checked={settings.maintenanceMode}
                          onChange={(v) => updateSetting('maintenanceMode', v)}
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a2 2 0 0 1 0 2.8l-5.2 5.2a2 2 0 0 1-2.8 0L6.7 17a1 1 0 0 0-1.4 0l-1 1a2 2 0 0 0 0 2.8l.2.2a2 2 0 0 0 2.8 0l1-1a1 1 0 0 0 0-1.4l-.3-.3" />
                              <path d="M7 7h.01" />
                            </svg>
                          }
                        />
                        <Toggle
                          label="Enable Coupons"
                          checked={settings.enableCoupons}
                          onChange={(v) => updateSetting('enableCoupons', v)}
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6" />
                              <path d="M4 12V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6" />
                              <path d="M12 8v8" />
                            </svg>
                          }
                        />
                        <Toggle
                          label="2FA Authentication"
                          checked={settings.enable2fa}
                          onChange={(v) => updateSetting('enable2fa', v)}
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <rect x="3" y="11" width="18" height="11" rx="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          }
                        />
                        <div className={styles.formGroup} style={{ marginTop: 14 }}>
                          <label className={styles.adminLabel}>
                            <span className={styles.adminLabelIcon} aria-hidden>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1v22" />
                                <path d="M17 5H9.5a2.5 2.5 0 0 0 0 5H14a2.5 2.5 0 0 1 0 5H6" />
                              </svg>
                            </span>
                            <strong>Default Currency</strong>
                          </label>
                          <select value="PHP" disabled>
                            <option value="PHP">PHP (₱)</option>
                            <option value="USD">USD ($)</option>
                          </select>
                          <p className={styles.adminSettingsSubtitle} style={{ margin: '6px 0 0', fontSize: 12 }}>
                            Currency switching can be enabled later.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'appearance' && (
                    <div className={styles.adminSettingsGrid}>
                      <div className={styles.adminSettingsCard}>
                        <div className={styles.adminSettingsSectionTitle}>Brand colors</div>
                        <div className={styles.adminTwoCol}>
                          <div className={styles.formGroup}>
                            <label className={styles.adminLabel}>
                              <span className={styles.adminLabelIcon} aria-hidden>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22a2 2 0 0 0 2-2c0-1.1-1.2-2.5-2-3.3-.8.8-2 2.2-2 3.3a2 2 0 0 0 2 2Z" />
                                  <path d="M12 2v10" />
                                  <path d="M7 7h10" />
                                </svg>
                              </span>
                              <strong>Primary</strong>
                            </label>
                            <input type="color" value={settings.brandPrimary} onChange={(e) => updateSetting('brandPrimary', e.target.value)} />
                          </div>
                          <div className={styles.formGroup}>
                            <label className={styles.adminLabel}>
                              <span className={styles.adminLabelIcon} aria-hidden>
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 22a2 2 0 0 0 2-2c0-1.1-1.2-2.5-2-3.3-.8.8-2 2.2-2 3.3a2 2 0 0 0 2 2Z" />
                                  <path d="M12 2v10" />
                                  <path d="M7 7h10" />
                                </svg>
                              </span>
                              <strong>Accent</strong>
                            </label>
                            <input type="color" value={settings.brandAccent} onChange={(e) => updateSetting('brandAccent', e.target.value)} />
                          </div>
                        </div>
                        <div className={styles.adminColorPreview} style={{ background: `linear-gradient(135deg, ${settings.brandPrimary}, ${settings.brandAccent})` }}>
                          Brand gradient preview
                        </div>
                      </div>
                      <div className={styles.adminSettingsCard}>
                        <div className={styles.adminSettingsSectionTitle}>Banner settings</div>
                        <Toggle
                          label="Enable homepage banner"
                          checked={settings.bannerEnabled}
                          onChange={(v) => updateSetting('bannerEnabled', v)}
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M4 5h16" />
                              <path d="M4 12h16" />
                              <path d="M4 19h16" />
                            </svg>
                          }
                        />
                        <div className={styles.formGroup} style={{ marginTop: 12 }}>
                          <label className={styles.adminLabel}>
                            <span className={styles.adminLabelIcon} aria-hidden>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 7h16" />
                                <path d="M4 12h10" />
                                <path d="M4 17h16" />
                              </svg>
                            </span>
                            <strong>Banner text</strong>
                          </label>
                          <input
                            type="text"
                            value={settings.bannerText}
                            onChange={(e) => updateSetting('bannerText', e.target.value)}
                            disabled={!settings.bannerEnabled}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'notifications' && (
                    <div className={styles.adminSettingsGrid}>
                      <div className={styles.adminSettingsCard}>
                        <div className={styles.adminSettingsSectionTitle}>Order alerts</div>
                        <Toggle
                          label="Email on New Order"
                          checked={settings.emailOnNewOrder}
                          onChange={(v) => updateSetting('emailOnNewOrder', v)}
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <rect x="2" y="4" width="20" height="16" rx="2" />
                              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                          }
                        />
                        <Toggle
                          label="SMS alerts"
                          checked={settings.smsAlerts}
                          onChange={(v) => updateSetting('smsAlerts', v)}
                          icon={
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                              <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                            </svg>
                          }
                        />
                        <p className={styles.adminSettingsSubtitle} style={{ margin: '10px 0 0', fontSize: 12 }}>
                          SMS requires a provider integration (can be added later).
                        </p>
                      </div>
                      <div className={styles.adminSettingsCard}>
                        <div className={styles.adminSettingsSectionTitle}>Danger Zone</div>
                        <div className={styles.adminDangerZone}>
                          <div>
                            <div className={styles.adminDangerTitle}>Reset store data</div>
                            <div className={styles.adminDangerDesc}>
                              Clears local admin settings (frontend-only for now).
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.adminDangerBtn}
                            onClick={() => {
                              if (!confirm('Reset store settings to defaults?')) return;
                              const defaults = {
                                storeName: 'urbanNxt',
                                supportEmail: user.email || '',
                                description: 'Premium urban clothing brand for the modern generation.',
                                logoDataUrl: '',
                                brandPrimary: '#4f46e5',
                                brandAccent: '#2563eb',
                                bannerText: 'Redefine Your Style',
                                bannerEnabled: true,
                                maintenanceMode: false,
                                enableCoupons: true,
                                enable2fa: false,
                                emailOnNewOrder: true,
                                smsAlerts: false,
                              };
                              setSettings(defaults);
                              setInitialSettings(defaults);
                              updateAdminSettings({
                                store_name: defaults.storeName,
                                support_email: defaults.supportEmail,
                                description: defaults.description,
                                logo_data_url: null,
                                brand_primary: defaults.brandPrimary,
                                brand_accent: defaults.brandAccent,
                                banner_text: defaults.bannerText,
                                banner_enabled: defaults.bannerEnabled,
                                maintenance_mode: defaults.maintenanceMode,
                                enable_coupons: defaults.enableCoupons,
                                enable_2fa: defaults.enable2fa,
                                email_on_new_order: defaults.emailOnNewOrder,
                                sms_alerts: defaults.smsAlerts,
                              }).catch(() => {});
                              showToast({ message: 'Store settings reset.', type: 'success' });
                            }}
                          >
                            Reset
                          </button>
                        </div>
                        <div className={styles.adminDangerZone} style={{ marginTop: 10 }}>
                          <div>
                            <div className={styles.adminDangerTitle}>Delete account</div>
                            <div className={styles.adminDangerDesc}>
                              This action is irreversible (not connected yet).
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.adminDangerBtn}
                            onClick={() => alert('Not implemented yet.')}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  {settingsTab !== 'archive' && settingsTab !== 'riders' && (
                  <div className={styles.adminSettingsFooter}>
                    <button
                      type="button"
                      className={styles.adminGhostBtn}
                      onClick={handleDiscardSettings}
                      disabled={!hasUnsavedSettings || settingsSaving}
                      title="Discard unsaved changes"
                    >
                      Discard Changes
                    </button>
                    <button
                      type="button"
                      className={styles.adminSaveBtn}
                      onClick={handleSaveSettings}
                      disabled={!hasUnsavedSettings || settingsSaving}
                    >
                      {settingsSaving ? (
                        <span className={styles.adminBtnSpinner} aria-hidden />
                      ) : null}
                      {settingsSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </div>
                  )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </AdminShell>
      </div>
    </>
  );
}
