/**
 * String Helper Functions (2026 Edition)
 * Features:
 * - Unicode-aware string manipulation
 * - Cryptographically secure random strings
 * - Locale-aware casing
 * - Safe truncation and repetition
 * - Slug generation
 * - HTML escaping
 * - Word and character counting
 * - Input validation
 */

const isString = value =>
    typeof value === "string" || value instanceof String;

const toSafeString = value =>
    isString(value) ? String(value) : "";

const toCharacters = str =>
    [...new Intl.Segmenter(undefined, {
        granularity: "grapheme"
    }).segment(str)].map(item => item.segment);

/**
 * Capitalize the first character.
 */
export function capitalize(str = "", locale) {
    const input = toSafeString(str).trim();
    if (!input) return "";

    const chars = toCharacters(input);
    const first = chars.shift();

    return (
        (locale
            ? first.toLocaleUpperCase(locale)
            : first.toLocaleUpperCase()) +
        chars.join("")
    );
}

/**
 * Convert to camelCase.
 */
export function toCamelCase(str = "", locale) {
    const input = toSafeString(str).trim();
    if (!input) return "";

    const words = input
        .replace(/([a-z\d])([A-Z])/g, "$1 $2")
        .match(/[\p{L}\p{N}]+/gu) || [];

    return words
        .map((word, index) => {
            const lower = locale
                ? word.toLocaleLowerCase(locale)
                : word.toLocaleLowerCase();

            return index === 0
                ? lower
                : capitalize(lower, locale);
        })
        .join("");
}

/**
 * Convert to kebab-case.
 */
export function toKebabCase(str = "") {
    return toSafeString(str)
        .normalize("NFKC")
        .replace(/([a-z\d])([A-Z])/g, "$1-$2")
        .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase();
}

/**
 * Convert to snake_case.
 */
export function toSnakeCase(str = "") {
    return toKebabCase(str).replace(/-/g, "_");
}

/**
 * Convert to Title Case.
 */
export function toTitleCase(str = "", locale) {
    const input = toSafeString(str).trim();
    if (!input) return "";

    return input.replace(/\S+/gu, word => {
        const chars = toCharacters(
            locale ? word.toLocaleLowerCase(locale) : word.toLowerCase()
        );

        if (!chars.length) return word;

        return capitalize(chars.join(""), locale);
    });
}

/**
 * Truncate by Unicode grapheme clusters.
 */
export function truncate(
    str = "",
    maxLength = 0,
    { suffix = "...", wordBoundary = false } = {}
) {
    const input = toSafeString(str);
    const ending = toSafeString(suffix);

    if (!Number.isInteger(maxLength) || maxLength <= 0) {
        return "";
    }

    const chars = toCharacters(input);

    if (chars.length <= maxLength) return input;

    const suffixChars = toCharacters(ending);

    if (suffixChars.length >= maxLength) {
        return suffixChars.slice(0, maxLength).join("");
    }

    const available = maxLength - suffixChars.length;
    let result = chars.slice(0, available).join("");

    if (wordBoundary) {
        const lastSpace = result.lastIndexOf(" ");

        if (lastSpace > 0) {
            result = result.slice(0, lastSpace);
        }
    }

    return result + ending;
}

/**
 * Remove whitespace.
 */
export function removeWhitespace(str = "") {
    return toSafeString(str).replace(/\s+/gu, "");
}

/**
 * Reverse by Unicode grapheme clusters.
 */
export function reverseString(str = "") {
    return toCharacters(toSafeString(str)).reverse().join("");
}

/**
 * Check whether a string is a palindrome.
 */
export function isPalindrome(str = "", locale) {
    const input = toSafeString(str);

    const cleaned = input
        .normalize("NFKC")
        .replace(/[^\p{L}\p{N}]/gu, "");

    const normalized = locale
        ? cleaned.toLocaleLowerCase(locale)
        : cleaned.toLowerCase();

    if (!normalized) return false;

    return normalized === reverseString(normalized);
}

/**
 * Generate a cryptographically secure random string.
 * Uses Web Crypto in browsers and Node.js environments
 * that expose globalThis.crypto.
 */
export function randomString(
    length = 8,
    {
        uppercase = true,
        lowercase = true,
        numbers = true,
        symbols = false
    } = {}
) {
    if (!Number.isSafeInteger(length) || length < 0) {
        throw new RangeError("Length must be a non-negative safe integer.");
    }

    if (length === 0) return "";

    let chars = "";

    if (uppercase) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    if (lowercase) chars += "abcdefghijklmnopqrstuvwxyz";
    if (numbers) chars += "0123456789";
    if (symbols) chars += "!@#$%^&*()-_=+[]{}:,.?";

    if (!chars.length) {
        throw new Error("At least one character set must be enabled.");
    }

    const crypto = globalThis.crypto;

    if (!crypto?.getRandomValues) {
        throw new Error("A cryptographically secure random source is unavailable.");
    }

    let result = "";

    // Rejection sampling avoids modulo bias.
    const limit = 256 - (256 % chars.length);
    const buffer = new Uint8Array(Math.min(4096, Math.max(32, length * 2)));

    while (result.length < length) {
        crypto.getRandomValues(buffer);

        for (const byte of buffer) {
            if (byte >= limit) continue;

            result += chars[byte % chars.length];

            if (result.length === length) break;
        }
    }

    return result;
}

/**
 * Count words using Unicode-aware matching.
 */
export function wordCount(str = "", locale) {
    const input = toSafeString(str).trim();
    if (!input) return 0;

    if (typeof Intl.Segmenter === "function") {
        const segmenter = new Intl.Segmenter(locale, {
            granularity: "word"
        });

        let count = 0;

        for (const part of segmenter.segment(input)) {
            if (part.isWordLike) count++;
        }

        return count;
    }

    return input.split(/\s+/u).length;
}

/**
 * Count grapheme clusters.
 */
export function characterCount(str = "") {
    return toCharacters(toSafeString(str)).length;
}

/**
 * Check for blank input.
 */
export function isBlank(str = "") {
    return toSafeString(str).trim().length === 0;
}

/**
 * Repeat safely with a configurable output limit.
 */
export function repeatString(str = "", count = 1, maxLength = 1_000_000) {
    const input = toSafeString(str);

    if (!Number.isSafeInteger(count) || count < 0) {
        throw new RangeError("Count must be a non-negative safe integer.");
    }

    if (!Number.isSafeInteger(maxLength) || maxLength < 0) {
        throw new RangeError("maxLength must be a non-negative safe integer.");
    }

    if (input.length * count > maxLength) {
        throw new RangeError("Repeated string exceeds the maximum output length.");
    }

    return input.repeat(count);
}

/**
 * Convert text into a URL-friendly slug.
 */
export function slugify(str = "") {
    return toSafeString(str)
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Escape HTML-sensitive characters.
 */
export function escapeHTML(str = "") {
    return toSafeString(str).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

/**
 * Check whether a string contains only letters and numbers.
 */
export function isAlphanumeric(str = "") {
    const input = toSafeString(str);

    return input.length > 0 && /^[\p{L}\p{N}]+$/u.test(input);
}

/**
 * Remove duplicate characters while preserving order.
 */
export function uniqueCharacters(str = "") {
    return [...new Set(toCharacters(toSafeString(str)))].join("");
}

/**
 * Compare strings using normalized Unicode.
 */
export function equalsIgnoreCase(a, b, locale) {
    const normalize = value => {
        const str = toSafeString(value).normalize("NFC");

        return locale
            ? str.toLocaleLowerCase(locale)
            : str.toLowerCase();
    };

    return normalize(a) === normalize(b);
}
