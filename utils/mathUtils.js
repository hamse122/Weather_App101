/**
 * Ultimate Math Utilities Library
 * Supports statistics, combinatorics, geometry, vectors, randomness
 * Works in Node.js and Browser
 */

class MathUtils {

    /* ---------- TYPE CHECK ---------- */

    static isNumber(v) {
        return typeof v === "number" && Number.isFinite(v);
    }

    static isInteger(v) {
        return Number.isInteger(v);
    }

    /* ---------- BASIC ---------- */

    static clamp(v, min, max) {
        return Math.min(Math.max(v, min), max);
    }

    static lerp(a, b, t) {
        return a + (b - a) * this.clamp(t, 0, 1);
    }

    static mapRange(value, inMin, inMax, outMin, outMax) {
        if (inMax === inMin) throw new Error("Invalid range");
        return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
    }

    static round(value, decimals = 0) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    static floor(value, decimals = 0) {
        const factor = 10 ** decimals;
        return Math.floor(value * factor) / factor;
    }

    static ceil(value, decimals = 0) {
        const factor = 10 ** decimals;
        return Math.ceil(value * factor) / factor;
    }

    /* ---------- FACTORIAL ---------- */

    static factorial(n, big = false) {
        if (!Number.isInteger(n) || n < 0)
            throw new Error("Factorial requires non-negative integer");

        if (big) {
            let r = 1n;
            for (let i = 2n; i <= BigInt(n); i++) r *= i;
            return r;
        }

        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
    }

    /* ---------- COMBINATORICS ---------- */

    static combination(n, r) {
        if (r > n) return 0;
        return this.factorial(n) / (this.factorial(r) * this.factorial(n - r));
    }

    static permutation(n, r) {
        if (r > n) return 0;
        return this.factorial(n) / this.factorial(n - r);
    }

    /* ---------- FIBONACCI (MEMOIZED) ---------- */

    static #fibCache = new Map([[0, 0], [1, 1]]);

    static fibonacci(n) {
        if (!Number.isInteger(n) || n < 0)
            throw new Error("Invalid fibonacci input");

        if (this.#fibCache.has(n))
            return this.#fibCache.get(n);

        const v = this.fibonacci(n - 1) + this.fibonacci(n - 2);
        this.#fibCache.set(n, v);

        return v;
    }

    /* ---------- PRIME ---------- */

    static isPrime(num) {
        if (num <= 1 || !Number.isInteger(num)) return false;
        if (num <= 3) return true;
        if (num % 2 === 0 || num % 3 === 0) return false;

        for (let i = 5; i * i <= num; i += 6) {
            if (num % i === 0 || num % (i + 2) === 0)
                return false;
        }

        return true;
    }

    /* ---------- GCD / LCM ---------- */

    static gcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);

        while (b !== 0)
            [a, b] = [b, a % b];

        return a;
    }

    static lcm(a, b) {
        if (a === 0 || b === 0) return 0;
        return Math.abs(a * b) / this.gcd(a, b);
    }

    /* ---------- RANDOM ---------- */

    static randomFloat(min = 0, max = 1) {
        return Math.random() * (max - min) + min;
    }

    static randomInt(min, max) {
        return Math.floor(this.randomFloat(min, max + 1));
    }

    static randomChoice(arr) {
        if (!Array.isArray(arr) || arr.length === 0)
            throw new Error("Array required");

        return arr[this.randomInt(0, arr.length - 1)];
    }

    static shuffle(array) {
        const arr = [...array];

        for (let i = arr.length - 1; i > 0; i--) {
            const j = this.randomInt(0, i);
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }

        return arr;
    }

    /* ---------- GEOMETRY ---------- */

    static distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }

    static degreesToRadians(deg) {
        return deg * Math.PI / 180;
    }

    static radiansToDegrees(rad) {
        return rad * 180 / Math.PI;
    }

    /* ---------- VECTOR ---------- */

    static vectorAdd(a, b) {
        return a.map((v, i) => v + b[i]);
    }

    static vectorSubtract(a, b) {
        return a.map((v, i) => v - b[i]);
    }

    static dotProduct(a, b) {
        return a.reduce((sum, v, i) => sum + v * b[i], 0);
    }

    static magnitude(v) {
        return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    }

    /* ---------- STATISTICS ---------- */

    static sum(arr) {
        return arr.reduce((a, b) => a + b, 0);
    }

    static average(arr) {
        if (!arr.length) throw new Error("Empty array");
        return this.sum(arr) / arr.length;
    }

    static median(arr) {
        const s = [...arr].sort((a, b) => a - b);
        const m = Math.floor(s.length / 2);

        return s.length % 2
            ? s[m]
            : (s[m - 1] + s[m]) / 2;
    }

    static variance(arr) {
        const mean = this.average(arr);
        return this.average(arr.map(v => (v - mean) ** 2));
    }

    static stdDeviation(arr) {
        return Math.sqrt(this.variance(arr));
    }

    /* ---------- PERCENT ---------- */

    static percentage(value, total) {
        return (value / total) * 100;
    }

    static percentOf(percent, total) {
        return (percent / 100) * total;
    }
}

/* ---------- EXPORT ---------- */

if (typeof module !== "undefined") {
    module.exports = MathUtils;
}

export default MathUtils;
