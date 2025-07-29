"use client";
import React, { useState, useEffect, useRef } from 'react';

const HamburgerIcon = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [markdownFiles, setMarkdownFiles] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    // Fetch markdown files
    const fetchMarkdownFiles = async () => {
      try {
        const response = await fetch('/api/markdown-files');
        if (!response.ok) {
          throw new Error('Failed to fetch markdown files');
        }
        const data = await response.json();
        setMarkdownFiles(data.files || []);
      } catch (error) {
        console.error("Error fetching markdown files:", error);
        setMarkdownFiles([]); // Set to empty array on error
      }
    };

    fetchMarkdownFiles();

    // Handle click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggleMenu}
        className="text-xl p-2 hover:bg-gray-700 rounded"
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="menu-button"
        >
          {markdownFiles.length > 0 ? (
            markdownFiles.map((file) => (
              <a
                key={file}
                href={`/?file=${encodeURIComponent(file)}`} // Example link, adjust as needed
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                role="menuitem"
                onClick={() => setIsOpen(false)} // Close menu on item click
              >
                {file.replace('.md', '')}
              </a>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-gray-500">Loading files...</div>
          )}
        </div>
      )}
    </div>
  );
};

export default HamburgerIcon;