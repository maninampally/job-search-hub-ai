import { useNavigate } from "react-router-dom";

export default function TermsPage() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 2rem", fontFamily: "Inter, sans-serif", color: "#1e293b" }}>
      <button
        onClick={() => navigate(-1)}
        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", marginBottom: "2rem", fontSize: "0.9rem" }}
      >
        &larr; Back
      </button>

      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>Terms of Service</h1>
      <p style={{ color: "#64748b", marginBottom: "2rem" }}>Last updated: {new Date().toLocaleDateString()}</p>

      <Section title="1. Acceptance of Terms">
        By accessing or using Job Search Hub, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
      </Section>

      <Section title="2. Description of Service">
        Job Search Hub is a SaaS platform that helps users track job applications, sync emails, and use AI-powered tools for job searching. Features vary by subscription tier (Free, Pro, Elite).
      </Section>

      <Section title="3. Account Registration">
        You must provide accurate and complete information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use the Service.
      </Section>

      <Section title="4. Subscription and Billing">
        Paid plans (Pro and Elite) are billed monthly. You may cancel at any time through the billing portal. Cancellation takes effect at the end of the current billing period. We use Stripe for payment processing. Refunds are handled on a case-by-case basis.
      </Section>

      <Section title="5. Acceptable Use">
        You agree not to: misuse the Service, attempt unauthorized access, upload malicious content, violate applicable laws, or resell access without permission.
      </Section>

      <Section title="6. Data and Privacy">
        Your use of the Service is also governed by our Privacy Policy. We process email data only with your explicit consent and only for the purpose of job application tracking.
      </Section>

      <Section title="7. AI Features">
        AI-generated content (cover letters, interview prep) is provided as-is. We do not guarantee accuracy. You are responsible for reviewing and modifying AI outputs before use.
      </Section>

      <Section title="8. Termination">
        We may suspend or terminate your account if you violate these Terms. You may delete your account at any time through Settings.
      </Section>

      <Section title="9. Limitation of Liability">
        The Service is provided "as is" without warranties. We are not liable for indirect, incidental, or consequential damages arising from your use of the Service.
      </Section>

      <Section title="10. Changes to Terms">
        We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the updated Terms.
      </Section>

      <Section title="11. Contact">
        For questions about these Terms, contact us at support@jobsearchhub.com.
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
