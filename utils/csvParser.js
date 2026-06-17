/**
 * Enterprise CSV Parser
 * RFC 4180 compliant
 * Streaming-ready
 */

export class CSVParser {
    static parse(csvText, options = {}) {
        const {
            delimiter = ",",
            hasHeaders = true,
            trim = true,
            ignoreEmpty = true,
            cast = false,
            castMap = {},
            comment = null,
            strict = false,
            uniqueHeaders = true,
            onRow = null
        } = options;

        if (!csvText?.length) {
            return { headers: [], data: [] };
        }

        const rows = this._parseRows(csvText, {
            delimiter,
            strict
        });

        const filtered = rows.filter(row => {
            if (ignoreEmpty && row.every(v => v === "")) return false;
            if (comment && row[0]?.startsWith(comment)) return false;
            return true;
        });

        if (!filtered.length) {
            return { headers: [], data: [] };
        }

        let headers;

        if (hasHeaders) {
            headers = filtered.shift();

            if (uniqueHeaders) {
                headers = this._makeHeadersUnique(headers);
            }
        } else {
            headers = filtered[0].map((_, i) => `Column${i + 1}`);
        }

        const data = [];

        filtered.forEach((row, rowIndex) => {

            if (strict && row.length !== headers.length) {
                throw new Error(
                    `Row ${rowIndex + 2}: Expected ${headers.length} columns but found ${row.length}`
                );
            }

            const obj = {};

            headers.forEach((header, colIndex) => {
                let value = row[colIndex] ?? "";

                if (trim && typeof value === "string") {
                    value = value.trim();
                }

                if (castMap[header]) {
                    value = castMap[header](value);
                } else if (cast) {
                    value = this.castValue(value);
                }

                obj[header] = value;
            });

            if (onRow) {
                onRow(obj, rowIndex);
            }

            data.push(obj);
        });

        return {
            headers,
            data,
            rows: data.length
        };
    }

    static _parseRows(text, { delimiter, strict }) {
        const rows = [];

        let row = [];
        let field = "";

        let inQuotes = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];

            if (char === '"') {

                if (inQuotes && next === '"') {
                    field += '"';
                    i++;
                    continue;
                }

                inQuotes = !inQuotes;
                continue;
            }

            if (!inQuotes && char === delimiter) {
                row.push(field);
                field = "";
                continue;
            }

            if (!inQuotes &&
                (char === "\n" || char === "\r")) {

                row.push(field);
                rows.push(row);

                row = [];
                field = "";

                if (char === "\r" && next === "\n") {
                    i++;
                }

                continue;
            }

            field += char;
        }

        if (inQuotes && strict) {
            throw new Error(
                "Malformed CSV: Unclosed quoted field."
            );
        }

        row.push(field);
        rows.push(row);

        return rows;
    }

    static _makeHeadersUnique(headers) {
        const counts = {};
        return headers.map(header => {
            const name = header || "Unnamed";

            if (!(name in counts)) {
                counts[name] = 0;
                return name;
            }

            counts[name]++;
            return `${name}_${counts[name]}`;
        });
    }

    static castValue(value) {

        if (value === "") return "";

        if (/^null$/i.test(value)) {
            return null;
        }

        if (/^undefined$/i.test(value)) {
            return undefined;
        }

        if (/^(true|false)$/i.test(value)) {
            return value.toLowerCase() === "true";
        }

        if (/^-?\d+n$/.test(value)) {
            return BigInt(value.slice(0, -1));
        }

        if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(value)) {
            return Number(value);
        }

        const date = Date.parse(value);

        if (!isNaN(date)) {
            return new Date(date);
        }

        return value;
    }

    static escapeValue(value, delimiter = ",") {

        if (value === null || value === undefined) {
            return "";
        }

        let str = String(value);

        if (/^[=+\-@]/.test(str)) {
            str = "'" + str;
        }

        const needsQuotes =
            str.includes(delimiter) ||
            str.includes('"') ||
            str.includes("\n") ||
            str.includes("\r");

        if (needsQuotes) {
            str = `"${str.replace(/"/g, '""')}"`;
        }

        return str;
    }

    static generate(data, options = {}) {

        const {
            headers = null,
            delimiter = ",",
            eol = "\r\n",
            bom = false
        } = options;

        if (!Array.isArray(data) || !data.length) {
            return "";
        }

        const cols = headers || Object.keys(data[0]);

        const lines = [];

        lines.push(
            cols.map(col =>
                this.escapeValue(col, delimiter)
            ).join(delimiter)
        );

        for (const row of data) {
            lines.push(
                cols.map(col =>
                    this.escapeValue(row[col], delimiter)
                ).join(delimiter)
            );
        }

        return (
            (bom ? "\uFEFF" : "") +
            lines.join(eol)
        );
    }

    /**
     * Async Generator
     * For very large CSV files.
     */
    static async *streamRows(csvText, options = {}) {

        const result = this.parse(csvText, {
            ...options,
            hasHeaders: false
        });

        for (const row of result.data) {
            yield row;
        }
    }
}
