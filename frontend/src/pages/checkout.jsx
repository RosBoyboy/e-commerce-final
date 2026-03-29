import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { Lock, Loader2, Wallet, MessageCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { createOrder, createConversation, fetchProduct } from '@/services/api';
import { productImageUrl } from '@/utils/image';
import { consumeCheckoutLineKeys } from '@/constants/checkoutSelection';
import { SHIPPING_FEE } from '@/constants/commerce';
import { parseCommaSeparatedAddress } from '@/utils/parseAddress';
import styles from '@/styles/checkout.module.scss';

export default function Checkout() {
  const { user } = useAuth();
  const { items, removeItemsByKeys } = useCart();
  const router = useRouter();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    address: '',
    city: '',
    postal_code: '',
    phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [messageSellerLoading, setMessageSellerLoading] = useState(null);
  const [sellerMap, setSellerMap] = useState({});
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoError, setPromoError] = useState('');
  const [promoDiscount, setPromoDiscount] = useState(0);

  const checkoutItems = useMemo(() => {
    if (!items.length) return [];
    const keys = consumeCheckoutLineKeys();
    if (Array.isArray(keys) && keys.length) {
      const filtered = items.filter((i) => keys.includes(i.key));
      return filtered.length ? filtered : [...items];
    }
    return [...items];
  }, [items]);

  const checkoutSubtotal = useMemo(
    () =>
      checkoutItems.reduce(
        (acc, item) => acc + Number(item.product?.price || 0) * item.quantity,
        0,
      ),
    [checkoutItems],
  );

  const uniqueSellers = [];
  checkoutItems.forEach((it) => {
    const sid = it.product?.seller_id ?? sellerMap[it.product?.id]?.seller_id;
    if (sid && !uniqueSellers.find((s) => s.id === sid)) {
      uniqueSellers.push({
        id: sid,
        name: it.product?.seller?.name || sellerMap[it.product?.id]?.seller_name || 'Seller',
        productId: it.product?.id,
      });
    }
  });

  const grandTotal = useMemo(
    () => Math.max(0, checkoutSubtotal - promoDiscount) + SHIPPING_FEE,
    [checkoutSubtotal, promoDiscount],
  );

  useEffect(() => {
    const toFetch = checkoutItems.filter((i) => !i.product?.seller_id && i.product?.id);
    if (toFetch.length === 0) return;
    toFetch.forEach((it) => {
      fetchProduct(it.product.id)
        .then(({ data }) => {
          setSellerMap((prev) => ({
            ...prev,
            [it.product.id]: { seller_id: data.seller_id, seller_name: data.seller?.name },
          }));
        })
        .catch(() => {});
    });
  }, [checkoutItems]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    if (items.length === 0) {
      router.replace('/cart');
    }
  }, [user, items.length, router]);

  useEffect(() => {
    if (!user || items.length === 0) return;
    if (checkoutItems.length === 0) {
      router.replace('/cart');
    }
  }, [user, items.length, checkoutItems.length, router]);

  useEffect(() => {
    if (!user) return;
    const fullName = user.name || '';
    const [first, ...rest] = fullName.split(' ');
    const last = rest.join(' ');
    const rawAddr = (user.address || '').trim();
    const parsed = parseCommaSeparatedAddress(rawAddr);
    const splitOk = Boolean(parsed.city && parsed.postal);
    setForm((prev) => ({
      ...prev,
      first_name: prev.first_name || first || '',
      last_name: prev.last_name || last || '',
      address: splitOk ? (parsed.street || rawAddr) : (prev.address || rawAddr),
      city: prev.city.trim() ? prev.city : (parsed.city || ''),
      postal_code: prev.postal_code.trim() ? prev.postal_code : (parsed.postal || ''),
      phone: prev.phone || user.phone || '',
    }));
  }, [user]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const applyParsedAddress = (rawStreet) => {
    const v = (rawStreet || '').trim();
    if (!v) return null;
    const { street, city, postal } = parseCommaSeparatedAddress(v);
    if (!city || !postal) return null;
    return { street: street || v, city, postal };
  };

  const handleAddressBlur = () => {
    const parsed = applyParsedAddress(form.address);
    if (!parsed) return;
    setForm((prev) => ({
      ...prev,
      address: parsed.street,
      city: prev.city.trim() ? prev.city : parsed.city,
      postal_code: prev.postal_code.trim() ? prev.postal_code : parsed.postal,
    }));
  };

  const applyPromo = () => {
    setPromoError('');
    const c = promoCode.trim().toUpperCase();
    if (!c) {
      setPromoError('Enter a code');
      return;
    }
    if (c === 'SAVE5') {
      setPromoDiscount(Math.round(checkoutSubtotal * 0.05 * 100) / 100);
      return;
    }
    if (c === 'WELCOME10') {
      setPromoDiscount(Math.round(checkoutSubtotal * 0.1 * 100) / 100);
      return;
    }
    setPromoDiscount(0);
    setPromoError('That code is not valid.');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!checkoutItems.length) {
      setError('Your cart is empty.');
      return;
    }

    setSubmitting(true);
    try {
      let street = form.address.trim();
      let city = form.city.trim();
      let postal = form.postal_code.trim();
      const fromLine = applyParsedAddress(street);
      if (fromLine && (!city || !postal)) {
        street = fromLine.street;
        city = city || fromLine.city;
        postal = postal || fromLine.postal;
        setForm((p) => ({
          ...p,
          address: street,
          city: p.city.trim() || fromLine.city,
          postal_code: p.postal_code.trim() || fromLine.postal,
        }));
      }

      const shippingAddress = `${form.first_name} ${form.last_name}
${street}
${city} ${postal}`.trim();

      const keysOrdered = checkoutItems.map((i) => i.key);

      await createOrder({
        total_amount: grandTotal,
        shipping_address: shippingAddress,
        phone: form.phone,
        payment_method: 'cod',
        items: checkoutItems.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          price: item.product.price,
        })),
      });
      await removeItemsByKeys(keysOrdered);
      router.push('/dashboard/customer');
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          'Failed to place order. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleMessageSeller = async (sellerId, productId) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setMessageSellerLoading(sellerId);
    try {
      const { data } = await createConversation({
        other_user_id: sellerId,
        product_id: productId || undefined,
      });
      router.push(`/messages?conversation=${data.conversation.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setMessageSellerLoading(null);
    }
  };

  return (
    <div className={styles.page}>
      <Head>
        <title>Checkout — urbanNxt</title>
      </Head>

      <div className={styles.topBar}>
        <div>
          <div className={styles.crumbs}>
            <Link href="/cart">Cart</Link> <span className={styles.dot}>/</span> Shipping{' '}
            <span className={styles.dot}>/</span> <span>Payment</span>
          </div>
          <h1 className={styles.title}>Checkout</h1>
          <p className={styles.subtitle}>Shipping details — pay cash when your order arrives.</p>
        </div>
        <div className={styles.securePill}>
          <Lock size={14} strokeWidth={2} aria-hidden />
          Secure checkout
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.formColumn}>
          <form onSubmit={handleSubmit}>
            {error && <div className={styles.error}>{error}</div>}

            <section className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Shipping address</h2>
              <div className={styles.twoCol}>
                <div className={styles.floatWrap}>
                  <input
                    id="first_name"
                    name="first_name"
                    className={styles.floatInput}
                    placeholder=" "
                    value={form.first_name}
                    onChange={handleChange}
                    required
                    autoComplete="given-name"
                  />
                  <label htmlFor="first_name" className={styles.floatLabel}>
                    First name
                  </label>
                </div>
                <div className={styles.floatWrap}>
                  <input
                    id="last_name"
                    name="last_name"
                    className={styles.floatInput}
                    placeholder=" "
                    value={form.last_name}
                    onChange={handleChange}
                    required
                    autoComplete="family-name"
                  />
                  <label htmlFor="last_name" className={styles.floatLabel}>
                    Last name
                  </label>
                </div>
              </div>
              <div className={styles.areaWrap}>
                <label htmlFor="address" className={styles.areaLabel}>
                  Street address
                </label>
                <div className={styles.areaField}>
                  <textarea
                    id="address"
                    name="address"
                    className={styles.areaInput}
                    value={form.address}
                    onChange={handleChange}
                    onBlur={handleAddressBlur}
                    required
                    autoComplete="street-address"
                    rows={3}
                  />
                </div>
              </div>
              <div className={styles.twoCol}>
                <div className={styles.floatWrap}>
                  <input
                    id="city"
                    name="city"
                    className={styles.floatInput}
                    placeholder=" "
                    value={form.city}
                    onChange={handleChange}
                    required
                    autoComplete="address-level2"
                  />
                  <label htmlFor="city" className={styles.floatLabel}>
                    City
                  </label>
                </div>
                <div className={styles.floatWrap}>
                  <input
                    id="postal_code"
                    name="postal_code"
                    className={styles.floatInput}
                    placeholder=" "
                    value={form.postal_code}
                    onChange={handleChange}
                    required
                    autoComplete="postal-code"
                  />
                  <label htmlFor="postal_code" className={styles.floatLabel}>
                    ZIP / Postal code
                  </label>
                </div>
              </div>
              <div className={styles.floatWrap}>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  className={styles.floatInput}
                  placeholder=" "
                  value={form.phone}
                  onChange={handleChange}
                  required
                  autoComplete="tel"
                />
                <label htmlFor="phone" className={styles.floatLabel}>
                  Phone
                </label>
              </div>
            </section>

            <section className={styles.sectionCard}>
              <h2 className={styles.sectionTitle}>Payment</h2>
              <div className={styles.codTile}>
                <Wallet size={28} strokeWidth={1.35} aria-hidden />
                <div>
                  <div className={styles.codTileTitle}>Cash on delivery</div>
                  <p className={styles.walletNote}>
                    Pay in cash when your order arrives. Have the exact amount ready if you can.
                  </p>
                </div>
              </div>
            </section>

            <div className={styles.promoBlock}>
              <button
                type="button"
                className={styles.promoToggle}
                onClick={() => {
                  setPromoOpen((o) => !o);
                  setPromoError('');
                }}
                aria-expanded={promoOpen}
              >
                {promoOpen ? 'Hide discount code' : 'Discount code'}
              </button>
              {promoOpen && (
                <div className={styles.promoExpand}>
                  <input
                    type="text"
                    className={styles.promoInput}
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    aria-invalid={!!promoError}
                  />
                  <button type="button" className={styles.promoApply} onClick={applyPromo}>
                    Apply
                  </button>
                </div>
              )}
              {promoError && (
                <p className={styles.walletNote} style={{ color: '#b91c1c', marginTop: '0.5rem' }}>
                  {promoError}
                </p>
              )}
              {promoDiscount > 0 && (
                <p className={styles.walletNote} style={{ color: '#059669', marginTop: '0.5rem', fontWeight: 600 }}>
                  Promotion applied to this order.
                </p>
              )}
            </div>

            <button type="submit" disabled={submitting} className={styles.payButton}>
              {submitting ? (
                <>
                  <Loader2 size={20} strokeWidth={2.5} className={styles.spinner} aria-hidden />
                  Processing…
                </>
              ) : (
                `Place order · ₱${grandTotal.toFixed(2)}`
              )}
            </button>
            <p className={styles.secureNote}>
              <Lock size={12} strokeWidth={2} aria-hidden />
              COD only · urbanNxt
            </p>
          </form>
        </div>

        <aside className={styles.orderSummary}>
          <h2 className={styles.summaryTitle}>Order summary</h2>
          <div className={styles.itemsList}>
            {checkoutItems.map((item) => {
              const img =
                productImageUrl(item.product?.image) ||
                item.product?.image ||
                `https://placehold.co/56x68?text=${encodeURIComponent(item.product?.name || 'Item')}`;
              return (
                <div key={item.key} className={styles.itemRow}>
                  <img
                    src={img}
                    alt={item.product.name}
                    onError={(e) => {
                      e.currentTarget.src = 'https://placehold.co/56x68';
                    }}
                  />
                  <div className={styles.itemInfo}>
                    <div className="name">{item.product.name}</div>
                    <div className="meta">
                      {item.size && `Size ${item.size}`}
                      {item.size && ' · '}
                      Qty {item.quantity}
                    </div>
                  </div>
                  <div className={styles.itemPrice}>
                    ₱{(Number(item.product.price) * item.quantity).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          {uniqueSellers.length > 0 && (
            <div className={styles.messageSellerSection}>
              <p className={styles.messageSellerLabel}>Questions?</p>
              {uniqueSellers.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleMessageSeller(s.id, s.productId)}
                  disabled={messageSellerLoading === s.id}
                  className={styles.messageSellerBtn}
                >
                  <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
                  {messageSellerLoading === s.id ? 'Opening…' : `Message ${s.name}`}
                </button>
              ))}
            </div>
          )}

          <div className={styles.summaryRow}>
            <span>Subtotal</span>
            <span>₱{checkoutSubtotal.toFixed(2)}</span>
          </div>
          {promoDiscount > 0 && (
            <div className={`${styles.summaryRow} ${styles.discountRow}`}>
              <span>Discount</span>
              <span>−₱{promoDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className={styles.summaryRow}>
            <span>Shipping</span>
            <span>₱{SHIPPING_FEE.toFixed(2)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>Tax</span>
            <span>₱0.00</span>
          </div>
          <hr className={styles.summaryDivider} />
          <div className={styles.totalRow}>
            <span className={styles.totalLabel}>Total</span>
            <span className={styles.totalAmount}>₱{grandTotal.toFixed(2)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
