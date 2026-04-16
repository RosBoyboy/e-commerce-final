import axios from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Global response interceptor to avoid noisy PHP internal error alerts
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const rawMessage =
      error?.response?.data?.message || error?.message || '';
    if (
      typeof rawMessage === 'string' &&
      rawMessage.includes('explode() expects parameter 2 to be string')
    ) {
      // Hide low-level PHP explode() error from the UI; log only.
      // Callers will see a generic network error if needed.
      console.error('Backend config error (Sanctum explode):', rawMessage);
      // Replace with cleaner message so alerts / toasts stay user-friendly.
      const safeError = new Error(
        'The server configuration is being updated. Please try again in a moment.'
      );
      safeError.response = error.response;
      return Promise.reject(safeError);
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = (token) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

// Apply saved token before any React effect runs (avoids GET /cart 401 on first paint)
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('auth_token');
    if (saved) {
      api.defaults.headers.common.Authorization = `Bearer ${saved}`;
    }
  } catch {
    /* ignore */
  }
}

// Auth
export const registerRequest = (payload) =>
  api.post('/auth/register', payload);

export const loginRequest = (payload) => api.post('/auth/login', payload);

export const logoutRequest = () => api.post('/auth/logout');

export const fetchCurrentUser = () => api.get('/auth/user');

// Cart (authenticated; per-user on server)
export const fetchCart = () => api.get('/cart');
export const addCartItem = (payload) => api.post('/cart/items', payload);
export const updateCartItem = (cartItemId, payload) =>
  api.patch(`/cart/items/${cartItemId}`, payload);
export const deleteCartItem = (cartItemId) => api.delete(`/cart/items/${cartItemId}`);

// Catalog
export const fetchProducts = () => api.get('/products');

export const fetchProduct = (id) => api.get(`/products/${id}`);

export const fetchCategories = () => api.get('/categories');

// Orders
export const createOrder = (payload) => api.post('/orders', payload);

export const fetchCustomerOrders = () => api.get('/orders');
export const updateOrderStatus = (orderId, status, extra = {}) =>
  api.patch(`/orders/${orderId}/status`, { status, ...extra });

// Rider (fleet)
export const fetchRiderOrders = () => api.get('/rider/orders');
export const fetchRiderStats = () => api.get('/rider/stats');
export const fetchRiderProfile = () => api.get('/rider/profile');
export const updateRiderProfile = (payload) => api.patch('/rider/profile', payload);
export const riderMarkDelivered = (orderId) =>
  api.patch(`/rider/orders/${orderId}/deliver`);
export const riderMarkPickedUp = (orderId) =>
  api.patch(`/rider/orders/${orderId}/pickup`);

// Messaging
export const fetchConversationsUnreadCount = () => api.get('/conversations/unread-count');
export const markAllConversationsRead = () => api.post('/conversations/mark-all-read');
export const fetchConversations = () => api.get('/conversations');
export const fetchConversation = (id, config = {}) =>
  api.get(`/conversations/${id}`, config);
export const createConversation = (payload) => api.post('/conversations', payload);
export const sendMessage = (conversationId, body) =>
  api.post(`/conversations/${conversationId}/messages`, { body });

// Admin
export const fetchAdminStats = () => api.get('/admin/stats');
export const fetchAdminUsers = () => api.get('/admin/users');
export const updateAdminUser = (id, payload) => api.put(`/admin/users/${id}`, payload);
export const deleteAdminUser = (id) => api.delete(`/admin/users/${id}`);
export const fetchAdminArchivedUsers = () => api.get('/admin/users/archived');
export const archiveAdminUser = (id) => api.patch(`/admin/users/${id}/archive`);
export const restoreAdminUser = (id) => api.patch(`/admin/users/${id}/restore`);
export const archiveAdminUsersBatch = (ids) =>
  api.post('/admin/users/archive-batch', { ids });
export const permanentDeleteAdminUsersBatch = (ids) =>
  api.post('/admin/users/permanent-batch', { ids });

export const fetchAdminOrders = () => api.get('/admin/orders');
export const fetchAdminInventoryReport = () => api.get('/admin/inventory-report');
export const updateAdminOrderStatus = (orderId, status) =>
  api.patch(`/admin/orders/${orderId}/status`, { status });
export const assignAdminOrderRider = (orderId, riderId) =>
  api.patch(`/admin/orders/${orderId}/assign-rider`, { rider_id: riderId });
export const fetchAdminRiders = () => api.get('/admin/riders');
export const updateAdminRider = (riderId, payload) => api.put(`/admin/riders/${riderId}`, payload);

export const fetchAdminProducts = () => api.get('/admin/products');
export const createAdminProduct = (payload) => api.post('/admin/products', payload);
export const updateAdminProduct = (id, payload) => api.put(`/admin/products/${id}`, payload);
export const deleteAdminProduct = (id) => api.delete(`/admin/products/${id}`);
export const fetchAdminArchivedProducts = () => api.get('/admin/products/archived');
export const archiveAdminProduct = (id) => api.patch(`/admin/products/${id}/archive`);
export const restoreAdminProduct = (id) => api.patch(`/admin/products/${id}/restore`);
export const approveAdminProduct = (id) => api.patch(`/admin/products/${id}/approve`);
export const rejectAdminProduct = (id) => api.patch(`/admin/products/${id}/reject`);
export const archiveAdminProductsBatch = (ids) =>
  api.post('/admin/products/archive-batch', { ids });
export const permanentDeleteAdminProductsBatch = (ids) =>
  api.post('/admin/products/permanent-batch', { ids });

export const fetchAdminCategories = () => api.get('/admin/categories');
export const createAdminCategory = (payload) => api.post('/admin/categories', payload);
export const updateAdminCategory = (id, payload) => api.put(`/admin/categories/${id}`, payload);
export const deleteAdminCategory = (id) => api.delete(`/admin/categories/${id}`);

export const fetchAdminSettings = () => api.get('/admin/settings');
export const updateAdminSettings = (payload) => api.put('/admin/settings', payload);

