/**
 * Advanced File Processing Utilities v2 (Enterprise Grade)
 */

const fs = require("fs/promises");
const fss = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const { Transform } = require("stream");
const os = require("os");

class FileError extends Error {
    constructor(message, filePath) {
        super(message);
        this.name = "FileError";
        this.filePath = filePath;
    }
}

class FileProcessor {

    static config = {
        retries: 2,
        retryDelay: 100,
        logger: null // optional: (msg) => console.log(msg)
    };

    /* -------------------------------------------------------------------------- */
    /*                               INTERNAL HELPERS                              */
    /* -------------------------------------------------------------------------- */

    static _log(msg) {
        if (this.config.logger) this.config.logger(msg);
    }

    static _validatePath(p) {
        if (!p || typeof p !== "string") {
            throw new TypeError("Invalid path provided");
        }
        return path.normalize(p);
    }

    static async _retry(fn) {
        let lastErr;
        for (let i = 0; i <= this.config.retries; i++) {
            try {
                return await fn();
            } catch (err) {
                lastErr = err;
                await new Promise(r => setTimeout(r, this.config.retryDelay));
            }
        }
        throw lastErr;
    }

    /* -------------------------------------------------------------------------- */
    /*                               DIRECTORY OPS                                 */
    /* -------------------------------------------------------------------------- */

    static async readDirectory(dirPath, { recursive = false } = {}) {
        dirPath = this._validatePath(dirPath);

        const results = [];
        const stack = [dirPath];

        while (stack.length) {
            const current = stack.pop();
            const entries = await fs.readdir(current, { withFileTypes: true });

            for (const entry of entries) {
                const full = path.join(current, entry.name);
                if (entry.isDirectory() && recursive) {
                    stack.push(full);
                } else if (entry.isFile()) {
                    results.push(full);
                }
            }
        }

        return results;
    }

    static async ensureDirectory(dirPath) {
        dirPath = this._validatePath(dirPath);
        await fs.mkdir(dirPath, { recursive: true });
        return dirPath;
    }

    static async copyDirectory(src, dest) {
        src = this._validatePath(src);
        dest = this._validatePath(dest);

        await this.ensureDirectory(dest);

        const entries = await fs.readdir(src, { withFileTypes: true });

        await Promise.all(entries.map(async (entry) => {
            const s = path.join(src, entry.name);
            const d = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                return this.copyDirectory(s, d);
            } else {
                return fs.copyFile(s, d);
            }
        }));
    }

    /* -------------------------------------------------------------------------- */
    /*                               FILE CHECKING                                 */
    /* -------------------------------------------------------------------------- */

    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                               FILE METADATA                                 */
    /* -------------------------------------------------------------------------- */

    static async getFileInfo(filePath) {
        filePath = this._validatePath(filePath);

        const stat = await fs.stat(filePath);

        return {
            size: stat.size,
            sizeFormatted: this.formatFileSize(stat.size),
            created: stat.birthtime,
            modified: stat.mtime,
            permissions: stat.mode,
            isFile: stat.isFile(),
            isDirectory: stat.isDirectory()
        };
    }

    static formatFileSize(bytes) {
        const units = ["B", "KB", "MB", "GB", "TB"];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return `${bytes.toFixed(2)} ${units[i]}`;
    }

    /* -------------------------------------------------------------------------- */
    /*                               SAFE WRITE                                    */
    /* -------------------------------------------------------------------------- */

    static async writeTextAtomic(filePath, data) {
        filePath = this._validatePath(filePath);

        await this.ensureDirectory(path.dirname(filePath));

        const temp = `${filePath}.${crypto.randomUUID()}.tmp`;

        await this._retry(() => fs.writeFile(temp, data, "utf8"));
        await fs.rename(temp, filePath);

        this._log(`Written atomically: ${filePath}`);
    }

    static async writeJSON(filePath, obj) {
        return this.writeTextAtomic(filePath, JSON.stringify(obj, null, 2));
    }

    static async readJSON(filePath) {
        filePath = this._validatePath(filePath);
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }

    /* -------------------------------------------------------------------------- */
    /*                               COPY / MOVE                                   */
    /* -------------------------------------------------------------------------- */

    static async copyFile(src, dest) {
        src = this._validatePath(src);
        dest = this._validatePath(dest);

        await this.ensureDirectory(path.dirname(dest));

        await this._retry(() => fs.copyFile(src, dest));

        return dest;
    }

    static async moveFile(src, dest) {
        src = this._validatePath(src);
        dest = this._validatePath(dest);

        try {
            await fs.rename(src, dest);
        } catch {
            await this.copyFile(src, dest);
            await fs.unlink(src);
        }

        return dest;
    }

    /* -------------------------------------------------------------------------- */
    /*                               STREAM OPS                                    */
    /* -------------------------------------------------------------------------- */

    static async streamCopy(src, dest, onProgress) {
        src = this._validatePath(src);
        dest = this._validatePath(dest);

        await this.ensureDirectory(path.dirname(dest));

        const total = (await fs.stat(src)).size;
        let transferred = 0;

        const progressStream = new Transform({
            transform(chunk, _, cb) {
                transferred += chunk.length;
                onProgress?.((transferred / total) * 100);
                cb(null, chunk);
            }
        });

        await pipeline(
            fss.createReadStream(src),
            progressStream,
            fss.createWriteStream(dest)
        );
    }

    static async readLargeFile(filePath, onChunk) {
        filePath = this._validatePath(filePath);

        const stream = fss.createReadStream(filePath);

        for await (const chunk of stream) {
            onChunk(chunk);
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                               HASHING                                       */
    /* -------------------------------------------------------------------------- */

    static async hashFile(filePath, algorithm = "sha256") {
        filePath = this._validatePath(filePath);

        const hash = crypto.createHash(algorithm);

        await pipeline(
            fss.createReadStream(filePath),
            hash
        );

        return hash.digest("hex");
    }

    /* -------------------------------------------------------------------------- */
    /*                               BACKUP                                        */
    /* -------------------------------------------------------------------------- */

    static async createBackup(filePath) {
        filePath = this._validatePath(filePath);

        if (!(await this.fileExists(filePath))) {
            throw new FileError("File does not exist", filePath);
        }

        let i = 0;
        let backup;

        do {
            backup = `${filePath}.backup${i ? "." + i : ""}`;
            i++;
        } while (await this.fileExists(backup));

        await fs.copyFile(filePath, backup);

        return backup;
    }

    /* -------------------------------------------------------------------------- */
    /*                               BULK DELETE                                   */
    /* -------------------------------------------------------------------------- */

    static async deleteFiles(files, concurrency = os.cpus().length) {
        const queue = [...files];
        const results = [];

        const worker = async () => {
            while (queue.length) {
                const file = queue.pop();
                try {
                    await fs.unlink(file);
                    results.push({ file, status: "deleted" });
                } catch (e) {
                    results.push({ file, status: "error", error: e.message });
                }
            }
        };

        await Promise.all(
            Array.from({ length: concurrency }, worker)
        );

        return results;
    }
}

module.exports = FileProcessor;
