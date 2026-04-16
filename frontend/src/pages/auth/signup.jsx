import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Bike, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { parseCommaSeparatedAddress } from '@/utils/parseAddress';
import styles from '@/styles/auth.module.scss';

const RIDER_DOMAIN = 'rider.com';

export default function Signup() {
  const router = useRouter();
  const { register } = useAuth();
  const [accountType, setAccountType] = useState('customer'); // customer | rider
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    riderEmailLocal: '',
    vehiclePlate: '',
    password: '',
    passwordConfirmation: '',
    phone: '',
    addressLine: '',
    city: '',
    postalCode: '',
    fullPaste: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (router.query.type === 'rider') {
      setAccountType('rider');
    }
  }, [router.query.type]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFullPasteBlur = () => {
    const v = formData.fullPaste.trim();
    if (!v) return;
    const { street, city, postal } = parseCommaSeparatedAddress(v);
    setFormData((prev) => ({
      ...prev,
      addressLine: street || prev.addressLine,
      city: city || prev.city,
      postalCode: postal || prev.postalCode,
      fullPaste: '',
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.passwordConfirmation) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const phone = formData.phone.trim();
    const line = formData.addressLine.trim();
    const city = formData.city.trim();
    const postal = formData.postalCode.trim();

    if (!phone) {
      setError('Phone number is required.');
      setLoading(false);
      return;
    }
    if (!line || !city || !postal) {
      setError('Please complete street address, city, and ZIP / postal code.');
      setLoading(false);
      return;
    }

    const address = `${line}, ${city}, ${postal}`;
    const role = accountType === 'rider' ? 'rider' : 'customer';

    let email = formData.email.trim();
    if (role === 'rider') {
      let local = formData.riderEmailLocal.trim().toLowerCase();
      if (local.includes('@')) {
        const [u, dom] = local.split('@');
        if (dom === RIDER_DOMAIN) {
          local = u;
        } else {
          setError(`Delivery partner emails must end with @${RIDER_DOMAIN}.`);
          setLoading(false);
          return;
        }
      }
      if (!local || local.length < 2) {
        setError(`Choose a username for your @${RIDER_DOMAIN} email (at least 2 characters).`);
        setLoading(false);
        return;
      }
      if (!/^[a-z0-9][a-z0-9._-]{0,62}$/i.test(local)) {
        setError('Email username may only contain letters, numbers, dots, underscores, and hyphens.');
        setLoading(false);
        return;
      }
      email = `${local}@${RIDER_DOMAIN}`;
      const plate = formData.vehiclePlate.trim();
      if (!plate) {
        setError('Vehicle plate is required for delivery partner accounts.');
        setLoading(false);
        return;
      }
    }

    try {
      await register(
        formData.name,
        email,
        formData.password,
        formData.passwordConfirmation,
        role,
        phone,
        address,
        role === 'rider' ? formData.vehiclePlate.trim() : '',
      );
      router.push(role === 'rider' ? '/dashboard/rider' : '/dashboard/customer');
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 429) {
        setError('Too many attempts. Please wait a minute and try again.');
      } else if (data?.errors) {
        const emailTaken = Array.isArray(data.errors.email) && data.errors.email[0];
        if (emailTaken) {
          setError(emailTaken);
        } else {
          const firstError = Object.values(data.errors).flat()[0];
          setError(firstError || data.message || 'Please check your details and try again.');
        }
      } else if (data?.message) {
        setError(data.message);
      } else {
        setError('Signup failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer}>
      <div className={`${styles.authCard} ${styles.authCardSignup}`}>
        <div className={styles.authIconWrap}>
          <span className={styles.authIcon} aria-hidden>
            {accountType === 'rider' ? <Bike size={34} strokeWidth={2} /> : <User size={34} strokeWidth={2} />}
          </span>
        </div>
        <h1 className={styles.authTitle}>Create an account</h1>
        <p className={styles.authSubtitle}>
          {accountType === 'rider'
            ? `Delivery partners use @${RIDER_DOMAIN} emails. Anyone can register — no fixed cap.`
            : 'Enter your details to shop on urbanNxt.'}
        </p>

        <div className={styles.authRoleTabs} role="tablist" aria-label="Account type">
          <button
            type="button"
            role="tab"
            aria-selected={accountType === 'customer'}
            className={`${styles.authRoleTab} ${accountType === 'customer' ? styles.authRoleTabActive : ''}`}
            onClick={() => {
              setAccountType('customer');
              setError('');
            }}
          >
            Customer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={accountType === 'rider'}
            className={`${styles.authRoleTab} ${accountType === 'rider' ? styles.authRoleTabActive : ''}`}
            onClick={() => {
              setAccountType('rider');
              setError('');
            }}
          >
            Delivery partner
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="name">Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="John Doe"
            />
          </div>

          {accountType === 'customer' ? (
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon} aria-hidden>✉</span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                  className={styles.inputWithIcon}
                  autoComplete="email"
                />
              </div>
            </div>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label htmlFor="riderEmailLocal">Rider email</label>
                <p className={styles.authFieldHint}>Your login will always be username@{RIDER_DOMAIN}</p>
                <div className={styles.riderEmailRow}>
                  <input
                    type="text"
                    id="riderEmailLocal"
                    name="riderEmailLocal"
                    value={formData.riderEmailLocal}
                    onChange={handleChange}
                    required
                    placeholder="your.name"
                    autoComplete="username"
                    spellCheck={false}
                    className={styles.riderEmailLocalInput}
                  />
                  <span className={styles.riderEmailSuffix}>@{RIDER_DOMAIN}</span>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="vehiclePlate">Vehicle plate</label>
                <input
                  type="text"
                  id="vehiclePlate"
                  name="vehiclePlate"
                  value={formData.vehiclePlate}
                  onChange={handleChange}
                  required
                  placeholder="e.g. ABC-1234"
                  autoComplete="off"
                  maxLength={32}
                />
              </div>
            </>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="phone">Phone</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              placeholder="09XX XXX XXXX"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="fullPaste">Paste full address (optional)</label>
            <textarea
              id="fullPaste"
              name="fullPaste"
              value={formData.fullPaste}
              onChange={handleChange}
              onBlur={handleFullPasteBlur}
              placeholder="e.g. P-1 BONBON, BUTUAN CITY, 8600 — we fill street, city, and ZIP when you leave this field"
              rows="2"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="addressLine">Street address</label>
            <textarea
              id="addressLine"
              name="addressLine"
              value={formData.addressLine}
              onChange={handleChange}
              required
              placeholder="Unit / street / barangay"
              rows="2"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="city">City</label>
            <input
              type="text"
              id="city"
              name="city"
              value={formData.city}
              onChange={handleChange}
              required
              placeholder="BUTUAN CITY"
              autoComplete="address-level2"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="postalCode">ZIP / Postal code</label>
            <input
              type="text"
              id="postalCode"
              name="postalCode"
              value={formData.postalCode}
              onChange={handleChange}
              required
              placeholder="8600"
              autoComplete="postal-code"
              inputMode="numeric"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password">Password (min 8 characters)</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon} aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11v6"/><path d="M20 13h2"/><path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 2.072.578"/><circle cx="10" cy="7" r="4"/><circle cx="20" cy="19" r="2"/></svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={8}
                placeholder="At least 8 characters"
                className={styles.inputWithIcon}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="passwordConfirmation">Confirm Password</label>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon} aria-hidden>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11v6"/><path d="M20 13h2"/><path d="M3 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 2.072.578"/><circle cx="10" cy="7" r="4"/><circle cx="20" cy="19" r="2"/></svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                id="passwordConfirmation"
                name="passwordConfirmation"
                value={formData.passwordConfirmation}
                onChange={handleChange}
                required
                placeholder="Confirm your password"
                className={styles.inputWithIcon}
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className={styles.submitBtn}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p className={styles.switchMode}>
          Already have an account? <Link href="/auth/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
