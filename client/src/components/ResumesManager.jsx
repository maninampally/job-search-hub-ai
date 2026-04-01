import { useRef, useState } from "react";
import { uploadResume, deleteResume, getResumeViewUrl, getResumeDownloadUrl } from "../api/backend";

export function ResumesManager({ resumes = [], jobs = [], onRefresh }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!validTypes.includes(selectedFile.type)) {
        setError("Only PDF and DOCX files are supported");
        setFile(null);
        return;
      }

      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || !name.trim()) {
      setError("Please enter a name and select a file");
      return;
    }

    try {
      setUploading(true);
      setError(null);
      await uploadResume(file, name, "");
      setSuccess(`✓ "${name}" uploaded!`);
      setName("");
      setFile(null);
      fileInputRef.current.value = "";
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteResume = async (resumeId) => {
    const confirmed = window.confirm("Are you sure you want to delete this resume?");
    if (!confirmed) return;

    try {
      setError(null);
      await deleteResume(resumeId);
      setSuccess("Resume deleted successfully.");
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(err.message || "Failed to delete resume");
    }
  };

  const handleViewResume = (resumeId) => {
    window.open(getResumeViewUrl(resumeId), "_blank", "noopener,noreferrer");
  };

  const handleDownloadResume = (resumeId) => {
    window.open(getResumeDownloadUrl(resumeId), "_blank", "noopener,noreferrer");
  };

  const jobById = new Map((jobs || []).map((job) => [String(job.id), job]));

  return (
    <div style={{ width: "100%", maxWidth: "100%", margin: "0", padding: "4px" }}>
      <h1 style={{ marginBottom: "20px" }}>Upload Resume</h1>

      {error && (
        <div style={{
          padding: "12px",
          marginBottom: "20px",
          backgroundColor: "#ffebee",
          color: "#c62828",
          borderRadius: "6px",
          fontSize: "14px"
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: "12px",
          marginBottom: "20px",
          backgroundColor: "#e8f5e9",
          color: "#2e7d32",
          borderRadius: "6px",
          fontSize: "14px"
        }}>
          {success}
        </div>
      )}

      <form onSubmit={handleUpload} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", alignItems: "end" }}>
        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
            Resume Name
          </label>
          <input
            type="text"
            placeholder="e.g., Data Engineer Resume"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              fontSize: "14px",
              boxSizing: "border-box"
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px" }}>
            Select File (PDF or DOCX)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileSelect}
            style={{
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "6px",
              width: "100%",
              boxSizing: "border-box",
              cursor: "pointer"
            }}
          />
          {file && (
            <p style={{ marginTop: "8px", fontSize: "12px", color: "#667eea" }}>
              Selected: {file.name}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={uploading || !file}
          style={{
            padding: "12px",
            backgroundColor: uploading || !file ? "#ccc" : "#667eea",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "600",
            cursor: uploading || !file ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            minHeight: "44px",
          }}
          onMouseEnter={(e) => {
            if (!uploading && file) {
              e.target.style.backgroundColor = "#764ba2";
            }
          }}
          onMouseLeave={(e) => {
            if (!uploading && file) {
              e.target.style.backgroundColor = "#667eea";
            }
          }}
        >
          {uploading ? "Uploading..." : "Upload Resume"}
        </button>
      </form>

      <div style={{ marginTop: "30px" }}>
        <h2 style={{ marginBottom: "12px", fontSize: "18px" }}>Uploaded Resumes ({resumes.length})</h2>
        {resumes.length === 0 ? (
          <p style={{ color: "#666" }}>No resumes uploaded yet.</p>
        ) : (
          <div style={{ border: "1px solid #e0e6f5", borderRadius: "10px", overflowX: "auto", width: "100%" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", tableLayout: "fixed" }}>
              <thead>
                <tr style={{ background: "#eef2ff" }}>
                  <th style={{ textAlign: "left", padding: "12px", fontSize: "13px", width: "38%" }}>Resume</th>
                  <th style={{ textAlign: "left", padding: "12px", fontSize: "13px", width: "18%" }}>Company</th>
                  <th style={{ textAlign: "left", padding: "12px", fontSize: "13px", width: "18%" }}>Role</th>
                  <th style={{ textAlign: "left", padding: "12px", fontSize: "13px", width: "14%" }}>Size</th>
                  <th style={{ textAlign: "center", padding: "12px", fontSize: "13px", width: "12%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resumes.map((resume) => {
                  const linkedId = String(resume.linkedJobId || resume.job_id || "");
                  const linkedJob = jobById.get(linkedId);
                  return (
                    <tr key={resume.id} style={{ borderTop: "1px solid #eef1fb" }}>
                      <td style={{ padding: "12px", color: "#1f2957", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={resume.name}>{resume.name}</td>
                      <td style={{ padding: "12px", color: "#445", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={linkedJob?.company || "-"}>{linkedJob?.company || "-"}</td>
                      <td style={{ padding: "12px", color: "#445", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={linkedJob?.role || "-"}>{linkedJob?.role || "-"}</td>
                      <td style={{ padding: "12px", color: "#667", whiteSpace: "nowrap" }}>{(resume.fileSize || 0).toLocaleString()} bytes</td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={() => handleViewResume(resume.id)}
                            aria-label="View resume"
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "8px",
                              border: "1px solid #d9e1ff",
                              color: "#2f4cdd",
                              background: "#f4f7ff",
                              cursor: "pointer",
                            }}
                          >
                            <span aria-hidden="true">👁</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadResume(resume.id)}
                            aria-label="Download resume"
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "8px",
                              border: "1px solid #d9e1ff",
                              color: "#2f4cdd",
                              background: "#f4f7ff",
                              cursor: "pointer",
                            }}
                          >
                            <span aria-hidden="true">⬇</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteResume(resume.id)}
                            aria-label="Delete resume"
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "8px",
                              border: "1px solid #ffd5d5",
                              color: "#c62828",
                              background: "#fff5f5",
                              cursor: "pointer",
                            }}
                          >
                            <span aria-hidden="true">🗑</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
