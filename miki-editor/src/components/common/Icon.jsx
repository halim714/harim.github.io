import React from 'react';

/**
 * Consistent 24x24 icon component to unify stroke, grid and alignment.
 * name: 'folder' | 'doc-plus' | 'paper-plane' | 'pencil'
 */
function Icon({ name, size = 20, className = '', strokeWidth = 2 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    xmlns: 'http://www.w3.org/2000/svg',
    className,
  };

  if (name === 'folder') {
    return (
      <svg {...common}>
        <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === 'doc-plus') {
    return (
      <svg {...common}>
        <path d="M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 3v5a1 1 0 001 1h5" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 11v6m3-3H9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === 'paper-plane') {
    return (
      <svg {...common}>
        <path d="M12 19l9 3-9-18-9 18 9-3m0 0v-8" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === 'pencil') {
    return (
      <svg {...common}>
        <path d="M12 20h9" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16.5 3.5a2.121 2.121 0 113 3L8 18l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === 'trash') {
    return (
      <svg {...common}>
        <path d="M4 7h16" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 11v6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 11v6" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6 7l1 12h10l1-12" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 4h6v2H9z" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return null;
}

export default Icon;






