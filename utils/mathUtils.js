/**
 * Advanced Math Utilities
 * @author You
 */
class MathUtils {
    /* ---------- BASIC NUMBER UTILS ---------- */

    static isNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    static lerp(start, end, t) {
        return start + (end - start) * this.clamp(t, 0, 1);
    }

    static mapRange(value, inMin, inMax, outMin, outMax) {
        return outMin + ((value - inMin) * (outMax - outMin)) / (inMax - inMin);
    }

    /* ---------- FACTORIAL ---------- */

    static factorial(n, useBigInt = false) {
        if (!Number.isInteger(n) || n < 0) {
            throw new Error('Factorial requires a non-negative integer');
        }

        if (useBigInt) {
            let result = 1n;
            for (let i = 2n; i <= BigInt(n); i++) {
                result *= i;
            }
            return result;
        }

        let result = 1;
        for (let i = 2; i <= n; i++) {
            result *= i;
        }
        return result;
    }

    /* ---------- FIBONACCI (MEMOIZED) ---------- */

    static #fibCache = new Map([[0, 0], [1, 1]]);

    static fibonacci(n) {
        if (!Number.isInteger(n) || n < 0) {
            throw new Error('Fibonacci requires a non-negative integer');
        }

        if (this.#fibCache.has(n)) {
            return this.#fibCache.get(n);
        }

        const value = this.fibonacci(n - 1) + this.fibonacci(n - 2);
        this.#fibCache.set(n, value);
        return value;
    }

    /* ---------- PRIME ---------- */

    static isPrime(num) {
        if (!Number.isInteger(num) || num <= 1) return false;
        if (num <= 3) return true;
        if (num % 2 === 0 || num % 3 === 0) return false;

        for (let i = 5; i * i <= num; i += 6) {
            if (num % i === 0 || num % (i + 2) === 0) return false;
        }
        return true;
    }

    /* ---------- GCD / LCM ---------- */

    static gcd(a, b) {
        a = Math.abs(a);
        b = Math.abs(b);
        while (b !== 0) {
            [a, b] = [b, a % b];
        }
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

    static randomChoice(array) {
        if (!Array.isArray(array) || array.length === 0) {
            throw new Error('randomChoice requires a non-empty array');
        }
        return array[Math.floor(Math.random() * array.length)];
    }

    /* ---------- GEOMETRY ---------- */

    static distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    }

    static degreesToRadians(deg) {
        return deg * (Math.PI / 180);
    }

    static radiansToDegrees(rad) {
        return rad * (180 / Math.PI);
    }

    /* ---------- STATISTICS ---------- */

    static average(numbers) {
        if (!Array.isArray(numbers) || numbers.length === 0) {
            throw new Error('average requires a non-empty array');
        }
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    static median(numbers) {
        const sorted = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2
            ? sorted[mid]
            : (sorted[mid - 1] + sorted[mid]) / 2;
    }
}

/* ---------- EXPORTS ---------- */

// CommonJS
module.exports = MathUtils;

// ES Module (optional)
// export default MathUtils;
