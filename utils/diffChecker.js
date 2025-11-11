/**
 * Diff Checker Utility
 * Text difference checker and comparison tool
 */

/**
 * DiffChecker class for comparing text differences
 */
export class DiffChecker {
    /**
     * Compare two texts and return differences
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {Array} - Array of diff objects
     */
    static compare(text1, text2) {
        const lines1 = text1.split('\n');
        const lines2 = text2.split('\n');
        const result = [];
        
        const maxLines = Math.max(lines1.length, lines2.length);
        
        for (let i = 0; i < maxLines; i++) {
            const line1 = lines1[i] || '';
            const line2 = lines2[i] || '';
            
            if (line1 === line2) {
                result.push({ type: 'unchanged', line: line1, lineNumber: i + 1 });
            } else if (line1 && !line2) {
                result.push({ type: 'removed', line: line1, lineNumber: i + 1 });
            } else if (!line1 && line2) {
                result.push({ type: 'added', line: line2, lineNumber: i + 1 });
            } else {
                result.push({ type: 'modified', oldLine: line1, newLine: line2, lineNumber: i + 1 });
            }
        }
        
        return result;
    }
    
    /**
     * Generate a patch string from diff results
     * @param {Array} diff - Diff results array
     * @returns {string} - Patch string
     */
    static generatePatch(diff) {
        let patch = '';
        diff.forEach(change => {
            switch (change.type) {
                case 'removed':
                    patch += `- ${change.line}\n`;
                    break;
                case 'added':
                    patch += `+ ${change.line}\n`;
                    break;
                case 'modified':
                    patch += `- ${change.oldLine}\n`;
                    patch += `+ ${change.newLine}\n`;
                    break;
                default:
                    patch += `  ${change.line}\n`;
            }
        });
        return patch;
    }
    
    /**
     * Calculate similarity percentage between two texts
     * @param {string} text1 - First text
     * @param {string} text2 - Second text
     * @returns {number} - Similarity percentage (0-1)
     */
    static similarity(text1, text2) {
        const longer = text1.length > text2.length ? text1 : text2;
        const shorter = text1.length > text2.length ? text2 : text1;
        
        if (longer.length === 0) return 1.0;
        
        return (longer.length - this.editDistance(longer, shorter)) / parseFloat(longer.length);
    }
    
    /**
     * Calculate edit distance (Levenshtein distance) between two strings
     * @param {string} s1 - First string
     * @param {string} s2 - Second string
     * @returns {number} - Edit distance
     */
    static editDistance(s1, s2) {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();
        
        const costs = [];
        for (let i = 0; i <= s1.length; i++) {
            let lastValue = i;
            for (let j = 0; j <= s2.length; j++) {
                if (i === 0) {
                    costs[j] = j;
                } else if (j > 0) {
                    let newValue = costs[j - 1];
                    if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    }
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
            if (i > 0) costs[s2.length] = lastValue;
        }
        return costs[s2.length];
    }
}


