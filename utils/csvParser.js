/**
 * CSV Parser Utility
 * CSV parser and generator for handling CSV data
 */

/**
 * CSVParser class for parsing and generating CSV files
 */
export class CSVParser {
    /**
     * Parse CSV text into structured data
     * @param {string} csvText - CSV text content
     * @param {string} delimiter - CSV delimiter (default: ',')
     * @param {boolean} hasHeaders - Whether CSV has headers (default: true)
     * @returns {Object} - Object with headers and data arrays
     */
    static parse(csvText, delimiter = ',', hasHeaders = true) {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length === 0) return { headers: [], data: [] };
        
        const headers = hasHeaders ? 
            this.parseLine(lines[0], delimiter) : 
            Array.from({ length: this.parseLine(lines[0], delimiter).length }, (_, i) => `Column${i + 1}`);
        
        const data = [];
        const startLine = hasHeaders ? 1 : 0;
        
        for (let i = startLine; i < lines.length; i++) {
            const values = this.parseLine(lines[i], delimiter);
            const row = {};
            
            headers.forEach((header, index) => {
                row[header] = values[index] || '';
            });
            
            data.push(row);
        }
        
        return { headers, data };
    }
    
    /**
     * Parse a single CSV line handling quoted values
     * @param {string} line - CSV line
     * @param {string} delimiter - CSV delimiter
     * @returns {Array} - Array of parsed values
     */
    static parseLine(line, delimiter) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === delimiter && !inQuotes) {
                result.push(this.cleanValue(current));
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(this.cleanValue(current));
        return result;
    }
    
    /**
     * Clean and trim a CSV value
     * @param {string} value - Raw value
     * @returns {string} - Cleaned value
     */
    static cleanValue(value) {
        return value.trim().replace(/^"|"$/g, '');
    }
    
    /**
     * Generate CSV text from data array
     * @param {Array} data - Array of objects
     * @param {Array} headers - Optional headers array
     * @returns {string} - CSV text
     */
    static generate(data, headers = null) {
        const actualHeaders = headers || Object.keys(data[0] || {});
        let csv = actualHeaders.map(h => `"${h}"`).join(',') + '\n';
        
        data.forEach(row => {
            const values = actualHeaders.map(header => `"${row[header] || ''}"`);
            csv += values.join(',') + '\n';
        });
        
        return csv;
    }
}


