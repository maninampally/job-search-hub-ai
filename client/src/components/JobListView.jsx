import React, { useState } from 'react';
import { updateJob, uploadResume } from '../api/backend';
import './jobListView.css';

export default function JobListView({ jobs, resumes, onJobUpdate }) {
  const [expandedId, setExpandedId] = useState(null);
  const [uploading, setUploading] = useState({});
  const [error, setError] = useState('');

  // Sort jobs: new to old (by applied date)
  const sortedJobs = [...(jobs || [])].sort((a, b) => {
    const dateA = new Date(a.applied || 0);
    const dateB = new Date(b.applied || 0);
    return dateB - dateA;
  });

  const handleExpandToggle = (jobId) => {
    setExpandedId(expandedId === jobId ? null : jobId);
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

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    // Validate file type
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setError('Only PDF and DOCX files allowed');
      return;
    }

    setUploading(prev => ({ ...prev, [jobId]: true }));
    setError('');

    try {
      await uploadResume(file, file.name, jobId);
      // Refresh job data
      if (onJobUpdate) {
        onJobUpdate();
      }
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'Wishlist': '#7c5a9d',
      'Applied': '#4a90e2',
      'Screening': '#f5a623',
      'Interview': '#9013fe',
      'Offer': '#27ae60',
      'Rejected': '#e74c3c'
    };
    return colors[status] || '#95a5a6';
  };

  const getAttachedResume = (jobId) => {
    return resumes?.find(r => r.linkedJobId === jobId);
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
            </tr>
          </thead>
          <tbody>
            {sortedJobs.map(job => {
              const isExpanded = expandedId === job.id;
              const attachedResume = getAttachedResume(job.id);

              return (
                <React.Fragment key={job.id}>
                  <tr 
                    className={`job-row ${isExpanded ? 'expanded' : ''}`}
                    onClick={() => handleExpandToggle(job.id)}
                  >
                    <td className="col-expand">
                      <span className={`expand-icon ${isExpanded ? 'open' : ''}`}>›</span>
                    </td>
                    <td className="col-company">
                      <strong>{job.company || 'Unknown'}</strong>
                    </td>
                    <td className="col-role">
                      {job.role || 'Unknown Role'}
                    </td>
                    <td className="col-date">
                      {job.applied ? new Date(job.applied).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="col-status">
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(job.status) }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="col-emails">
                      <span className="email-count">{job.emails?.length || 0}</span>
                    </td>
                    <td 
                      className="col-upload"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="upload-btn"
                        onClick={(e) => handleUploadClick(job.id, e)}
                        disabled={uploading[job.id]}
                        title={attachedResume ? `📎 ${attachedResume.name}` : 'Upload resume'}
                      >
                        {uploading[job.id] ? (
                          '⏳'
                        ) : attachedResume ? (
                          '📎'
                        ) : (
                          '📤'
                        )}
                      </button>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="job-details-row">
                      <td colSpan="7">
                        <div className="job-details">
                          <div className="details-grid">
                            <div className="detail-item">
                              <label>Location:</label>
                              <p>{job.location || 'Not specified'}</p>
                            </div>
                            <div className="detail-item">
                              <label>Source:</label>
                              <p>{job.source || 'Unknown'}</p>
                            </div>
                            <div className="detail-item">
                              <label>Status:</label>
                              <p>{job.status}</p>
                            </div>
                            <div className="detail-item">
                              <label>Applied Date:</label>
                              <p>{job.applied ? new Date(job.applied).toLocaleDateString() : 'N/A'}</p>
                            </div>
                          </div>

                          {job.description && (
                            <div className="detail-item full-width">
                              <label>Description:</label>
                              <p>{job.description}</p>
                            </div>
                          )}

                          {job.notes && (
                            <div className="detail-item full-width">
                              <label>Notes:</label>
                              <p>{job.notes}</p>
                            </div>
                          )}

                          {attachedResume && (
                            <div className="detail-item full-width">
                              <label>Attached Resume:</label>
                              <div className="resume-info">
                                <span>📄 {attachedResume.name}</span>
                                <small>({attachedResume.fileSize} bytes)</small>
                              </div>
                            </div>
                          )}

                          <div className="detail-actions">
                            <button 
                              className="btn btn-small btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUploadClick(job.id, e);
                              }}
                            >
                              {attachedResume ? 'Change Resume' : 'Upload Resume'}
                            </button>
                          </div>
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
    </div>
  );
}
