import { TEMPLATES } from "../../pages/dashboard/templatesData";

export default function TemplatesView({
  TEMPLATES: templatesData,
  templateType,
  templateSearch,
  expandedTemplate,
  archiveSelectedPath,
  archiveLoading,
  archiveFiles,
  archiveContent,
  successText,
  errorText,
  normalizedGlobalSearch,
  onTemplateTypeChange,
  onTemplateSearchChange,
  onTemplateToggle,
  onCopyTemplate,
  onArchivePathChange,
  onLoadArchiveFiles,
  onLoadArchiveContent,
  normalizeTemplateText,
}) {
  // Use passed-in TEMPLATES data or fallback to imported TEMPLATES
  const templates = templatesData || TEMPLATES;
  
  const filteredTemplates = templates.filter((template) => {
    const typeMatch = templateType === "All" ? true : template.type === templateType;
    const searchText = `${template.name || ""} ${template.sub || ""} ${template.body || ""} case ${template.case}`.toLowerCase();
    const searchMatch =
      !templateSearch.trim() || searchText.includes(templateSearch.trim().toLowerCase());
    const globalMatch = !normalizedGlobalSearch || searchText.includes(normalizedGlobalSearch);
    return typeMatch && searchMatch && globalMatch;
  });

  return (
    <section className="module-panel">
      <header className="module-header">
        <div>
          <h1>Templates</h1>
          <p>Browse clean template cards by type, case, and scenario.</p>
        </div>
      </header>

      {successText && <div className="inline-note success">{successText}</div>}
      {errorText && <div className="inline-note error">{errorText}</div>}

      <div className="filters-row">
        <select value={templateType} onChange={(event) => onTemplateTypeChange(event.target.value)}>
          <option value="All">All Types</option>
          <option value="Email">Email</option>
          <option value="LinkedIn">LinkedIn</option>
          <option value="WhatsApp">WhatsApp</option>
        </select>
        <input
          value={templateSearch}
          onChange={(event) => onTemplateSearchChange(event.target.value)}
          placeholder="Search templates"
        />
      </div>

      <div className="templates-grid">
        {filteredTemplates.map((template) => {
          const isExpanded = expandedTemplate === template.id;
          const cleanBody = normalizeTemplateText(template.body || "");
          const typeClass =
            template.type === "Email"
              ? "type-email"
              : template.type === "LinkedIn"
                ? "type-linkedin"
                : "type-whatsapp";

          return (
            <article key={template.id} className="template-card">
              <header>
                <div>
                  <h4>{template.name}</h4>
                  <p className="muted">Case {template.case} · {template.sub}</p>
                  <span className={`chip ${typeClass}`}>{template.type}</span>
                </div>
              </header>

              {template.type === "Email" && template.subject && (
                <p className="muted"><strong>Subject:</strong> {template.subject}</p>
              )}

              <p className="muted">
                {isExpanded ? cleanBody : `${cleanBody.slice(0, 170)}...`}
              </p>

              <div className="control-row">
                <button
                  type="button"
                  onClick={() => onTemplateToggle(template.id)}
                >
                  {isExpanded ? "Collapse" : "Preview"}
                </button>
                <button type="button" onClick={() => onCopyTemplate(template)}>
                  Copy
                </button>
              </div>
            </article>
          );
        })}

        {filteredTemplates.length === 0 && <p className="muted">No templates found for this type.</p>}
      </div>

      <section className="archive-panel">
        <h3>Archive Templates (Exact Content)</h3>
        <p className="muted">Read-only view from archived ZIP data. No edits applied.</p>

        <div className="filters-row">
          <select
            value={archiveSelectedPath}
            onChange={(event) => onArchivePathChange(event.target.value)}
            disabled={archiveLoading || archiveFiles.length === 0}
          >
            {archiveFiles.length === 0 && <option value="">No archive files found</option>}
            {archiveFiles.map((file) => (
              <option key={file.path} value={file.path}>
                {file.path}
              </option>
            ))}
          </select>
          <button type="button" onClick={onLoadArchiveFiles} disabled={archiveLoading}>
            {archiveLoading ? "Loading..." : "Reload Files"}
          </button>
          <button type="button" onClick={onLoadArchiveContent} disabled={!archiveSelectedPath}>
            View Selected File
          </button>
        </div>

        {archiveContent && <pre className="archive-content">{archiveContent}</pre>}
      </section>
    </section>
  );
}
