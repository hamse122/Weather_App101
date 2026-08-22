/**
 * Enterprise CSV Parser
 * RFC 4180-inspired
 * - Strict validation
 * - Async iterable streaming
 * - Multi-character delimiters
 * - Header normalization
 * - Safe type casting
 * - Formula-injection protection
 */

export class CSVParser {
    static parse(csvText = "", options = {}) {
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
            skipEmptyLines = true,
            onRow = null
        } = options;

        if (typeof csvText !== "string" || csvText.length === 0) {
            return { headers: [], data: [], rows: 0 };
        }

        if (typeof delimiter !== "string" || !delimiter.length) {
            throw new TypeError("Delimiter must be a non-empty string");
        }

        const rows = this._parseRows(csvText, {
            delimiter,
            strict
        });

        const filtered = rows.filter(row => {
            if (ignoreEmpty || skipEmptyLines) {
                if (row.every(value => String(value ?? "").trim() === "")) {
                    return false;
                }
            }

            if (comment) {
                const first = String(row[0] ?? "").trimStart();
                if (first.startsWith(comment)) return false;
            }

            return true;
        });

        if (!filtered.length) {
            return { headers: [], data: [], rows: 0 };
        }

        let headers;

        if (hasHeaders) {
            headers = [...filtered.shift()];

            if (trim) {
                headers = headers.map(header => header.trim());
            }

            if (uniqueHeaders) {
                headers = this._makeHeadersUnique(headers);
            } else if (strict && new Set(headers).size !== headers.length) {
                throw new Error("Duplicate CSV headers are not allowed in strict mode");
            }
        } else {
            headers = filtered[0].map((_, index) => `Column${index + 1}`);
        }

        const data = [];

        filtered.forEach((row, rowIndex) => {
            const lineNumber = hasHeaders ? rowIndex + 2 : rowIndex + 1;

            if (strict && row.length !== headers.length) {
                throw new Error(
                    `Row ${lineNumber}: expected ${headers.length} columns but found ${row.length}`
                );
            }

            const obj = Object.create(null);

            headers.forEach((header, colIndex) => {
                let value = row[colIndex] ?? "";

                if (trim && typeof value === "string") {
                    value = value.trim();
                }

                if (typeof castMap[header] === "function") {
                    value = castMap[header](value, {
                        rowIndex,
                        columnIndex: colIndex,
                        header
                    });
                } else if (cast) {
                    value = this.castValue(value);
                }

                obj[header] = value;
            });

            if (typeof onRow === "function") {
                const result = onRow(obj, rowIndex);

                if (strict && result === false) {
                    throw new Error(`Row ${lineNumber} was rejected by onRow`);
                }
            }

            data.push(obj);
        });

        return {
            headers,
            data,
            rows: data.length
        };
    }

    static _parseRows(text, { delimiter = ",", strict = false } = {}) {
        const rows = [];
        let row = [];
        let field = "";
        let inQuotes = false;
        let fieldStarted = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];

            if (char === '"') {
                if (inQuotes && next === '"') {
                    field += '"';
                    i++;
                    continue;
                }

                if (!inQuotes && field.length > 0) {
                    if (strict) {
                        throw new Error(
                            `Malformed CSV: unexpected quote at position ${i}`
                        );
                    }

                    field += char;
                    continue;
                }

                inQuotes = !inQuotes;
                fieldStarted = true;
                continue;
            }

            if (
                !inQuotes &&
                text.startsWith(delimiter, i)
            ) {
                row.push(field);
                field = "";
                fieldStarted = false;
                i += delimiter.length - 1;
                continue;
            }

            if (!inQuotes && (char === "\n" || char === "\r")) {
                row.push(field);
                rows.push(row);

                row = [];
                field = "";
                fieldStarted = false;

                if (char === "\r" && next === "\n") {
                    i++;
                }

                continue;
            }

            field += char;
            fieldStarted = true;
        }

        if (inQuotes && strict) {
            throw new Error("Malformed CSV: unclosed quoted field");
        }

        if (
            field.length > 0 ||
            row.length > 0 ||
            fieldStarted
        ) {
            row.push(field);
            rows.push(row);
        }

        return rows;
    }

    static _makeHeadersUnique(headers = []) {
        const counts = new Map();

        return headers.map((header, index) => {
            const base = String(header ?? "").trim() || `Column${index + 1}`;
            const count = counts.get(base) || 0;

            counts.set(base, count + 1);

            return count === 0
                ? base
                : `${base}_${count + 1}`;
        });
    }

    static castValue(value) {
        if (typeof value !== "string") return value;
        if (value === "") return "";

        if (/^null$/i.test(value)) return null;
        if (/^undefined$/i.test(value)) return undefined;

        if (/^(true|false)$/i.test(value)) {
            return value.toLowerCase() === "true";
        }

        if (/^-?\d+n$/i.test(value)) {
            try {
                return BigInt(value.slice(0, -1));
            } catch {
                return value;
            }
        }

        if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) {
            const number = Number(value);

            if (Number.isFinite(number)) {
                return number;
            }
        }

        // Only cast clear ISO-style dates to avoid accidental date conversion.
        if (
            /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value)
        ) {
            const timestamp = Date.parse(value);

            if (!Number.isNaN(timestamp)) {
                return new Date(timestamp);
            }
        }

        return value;
    }

    static escapeValue(value, delimiter = ",") {
        if (value === null || value === undefined) {
            return "";
        }

        let str;

        if (value instanceof Date) {
            str = value.toISOString();
        } else if (typeof value === "object") {
            try {
                str = JSON.stringify(value);
            } catch {
                str = String(value);
            }
        } else {
            str = String(value);
        }

        // Spreadsheet formula-injection protection.
        if (/^[=+\-@\t\r]/.test(str)) {
            str = `'${str}`;
        }

        const needsQuotes =
            str.includes(delimiter) ||
            str.includes('"') ||
            str.includes("\n") ||
            str.includes("\r") ||
            /^\s|\s$/.test(str);

        return needsQuotes
            ? `"${str.replace(/"/g, '""')}"`
            : str;
    }

    static generate(data = [], options = {}) {
        const {
            headers = null,
            delimiter = ",",
            eol = "\r\n",
            bom = false,
            includeHeaders = true
        } = options;

        if (!Array.isArray(data) || data.length === 0) {
            return bom ? "\uFEFF" : "";
        }

        const cols = headers
            ? [...headers]
            : Array.from(
                data.reduce((keys, row) => {
                    if (row && typeof row === "object") {
                        Object.keys(row).forEach(key => keys.add(key));
                    }
                    return keys;
                }, new Set())
            );

        const lines = [];

        if (includeHeaders) {
            lines.push(
                cols
                    .map(col => this.escapeValue(col, delimiter))
                    .join(delimiter)
            );
        }

        for (const row of data) {
            if (Array.isArray(row)) {
                lines.push(
                    row
                        .map(value => this.escapeValue(value, delimiter))
                        .join(delimiter)
                );
                continue;
            }

            lines.push(
                cols
                    .map(col =>
                        this.escapeValue(row?.[col], delimiter)
                    )
                    .join(delimiter)
            );
        }

        return (bom ? "\uFEFF" : "") + lines.join(eol);
    }

    /**
     * Async Generator
     * Supports CSV strings, arrays, and async iterables.
     */
    static async *streamRows(source, options = {}) {
        const {
            hasHeaders = true,
            ...parseOptions
        } = options;

        let headers = null;
        let rowIndex = 0;

        const processRow = async function* (row) {
            if (!headers && hasHeaders) {
                headers = [...row];

                if (parseOptions.trim !== false) {
                    headers = headers.map(header => header.trim());
                }

                headers = parseOptions.uniqueHeaders !== false
                    ? CSVParser._makeHeadersUnique(headers)
                    : headers;

                return;
            }

            if (!headers) {
                headers = row.map((_, index) => `Column${index + 1}`);
            }

            const obj = Object.create(null);

            headers.forEach((header, index) => {
                let value = row[index] ?? "";

                if (
                    parseOptions.trim !== false &&
                    typeof value === "string"
                ) {
                    value = value.trim();
                }

                if (typeof parseOptions.castMap?.[header] === "function") {
                    value = parseOptions.castMap[header](value);
                } else if (parseOptions.cast) {
                    value = CSVParser.castValue(value);
                }

                obj[header] = value;
            });

            yield obj;
        };

        if (typeof source === "string") {
            const rows = this._parseRows(source, {
                delimiter: parseOptions.delimiter || ",",
                strict: parseOptions.strict || false
            });

            for (const row of rows) {
                for await (const obj of processRow(row)) {
                    yield obj;
                }
                rowIndex++;
            }

            return;
        }

        if (source?.[Symbol.asyncIterator]) {
            for await (const row of source) {
                const normalizedRow = Array.isArray(row)
                    ? row
                    : [row];

                for await (const obj of processRow(normalizedRow)) {
                    yield obj;
                }
                rowIndex++;
            }

            return;
        }

        if (source?.[Symbol.iterator]) {
            for (const row of source) {
                const normalizedRow = Array.isArray(row)
                    ? row
                    : [row];

                for await (const obj of processRow(normalizedRow)) {
                    yield obj;
                }
                rowIndex++;
            }

            return;
        }

        throw new TypeError(
            "streamRows source must be a CSV string, iterable, or async iterable"
        );
    }
}
