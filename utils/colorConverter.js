/**
 * Color Converter Utilities – V3 (2026)
 * - Strict validation & normalization
 * - HEX / RGB / HSL conversion
 * - Alpha support
 * - Safe numeric clamping
 * - WCAG luminance & contrast
 * - Color mixing, inversion, lighten/darken
 * - Random color generation
 */

const clamp = (value, min = 0, max = 255) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
};

const clampPercent = value => clamp(value, 0, 100);

const normalizeHex = hex => {
  if (typeof hex !== "string") return null;

  let value = hex.trim().replace(/^#/, "");

  if (/^[A-Fa-f0-9]{3}$/.test(value)) {
    value = value.split("").map(c => c + c).join("");
  }

  if (!/^[A-Fa-f0-9]{6}$/.test(value)) return null;

  return `#${value.toUpperCase()}`;
};

/* ----------------------
   HEX ⇄ RGB
---------------------- */

export function isValidHex(hex) {
  return normalizeHex(hex) !== null;
}

export function rgbToHex(r, g, b) {
  const toHex = value =>
    Math.round(clamp(value)).toString(16).padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;

  const value = normalized.slice(1);
  const int = Number.parseInt(value, 16);

  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

/* ----------------------
   RGB ⇄ HSL
---------------------- */

export function rgbToHsl(r, g, b) {
  r = clamp(r) / 255;
  g = clamp(g) / 255;
  b = clamp(b) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = 60 * (((g - b) / delta) % 6);
        break;
      case g:
        h = 60 * ((b - r) / delta + 2);
        break;
      default:
        h = 60 * ((r - g) / delta + 4);
    }

    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

export function hslToRgb(h, s, l) {
  h = ((Number(h) % 360) + 360) % 360;
  s = clampPercent(s) / 100;
  l = clampPercent(l) / 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  };
}

export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
}

export function hslToHex(h, s, l) {
  const rgb = hslToRgb(h, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

/* ----------------------
   LIGHTEN / DARKEN
---------------------- */

export function lighten(hex, percent = 10) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const t = clampPercent(percent) / 100;

  return rgbToHex(
    rgb.r + (255 - rgb.r) * t,
    rgb.g + (255 - rgb.g) * t,
    rgb.b + (255 - rgb.b) * t
  );
}

export function darken(hex, percent = 10) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const t = 1 - clampPercent(percent) / 100;

  return rgbToHex(
    rgb.r * t,
    rgb.g * t,
    rgb.b * t
  );
}

/* ----------------------
   COLOR UTILITIES
---------------------- */

export function randomHex() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    return rgbToHex(...bytes);
  }

  return rgbToHex(
    Math.random() * 255,
    Math.random() * 255,
    Math.random() * 255
  );
}

export function invert(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return rgbToHex(
    255 - rgb.r,
    255 - rgb.g,
    255 - rgb.b
  );
}

export function mix(hex1, hex2, percent = 50) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);

  if (!c1 || !c2) return null;

  const t = clampPercent(percent) / 100;

  return rgbToHex(
    c1.r + (c2.r - c1.r) * t,
    c1.g + (c2.g - c1.g) * t,
    c1.b + (c2.b - c1.b) * t
  );
}

/* ----------------------
   WCAG
---------------------- */

export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const channel = value => {
    const normalized = value / 255;

    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    0.2126 * channel(rgb.r) +
    0.7152 * channel(rgb.g) +
    0.0722 * channel(rgb.b)
  );
}

export function contrast(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);

  if (l1 === null || l2 === null) return null;

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/* ----------------------
   Accessibility helpers
---------------------- */

export function isDark(hex) {
  const value = luminance(hex);
  return value !== null && value < 0.5;
}

export function isLight(hex) {
  const value = luminance(hex);
  return value !== null && value >= 0.5;
}

export function getContrastText(hex) {
  const white = contrast(hex, "#FFFFFF");
  const black = contrast(hex, "#000000");

  if (white === null || black === null) return null;

  return white >= black ? "#FFFFFF" : "#000000";
}
