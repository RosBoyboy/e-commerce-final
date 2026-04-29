import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from './Navbar';
import Footer from './Footer';
import CustomerShell from './CustomerShell';
import { useAuth } from '@/context/AuthContext';

export default function Layout({ children }) {
  const router = useRouter();
  const { user } = useAuth();
  
  // Dashboard routes (have their own shell wrappers)
  const isDashboard = router.pathname.startsWith('/dashboard');
  const isAdminDashboard = router.pathname === '/dashboard/admin';
  const isCustomerDashboard = router.pathname === '/dashboard/customer';
  const isRiderDashboard = router.pathname.startsWith('/dashboard/rider');
  
  // Messaging routes (have their own wrappers)
  const isCustomerMessages = router.pathname === '/messages' && user?.role?.name === 'customer';
  const isAdminMessages = router.pathname === '/messages' && user?.role?.name === 'admin';
  
  // Shop routes (should use layout wrapper when authenticated as customer)
  const isShopPage = router.pathname === '/products' || router.pathname.startsWith('/product/');
  
  // Determine if this page needs special layout handling
  const hideGlobalNav =
    isAdminDashboard || isCustomerDashboard || isRiderDashboard || isCustomerMessages || isAdminMessages;
  const mainFullBleed =
    isAdminDashboard || isCustomerDashboard || isRiderDashboard || isCustomerMessages || isAdminMessages;
  
  // Check if authenticated user is accessing shop pages - wrap in CustomerShell for layout consistency
  const isAuthenticatedOnShop = isShopPage && user && !user.role?.name?.includes('admin');
  
  // Determine the current tab for CustomerShell when on shop pages
  const getShellActiveKey = () => {
    if (isShopPage) return 'shop'; // Custom key for shop pages
    return undefined;
  };

  // Render shop pages with CustomerShell wrapper to maintain sidebar consistency
  if (isAuthenticatedOnShop) {
    return (
      <>
        <Head>
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover"
          />
        </Head>
        <CustomerShell activeKey={getShellActiveKey()}>
          {children}
        </CustomerShell>
      </>
    );
  }

  // Default layout for public pages
  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover"
        />
      </Head>
      {!hideGlobalNav && <Navbar />}
      <main className={mainFullBleed ? undefined : 'container'}>{children}</main>
      {!isDashboard && !isCustomerMessages && <Footer />}
    </>
  );
}
