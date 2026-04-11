import { useNavigate } from "react-router-dom";

export default function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 2rem", fontFamily: "Inter, sans-serif", color: "#1e293b" }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginBottom: "2rem", fontSize: "0.9rem" }}
      >
        &larr; Back
      </button>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Privacy Policy</h1>
      <p style={{ color: "#64748b", marginBottom: "2rem" }}>Last updated: {new Date().toLocaleDateString()}</p>

      <Section title="1. Information We Collect">
        We collect information you provide directly: name, email address, and account credentials. When you connect Gmail, we access your email metadata and content solely for detecting job-related emails. We also collect usage data (pages visited, features used) for improving the Service.
      </Section>

      <Section title="2. How We Use Your Information">
        We use your data to: provide and maintain the Service, sync and extract job applications from your email, generate AI-powered content, send transactional emails, and improve the Service. We never sell your personal data to third parties.
      </Section>

      <Section title="3. Email Data">
        When you connect Gmail, we request read-only access (gmail.readonly scope). We only process emails that match job-related patterns. Email content is sanitized to remove PII before being sent to AI services. You can disconnect Gmail at any time.
      </Section>

      <Section title="4. AI Processing">
        Job descriptions and application data may be sent to Google Gemini for AI features (extraction, cover letters, interview prep). All data is sanitized through our Data Loss Prevention system before transmission. We do not use your data to train AI models.
      </Section>

      <Section title="5. Data Storage and Security">
        Data is stored in secure databases with encryption at rest. OAuth tokens are encrypted using AES-256-GCM. Passwords are hashed with bcrypt. We support MFA for additional account security. Access tokens are stored in memory only, never in local storage.
      </Section>

      <Section title="6. Third-Party Services">
        We use: Google OAuth for authentication, Google Gmail API for email sync, Google Gemini for AI features, Stripe for payment processing, and SMTP providers for transactional emails. Each provider has their own privacy policy.
      </Section>

      <Section title="7. Data Retention">
        We retain your data for as long as your account is active. Upon account deletion, we delete your personal data within 30 days. Anonymized analytics data may be retained longer.
      </Section>

      <Section title="8. Your Rights">
        You have the right to: access your data, correct inaccurate data, delete your account and associated data, export your data, and opt out of non-essential communications.
      </Section>

      <Section title="9. Cookies">
        We use essential cookies only: authentication session cookies (httpOnly, secure, SameSite=strict). We do not use advertising or tracking cookies.
      </Section>

      <Section title="10. Children">
        The Service is not intended for users under 18. We do not knowingly collect data from minors.
      </Section>

      <Section title="11. Changes to This Policy">
        We will notify you of significant changes via email or in-app notification. Continued use after changes constitutes acceptance.
      </Section>

      <Section title="12. Contact">
        For privacy inquiries, contact us at privacy@jobsearchhub.com.
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: "2rem" }}>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 600, marginBottom: "0.5rem" }}>{title}</h2>
      <p style={{ color: "#475569", lineHeight: 1.7, fontSize: "0.95rem" }}>{children}</p>
    </div>
  );
}
