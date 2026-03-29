import { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Minus, Plus, ShoppingBag, Check } from 'lucide-react';
import styles from '@/styles/cart.module.scss';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { useRouter } from 'next/router';
import { productImageUrl } from '@/utils/image';
import {
  CHECKOUT_SELECTED_KEYS_STORAGE,
  resetCheckoutSelectionCache,
} from '@/constants/checkoutSelection';
import { SHIPPING_FEE } from '@/constants/commerce';

export default function Cart() {
  const { user } = useAuth();
  const { items, updateItem, removeItem } = useCart();
  const router = useRouter();
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, router]);

  const itemKeysSignature = useMemo(
    () => [...items.map((i) => i.key)].sort().join('\0'),
    [items],
  );

  const prevLineKeysRef = useRef(null);

  useEffect(() => {
    const lineKeys = new Set(items.map((i) => i.key));
    const prevLines = prevLineKeysRef.current;

    if (prevLines === null) {
      prevLineKeysRef.current = lineKeys;
      setSelectedKeys(new Set(lineKeys));
      return;
    }

    setSelectedKeys((sel) => {
      const next = new Set();
      items.forEach((item) => {
        const isNewLine = !prevLines.has(item.key);
        if (isNewLine) next.add(item.key);
        else if (sel.has(item.key)) next.add(item.key);
      });
      return next;
    });

    prevLineKeysRef.current = lineKeys;
  }, [itemKeysSignature]);

  const toggleKey = (key) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedKeys(new Set(items.map((i) => i.key)));
  };

  const deselectAll = () => {
    setSelectedKeys(new Set());
  };

  const selectedItems = useMemo(
    () => items.filter((i) => selectedKeys.has(i.key)),
    [items, selectedKeys],
  );

  const selectedSubtotal = useMemo(
    () =>
      selectedItems.reduce(
        (acc, item) => acc + Number(item.product?.price || 0) * item.quantity,
        0,
      ),
    [selectedItems],
  );

  const selectedCount = selectedItems.length;

  const cartShipping =
    selectedCount > 0 ? SHIPPING_FEE : 0;
  const cartOrderTotal = selectedSubtotal + cartShipping;

  const handleCheckout = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (selectedCount === 0) return;
    try {
      resetCheckoutSelectionCache();
      sessionStorage.setItem(
        CHECKOUT_SELECTED_KEYS_STORAGE,
        JSON.stringify(selectedItems.map((i) => i.key)),
      );
    } catch {
      /* ignore quota */
    }
    router.push('/checkout');
  };

  const bumpQty = (key, current, delta) => {
    const next = Math.max(1, current + delta);
    void updateItem(key, next);
  };

  const handleRemove = (key) => {
    void removeItem(key).then(() => {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
  };

  return (
    <div className={styles.cartPage}>
      <Head>
        <title>Your bag — urbanNxt</title>
      </Head>

      <header className={styles.cartHeader}>
        <h1>Your bag</h1>
        <p className={styles.cartLead}>
          {items.length > 0
            ? `${items.length} item${items.length === 1 ? '' : 's'} · Check the pieces you want to buy`
            : 'Curated picks, one checkout away'}
        </p>
      </header>

      {items.length > 0 ? (
        <div className={styles.cartGrid}>
          <div>
            <div className={styles.cartToolbar}>
              <p className={styles.cartToolbarText}>
                {selectedCount} of {items.length} selected for checkout
              </p>
              <div className={styles.cartToolbarActions}>
                <button type="button" className={styles.toolbarLink} onClick={selectAll}>
                  Select all
                </button>
                <button type="button" className={styles.toolbarLink} onClick={deselectAll}>
                  Deselect all
                </button>
              </div>
            </div>

            <div className={styles.lineItems}>
              {items.map((item) => {
                const checked = selectedKeys.has(item.key);
                const img =
                  productImageUrl(item.product?.image) ||
                  `https://placehold.co/96x120?text=${encodeURIComponent(item.product?.name || 'Item')}`;
                const unit = Number(item.product?.price || 0);
                const lineTotal = unit * item.quantity;
                const checkboxId = `cart-line-${item.key}`;
                return (
                  <article
                    key={item.key}
                    className={`${styles.lineCard} ${!checked ? styles.lineCardUnselected : ''}`}
                  >
                    <div className={styles.selectWrap}>
                      <input
                        id={checkboxId}
                        type="checkbox"
                        className={styles.selectCheckbox}
                        checked={checked}
                        onChange={() => toggleKey(item.key)}
                        aria-label={`Include ${item.product.name} in checkout`}
                      />
                      <label htmlFor={checkboxId} className={styles.selectFace}>
                        <Check size={14} strokeWidth={3} aria-hidden />
                      </label>
                    </div>
                    <div className={styles.thumbWrap}>
                      <Link href={`/product/${item.product.id}`}>
                        <img
                          src={img}
                          alt={item.product.name}
                          className={styles.thumb}
                          onError={(e) => {
                            e.target.src = 'https://placehold.co/96x120';
                          }}
                        />
                      </Link>
                    </div>
                    <div className={styles.lineBody}>
                      <h2 className={styles.productName}>
                        <Link href={`/product/${item.product.id}`}>{item.product.name}</Link>
                      </h2>
                      <p className={styles.productMeta}>{item.product.category || 'Streetwear'}</p>
                      <div className={styles.linePriceRow}>
                        <span className={styles.unitPrice}>₱{unit.toFixed(2)}</span>
                        {item.size && <span className={styles.sizeTag}>Size {item.size}</span>}
                      </div>
                    </div>
                    <div className={styles.lineActions}>
                      <div className={styles.qtyControl}>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          aria-label="Decrease quantity"
                          disabled={item.quantity <= 1}
                          onClick={() => bumpQty(item.key, item.quantity, -1)}
                        >
                          <Minus size={18} strokeWidth={1.75} />
                        </button>
                        <span className={styles.qtyValue}>{item.quantity}</span>
                        <button
                          type="button"
                          className={styles.qtyBtn}
                          aria-label="Increase quantity"
                          onClick={() => bumpQty(item.key, item.quantity, 1)}
                        >
                          <Plus size={18} strokeWidth={1.75} />
                        </button>
                      </div>
                      <div className={styles.lineTotal}>₱{lineTotal.toFixed(2)}</div>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => handleRemove(item.key)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <aside className={styles.summaryCard}>
            <h2 className={styles.summaryTitle}>Order summary</h2>
            <div className={styles.summaryRow}>
              <span>Subtotal {selectedCount < items.length ? `(${selectedCount} items)` : ''}</span>
              <span className={styles.summaryValue}>₱{selectedSubtotal.toFixed(2)}</span>
            </div>
            <div className={styles.summaryRow}>
              <span>Shipping</span>
              <strong>₱{SHIPPING_FEE.toFixed(2)}</strong>
            </div>
            <div className={styles.summaryRow}>
              <span>Tax</span>
              <span className={styles.summaryValue}>At checkout</span>
            </div>
            <hr className={styles.summaryDivider} />
            <div className={styles.totalBlock}>
              <span className={styles.totalLabel}>Total</span>
              <span className={styles.totalAmount}>₱{cartOrderTotal.toFixed(2)}</span>
            </div>
            <button
              type="button"
              className={styles.checkoutBtn}
              onClick={handleCheckout}
              disabled={selectedCount === 0}
            >
              {selectedCount === 0
                ? 'Select items to checkout'
                : 'Proceed to checkout'}
            </button>
            <Link href="/dashboard/customer" className={styles.continueLink}>
              Continue shopping
            </Link>
          </aside>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden>
            <ShoppingBag size={32} strokeWidth={1.35} />
          </div>
          <h2 className={styles.emptyTitle}>Your bag is empty</h2>
          <p className={styles.emptyCopy}>
            Nothing here yet—explore new arrivals and add pieces you love.
          </p>
          <Link href="/dashboard/customer" className={styles.shopArrivalsBtn}>
            Shop new arrivals
          </Link>
        </div>
      )}
    </div>
  );
}
