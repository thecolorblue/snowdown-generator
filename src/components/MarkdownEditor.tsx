"use client"; // Required for Next.js App Router components that use client-side hooks like useState

import React, { useState, useEffect, useCallback, useRef } from "react";
import Editor from "@monaco-editor/react";
import html2canvas from 'html2canvas';

export default function MarkdownEditor() {
  const [value, setValue] = useState(""); // Initialize with empty string
  const [isInitialContentLoaded, setIsInitialContentLoaded] = useState(false);
  const [htmlPreview, setHtmlPreview] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);

  // Fetch initial content from public/latex.md
  useEffect(() => {
    const fetchInitialContent = async () => {
      try {
        const response = await fetch('/latex.md');
        if (!response.ok) {
          throw new Error(`Failed to fetch initial content: ${response.statusText}`);
        }
        const text = await response.text();
        setValue(text);
      } catch (error) {
        console.error("Error fetching initial content:", error);
        setPreviewError(error instanceof Error ? error.message : "Failed to load initial content");
        // Optionally, set a default value or an error message in the editor
        setValue("# Error loading initial content.\n\nPlease check the console for details.");
      } finally {
        setIsInitialContentLoaded(true);
      }
    };

    fetchInitialContent();
  }, []); // Empty dependency array ensures this runs only once on mount

  const handlePrint = async () => {
    if (previewRef.current) {
      const width = previewRef.current.scrollWidth;
      try {
        const computedStyle = getComputedStyle(previewRef.current);
        const backgroundColor = computedStyle.backgroundColor;
        const canvas = await html2canvas(previewRef.current, {
          backgroundColor: backgroundColor || '#ffffff',
          scrollX: -window.scrollX,
          scrollY: -window.scrollY,
          width: width,
          height: width * 1.294,
          logging: true,
          useCORS: true,
          onclone: (document) => {
            // Optional: Modify the cloned document before rendering
          }
        });
        const imgData = canvas.toDataURL('image/png');
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          printWindow.document.write(`
            <html>
              <head>
                <title>Print Preview</title>
                <link rel="stylesheet" type="text/css" href="https://printjs-4de6.kxcdn.com/print.min.css" />
                <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>
                <style>
                  @media print {
                    @page { size: auto; margin: 0mm; }
                    body { margin: 0; width: 100vw; height: 100vh; }
                    img { width: 100%; height: 100%; object-fit: contain; display: block; }
                  }
                  body { margin: 0; display: flex; justify-content: start; align-items: start; min-height: 100vh; background-color: #ffffff; }
                </style>
              </head>
              <body>
                <img src="${imgData}" alt="Print Preview" />
                <script>
                  window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                      window.close();
                    }
                  }
                </script>
              </body>
            </html>
          `);
          printWindow.document.close();
        } else {
          throw new Error("Could not open print window. Please check your browser's pop-up settings.");
        }
      } catch (error) {
        console.error("Error generating image for printing:", error);
        setPreviewError(error instanceof Error ? error.message : "Failed to generate image for printing.");
      }
    }
  };

  const fetchHtmlPreview = useCallback(async (markdown: string) => {
    if (!markdown.trim()) {
      setHtmlPreview("");
      setPreviewError(null);
      setIsLoadingPreview(false);
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
        throw new Error(errorData.error || `Error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setHtmlPreview(data.html);
    } catch (err) {
      console.error("Failed to fetch HTML preview:", err);
      setPreviewError(err instanceof Error ? err.message : "Failed to load preview");
      setHtmlPreview("");
    } finally {
      setIsLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!isInitialContentLoaded) return; // Don't fetch preview until initial content is loaded

    const handler = setTimeout(() => {
      fetchHtmlPreview(value);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [value, fetchHtmlPreview, isInitialContentLoaded]);

  const handleChange = (newValue: string | undefined) => {
    setValue(newValue || "");
  };

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
    padding: '20px',
    position: 'relative',
    backgroundColor: '#f9f9f9',
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
    whiteSpace: 'pre-wrap',
    padding: '10px',
    border: '1px solid red',
    backgroundColor: '#ffebeb',
  };

  if (!isInitialContentLoaded) {
    return <div style={loadingOverlayStyle}>Loading editor content...</div>;
  }

  return (
    <div style={{ display: 'flex', gap: '20px', padding: '20px', height: 'calc(100vh - 40px)' }}>
      <div style={{ flex: 1, overflow: 'auto', height: '100%' }}>
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={value}
          onChange={handleChange}
          options={{
            minimap: { enabled: false },
            wordWrap: "on",
            scrollBeyondLastLine: false,
            fontSize: 14,
            fontFamily: "monospace",
            automaticLayout: true,
          }}
        />
      </div>
      <div style={previewContainerStyle}>
        <button
          onClick={handlePrint}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '8px 12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 1000,
          }}
        >
          Print
        </button>
        {isLoadingPreview && <div style={loadingOverlayStyle}>Loading Preview...</div>}
        {previewError && <div style={errorStyle}>Error: {previewError}</div>}
        <div
          ref={previewRef}
          dangerouslySetInnerHTML={{ __html: htmlPreview }}
          style={{
            minHeight: '100px',
            wordWrap: 'break-word',
          }}
        />
      </div>
    </div>
  );
}