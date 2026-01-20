/**
 * Ultra-robust CSV Parser (RFC 4180 compliant)
 */

export class CSVParser {
    static parse(csvText, options = {}) {
        const {
            delimiter = ",",
            hasHeaders = true,
            trim = true,
            ignoreEmpty = true,
            cast = false,
            castMap = null,     // { columnName: fn }
            comment = null,     // e.g. "#"
            strict = false,     // throw on row length mismatch
        } = options;

        if (!csvText) return { headers: [], data: [] };

        const rows = this._parseRows(csvText, delimiter);
        const filtered = rows.filter(r => {
            if (ignoreEmpty && r.every(v => v === "")) return false;
            if (comment && r[0]?.startsWith(comment)) return false;
            return true;
        });

        if (filtered.length === 0) {
            return { headers: [], data: [] };
        }

        const headers = hasHeaders
            ? filtered.shift()
            : filtered[0].map((_, i) => `Column${i + 1}`);

        const data = filtered.map((row, rowIndex) => {
            if (strict && row.length !== headers.length) {
                throw new Error(
                    `Row ${rowIndex + 1} length mismatch: expected ${headers.length}, got ${row.length}`
                );
            }

            const obj = {};
            headers.forEach((h, i) => {
                let value = row[i] ?? "";

                if (trim && typeof value === "string") value = value.trim();

                if (castMap?.[h]) {
                    value = castMap[h](value);
                } else if (cast) {
                    value = this.castValue(value);
                }

                obj[h] = value;
            });

            return obj;
        });

        return { headers, data };
    }

    /**
     * Streaming-safe RFC 4180 row parser
     */
    static _parseRows(text, delimiter) {
        const rows = [];
        let row = [];
        let field = "";
        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];

            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                row.push(field);
                field = "";
            } else if (char === "\n" && !inQuotes) {
                row.push(field);
                rows.push(row);
                row = [];
                field = "";
            } else if (char !== "\r") {
                field += char;
            }
        }

        row.push(field);
        rows.push(row);
        return rows;
    }

    /**
     * Smart type casting
     */
    static castValue(value) {
        if (value === "") return "";

        if (/^(true|false)$/i.test(value)) {
            return value.toLowerCase() === "true";
        }

        if (/^-?\d+(\.\d+)?$/.test(value)) {
            return Number(value);
        }

        if (!isNaN(Date.parse(value))) {
            return new Date(value);
        }

        if (/^null$/i.test(value)) return null;

        return value;
    }

    /**
     * Escape CSV values safely
     */
    static escapeValue(value, delimiter = ",") {
        if (value === null || value === undefined) return "";

        const str = String(value);
        const needsQuotes = str.includes('"') || str.includes("\n") || str.includes(delimiter);

        return needsQuotes
            ? `"${str.replace(/"/g, '""')}"`
            : str;
    }

    /**
     * Generate CSV text
     */
    static generate(data, {
        headers = null,
        delimiter = ",",
        eol = "\n",
        bom = false
    } = {}) {
        if (!Array.isArray(data) || data.length === 0) return "";

        const cols = headers || Object.keys(data[0]);
        let csv = bom ? "\uFEFF" : "";

        csv += cols.map(h => this.escapeValue(h, delimiter)).join(delimiter) + eol;

        for (const row of data) {
            csv += cols
                .map(h => this.escapeValue(row[h], delimiter))
                .join(delimiter) + eol;
        }

        return csv;
    }
}
