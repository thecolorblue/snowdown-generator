"use client"; // Required for Next.js App Router components that use client-side hooks like useState

import React, { useState, useEffect, useCallback } from "react";

export default function MarkdownEditor() {
  const [value, setValue] = useState("**Hello world!!!**\n\nLet's test some KaTeX:\n\n$$E=mc^2$$\n\nAnd a directive:\n\n::my-directive[My Content]\n\n");
  const [htmlPreview, setHtmlPreview] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchHtmlPreview = useCallback(async (markdown: string) => {
    // Do not fetch if markdown is empty or only whitespace,
    // but still clear the preview and error.
    if (!markdown.trim()) {
      setHtmlPreview("");
      setPreviewError(null);
      setIsLoadingPreview(false); // Ensure loading is stopped
      return;
    }
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      console.log(markdown)
      const response = await fetch('/api/markdown', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
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

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  };

  // Basic styles for the textarea and preview
  const editorStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    padding: '10px',
    border: '1px solid #ccc',
    fontFamily: 'monospace',
    fontSize: '14px',
    boxSizing: 'border-box',
    resize: 'none',
  };

  const previewContainerStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    border: '1px solid #ddd',
    padding: '10px',
    position: 'relative',
    backgroundColor: '#f9f9f9', // Light background for preview
  };

  const loadingOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: '10px',
    left: '10px',
    color: '#555',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: '5px 10px',
    borderRadius: '3px',
  };

  const errorStyle: React.CSSProperties = {
    color: 'red',
    whiteSpace: 'pre-wrap', // Important for displaying formatted error messages
    padding: '10px',
    border: '1px solid red',
    backgroundColor: '#ffebeb',
  };

  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px', height: 'calc(100vh - 40px)' }}>
      <div style={{ flex: 1, overflow: 'auto', height: '100%' }}>
        <textarea
          value={value}
          onChange={handleChange}
          style={editorStyle}
          placeholder="Enter Markdown with MDX features..."
        />
      </div>
      <div style={previewContainerStyle}>
        {isLoadingPreview && (
          <div style={loadingOverlayStyle}>Loading preview...</div>
        )}
        {previewError && (
          <div style={errorStyle}>
            <strong>Error rendering preview:</strong>
            <pre>{previewError}</pre>
          </div>
        )}
        {!isLoadingPreview && !previewError && (
          <div dangerouslySetInnerHTML={{ __html: htmlPreview }} style={{ whiteSpace: 'normal' /* Allow normal wrapping */ }} />
        )}
      </div>
    </div>
  );
}