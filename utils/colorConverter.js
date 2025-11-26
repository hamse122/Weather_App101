/**
 * Color Converter Utilities (Upgraded Version)
 * Provides useful functions for color format conversion and manipulation
 */

// Convert RGB to HEX
export function rgbToHex(r, g, b) {
  const toHex = (n) => {
    const hex = Math.max(0, Math.min(255, n)).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

// Convert HEX to RGB
export function hexToRgb(hex) {
  hex = hex.replace('#', '').trim();

  // Support shorthand HEX (#FFF → #FFFFFF)
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }

  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Convert RGB to HSL
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  let l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
        break;
      case g:
        h = ((b - r) / d + 2) * 60;
        break;
      case b:
        h = ((r - g) / d + 4) * 60;
        break;
    }
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Lighten HEX color
export function lighten(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const t = percent / 100;
  const r = Math.round(rgb.r + (255 - rgb.r) * t);
  const g = Math.round(rgb.g + (255 - rgb.g) * t);
  const b = Math.round(rgb.b + (255 - rgb.b) * t);

  return rgbToHex(r, g, b);
}

// Darken HEX color
export function darken(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const t = 1 - percent / 100;
  const r = Math.round(rgb.r * t);
  const g = Math.round(rgb.g * t);
  const b = Math.round(rgb.b * t);

  return rgbToHex(r, g, b);
}

// Generate a random HEX color
export function randomHex() {
  return rgbToHex(
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256)
  );
}

// Check if HEX color is valid
export function isValidHex(hex) {
  return /^#?([a-fA-F0-9]{3}|[a-fA-F0-9]{6})$/.test(hex.trim());
}

// Convert HEX to HSL directly
export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  return rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null;
}
