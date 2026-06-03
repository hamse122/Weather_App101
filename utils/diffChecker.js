export class DiffChecker {
    static compare(text1 = "", text2 = "", options = {}) {
        const {
            ignoreCase = false,
            trim = false
        } = options;

        const normalize = (line) => {
            let result = line;
            if (trim) result = result.trim();
            if (ignoreCase) result = result.toLowerCase();
            return result;
        };

        const lines1 = text1.split("\n");
        const lines2 = text2.split("\n");

        const norm1 = lines1.map(normalize);
        const norm2 = lines2.map(normalize);

        return this.lineDiff(lines1, lines2, norm1, norm2);
    }

    static lineDiff(raw1, raw2, norm1, norm2) {
        const m = norm1.length;
        const n = norm2.length;

        const dp = Array.from({ length: m + 1 }, () =>
            Array(n + 1).fill(0)
        );

        for (let i = m - 1; i >= 0; i--) {
            for (let j = n - 1; j >= 0; j--) {
                if (norm1[i] === norm2[j]) {
                    dp[i][j] = dp[i + 1][j + 1] + 1;
                } else {
                    dp[i][j] = Math.max(
                        dp[i + 1][j],
                        dp[i][j + 1]
                    );
                }
            }
        }

        const result = [];
        let i = 0;
        let j = 0;

        while (i < m && j < n) {
            if (norm1[i] === norm2[j]) {
                result.push({
                    type: "unchanged",
                    line: raw1[i],
                    oldLineNumber: i + 1,
                    newLineNumber: j + 1
                });
                i++;
                j++;
            } else if (dp[i + 1][j] >= dp[i][j + 1]) {
                result.push({
                    type: "removed",
                    line: raw1[i],
                    oldLineNumber: i + 1
                });
                i++;
            } else {
                result.push({
                    type: "added",
                    line: raw2[j],
                    newLineNumber: j + 1
                });
                j++;
            }
        }

        while (i < m) {
            result.push({
                type: "removed",
                line: raw1[i],
                oldLineNumber: i + 1
            });
            i++;
        }

        while (j < n) {
            result.push({
                type: "added",
                line: raw2[j],
                newLineNumber: j + 1
            });
            j++;
        }

        return result;
    }

    static wordDiff(oldLine = "", newLine = "") {
        const oldWords = oldLine.split(/\s+/);
        const newWords = newLine.split(/\s+/);

        const result = [];

        const max = Math.max(
            oldWords.length,
            newWords.length
        );

        for (let i = 0; i < max; i++) {
            const oldWord = oldWords[i];
            const newWord = newWords[i];

            if (oldWord === newWord) {
                result.push({
                    type: "unchanged",
                    value: oldWord
                });
            } else {
                if (oldWord) {
                    result.push({
                        type: "removed",
                        value: oldWord
                    });
                }

                if (newWord) {
                    result.push({
                        type: "added",
                        value: newWord
                    });
                }
            }
        }

        return result;
    }

    static generatePatch(diff, fileA = "a/file", fileB = "b/file") {
        const lines = [
            `--- ${fileA}`,
            `+++ ${fileB}`
        ];

        diff.forEach(change => {
            switch (change.type) {
                case "added":
                    lines.push(`+ ${change.line}`);
                    break;

                case "removed":
                    lines.push(`- ${change.line}`);
                    break;

                case "modified":
                    lines.push(`- ${change.oldLine}`);
                    lines.push(`+ ${change.newLine}`);
                    break;

                default:
                    lines.push(`  ${change.line}`);
            }
        });

        return lines.join("\n");
    }

    static similarity(text1 = "", text2 = "") {
        if (!text1 && !text2) return 1;
        if (!text1 || !text2) return 0;

        const charScore = this.charSimilarity(text1, text2);

        const lines1 = text1.split("\n");
        const lines2 = text2.split("\n");

        const common = this.lcs(lines1, lines2);

        const lineScore =
            common /
            Math.max(lines1.length, lines2.length);

        return Number(
            ((charScore + lineScore) / 2).toFixed(3)
        );
    }

    static lcs(a, b) {
        const m = a.length;
        const n = b.length;

        const dp = Array.from(
            { length: m + 1 },
            () => Array(n + 1).fill(0)
        );

        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] =
                    a[i - 1] === b[j - 1]
                        ? dp[i - 1][j - 1] + 1
                        : Math.max(
                              dp[i - 1][j],
                              dp[i][j - 1]
                          );
            }
        }

        return dp[m][n];
    }

    static charSimilarity(a, b) {
        const distance = this.editDistance(a, b);
        const maxLength = Math.max(a.length, b.length);

        return maxLength === 0
            ? 1
            : (maxLength - distance) / maxLength;
    }

    static editDistance(a = "", b = "") {
        const dp = Array.from(
            { length: b.length + 1 },
            (_, i) => i
        );

        for (let i = 1; i <= a.length; i++) {
            let prev = dp[0];
            dp[0] = i;

            for (let j = 1; j <= b.length; j++) {
                const temp = dp[j];

                dp[j] = Math.min(
                    dp[j] + 1,
                    dp[j - 1] + 1,
                    prev + (a[i - 1] === b[j - 1] ? 0 : 1)
                );

                prev = temp;
            }
        }

        return dp[b.length];
    }
}
