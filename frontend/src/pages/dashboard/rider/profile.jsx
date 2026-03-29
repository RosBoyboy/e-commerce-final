import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { fetchRiderProfile } from '@/services/api';
import { useToast } from '@/components/ui/ToastProvider';
import RiderLayout from '@/components/rider/RiderLayout';
import styles from '@/styles/riderPortal.module.scss';

export default function RiderProfilePage() {
  useProtectedRoute('rider');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [rider, setRider] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await fetchRiderProfile();
        if (!cancelled) setRider(data?.rider || null);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          showToast({
            message: e.response?.data?.message || 'Could not load profile.',
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

  return (
    <>
      <Head>
        <title>Profile — Rider</title>
      </Head>
      <RiderLayout activeKey="profile">
        <h1 className={styles.riderPageTitle}>Profile</h1>
        <p className={styles.riderPageSub}>Your UrbanNxt rider details as shown to operations and customers.</p>

        {loading ? (
          <p className={styles.riderMuted}>
            <span className={styles.riderSpinner} aria-hidden /> Loading…
          </p>
        ) : rider ? (
          <div className={styles.riderProfileCard}>
            <div className={styles.riderProfileRow}>
              <span className={styles.riderProfileKey}>Name</span>
              <span className={styles.riderProfileVal}>{rider.name || '—'}</span>
            </div>
            <div className={styles.riderProfileRow}>
              <span className={styles.riderProfileKey}>Email</span>
              <span className={styles.riderProfileVal}>{rider.email || '—'}</span>
            </div>
            <div className={styles.riderProfileRow}>
              <span className={styles.riderProfileKey}>Phone</span>
              <span className={styles.riderProfileVal}>{rider.phone || '—'}</span>
            </div>
            <div className={styles.riderProfileRow}>
              <span className={styles.riderProfileKey}>Vehicle plate</span>
              <span className={styles.riderProfileVal}>{rider.vehicle_plate || '—'}</span>
            </div>
            <div className={styles.riderProfileRow}>
              <span className={styles.riderProfileKey}>Status</span>
              <span className={styles.riderProfileVal} style={{ textTransform: 'capitalize' }}>
                {rider.status || '—'}
              </span>
            </div>
          </div>
        ) : (
          <p className={styles.riderMuted}>No rider profile found.</p>
        )}
      </RiderLayout>
    </>
  );
}
