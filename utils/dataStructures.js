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

module.exports = { LinkedList, Stack, TreeNode };

