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
 * STACK
 * =======================================================*/

class Stack {
  constructor(maxSize = Infinity) {
    this.items = [];
    this.maxSize = maxSize;
  }

  push(item) {
    if (this.size() >= this.maxSize) {
      throw new Error('Stack overflow');
    }
    this.items.push(item);
  }

  pop() {
    if (this.isEmpty()) {
      throw new Error('Stack underflow');
    }
    return this.items.pop();
  }

  peek() {
    return this.isEmpty() ? null : this.items[this.items.length - 1];
  }

  clear() {
    this.items.length = 0;
  }

  isEmpty() {
    return this.items.length === 0;
  }

  size() {
    return this.items.length;
  }

  toArray() {
    return [...this.items];
  }

  *[Symbol.iterator]() {
    for (let i = this.items.length - 1; i >= 0; i--) {
      yield this.items[i];
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
