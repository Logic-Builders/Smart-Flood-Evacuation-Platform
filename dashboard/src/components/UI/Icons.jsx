import React from 'react';

// Minimal inline line-icon set (24x24, stroke-based) — no external icon
// package, matches the civil-defense visual system instead of emoji.
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const IconOverview = (props) => (
  <svg {...base} {...props}>
    <line x1="4" y1="20" x2="4" y2="12" />
    <line x1="10" y1="20" x2="10" y2="6" />
    <line x1="16" y1="20" x2="16" y2="14" />
    <line x1="21" y1="20" x2="21" y2="9" />
  </svg>
);

export const IconReports = (props) => (
  <svg {...base} {...props}>
    <path d="M9 3.5h6a1 1 0 0 1 1 1V5h1.5A1.5 1.5 0 0 1 19 6.5v14A1.5 1.5 0 0 1 17.5 22h-11A1.5 1.5 0 0 1 5 20.5v-14A1.5 1.5 0 0 1 6.5 5H8v-.5a1 1 0 0 1 1-1Z" />
    <line x1="8.5" y1="11" x2="15.5" y2="11" />
    <line x1="8.5" y1="15" x2="15.5" y2="15" />
    <line x1="8.5" y1="19" x2="12.5" y2="19" />
  </svg>
);

export const IconWeather = (props) => (
  <svg {...base} {...props}>
    <path d="M7 16.5a4 4 0 0 1 .5-7.97A5.5 5.5 0 0 1 18 10a3.5 3.5 0 0 1-.5 6.98" />
    <line x1="9" y1="19" x2="8" y2="21.5" />
    <line x1="13" y1="19" x2="12" y2="21.5" />
    <line x1="17" y1="19" x2="16" y2="21.5" />
  </svg>
);

export const IconDam = (props) => (
  <svg {...base} {...props}>
    <path d="M3 15c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    <path d="M3 19c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    <path d="M5 15V6a1 1 0 0 1 1-1h3l2 3 2-3h3a1 1 0 0 1 1 1v9" />
  </svg>
);

export const IconMap = (props) => (
  <svg {...base} {...props}>
    <polygon points="3 6 9 3.5 15 6 21 3.5 21 18 15 20.5 9 18 3 20.5 3 6" />
    <line x1="9" y1="3.5" x2="9" y2="18" />
    <line x1="15" y1="6" x2="15" y2="20.5" />
  </svg>
);

export const IconSystem = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.24.68.4 1.51.4H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
);

export const IconWarning = (props) => (
  <svg {...base} {...props}>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

export const IconSignOut = (props) => (
  <svg {...base} {...props}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);
