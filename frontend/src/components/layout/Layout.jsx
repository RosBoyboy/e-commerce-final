import Head from 'next/head';
import { useRouter } from 'next/router';
import Navbar from './Navbar';
import Footer from './Footer';
import { useAuth } from '@/context/AuthContext';

export default function Layout({ children }) {
  const router = useRouter();
  const { user } = useAuth();
  const isDashboard = router.pathname.startsWith('/dashboard');
  const isAdminDashboard = router.pathname === '/dashboard/admin';
  const isCustomerDashboard = router.pathname === '/dashboard/customer';
  const isRiderDashboard = router.pathname.startsWith('/dashboard/rider');
  const isCustomerMessages = router.pathname === '/messages' && user?.role?.name === 'customer';
  const isAdminMessages = router.pathname === '/messages' && user?.role?.name === 'admin';
  const hideGlobalNav =
    isAdminDashboard || isCustomerDashboard || isRiderDashboard || isCustomerMessages || isAdminMessages;
  const mainFullBleed =
    isAdminDashboard || isCustomerDashboard || isRiderDashboard || isCustomerMessages || isAdminMessages;

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
