import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/products.module.scss';
import { fetchProducts } from '@/services/api';
import { productImageUrl } from '@/utils/image';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { useCart, CartAddBlockedError } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { useToast } from '@/components/ui/ToastProvider';
import { Heart } from 'lucide-react';

export default function Products() {
  const { user } = useAuth();
  const router = useRouter();
  const { addItem } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const toggleWishlist = (id) => {
    if (isInWishlist(id)) removeFromWishlist(id);
    else addToWishlist(id);
  };

  const [selectedSize, setSelectedSize] = useState({});

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await fetchProducts();
        setProducts(
          (data || []).map((p) => ({
            ...p,
            image:
              productImageUrl(p.image) ||
              'https://placehold.co/400x500?text=' +
                encodeURIComponent(p.name || 'Product'),
            sizes: Array.isArray(p.sizes) ? p.sizes : ['S', 'M', 'L', 'XL'],
          })),
        );
      } catch (e) {
        console.error('Failed to load products', e);
        setError('Failed to load products. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const category = router.query.category;
  const filteredProducts = category
    ? products.filter((p) => p.category === category)
    : products;

  const handleSizeChange = (id, size) => {
    setSelectedSize({ ...selectedSize, [id]: size });
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

  if (loading) {
    return (
      <div className={styles.shopContainer}>
        <Head>
          <title>Shop Collection - UrbanNext</title>
        </Head>
        <p style={{ padding: '2rem' }}>Loading products...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.shopContainer}>
        <Head>
          <title>Shop Collection - UrbanNext</title>
        </Head>
        <p style={{ padding: '2rem', color: '#b91c1c' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.shopContainer}>
      <Head>
        <title>Shop Collection - UrbanNext</title>
      </Head>

      <div className={styles.breadcrumb}>
        <span>Home</span> / <span>Shop Collection</span>
      </div>

      <div className={styles.shopLayout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <h3>Filters</h3>

          <form onSubmit={(e) => { e.preventDefault(); showToast({ message: 'Filters applied.', type: 'success' }); }}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Category</span>
              <div className={styles.checkboxList}>
                <label>
                  <input type="checkbox" defaultChecked /> All Clothing
                </label>
                <label>
                  <input type="checkbox" /> Outerwear
                </label>
                <label>
                  <input type="checkbox" /> Tops
                </label>
                <label>
                  <input type="checkbox" /> Bottoms
                </label>
                <label>
                  <input type="checkbox" /> Shoes
                </label>
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Size</span>
              <div className={styles.checkboxList}>
                <label><input type="checkbox" /> XS</label>
                <label><input type="checkbox" /> S</label>
                <label><input type="checkbox" /> M</label>
                <label><input type="checkbox" /> L</label>
                <label><input type="checkbox" /> XL</label>
              </div>
            </div>

            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Price Range</span>
              <div className={styles.priceInputs}>
                <input type="number" placeholder="Min" />
                <input type="number" placeholder="Max" />
              </div>
            </div>

            <button type="submit" className={styles.applyBtn}>Apply Filters</button>
            <a href="#" className={styles.clearBtn}>Clear all</a>
          </form>
        </aside>

        {/* Main Content */}
        <main className={styles.mainContent}>
          <div className={styles.topBar}>
            <h1>Shop Collection</h1>
            <div className={styles.sortBox}>
              <label>Sort by:</label>
              <select>
                <option>Newest Arrivals</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
                <option>Most Popular</option>
              </select>
            </div>
          </div>

          <div className={styles.productGrid}>
            {filteredProducts.map((product) => (
              <div className={styles.productCard} key={product.id}>
                <div className={styles.imageContainer}>
                  {product.id % 2 === 0 && <span className={styles.badge}>BEST SELLER</span>}
                  <Link href={`/product/${product.id}`} style={{ display: 'block', lineHeight: 0 }}>
                    <img
                      src={product.image}
                      alt={product.name}
                      onError={(e) => { e.target.src = 'https://placehold.co/400x500'; }}
                    />
                  </Link>
                  <button
                    type="button"
                    className={`${styles.wishlistBtn} ${isInWishlist(product.id) ? styles.active : ''}`}
                    onClick={() => toggleWishlist(product.id)}
                    aria-label={isInWishlist(product.id) ? 'Remove from wishlist' : 'Add to wishlist'}
                  >
                    <Heart size={18} strokeWidth={1.5} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
                  </button>
                </div>

                <div className={styles.productInfo}>
                  <Link href={`/product/${product.id}`}><h3>{product.name}</h3></Link>
                  <p className={styles.category}>{product.category}</p>

                  <form onSubmit={(e) => handleAddToCart(e, product)}>
                    <label className={styles.sizeLabel}>Size</label>
                    <select
                      className={styles.sizeSelect}
                      value={selectedSize[product.id] || ''}
                      onChange={(e) => handleSizeChange(product.id, e.target.value)}
                      required
                    >
                      <option value="">Select Size</option>
                      {(Array.isArray(product.sizes) ? product.sizes : ['S', 'M', 'L', 'XL']).map(size => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>

                    <div className={styles.priceRow}>
                      <span className={styles.price}>₱{product.price.toFixed(2)}</span>
                      {product.id % 2 === 0 && (
                        <span className={styles.oldPrice}>₱{(product.price * 1.2).toFixed(2)}</span>
                      )}
                    </div>

                    {(product.stock ?? 0) < 1 && (
                      <p
                        style={{
                          margin: '8px 0 6px',
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#b91c1c',
                        }}
                        role="alert"
                      >
                        Out of stock — cannot add to cart.
                      </p>
                    )}

                    <button
                      type="submit"
                      className={styles.addToCart}
                      disabled={(product.stock ?? 0) < 1}
                      aria-disabled={(product.stock ?? 0) < 1}
                    >
                      {(product.stock ?? 0) < 1 ? 'Out of stock' : 'Add to Cart'}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>

        </main>
      </div>
    </div>
  );
}
