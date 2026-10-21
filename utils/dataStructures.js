/* =========================================================
 * LINKED LIST (2026 Edition)
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

        for (const value of iterable) {
            this.append(value);
        }
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
        return this;
    }

    prepend(value) {
        const node = new LinkedListNode(value);
        node.next = this.head;
        this.head = node;

        if (!this.tail) this.tail = node;

        this.length++;
        return this;
    }

    insertAt(index, value) {
        this._validateIndex(index, true);

        if (index === 0) return this.prepend(value);
        if (index === this.length) return this.append(value);

        const previous = this._nodeAt(index - 1);
        const node = new LinkedListNode(value);

        node.next = previous.next;
        previous.next = node;
        this.length++;

        return this;
    }

    removeAt(index) {
        this._validateIndex(index);

        let removed;

        if (index === 0) {
            removed = this.head;
            this.head = this.head.next;

            if (this.length === 1) this.tail = null;
        } else {
            const previous = this._nodeAt(index - 1);
            removed = previous.next;
            previous.next = removed.next;

            if (removed === this.tail) this.tail = previous;
        }

        this.length--;
        removed.next = null;

        return removed.value;
    }

    getAt(index) {
        if (!Number.isInteger(index) || index < 0 || index >= this.length) {
            return null;
        }

        return this._nodeAt(index).value;
    }

    setAt(index, value) {
        this._validateIndex(index);
        this._nodeAt(index).value = value;
        return this;
    }

    find(value) {
        let index = 0;

        for (const item of this) {
            if (Object.is(item, value)) return index;
            index++;
        }

        return -1;
    }

    includes(value) {
        return this.find(value) !== -1;
    }

    remove(value) {
        const index = this.find(value);
        if (index === -1) return false;

        this.removeAt(index);
        return true;
    }

    reverse() {
        if (this.length < 2) return this;

        let previous = null;
        let current = this.head;
        this.tail = this.head;

        while (current) {
            const next = current.next;
            current.next = previous;
            previous = current;
            current = next;
        }

        this.head = previous;
        return this;
    }

    clear() {
        this.head = this.tail = null;
        this.length = 0;
        return this;
    }

    isEmpty() {
        return this.length === 0;
    }

    get size() {
        return this.length;
    }

    toArray() {
        return [...this];
    }

    clone() {
        return new LinkedList(this);
    }

    _nodeAt(index) {
        let current = this.head;

        for (let i = 0; i < index; i++) {
            current = current.next;
        }

        return current;
    }

    _validateIndex(index, allowEnd = false) {
        const upperBound = allowEnd ? this.length : this.length - 1;

        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index > upperBound
        ) {
            throw new RangeError("Index out of bounds");
        }
    }

    *[Symbol.iterator]() {
        let current = this.head;

        while (current) {
            yield current.value;
            current = current.next;
        }
    }

    static fromArray(array) {
        if (!Array.isArray(array)) {
            throw new TypeError("Expected an array");
        }

        return new LinkedList(array);
    }
}

/* =========================================================
 * STACK (2026 Edition)
 * =======================================================*/

class Stack {
    constructor(maxSize = Infinity) {
        if (
            typeof maxSize !== "number" ||
            Number.isNaN(maxSize) ||
            maxSize < 0 ||
            (!Number.isFinite(maxSize) && maxSize !== Infinity)
        ) {
            throw new TypeError("maxSize must be a non-negative number or Infinity");
        }

        this.items = [];
        this.maxSize = Math.floor(maxSize);
        this.locked = false;
    }

    push(item) {
        this._ensureUnlocked();
        this._ensureCapacity(1);

        this.items.push(item);
        return this.size();
    }

    pushMany(...items) {
        this._ensureUnlocked();
        this._ensureCapacity(items.length);

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
            throw new TypeError("count must be a non-negative integer");
        }

        if (count > this.size()) {
            throw new Error("Stack underflow");
        }

        if (count === 0) return [];

        return this.items.splice(-count).reverse();
    }

    peek(depth = 0) {
        if (!Number.isInteger(depth) || depth < 0 || depth >= this.size()) {
            return null;
        }

        return this.items[this.items.length - 1 - depth];
    }

    clear() {
        this._ensureUnlocked();
        this.items.length = 0;
        return this;
    }

    isEmpty() {
        return this.items.length === 0;
    }

    isFull() {
        return this.items.length >= this.maxSize;
    }

    size() {
        return this.items.length;
    }

    capacity() {
        return this.maxSize;
    }

    remainingCapacity() {
        return Math.max(0, this.maxSize - this.size());
    }

    contains(value) {
        return this.items.includes(value);
    }

    indexOf(value) {
        return this.items.indexOf(value);
    }

    count(value) {
        return this.items.filter(item => Object.is(item, value)).length;
    }

    toArray() {
        return [...this.items];
    }

    clone() {
        const copy = new Stack(this.maxSize);
        copy.items = this._cloneItems();
        return copy;
    }

    _cloneItems() {
        if (typeof structuredClone === "function") {
            return structuredClone(this.items);
        }

        // Shallow fallback: nested objects retain their references.
        return [...this.items];
    }

    reverse() {
        this._ensureUnlocked();
        this.items.reverse();
        return this;
    }

    freeze() {
        Object.freeze(this.items);
        this.locked = true;
        return this;
    }

    unfreeze() {
        if (Object.isFrozen(this.items)) {
            this.items = [...this.items];
        }

        this.locked = false;
        return this;
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

        for (const item of iterable) {
            stack.push(item);
        }

        return stack;
    }

    *[Symbol.iterator]() {
        for (let i = this.items.length - 1; i >= 0; i--) {
            yield this.items[i];
        }
    }

    _ensureCapacity(count) {
        if (this.size() + count > this.maxSize) {
            throw new Error("Stack overflow");
        }
    }

    _ensureUnlocked() {
        if (this.locked) {
            throw new Error("Stack is locked");
        }
    }
}

/* =========================================================
 * TREE NODE (2026 Edition)
 * =======================================================*/

class TreeNode {
    constructor(value) {
        this.value = value;
        this.children = [];
        this.parent = null;
    }

    addChild(node) {
        if (!(node instanceof TreeNode)) {
            throw new TypeError("Child must be a TreeNode");
        }

        if (node === this || node._containsNode(this)) {
            throw new Error("Adding this child would create a cycle");
        }

        if (node.parent) {
            node.parent.removeChildNode(node);
        }

        node.parent = this;
        this.children.push(node);

        return this;
    }

    removeChild(value) {
        const index = this.children.findIndex(
            child => Object.is(child.value, value)
        );

        if (index === -1) return false;

        const [removed] = this.children.splice(index, 1);
        removed.parent = null;

        return true;
    }

    removeChildNode(node) {
        const index = this.children.indexOf(node);
        if (index === -1) return false;

        this.children.splice(index, 1);
        node.parent = null;

        return true;
    }

    traverseDFS(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("callback must be a function");
        }

        const stack = [this];

        while (stack.length) {
            const node = stack.pop();
            callback(node);

            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i]);
            }
        }

        return this;
    }

    traverseBFS(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("callback must be a function");
        }

        const queue = [this];
        let index = 0;

        while (index < queue.length) {
            const node = queue[index++];
            callback(node);
            queue.push(...node.children);
        }

        return this;
    }

    search(value) {
        const stack = [this];

        while (stack.length) {
            const node = stack.pop();

            if (Object.is(node.value, value)) return node;

            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push(node.children[i]);
            }
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
        let height = 0;
        const stack = [[this, 0]];

        while (stack.length) {
            const [node, depth] = stack.pop();
            height = Math.max(height, depth);

            for (const child of node.children) {
                stack.push([child, depth + 1]);
            }
        }

        return height;
    }

    _containsNode(target) {
        const stack = [this];

        while (stack.length) {
            const node = stack.pop();

            if (node === target) return true;

            stack.push(...node.children);
        }

        return false;
    }

    toJSON() {
        return {
            value: this.value,
            children: this.children.map(child => child.toJSON())
        };
    }
}

/* =========================================================
 * EXPORTS
 * =======================================================*/

module.exports = {
    LinkedList,
    LinkedListNode,
    Stack,
    TreeNode
};
