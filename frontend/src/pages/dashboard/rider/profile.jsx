import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Activity, Car, Mail, MapPin, Phone, User } from 'lucide-react';
import { useProtectedRoute } from '@/hooks/useProtectedRoute';
import { fetchRiderProfile, updateRiderProfile } from '@/services/api';
import { useToast } from '@/components/ui/ToastProvider';
import RiderLayout from '@/components/rider/RiderLayout';
import styles from '@/styles/riderPortal.module.scss';

export default function RiderProfilePage() {
  useProtectedRoute('rider');
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rider, setRider] = useState(null);
  const [phone, setPhone] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await fetchRiderProfile();
        const r = data?.rider;
        if (!cancelled && r) {
          setRider(r);
          setPhone(r.phone ?? '');
          setVehiclePlate(r.vehicle_plate ?? '');
          setAddress(r.address ?? '');
        }
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

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await updateRiderProfile({
        phone: phone.trim() || null,
        vehicle_plate: vehiclePlate.trim(),
        address: address.trim() || null,
      });
      const r = data?.rider;
      if (r) {
        setRider(r);
        setPhone(r.phone ?? '');
        setVehiclePlate(r.vehicle_plate ?? '');
        setAddress(r.address ?? '');
      }
      showToast({ message: data?.message || 'Profile saved.', type: 'success' });
    } catch (e) {
      console.error(e);
      showToast({
        message: e.response?.data?.message || 'Could not save profile.',
        type: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Head>
        <title>Profile — Rider</title>
      </Head>
      <RiderLayout activeKey="profile">
        <h1 className={styles.riderPageTitle}>Profile</h1>
        <p className={styles.riderPageSub}>
          Your account name and email are managed by admin. Update your phone, plate, and base address for dispatch
          and ride records.
        </p>

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

            <div className={styles.riderProfileCard} style={{ marginBottom: 20 }}>
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

            <form className={styles.riderProfileFormCard} onSubmit={handleSave}>
              <div>
                <label className={styles.riderProfileFormLabel} htmlFor="rider-phone">
                  Phone
                </label>
                <input
                  id="rider-phone"
                  className={styles.riderProfileInput}
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div>
                <label className={styles.riderProfileFormLabel} htmlFor="rider-plate">
                  Vehicle plate
                </label>
                <input
                  id="rider-plate"
                  className={styles.riderProfileInput}
                  type="text"
                  autoComplete="off"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                />
              </div>
              <div>
                <label className={styles.riderProfileFormLabel} htmlFor="rider-address">
                  <MapPin size={14} strokeWidth={2} style={{ verticalAlign: '-0.1em', marginRight: 4 }} aria-hidden />
                  Base address / ride info
                </label>
                <textarea
                  id="rider-address"
                  className={styles.riderProfileTextarea}
                  placeholder="Street, barangay, city — used for dispatch and your ride record"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={4}
                />
              </div>
              <button type="submit" className={styles.riderProfileSaveBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </form>

            <p className={styles.riderMuted} style={{ marginTop: 16, fontSize: 13 }}>
              <Car size={14} strokeWidth={1.75} style={{ verticalAlign: '-0.15em', marginRight: 4 }} aria-hidden />
              Delivery stops and products for each order are listed under Tracking.
            </p>
          </div>
        ) : (
          <p className={styles.riderMuted}>No rider profile found.</p>
        )}
      </RiderLayout>
    </>
  );
}
