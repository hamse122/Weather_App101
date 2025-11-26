// Custom Data Structures implementation
class LinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }
    
    append(value) {
        const newNode = { value, next: null };
        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            this.tail.next = newNode;
            this.tail = newNode;
        }
        this.length++;
    }
    
    prepend(value) {
        const newNode = { value, next: this.head };
        this.head = newNode;
        if (!this.tail) this.tail = newNode;
        this.length++;
    }
    
    toArray() {
        const result = [];
        let current = this.head;
        while (current) {
            result.push(current.value);
            current = current.next;
        }
        return result;
    }
}

class Stack {
    constructor() {
        this.items = [];
    }
    
    push(item) {
        this.items.push(item);
    }
    
    pop() {
        return this.items.pop();
    }
    
    peek() {
        return this.items[this.items.length - 1];
    }
    
    isEmpty() {
        return this.items.length === 0;
    }
    
    size() {
        return this.items.length;
    }
}

class TreeNode {
    constructor(value) {
        this.value = value;
        this.children = [];
    }
    
    addChild(node) {
        this.children.push(node);
    }
    
    traverse(callback) {
        callback(this.value);
        this.children.forEach(child => child.traverse(callback));
    }
}

// Extended and Upgraded Data Structures Implementation

class LinkedList {
    constructor() {
        this.head = null;
        this.tail = null;
        this.length = 0;
    }

    append(value) {
        const newNode = { value, next: null };
        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
        } else {
            this.tail.next = newNode;
            this.tail = newNode;
        }
        this.length++;
    }

    prepend(value) {
        const newNode = { value, next: this.head };
        this.head = newNode;
        if (!this.tail) this.tail = newNode;
        this.length++;
    }

    insertAt(index, value) {
        if (index < 0 || index > this.length) throw new Error("Index out of bounds");
        if (index === 0) return this.prepend(value);
        if (index === this.length) return this.append(value);

        let current = this.head;
        for (let i = 0; i < index - 1; i++) current = current.next;

        const newNode = { value, next: current.next };
        current.next = newNode;
        this.length++;
    }

    removeAt(index) {
        if (index < 0 || index >= this.length) throw new Error("Index out of bounds");
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
            if (index === this.length - 1) this.tail = current;
        }

        this.length--;
        return removed.value;
    }

    find(value) {
        let current = this.head;
        let index = 0;
        while (current) {
            if (current.value === value) return index;
            current = current.next;
            index++;
        }
        return -1;
    }

    toArray() {
        const result = [];
        let current = this.head;
        while (current) {
            result.push(current.value);
            current = current.next;
        }
        return result;
    }
}

class Stack {
    constructor() {
        this.items = [];
    }

    push(item) {
        this.items.push(item);
    }

    pop() {
        if (this.isEmpty()) throw new Error("Stack underflow: No items to pop");
        return this.items.pop();
    }

    peek() {
        if (this.isEmpty()) return null;
        return this.items[this.items.length - 1];
    }

    clear() {
        this.items = [];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    size() {
        return this.items.length;
    }
}

class TreeNode {
    constructor(value) {
        this.value = value;
        this.children = [];
    }

    addChild(node) {
        this.children.push(node);
    }

    removeChild(value) {
        this.children = this.children.filter(child => child.value !== value);
    }

    traverse(callback) {
        callback(this.value);
        this.children.forEach(child => child.traverse(callback));
    }

    search(value) {
        if (this.value === value) return this;
        for (const child of this.children) {
            const result = child.search(value);
            if (result) return result;
        }
        return null;
    }
}

module.exports = { LinkedList, Stack, TreeNode };
