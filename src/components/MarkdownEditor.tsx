"use client"; // Required for Next.js App Router components that use client-side hooks like useState

import React, { useState, useEffect, useCallback } from "react";
import MDEditor from '@uiw/react-md-editor';

// We will no longer use MDEditor.Markdown for preview, so we can remove this.
// const MDEditorMarkdown = React.lazy(() => import('@uiw/react-md-editor').then(mod => ({ default: mod.default.Markdown })));

export default function MarkdownEditor() {
  const [value, setValue] = useState("**Hello world!!!**");
  const [htmlPreview, setHtmlPreview] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchHtmlPreview = useCallback(async (markdown: string) => {
    if (!markdown.trim()) {
      setHtmlPreview("");
      setPreviewError(null);
      return;
    }
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const response = await fetch('/api/markdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }
      const data = await response.json();
      setHtmlPreview(data.html);
    } catch (err) {
      console.error("Failed to fetch HTML preview:", err);
      setPreviewError(err instanceof Error ? err.message : "Failed to load preview");
      setHtmlPreview(""); // Clear previous preview on error
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchHtmlPreview(value);
    }, 500); // Debounce API calls

    return () => {
      clearTimeout(handler);
    };
  }, [value, fetchHtmlPreview]);

  const handleChange = (val?: string) => {
    setValue(val || "");
  };

  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px', height: 'calc(100vh - 40px)' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <MDEditor
          value={value}
          onChange={handleChange}
          height="100%"
          preview="edit" // Show only the editor, not its own preview
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto', border: '1px solid #ddd', padding: '10px', position: 'relative' }}>
        {isLoadingPreview && (
          <div style={{ position: 'absolute', top: '10px', left: '10px', color: '#888' }}>Loading preview...</div>
        )}
        {previewError && (
          <div style={{ color: 'red', whiteSpace: 'pre-wrap' }}>Error: {previewError}</div>
        )}
        {!isLoadingPreview && !previewError && (
          <div dangerouslySetInnerHTML={{ __html: htmlPreview }} style={{ whiteSpace: 'pre-wrap' }} />
        )}
      </div>
    </div>
  );
}