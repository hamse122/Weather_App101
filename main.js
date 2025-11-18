// Enhanced String manipulation helpers
class StringHelpers {
    /**
     * Capitalize the first letter of a string.
     */
    static capitalize(str = "") {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    /**
     * Reverse any string.
     */
    static reverse(str = "") {
        return [...str].reverse().join("");
    }

    /**
     * Check whether a string is a palindrome.
     */
    static isPalindrome(str = "") {
        const cleanStr = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return cleanStr === this.reverse(cleanStr);
    }

    /**
     * Truncate a long string and add "..."
     */
    static truncate(str = "", length = 50) {
        if (str.length <= length) return str;
        return str.substring(0, length) + "...";
    }

    /**
     * Count vowels in a string (English vowels).
     */
    static countVowels(str = "") {
        const matches = str.match(/[aeiou]/gi);
        return matches ? matches.length : 0;
    }

    /**
     * Convert string to Title Case.
     */
    static toTitleCase(str = "") {
        return str
            .toLowerCase()
            .split(" ")
            .map(word => word ? word[0].toUpperCase() + word.slice(1) : "")
            .join(" ");
    }

    /**
     * Remove extra spaces from a string.
     */
    static removeExtraSpaces(str = "") {
        return str.replace(/\s+/g, " ").trim();
    }

    /**
     * Count words in a string.
     */
    static wordCount(str = "") {
        const cleaned = str.trim();
        if (!cleaned) return 0;
        return cleaned.split(/\s+/).length;
    }

    /**
     * Create a slug (URL-friendly text)
     * Example: "Hello World!" → "hello-world"
     */
    static slugify(str = "") {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    }

    /**
     * Repeat a string n times.
     */
    static repeat(str = "", n = 1) {
        return str.repeat(n);
    }

    /**
     * Check if a string contains only letters.
     */
    static isAlpha(str = "") {
        return /^[A-Za-z]+$/.test(str);
    }

    /**
     * Check if a string contains only numbers.
     */
    static isNumeric(str = "") {
        return /^[0-9]+$/.test(str);
    }
}

module.exports = StringHelpers;
