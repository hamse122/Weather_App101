/**
 * Advanced Compression Utility
 * Supports: RLE (binary-safe), Gzip, Brotli, JSON, Base64, Streams
 * Works in: Browser + Node.js (Universal)
 */

export class Compression {

    /* -------------------------------------------------------
       ENVIRONMENT DETECTION
    -------------------------------------------------------- */
    static get isNode() {
        return typeof process !== "undefined" && process.versions?.node;
    }

    static get hasStreamsAPI() {
        return typeof CompressionStream !== "undefined";
    }

    /* -------------------------------------------------------
       SAFE RLE (Binary-Safe + Digit-Safe)
    -------------------------------------------------------- */

    /**
     * Improved RLE with escape markers (handles digits & unicode safely)
     * Format: ~count:char  (e.g. ~5:a)
     */
    static compressRLE(str = "") {
        if (typeof str !== "string" || str.length === 0) return "";

        let result = "";
        let count = 1;
        let prev = str[0];

        for (let i = 1; i <= str.length; i++) {
            const curr = str[i];

            if (curr === prev && count < 65535) {
                count++;
            } else {
                if (count > 3 || prev === "~" || /\d/.test(prev)) {
                    result += `~${count}:${prev}`;
                } else {
                    result += prev.repeat(count);
                }
                prev = curr;
                count = 1;
            }
        }

        return result;
    }

/**
 * Decompress safe RLE format (v2)
 */
static decompressRLE(compressed = "") {
    if (typeof compressed !== "string" || compressed.length === 0) {
        return "";
    }

    const MAX_REPEAT = 1_000_000;
    let output = [];
    let i = 0;

    while (i < compressed.length) {

        if (compressed[i] !== "~") {
            output.push(compressed[i++]);
            continue;
        }

        i++; // Skip "~"

        let countStr = "";

        while (i < compressed.length && compressed[i] !== ":") {
            if (compressed[i] < "0" || compressed[i] > "9") {
                throw new Error("Invalid RLE format: invalid repeat count");
            }
            countStr += compressed[i++];
        }

        if (i >= compressed.length || compressed[i] !== ":") {
            throw new Error("Invalid RLE format: missing ':'");
        }

        i++; // Skip ":"

        if (i >= compressed.length) {
            throw new Error("Invalid RLE format: missing character");
        }

        const count = Number(countStr);

        if (
            !Number.isSafeInteger(count) ||
            count < 0 ||
            count > MAX_REPEAT
        ) {
            throw new RangeError("Invalid RLE repeat count");
        }

        output.push(compressed[i].repeat(count));
        i++;
    }

    return output.join("");
}

    /* -------------------------------------------------------
       JSON COMPRESSION (Optimized + Optional RLE)
    -------------------------------------------------------- */

    static compressJSON(obj, { useRLE = false } = {}) {
        if (obj === undefined) throw new Error("Cannot compress undefined");

        const json = JSON.stringify(obj);
        return useRLE ? this.compressRLE(json) : json;
    }

    static decompressJSON(data, { isRLE = false } = {}) {
        try {
            const json = isRLE ? this.decompressRLE(data) : data;
            return JSON.parse(json);
        } catch (err) {
            throw new Error("Invalid compressed JSON: " + err.message);
        }
    }

    /* -------------------------------------------------------
       BASE64 (Transport Safe)
    -------------------------------------------------------- */

    static toBase64(uint8) {
        if (this.isNode) {
            return Buffer.from(uint8).toString("base64");
        }
        let binary = "";
        const chunkSize = 0x8000;
        for (let i = 0; i < uint8.length; i += chunkSize) {
            binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
        }
        return btoa(binary);
    }

    static fromBase64(base64) {
        if (this.isNode) {
            return new Uint8Array(Buffer.from(base64, "base64"));
        }
        const binary = atob(base64);
        const arr = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            arr[i] = binary.charCodeAt(i);
        }
        return arr;
    }

    /* -------------------------------------------------------
       GZIP / BROTLI (Browser + Node.js)
    -------------------------------------------------------- */

    static async compressGzip(input = "") {
        const data = this.#toUint8(input);

        // Browser Streams API
        if (this.hasStreamsAPI) {
            return this.#streamCompress(data, "gzip");
        }

        // Node.js fallback
        if (this.isNode) {
            const zlib = await import("zlib");
            return zlib.gzipSync(data);
        }

        // Final fallback
        return this.#toUint8(this.compressRLE(input));
    }

    static async decompressGzip(data) {
        const uint8 = this.#toUint8(data);

        if (typeof DecompressionStream !== "undefined") {
            const result = await this.#streamDecompress(uint8, "gzip");
            return new TextDecoder().decode(result);
        }

        if (this.isNode) {
            const zlib = await import("zlib");
            return zlib.gunzipSync(uint8).toString();
        }

        return this.decompressRLE(new TextDecoder().decode(uint8));
    }

    static async compressBrotli(input = "") {
        const data = this.#toUint8(input);

        if (this.isNode) {
            const zlib = await import("zlib");
            return zlib.brotliCompressSync(data);
        }

        // Browser fallback to gzip
        return this.compressGzip(input);
    }

    static async decompressBrotli(data) {
        const uint8 = this.#toUint8(data);

        if (this.isNode) {
            const zlib = await import("zlib");
            return zlib.brotliDecompressSync(uint8).toString();
        }

        return this.decompressGzip(uint8);
    }

    /* -------------------------------------------------------
       STREAM COMPRESSION (Large Data)
    -------------------------------------------------------- */

    static async #streamCompress(uint8, format) {
        const stream = new CompressionStream(format);
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(uint8);
        writer.close();

        return this.#collectStream(reader);
    }

    static async #streamDecompress(uint8, format) {
        const stream = new DecompressionStream(format);
        const writer = stream.writable.getWriter();
        const reader = stream.readable.getReader();

        writer.write(uint8);
        writer.close();

        return this.#collectStream(reader);
    }

    static async #collectStream(reader) {
        const chunks = [];
        let done = false;

        while (!done) {
            const { value, done: rDone } = await reader.read();
            done = rDone;
            if (value) chunks.push(value);
        }

        return this.#mergeUint8Arrays(chunks);
    }

    /* -------------------------------------------------------
       METRICS & ANALYTICS
    -------------------------------------------------------- */

    static getCompressionRatio(original, compressed) {
        const originalSize = this.#byteLength(original);
        const compressedSize = this.#byteLength(compressed);

        if (originalSize === 0) return 0;
        return +(1 - compressedSize / originalSize).toFixed(4);
    }

    static estimateSize(data) {
        return this.#byteLength(data);
    }

    /* -------------------------------------------------------
       PRIVATE UTILS
    -------------------------------------------------------- */

    static #toUint8(input) {
        if (input instanceof Uint8Array) return input;
        if (this.isNode && Buffer.isBuffer(input)) {
            return new Uint8Array(input);
        }
        if (typeof input === "string") {
            return new TextEncoder().encode(input);
        }
        throw new Error("Unsupported input type");
    }

    static #byteLength(data) {
        if (typeof data === "string") return new TextEncoder().encode(data).length;
        if (data instanceof Uint8Array) return data.length;
        if (this.isNode && Buffer.isBuffer(data)) return data.length;
        return 0;
    }

    static #mergeUint8Arrays(chunks) {
        const total = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Uint8Array(total);

        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        return merged;
    }
}
