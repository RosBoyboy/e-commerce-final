import { useEffect, useState } from 'react';
import Head from 'next/head';
import { TrendingUp, Wallet } from 'lucide-react';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { fetchRiderStats } from '@/services/api';
import { useToast } from '@/components/ui/ToastProvider';
import RiderLayout from '@/components/rider/RiderLayout';
import styles from '@/styles/riderPortal.module.scss';

export default function RiderEarnings() {
  useProtectedRoute('rider');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await fetchRiderStats();
        if (!cancelled) setStats(data?.stats || null);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          showToast({
            message: e.response?.data?.message || 'Could not load earnings.',
            type: 'error',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showToast]);

  const s = stats || {};

  return (
    <>
      <Head>
        <title>Earnings — Rider</title>
      </Head>
      <RiderLayout activeKey="earnings">
        <h1 className={styles.riderPageTitle}>Earnings</h1>
        <p className={styles.riderPageSub}>Snapshot of completed deliveries and today&apos;s order totals.</p>

        {loading ? (
          <p className={styles.riderMuted}>
            <span className={styles.riderSpinner} aria-hidden /> Loading…
          </p>
        ) : (
          <div className={styles.riderStatGrid}>
            <div className={styles.riderStatCard}>
              <Wallet size={22} strokeWidth={1.75} style={{ color: '#38bdf8', marginBottom: 8 }} aria-hidden />
              <p className={styles.riderStatValue}>₱{Number(s.revenue_today || 0).toFixed(2)}</p>
              <p className={styles.riderStatLabel}>Revenue today (completed orders)</p>
            </div>
            <div className={styles.riderStatCard}>
              <TrendingUp size={22} strokeWidth={1.75} style={{ color: '#22c55e', marginBottom: 8 }} aria-hidden />
              <p className={styles.riderStatValue}>{s.delivered_today ?? 0}</p>
              <p className={styles.riderStatLabel}>Orders completed today</p>
            </div>
            <div className={styles.riderStatCard}>
              <p className={styles.riderStatValue}>{s.active_deliveries ?? 0}</p>
              <p className={styles.riderStatLabel}>Active deliveries right now</p>
            </div>
            <div className={styles.riderStatCard}>
              <p className={styles.riderStatValue}>{s.delivered_last_7_days ?? 0}</p>
              <p className={styles.riderStatLabel}>Completed in the last 7 days</p>
            </div>
          </div>
        )}
      </RiderLayout>
    </>
  );
}
