/**
 * Compression Utility
 * Text compression and decompression utilities (RLE, Gzip, JSON)
 */

export class Compression {

    /* -------------------------------------------------------
       SIMPLE RLE (Run-Length Encoding)
    -------------------------------------------------------- */

    /**
     * Compress string using simple RLE (Run-Length Encoding)
     * @param {string} str
     * @returns {string}
     */
    static compressRLE(str = "") {
        if (typeof str !== "string") return "";

        let compressed = "";
        let count = 1;

        for (let i = 0; i < str.length; i++) {
            if (str[i] === str[i + 1]) {
                count++;
            } else {
                compressed += (count > 3) ? count + str[i] : str[i].repeat(count);
                count = 1;
            }
        }

        return compressed;
    }

    /**
     * Decompress RLE compressed string
     * @param {string} compressed
     * @returns {string}
     */
    static decompressRLE(compressed = "") {
        let output = "";
        let i = 0;

        while (i < compressed.length) {
            // If digits → extract full number
            if (/\d/.test(compressed[i])) {
                let count = "";
                while (/\d/.test(compressed[i])) {
                    count += compressed[i];
                    i++;
                }

                const char = compressed[i];
                output += char.repeat(parseInt(count, 10));
            } else {
                // No number → literal char
                output += compressed[i];
            }
            i++;
        }

        return output;
    }

    /* -------------------------------------------------------
       JSON COMPRESSION
    -------------------------------------------------------- */

    /**
     * Compress JSON by removing whitespace
     */
    static compressJSON(obj) {
        return JSON.stringify(obj);
    }

    /**
     * Decompress JSON
     */
    static decompressJSON(json) {
        try {
            return JSON.parse(json);
        } catch {
            throw new Error("Invalid JSON input");
        }
    }

    /* -------------------------------------------------------
       GZIP COMPRESSION (Browser CompressionStream API)
    -------------------------------------------------------- */

    /**
     * Gzip compress text
     * @param {string} str
     * @returns {Promise<Uint8Array>}
     */
    static async compressGzip(str = "") {
        const encoder = new TextEncoder();

        if (typeof CompressionStream !== "undefined") {
            const stream = new CompressionStream("gzip");
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();

            writer.write(encoder.encode(str));
            writer.close();

            const chunks = [];
            let done = false;

            while (!done) {
                const { value, done: rDone } = await reader.read();
                done = rDone;
                if (value) chunks.push(value);
            }

            return this.#mergeUint8Arrays(chunks);
        }

        // Fallback to simple RLE
        return encoder.encode(this.compressRLE(str));
    }

    /**
     * Gzip decompress
     * @param {Uint8Array} data
     * @returns {Promise<string>}
     */
    static async decompressGzip(data) {
        const decoder = new TextDecoder();

        if (typeof DecompressionStream !== "undefined") {
            const stream = new DecompressionStream("gzip");
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();

            writer.write(data);
            writer.close();

            const chunks = [];
            let done = false;

            while (!done) {
                const { value, done: rDone } = await reader.read();
                done = rDone;
                if (value) chunks.push(value);
            }

            const output = this.#mergeUint8Arrays(chunks);
            return decoder.decode(output);
        }

        // Fallback to RLE
        return this.decompressRLE(decoder.decode(data));
    }

    /* -------------------------------------------------------
       PRIVATE UTILS
    -------------------------------------------------------- */

    /**
     * Merge multiple Uint8Array chunks into one
     * @param {Uint8Array[]} chunks
     * @returns {Uint8Array}
     * @private
     */
    static #mergeUint8Arrays(chunks) {
        const total = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(total);

        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }

        return merged;
    }
}
