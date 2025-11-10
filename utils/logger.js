// Advanced logging system
class Logger {
    constructor(options = {}) {
        this.level = options.level || 'info';
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        this.transports = options.transports || [console];
        this.timestamps = options.timestamps !== false;
    }
    
    log(level, message, meta = {}) {
        if (this.levels[level] > this.levels[this.level]) return;
        
        const timestamp = this.timestamps ? new Date().toISOString() : '';
        const logEntry = {
            level,
            message,
            timestamp,
            meta
        };
        
        this.transports.forEach(transport => {
            const method = transport[level] || transport.log || console.log;
            method.call(transport, this.formatLogEntry(logEntry));
        });
    }
    
    formatLogEntry(entry) {
        return `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message} ${
            Object.keys(entry.meta).length ? JSON.stringify(entry.meta) : ''
        }`.trim();
    }
    
    error(message, meta) {
        this.log('error', message, meta);
    }
    
    warn(message, meta) {
        this.log('warn', message, meta);
    }
    
    info(message, meta) {
        this.log('info', message, meta);
    }
    
    debug(message, meta) {
        this.log('debug', message, meta);
    }
    
    addTransport(transport) {
        this.transports.push(transport);
    }
}

// File transport example (for Node.js)
class FileTransport {
    constructor(filename) {
        this.filename = filename;
        const fs = require('fs');
        this.stream = fs.createWriteStream(filename, { flags: 'a' });
    }
    
    log(message) {
        this.stream.write(message + '\n');
    }
}

module.exports = { Logger, FileTransport };

