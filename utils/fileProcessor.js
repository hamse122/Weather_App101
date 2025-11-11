// File processing utilities for Node.js
const fs = require('fs').promises;
const path = require('path');

class FileProcessor {
    static async readDirectory(dirPath, recursive = false) {
        try {
            const items = await fs.readdir(dirPath);
            const files = [];
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = await fs.stat(fullPath);
                
                if (stat.isDirectory() && recursive) {
                    const subFiles = await this.readDirectory(fullPath, true);
                    files.push(...subFiles);
                } else if (stat.isFile()) {
                    files.push(fullPath);
                }
            }
            
            return files;
        } catch (error) {
            throw new Error(`Failed to read directory: ${error.message}`);
        }
    }
    
    static async findFilesByExtension(dirPath, extensions, recursive = false) {
        const files = await this.readDirectory(dirPath, recursive);
        return files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return extensions.includes(ext);
        });
    }
    
    static async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    static async createBackup(filePath) {
        const backupPath = `${filePath}.backup`;
        await fs.copyFile(filePath, backupPath);
        return backupPath;
    }
    
    static async getFileInfo(filePath) {
        const stat = await fs.stat(filePath);
        return {
            size: stat.size,
            modified: stat.mtime,
            created: stat.birthtime,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile()
        };
    }
}

module.exports = FileProcessor;

