export class DiffChecker {
    static compare(text1 = "", text2 = "", options = {}) {
        const {
            ignoreCase = false,
            trim = false,
            detectModified = true
        } = options;

        const normalize = (line) => {
            let value = line;

            if (trim) value = value.trim();
            if (ignoreCase) value = value.toLowerCase();

            return value;
        };

        const raw1 = text1.split("\n");
        const raw2 = text2.split("\n");

        const norm1 = raw1.map(normalize);
        const norm2 = raw2.map(normalize);

        let diff = this.lineDiff(raw1, raw2, norm1, norm2);

        if (detectModified) {
            diff = this.mergeModified(diff);
        }

        return diff;
    }

    static lineDiff(raw1, raw2, norm1, norm2) {
        const m = norm1.length;
        const n = norm2.length;

        const dp = Array.from(
            { length: m + 1 },
            () => Array(n + 1).fill(0)
        );

        for (let i = m - 1; i >= 0; i--) {
            for (let j = n - 1; j >= 0; j--) {
                dp[i][j] =
                    norm1[i] === norm2[j]
                        ? dp[i + 1][j + 1] + 1
                        : Math.max(
                              dp[i + 1][j],
                              dp[i][j + 1]
                          );
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

    static mergeModified(diff) {
        const merged = [];

        for (let i = 0; i < diff.length; i++) {
            const current = diff[i];
            const next = diff[i + 1];

            if (
                current?.type === "removed" &&
                next?.type === "added"
            ) {
                merged.push({
                    type: "modified",
                    oldLine: current.line,
                    newLine: next.line,
                    oldLineNumber:
                        current.oldLineNumber,
                    newLineNumber:
                        next.newLineNumber,
                    words: this.wordDiff(
                        current.line,
                        next.line
                    )
                });

                i++;
                continue;
            }

            merged.push(current);
        }

        return merged;
    }

    static wordDiff(oldText = "", newText = "") {
        const oldWords = oldText.split(/\s+/);
        const newWords = newText.split(/\s+/);

        const m = oldWords.length;
        const n = newWords.length;

        const dp = Array.from(
            { length: m + 1 },
            () => Array(n + 1).fill(0)
        );

        for (let i = m - 1; i >= 0; i--) {
            for (let j = n - 1; j >= 0; j--) {
                dp[i][j] =
                    oldWords[i] === newWords[j]
                        ? dp[i + 1][j + 1] + 1
                        : Math.max(
                              dp[i + 1][j],
                              dp[i][j + 1]
                          );
            }
        }

        const result = [];

        let i = 0;
        let j = 0;

        while (i < m && j < n) {
            if (oldWords[i] === newWords[j]) {
                result.push({
                    type: "unchanged",
                    value: oldWords[i]
                });

                i++;
                j++;
            } else if (
                dp[i + 1][j] >= dp[i][j + 1]
            ) {
                result.push({
                    type: "removed",
                    value: oldWords[i++]
                });
            } else {
                result.push({
                    type: "added",
                    value: newWords[j++]
                });
            }
        }

        while (i < m) {
            result.push({
                type: "removed",
                value: oldWords[i++]
            });
        }

        while (j < n) {
            result.push({
                type: "added",
                value: newWords[j++]
            });
        }

        return result;
    }

    static statistics(diff = []) {
        return diff.reduce(
            (stats, item) => {
                stats[item.type] =
                    (stats[item.type] || 0) + 1;

                return stats;
            },
            {
                added: 0,
                removed: 0,
                modified: 0,
                unchanged: 0
            }
        );
    }

    static similarity(a = "", b = "") {
        if (!a && !b) return 1;
        if (!a || !b) return 0;

        const edit =
            1 -
            this.editDistance(a, b) /
                Math.max(a.length, b.length);

        const linesA = a.split("\n");
        const linesB = b.split("\n");

        const lcs =
            this.lcs(linesA, linesB) /
            Math.max(linesA.length, linesB.length);

        return Number(
            ((edit + lcs) / 2).toFixed(3)
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
                    prev +
                        (a[i - 1] === b[j - 1]
                            ? 0
                            : 1)
                );

                prev = temp;
            }
        }

        return dp[b.length];
    }
}
