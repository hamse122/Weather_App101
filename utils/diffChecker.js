export class DiffChecker {
    static compare(text1 = "", text2 = "", options = {}) {
        const {
            ignoreCase = false,
            trim = false,
            detectModified = true,
            ignoreWhitespace = false,
            contextLines = 0
        } = options;

        if (typeof text1 !== "string" || typeof text2 !== "string") {
            throw new TypeError("Both inputs must be strings");
        }

        const normalize = line => {
            let value = line;

            if (trim) value = value.trim();
            if (ignoreWhitespace) value = value.replace(/\s+/g, " ");
            if (ignoreCase) value = value.toLowerCase();

            return value;
        };

        const raw1 = text1.split(/\r\n|\n|\r/);
        const raw2 = text2.split(/\r\n|\n|\r/);

        const norm1 = raw1.map(normalize);
        const norm2 = raw2.map(normalize);

        let diff = this.lineDiff(raw1, raw2, norm1, norm2);

        if (detectModified) {
            diff = this.mergeModified(diff);
        }

        if (contextLines > 0) {
            diff = this.addContext(diff, contextLines);
        }

        return diff;
    }

    static lineDiff(raw1, raw2, norm1, norm2) {
        const m = norm1.length;
        const n = norm2.length;

        // Use a memory-efficient LCS table.
        const dp = Array.from(
            { length: m + 1 },
            () => new Uint32Array(n + 1)
        );

        for (let i = m - 1; i >= 0; i--) {
            for (let j = n - 1; j >= 0; j--) {
                dp[i][j] =
                    norm1[i] === norm2[j]
                        ? dp[i + 1][j + 1] + 1
                        : Math.max(dp[i + 1][j], dp[i][j + 1]);
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
        const result = [];

        for (let i = 0; i < diff.length; i++) {
            const current = diff[i];
            const next = diff[i + 1];

            if (current.type === "removed" && next?.type === "added") {
                result.push({
                    type: "modified",
                    oldLine: current.line,
                    newLine: next.line,
                    oldLineNumber: current.oldLineNumber,
                    newLineNumber: next.newLineNumber,
                    words: this.wordDiff(current.line, next.line)
                });
                i++;
            } else {
                result.push(current);
            }
        }

        return result;
    }

    static wordDiff(oldText = "", newText = "") {
        const tokenize = text => text.match(/\s+|[^\s]+/g) || [];
        const oldWords = tokenize(oldText);
        const newWords = tokenize(newText);

        const m = oldWords.length;
        const n = newWords.length;

        const dp = Array.from(
            { length: m + 1 },
            () => new Uint32Array(n + 1)
        );

        for (let i = m - 1; i >= 0; i--) {
            for (let j = n - 1; j >= 0; j--) {
                dp[i][j] =
                    oldWords[i] === newWords[j]
                        ? dp[i + 1][j + 1] + 1
                        : Math.max(dp[i + 1][j], dp[i][j + 1]);
            }
        }

        const result = [];
        let i = 0;
        let j = 0;

        while (i < m && j < n) {
            if (oldWords[i] === newWords[j]) {
                result.push({ type: "unchanged", value: oldWords[i++] });
                j++;
            } else if (dp[i + 1][j] >= dp[i][j + 1]) {
                result.push({ type: "removed", value: oldWords[i++] });
            } else {
                result.push({ type: "added", value: newWords[j++] });
            }
        }

        while (i < m) {
            result.push({ type: "removed", value: oldWords[i++] });
        }

        while (j < n) {
            result.push({ type: "added", value: newWords[j++] });
        }

        return result;
    }

    static addContext(diff, contextLines = 3) {
        if (!Number.isInteger(contextLines) || contextLines < 1) {
            return diff;
        }

        const changed = new Set();

        diff.forEach((item, index) => {
            if (item.type !== "unchanged") {
                for (
                    let i = Math.max(0, index - contextLines);
                    i <= Math.min(diff.length - 1, index + contextLines);
                    i++
                ) {
                    changed.add(i);
                }
            }
        });

        return diff.filter((_, index) => changed.has(index));
    }

    static statistics(diff = []) {
        return diff.reduce(
            (stats, item) => {
                if (Object.hasOwn(stats, item.type)) {
                    stats[item.type]++;
                }
                return stats;
            },
            { added: 0, removed: 0, modified: 0, unchanged: 0 }
        );
    }

    static similarity(a = "", b = "") {
        if (typeof a !== "string" || typeof b !== "string") {
            throw new TypeError("Both inputs must be strings");
        }

        if (a === b) return 1;
        if (!a || !b) return 0;

        const editScore =
            1 - this.editDistance(a, b) / Math.max(a.length, b.length);

        const linesA = a.split(/\r\n|\n|\r/);
        const linesB = b.split(/\r\n|\n|\r/);

        const lineScore =
            this.lcs(linesA, linesB) / Math.max(linesA.length, linesB.length);

        return Number(((editScore + lineScore) / 2).toFixed(3));
    }

    static lcs(a = [], b = []) {
        const m = a.length;
        const n = b.length;
        let previous = new Uint32Array(n + 1);
        let current = new Uint32Array(n + 1);

        for (let i = 1; i <= m; i++) {
            current[0] = 0;

            for (let j = 1; j <= n; j++) {
                current[j] =
                    a[i - 1] === b[j - 1]
                        ? previous[j - 1] + 1
                        : Math.max(previous[j], current[j - 1]);
            }

            [previous, current] = [current, previous];
        }

        return previous[n];
    }

    static editDistance(a = "", b = "") {
        if (a.length < b.length) {
            [a, b] = [b, a];
        }

        let previous = Array.from(
            { length: b.length + 1 },
            (_, i) => i
        );

        for (let i = 1; i <= a.length; i++) {
            const current = [i];

            for (let j = 1; j <= b.length; j++) {
                current[j] = Math.min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
                );
            }

            previous = current;
        }

        return previous[b.length];
    }
}
