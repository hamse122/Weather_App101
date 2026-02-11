/**
 * Advanced String Manipulation Helpers
 * Unicode-safe, production-ready string utilities
 */

class StringHelpers {

  /* ---------------------------------- */
  /* Basic Transformations */
  /* ---------------------------------- */

  static capitalize(str = "") {
    if (typeof str !== "string" || !str) return "";
    const [first, ...rest] = [...str];
    return first.toUpperCase() + rest.join("");
  }

  static reverse(str = "") {
    return [...str].reverse().join(""); // Unicode-safe
  }

  static toTitleCase(str = "") {
    return str
      .toLowerCase()
      .replace(/\b\p{L}/gu, char => char.toUpperCase());
  }

  static removeExtraSpaces(str = "") {
    return str.replace(/\s+/g, " ").trim();
  }

  static truncate(str = "", length = 50, { ellipsis = true } = {}) {
    if (typeof str !== "string") return "";
    if (str.length <= length) return str;
    return str.slice(0, length) + (ellipsis ? "…" : "");
  }

  static repeat(str = "", n = 1) {
    return str.repeat(Math.max(0, n));
  }

  /* ---------------------------------- */
  /* Analysis */
  /* ---------------------------------- */

  static isPalindrome(str = "") {
    const clean = str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}]/gu, "")
      .toLowerCase();

    return clean === this.reverse(clean);
  }

  static countVowels(str = "") {
    const matches = str.match(/[aeiou]/gi);
    return matches ? matches.length : 0;
  }

  static wordCount(str = "") {
    const matches = str.trim().match(/\b\p{L}+\b/gu);
    return matches ? matches.length : 0;
  }

  static charCount(str = "") {
    return [...str].length; // emoji-safe
  }

  static isAlpha(str = "") {
    return /^\p{L}+$/u.test(str);
  }

  static isNumeric(str = "") {
    return /^\d+$/.test(str);
  }

  static isAlphaNumeric(str = "") {
    return /^[\p{L}\p{N}]+$/u.test(str);
  }

  static isUpperCase(str = "") {
    return str === str.toUpperCase() && str !== str.toLowerCase();
  }

  static isLowerCase(str = "") {
    return str === str.toLowerCase() && str !== str.toUpperCase();
  }

  /* ---------------------------------- */
  /* Formatting */
  /* ---------------------------------- */

  static slugify(str = "") {
    return str
      .normalize("NFD")                     // remove accents
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  }

  static padLeft(str = "", length = 0, char = " ") {
    return str.padStart(length, char);
  }

  static padRight(str = "", length = 0, char = " ") {
    return str.padEnd(length, char);
  }

  static mask(str = "", visible = 4, maskChar = "*") {
    if (str.length <= visible) return str;
    const maskedLength = str.length - visible;
    return maskChar.repeat(maskedLength) + str.slice(-visible);
  }

  static extractNumbers(str = "") {
    return (str.match(/\d+/g) || []).join("");
  }

  static extractEmails(str = "") {
    return str.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) || [];
  }

  static extractUrls(str = "") {
    return str.match(/https?:\/\/[^\s]+/g) || [];
  }
}

module.exports = StringHelpers;
