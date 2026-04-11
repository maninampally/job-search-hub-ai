import { useNavigate } from "react-router-dom";
import { BACKEND_URL } from "../api/backend";
import styles from "./LandingPage.module.css";

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["10 job applications", "Basic tracking", "Email support"],
    cta: "Get Started",
    tier: "free",
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    popular: true,
    features: [
      "Unlimited applications",
      "Gmail auto-sync",
      "AI job extraction",
      "Kanban board",
      "Analytics dashboard",
      "Priority support",
    ],
    cta: "Start Free Trial",
    tier: "pro",
  },
  {
    name: "Elite",
    price: "$24",
    period: "/month",
    features: [
      "Everything in Pro",
      "AI cover letter writer",
      "AI interview coach",
      "Multi-inbox sync",
      "Advanced analytics",
      "VIP support",
    ],
    cta: "Start Free Trial",
    tier: "elite",
  },
];

const FEATURES = [
  {
    title: "Smart Email Sync",
    desc: "Automatically detect job applications from your Gmail inbox using AI.",
    icon: "\u2709",
  },
  {
    title: "Kanban Pipeline",
    desc: "Drag and drop jobs through your pipeline - Applied, Interview, Offer, and more.",
    icon: "\u2630",
  },
  {
    title: "AI Cover Letters",
    desc: "Generate tailored cover letters in seconds using Google Gemini AI.",
    icon: "\u270D",
  },
  {
    title: "Interview Coach",
    desc: "Get AI-powered practice questions and feedback for your next interview.",
    icon: "\u{1F393}",
  },
  {
    title: "Smart Reminders",
    desc: "Never miss a follow-up. Get nudged when a job goes quiet for too long.",
    icon: "\u23F0",
  },
  {
    title: "Analytics",
    desc: "Track your funnel, response rates, and application velocity over time.",
    icon: "\u{1F4CA}",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.landing}>
      {/* Nav */}
      <nav className={styles.nav}>
        <div className={styles.navInner}>
          <div className={styles.logo}>Job Search Hub</div>
          <div className={styles.navLinks}>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <button className={styles.loginBtn} onClick={() => navigate("/login")}>
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>
          Land Your Dream Job,<br />Faster.
        </h1>
        <p className={styles.heroSubtitle}>
          The all-in-one command center for your job search.
          Track applications, sync Gmail, get AI-powered cover letters and interview prep.
        </p>
        <div className={styles.heroCtas}>
          <button className={styles.primaryCta} onClick={() => navigate("/login")}>
            Get Started Free
          </button>
          <button
            type="button"
            className={styles.googleHeroCta}
            onClick={() => {
              window.location.assign(`${BACKEND_URL}/auth/google`);
            }}
          >
            Continue with Google
          </button>
          <a href="#features" className={styles.secondaryCta}>
            See Features
          </a>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={styles.features}>
        <h2 className={styles.sectionTitle}>Everything you need to manage your job search</h2>
        <div className={styles.featuresGrid}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.featureCard}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <h3 className={styles.featureTitle}>{f.title}</h3>
              <p className={styles.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className={styles.pricing}>
        <h2 className={styles.sectionTitle}>Simple, transparent pricing</h2>
        <p className={styles.pricingSubtitle}>Start free. Upgrade when you are ready.</p>
        <div className={styles.pricingGrid}>
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`${styles.pricingCard} ${plan.popular ? styles.popular : ""}`}
            >
              {plan.popular && <div className={styles.popularBadge}>Most Popular</div>}
              <h3 className={styles.planName}>{plan.name}</h3>
              <div className={styles.planPrice}>
                <span className={styles.amount}>{plan.price}</span>
                <span className={styles.period}>{plan.period}</span>
              </div>
              <ul className={styles.planFeatures}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <button
                className={plan.popular ? styles.primaryCta : styles.outlineCta}
                onClick={() => navigate("/login")}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <div className={styles.logo}>Job Search Hub</div>
            <p className={styles.footerTagline}>Your career command center.</p>
          </div>
          <div className={styles.footerLinks}>
            <a href="/terms">Terms of Service</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/login">Sign In</a>
          </div>
          <p className={styles.copyright}>&copy; {new Date().getFullYear()} Job Search Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
