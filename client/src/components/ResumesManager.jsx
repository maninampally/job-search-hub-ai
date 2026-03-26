import { useRef, useState } from "react";
import { uploadResume } from "../api/backend";

export function ResumesManager() {
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
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", padding: "20px" }}>
      <h1 style={{ marginBottom: "30px", textAlign: "center" }}>Upload Resume</h1>

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

      <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
            transition: "all 0.2s"
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
    </div>
  );
}
