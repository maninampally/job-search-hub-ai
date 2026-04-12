import { useState } from "react";
import { getTemplateArchiveFiles, getTemplateArchiveContent } from "../api/backend";

export function useTemplateActions({ setErrorText, setSuccessText }) {
  const [archiveFiles, setArchiveFiles] = useState([]);
  const [archiveSelectedPath, setArchiveSelectedPath] = useState("");
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveContent, setArchiveContent] = useState("");
  const [copiedTemplateId, setCopiedTemplateId] = useState(null);

  function normalizeTemplateText(text) {
    return (text || "")
      .replace(/â€"/g, "—")
      .replace(/â€™/g, "'")
      .replace(/â€œ/g, "\u201c")
      .replace(/â€/g, "\u201d")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  async function handleCopyTemplate(template) {
    setErrorText("");
    setSuccessText("");

    try {
      const contentToCopy =
        template.type === "Email" && template.subject
          ? `Subject: ${template.subject}\n\n${template.body}`
          : template.body;

      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(contentToCopy);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = contentToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedTemplateId(template.id);
      setTimeout(() => {
        setCopiedTemplateId((current) => (current === template.id ? null : current));
      }, 2000);
      setSuccessText("Template copied to clipboard.");
    } catch {
      setErrorText("Unable to copy template. Please copy manually.");
    }
  }

  async function loadArchiveFiles() {
    setArchiveLoading(true);
    setErrorText("");
    try {
      const payload = await getTemplateArchiveFiles();
      const files = Array.isArray(payload?.files) ? payload.files : [];
      setArchiveFiles(files);
      if (files.length > 0 && !archiveSelectedPath) {
        setArchiveSelectedPath(files[0].path || "");
      }
      if (files.length === 0) {
        setArchiveSelectedPath("");
        setArchiveContent("");
      }
    } catch {
      setArchiveFiles([]);
      setArchiveSelectedPath("");
      setArchiveContent("");
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleLoadArchiveContent() {
    if (!archiveSelectedPath) return;

    setArchiveLoading(true);
    setErrorText("");
    try {
      const payload = await getTemplateArchiveContent(archiveSelectedPath);
      setArchiveContent(payload?.content || "");
    } catch {
      setArchiveContent("");
      setErrorText("Archive content is unavailable right now.");
    } finally {
      setArchiveLoading(false);
    }
  }

  return {
    archiveFiles,
    archiveSelectedPath,
    setArchiveSelectedPath,
    archiveLoading,
    archiveContent,
    copiedTemplateId,
    normalizeTemplateText,
    handleCopyTemplate,
    loadArchiveFiles,
    handleLoadArchiveContent,
  };
}
