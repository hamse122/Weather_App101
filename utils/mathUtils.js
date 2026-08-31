/**
 * Ultimate Math Utilities Library v2
 * -----------------------------------
 * Features:
 * - Safe numeric validation
 * - Basic arithmetic helpers
 * - Factorial / combinations / permutations
 * - BigInt support
 * - Iterative memoized Fibonacci
 * - Prime / GCD / LCM
 * - Secure + normal randomness
 * - Geometry
 * - Vector operations
 * - Statistics
 * - Percentage utilities
 * - Node.js + Browser compatible
 */

class MathUtils {

    /* ==================================================
       TYPE CHECK
    ================================================== */

    static isNumber(value) {
        return typeof value === "number" && Number.isFinite(value);
    }

    static isInteger(value) {
        return Number.isInteger(value);
    }

    static assertNumber(value, name = "value") {
        if (!this.isNumber(value)) {
            throw new TypeError(`${name} must be a finite number`);
        }
    }

    static assertInteger(value, name = "value") {
        if (!Number.isInteger(value)) {
            throw new TypeError(`${name} must be an integer`);
        }
    }

    static assertArray(array, name = "array") {
        if (!Array.isArray(array)) {
            throw new TypeError(`${name} must be an array`);
        }
    }

    /* ==================================================
       BASIC
    ================================================== */

    static clamp(value, min, max) {
        this.assertNumber(value);
        this.assertNumber(min, "min");
        this.assertNumber(max, "max");

        if (min > max) {
            throw new RangeError("min cannot be greater than max");
        }

        return Math.min(Math.max(value, min), max);
    }

    static lerp(a, b, t) {
        this.assertNumber(a, "a");
        this.assertNumber(b, "b");
        this.assertNumber(t, "t");

        return a + (b - a) * this.clamp(t, 0, 1);
    }

    static mapRange(value, inMin, inMax, outMin, outMax) {
        [
            ["value", value],
            ["inMin", inMin],
            ["inMax", inMax],
            ["outMin", outMin],
            ["outMax", outMax]
        ].forEach(([name, value]) => this.assertNumber(value, name));

        if (inMax === inMin) {
            throw new RangeError("Input range cannot have zero length");
        }

        return outMin +
            ((value - inMin) * (outMax - outMin)) /
            (inMax - inMin);
    }

    static round(value, decimals = 0) {
        this.assertNumber(value);
        this.assertInteger(decimals, "decimals");

        if (decimals < 0) {
            throw new RangeError("decimals cannot be negative");
        }

        const factor = 10 ** decimals;
        return Math.round((value + Number.EPSILON) * factor) / factor;
    }

    static floor(value, decimals = 0) {
        this.assertNumber(value);
        this.assertInteger(decimals, "decimals");

        const factor = 10 ** decimals;
        return Math.floor(value * factor) / factor;
    }

    static ceil(value, decimals = 0) {
        this.assertNumber(value);
        this.assertInteger(decimals, "decimals");

        const factor = 10 ** decimals;
        return Math.ceil(value * factor) / factor;
    }

    /* ==================================================
       FACTORIAL
    ================================================== */

    static factorial(n, big = false) {
        this.assertInteger(n, "n");

        if (n < 0) {
            throw new RangeError(
                "Factorial requires a non-negative integer"
            );
        }

        if (big) {
            let result = 1n;

            for (let i = 2n; i <= BigInt(n); i++) {
                result *= i;
            }

            return result;
        }

        if (n > 170) {
            throw new RangeError(
                "Number factorial over 170 exceeds JavaScript Number range; use big=true"
            );
        }

        let result = 1;

        for (let i = 2; i <= n; i++) {
            result *= i;
        }

        return result;
    }

    /* ==================================================
       COMBINATORICS
    ================================================== */

    static combination(n, r, big = false) {
        this.assertInteger(n, "n");
        this.assertInteger(r, "r");

        if (n < 0 || r < 0) {
            throw new RangeError("n and r must be non-negative");
        }

        if (r > n) return big ? 0n : 0;

        r = Math.min(r, n - r);

        if (big) {
            let result = 1n;

            for (let i = 1; i <= r; i++) {
                result =
                    (result * BigInt(n - r + i)) /
                    BigInt(i);
            }

            return result;
        }

        let result = 1;

        for (let i = 1; i <= r; i++) {
            result = result * (n - r + i) / i;
        }

        return result;
    }

    static permutation(n, r, big = false) {
        this.assertInteger(n, "n");
        this.assertInteger(r, "r");

        if (n < 0 || r < 0) {
            throw new RangeError("n and r must be non-negative");
        }

        if (r > n) return big ? 0n : 0;

        if (big) {
            let result = 1n;

            for (let i = 0; i < r; i++) {
                result *= BigInt(n - i);
            }

            return result;
        }

        let result = 1;

        for (let i = 0; i < r; i++) {
            result *= n - i;
        }

        return result;
    }

    /* ==================================================
       FIBONACCI
    ================================================== */

    static #fibCache = new Map([
        [0, 0],
        [1, 1]
    ]);

    static fibonacci(n, big = false) {
        this.assertInteger(n, "n");

        if (n < 0) {
            throw new RangeError(
                "Fibonacci requires a non-negative integer"
            );
        }

        if (big) {
            let a = 0n;
            let b = 1n;

            for (let i = 0; i < n; i++) {
                [a, b] = [b, a + b];
            }

            return a;
        }

        if (this.#fibCache.has(n)) {
            return this.#fibCache.get(n);
        }

        let a = 0;
        let b = 1;

        for (let i = 2; i <= n; i++) {
            [a, b] = [b, a + b];
        }

        const result = n === 0 ? 0 : b;

        this.#fibCache.set(n, result);

        return result;
    }

    /* ==================================================
       PRIME
    ================================================== */

    static isPrime(num) {
        if (!Number.isSafeInteger(num) || num <= 1) {
            return false;
        }

        if (num <= 3) return true;

        if (num % 2 === 0 || num % 3 === 0) {
            return false;
        }

        for (let i = 5; i <= Math.sqrt(num); i += 6) {
            if (num % i === 0 || num % (i + 2) === 0) {
                return false;
            }
        }

        return true;
    }

    /* ==================================================
       GCD / LCM
    ================================================== */

    static gcd(a, b) {
        this.assertInteger(a, "a");
        this.assertInteger(b, "b");

        a = Math.abs(a);
        b = Math.abs(b);

        while (b !== 0) {
            [a, b] = [b, a % b];
        }

        return a;
    }

    static lcm(a, b) {
        this.assertInteger(a, "a");
        this.assertInteger(b, "b");

        if (a === 0 || b === 0) return 0;

        return Math.abs((a / this.gcd(a, b)) * b);
    }

    /* ==================================================
       RANDOM
    ================================================== */

    static randomFloat(min = 0, max = 1) {
        this.assertNumber(min, "min");
        this.assertNumber(max, "max");

        if (min > max) {
            throw new RangeError("min cannot be greater than max");
        }

        return Math.random() * (max - min) + min;
    }

    static randomInt(min, max) {
        this.assertInteger(min, "min");
        this.assertInteger(max, "max");

        if (min > max) {
            throw new RangeError("min cannot be greater than max");
        }

        return Math.floor(
            Math.random() * (max - min + 1)
        ) + min;
    }

    static secureRandomInt(min, max) {
        this.assertInteger(min, "min");
        this.assertInteger(max, "max");

        if (min > max) {
            throw new RangeError("min cannot be greater than max");
        }

        const range = max - min + 1;

        if (globalThis.crypto?.getRandomValues) {
            const array = new Uint32Array(1);
            const limit =
                Math.floor(0x100000000 / range) * range;

            let value;

            do {
                globalThis.crypto.getRandomValues(array);
                value = array[0];
            } while (value >= limit);

            return min + (value % range);
        }

        return this.randomInt(min, max);
    }

    static randomChoice(array) {
        this.assertArray(array);

        if (array.length === 0) {
            throw new RangeError("Cannot choose from an empty array");
        }

        return array[this.randomInt(0, array.length - 1)];
    }

    static shuffle(array) {
        this.assertArray(array);

        const result = [...array];

        for (let i = result.length - 1; i > 0; i--) {
            const j = this.randomInt(0, i);
            [result[i], result[j]] = [result[j], result[i]];
        }

        return result;
    }

    /* ==================================================
       GEOMETRY
    ================================================== */

    static distance(x1, y1, x2, y2) {
        [
            ["x1", x1],
            ["y1", y1],
            ["x2", x2],
            ["y2", y2]
        ].forEach(([name, value]) =>
            this.assertNumber(value, name)
        );

        return Math.hypot(x2 - x1, y2 - y1);
    }

    static degreesToRadians(degrees) {
        this.assertNumber(degrees, "degrees");
        return degrees * Math.PI / 180;
    }

    static radiansToDegrees(radians) {
        this.assertNumber(radians, "radians");
        return radians * 180 / Math.PI;
    }

    /* ==================================================
       VECTOR
    ================================================== */

    static #validateVector(vector, name = "vector") {
        this.assertArray(vector, name);

        if (!vector.every(Number.isFinite)) {
            throw new TypeError(
                `${name} must contain only finite numbers`
            );
        }
    }

    static #validateSameDimensions(a, b) {
        this.#validateVector(a, "a");
        this.#validateVector(b, "b");

        if (a.length !== b.length) {
            throw new RangeError("Vectors must have equal dimensions");
        }
    }

    static vectorAdd(a, b) {
        this.#validateSameDimensions(a, b);
        return a.map((value, i) => value + b[i]);
    }

    static vectorSubtract(a, b) {
        this.#validateSameDimensions(a, b);
        return a.map((value, i) => value - b[i]);
    }

    static dotProduct(a, b) {
        this.#validateSameDimensions(a, b);

        return a.reduce(
            (sum, value, i) => sum + value * b[i],
            0
        );
    }

    static magnitude(vector) {
        this.#validateVector(vector);

        return Math.hypot(...vector);
    }

    static normalize(vector) {
        const magnitude = this.magnitude(vector);

        if (magnitude === 0) {
            throw new RangeError(
                "Cannot normalize a zero vector"
            );
        }

        return vector.map(value => value / magnitude);
    }

    /* ==================================================
       STATISTICS
    ================================================== */

    static #validateNumbers(array) {
        this.assertArray(array);

        if (array.length === 0) {
            throw new RangeError("Array cannot be empty");
        }

        if (!array.every(Number.isFinite)) {
            throw new TypeError(
                "Array must contain only finite numbers"
            );
        }
    }

    static sum(array) {
        this.#validateNumbers(array);
        return array.reduce((sum, value) => sum + value, 0);
    }

    static average(array) {
        this.#validateNumbers(array);
        return this.sum(array) / array.length;
    }

    static median(array) {
        this.#validateNumbers(array);

        const sorted = [...array].sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);

        return sorted.length % 2
            ? sorted[middle]
            : (sorted[middle - 1] + sorted[middle]) / 2;
    }

    static variance(array, sample = false) {
        this.#validateNumbers(array);

        if (sample && array.length < 2) {
            throw new RangeError(
                "Sample variance requires at least 2 values"
            );
        }

        const mean = this.average(array);
        const divisor = sample
            ? array.length - 1
            : array.length;

        return array.reduce(
            (sum, value) => sum + (value - mean) ** 2,
            0
        ) / divisor;
    }

    static stdDeviation(array, sample = false) {
        return Math.sqrt(this.variance(array, sample));
    }

    /* ==================================================
       PERCENTAGE
    ================================================== */

    static percentage(value, total) {
        this.assertNumber(value, "value");
        this.assertNumber(total, "total");

        if (total === 0) {
            throw new RangeError("total cannot be zero");
        }

        return (value / total) * 100;
    }

    static percentOf(percent, total) {
        this.assertNumber(percent, "percent");
        this.assertNumber(total, "total");

        return (percent / 100) * total;
    }

    static percentageChange(oldValue, newValue) {
        this.assertNumber(oldValue, "oldValue");
        this.assertNumber(newValue, "newValue");

        if (oldValue === 0) {
            throw new RangeError(
                "oldValue cannot be zero"
            );
        }

        return ((newValue - oldValue) / oldValue) * 100;
    }
}

/* ==================================================
   EXPORT
================================================== */

if (typeof module !== "undefined" && module.exports) {
    module.exports = MathUtils;
}

export default MathUtils;
