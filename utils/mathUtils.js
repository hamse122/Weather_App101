// Advanced Math Utilities
class MathUtils {
    static factorial(n) {
        if (n < 0) throw new Error('Factorial not defined for negative numbers');
        if (n === 0 || n === 1) return 1;
        return n * this.factorial(n - 1);
    }
    
    static fibonacci(n) {
        if (n <= 1) return n;
        let a = 0, b = 1;
        for (let i = 2; i <= n; i++) {
            [a, b] = [b, a + b];
        }
        return b;
    }
    
    static isPrime(num) {
        if (num <= 1) return false;
        if (num <= 3) return true;
        if (num % 2 === 0 || num % 3 === 0) return false;
        
        for (let i = 5; i * i <= num; i += 6) {
            if (num % i === 0 || num % (i + 2) === 0) return false;
        }
        return true;
    }
    
    static gcd(a, b) {
        while (b !== 0) {
            [a, b] = [b, a % b];
        }
        return Math.abs(a);
    }
    
    static lcm(a, b) {
        return Math.abs(a * b) / this.gcd(a, b);
    }
    
    static randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }
    
    static clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }
    
    static lerp(start, end, factor) {
        return start + (end - start) * factor;
    }
    
    static distance(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
}

module.exports = MathUtils;

