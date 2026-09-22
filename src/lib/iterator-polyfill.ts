/**
 * pdfjs-dist@6.x 依赖 ECMAScript Iterator Helpers 提案中的全局 Iterator。
 * 在旧版浏览器或运行时不支持该全局对象时注入最小 polyfill，避免运行时抛出
 * "Iterator is not defined"。
 */
const g = globalThis as unknown as Record<string, unknown>;

if (typeof g.Iterator === 'undefined') {
  class IteratorPolyfill<T> {
    protected iterator: Iterator<T>;

    constructor(iterator: Iterator<T>) {
      this.iterator = iterator;
    }

    next(): IteratorResult<T, undefined> {
      return this.iterator.next();
    }

    [Symbol.iterator](): this {
      return this;
    }

    map<U>(fn: (value: T, index: number) => U): IteratorPolyfill<U> {
      const source = this.iterator;
      let index = 0;
      const mapped: Iterator<U> = {
        next: () => {
          const result = source.next();
          if (result.done) return { value: undefined, done: true } as IteratorResult<U, undefined>;
          return { value: fn(result.value, index++), done: false };
        },
      };
      return new IteratorPolyfill<U>(mapped);
    }

    filter(fn: (value: T, index: number) => boolean): IteratorPolyfill<T> {
      const source = this.iterator;
      let index = 0;
      const filtered: Iterator<T> = {
        next: () => {
          while (true) {
            const result = source.next();
            if (result.done) return result;
            if (fn(result.value, index++)) return result;
          }
        },
      };
      return new IteratorPolyfill<T>(filtered);
    }

    take(count: number): IteratorPolyfill<T> {
      const source = this.iterator;
      let taken = 0;
      const limited: Iterator<T> = {
        next: () => {
          if (taken >= count) return { value: undefined, done: true } as IteratorResult<T, undefined>;
          taken += 1;
          return source.next();
        },
      };
      return new IteratorPolyfill<T>(limited);
    }

    toArray(): T[] {
      const arr: T[] = [];
      let result = this.iterator.next();
      while (!result.done) {
        arr.push(result.value);
        result = this.iterator.next();
      }
      return arr;
    }

    static from<T>(value: Iterable<T> | Iterator<T>): IteratorPolyfill<T> {
      if (value != null && typeof (value as Iterable<T>)[Symbol.iterator] === 'function') {
        return new IteratorPolyfill((value as Iterable<T>)[Symbol.iterator]());
      }
      if (value != null && typeof (value as Iterator<T>).next === 'function') {
        return new IteratorPolyfill(value as Iterator<T>);
      }
      throw new TypeError('Iterator.from expects an iterable or iterator');
    }
  }

  g.Iterator = IteratorPolyfill;
}
