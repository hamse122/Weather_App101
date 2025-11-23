/**
 * Diff Checker Utility
 * Text difference checker and comparison tool
 */

export class DiffChecker {

    /**
     * Compare two texts line-by-line
     * @param {string} text1
     * @param {string} text2
     * @returns {Array<Object>}
     */
    static compare(text1 = "", text2 = "") {
        const lines1 = text1.split("\n");
        const lines2 = text2.split("\n");
        const result = [];

        const maxLines = Math.max(lines1.length, lines2.length);

        for (let i = 0; i < maxLines; i++) {
            const line1 = lines1[i] ?? "";
            const line2 = lines2[i] ?? "";

            if (line1 === line2) {
                result.push({
                    type: "unchanged",
                    line: line1,
                    lineNumber: i + 1
                });
            } else if (line1 && !line2) {
                result.push({
                    type: "removed",
                    line: line1,
                    lineNumber: i + 1
                });
            } else if (!line1 && line2) {
                result.push({
                    type: "added",
                    line: line2,
                    lineNumber: i + 1
                });
            } else {
                result.push({
                    type: "modified",
                    oldLine: line1,
                    newLine: line2,
                    lineNumber: i + 1
                });
            }
        }

        return result;
    }

    /**
     * Create a unified-style patch from diff results
     * @param {Array<Object>} diff
     * @returns {string}
     */
    static generatePatch(diff) {
        let patch = "";

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
                    break;
            }
        });

        return patch.trimEnd(); // Remove trailing newline
    }

    /**
     * Calculate similarity percentage between two texts (0–1)
     * @param {string} text1
     * @param {string} text2
     * @returns {number}
     */
    static similarity(text1 = "", text2 = "") {
        const longer = text1.length >= text2.length ? text1 : text2;
        const shorter = text1.length < text2.length ? text1 : text2;

        if (longer.length === 0) return 1;

        const distance = this.editDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Levenshtein edit distance (optimized)
     * @param {string} s1
     * @param {string} s2
     * @returns {number}
     */
    static editDistance(s1 = "", s2 = "") {
        s1 = s1.toLowerCase();
        s2 = s2.toLowerCase();

        const len1 = s1.length;
        const len2 = s2.length;

        if (len1 === 0) return len2;
        if (len2 === 0) return len1;

        const dp = new Array(len2 + 1);

        for (let j = 0; j <= len2; j++) {
            dp[j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            let prev = dp[0];
            dp[0] = i;

            for (let j = 1; j <= len2; j++) {
                const temp = dp[j];
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;

                dp[j] = Math.min(
                    dp[j] + 1,        // deletion
                    dp[j - 1] + 1,    // insertion
                    prev + cost       // substitution
                );

                prev = temp;
            }
        }

        return dp[len2];
    }
}
