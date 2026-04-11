import React, { useEffect, useState } from 'react';
import { uploadResume, updateJob, getResumeViewUrl, getResumeDownloadUrl } from '../api/backend';
import EmailLogTab from './EmailLogTab';
import TimelineTab from './TimelineTab';
import './jobListView.css';

const EMAIL_TYPE_CLASS = {
  "Application Confirmation": "email-type-application",
  "Recruiter Outreach": "email-type-recruiter",
  "Interview Scheduled": "email-type-interview",
  Rejection: "email-type-rejection",
  Offer: "email-type-offer",
  "Auto / Tracking": "email-type-auto",
};

function formatEmailDate(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString();
}

function getEmailTypeClass(type) {
  return EMAIL_TYPE_CLASS[type] || "email-type-auto";
}

const JOB_STATUS_OPTIONS = ["Wishlist", "Applied", "Screening", "Interview", "Offer", "Rejected"];

export default function JobListView({ jobs, resumes, onJobUpdate, onDeleteJob }) {
  const [expandedId, setExpandedId] = useState(null);
  const [activeJobTab, setActiveJobTab] = useState({});
  const [uploading, setUploading] = useState({});
  const [error, setError] = useState('');
  const [activeMenuJobId, setActiveMenuJobId] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, openUp: false });
  const [previewResume, setPreviewResume] = useState(null);
  const [editingJobId, setEditingJobId] = useState(null);
  const [inlineEditForm, setInlineEditForm] = useState({
    company: '',
    role: '',
    status: 'Applied',
    appliedDate: '',
    location: '',
    notes: '',
  });

  useEffect(() => {
    const closeMenu = () => setActiveMenuJobId(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const closeMenu = () => setActiveMenuJobId(null);
    window.addEventListener('resize', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    return () => {
      window.removeEventListener('resize', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, []);

  const sortedJobs = [...(jobs || [])].sort((a, b) => {
    const dateA = new Date(a.appliedDate || a.applied || 0);
    const dateB = new Date(b.appliedDate || b.applied || 0);
    return dateB - dateA;
  });

  const handleExpandToggle = (jobId) => {
    if (expandedId === jobId) {
      setExpandedId(null);
      setEditingJobId((eid) => (eid === jobId ? null : eid));
    } else {
      setExpandedId(jobId);
    }
  };

  const handleUploadClick = async (jobId, event) => {
    event.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.docx';
    input.onchange = (e) => handleFileUpload(jobId, e);
    input.click();
  };

  const handleFileUpload = async (jobId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setError('Only PDF and DOCX files allowed');
      return;
    }

    setUploading((prev) => ({ ...prev, [jobId]: true }));
    setError('');

    try {
      await uploadResume(file, file.name, jobId);
      if (onJobUpdate) {
        await onJobUpdate();
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading((prev) => ({ ...prev, [jobId]: false }));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      Wishlist: '#7c5a9d',
      Applied: '#4a90e2',
      Screening: '#f5a623',
      Interview: '#9013fe',
      Offer: '#27ae60',
      Rejected: '#e74c3c',
    };
    return colors[status] || '#95a5a6';
  };

  const getAttachedResume = (jobId) => {
    const targetId = String(jobId || '');
    return resumes?.find((r) => String(r?.linkedJobId ?? r?.job_id ?? r?.jobId ?? '') === targetId);
  };

  const openMenu = (jobId, event) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 180;
    const estimatedMenuHeight = 110;
    const openUp = rect.bottom + estimatedMenuHeight > window.innerHeight - 8;
    const left = Math.min(Math.max(8, rect.right - menuWidth), window.innerWidth - menuWidth - 8);
    const top = openUp ? Math.max(8, rect.top - estimatedMenuHeight - 8) : rect.bottom + 8;
    setMenuPosition({ top, left, openUp });
    setActiveMenuJobId((current) => (current === jobId ? null : jobId));
  };

  const openResumePreview = (resume, event) => {
    event.stopPropagation();
    setPreviewResume(resume);
  };

  const closeResumePreview = () => {
    setPreviewResume(null);
  };

  const handleDelete = async (jobId, event) => {
    event.stopPropagation();
    setActiveMenuJobId(null);
    const isConfirmed = window.confirm('Are you sure you want to delete this job?');
    if (!isConfirmed) return;
    if (onDeleteJob) {
      await onDeleteJob(jobId);
    }
  };

  const handleEdit = (job, event) => {
    if (event?.stopPropagation) event.stopPropagation();
    setActiveMenuJobId(null);
    setExpandedId(job.id);
    setEditingJobId(job.id);
    setActiveJobTab((prev) => ({ ...prev, [job.id]: 'Summary' }));
    setInlineEditForm({
      company: job.company || '',
      role: job.role || '',
      status: job.status || 'Wishlist',
      appliedDate: (job.appliedDate || job.applied || '').toString().slice(0, 10),
      location: job.location || '',
      notes: job.notes || '',
    });
  };

  const handleInlineInput = (field, value) => {
    setInlineEditForm((current) => ({ ...current, [field]: value }));
  };

  const cancelInlineEdit = () => {
    setEditingJobId(null);
  };

  const saveInlineEdit = async (jobId) => {
    setError('');
    if (!inlineEditForm.company.trim() || !inlineEditForm.role.trim()) {
      setError('Company and role are required.');
      return;
    }

    const payload = {
      company: inlineEditForm.company.trim(),
      role: inlineEditForm.role.trim(),
      status: inlineEditForm.status,
      appliedDate: inlineEditForm.appliedDate || null,
      location: inlineEditForm.location.trim(),
      notes: inlineEditForm.notes.trim(),
    };

    try {
      await updateJob(jobId, payload);
      if (onJobUpdate) {
        await onJobUpdate();
      }
      setEditingJobId(null);
    } catch (err) {
      setError(err.message || 'Unable to update job');
    }
  };

  return (
    <div className="job-list-view">
      {error && (
        <div className="list-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <div className="list-table-wrapper">
        <table className="jobs-table">
          <thead>
            <tr>
              <th className="col-expand"></th>
              <th className="col-company">Company</th>
              <th className="col-role">Role</th>
              <th className="col-date">Date Applied</th>
              <th className="col-status">Status</th>
              <th className="col-emails">Emails</th>
              <th className="col-upload">Document</th>
              <th className="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map((job) => {
              const isExpanded = expandedId === job.id;
              const attachedResume = getAttachedResume(job.id);

              return (
                <React.Fragment key={job.id}>
                  <tr className={`job-row ${isExpanded ? 'expanded' : ''}`} onClick={() => handleExpandToggle(job.id)}>
                    <td className="col-expand">
                      <span className={`expand-icon ${isExpanded ? 'open' : ''}`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </td>
                    <td className="col-company">
                      <strong>{job.company || 'Unknown'}</strong>
                    </td>
                    <td className="col-role">{job.role || 'Unknown Role'}</td>
                    <td className="col-date">
                      {job.appliedDate || job.applied ? new Date(job.appliedDate || job.applied).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="col-status">
                      <span className="status-badge" style={{ backgroundColor: getStatusColor(job.status) }}>
                        {job.status}
                      </span>
                    </td>
                    <td className="col-emails">
                      <span className="email-count">{job.emails?.length || 0}</span>
                    </td>
                    <td className="col-upload" onClick={(e) => e.stopPropagation()}>
                      <div className="document-cell">
                        {attachedResume ? (
                          <button className="doc-icon-btn" onClick={(e) => openResumePreview(attachedResume, e)} title={`View resume: ${attachedResume.name}`}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M1.5 12C3.6 7.8 7.4 5.5 12 5.5C16.6 5.5 20.4 7.8 22.5 12C20.4 16.2 16.6 18.5 12 18.5C7.4 18.5 3.6 16.2 1.5 12Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                            </svg>
                          </button>
                        ) : (
                          <button className="doc-icon-btn" onClick={(e) => handleUploadClick(job.id, e)} disabled={uploading[job.id]} title="Upload resume">
                            {uploading[job.id] ? (
                              '...'
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M12 16V5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M8 9L12 5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M4 19H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            )}
                          </button>
                        )}
                        <div className="document-text">
                          {attachedResume ? null : (
                            <span className="file-state-text file-state-empty">No file</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="actions-wrap">
                        <button
                          type="button"
                          className="actions-trigger"
                          onClick={(e) => openMenu(job.id, e)}
                          aria-label="Open job actions"
                          title="More actions"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="5" cy="12" r="1.8" fill="currentColor" />
                            <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                            <circle cx="19" cy="12" r="1.8" fill="currentColor" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="job-details-row">
                      <td colSpan="8">
                        <div className="job-details">
                          <div className="tabs-header">
                            {['Summary', 'Email Log', 'Timeline'].map((tab) => (
                              <button
                                key={tab}
                                type="button"
                                className={`tab-button ${(activeJobTab[job.id] || 'Summary') === tab ? 'active' : ''}`}
                                onClick={() => setActiveJobTab((prev) => ({ ...prev, [job.id]: tab }))}
                              >
                                {tab}
                              </button>
                            ))}
                          </div>

                          {(activeJobTab[job.id] || 'Summary') === 'Summary' && (
                            <>
                              <div className="details-grid">
                                {editingJobId === job.id ? (
                                  <>
                                    <div className="detail-item">
                                      <label htmlFor={`co-${job.id}`}>Company</label>
                                      <input
                                        id={`co-${job.id}`}
                                        value={inlineEditForm.company}
                                        onChange={(e) => handleInlineInput('company', e.target.value)}
                                        placeholder="Company *"
                                      />
                                    </div>
                                    <div className="detail-item">
                                      <label htmlFor={`role-${job.id}`}>Role</label>
                                      <input
                                        id={`role-${job.id}`}
                                        value={inlineEditForm.role}
                                        onChange={(e) => handleInlineInput('role', e.target.value)}
                                        placeholder="Role *"
                                      />
                                    </div>
                                    <div className="detail-item">
                                      <label htmlFor={`st-${job.id}`}>Status</label>
                                      <select
                                        id={`st-${job.id}`}
                                        value={inlineEditForm.status}
                                        onChange={(e) => handleInlineInput('status', e.target.value)}
                                      >
                                        {JOB_STATUS_OPTIONS.map((s) => (
                                          <option key={s} value={s}>{s}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="detail-item">
                                      <label htmlFor={`dt-${job.id}`}>Applied date</label>
                                      <input
                                        id={`dt-${job.id}`}
                                        type="date"
                                        value={inlineEditForm.appliedDate}
                                        onChange={(e) => handleInlineInput('appliedDate', e.target.value)}
                                      />
                                    </div>
                                    <div className="detail-item">
                                      <label htmlFor={`loc-${job.id}`}>Location</label>
                                      <input
                                        id={`loc-${job.id}`}
                                        value={inlineEditForm.location}
                                        onChange={(e) => handleInlineInput('location', e.target.value)}
                                        placeholder="Location"
                                      />
                                    </div>
                                    <div className="detail-item">
                                      <label>Source</label>
                                      <p>{job.source || 'Unknown'}</p>
                                    </div>
                                    <div className="detail-item full-width">
                                      <label htmlFor={`notes-${job.id}`}>Notes</label>
                                      <textarea
                                        id={`notes-${job.id}`}
                                        value={inlineEditForm.notes}
                                        onChange={(e) => handleInlineInput('notes', e.target.value)}
                                        placeholder="Notes"
                                        rows={3}
                                      />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="detail-item">
                                      <label>Company</label>
                                      <p>{job.company || 'Unknown'}</p>
                                    </div>
                                    <div className="detail-item">
                                      <label>Role</label>
                                      <p>{job.role || 'Unknown Role'}</p>
                                    </div>
                                    <div className="detail-item">
                                      <label>Location</label>
                                      <p>{job.location || 'Not specified'}</p>
                                    </div>
                                    <div className="detail-item">
                                      <label>Source</label>
                                      <p>{job.source || 'Unknown'}</p>
                                    </div>
                                    <div className="detail-item">
                                      <label>Status</label>
                                      <p>{job.status}</p>
                                    </div>
                                    <div className="detail-item">
                                      <label>Applied date</label>
                                      <p>{job.appliedDate || job.applied ? new Date(job.appliedDate || job.applied).toLocaleDateString() : 'N/A'}</p>
                                    </div>
                                    {job.notes ? (
                                      <div className="detail-item full-width">
                                        <label>Notes</label>
                                        <p>{job.notes}</p>
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </div>

                              {attachedResume && (
                                <div className="detail-item full-width resume-detail-block">
                                  <label>Attached resume</label>
                                  <div className="resume-info">
                                    <span>{attachedResume.name}</span>
                                    <small>({attachedResume.fileSize} bytes)</small>
                                    <button type="button" className="btn btn-small" onClick={(e) => openResumePreview(attachedResume, e)}>
                                      Preview
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="detail-actions">
                                {editingJobId === job.id ? (
                                  <>
                                    <button type="button" className="btn btn-small btn-primary" onClick={() => saveInlineEdit(job.id)}>
                                      Save
                                    </button>
                                    <button type="button" className="btn btn-small" onClick={cancelInlineEdit}>
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button type="button" className="btn btn-small btn-outline" onClick={(e) => handleEdit(job, e)}>
                                      Edit details
                                    </button>
                                    <button className="btn btn-small btn-primary" onClick={(e) => handleUploadClick(job.id, e)}>
                                      {attachedResume ? 'Change resume' : 'Upload resume'}
                                    </button>
                                    {attachedResume && (
                                      <a
                                        href={getResumeDownloadUrl(attachedResume.id)}
                                        className="btn btn-small"
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Download resume
                                      </a>
                                    )}
                                  </>
                                )}
                              </div>
                            </>
                          )}

                          {activeJobTab[job.id] === 'Email Log' && (
                            <EmailLogTab
                              jobId={job.id}
                              formatEmailDate={formatEmailDate}
                              getEmailTypeClass={getEmailTypeClass}
                            />
                          )}

                          {activeJobTab[job.id] === 'Timeline' && (
                            <TimelineTab jobId={job.id} />
                          )}
                        </div>
                      </td>
                    </tr>
                  )}

                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        {sortedJobs.length === 0 && (
          <div className="empty-state">
            <p>No jobs added yet. Start by creating a new job application!</p>
          </div>
        )}
      </div>

      {activeMenuJobId && (
        <div
          className={`actions-menu actions-menu-floating ${menuPosition.openUp ? 'menu-up' : 'menu-down'}`}
          style={{ top: `${menuPosition.top}px`, left: `${menuPosition.left}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const job = (sortedJobs || []).find((item) => item.id === activeMenuJobId);
            if (!job) return null;
            return (
              <>
                <button type="button" onClick={(e) => handleEdit(job, e)}>Edit Job</button>
                <button type="button" className="danger-item" onClick={(e) => handleDelete(job.id, e)}>
                  Delete Job
                </button>
              </>
            );
          })()}
        </div>
      )}

      {previewResume && (
        <div className="resume-preview-overlay" onClick={closeResumePreview}>
          <div className="resume-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="resume-preview-header">
              <h3>{previewResume.name}</h3>
              <button type="button" onClick={closeResumePreview} aria-label="Close preview">x</button>
            </div>
            <div className="resume-preview-body">
              {previewResume.mimeType === 'application/pdf' ? (
                <iframe
                  title="Resume preview"
                  src={`${getResumeViewUrl(previewResume.id)}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
                />
              ) : (
                <div className="resume-preview-fallback">
                  <p>DOCX preview is not supported in-browser here.</p>
                  <a href={getResumeDownloadUrl(previewResume.id)} target="_blank" rel="noreferrer">
                    Open or download file
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
