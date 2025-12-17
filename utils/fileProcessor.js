/**
 * Advanced File Processing Utilities for Node.js (Upgraded)
 * Safe, scalable, production-ready
 */

const fs = require("fs/promises");
const fss = require("fs");
const path = require("path");
const crypto = require("crypto");
const { pipeline } = require("stream/promises");
const os = require("os");

class FileProcessor {

    /* -------------------------------------------------------------------------- */
    /*                               VALIDATION                                    */
    /* -------------------------------------------------------------------------- */

    static _validatePath(p) {
        if (!p || typeof p !== "string") {
            throw new TypeError("Invalid path provided");
        }
    }

    /* -------------------------------------------------------------------------- */
    /*                               DIRECTORY HELPERS                             */
    /* -------------------------------------------------------------------------- */

    static async readDirectory(dirPath, options = { recursive: false }) {
        this._validatePath(dirPath);

        const results = [];
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory() && options.recursive) {
                results.push(...await this.readDirectory(fullPath, options));
            } else if (entry.isFile()) {
                results.push(fullPath);
            }
        }
        return results;
    }

    static async ensureDirectory(dirPath) {
        this._validatePath(dirPath);
        await fs.mkdir(dirPath, { recursive: true });
        return dirPath;
    }

    static async copyDirectory(src, dest) {
        await this.ensureDirectory(dest);
        const entries = await fs.readdir(src, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            entry.isDirectory()
                ? await this.copyDirectory(srcPath, destPath)
                : await fs.copyFile(srcPath, destPath);
        }
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
    /*                                SAFE WRITE                                   */
    /* -------------------------------------------------------------------------- */

    static async writeTextAtomic(filePath, data) {
        await this.ensureDirectory(path.dirname(filePath));
        const temp = `${filePath}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(temp, data, "utf8");
        await fs.rename(temp, filePath);
    }

    static async writeJSON(filePath, obj) {
        return this.writeTextAtomic(filePath, JSON.stringify(obj, null, 2));
    }

    static async readJSON(filePath) {
        return JSON.parse(await fs.readFile(filePath, "utf8"));
    }

    /* -------------------------------------------------------------------------- */
    /*                                COPY / MOVE                                  */
    /* -------------------------------------------------------------------------- */

    static async copyFile(src, dest) {
        await this.ensureDirectory(path.dirname(dest));
        await fs.copyFile(src, dest);
        return dest;
    }

    static async moveFile(src, dest) {
        try {
            await this.ensureDirectory(path.dirname(dest));
            await fs.rename(src, dest);
        } catch {
            await this.copyFile(src, dest);
            await fs.unlink(src);
        }
        return dest;
    }

    /* -------------------------------------------------------------------------- */
    /*                               STREAM OPERATIONS                              */
    /* -------------------------------------------------------------------------- */

    static async readLargeFile(filePath, onChunk) {
        const stream = fss.createReadStream(filePath);
        for await (const chunk of stream) {
            onChunk(chunk);
        }
    }

    static async streamCopy(src, dest, onProgress) {
        await this.ensureDirectory(path.dirname(dest));
        const total = (await fs.stat(src)).size;
        let transferred = 0;

        await pipeline(
            fss.createReadStream(src),
            new (require("stream").Transform)({
                transform(chunk, _, cb) {
                    transferred += chunk.length;
                    onProgress?.((transferred / total) * 100);
                    cb(null, chunk);
                }
            }),
            fss.createWriteStream(dest)
        );
    }

    /* -------------------------------------------------------------------------- */
    /*                               FILE HASHING                                  */
    /* -------------------------------------------------------------------------- */

    static async hashFile(filePath, algorithm = "sha256") {
        const hash = crypto.createHash(algorithm);
        await pipeline(
            fss.createReadStream(filePath),
            hash
        );
        return hash.digest("hex");
    }

    /* -------------------------------------------------------------------------- */
    /*                               BACKUP SYSTEM                                 */
    /* -------------------------------------------------------------------------- */

    static async createBackup(filePath) {
        if (!(await this.fileExists(filePath))) {
            throw new Error("File does not exist");
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
    /*                               BULK OPERATIONS                               */
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
