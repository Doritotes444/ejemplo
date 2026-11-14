/**
 * Sistema de Iconografía Vectorial SVG y Logotipo Original (Kairo).
 * Sin dependencias externas, sin emojis. Trazo preciso de 1.75px.
 */

export const BRAND_LOGO_SVG = `
<svg class="brand-logo-svg" width="118" height="28" viewBox="0 0 132 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="32" height="32" rx="6" fill="var(--brand-mark-bg)"/>
  <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="5.25" stroke="var(--brand-mark-border)" stroke-width="1"/>
  <path d="M9 8V24M9 16L17.5 8M13.5 12L20.5 24" stroke="var(--brand-mark-fg)" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter"/>
  <rect x="21.5" y="8" width="2.5" height="6" fill="var(--accent)"/>
  <text x="41" y="21.5" fill="currentColor" font-family="var(--font-sans)" font-size="16" font-weight="700" letter-spacing="0.09em">KAIRO</text>
</svg>
`

export const BRAND_MARK_SVG = `
<svg class="brand-mark-svg" width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="32" height="32" rx="6" fill="var(--brand-mark-bg)"/>
  <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="5.25" stroke="var(--brand-mark-border)" stroke-width="1"/>
  <path d="M9 8V24M9 16L17.5 8M13.5 12L20.5 24" stroke="var(--brand-mark-fg)" stroke-width="2.2" stroke-linecap="square" stroke-linejoin="miter"/>
  <rect x="21.5" y="8" width="2.5" height="6" fill="var(--accent)"/>
</svg>
`

const PATHS = {
  pos: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M2 20h20M7 16v4M17 16v4M7 8h4M7 11h2M14 8h3v3h-3z"/>',
  products: '<path d="M12 3L3 7.5v9L12 21l9-4.5v-9L12 3z"/><path d="M3 7.5L12 12l9-4.5M12 12v9M7.5 5.25l9 4.5"/>',
  lots: '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/>',
  inventory: '<path d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14"/><path d="M2 19h20M8 7h8M8 11h8M8 15h5"/>',
  sales: '<path d="M4 3h16v18l-2.67-1.8L14.67 21 12 19.2 9.33 21 6.67 19.2 4 21V3z"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 19c0-3.1 2.7-5.5 6-5.5s6 2.4 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14c2.5.3 4.5 2.1 4.5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/>',
  barcode: '<path d="M3 5v14M6 5v14M10 5v14M13 5v14M17 5v14M21 5v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  edit: '<path d="M16.5 3.5l4 4L8 20H4v-4L16.5 3.5z"/><path d="M14 6l4 4"/>',
  check: '<path d="M4.5 12.5l5 5 10-10"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 3L2 20h20L12 3z"/><path d="M12 9v5M12 17h.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77"/>',
  moon: '<path d="M20.5 14.5A8.5 8.5 0 019.5 3.5a8.5 8.5 0 1011 11z"/>',
  printer: '<path d="M6 8V3h12v5"/><rect x="3" y="8" width="18" height="8" rx="1.5"/><path d="M6 13h12v8H6v-8z"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  shield: '<path d="M12 3l8 3.5v5.5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6.5L12 3z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  filter: '<path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/>',
  refresh: '<path d="M20 11a8 8 0 00-14.5-4.5L3 9"/><path d="M3 4v5h5"/><path d="M4 13a8 8 0 0014.5 4.5L21 15"/><path d="M21 20v-5h-5"/>',
  camera: '<path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/>',
  trending: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  store: '<path d="M3 9l2-5h14l2 5"/><path d="M3 9c0 1.66 1.34 3 3 3s3-1.34 3-3c0 1.66 1.34 3 3 3s3-1.34 3-3c0 1.66 1.34 3 3 3s3-1.34 3-3"/><path d="M5 12v8h14v-8"/><path d="M10 15h4v5h-4z"/>',
  cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 11.5a2 2 0 002 1.5h9.4a2 2 0 001.9-1.4L23 6H6"/>',
}

export function icon(name, size = 16, className = '') {
  const content = PATHS[name] || PATHS.pos
  return `<svg class="svg-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`
}
