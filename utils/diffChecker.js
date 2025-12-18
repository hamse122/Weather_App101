/**
 * Advanced Diff Checker Utility
 * Line, word, and character-level comparison
 */

export class DiffChecker {

    /**
     * Compare two texts line-by-line with alignment
     * @param {string} text1
     * @param {string} text2
     * @param {Object} options
     * @returns {Array<Object>}
     */
    static compare(text1 = "", text2 = "", options = {}) {
        const {
            ignoreCase = false,
            trim = false
        } = options;

        const normalize = (line) => {
            if (trim) line = line.trim();
            if (ignoreCase) line = line.toLowerCase();
            return line;
        };

        const lines1 = text1.split("\n");
        const lines2 = text2.split("\n");

        const result = [];
        const max = Math.max(lines1.length, lines2.length);

        for (let i = 0; i < max; i++) {
            const raw1 = lines1[i];
            const raw2 = lines2[i];

            const line1 = raw1 !== undefined ? normalize(raw1) : null;
            const line2 = raw2 !== undefined ? normalize(raw2) : null;

            if (line1 === line2 && line1 !== null) {
                result.push({
                    type: "unchanged",
                    line: raw1,
                    lineNumber: i + 1
                });
            } else if (line1 !== null && line2 === null) {
                result.push({
                    type: "removed",
                    line: raw1,
                    lineNumber: i + 1
                });
            } else if (line1 === null && line2 !== null) {
                result.push({
                    type: "added",
                    line: raw2,
                    lineNumber: i + 1
                });
            } else {
                result.push({
                    type: "modified",
                    oldLine: raw1,
                    newLine: raw2,
                    wordDiff: this.wordDiff(raw1, raw2),
                    lineNumber: i + 1
                });
            }
        }

        return result;
    }

    /**
     * Word-level diff for modified lines
     * @param {string} oldLine
     * @param {string} newLine
     */
    static wordDiff(oldLine = "", newLine = "") {
        const oldWords = oldLine.split(/\s+/);
        const newWords = newLine.split(/\s+/);

        const diff = [];
        const max = Math.max(oldWords.length, newWords.length);

        for (let i = 0; i < max; i++) {
            if (oldWords[i] === newWords[i]) {
                diff.push({ type: "unchanged", value: oldWords[i] });
            } else {
                if (oldWords[i]) diff.push({ type: "removed", value: oldWords[i] });
                if (newWords[i]) diff.push({ type: "added", value: newWords[i] });
            }
        }

        return diff;
    }

    /**
     * Generate a unified diff patch
     * @param {Array<Object>} diff
     * @param {string} fileA
     * @param {string} fileB
     * @returns {string}
     */
    static generatePatch(diff, fileA = "a/file", fileB = "b/file") {
        let patch = `--- ${fileA}\n+++ ${fileB}\n`;

        diff.forEach(change => {
            switch (change.type) {
                case "removed":
                    patch += `- ${change.line}\n`;
                    break;
                case "added":
                    patch += `+ ${change.line}\n`;
                    break;
                case "modified":
                    patch += `- ${change.oldLine}\n`;
                    patch += `+ ${change.newLine}\n`;
                    break;
                default:
                    patch += `  ${change.line}\n`;
            }
        });

        return patch.trimEnd();
    }

    /**
     * Hybrid similarity score (0–1)
     * Combines line and character similarity
     */
    static similarity(text1 = "", text2 = "") {
        if (!text1 && !text2) return 1;
        if (!text1 || !text2) return 0;

        const charScore = this.charSimilarity(text1, text2);
        const lineScore = this.lineSimilarity(text1, text2);

        return Number(((charScore + lineScore) / 2).toFixed(3));
    }

    /**
     * Character-level similarity
     */
    static charSimilarity(a, b) {
        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1;

        const distance = this.editDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Line-level similarity
     */
    static lineSimilarity(a, b) {
        const aLines = a.split("\n");
        const bLines = b.split("\n");

        const matches = aLines.filter((l, i) => l === bLines[i]).length;
        return matches / Math.max(aLines.length, bLines.length);
    }

    /**
     * Optimized Levenshtein distance
     */
    static editDistance(s1 = "", s2 = "") {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();

        const dp = Array.from({ length: s2.length + 1 }, (_, i) => i);

        for (let i = 1; i <= s1.length; i++) {
            let prev = dp[0];
            dp[0] = i;

            for (let j = 1; j <= s2.length; j++) {
                const temp = dp[j];
                dp[j] = Math.min(
                    dp[j] + 1,
                    dp[j - 1] + 1,
                    prev + (s1[i - 1] === s2[j - 1] ? 0 : 1)
                );
                prev = temp;
            }
        }

        return dp[s2.length];
    }
}
