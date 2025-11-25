/**
 * Advanced CSV Parser Utility
 * Supports RFC 4180 quoting, escapes, type casting, flexible delimiters, and improved CSV generation.
 */

export class CSVParser {
    /**
     * Parse CSV text into structured data
     * @param {string} csvText
     * @param {Object} options
     * @returns {{ headers: string[], data: Object[] }}
     */
    static parse(csvText, options = {}) {
        const {
            delimiter = ",",
            hasHeaders = true,
            ignoreEmpty = true,
            trim = true,
            cast = false, // auto-detect types (numbers, booleans)
        } = options;

        // Normalize line endings
        const lines = csvText
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split("\n");

        const cleanLines = ignoreEmpty
            ? lines.filter(line => line.trim().length > 0)
            : lines;

        if (cleanLines.length === 0) {
            return { headers: [], data: [] };
        }

        const headerLine = this.parseLine(cleanLines[0], delimiter, trim);
        const headers = hasHeaders
            ? headerLine
            : headerLine.map((_, i) => `Column${i + 1}`);

        const startIndex = hasHeaders ? 1 : 0;

        const data = [];

        for (let i = startIndex; i < cleanLines.length; i++) {
            const values = this.parseLine(cleanLines[i], delimiter, trim);

            const row = {};
            headers.forEach((header, index) => {
                let value = values[index] ?? "";

                if (cast) value = this.castValue(value);

                row[header] = value;
            });

            data.push(row);
        }

        return { headers, data };
    }

    /**
     * Parse a single CSV line including escaped quotes and delimiter rules
     */
    static parseLine(line, delimiter = ",", trim = true) {
        const result = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const next = line[i + 1];

            if (char === '"' && next === '"') {
                // Escaped quote ("")
                current += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(trim ? current.trim() : current);
                current = "";
            } else {
                current += char;
            }
        }

        result.push(trim ? current.trim() : current);
        return result;
    }

    /**
     * Auto-detect and cast values: number, boolean, null, or keep string
     */
    static castValue(value) {
        if (value === "") return "";

        if (/^(true|false)$/i.test(value)) {
            return value.toLowerCase() === "true";
        }

        if (!isNaN(value) && value.trim() !== "") {
            return Number(value);
        }

        if (/^(null)$/i.test(value)) return null;

        return value;
    }

    /**
     * Escape CSV values properly
     */
    static escapeValue(value) {
        if (value === null || value === undefined) return "";

        const str = String(value);

        if (/[",\n]/.test(str)) {
            return `"${str.replace(/"/g, '""')}"`;
        }

        return str;
    }

    /**
     * Generate CSV text from data array
     * @param {Array<Object>} data
     * @param {Array<string>} headers
     * @returns {string}
     */
    static generate(data, headers = null, delimiter = ",") {
        if (!Array.isArray(data) || data.length === 0) {
            return "";
        }

        const actualHeaders = headers || Object.keys(data[0]);

        let csv = actualHeaders.map(h => this.escapeValue(h)).join(delimiter) + "\n";

        for (const row of data) {
            const line = actualHeaders
                .map(header => this.escapeValue(row[header] ?? ""))
                .join(delimiter);

            csv += line + "\n";
        }

        return csv;
    }
}
