import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
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
  deleteAdminCategory,
  createAdminCategory,
  createAdminProduct,
  approveAdminProduct,
  rejectAdminProduct,
  fetchAdminArchivedProducts,
  fetchAdminArchivedUsers,
  fetchAdminInventoryReport,
  fetchAdminRiders,
  assignAdminOrderRider,
  updateAdminRider,
  archiveAdminProduct,
  archiveAdminUser,
  deleteAdminUser,
  restoreAdminProduct,
  restoreAdminUser,
  archiveAdminProductsBatch,
  archiveAdminUsersBatch,
  uploadProofOfDelivery,
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
  Bell,
  Bike,
  MapPin,
  PackageSearch,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Link as LinkIcon,
  TrendingUp,
  Truck,
  Users,
  X,
  CreditCard,
} from 'lucide-react';
import styles from '@/styles/dashboard.module.scss';
import { PRODUCT_SIZE_OPTIONS } from '@/constants/commerce';

function formatAdminSizesSummary(selected) {
  if (!selected || selected.length === 0) return 'Select sizes…';
  if (selected.length >= PRODUCT_SIZE_OPTIONS.length) return 'All sizes selected';
  const joined = selected.join(', ');
  if (joined.length > 52) return `${joined.slice(0, 50)}…`;
  return joined;
}

const FALLBACK_CATEGORIES = [
  'Men',
  'Women',
  'Kids',
];

function formatAdminDateTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

/** User-facing order status (API still uses `delivered`). */
function formatOrderStatusLabel(statusRaw) {
  const s = (statusRaw || '').toLowerCase();
  if (s === 'delivered') return 'Completed';
  return statusRaw || '—';
}

/** Rider handoff row for Track order tab */
function getTrackPickupDisplay(order) {
  const s = (order.status || '').toLowerCase();
  const hasRider = !!(order.rider_id ?? order.rider?.id);
  const picked = order.picked_up_at;
  if (s === 'delivered') {
    return {
      title: 'Completed',
      detail: picked ? `Picked up ${formatAdminDateTime(picked)}` : 'Order finished',
      tone: 'done',
    };
  }
  if (s === 'shipped') {
    if (!hasRider) {
      return { title: 'Awaiting rider', detail: 'Assign a delivery partner', tone: 'warn' };
    }
    if (picked) {
      return {
        title: 'Picked up',
        detail: formatAdminDateTime(picked),
        tone: 'ok',
      };
    }
    return {
      title: 'Rider assigned',
      detail: 'Waiting for rider to confirm pickup',
      tone: 'pending',
    };
  }
  return { title: '—', detail: '', tone: 'muted' };
}

const ADMIN_TAB_KEYS = ['overview', 'orders', 'products', 'inventory', 'categories', 'customers', 'analytics', 'settings'];

const ACTIVE_ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped'];
const COMPLETED_ORDER_STATUSES = ['delivered', 'cancelled'];
const TRACK_ORDER_STATUSES = ['shipped', 'delivered'];

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
  const [dashboardLoaded, setDashboardLoaded] = useState(false);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderSubTab, setOrderSubTab] = useState('active');
  const [activeOrdersStatusFilter, setActiveOrdersStatusFilter] = useState(null);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [productsSearch, setProductsSearch] = useState('');
  /** @type {'all' | 'pending' | 'live' | 'rejected'} */
  const [productsScopeTab, setProductsScopeTab] = useState('all');
  const [productApprovalLoadingId, setProductApprovalLoadingId] = useState(null);
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [showProductDetailsModal, setShowProductDetailsModal] = useState(false);
  const [proofOfDeliveryFile, setProofOfDeliveryFile] = useState(null);
  const [uploadingProofOfDelivery, setUploadingProofOfDelivery] = useState(false);
  const [inventoryRows, setInventoryRows] = useState([]);
  const [inventoryTotals, setInventoryTotals] = useState({ total_units_sold: 0, total_sales_amount: 0 });
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState('');
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
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [productCreating, setProductCreating] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUploadMode, setImageUploadMode] = useState('url');
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    category_id: '',
    image: '',
    sizes: [],
    sales_cap_quantity: '',
    sales_cap_period: '',
  });

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
    if (!user || user.role?.name?.toLowerCase() !== 'admin') return;
    if (dashboardLoaded || dataLoading) return;

    fetchDashboardData();
  }, [user?.id, user?.role?.name, dashboardLoaded, dataLoading]);

  useEffect(() => {
    if (!user || user.role?.name?.toLowerCase() !== 'admin' || activeTab !== 'orders') return undefined;
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetchAdminOrders();
        if (!cancelled) {
          setOrders(res.data.orders || []);
        }
      } catch (error) {
        console.error('Failed to refresh admin orders:', error);
      }
    };

    const intervalId = setInterval(refresh, 15000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [activeTab, user?.id, user?.role?.name]);

  useEffect(() => {
    if (!user || user.role?.name?.toLowerCase() !== 'admin') return undefined;
    if (!['overview', 'orders'].includes(activeTab)) return undefined;
    const intervalId = setInterval(() => {
      fetchDashboardData();
    }, 20000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id, user?.role?.name]);

  useEffect(() => {
    if (!addProductOpen || categories.length > 0) return undefined;
    let cancelled = false;
    fetchAdminCategories()
      .then((res) => {
        if (!cancelled) {
          setCategories(res.data.categories || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [addProductOpen, categories.length]);

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
    setSettings((prev) => ({
      ...prev,
      supportEmail: prev.supportEmail || user.email || '',
    }));
  }, [user]);

  useEffect(() => {
    if (!initialSettings) {
      setInitialSettings(settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSettings]);

  useEffect(() => {
    if (activeTab !== 'inventory' || !user || String(user.role?.name || '').toLowerCase() !== 'admin') return undefined;
    let cancelled = false;
    setInventoryLoading(true);
    fetchAdminInventoryReport()
      .then((res) => {
        if (cancelled) return;
        setInventoryRows(res.data?.products || []);
        setInventoryTotals(res.data?.totals || { total_units_sold: 0, total_sales_amount: 0 });
      })
      .catch(() => {
        if (!cancelled) {
          setInventoryRows([]);
          setInventoryTotals({ total_units_sold: 0, total_sales_amount: 0 });
        }
      })
      .finally(() => {
        if (!cancelled) setInventoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, user]);

  useEffect(() => {
    if (activeTab !== 'settings' || settingsTab !== 'archive' || !user || String(user.role?.name || '').toLowerCase() !== 'admin') {
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
          address: r.address || '',
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
      setDashboardLoaded(true);
    } catch (error) {
      if (error?.response?.status === 429) {
        showToast({
          message: 'Too many requests. Please wait a moment and refresh the page.',
          type: 'error',
        });
      }
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setDataLoading(false);
      setDashboardLoaded(true);
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
        address: d.address,
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

  const handleApproveProduct = async (productId) => {
    setProductApprovalLoadingId(productId);
    try {
      await approveAdminProduct(productId);
      const refreshed = await fetchAdminProducts();
      setProducts(refreshed.data.products || []);
      showToast({ message: 'Product published to the store.', type: 'success' });
      setShowProductDetailsModal(false);
      setSelectedProductForModal(null);
    } catch (e) {
      showToast({
        message: e.response?.data?.message || e.message || 'Could not publish product.',
        type: 'error',
      });
    } finally {
      setProductApprovalLoadingId(null);
    }
  };

  const handleRejectProduct = async (productId) => {
    setProductApprovalLoadingId(productId);
    try {
      await rejectAdminProduct(productId);
      const refreshed = await fetchAdminProducts();
      setProducts(refreshed.data.products || []);
      showToast({ message: 'Product rejected.', type: 'success' });
      setShowProductDetailsModal(false);
      setSelectedProductForModal(null);
    } catch (e) {
      showToast({
        message: e.response?.data?.message || e.message || 'Could not reject product.',
        type: 'error',
      });
    } finally {
      setProductApprovalLoadingId(null);
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
        showToast({ message: 'User archived.', type: 'success' });
        const ur = await fetchAdminArchivedUsers();
        setArchivedUsers(ur.data?.users || []);
      } else if (d.mode === 'delete-archived-user') {
        await deleteAdminUser(d.id);
        const refreshed = await fetchAdminArchivedUsers();
        setArchivedUsers(refreshed.data.users || []);
        setSelectedArchivedCustomerIds((prev) => prev.filter((x) => x !== d.id));
        showToast({ message: 'User permanently deleted.', type: 'success' });
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
        showToast({ message: 'Selected users archived.', type: 'success' });
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

  const handleRestoreUser = async (id) => {
    try {
      await restoreAdminUser(id);
      const [ur, main] = await Promise.all([fetchAdminArchivedUsers(), fetchAdminUsers()]);
      setArchivedUsers(ur.data?.users || []);
      setUsers(main.data?.users || []);
      setSelectedArchivedCustomerIds((prev) => prev.filter((x) => x !== id));
      showToast({ message: 'User restored.', type: 'success' });
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to restore user.');
    }
  };

  const handlePermanentDeleteUser = (id) => {
    setConfirmDialog({ mode: 'delete-archived-user', id });
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
      showToast({ message: 'Users restored.', type: 'success' });
    } catch (e) {
      alert(e.response?.data?.message || e.message || 'Failed to restore users.');
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

  const resetNewProductForm = () => {
    setNewProduct({
      name: '',
      description: '',
      price: '',
      stock: '',
      category_id: '',
      image: '',
      sizes: [],
      sales_cap_quantity: '',
      sales_cap_period: '',
    });
    setImageFile(null);
    setImagePreview('');
  };

  const handleProductImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    const name = newProduct.name.trim();
    const categoryValue = String(newProduct.category_id || '').trim();
    const categoryId = parseInt(categoryValue, 10);
    const price = parseFloat(String(newProduct.price));
    const stock = parseInt(String(newProduct.stock), 10);
    if (!name || !categoryValue) {
      showToast({ message: 'Name and category are required.', type: 'error' });
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      showToast({ message: 'Enter a valid price.', type: 'error' });
      return;
    }
    if (Number.isNaN(stock) || stock < 0) {
      showToast({ message: 'Enter a valid stock quantity.', type: 'error' });
      return;
    }
    let targetCategoryId = categoryId;
    if (Number.isNaN(targetCategoryId)) {
      const categoryName = categoryValue;
      const existing = categories.find((c) => String(c.name).toLowerCase() === categoryName.toLowerCase());
      if (existing) {
        targetCategoryId = existing.id;
      } else if (categoryName) {
        const created = await createAdminCategory({ name: categoryName });
        const newCategory = created.data?.category;
        if (newCategory?.id) {
          targetCategoryId = newCategory.id;
          setCategories((prev) => [...prev, newCategory]);
        }
      }
    }

    if (!targetCategoryId) {
      showToast({ message: 'Name and category are required.', type: 'error' });
      return;
    }

    let payload;
    if (imageUploadMode === 'file' && imageFile) {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', newProduct.description.trim() || '');
      formData.append('price', String(price));
      formData.append('stock', String(stock));
      formData.append('category_id', String(targetCategoryId));
      formData.append('image_file', imageFile);
      if (Array.isArray(newProduct.sizes) && newProduct.sizes.length > 0) {
        newProduct.sizes.forEach((size) => formData.append('sizes[]', size));
      }
      if (newProduct.sales_cap_quantity) {
        formData.append('sales_cap_quantity', String(newProduct.sales_cap_quantity));
      }
      if (newProduct.sales_cap_period) {
        formData.append('sales_cap_period', newProduct.sales_cap_period);
      }
      payload = formData;
    } else {
      payload = {
        name,
        description: newProduct.description.trim() || undefined,
        price,
        stock,
        category_id: targetCategoryId,
      };
      if (imageUploadMode === 'url' && newProduct.image) {
        payload.image = newProduct.image;
      }
      if (Array.isArray(newProduct.sizes) && newProduct.sizes.length > 0) {
        payload.sizes = newProduct.sizes;
      }
      if (newProduct.sales_cap_quantity) {
        payload.sales_cap_quantity = parseInt(String(newProduct.sales_cap_quantity), 10);
      }
      if (newProduct.sales_cap_period) {
        payload.sales_cap_period = newProduct.sales_cap_period;
      }
    }
    const capQtyRaw = String(newProduct.sales_cap_quantity || '').trim();
    const capPeriod = newProduct.sales_cap_period;
    if (capQtyRaw) {
      const capQty = parseInt(capQtyRaw, 10);
      if (Number.isNaN(capQty) || capQty < 1) {
        showToast({ message: 'Enter a valid sales cap (at least 1) or clear it.', type: 'error' });
        return;
      }
      if (capPeriod !== 'month' && capPeriod !== 'year') {
        showToast({ message: 'Choose this month or this year for the sales cap.', type: 'error' });
        return;
      }
      payload.sales_cap_quantity = capQty;
      payload.sales_cap_period = capPeriod;
    }
    setProductCreating(true);
    try {
      const res = await createAdminProduct(payload);
      setAddProductOpen(false);
      resetNewProductForm();
      const refreshed = await fetchAdminProducts();
      setProducts(refreshed.data.products || []);
      showToast({
        message: res.data?.message || 'Product submitted for approval.',
        type: 'success',
      });
    } catch (err) {
      const msg = err.response?.data?.message
        || (typeof err.response?.data?.errors === 'object'
          ? Object.values(err.response.data.errors).flat().join(' ')
          : null)
        || err.message
        || 'Failed to create product.';
      showToast({ message: msg, type: 'error' });
    } finally {
      setProductCreating(false);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleUploadProofOfDelivery = async () => {
    if (!proofOfDeliveryFile || !selectedOrder) return;
    setUploadingProofOfDelivery(true);
    try {
      const res = await uploadProofOfDelivery(selectedOrder.id, proofOfDeliveryFile);
      setSelectedOrder(res.data.order);
      setProofOfDeliveryFile(null);
      showToast({ message: 'Proof of delivery uploaded successfully.', type: 'success' });
    } catch (e) {
      showToast({
        message: e.response?.data?.message || e.message || 'Failed to upload proof of delivery.',
        type: 'error',
      });
    } finally {
      setUploadingProofOfDelivery(false);
    }
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
      const st = (o.status || '').toLowerCase();
      const statusMatches =
        st.includes(q)
        || (q.includes('completed') && st === 'delivered')
        || (q.includes('delivered') && st === 'delivered');
      return (
        String(o.order_number || o.id || '').toLowerCase().includes(q)
        || customer.includes(q)
        || statusMatches
      );
    });
  }, [orders, overviewOrdersSearch]);

  const orderMatchesSearch = (o, qRaw) => {
    const q = qRaw.trim().toLowerCase();
    if (!q) return true;
    const customer = `${o.customer?.name || ''} ${o.customer?.email || ''}`.toLowerCase();
    const rider = `${o.rider?.user?.name || ''} ${o.rider?.user?.email || ''}`.toLowerCase();
    const st = (o.status || '').toLowerCase();
    const statusMatches =
      st.includes(q)
      || (q.includes('completed') && st === 'delivered')
      || (q.includes('delivered') && st === 'delivered');
    return (
      String(o.order_number || o.id || '').toLowerCase().includes(q)
      || customer.includes(q)
      || rider.includes(q)
      || statusMatches
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

  const trackOrdersList = useMemo(() => {
    const q = ordersSearch;
    return (orders || [])
      .filter((o) => {
        const s = (o.status || '').toLowerCase();
        if (!TRACK_ORDER_STATUSES.includes(s)) return false;
        return orderMatchesSearch(o, q);
      })
      .sort((a, b) => {
        const sa = (a.status || '').toLowerCase();
        const sb = (b.status || '').toLowerCase();
        if (sa !== sb) return sa === 'shipped' ? -1 : 1;
        return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
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

  const customerUsers = useMemo(() => users || [], [users]);

  const filteredProducts = useMemo(() => {
    const q = productsSearch.trim().toLowerCase();
    let list = products || [];
    if (productsScopeTab === 'pending') {
      list = list.filter((p) => (p.approval_status || 'approved') === 'pending');
    } else if (productsScopeTab === 'live') {
      list = list.filter((p) => (p.approval_status || 'approved') === 'approved');
    } else if (productsScopeTab === 'rejected') {
      list = list.filter((p) => (p.approval_status || '') === 'rejected');
    }
    if (!q) return list;
    return list.filter((p) => (
      String(p.name || '').toLowerCase().includes(q)
      || String(p.category?.name || '').toLowerCase().includes(q)
      || String(p.seller?.name || '').toLowerCase().includes(q)
    ));
  }, [products, productsSearch, productsScopeTab]);

  const filteredInventoryRows = useMemo(() => {
    const q = inventorySearch.trim().toLowerCase();
    if (!q) return inventoryRows || [];
    return (inventoryRows || []).filter((row) => (
      String(row.name || '').toLowerCase().includes(q)
      || String(row.category || '').toLowerCase().includes(q)
    ));
  }, [inventoryRows, inventorySearch]);

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

  const categorySuggestions = useMemo(() => {
    const existingNames = new Set((categories || []).map((c) => String(c.name || '').toLowerCase()));
    return FALLBACK_CATEGORIES.filter((name) => !existingNames.has(name.toLowerCase()));
  }, [categories]);

  const isProtectedAdminAccount = (userRecord) => String(userRecord?.role?.name || '').toLowerCase() === 'admin';

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
      case 'delete-archived-user':
        return 'Are you sure you really want to permanently delete this archived user? This cannot be undone.';
      case 'batch-archive-products':
        return `Are you sure you really want to archive ${ids?.length ?? 0} selected product(s)?`;
      case 'batch-archive-customers':
        return `Are you sure you really want to archive ${ids?.length ?? 0} selected user(s)?`;
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
          <div className={`${activeTab === 'overview' ? styles.imgPageHeading : styles.pageHeading} ${activeTab === 'orders' ? styles.adminOrdersPageHeading : ''}`}>
            <div>
              <h1 className={activeTab === 'orders' ? styles.adminOrdersHeroTitle : undefined}>
                {activeTab === 'overview'
                  ? 'Overview'
                  : activeTab === 'orders'
                  ? 'Orders'
                  : activeTab === 'products'
                  ? 'Products'
                  : activeTab === 'inventory'
                  ? 'Inventory'
                  : activeTab === 'categories'
                  ? 'Categories'
                  : activeTab === 'customers'
                    ? 'Users'
                  : activeTab === 'analytics'
                  ? 'Analytics'
                  : 'Settings'}
              </h1>
              <p className={styles.subtitle}>
                {activeTab === 'overview' && `Welcome back, Admin - ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}`}
                {activeTab === 'orders' && 'View and manage all customer orders in one place.'}
                {activeTab === 'products' && 'Add products (they stay pending until you publish), manage stock, and categories.'}
                {activeTab === 'inventory' && 'Stock on hand, units sold, and revenue per product (non-cancelled orders).'}
                {activeTab === 'categories' && 'Manage categories for your storefront.'}
                {activeTab === 'customers' && 'See all user details, status, and value.'}
                {activeTab === 'analytics' && 'Overview of your store performance.'}
                {activeTab === 'settings' && settingsTab === 'archive' && 'Archive & recovery: restore archived products and users when needed.'}
                {activeTab === 'settings' && settingsTab === 'riders' && 'Manage built-in delivery riders: names, phone, and plate numbers.'}
                {activeTab === 'settings' && settingsTab !== 'archive' && settingsTab !== 'riders' && 'Manage store preferences and system settings.'}
              </p>
            </div>
            {activeTab === 'overview' && (
              <div className={styles.imgHeadingRight}>
                <button type="button" className={styles.imgBell} aria-label="Notifications">
                  <Bell size={18} strokeWidth={2} />
                </button>
                <div className={styles.imgAvatar}>AD</div>
              </div>
            )}
          </div>

          <div className={styles.mainPro}>
            {activeTab === 'overview' && (
              <>
                <div className={styles.imgStatsGrid}>
                  <div className={`${styles.imgStatCard} ${styles.borderBlue}`}>
                    <div className={styles.imgStatTop}>
                      <div className={styles.imgStatIcon}>
                        <LinkIcon size={18} strokeWidth={2.5} />
                      </div>
                      <div className={styles.imgStatPill}>↑ 12.4%</div>
                    </div>
                    <div className={styles.imgStatValue}>₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</div>
                    <div className={styles.imgStatLabel}>Total Sales</div>
                    <div className={styles.imgStatMeta}>Last 30 days</div>
                  </div>
                  
                  <div className={`${styles.imgStatCard} ${styles.borderGreen}`}>
                    <div className={styles.imgStatTop}>
                      <div className={styles.imgStatIcon}>
                        <ShoppingCart size={18} strokeWidth={2.5} />
                      </div>
                      <div className={styles.imgStatPill}>↑ 12.4%</div>
                    </div>
                    <div className={styles.imgStatValue}>{totalOrders}</div>
                    <div className={styles.imgStatLabel}>New Orders</div>
                    <div className={styles.imgStatMeta}>Last 30 days</div>
                  </div>

                  <div className={`${styles.imgStatCard} ${styles.borderPurple}`}>
                    <div className={styles.imgStatTop}>
                      <div className={styles.imgStatIcon}>
                        <Users size={18} strokeWidth={2.5} />
                      </div>
                      <div className={styles.imgStatPill}>↑ 12.4%</div>
                    </div>
                    <div className={styles.imgStatValue}>{totalUsers}</div>
                    <div className={styles.imgStatLabel}>Total Users</div>
                    <div className={styles.imgStatMeta}>All time</div>
                  </div>
                </div>

                <div className={styles.imgOverviewGrid}>
                  <div className={styles.imgCard}>
                    <div className={styles.imgCardHeader}>
                      <h2>Sales Performance</h2>
                      <div className={styles.imgFilters}>
                        <button type="button">7D</button>
                        <button type="button" className={styles.active}>30D</button>
                        <button type="button">90D</button>
                      </div>
                    </div>
                    <div style={{ height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={revenueSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                          <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} tickFormatter={(v) => `₱${v >= 1000 ? (v/1000).toFixed(1)+'k' : v}`} width={50} tickLine={false} axisLine={false} />
                          <Tooltip formatter={(v) => [`₱${Number(v).toFixed(2)}`, 'Revenue']} />
                          <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className={styles.imgCard}>
                    <div className={styles.imgCardHeader}>
                      <h2>Recent Orders</h2>
                      <Link href="/dashboard/admin?tab=orders" className={styles.imgViewAll}>View all →</Link>
                    </div>
                    <div className={styles.imgOrderList}>
                      {dataLoading ? (
                        <p style={{ fontSize: 13, color: '#6b7280' }}>Loading…</p>
                      ) : overviewFilteredOrders.length === 0 ? (
                        <p style={{ fontSize: 13, color: '#6b7280' }}>No recent orders.</p>
                      ) : (
                        overviewFilteredOrders.slice(0, 3).map((o) => {
                          const customerName = o.customer?.name || 'Customer';
                          const initials = customerName.substring(0, 2).toUpperCase();
                          return (
                            <div className={styles.imgOrderItem} key={o.id}>
                              <div className={styles.imgOrderAvatar}>{initials}</div>
                              <div className={styles.imgOrderInfo}>
                                <div className={styles.imgOrderName}>{customerName}</div>
                                <div className={styles.imgOrderId}>#ORD-{o.order_number || o.id}</div>
                              </div>
                              <div className={styles.imgOrderRight}>
                                <div className={styles.imgOrderAmount}>₱{Number(o.total_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 0 })}</div>
                                <div className={styles.imgOrderStatus}>{formatOrderStatusLabel(o.status)}</div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className={styles.imgOrderSearch}>
                      <Search size={16} strokeWidth={2} />
                      <input 
                        type="search" 
                        placeholder="Search recent orders" 
                        value={overviewOrdersSearch}
                        onChange={(e) => setOverviewOrdersSearch(e.target.value)}
                      />
                    </div>
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
                    <button
                      type="button"
                      role="tab"
                      aria-selected={orderSubTab === 'track'}
                      className={`${styles.adminOrderTabBtn} ${orderSubTab === 'track' ? styles.adminOrderTabBtnActive : ''}`}
                      onClick={() => {
                        setOrderSubTab('track');
                        setActiveOrdersStatusFilter(null);
                      }}
                    >
                      Track order
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
                  ) : orderSubTab === 'track' ? (
                    <>
                      <p style={{ margin: '0 0 16px', fontSize: 14, color: '#64748b', maxWidth: 640 }}>
                        <MapPin size={16} strokeWidth={2} style={{ verticalAlign: '-0.2em', marginRight: 6 }} aria-hidden />
                        Shipped and completed orders only. <strong style={{ color: '#334155' }}>Picked up</strong> shows when
                        the assigned rider confirms they collected the parcel.
                      </p>
                      {trackOrdersList.length === 0 ? (
                        <p className={styles.emptyState}>No orders in rider tracking (nothing shipped or completed yet).</p>
                      ) : (
                        <div className={styles.usersTable}>
                          <table>
                            <thead>
                              <tr>
                                <th>Order</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th>Rider</th>
                                <th>Pickup / handoff</th>
                                <th>Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {trackOrdersList.map((o) => {
                                const tp = getTrackPickupDisplay(o);
                                const toneClass =
                                  tp.tone === 'ok'
                                    ? styles.adminTrackPickupTitleOk
                                    : tp.tone === 'warn'
                                      ? styles.adminTrackPickupTitleWarn
                                      : tp.tone === 'done'
                                        ? styles.adminTrackPickupTitleDone
                                        : tp.tone === 'pending'
                                          ? styles.adminTrackPickupTitlePending
                                          : styles.adminTrackPickupTitleMuted;
                                return (
                                  <tr
                                    key={o.id}
                                    onClick={() => setSelectedOrder(o)}
                                    style={{ cursor: 'pointer' }}
                                  >
                                    <td>#{o.order_number || o.id}</td>
                                    <td>{o.customer?.name || '-'}</td>
                                    <td>
                                      <span className={`${styles.adminStatusPill} ${statusPillClass(o.status)}`}>
                                        {formatOrderStatusLabel(o.status)}
                                      </span>
                                    </td>
                                    <td>
                                      {o.rider?.user?.name ? (
                                        <span className={styles.adminOrderRiderName}>
                                          <Bike size={16} strokeWidth={2} aria-hidden />
                                          {o.rider.user.name}
                                        </span>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td>
                                      <div className={styles.adminTrackPickupCell}>
                                        <span className={`${styles.adminTrackPickupTitle} ${toneClass}`}>{tp.title}</span>
                                        {tp.detail ? (
                                          <span className={styles.adminTrackPickupDetail}>{tp.detail}</span>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td>₱{Number(o.total_amount || 0).toFixed(2)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
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
                                    <td>
                                      <span className={`${styles.adminStatusPill} ${statusPillClass(o.status)}`}>
                                        {formatOrderStatusLabel(o.status)}
                                      </span>
                                    </td>
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
                              <td>
                                <span className={`${styles.adminStatusPill} ${statusPillClass(o.status)}`}>
                                  {formatOrderStatusLabel(o.status)}
                                </span>
                              </td>
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
                          {formatOrderStatusLabel(selectedOrder.status)}
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
                        {selectedOrder.rider.address ? (
                          <div style={{ marginTop: 8, fontSize: 13, color: '#475569', lineHeight: 1.45 }}>
                            {selectedOrder.rider.address}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {['shipped', 'delivered'].includes((selectedOrder.status || '').toLowerCase()) && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: '#64748b',
                        }}
                      >
                        Rider pickup
                      </div>
                      {(() => {
                        const tp = getTrackPickupDisplay(selectedOrder);
                        return (
                          <>
                            <div style={{ marginTop: 6, fontSize: 14, color: '#0f172a', fontWeight: 600 }}>{tp.title}</div>
                            {tp.detail ? (
                              <div style={{ marginTop: 4, fontSize: 13, color: '#64748b' }}>{tp.detail}</div>
                            ) : null}
                          </>
                        );
                      })()}
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

                  {['shipped', 'delivered'].includes((selectedOrder.status || '').toLowerCase()) && (
                    <div
                      style={{
                        marginTop: 12,
                        padding: 12,
                        borderRadius: 12,
                        background: '#faf8f3',
                        border: '1px dashed #e5b896',
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: '#a16207',
                          marginBottom: 10,
                        }}
                      >
                        📸 Proof of Delivery
                      </div>
                      {selectedOrder.proof_of_delivery_image ? (
                        <div style={{ marginBottom: 10 }}>
                          <img
                            src={selectedOrder.proof_of_delivery_image}
                            alt="Proof of delivery"
                            style={{
                              maxWidth: '100%',
                              maxHeight: 200,
                              borderRadius: 8,
                              objectFit: 'contain',
                              background: '#fff',
                            }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8, margin: '8px 0 0 0' }}>
                            Photo attached on {selectedOrder.proof_uploaded_at ? new Date(selectedOrder.proof_uploaded_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      ) : (
                        <p style={{ fontSize: 13, color: '#854d0e', margin: '0 0 10px 0' }}>
                          No proof of delivery image uploaded yet.
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <label
                          style={{
                            display: 'inline-block',
                            padding: '8px 12px',
                            background: '#fbbf24',
                            color: '#78350f',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 13,
                            fontWeight: 600,
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => { e.target.style.background = '#f59e0b'; }}
                          onMouseLeave={(e) => { e.target.style.background = '#fbbf24'; }}
                        >
                          {uploadingProofOfDelivery ? 'Uploading...' : 'Select image'}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            disabled={uploadingProofOfDelivery}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setProofOfDeliveryFile(file);
                              }
                            }}
                          />
                        </label>
                        {proofOfDeliveryFile && (
                          <>
                            <span style={{ fontSize: 12, color: '#6b7280' }}>
                              {proofOfDeliveryFile.name}
                            </span>
                            <button
                              type="button"
                              disabled={uploadingProofOfDelivery}
                              onClick={handleUploadProofOfDelivery}
                              style={{
                                padding: '8px 12px',
                                background: '#10b981',
                                color: '#fff',
                                border: 'none',
                                borderRadius: 6,
                                cursor: uploadingProofOfDelivery ? 'not-allowed' : 'pointer',
                                fontSize: 13,
                                fontWeight: 600,
                                transition: 'background 0.2s',
                                opacity: uploadingProofOfDelivery ? 0.6 : 1,
                              }}
                              onMouseEnter={(e) => { if (!uploadingProofOfDelivery) e.target.style.background = '#059669'; }}
                              onMouseLeave={(e) => { if (!uploadingProofOfDelivery) e.target.style.background = '#10b981'; }}
                            >
                              {uploadingProofOfDelivery ? 'Uploading...' : 'Upload'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}

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

            {addProductOpen && (
              <div
                className={styles.modalOverlay}
                onClick={() => {
                  if (productCreating) return;
                  setAddProductOpen(false);
                  resetNewProductForm();
                }}
              >
                <div
                  className={styles.modal}
                  style={{ maxWidth: 520 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="add-product-title"
                >
                  <h2 id="add-product-title" style={{ marginTop: 0 }}>Add product</h2>
                  <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.5, marginBottom: 18 }}>
                    New products are saved as <strong>pending</strong> and are not visible in the shop until you publish them from the product list.
                  </p>
                  <form className={styles.adminAddProductForm} onSubmit={handleCreateProduct}>
                    <div className={styles.formGroup}>
                      <label htmlFor="np-name" className={styles.adminLabel}>Name</label>
                      <input
                        id="np-name"
                        type="text"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Product name"
                        required
                        autoComplete="off"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="np-desc" className={styles.adminLabel}>Description</label>
                      <textarea
                        id="np-desc"
                        rows={3}
                        value={newProduct.description}
                        onChange={(e) => setNewProduct((p) => ({ ...p, description: e.target.value }))}
                        placeholder="Optional"
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label htmlFor="np-price" className={styles.adminLabel}>Price (₱)</label>
                        <input
                          id="np-price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={newProduct.price}
                          onChange={(e) => setNewProduct((p) => ({ ...p, price: e.target.value }))}
                          required
                        />
                      </div>
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label htmlFor="np-stock" className={styles.adminLabel}>Stock</label>
                        <input
                          id="np-stock"
                          type="number"
                          min="0"
                          step="1"
                          value={newProduct.stock}
                          onChange={(e) => setNewProduct((p) => ({ ...p, stock: e.target.value }))}
                          required
                        />
                      </div>
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="np-cat" className={styles.adminLabel}>Category</label>
                      <select
                        id="np-cat"
                        value={newProduct.category_id}
                        onChange={(e) => setNewProduct((p) => ({ ...p, category_id: e.target.value }))}
                        required
                      >
                        <option value="">Select a category</option>
                        {categories && categories.length > 0 ? (
                          <>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                            {categorySuggestions.map((name) => (
                              <option key={`suggestion-${name}`} value={name}>{name}</option>
                            ))}
                          </>
                        ) : (
                          FALLBACK_CATEGORIES.map((name) => (
                            <option key={name} value={name}>{name}</option>
                          ))
                        )}
                      </select>
                      {(!categories || categories.length === 0) && (
                        <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                          Backend categories are not loaded. These values are suggestions only; create matching categories in the Categories page before submitting.
                        </p>
                      )}
                      {categories && categories.length > 0 && categorySuggestions.length > 0 && (
                        <p style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                          Common category suggestions are shown below the loaded categories. Selecting one will create it automatically if it does not already exist.
                        </p>
                      )}
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.adminLabel}>Product image</label>
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setImageUploadMode('url'); }}
                          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: imageUploadMode === 'url' ? '2px solid #2563eb' : '1px solid #d1d5db', background: imageUploadMode === 'url' ? '#eff6ff' : '#fff', color: imageUploadMode === 'url' ? '#1d4ed8' : '#374151', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Image URL
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); setImageUploadMode('file'); }}
                          style={{ flex: 1, padding: '8px', borderRadius: '6px', border: imageUploadMode === 'file' ? '2px solid #2563eb' : '1px solid #d1d5db', background: imageUploadMode === 'file' ? '#eff6ff' : '#fff', color: imageUploadMode === 'file' ? '#1d4ed8' : '#374151', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Upload file
                        </button>
                      </div>

                      {imageUploadMode === 'url' ? (
                        <div>
                          <label htmlFor="np-img-url" className={styles.adminLabel}>Paste image link</label>
                          <input
                            id="np-img-url"
                            type="text"
                            placeholder="https://..."
                            value={newProduct.image || ''}
                            onChange={(e) => setNewProduct(p => ({...p, image: e.target.value}))}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', marginBottom: '10px' }}
                          />
                          <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Optional. Enter a full image URL here.</p>
                          {newProduct.image && (
                            <div className={styles.adminImagePreview} style={{ marginTop: '15px' }}>
                              <img src={newProduct.image} alt="Preview" onError={(e) => { e.target.src = 'https://placehold.co/240x240'; }} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ border: '2px dashed #93c5fd', borderRadius: '8px', padding: '30px 20px', textAlign: 'center', background: '#eff6ff', cursor: 'pointer' }} onClick={() => document.getElementById('np-img-file').click()}>
                            <div style={{ fontSize: '24px', color: '#3b82f6', marginBottom: '10px' }}>📸</div>
                            <p style={{ margin: '0 0 5px 0', fontWeight: 600, color: '#1e3a8a' }}>Drop an image here or click to browse</p>
                            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>JPG, PNG, or WebP · max 5 MB</p>
                            <input
                              id="np-img-file"
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                handleProductImageChange(e);
                                e.stopPropagation();
                              }}
                            />
                          </div>
                          {imagePreview && (
                            <div className={styles.adminImagePreview} style={{ marginTop: '15px' }}>
                              <img src={imagePreview} alt="Selected product" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={styles.formGroup}>
                      <span className={styles.adminLabel} id="np-sizes-label">Sizes</span>
                      <details className={styles.adminSizeDropdown} aria-labelledby="np-sizes-label">
                        <summary>{formatAdminSizesSummary(newProduct.sizes)}</summary>
                        <div className={styles.adminSizePanel}>
                          <div className={styles.adminSizeToolbar}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setNewProduct((p) => ({ ...p, sizes: [...PRODUCT_SIZE_OPTIONS] }));
                              }}
                            >
                              All sizes
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setNewProduct((p) => ({ ...p, sizes: [] }));
                              }}
                            >
                              Clear
                            </button>
                          </div>
                          <div className={styles.adminSizeList}>
                            {PRODUCT_SIZE_OPTIONS.map((s) => (
                              <label key={s} className={styles.adminSizeRow}>
                                <input
                                  type="checkbox"
                                  checked={newProduct.sizes.includes(s)}
                                  onChange={(e) => {
                                    setNewProduct((p) => ({
                                      ...p,
                                      sizes: e.target.checked
                                        ? [...p.sizes, s]
                                        : p.sizes.filter((x) => x !== s),
                                    }));
                                  }}
                                />
                                <span>{s}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </details>
                      <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0, lineHeight: 1.45 }}>
                        Open to choose sizes. Use &quot;All sizes&quot; to select the full list ({PRODUCT_SIZE_OPTIONS.length} options).
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label htmlFor="np-cap" className={styles.adminLabel}>Max sales per period (optional)</label>
                        <input
                          id="np-cap"
                          type="number"
                          min="1"
                          step="1"
                          value={newProduct.sales_cap_quantity}
                          onChange={(e) => setNewProduct((p) => ({ ...p, sales_cap_quantity: e.target.value }))}
                          placeholder="e.g. 15"
                        />
                      </div>
                      <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                        <label htmlFor="np-cap-period" className={styles.adminLabel}>Apply cap to</label>
                        <select
                          id="np-cap-period"
                          value={newProduct.sales_cap_period}
                          onChange={(e) => setNewProduct((p) => ({ ...p, sales_cap_period: e.target.value }))}
                        >
                          <option value="">No cap (only warehouse stock limits sales)</option>
                          <option value="month">This calendar month</option>
                          <option value="year">This calendar year</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        disabled={productCreating}
                        onClick={() => {
                          setAddProductOpen(false);
                          resetNewProductForm();
                        }}
                      >
                        Cancel
                      </button>
                      <button type="submit" className={styles.adminSaveBtn} disabled={productCreating}>
                        {productCreating ? 'Saving…' : 'Submit for approval'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {showProductDetailsModal && selectedProductForModal && (
              <div
                className={styles.modalOverlay}
                onClick={() => {
                  if (productApprovalLoadingId) return;
                  setShowProductDetailsModal(false);
                  setSelectedProductForModal(null);
                }}
              >
                <div
                  className={styles.modal}
                  style={{ maxWidth: 540 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="product-details-title"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <h2 id="product-details-title" style={{ marginTop: 0, marginBottom: 0 }}>Product details</h2>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProductDetailsModal(false);
                        setSelectedProductForModal(null);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: 24,
                        cursor: 'pointer',
                        padding: 0,
                        color: '#6b7280',
                      }}
                      aria-label="Close"
                    >
                      ×
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
                    <div>
                      <img
                        src={productImageUrl(selectedProductForModal.image) || 'https://placehold.co/300x300'}
                        alt={selectedProductForModal.name}
                        style={{
                          width: '100%',
                          aspectRatio: '1',
                          borderRadius: 8,
                          objectFit: 'cover',
                          background: '#f3f4f6',
                        }}
                        onError={(e) => { e.target.src = 'https://placehold.co/300x300'; }}
                      />
                    </div>
                    <div>
                      <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 18, fontWeight: 600 }}>
                        {selectedProductForModal.name}
                      </h3>
                      <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16, lineHeight: 1.5 }}>
                        {selectedProductForModal.description || 'No description provided.'}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px 0' }}>Category</p>
                          <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{selectedProductForModal.category?.name || '-'}</p>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px 0' }}>Seller</p>
                          <p style={{ fontSize: 14, fontWeight: 500, margin: 0 }}>{selectedProductForModal.seller?.name || 'Urban Store'}</p>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                        <div>
                          <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px 0' }}>Status</p>
                          <div>
                            {(selectedProductForModal.approval_status || 'approved') === 'pending' && (
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#b45309', background: '#fffbeb', padding: '6px 10px', borderRadius: 6, display: 'inline-block' }}>Pending</span>
                            )}
                            {(selectedProductForModal.approval_status || 'approved') === 'approved' && (
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#15803d', background: '#ecfdf5', padding: '6px 10px', borderRadius: 6, display: 'inline-block' }}>Live</span>
                            )}
                            {(selectedProductForModal.approval_status || '') === 'rejected' && (
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#b91c1c', background: '#fef2f2', padding: '6px 10px', borderRadius: 6, display: 'inline-block' }}>Rejected</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p style={{ fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, margin: '0 0 4px 0' }}>Price</p>
                          <p style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#1f2937' }}>₱{Number(selectedProductForModal.price || 0).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24, padding: '16px', background: '#f9fafb', borderRadius: 8 }}>
                    <div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px 0', fontWeight: 600 }}>Stock on hand</p>
                      <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{selectedProductForModal.stock ?? 0}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px 0', fontWeight: 600 }}>Sold units</p>
                      <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>0</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px 0', fontWeight: 600 }}>Total amount</p>
                      <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>₱0.00</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={styles.secondaryBtn}
                      disabled={productApprovalLoadingId === selectedProductForModal.id}
                      onClick={() => {
                        setShowProductDetailsModal(false);
                        setSelectedProductForModal(null);
                      }}
                    >
                      Close
                    </button>
                    {(selectedProductForModal.approval_status || 'approved') === 'pending' && (
                      <>
                        <button
                          type="button"
                          className={styles.adminBtnDeleteSoft}
                          title="Reject listing"
                          disabled={productApprovalLoadingId === selectedProductForModal.id}
                          onClick={() => handleRejectProduct(selectedProductForModal.id)}
                        >
                          <X size={16} strokeWidth={2} aria-hidden />
                          Reject
                        </button>
                        <button
                          type="button"
                          className={styles.adminSaveBtn}
                          title="Publish to store"
                          disabled={productApprovalLoadingId === selectedProductForModal.id}
                          onClick={() => handleApproveProduct(selectedProductForModal.id)}
                        >
                          <BadgeCheck size={16} strokeWidth={2} aria-hidden />
                          Confirm
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'products' && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <h2>All products</h2>
                  <button type="button" className={styles.adminSaveBtn} onClick={() => { resetNewProductForm(); setAddProductOpen(true); }}>
                    <Plus size={18} strokeWidth={2} aria-hidden />
                    Add product
                  </button>
                </div>
                <div className={styles.cardBody}>
                  <div
                    role="tablist"
                    aria-label="Filter products"
                    style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}
                  >
                    {[
                      { key: 'all', label: 'All' },
                      { key: 'pending', label: 'Pending approval' },
                      { key: 'live', label: 'Live' },
                      { key: 'rejected', label: 'Rejected' },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={productsScopeTab === key}
                        className={styles.secondaryBtn}
                        style={{
                          fontWeight: 800,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: productsScopeTab === key ? '#2563eb' : undefined,
                          background: productsScopeTab === key ? '#eff6ff' : undefined,
                          color: productsScopeTab === key ? '#1d4ed8' : undefined,
                        }}
                        onClick={() => setProductsScopeTab(key)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
                      {filteredProducts.map((p) => (
                        <div
                          key={p.id}
                          style={{
                            background: '#fff',
                            border: '1px solid #e5e7eb',
                            borderRadius: 12,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            transition: 'all 0.2s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                            e.currentTarget.style.transform = 'translateY(-2px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {/* Product Image */}
                          <div style={{ position: 'relative', paddingBottom: '100%', overflow: 'hidden', background: '#f3f4f6' }}>
                            <img
                              src={productImageUrl(p.image) || 'https://placehold.co/240x240'}
                              alt={p.name}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                cursor: 'pointer',
                              }}
                              onError={(e) => { e.target.src = 'https://placehold.co/240x240'; }}
                              onClick={() => {
                                setSelectedProductForModal(p);
                                setShowProductDetailsModal(true);
                              }}
                            />
                            {/* Checkbox overlay */}
                            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10 }}>
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
                                style={{ cursor: 'pointer' }}
                              />
                            </div>
                            {/* Status badge overlay */}
                            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 10 }}>
                              {(p.approval_status || 'approved') === 'pending' && (
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#b45309', background: '#fffbeb', padding: '4px 10px', borderRadius: 6, display: 'inline-block' }}>Pending</span>
                              )}
                              {(p.approval_status || 'approved') === 'approved' && (
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#15803d', background: '#ecfdf5', padding: '4px 10px', borderRadius: 6, display: 'inline-block' }}>Live</span>
                              )}
                              {(p.approval_status || '') === 'rejected' && (
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c', background: '#fef2f2', padding: '4px 10px', borderRadius: 6, display: 'inline-block' }}>Rejected</span>
                              )}
                            </div>
                          </div>

                          {/* Card Content */}
                          <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForModal(p);
                                  setShowProductDetailsModal(true);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  fontSize: 13,
                                  fontWeight: 600,
                                  color: '#1f2937',
                                  lineHeight: 1.4,
                                  textDecoration: 'underline',
                                  textDecorationColor: '#2563eb',
                                }}
                              >
                                {p.name}
                              </button>
                              <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0 0' }}>
                                {p.category?.name || '-'} • {p.seller?.name || 'Urban Store'}
                              </p>
                            </div>

                            {/* Price and Stock */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
                              <div>
                                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, fontWeight: 600 }}>Price</p>
                                <p style={{ fontSize: 16, fontWeight: 700, margin: '2px 0 0 0', color: '#1f2937' }}>₱{Number(p.price || 0).toFixed(2)}</p>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, fontWeight: 600 }}>Stock</p>
                                <p style={{
                                  fontSize: 16,
                                  fontWeight: 700,
                                  margin: '2px 0 0 0',
                                  color: (p.stock ?? 0) === 0 ? '#b91c1c' : (p.stock ?? 0) <= 5 ? '#b45309' : '#15803d',
                                }}>
                                  {p.stock ?? 0}
                                </p>
                              </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                              {(p.approval_status || 'approved') === 'pending' && (
                                <>
                                  <button
                                    type="button"
                                    className={styles.adminSaveBtn}
                                    title="Publish to store"
                                    disabled={productApprovalLoadingId === p.id}
                                    onClick={() => handleApproveProduct(p.id)}
                                    style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
                                  >
                                    <BadgeCheck size={14} strokeWidth={2} aria-hidden />
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.adminBtnDeleteSoft}
                                    title="Reject listing"
                                    disabled={productApprovalLoadingId === p.id}
                                    onClick={() => handleRejectProduct(p.id)}
                                    style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
                                  >
                                    <X size={14} strokeWidth={2} aria-hidden />
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className={styles.adminBtnArchive}
                                title="Archive product"
                                onClick={() => setConfirmDialog({ mode: 'archive-product', id: p.id })}
                                style={{ flex: 1, padding: '6px 8px', fontSize: 12 }}
                              >
                                <Archive size={14} strokeWidth={1.75} aria-hidden />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'inventory' && (
              <>
                <div className={styles.adminStatsGrid} style={{ marginBottom: 20 }}>
                  <div className={`${styles.adminStatCard} ${styles.adminStatSales}`}>
                    <div className={styles.adminStatTop}>
                      <div className={styles.adminStatIcon} aria-hidden>
                        <PackageSearch size={18} strokeWidth={1.75} />
                      </div>
                    </div>
                    <div className={styles.adminStatValue}>
                      {(inventoryTotals.total_units_sold ?? 0).toLocaleString('en-PH')}
                    </div>
                    <div className={styles.adminStatLabel}>Total units sold</div>
                    <div className={styles.adminStatMeta}>All non-cancelled orders</div>
                  </div>
                  <div className={`${styles.adminStatCard} ${styles.adminStatOrders}`}>
                    <div className={styles.adminStatTop}>
                      <div className={styles.adminStatIcon} aria-hidden>
                        <TrendingUp size={18} strokeWidth={1.75} />
                      </div>
                    </div>
                    <div className={styles.adminStatValue}>
                      ₱
                      {Number(inventoryTotals.total_sales_amount ?? 0).toLocaleString('en-PH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </div>
                    <div className={styles.adminStatLabel}>Total sales (line totals)</div>
                    <div className={styles.adminStatMeta}>Σ qty × line price</div>
                  </div>
                </div>
                <div className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h2>Sales by product</h2>
                  </div>
                  <div className={styles.cardBody}>
                    <div
                      className={styles.adminTableSearchRow}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}
                    >
                      <div className={styles.adminSearchWrap} style={{ flex: '1 1 220px' }}>
                        <Search size={20} strokeWidth={1.5} aria-hidden />
                        <input
                          type="search"
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          placeholder="Search by product or category…"
                        />
                      </div>
                      <button
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ flexShrink: 0 }}
                        disabled={inventoryLoading}
                        onClick={() => {
                          setInventoryLoading(true);
                          fetchAdminInventoryReport()
                            .then((res) => {
                              setInventoryRows(res.data?.products || []);
                              setInventoryTotals(res.data?.totals || { total_units_sold: 0, total_sales_amount: 0 });
                            })
                            .catch(() => {
                              setInventoryRows([]);
                              setInventoryTotals({ total_units_sold: 0, total_sales_amount: 0 });
                            })
                            .finally(() => setInventoryLoading(false));
                        }}
                      >
                        <RefreshCw size={16} strokeWidth={1.75} aria-hidden />
                        Refresh
                      </button>
                    </div>
                    {inventoryLoading ? (
                      <p>Loading…</p>
                    ) : filteredInventoryRows.length === 0 ? (
                      <p className={styles.emptyState}>
                        {(inventoryRows || []).length === 0
                          ? 'No active products in catalog.'
                          : 'No products match your search.'}
                      </p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                              <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Product</th>
                              <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                              <th style={{ padding: '14px 12px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stock Level</th>
                              <th style={{ padding: '14px 12px', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Units Sold</th>
                              <th style={{ padding: '14px 12px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Revenue</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredInventoryRows.map((row, idx) => {
                              const maxStock = 100;
                              const stockPercentage = Math.min(((row.stock ?? 0) / maxStock) * 100, 100);
                              let stockStatus = 'In Stock';
                              let stockBgColor = '#ecfdf5';
                              let stockTextColor = '#15803d';
                              let stockBarColor = '#10b981';

                              if ((row.stock ?? 0) === 0) {
                                stockStatus = 'Out of Stock';
                                stockBgColor = '#fef2f2';
                                stockTextColor = '#b91c1c';
                                stockBarColor = '#ef4444';
                              } else if ((row.stock ?? 0) <= 5) {
                                stockStatus = 'Low Stock';
                                stockBgColor = '#fffbeb';
                                stockTextColor = '#b45309';
                                stockBarColor = '#f59e0b';
                              }

                              return (
                                <tr
                                  key={row.id}
                                  style={{
                                    borderBottom: '1px solid #e5e7eb',
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#f9fafb';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  {/* Product Column */}
                                  <td style={{ padding: '16px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      <div style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: 8,
                                        background: '#f3f4f6',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                      }}>
                                        <img
                                          src={productImageUrl(row.image) || 'https://placehold.co/48x48'}
                                          alt={row.name}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                          }}
                                          onError={(e) => { e.target.src = 'https://placehold.co/48x48'; }}
                                        />
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937', marginBottom: 4 }}>
                                          {row.name}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#9ca3af' }}>
                                          {row.category || '—'}
                                        </div>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Status Badge */}
                                  <td style={{ padding: '16px 12px' }}>
                                    <span style={{
                                      display: 'inline-block',
                                      padding: '6px 12px',
                                      borderRadius: 6,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      background: stockBgColor,
                                      color: stockTextColor,
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {stockStatus}
                                    </span>
                                  </td>

                                  {/* Stock Level with Progress Bar */}
                                  <td style={{ padding: '16px 12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                          height: 6,
                                          background: '#e5e7eb',
                                          borderRadius: 3,
                                          overflow: 'hidden',
                                        }}>
                                          <div
                                            style={{
                                              height: '100%',
                                              width: `${stockPercentage}%`,
                                              background: stockBarColor,
                                              transition: 'width 0.3s ease',
                                            }}
                                          />
                                        </div>
                                      </div>
                                      <div style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: '#1f2937',
                                        minWidth: '36px',
                                        textAlign: 'right',
                                      }}>
                                        {row.stock ?? 0}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Units Sold */}
                                  <td style={{ padding: '16px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1f2937' }}>
                                      {(row.units_sold ?? 0).toLocaleString('en-PH')}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                      sold
                                    </div>
                                  </td>

                                  {/* Revenue */}
                                  <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>
                                      ₱
                                      {Number(row.sales_total ?? 0).toLocaleString('en-PH', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                      revenue
                                    </div>
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
              </>
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
                  <h2>Users</h2>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.adminTableSearchRow}>
                    <div className={styles.adminSearchWrap}>
                      <Search size={20} strokeWidth={1.5} aria-hidden />
                      <input
                        type="search"
                        value={customersSearch}
                        onChange={(e) => setCustomersSearch(e.target.value)}
                        placeholder="Search users by name, email, or phone…"
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
                    <p>Loading users...</p>
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
                                aria-label="Select all visible users"
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
                                  disabled={isProtectedAdminAccount(u)}
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
                                  {isProtectedAdminAccount(u) ? (
                                    <span className={styles.adminProtectedLabel}>Protected</span>
                                  ) : (
                                    <button
                                      type="button"
                                      className={styles.adminBtnArchive}
                                      title="Archive user"
                                      onClick={() => setConfirmDialog({ mode: 'archive-user', id: u.id })}
                                    >
                                      <Archive size={16} strokeWidth={1.75} aria-hidden />
                                      <span className={styles.adminActionText}>Archive</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className={styles.emptyState}>No users found.</p>
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
              <div className={`${styles.card} ${styles.adminSettingsLightPage}`}>
                <div className={styles.adminSettingsPageHeader}>
                  <div>
                    <h2>Settings</h2>
                    <p className={styles.adminSettingsSubtitle}>
                      {settingsTab === 'archive'
                        ? 'Restore archived catalog items and customer accounts when needed.'
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
                          Fleet riders: names, contact, plate, and base address for dispatch and ride records.
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
                                        [r.id]: { ...prev[r.id], name: e.target.value },
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
                                        [r.id]: { ...prev[r.id], phone: e.target.value },
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
                                        [r.id]: { ...prev[r.id], vehicle_plate: e.target.value },
                                      }))}
                                    />
                                  </div>
                                  <div className={styles.formGroup}>
                                    <label className={styles.adminLabel} htmlFor={`rider-address-${r.id}`}>
                                      <strong>Base address</strong>
                                    </label>
                                    <textarea
                                      id={`rider-address-${r.id}`}
                                      rows={3}
                                      value={riderDrafts[r.id]?.address ?? ''}
                                      onChange={(e) => setRiderDrafts((prev) => ({
                                        ...prev,
                                        [r.id]: { ...prev[r.id], address: e.target.value },
                                      }))}
                                      style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
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
                        <p className={styles.adminArchiveHint}>Items hidden from the storefront and seller catalog lists.</p>
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
                        <h3 className={styles.adminArchiveHeading}>Archived Users</h3>
                        <p className={styles.adminArchiveHint}>Accounts cannot sign in until restored.</p>
                        <div className={styles.adminTableSearchRow}>
                          <div className={styles.adminSearchWrap}>
                            <Search size={20} strokeWidth={1.5} aria-hidden />
                            <input
                              type="search"
                              value={archiveCustomersSearch}
                              onChange={(e) => setArchiveCustomersSearch(e.target.value)}
                              placeholder="Search archived users…"
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
                          </div>
                        )}
                        {archiveLoading ? (
                          <p className={styles.adminSettingsMuted}>Loading archived users…</p>
                        ) : filteredArchivedUsers.length === 0 ? (
                          <p className={styles.emptyState}>No archived users.</p>
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
                                      aria-label="Select all archived users"
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
                                        disabled={isProtectedAdminAccount(u)}
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
                                        {isProtectedAdminAccount(u) ? (
                                          <span className={styles.adminProtectedLabel}>Protected</span>
                                        ) : (
                                          <>
                                            <button
                                              type="button"
                                              className={`${styles.adminArchiveIconBtn} ${styles.adminArchiveIconBtnRestore}`}
                                              title="Restore"
                                              aria-label={`Restore user ${u.name}`}
                                              onClick={() => handleRestoreUser(u.id)}
                                            >
                                              <RotateCcw size={18} strokeWidth={2} aria-hidden />
                                            </button>
                                            <button
                                              type="button"
                                              className={`${styles.adminArchiveIconBtn} ${styles.adminArchiveIconBtnDelete}`}
                                              title="Delete permanently"
                                              aria-label={`Permanently delete user ${u.name}`}
                                              onClick={() => handlePermanentDeleteUser(u.id)}
                                            >
                                              <X size={18} strokeWidth={2} aria-hidden />
                                            </button>
                                          </>
                                        )}
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
