/**
 * Advanced Pagination Utility (2026 Edition)
 * - Client-side & optional server-side mode
 * - Filtering & sorting
 * - Page change listeners
 * - Safe state management
 */

export class Pagination {
    constructor({
        items = [],
        pageSize = 10,
        serverSide = false
    } = {}) {
        this._originalItems = Array.isArray(items) ? items : [];
        this.items = [...this._originalItems];

        this.pageSize = Math.max(1, pageSize);
        this.currentPage = 1;
        this.serverSide = serverSide;

        this._listeners = new Set();

        this._recalculate();
    }

    /* ======================================================
       INTERNAL
    ====================================================== */

    _recalculate() {
        this.totalItems = this.items.length;
        this.totalPages = Math.max(
            1,
            Math.ceil(this.totalItems / this.pageSize)
        );

        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages;
        }
    }

    _emit() {
        const info = this.getPageInfo();
        this._listeners.forEach(cb => cb(info));
    }

    _slice() {
        if (this.serverSide) return this.items;

        const start = (this.currentPage - 1) * this.pageSize;
        return this.items.slice(start, start + this.pageSize);
    }

    /* ======================================================
       CORE METHODS
    ====================================================== */

    getCurrentPage() {
        return this._slice();
    }

    goToPage(page) {
        const newPage = Number(page);

        if (!Number.isInteger(newPage)) return this.getCurrentPage();

        this.currentPage = Math.min(
            Math.max(1, newPage),
            this.totalPages
        );

        this._emit();
        return this.getCurrentPage();
    }

    nextPage() {
        return this.goToPage(this.currentPage + 1);
    }

    previousPage() {
        return this.goToPage(this.currentPage - 1);
    }

    firstPage() {
        return this.goToPage(1);
    }

    lastPage() {
        return this.goToPage(this.totalPages);
    }

    /* ======================================================
       DATA MANAGEMENT
    ====================================================== */

    updateItems(newItems = []) {
        this._originalItems = [...newItems];
        this.items = [...newItems];
        this.currentPage = 1;
        this._recalculate();
        this._emit();
    }

    appendItems(extraItems = []) {
        this._originalItems.push(...extraItems);
        this.items.push(...extraItems);
        this._recalculate();
        this._emit();
    }

    removeItem(index) {
        if (index < 0 || index >= this.items.length) return false;

        this.items.splice(index, 1);
        this._originalItems.splice(index, 1);

        this._recalculate();
        this._emit();
        return true;
    }

    updatePageSize(newSize) {
        if (!Number.isInteger(newSize) || newSize <= 0) {
            throw new Error("Page size must be a positive integer.");
        }

        this.pageSize = newSize;
        this.currentPage = 1;
        this._recalculate();
        this._emit();
    }

    reset() {
        this.items = [...this._originalItems];
        this.currentPage = 1;
        this._recalculate();
        this._emit();
    }

    /* ======================================================
       FILTER & SORT
    ====================================================== */

    filter(predicate) {
        if (typeof predicate !== "function") return;

        this.items = this._originalItems.filter(predicate);
        this.currentPage = 1;
        this._recalculate();
        this._emit();
    }

    sort(compareFn) {
        if (typeof compareFn !== "function") return;

        this.items.sort(compareFn);
        this._emit();
    }

    /* ======================================================
       LISTENERS
    ====================================================== */

    onPageChange(callback) {
        if (typeof callback !== "function") return;
        this._listeners.add(callback);

        return () => this._listeners.delete(callback);
    }

    /* ======================================================
       INFO
    ====================================================== */

    getPageInfo() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(
            startIndex + this.pageSize,
            this.totalItems
        );

        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalItems: this.totalItems,
            pageSize: this.pageSize,
            hasNext: this.currentPage < this.totalPages,
            hasPrevious: this.currentPage > 1,
            startIndex,
            endIndex,
            isFirstPage: this.currentPage === 1,
            isLastPage: this.currentPage === this.totalPages,
            isEmpty: this.totalItems === 0
        };
    }
}
