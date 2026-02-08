/**
 * Advanced Validation Utility Functions
 * Robust, configurable validators for modern applications
 */

/* ---------------------------------- */
/* Email Validation */
/* ---------------------------------- */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;

  // RFC 5322-inspired (practical, not insane)
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

  return emailRegex.test(email.trim());
}

/* ---------------------------------- */
/* URL Validation */
/* ---------------------------------- */
export function isValidUrl(url, { requireProtocol = true } = {}) {
  if (typeof url !== 'string') return false;

  try {
    const parsed = new URL(url);
    return requireProtocol
      ? ['http:', 'https:'].includes(parsed.protocol)
      : true;
  } catch {
    return false;
  }
}

/* ---------------------------------- */
/* Phone Number Validation */
/* ---------------------------------- */
export function isValidPhone(
  phone,
  { minDigits = 10, maxDigits = 15 } = {}
) {
  if (typeof phone !== 'string') return false;

  const digits = phone.replace(/\D/g, '');
  return digits.length >= minDigits && digits.length <= maxDigits;
}

/* ---------------------------------- */
/* Password Validation */
/* ---------------------------------- */
export function isValidPassword(
  password,
  {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = false
  } = {}
) {
  if (typeof password !== 'string') return false;
  if (password.length < minLength) return false;

  if (requireUppercase && !/[A-Z]/.test(password)) return false;
  if (requireLowercase && !/[a-z]/.test(password)) return false;
  if (requireNumber && !/\d/.test(password)) return false;
  if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) return false;

  return true;
}

/* ---------------------------------- */
/* Empty Check */
/* ---------------------------------- */
export function isEmpty(value) {
  if (value == null) return true;

  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set)
    return value.size === 0;

  if (typeof value === 'object')
    return Object.keys(value).length === 0;

  return false;
}

/* ---------------------------------- */
/* Credit Card Validation (Luhn) */
/* ---------------------------------- */
export function isValidCreditCard(cardNumber) {
  if (typeof cardNumber !== 'string') return false;

  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let doubleDigit = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);

    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    doubleDigit = !doubleDigit;
  }

  return sum % 10 === 0;
}

/* ---------------------------------- */
/* Credit Card Type Detection */
/* ---------------------------------- */
export function getCreditCardType(cardNumber) {
  const digits = cardNumber.replace(/\D/g, '');

  if (/^4\d{12,18}$/.test(digits)) return 'Visa';
  if (/^5[1-5]\d{14}$/.test(digits)) return 'Mastercard';
  if (/^3[47]\d{13}$/.test(digits)) return 'American Express';
  if (/^6(?:011|5\d{2})\d{12}$/.test(digits)) return 'Discover';

  return 'Unknown';
}

/* ---------------------------------- */
/* Number Validation */
/* ---------------------------------- */
export function isValidNumber(value, { min, max, integer = false } = {}) {
  if (typeof value !== 'number' || Number.isNaN(value)) return false;
  if (integer && !Number.isInteger(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
}

/* ---------------------------------- */
/* Date Validation */
/* ---------------------------------- */
export function isValidDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(date.getTime());
}

/* ---------------------------------- */
/* UUID v4 Validation */
/* ---------------------------------- */
export function isValidUUID(uuid) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    uuid
  );
}
