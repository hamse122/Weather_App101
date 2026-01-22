// Advanced middleware pipeline
class Middleware {
  constructor(middlewares = []) {
    this.middlewares = [...middlewares];
  }

  use(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Middleware must be a function');
    }
    this.middlewares.push(fn);
    return this;
  }

  remove(fn) {
    this.middlewares = this.middlewares.filter(mw => mw !== fn);
    return this;
  }

  clear() {
    this.middlewares.length = 0;
    return this;
  }

  clone() {
    return new Middleware(this.middlewares);
  }

  compose() {
    const middlewares = this.middlewares;

    return async function execute(context = {}, finalHandler) {
      let index = -1;

      async function dispatch(i) {
        if (i <= index) {
          throw new Error('next() called multiple times');
        }
        index = i;

        let fn = middlewares[i];
        if (i === middlewares.length) fn = finalHandler;
        if (!fn) return;

        return await fn(context, () => dispatch(i + 1));
      }

      try {
        await dispatch(0);
        return context;
      } catch (err) {
        context.error = err;
        throw err;
      }
    };
  }

  async execute(context = {}, finalHandler) {
    return this.compose()(context, finalHandler);
  }
}

module.exports = Middleware;
