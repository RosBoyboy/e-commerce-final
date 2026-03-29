import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/ToastProvider';
import {
  fetchCart,
  addCartItem,
  updateCartItem,
  deleteCartItem,
} from '@/services/api';

/** Thrown after a red stock warning toast so callers skip duplicate error toasts. */
export class CartAddBlockedError extends Error {
  constructor(message = 'Cart add blocked') {
    super(message);
    this.name = 'CartAddBlockedError';
  }
}

function mapServerLineToItem(line) {
  const size = line.size || null;
  const key = line.key || `${line.product_id}-${size || ''}`;
  return {
    key,
    serverId: line.id,
    product: line.product,
    size,
    quantity: line.quantity,
  };
}

const CartCtx = createContext({
  items: [],
  addItem: async () => {},
  updateItem: async () => {},
  removeItem: async () => {},
  removeItemsByKeys: async () => {},
  clearCart: async () => {},
  subtotal: 0,
  cartLoading: false,
});

export function CartProvider({ children }) {
  const { user, token, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const itemsRef = useRef(items);
  const [cartLoading, setCartLoading] = useState(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const refreshCart = useCallback(async () => {
    if (!user?.id || !token) return;
    const { data } = await fetchCart();
    setItems((data.items || []).map(mapServerLineToItem));
  }, [user?.id, token]);

  useEffect(() => {
    if (authLoading) return;

    if (!user?.id || !token) {
      setItems([]);
      setCartLoading(false);
      return;
    }

    let cancelled = false;
    setCartLoading(true);

    const load = async () => {
      try {
        const { data } = await fetchCart();
        if (cancelled) return;
        setItems((data.items || []).map(mapServerLineToItem));
      } catch (err) {
        console.error('Cart load failed:', err);
        if (!cancelled) {
          try {
            const { data } = await fetchCart();
            if (!cancelled) {
              setItems((data.items || []).map(mapServerLineToItem));
            }
          } catch {
            if (!cancelled) setItems([]);
          }
        }
      } finally {
        if (!cancelled) setCartLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user?.id, token]);

  const addItem = async (product, options = {}) => {
    if (!user?.id) {
      throw new Error('Login required');
    }
    const sizeNorm = options.size ?? '';
    const wantQty = Math.min(100, Math.max(1, Number(options.quantity) || 1));
    const stock = Number(product?.stock ?? 0);

    if (!Number.isFinite(stock) || stock < 1) {
      showToast({
        message: 'This product is currently out of stock.',
        type: 'error',
      });
      throw new CartAddBlockedError();
    }

    const existing = itemsRef.current.find(
      (i) =>
        i.product?.id === product.id && String(i.size ?? '') === String(sizeNorm),
    );
    const inCart = existing ? Number(existing.quantity) || 0 : 0;
    if (inCart + wantQty > stock) {
      showToast({
        message:
          stock === 1
            ? 'Only 1 item left in stock.'
            : `Not enough stock. Only ${stock} available for this product.`,
        type: 'error',
      });
      throw new CartAddBlockedError();
    }

    try {
      await addCartItem({
        product_id: product.id,
        quantity: wantQty,
        ...(sizeNorm ? { size: sizeNorm } : {}),
      });
    } catch (err) {
      const msg = err.response?.data?.message;
      showToast({
        message: typeof msg === 'string' && msg ? msg : 'Could not add to cart. Try again.',
        type: 'error',
      });
      throw new CartAddBlockedError();
    }
    await refreshCart();
  };

  const updateItem = async (key, quantity) => {
    if (!user?.id) return;
    const item = itemsRef.current.find((i) => i.key === key);
    if (!item?.serverId) return;
    await updateCartItem(item.serverId, { quantity: Math.max(1, quantity) });
    await refreshCart();
  };

  const removeItem = async (key) => {
    if (!user?.id) return;
    const item = itemsRef.current.find((i) => i.key === key);
    if (item?.serverId) {
      await deleteCartItem(item.serverId);
    }
    await refreshCart();
  };

  const removeItemsByKeys = async (keys) => {
    if (!keys?.length) return;
    const drop = new Set(keys);
    if (!user?.id) {
      setItems((prev) => prev.filter((item) => !drop.has(item.key)));
      return;
    }
    const toRemove = itemsRef.current.filter((i) => drop.has(i.key));
    await Promise.all(
      toRemove.map((i) =>
        i.serverId ? deleteCartItem(i.serverId).catch(() => {}) : Promise.resolve(),
      ),
    );
    await refreshCart();
  };

  const clearCart = async () => {
    if (!user?.id) {
      setItems([]);
      return;
    }
    await Promise.all(
      itemsRef.current.map((i) =>
        i.serverId ? deleteCartItem(i.serverId).catch(() => {}) : Promise.resolve(),
      ),
    );
    setItems([]);
  };

  const subtotal = useMemo(
    () =>
      items.reduce(
        (acc, item) => acc + (item.product.price || 0) * item.quantity,
        0,
      ),
    [items],
  );

  return (
    <CartCtx.Provider
      value={{
        items,
        addItem,
        updateItem,
        removeItem,
        removeItemsByKeys,
        clearCart,
        subtotal,
        cartLoading,
      }}
    >
      {children}
    </CartCtx.Provider>
  );
}

export function useCart() {
  return useContext(CartCtx);
}
