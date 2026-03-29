import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { useCart, CartAddBlockedError } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useToast } from '@/components/ui/ToastProvider';
import { Heart, MessageCircle } from 'lucide-react';
import { fetchProduct, createConversation } from '@/services/api';
import { productImageUrl } from '@/utils/image';
import styles from '@/styles/products.module.scss';

export default function ProductDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [messageSellerLoading, setMessageSellerLoading] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const { data } = await fetchProduct(id);
        const sizes = Array.isArray(data.sizes) ? data.sizes : ['S', 'M', 'L', 'XL'];
        setProduct({
          ...data,
          image: productImageUrl(data.image) || 'https://placehold.co/500x600?text=' + encodeURIComponent(data.name || 'Product'),
          sizes,
        });
      } catch (e) {
        if (e.response?.status === 404) setError('Product not found.');
        else setError('Failed to load product.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleAddToCart = async (e) => {
    e.preventDefault();
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!selectedSize) {
      showToast({ message: 'Please select a size.', type: 'error' });
      return;
    }
    try {
      await addItem(product, { size: selectedSize, quantity: 1 });
      showToast({
        message: `Added ${product.name} (Size: ${selectedSize}) to your cart.`,
        type: 'success',
        actionLabel: 'View cart',
        onAction: () => router.push('/cart'),
      });
    } catch (e) {
      if (e instanceof CartAddBlockedError) return;
      showToast({ message: 'Could not add to cart. Try again.', type: 'error' });
    }
  };

  const handleMessageSeller = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!product.seller_id) {
      showToast({ message: 'Seller information is not available for this product.', type: 'error' });
      return;
    }
    setMessageSellerLoading(true);
    try {
      const { data } = await createConversation({
        other_user_id: product.seller_id,
        product_id: product.id,
      });
      router.push(`/messages?conversation=${data.conversation.id}`);
    } catch (err) {
      console.error(err);
      showToast({
        message: err.response?.data?.message || 'Could not start conversation.',
        type: 'error',
      });
    } finally {
      setMessageSellerLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.shopContainer}>
        <Head><title>Product - UrbanNext</title></Head>
        <p style={{ padding: '2rem' }}>Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className={styles.shopContainer}>
        <Head><title>Product - UrbanNext</title></Head>
        <p style={{ padding: '2rem', color: '#b91c1c' }}>{error || 'Product not found.'}</p>
        <Link href="/products">Back to products</Link>
      </div>
    );
  }

  return (
    <div className={styles.shopContainer}>
      <Head>
        <title>{product.name} - UrbanNext</title>
      </Head>
      <div className={styles.breadcrumb}>
        <Link href="/">Home</Link> / <Link href="/products">Shop</Link> / <span>{product.name}</span>
      </div>
      <div className={styles.detailGrid}>
        <div className={styles.detailImageWrap}>
          <img
            src={product.image}
            alt={product.name}
            onError={(e) => { e.target.src = 'https://placehold.co/500x600'; }}
          />
        </div>
        <div className={styles.detailInfo}>
          <div className={styles.detailTitleRow}>
            <h1 className={styles.detailTitle}>{product.name}</h1>
            <button
              type="button"
              className={styles.iconBtnGhost}
              onClick={() => (isInWishlist(product.id) ? removeFromWishlist(product.id) : addToWishlist(product.id))}
              aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={20} strokeWidth={1.5} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
            </button>
          </div>
          <p className={styles.detailMeta}>{product.category}</p>
          <p className={styles.detailPrice}>₱{Number(product.price).toFixed(2)}</p>
          <form onSubmit={handleAddToCart}>
            <label className={styles.detailSizeLabel} htmlFor="product-size">Size</label>
            <select
              id="product-size"
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              required
              className={styles.detailSelect}
            >
              <option value="">Select Size</option>
              {(Array.isArray(product.sizes) ? product.sizes : ['S', 'M', 'L', 'XL']).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <button
              type="submit"
              className={styles.addToCart}
              style={{ width: '100%' }}
              disabled={(product.stock ?? 0) < 1}
              aria-disabled={(product.stock ?? 0) < 1}
            >
              {(product.stock ?? 0) < 1 ? 'Out of stock' : 'Add to cart'}
            </button>
          </form>
          {product.seller_id && user?.role?.name === 'customer' && (
            <button
              type="button"
              className={styles.detailMsgBtn}
              onClick={handleMessageSeller}
              disabled={messageSellerLoading}
            >
              <MessageCircle size={18} strokeWidth={1.5} aria-hidden />
              {messageSellerLoading ? 'Opening…' : 'Message seller'}
            </button>
          )}
          <Link href="/products" style={{ display: 'inline-block', marginTop: 16, color: '#2563eb', fontWeight: 600, fontSize: 14 }}>
            ← Back to products
          </Link>
        </div>
      </div>
    </div>
  );
}
