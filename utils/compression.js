/**
 * Compression Utility
 * Text compression and decompression utilities
 */

/**
 * Compression class for compressing and decompressing text
 */
export class Compression {
    /**
     * Compress string using simple RLE (Run-Length Encoding)
     * @param {string} str - String to compress
     * @returns {string} - Compressed string
     */
    static compressRLE(str) {
        let compressed = '';
        let count = 1;
        
        for (let i = 0; i < str.length; i++) {
            if (str[i] === str[i + 1]) {
                count++;
            } else {
                if (count > 3) {
                    compressed += count + str[i];
                } else {
                    compressed += str[i].repeat(count);
                }
                count = 1;
            }
        }
        
        return compressed;
    }
    
    /**
     * Decompress RLE compressed string
     * @param {string} compressed - Compressed string
     * @returns {string} - Decompressed string
     */
    static decompressRLE(compressed) {
        let decompressed = '';
        let i = 0;
        
        while (i < compressed.length) {
            if (/\d/.test(compressed[i])) {
                let count = '';
                while (/\d/.test(compressed[i])) {
                    count += compressed[i];
                    i++;
                }
                decompressed += compressed[i].repeat(parseInt(count, 10));
            } else {
                decompressed += compressed[i];
            }
            i++;
        }
        
        return decompressed;
    }
    
    /**
     * Compress JSON by removing whitespace
     * @param {Object} obj - Object to compress
     * @returns {string} - Compressed JSON string
     */
    static compressJSON(obj) {
        return JSON.stringify(obj);
    }
    
    /**
     * Decompress JSON
     * @param {string} json - Compressed JSON string
     * @returns {Object} - Decompressed object
     */
    static decompressJSON(json) {
        return JSON.parse(json);
    }
    
    /**
     * Gzip compress (using browser CompressionStream if available)
     * @param {string} str - String to compress
     * @returns {Promise<Uint8Array>} - Compressed data
     */
    static async compressGzip(str) {
        if (typeof CompressionStream !== 'undefined') {
            const stream = new CompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();
            
            const encoder = new TextEncoder();
            writer.write(encoder.encode(str));
            writer.close();
            
            const chunks = [];
            let done = false;
            
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) chunks.push(value);
            }
            
            const compressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            chunks.forEach(chunk => {
                compressed.set(chunk, offset);
                offset += chunk.length;
            });
            
            return compressed;
        }
        
        return new TextEncoder().encode(this.compressRLE(str));
    }
    
    /**
     * Gzip decompress (using browser DecompressionStream if available)
     * @param {Uint8Array} data - Compressed data
     * @returns {Promise<string>} - Decompressed string
     */
    static async decompressGzip(data) {
        if (typeof DecompressionStream !== 'undefined') {
            const stream = new DecompressionStream('gzip');
            const writer = stream.writable.getWriter();
            const reader = stream.readable.getReader();
            
            writer.write(data);
            writer.close();
            
            const chunks = [];
            let done = false;
            
            while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) chunks.push(value);
            }
            
            const decompressed = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
            let offset = 0;
            chunks.forEach(chunk => {
                decompressed.set(chunk, offset);
                offset += chunk.length;
            });
            
            return new TextDecoder().decode(decompressed);
        }
        
        return this.decompressRLE(new TextDecoder().decode(data));
    }
}
