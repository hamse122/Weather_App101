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
export function validatePassword(
  password,
  {
    minLength = 8,
    maxLength = 128,
    requireUppercase = true,
    requireLowercase = true,
    requireNumber = true,
    requireSpecial = false,
    specialCharacters = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;`~]/
  } = {}
) {
  const errors = [];

  if (typeof password !== "string") {
    return { valid: false, errors: ["Password must be a string"] };
  }

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters`);
  }

  if (maxLength > 0 && password.length > maxLength) {
    errors.push(`Password must not exceed ${maxLength} characters`);
  }

  if (requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain an uppercase letter");
  }

  if (requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain a lowercase letter");
  }

  if (requireNumber && !/\d/.test(password)) {
    errors.push("Password must contain a number");
  }

  if (requireSpecial && !specialCharacters.test(password)) {
    errors.push("Password must contain a special character");
  }

  return {
    valid: errors.length === 0,
    errors,
    strength: getPasswordStrength(password)
  };
}

export function isValidPassword(password, options = {}) {
  return validatePassword(password, options).valid;
}

function getPasswordStrength(password) {
  if (typeof password !== "string" || !password) return "none";

  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;`~]/.test(password)) score++;

  if (score <= 1) return "weak";
  if (score <= 3) return "medium";
  if (score === 4) return "strong";
  return "very-strong";
}

async rollback(config = {}) {
    const migrations = [...this.migrations]
        .filter(migration => typeof migration?.down === "function")
        .reverse();

    const results = [];

    for (const migration of migrations) {
        try {
            await this.db.query(
                connection => migration.down(connection),
                config
            );

            results.push({
                name: migration.name ?? "anonymous",
                success: true
            });
        } catch (error) {
            const migrationName = migration.name ?? "anonymous";

            error.message =
                `Rollback failed for migration "${migrationName}": ${error.message}`;

            error.rollbackResults = results;

            throw error;
        }
    }

    return results;
}
}

module.exports = { ORM, BaseModel };

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
