/**
 * Advanced File Processing Utilities for Node.js
 * Provides safe, scalable, and feature-rich file operations.
 */

const fs = require("fs").promises;
const fss = require("fs"); // For streaming
const path = require("path");
const crypto = require("crypto");

class FileProcessor {
    /* -------------------------------------------------------------------------- */
    /*                               DIRECTORY HELPERS                             */
    /* -------------------------------------------------------------------------- */

    static async readDirectory(dirPath, recursive = false) {
        try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });
            const result = [];

            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);

                if (item.isDirectory()) {
                    if (recursive) {
                        const sub = await this.readDirectory(fullPath, true);
                        result.push(...sub);
                    }
                } else if (item.isFile()) {
                    result.push(fullPath);
                }
            }

            return result;
        } catch (err) {
            throw new Error(`Failed to read directory "${dirPath}": ${err.message}`);
        }
    }

    static async findFilesByExtension(dirPath, extensions, recursive = false) {
        extensions = extensions.map(e => e.toLowerCase());
        const files = await this.readDirectory(dirPath, recursive);

        return files.filter(file => 
            extensions.includes(path.extname(file).toLowerCase())
        );
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

    static async ensureDirectory(dirPath) {
        await fs.mkdir(dirPath, { recursive: true });
        return dirPath;
    }

    /* -------------------------------------------------------------------------- */
    /*                                FILE METADATA                                */
    /* -------------------------------------------------------------------------- */

    static async getFileInfo(filePath) {
        try {
            const stat = await fs.stat(filePath);
            return {
                size: stat.size,
                sizeFormatted: this.formatFileSize(stat.size),
                modified: stat.mtime,
                created: stat.birthtime,
                isDirectory: stat.isDirectory(),
                isFile: stat.isFile()
            };
        } catch (err) {
            throw new Error(`Cannot get file info for "${filePath}": ${err.message}`);
        }
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
    /*                               BACKUP SYSTEM                                 */
    /* -------------------------------------------------------------------------- */

    static async createBackup(filePath) {
        if (!(await this.fileExists(filePath))) {
            throw new Error(`Cannot create backup: file "${filePath}" does not exist`);
        }

        let version = 1;
        let backupPath = `${filePath}.backup`;

        while (await this.fileExists(backupPath)) {
            backupPath = `${filePath}.backup.${version++}`;
        }

        await fs.copyFile(filePath, backupPath);
        return backupPath;
    }

    /* -------------------------------------------------------------------------- */
    /*                                COPY / MOVE                                  */
    /* -------------------------------------------------------------------------- */

    static async copyFile(source, destination) {
        await this.ensureDirectory(path.dirname(destination));
        await fs.copyFile(source, destination);
        return destination;
    }

    static async moveFile(source, destination) {
        await this.ensureDirectory(path.dirname(destination));
        await fs.rename(source, destination);
        return destination;
    }

    /* -------------------------------------------------------------------------- */
    /*                             READ / WRITE FILES                              */
    /* -------------------------------------------------------------------------- */

    static async readText(filePath) {
        return fs.readFile(filePath, "utf-8");
    }

    static async writeText(filePath, data) {
        await this.ensureDirectory(path.dirname(filePath));
        return fs.writeFile(filePath, data, "utf-8");
    }

    static async writeJSON(filePath, obj) {
        const json = JSON.stringify(obj, null, 4);
        return this.writeText(filePath, json);
    }

    static async readJSON(filePath) {
        const raw = await this.readText(filePath);
        return JSON.parse(raw);
    }

    /* -------------------------------------------------------------------------- */
    /*                              STREAM OPERATIONS                               */
    /* -------------------------------------------------------------------------- */

    static async readLargeFile(filePath, onChunk, chunkSize = 64 * 1024) {
        return new Promise((resolve, reject) => {
            const stream = fss.createReadStream(filePath, { highWaterMark: chunkSize });

            stream.on("data", chunk => onChunk(chunk));
            stream.on("end", resolve);
            stream.on("error", err => reject(new Error(`Stream error: ${err.message}`)));
        });
    }

    /* -------------------------------------------------------------------------- */
    /*                               FILE HASHING                                   */
    /* -------------------------------------------------------------------------- */

    static async hashFile(filePath, algorithm = "sha256") {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(algorithm);
            const stream = fss.createReadStream(filePath);

            stream.on("data", data => hash.update(data));
            stream.on("end", () => resolve(hash.digest("hex")));
            stream.on("error", err => reject(err));
        });
    }

    /* -------------------------------------------------------------------------- */
    /*                               BULK OPERATIONS                                */
    /* -------------------------------------------------------------------------- */

    static async deleteFiles(filePaths) {
        const results = [];

        for (const file of filePaths) {
            try {
                await fs.unlink(file);
                results.push({ file, status: "deleted" });
            } catch (err) {
                results.push({ file, status: "error", error: err.message });
            }
        }

        return results;
    }
}

module.exports = FileProcessor;
