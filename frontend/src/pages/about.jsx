import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import styles from '@/styles/about.module.scss';
import React from 'react';
import { useToast } from '@/components/ui/ToastProvider';

export default function About() {
    const { showToast } = useToast();
    return (
        <>
            <Head>
                <title>About Us - UrbanNext</title>
            </Head>

            <div style={{ maxWidth: '1200px', margin: '32px auto', padding: '0 20px' }}>
                <nav className={styles.breadcrumb} aria-label="Breadcrumb">
                    <Link href="/">Home</Link>
                    <span className={styles.breadcrumbSep}> / </span>
                    <span>About us</span>
                </nav>
                {/* Hero */}
                <section className={styles.aboutHero}>
                    <img
                        src="https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=1400&auto=format&fit=crop"
                        alt="city skyline"
                        className={styles.heroBg}
                    />
                    <div className={styles.heroContent}>
                        <h1>Defining the Future of Urban Wear</h1>
                        <p>Building a movement rooted in city culture, street art, and modern lifestyle for the bold and the creative.</p>
                        <Link href="/products" className={styles.exploreBtn}>
                            Explore the Movement
                        </Link>
                    </div>
                </section>

                {/* Story Section */}
                <section className={styles.storySection}>
                    <div className={styles.storyContent}>
                        <h2>Our Story & Mission</h2>
                        <p>
                            From city streets to the global stage, urbanNxt is more than a brand—it's an identity for the modern creator. Founded in the heart of the concrete jungle, we saw a need for apparel that matched the durability and dynamism of urban life.
                        </p>
                        <p>
                            We believe that what you wear should be an extension of your creative voice. Every stitch is a tribute to the architects of culture—the musicians, the muralists, and the dreamers.
                        </p>
                    </div>

                    <div className={styles.storyImages}>
                        <div className={styles.imgMain}>
                            <img
                                src="https://images.unsplash.com/photo-1520975912103-1c2fb441b3e8?q=80&w=800&auto=format&fit=crop"
                                alt="workspace"
                            />
                        </div>
                        <div className={styles.imgSub}>
                            <img
                                src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?q=80&w=800&auto=format&fit=crop"
                                alt="mural"
                            />
                        </div>
                    </div>
                </section>

                {/* Stats Bar */}
                <section className={styles.statsBar}>
                    <div className={styles.stat}>
                        <div className={styles.statVal}>10k+</div>
                        <div className={styles.statLabel}>Community Members</div>
                    </div>
                    <div className={styles.stat}>
                        <div className={styles.statVal}>100%</div>
                        <div className={styles.statLabel}>Organic Materials</div>
                    </div>
                    <div className={styles.stat}>
                        <div className={styles.statVal}>24</div>
                        <div className={styles.statLabel}>Cities Worldwide</div>
                    </div>
                    <div className={styles.stat}>
                        <div className={styles.statVal}>0</div>
                        <div className={styles.statLabel}>Plastic Packaging</div>
                    </div>
                </section>

                {/* Responsibility Section */}
                <section className={styles.respSection}>
                    <div className={styles.eyebrow}>RESPONSIBILITY</div>
                    <h2>The Eco-Nxt Standard</h2>
                    <p className={styles.desc}>
                        Fashion shouldn't cost the Earth. We are committed to a sustainable circular economy that respects our planet and its people.
                    </p>

                    <div className={styles.features}>
                        <div className={styles.featureCard}>
                            <div className={styles.featureTitle}>Ethical sourcing</div>
                            <p>We only partner with manufacturers who provide living wages and use GOTS-certified 100% organic cotton.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureTitle}>Zero-waste packaging</div>
                            <p>Your gear arrives in compostable, water-soluble, or fully recycled materials. No plastic, no compromise.</p>
                        </div>
                        <div className={styles.featureCard}>
                            <div className={styles.featureTitle}>Slow fashion</div>
                            <p>We design for longevity, not trends. Durable, timeless pieces built to be worn for years, not weeks.</p>
                        </div>
                    </div>
                </section>

                {/* Newsletter CTA */}
                <section className={styles.newsCTA}>
                    <div className={styles.ctaInner}>
                        <div className={styles.ctaCopy}>
                            <h3>Be part of the movement.</h3>
                            <p>Join a community of over 10,000 creators. Get early access to limited drops, behind-the-scenes content, and exclusive event invites.</p>
                        </div>
                        <form className={styles.ctaForm} onSubmit={(e) => { e.preventDefault(); showToast({ message: 'Thanks for joining. We will be in touch.', type: 'success' }); }}>
                            <input type="email" placeholder="Enter your email" required />
                            <button type="submit">Join Now</button>
                        </form>
                    </div>
                </section>
            </div>
        </>
    );
}
