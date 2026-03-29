import '@/styles/globals.scss';
import Layout from '@/components/layout/Layout';
import { AuthProvider } from '@/context/AuthContext';
import { MessageUnreadProvider } from '@/context/MessageUnreadContext';
import { CartProvider } from '@/context/CartContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { ToastProvider } from '@/components/ui/ToastProvider';

export default function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <MessageUnreadProvider>
        <ToastProvider>
          <CartProvider>
            <WishlistProvider>
              <Layout>
                <Component {...pageProps} />
              </Layout>
            </WishlistProvider>
          </CartProvider>
        </ToastProvider>
      </MessageUnreadProvider>
    </AuthProvider>
  );
}

