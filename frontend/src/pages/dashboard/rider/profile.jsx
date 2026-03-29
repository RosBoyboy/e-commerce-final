import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Activity, Car, Mail, Phone, User } from 'lucide-react';
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
          <div className={styles.riderProfileShell}>
            <div className={styles.riderProfileHero}>
              <div className={styles.riderProfileAvatar} aria-hidden>
                <User size={32} strokeWidth={1.5} />
              </div>
              <div className={styles.riderProfileHeroText}>
                <h2>{rider.name || 'Rider'}</h2>
                <p>Delivery partner · urbanNxt</p>
              </div>
            </div>

            <div className={styles.riderProfileCard}>
              <div className={styles.riderProfileField}>
                <div className={styles.riderProfileIconCol}>
                  <User size={18} strokeWidth={1.75} aria-hidden />
                </div>
                <div className={styles.riderProfileFieldBody}>
                  <span className={styles.riderProfileFieldLabel}>Name</span>
                  <span className={styles.riderProfileFieldValue}>{rider.name || '—'}</span>
                </div>
              </div>
              <div className={styles.riderProfileField}>
                <div className={styles.riderProfileIconCol}>
                  <Mail size={18} strokeWidth={1.75} aria-hidden />
                </div>
                <div className={styles.riderProfileFieldBody}>
                  <span className={styles.riderProfileFieldLabel}>Email</span>
                  <span className={styles.riderProfileFieldValue}>{rider.email || '—'}</span>
                </div>
              </div>
              <div className={styles.riderProfileField}>
                <div className={styles.riderProfileIconCol}>
                  <Phone size={18} strokeWidth={1.75} aria-hidden />
                </div>
                <div className={styles.riderProfileFieldBody}>
                  <span className={styles.riderProfileFieldLabel}>Phone</span>
                  <span className={styles.riderProfileFieldValue}>{rider.phone || '—'}</span>
                </div>
              </div>
              <div className={styles.riderProfileField}>
                <div className={styles.riderProfileIconCol}>
                  <Car size={18} strokeWidth={1.75} aria-hidden />
                </div>
                <div className={styles.riderProfileFieldBody}>
                  <span className={styles.riderProfileFieldLabel}>Vehicle plate</span>
                  <span className={styles.riderProfileFieldValue}>{rider.vehicle_plate || '—'}</span>
                </div>
              </div>
              <div className={styles.riderProfileField}>
                <div className={styles.riderProfileIconCol}>
                  <Activity size={18} strokeWidth={1.75} aria-hidden />
                </div>
                <div className={styles.riderProfileFieldBody}>
                  <span className={styles.riderProfileFieldLabel}>Status</span>
                  <span className={styles.riderProfileFieldValue} style={{ textTransform: 'capitalize' }}>
                    {rider.status || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.riderMuted}>No rider profile found.</p>
        )}
      </RiderLayout>
    </>
  );
}
