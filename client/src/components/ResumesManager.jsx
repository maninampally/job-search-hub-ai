import { useRef, useState } from 'react';
import { uploadResume, deleteResume, getResumeViewUrl, getResumeDownloadUrl } from '../api/backend';
import styles from './ResumesManager.module.css';

export function ResumesManager({ resumes = [], jobs = [], onRefresh }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!validTypes.includes(selectedFile.type)) {
        setError('Only PDF and DOCX files are supported');
        setFile(null);
        return;
      }

      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
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
      setError('Please enter a name and select a file');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      await uploadResume(file, name, '');
      setSuccess(`"${name}" uploaded successfully!`);
      setName('');
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
    const confirmed = window.confirm('Are you sure you want to delete this resume?');
    if (!confirmed) return;

    try {
      setError(null);
      await deleteResume(resumeId);
      setSuccess('Resume deleted successfully.');
      if (onRefresh) {
        await onRefresh();
      }
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError(err.message || 'Failed to delete resume');
    }
  };

  const handleViewResume = (resumeId) => {
    window.open(getResumeViewUrl(resumeId), '_blank', 'noopener,noreferrer');
  };

  const handleDownloadResume = (resumeId) => {
    window.open(getResumeDownloadUrl(resumeId), '_blank', 'noopener,noreferrer');
  };

  const jobById = new Map((jobs || []).map((job) => [String(job.id), job]));

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>Resume Manager</h1>
          <p>Upload and manage your resumes for different applications</p>
        </div>
      </header>

      {/* Alerts */}
      {error && <div className={`${styles.alert} ${styles.alertError}`}>{error}</div>}
      {success && <div className={`${styles.alert} ${styles.alertSuccess}`}>{success}</div>}

      {/* Upload Card */}
      <div className={styles.uploadCard}>
        <h3 className={styles.uploadTitle}>Upload New Resume</h3>
        <form className={styles.uploadForm} onSubmit={handleUpload}>
          <div className={styles.formGroup}>
            <label className={styles.label}>Resume Name</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Data Engineer Resume"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>File (PDF or DOCX)</label>
            <div className={`${styles.dropzone} ${file ? styles.hasFile : ''}`}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={handleFileSelect}
                className={styles.dropzoneInput}
              />
              {!file ? (
                <>
                  <div className={styles.dropzoneIcon}>
                    <UploadIcon />
                  </div>
                  <div className={styles.dropzoneText}>
                    Click to upload or drag and drop
                  </div>
                  <div className={styles.dropzoneHint}>
                    PDF or DOCX up to 5MB
                  </div>
                </>
              ) : (
                <div className={styles.selectedFile}>
                  <div className={styles.fileIcon}>
                    <FileIcon />
                  </div>
                  <span className={styles.fileName}>{file.name}</span>
                  <button
                    type="button"
                    className={styles.removeFile}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            type="submit"
            className={styles.uploadButton}
            disabled={uploading || !file || !name.trim()}
          >
            {uploading ? 'Uploading...' : 'Upload Resume'}
          </button>
        </form>
      </div>

      {/* Resumes List */}
      <div className={styles.listCard}>
        <div className={styles.listHeader}>
          <h3 className={styles.listTitle}>Your Resumes</h3>
          <span className={styles.countBadge}>{resumes.length}</span>
        </div>

        {resumes.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FileIcon />
            </div>
            <div className={styles.emptyTitle}>No resumes uploaded yet</div>
            <div className={styles.emptyText}>
              Upload your first resume to get started
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {resumes.map((resume) => {
              const linkedId = String(resume.linkedJobId || resume.job_id || '');
              const linkedJob = jobById.get(linkedId);
              const isPdf = resume.mimeType === 'application/pdf';
              const fileSize = formatFileSize(resume.fileSize || 0);

              return (
                <div key={resume.id} className={styles.resumeCard}>
                  <div className={styles.resumeHeader}>
                    <div className={`${styles.resumeIcon} ${!isPdf ? styles.resumeIconDocx : ''}`}>
                      {isPdf ? <PdfIcon /> : <DocxIcon />}
                    </div>
                    <div className={styles.resumeInfo}>
                      <div className={styles.resumeName} title={resume.name}>
                        {resume.name}
                      </div>
                      <div className={styles.resumeMeta}>
                        {isPdf ? 'PDF' : 'DOCX'} - {fileSize}
                      </div>
                    </div>
                  </div>

                  {linkedJob ? (
                    <div className={styles.linkedJob}>
                      <div className={styles.linkedJobIcon}>
                        <BriefcaseIcon />
                      </div>
                      <div className={styles.linkedJobInfo}>
                        <div className={styles.linkedJobCompany}>{linkedJob.company}</div>
                        <div className={styles.linkedJobRole}>{linkedJob.role || linkedJob.title}</div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.noLinkedJob}>Not linked to any job</div>
                  )}

                  <div className={styles.resumeActions}>
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.viewButton}`}
                      onClick={() => handleViewResume(resume.id)}
                    >
                      <EyeIcon />
                      View
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.downloadButton}`}
                      onClick={() => handleDownloadResume(resume.id)}
                    >
                      <DownloadIcon />
                      Download
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionButton} ${styles.deleteButton}`}
                      onClick={() => handleDeleteResume(resume.id)}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Icons
function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function DocxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

export default ResumesManager;
