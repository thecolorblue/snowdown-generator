"use client";

import React, { useState } from 'react';

const SDApplicationBar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const toggleUserMenu = () => {
    setIsUserMenuOpen(!isUserMenuOpen);
  };

  return (
    <div className="flex items-center justify-between p-4 border-b bg-white shadow-sm">
      {/* Menu button (left aligned) */}
      <div className="flex items-center">
        <button 
          onClick={toggleMenu}
          className="p-2 rounded hover:bg-gray-100"
          aria-label="Open menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </div>

      {/* App name (centered) */}
      <h1 className="text-xl font-bold">snowdown</h1>

      {/* User account icon (right aligned) */}
      <div className="flex items-center">
        <button 
          onClick={toggleUserMenu}
          className="p-2 rounded hover:bg-gray-100"
          aria-label="User menu"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.75A9 9 0 017.5 18a9 9 0 01-3.462-1.578M17.982 18.75a9 9 0 01-10.462 0M7.5 18a9 9 0 01-3.462-1.578M17.982 18.75a9 9 0 01-10.462 0M7.5 18a9 9 0 01-3.462-1.578" />
          </svg>
        </button>
      </div>

      {/* Menu dropdown */}
      {isMenuOpen && (
        <div className="absolute top-16 left-4 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
          <button 
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              console.log('Open document clicked');
              setIsMenuOpen(false);
            }}
          >
            Open document
          </button>
          <button 
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              console.log('Save current document clicked');
              setIsMenuOpen(false);
            }}
          >
            Save current document
          </button>
          <button 
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={() => {
              console.log('Share link clicked');
              setIsMenuOpen(false);
            }}
          >
            Share link
          </button>
        </div>
      )}

      {/* User menu dropdown */}
      {isUserMenuOpen && (
        <div className="absolute top-16 right-4 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 ring-1 ring-black ring-opacity-5">
          <div className="px-4 py-2 text-sm text-gray-700">
            user@example.com
          </div>
          <div className="px-4 py-2 text-sm text-gray-500">
            Account created: Jan 1, 2023
          </div>
        </div>
      )}
    </div>
  );
};

export default SDApplicationBar;