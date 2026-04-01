/**
 * Color Converter Utilities – V2 (Fully Upgraded)
 * - Strong validation & normalization
 * - Multi-format support (HEX, RGB, HSL)
 * - Safe conversions
 * - Extra helpers (mix, luminance, contrast, invert)
 */

const clamp = (n, min = 0, max = 255) => Math.min(Math.max(n, min), max);

// ----------------------
//  HEX ⇄ RGB
// ----------------------

export function rgbToHex(r, g, b) {
  const toHex = (n) => clamp(n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function isValidHex(hex) {
  return /^#?([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/.test(hex.trim());
}

export function hexToRgb(hex) {
  if (!isValidHex(hex)) return null;
  hex = hex.replace("#", "").trim();

  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }

  const int = parseInt(hex, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

// ----------------------
//  RGB ⇄ HSL
// ----------------------

export function rgbToHsl(r, g, b) {
  r = clamp(r) / 255;
  g = clamp(g) / 255;
  b = clamp(b) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = d / (1 - Math.abs(2 * l - 1));

    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
}

// ----------------------
//  Lighten / Darken
// ----------------------

export function lighten(hex, percent = 10) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const t = percent / 100;
  return rgbToHex(
    Math.round(rgb.r + (255 - rgb.r) * t),
    Math.round(rgb.g + (255 - rgb.g) * t),
    Math.round(rgb.b + (255 - rgb.b) * t)
  );
}

export function darken(hex, percent = 10) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const t = 1 - percent / 100;
  return rgbToHex(
    Math.round(rgb.r * t),
    Math.round(rgb.g * t),
    Math.round(rgb.b * t)
  );
}

// ----------------------
//  EXTRA UTILITIES
// ----------------------

// Generate random HEX
export function randomHex() {
  return rgbToHex(
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256)
  );
}

// Invert color (#000000 → #FFFFFF)
export function invert(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  return rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
}

// Luminance (WCAG 2.0 formula)
export function luminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const channel = (v) => {
    v /= 255;
    return v <= 0.03928
      ? v / 12.92
      : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  return (
    0.2126 * channel(rgb.r) +
    0.7152 * channel(rgb.g) +
    0.0722 * channel(rgb.b)
  );
}

// Contrast ratio between two HEX colors
export function contrast(hex1, hex2) {
  const l1 = luminance(hex1);
  const l2 = luminance(hex2);
  if (l1 === null || l2 === null) return null;

  const bright = Math.max(l1, l2) + 0.05;
  const dark = Math.min(l1, l2) + 0.05;
  return +(bright / dark).toFixed(2); // WCAG ratio
}

// Mix two HEX colors (percent = 0–100)
export function mix(hex1, hex2, percent = 50) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  if (!c1 || !c2) return null;

  const t = percent / 100;
  return rgbToHex(
    Math.round(c1.r + (c2.r - c1.r) * t),
    Math.round(c1.g + (c2.g - c1.g) * t),
    Math.round(c1.b + (c2.b - c1.b) * t)
  );
}
