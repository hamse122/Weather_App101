// Testing utilities for JavaScript
class TestUtils {
    static assertEquals(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message} - Expected: ${expected}, Got: ${actual}`);
        }
        return true;
    }
    
    static assertNotEquals(actual, expected, message = '') {
        if (actual === expected) {
            throw new Error(`${message} - Expected different values, Got: ${actual}`);
        }
        return true;
    }
    
    static assertTrue(condition, message = '') {
        if (!condition) {
            throw new Error(`${message} - Expected true, Got: ${condition}`);
        }
        return true;
    }
    
    static assertFalse(condition, message = '') {
        if (condition) {
            throw new Error(`${message} - Expected false, Got: ${condition}`);
        }
        return true;
    }
    
    static assertThrows(fn, errorType = Error, message = '') {
        try {
            fn();
            throw new Error(`${message} - Expected function to throw`);
        } catch (error) {
            if (!(error instanceof errorType)) {
                throw new Error(`${message} - Expected ${errorType.name}, Got: ${error.constructor.name}`);
            }
        }
        return true;
    }
    
    static async assertResolves(promise, message = '') {
        try {
            await promise;
            return true;
        } catch (error) {
            throw new Error(`${message} - Expected promise to resolve, Got: ${error.message}`);
        }
    }
    
    static async assertRejects(promise, errorType = Error, message = '') {
        try {
            await promise;
            throw new Error(`${message} - Expected promise to reject`);
        } catch (error) {
            if (!(error instanceof errorType)) {
                throw new Error(`${message} - Expected ${errorType.name}, Got: ${error.constructor.name}`);
            }
        }
        return true;
    }
    
    static describe(description, tests) {
        console.log(`\n${description}`);
        try {
            tests();
            console.log('✅ All tests passed');
        } catch (error) {
            console.log('❌ Test failed:', error.message);
        }
    }
    
    static it(description, testFn) {
        try {
            testFn();
            console.log(`  ✅ ${description}`);
        } catch (error) {
            console.log(`  ❌ ${description}: ${error.message}`);
            throw error;
        }
    }
}

// Mock utility
class Mock {
    constructor() {
        this.calls = [];
        this.returnValues = new Map();
    }
    
    fn(implementation = null) {
        const mock = (...args) => {
            this.calls.push({ args, timestamp: Date.now() });
            
            if (this.returnValues.has(args.length)) {
                return this.returnValues.get(args.length);
            }
            
            if (implementation) {
                return implementation(...args);
            }
            
            return undefined;
        };
        
        mock.calls = this.calls;
        mock.returnValue = (value) => {
            this.returnValues.set(0, value);
            return mock;
        };
        mock.returnValueForArgs = (argsLength, value) => {
            this.returnValues.set(argsLength, value);
            return mock;
        };
        
        return mock;
    }
}

module.exports = { TestUtils, Mock };

