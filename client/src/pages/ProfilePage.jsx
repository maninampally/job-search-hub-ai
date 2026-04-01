import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { updateMyProfile, changePassword } from "../api/backend";

export default function ProfilePage() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    headline: "",
    location: "",
    bio: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState("");
  const [pwError, setPwError] = useState("");

  useEffect(() => {
    setForm({
      name: user?.name || "",
      headline: user?.headline || "",
      location: user?.location || "",
      bio: user?.bio || "",
    });
  }, [user]);

  function handleInput(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    try {
      await updateMyProfile(form);
      await refreshUser();
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err.message || "Unable to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(event) {
    event.preventDefault();
    setPwError("");
    setPwMessage("");
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setPwMessage("Password changed successfully.");
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setPwError(err.message || "Unable to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-header">
          <div>
            <h1>My Profile</h1>
            <p>Manage your account details used in Job Search Hub.</p>
          </div>
          <div className="profile-actions">
            <Link to="/dashboard">Back to Dashboard</Link>
            <button type="button" onClick={handleLogout}>Logout</button>
          </div>
        </div>

        <form className="profile-form" onSubmit={handleSave}>
          <label>
            Email
            <input type="email" value={user?.email || ""} disabled />
          </label>

          <label>
            Full Name
            <input
              type="text"
              value={form.name}
              onChange={(event) => handleInput("name", event.target.value)}
              required
            />
          </label>

          <label>
            Headline
            <input
              type="text"
              value={form.headline}
              onChange={(event) => handleInput("headline", event.target.value)}
              placeholder="Data Engineer | Analytics | ML"
            />
          </label>

          <label>
            Location
            <input
              type="text"
              value={form.location}
              onChange={(event) => handleInput("location", event.target.value)}
              placeholder="City, State"
            />
          </label>

          <label>
            Bio
            <textarea
              value={form.bio}
              onChange={(event) => handleInput("bio", event.target.value)}
              rows={4}
              placeholder="Share your career summary"
            />
          </label>

          {error && <div className="auth-error">{error}</div>}
          {message && <div className="auth-success">{message}</div>}

          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </form>

        <form className="profile-form" onSubmit={handleChangePassword} style={{ marginTop: "2rem", borderTop: "1px solid var(--slate-200)", paddingTop: "2rem" }}>
          <h2 style={{ marginBottom: "1rem" }}>Change Password</h2>
          <label>
            Current Password
            <input
              type="password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, currentPassword: e.target.value }))}
              required
            />
          </label>
          <label>
            New Password
            <input
              type="password"
              value={pwForm.newPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, newPassword: e.target.value }))}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>
          <label>
            Confirm New Password
            <input
              type="password"
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              placeholder="Repeat new password"
              minLength={8}
              required
            />
          </label>
          {pwError && <div className="auth-error">{pwError}</div>}
          {pwMessage && <div className="auth-success">{pwMessage}</div>}
          <button type="submit" disabled={pwSaving}>
            {pwSaving ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
