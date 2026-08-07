/* =========================================================
 * LINKED LIST
 * =======================================================*/

class LinkedListNode {
  constructor(value) {
    this.value = value;
    this.next = null;
  }
}

class LinkedList {
  constructor(iterable = []) {
    this.head = null;
    this.tail = null;
    this.length = 0;
    iterable.forEach(v => this.append(v));
  }

  append(value) {
    const node = new LinkedListNode(value);
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
    this.length++;
  }

  prepend(value) {
    const node = new LinkedListNode(value);
    node.next = this.head;
    this.head = node;
    if (!this.tail) this.tail = node;
    this.length++;
  }

  insertAt(index, value) {
    if (index < 0 || index > this.length) {
      throw new RangeError('Index out of bounds');
    }
    if (index === 0) return this.prepend(value);
    if (index === this.length) return this.append(value);

    let current = this.head;
    for (let i = 0; i < index - 1; i++) current = current.next;

    const node = new LinkedListNode(value);
    node.next = current.next;
    current.next = node;
    this.length++;
  }

  removeAt(index) {
    if (index < 0 || index >= this.length) {
      throw new RangeError('Index out of bounds');
    }

    let removed;
    if (index === 0) {
      removed = this.head;
      this.head = this.head.next;
      if (this.length === 1) this.tail = null;
    } else {
      let current = this.head;
      for (let i = 0; i < index - 1; i++) current = current.next;
      removed = current.next;
      current.next = removed.next;
      if (removed === this.tail) this.tail = current;
    }

    this.length--;
    return removed.value;
  }

  getAt(index) {
    if (index < 0 || index >= this.length) return null;
    let current = this.head;
    for (let i = 0; i < index; i++) current = current.next;
    return current.value;
  }

  find(value) {
    let i = 0;
    for (let v of this) {
      if (v === value) return i;
      i++;
    }
    return -1;
  }

  reverse() {
    let prev = null;
    let current = this.head;
    this.tail = current;

    while (current) {
      const next = current.next;
      current.next = prev;
      prev = current;
      current = next;
    }

    this.head = prev;
  }

  clear() {
    this.head = this.tail = null;
    this.length = 0;
  }

  toArray() {
    return [...this];
  }

  static fromArray(arr) {
    return new LinkedList(arr);
  }

  *[Symbol.iterator]() {
    let current = this.head;
    while (current) {
      yield current.value;
      current = current.next;
    }
  }
}

/* =========================================================
 * STACK (2026 Edition)
 * =======================================================*/

class Stack {
    constructor(maxSize = Infinity) {
        if (!Number.isFinite(maxSize) && maxSize !== Infinity) {
            throw new TypeError("maxSize must be a number or Infinity");
        }

        this.items = [];
        this.maxSize = maxSize;
        this.locked = false;
    }

    /* ---------------- Core ---------------- */

    push(item) {
        this._ensureUnlocked();

        if (this.isFull()) {
            throw new Error("Stack overflow");
        }

        this.items.push(item);
        return this.size();
    }

    pushMany(...items) {
        this._ensureUnlocked();

        if (this.size() + items.length > this.maxSize) {
            throw new Error("Stack overflow");
        }

        this.items.push(...items);
        return this.size();
    }

    pop() {
        this._ensureUnlocked();

        if (this.isEmpty()) {
            throw new Error("Stack underflow");
        }

        return this.items.pop();
    }

    popMany(count = 1) {
        this._ensureUnlocked();

        if (!Number.isInteger(count) || count < 0) {
            throw new TypeError("Invalid count");
        }

        if (count > this.size()) {
            throw new Error("Stack underflow");
        }

        return this.items.splice(-count).reverse();
    }

    peek(depth = 0) {
        if (depth < 0 || depth >= this.size()) return null;
        return this.items[this.items.length - 1 - depth];
    }

    clear() {
        this._ensureUnlocked();
        this.items.length = 0;
        return this;
    }

    /* ---------------- Queries ---------------- */

    isEmpty() {
        return this.items.length === 0;
    }

    isFull() {
        return this.size() >= this.maxSize;
    }

    size() {
        return this.items.length;
    }

    capacity() {
        return this.maxSize;
    }

    contains(value) {
        return this.items.includes(value);
    }

    indexOf(value) {
        return this.items.lastIndexOf(value);
    }

    /* ---------------- Utilities ---------------- */

    clone() {
        const copy = new Stack(this.maxSize);
        copy.items = structuredClone(this.items);
        return copy;
    }

    reverse() {
        this._ensureUnlocked();
        this.items.reverse();
        return this;
    }

    freeze() {
        this.locked = true;
        Object.freeze(this.items);
        return this;
    }

    unfreeze() {
        if (Object.isFrozen(this.items)) {
            this.items = [...this.items];
        }
        this.locked = false;
        return this;
    }

    toArray() {
        return [...this.items];
    }

    toJSON() {
        return {
            type: "Stack",
            size: this.size(),
            maxSize: this.maxSize,
            items: this.toArray()
        };
    }

    static from(iterable, maxSize = Infinity) {
        const stack = new Stack(maxSize);
        stack.pushMany(...iterable);
        return stack;
    }

    /* ---------------- Iterator ---------------- */

    *[Symbol.iterator]() {
        for (let i = this.items.length - 1; i >= 0; i--) {
            yield this.items[i];
        }
    }

    /* ---------------- Internal ---------------- */

    _ensureUnlocked() {
        if (this.locked) {
            throw new Error("Stack is locked");
        }
    }
}

/* =========================================================
 * TREE
 * =======================================================*/

class TreeNode {
  constructor(value) {
    this.value = value;
    this.children = [];
    this.parent = null;
  }

  addChild(node) {
    node.parent = this;
    this.children.push(node);
  }

  removeChild(value) {
    this.children = this.children.filter(c => c.value !== value);
  }

  traverseDFS(callback) {
    callback(this);
    this.children.forEach(child => child.traverseDFS(callback));
  }

  traverseBFS(callback) {
    const queue = [this];
    while (queue.length) {
      const node = queue.shift();
      callback(node);
      queue.push(...node.children);
    }
  }

  search(value) {
    if (this.value === value) return this;
    for (const child of this.children) {
      const found = child.search(value);
      if (found) return found;
    }
    return null;
  }

  getDepth() {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  getHeight() {
    if (!this.children.length) return 0;
    return 1 + Math.max(...this.children.map(c => c.getHeight()));
  }
}

/* ========================================================= */

module.exports = {
  LinkedList,
  Stack,
  TreeNode
};
