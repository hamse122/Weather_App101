/**
 * Lightweight Test Framework (Jest-like)
 * No dependencies, production-safe
 */

class TestUtils {

    // =====================
    // ASSERTIONS
    // =====================
    static assertEquals(actual, expected, msg = "") {
        if (actual !== expected) {
            throw new Error(`${msg} Expected: ${expected}, Got: ${actual}`);
        }
    }

    static assertNotEquals(actual, expected, msg = "") {
        if (actual === expected) {
            throw new Error(`${msg} Expected different values`);
        }
    }

    static assertTrue(value, msg = "") {
        if (value !== true) {
            throw new Error(`${msg} Expected true, Got: ${value}`);
        }
    }

    static assertFalse(value, msg = "") {
        if (value !== false) {
            throw new Error(`${msg} Expected false, Got: ${value}`);
        }
    }

    static assertDeepEquals(actual, expected, msg = "") {
        const a = JSON.stringify(actual);
        const e = JSON.stringify(expected);
        if (a !== e) {
            throw new Error(`${msg} Expected: ${e}, Got: ${a}`);
        }
    }

    static assertThrows(fn, errorType = Error, msg = "") {
        let threw = false;
        try {
            fn();
        } catch (e) {
            threw = true;
            if (!(e instanceof errorType)) {
                throw new Error(`${msg} Expected ${errorType.name}, Got ${e.constructor.name}`);
            }
        }
        if (!threw) throw new Error(`${msg} Expected function to throw`);
    }

    static async assertResolves(promise, msg = "") {
        try {
            await promise;
        } catch (e) {
            throw new Error(`${msg} Expected resolve, Got reject`);
        }
    }

    static async assertRejects(promise, errorType = Error, msg = "") {
        try {
            await promise;
            throw new Error(`${msg} Expected reject`);
        } catch (e) {
            if (!(e instanceof errorType)) {
                throw new Error(`${msg} Expected ${errorType.name}, Got ${e.constructor.name}`);
            }
        }
    }

// =====================
// TEST RUNNER
// =====================

static describe(name, fn) {
    console.log(`\n📦 ${name}`);

    try {
        const result = fn();

        if (result instanceof Promise) {
            return result.catch(err => {
                console.error(`❌ Suite "${name}" failed`);
                console.error(err);
            });
        }
    } catch (err) {
        console.error(`❌ Suite "${name}" failed`);
        console.error(err);
    }
}

static async it(
    name,
    fn,
    {
        timeout = 2000,
        retries = 0,
        signal
    } = {}
) {
    let attempt = 0;
    let lastError;

    while (attempt <= retries) {
        const start =
            typeof performance !== "undefined"
                ? performance.now()
                : Date.now();

        try {
            if (signal?.aborted) {
                throw new Error("Test aborted");
            }

            const execution = Promise.resolve().then(fn);

            await Promise.race([
                execution,
                new Promise((_, reject) => {
                    const timer = setTimeout(() => {
                        clearTimeout(timer);
                        reject(new Error(`Timeout exceeded (${timeout}ms)`));
                    }, timeout);

                    signal?.addEventListener(
                        "abort",
                        () => {
                            clearTimeout(timer);
                            reject(new Error("Test aborted"));
                        },
                        { once: true }
                    );
                })
            ]);

            const duration =
                (typeof performance !== "undefined"
                    ? performance.now()
                    : Date.now()) - start;

            console.log(
                `  ✅ ${name} (${duration.toFixed(2)}ms${
                    attempt ? ` • retry ${attempt}` : ""
                })`
            );

            return;
        } catch (err) {
            lastError = err;
            attempt++;

            if (attempt <= retries) {
                console.warn(`  🔄 Retrying "${name}" (${attempt}/${retries})`);
            }
        }
    }

    console.error(`  ❌ ${name}`);
    console.error(`     → ${lastError.message}`);

    throw lastError;
}

/**
 * Spy / Mock utility
 */
class Mock {

    static fn(implementation = () => undefined) {
        const calls = [];

        const spy = (...args) => {
            calls.push({
                args,
                result: implementation(...args),
                timestamp: Date.now()
            });
            return calls[calls.length - 1].result;
        };

        spy.calls = calls;

        spy.called = () => calls.length > 0;
        spy.callCount = () => calls.length;
        spy.calledWith = (...args) =>
            calls.some(c => JSON.stringify(c.args) === JSON.stringify(args));

        spy.reset = () => calls.length = 0;

        spy.mockImplementation = (fn) => {
            implementation = fn;
            return spy;
        };

        spy.mockReturnValue = (value) => {
            implementation = () => value;
            return spy;
        };

        return spy;
    }
}

module.exports = { TestUtils, Mock };
