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

/**
 * Advanced Logger (v2)
 * - Structured
 * - Transport-based
 * - Context-aware
 * - Async-ready
 * - Hooks
 * - Timing
 * - Zero dependencies
 */

class Logger {
    constructor(options = {}) {
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };

        this.level = options.level ?? "info";
        this.transports = options.transports ?? [];
        this.timestamps = options.timestamps !== false;
        this.context = Object.freeze({ ...(options.context || {}) });

        this.silent = false;

        // NEW
        this.sequence = 0;
        this.beforeHooks = [];
        this.afterHooks = [];
    }

    child(context = {}) {
        return new Logger({
            level: this.level,
            transports: this.transports,
            timestamps: this.timestamps,
            context: {
                ...this.context,
                ...context
            }
        });
    }

    setLevel(level) {
        if (!(level in this.levels)) {
            throw new Error(`Unknown log level: ${level}`);
        }

        this.level = level;
        return this;
    }

    mute(value = true) {
        this.silent = !!value;
        return this;
    }

    addTransport(transport) {
        if (!transport || typeof transport.write !== "function") {
            throw new TypeError(
                "Transport must implement write(entry)"
            );
        }

        this.transports.push(transport);
        return this;
    }

    removeTransport(transport) {
        this.transports = this.transports.filter(
            t => t !== transport
        );
        return this;
    }

    before(fn) {
        if (typeof fn === "function") {
            this.beforeHooks.push(fn);
        }
        return this;
    }

    after(fn) {
        if (typeof fn === "function") {
            this.afterHooks.push(fn);
        }
        return this;
    }

    async log(level, message, meta = {}) {
        if (this.silent) return;

        if (!(level in this.levels)) {
            throw new Error(`Unknown log level: ${level}`);
        }

        if (this.levels[level] > this.levels[this.level]) {
            return;
        }

        const entry = this.#createEntry(level, message, meta);

        try {
            for (const hook of this.beforeHooks) {
                await hook(entry);
            }

            await Promise.all(
                this.transports
                    .filter(
                        t =>
                            this.levels[level] <=
                            this.levels[t.level ?? this.level]
                    )
                    .map(t => Promise.resolve(t.write(entry)))
            );

            for (const hook of this.afterHooks) {
                await hook(entry);
            }

        } catch (err) {
            console.error("[Logger]", err);
        }

        return entry;
    }

    time(label = "default") {
        const start = performance?.now?.() ?? Date.now();

        return () => {
            const end = performance?.now?.() ?? Date.now();

            this.info(label, {
                durationMs: +(end - start).toFixed(3)
            });
        };
    }

    #createEntry(level, message, meta) {
        if (message instanceof Error) {
            meta = {
                stack: message.stack,
                name: message.name,
                cause: message.cause,
                ...meta
            };

            message = message.message;
        }

        return Object.freeze({
            id: ++this.sequence,
            level,
            message,
            timestamp: this.timestamps
                ? new Date().toISOString()
                : undefined,
            pid:
                typeof process !== "undefined"
                    ? process.pid
                    : undefined,
            context: this.context,
            meta
        });
    }

    error(msg, meta) { return this.log("error", msg, meta); }
    warn(msg, meta) { return this.log("warn", msg, meta); }
    info(msg, meta) { return this.log("info", msg, meta); }
    debug(msg, meta) { return this.log("debug", msg, meta); }
    trace(msg, meta) { return this.log("trace", msg, meta); }
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
/*                               SAFE WRITE (v2)                              */
/* -------------------------------------------------------------------------- */

static async writeTextAtomic(filePath, data, options = {}) {
    filePath = this._validatePath(filePath);

    const {
        encoding = "utf8",
        mode = 0o666,
        fsync = true
    } = options;

    await this.ensureDirectory(path.dirname(filePath));

    const temp = path.join(
        path.dirname(filePath),
        `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`
    );

    let handle;

    try {
        handle = await fs.open(temp, "w", mode);

        await this._retry(() =>
            handle.writeFile(
                typeof data === "string" || Buffer.isBuffer(data)
                    ? data
                    : String(data),
                encoding
            )
        );

        if (fsync) {
            await handle.sync();
        }

        await handle.close();

        await fs.rename(temp, filePath);

        this._log(`Written atomically: ${filePath}`);

        return true;

    } catch (err) {

        try {
            await handle?.close();
        } catch {}

        try {
            await fs.unlink(temp);
        } catch {}

        throw err;
    }
}

static async writeJSON(filePath, obj, options = {}) {
    return this.writeTextAtomic(
        filePath,
        JSON.stringify(obj, null, options.indent ?? 2),
        options
    );
}

static async readJSON(filePath, options = {}) {
    filePath = this._validatePath(filePath);

    try {
        const text = await fs.readFile(
            filePath,
            options.encoding ?? "utf8"
        );

        return JSON.parse(text);

    } catch (err) {

        if (
            err.code === "ENOENT" &&
            "defaultValue" in options
        ) {
            return typeof options.defaultValue === "function"
                ? options.defaultValue()
                : options.defaultValue;
        }

        throw new Error(
            `Failed to read JSON '${filePath}': ${err.message}`
        );
    }
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
