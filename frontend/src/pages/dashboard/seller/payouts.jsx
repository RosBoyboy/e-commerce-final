import { useState } from 'react';
import Link from 'next/link';
import SellerLayout from '@/components/seller/SellerLayout';
import styles from '@/styles/sellerPortal.module.scss';

const mockPayouts = [
  { id: 'TX-99832', date: 'Oct 24, 2023', method: 'Bank Transfer ****4492', amount: 850, status: 'Paid' },
  { id: 'TX-99831', date: 'Oct 22, 2023', method: 'Visa ending in 8821', amount: 1200, status: 'Processing' },
  { id: 'TX-99755', date: 'Oct 15, 2023', method: 'Bank Transfer ****4492', amount: 2450, status: 'Paid' },
];

export default function SellerPayouts() {
  const [period, setPeriod] = useState('30D');

  return (
    <SellerLayout>
      <div className={styles.breadcrumb}>
        <Link href="/dashboard/seller">Home</Link>
        <span> / Payouts</span>
      </div>
      <div className={styles.actionRow}>
        <div>
          <h1 className={styles.pageTitle}>Payouts & Earnings</h1>
          <p className={styles.pageSubtitle}>Manage your funds, view transfer history, and request payouts.</p>
        </div>
        <button type="button" className={styles.primaryButton}>Request Payout</button>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <p className={styles.statValue}>₱0.00</p>
          <p className={styles.statLabel}>Available Balance</p>
          <span className={styles.statMeta}>Ready to withdraw</span>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>₱0.00</p>
          <p className={styles.statLabel}>Pending Payouts</p>
          <span className={styles.statMeta}>Est. arrival: —</span>
        </div>
        <div className={styles.statCard}>
          <p className={styles.statValue}>₱0.00</p>
          <p className={styles.statLabel}>Total Earnings</p>
          <span className={styles.statTrend}>+0% vs. last month</span>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Earnings Performance</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            {['7D', '30D', '12M'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={period === p ? styles.primaryButton : styles.secondaryButton}
                style={{ padding: '6px 12px', fontSize: 13 }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.cardBody} style={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
          Chart (Last {period}) — connect your analytics to show earnings over time.
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2>Payout History</h2>
        </div>
        <div className={styles.cardBody} style={{ padding: 0 }}>
          <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Transaction ID</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mockPayouts.map((row) => (
                <tr key={row.id}>
                  <td>{row.date}</td>
                  <td>#{row.id}</td>
                  <td>{row.method}</td>
                  <td>₱{row.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td>
                  <td>
                    <span className={`${styles.badge} ${row.status === 'Paid' ? styles.green : styles.orange}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </SellerLayout>
  );
}
