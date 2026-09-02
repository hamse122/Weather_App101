/**
 * Advanced Pagination Utility (2026 Edition)
 * - Client-side & server-side pagination
 * - Filtering & sorting
 * - Stable page state
 * - Page change listeners
 * - Safe data validation
 * - Navigation helpers
 * - Immutable page information
 */

export class Pagination {
    constructor({
        items = [],
        pageSize = 10,
        serverSide = false,
        onChange = null
    } = {}) {
        this._originalItems = Array.isArray(items) ? [...items] : [];
        this.items = [...this._originalItems];

        this.pageSize = this._validatePageSize(pageSize);
        this.currentPage = 1;
        this.serverSide = Boolean(serverSide);

        this._listeners = new Set();

        if (typeof onChange === "function") {
            this._listeners.add(onChange);
        }

        this._recalculate();
    }

    /* ======================================================
       INTERNAL
    ====================================================== */

    _validatePageSize(size) {
        const value = Number(size);

        if (!Number.isInteger(value) || value <= 0) {
            throw new TypeError("Page size must be a positive integer.");
        }

        return value;
    }

    _recalculate() {
        this.totalItems = this.items.length;

        this.totalPages = Math.max(
            1,
            Math.ceil(this.totalItems / this.pageSize)
        );

        this.currentPage = Math.min(
            Math.max(1, this.currentPage),
            this.totalPages
        );
    }

    _emit() {
        const info = this.getPageInfo();

        for (const callback of this._listeners) {
            try {
                callback(info);
            } catch (error) {
                console.error("[Pagination] Listener error:", error);
            }
        }
    }

    _slice() {
        if (this.serverSide) {
            return [...this.items];
        }

        const start = (this.currentPage - 1) * this.pageSize;

        return this.items.slice(
            start,
            start + this.pageSize
        );
    }

    /* ======================================================
       CORE METHODS
    ====================================================== */

    getCurrentPage() {
        return this._slice();
    }

    goToPage(page) {
        const target = Number(page);

        if (!Number.isInteger(target)) {
            return this.getCurrentPage();
        }

        const previousPage = this.currentPage;

        this.currentPage = Math.min(
            Math.max(1, target),
            this.totalPages
        );

        if (previousPage !== this.currentPage) {
            this._emit();
        }

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
        if (!Array.isArray(newItems)) {
            throw new TypeError("Items must be an array.");
        }

        this._originalItems = [...newItems];
        this.items = [...newItems];
        this.currentPage = 1;

        this._recalculate();
        this._emit();

        return this;
    }

    appendItems(extraItems = []) {
        if (!Array.isArray(extraItems)) {
            throw new TypeError("Items must be an array.");
        }

        this._originalItems.push(...extraItems);
        this.items.push(...extraItems);

        this._recalculate();
        this._emit();

        return this;
    }

    removeItem(index) {
        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= this.items.length
        ) {
            return false;
        }

        const item = this.items[index];

        this.items.splice(index, 1);

        const originalIndex = this._originalItems.indexOf(item);

        if (originalIndex !== -1) {
            this._originalItems.splice(originalIndex, 1);
        }

        this._recalculate();
        this._emit();

        return true;
    }

    updatePageSize(newSize) {
        this.pageSize = this._validatePageSize(newSize);
        this.currentPage = 1;

        this._recalculate();
        this._emit();

        return this;
    }

    reset() {
        this.items = [...this._originalItems];
        this.currentPage = 1;

        this._recalculate();
        this._emit();

        return this;
    }

    /* ======================================================
       FILTER & SORT
    ====================================================== */

    filter(predicate) {
        if (typeof predicate !== "function") {
            throw new TypeError("Filter must be a function.");
        }

        this.items = this._originalItems.filter(predicate);
        this.currentPage = 1;

        this._recalculate();
        this._emit();

        return this;
    }

    sort(compareFn) {
        if (typeof compareFn !== "function") {
            throw new TypeError("Sort comparator must be a function.");
        }

        this.items.sort(compareFn);
        this.currentPage = 1;

        this._recalculate();
        this._emit();

        return this;
    }

    /* ======================================================
       LISTENERS
    ====================================================== */

    onPageChange(callback) {
        if (typeof callback !== "function") {
            throw new TypeError("Listener must be a function.");
        }

        this._listeners.add(callback);

        return () => {
            this._listeners.delete(callback);
        };
    }

    offPageChange(callback) {
        this._listeners.delete(callback);
        return this;
    }

    /* ======================================================
       INFO
    ====================================================== */

    getPageInfo() {
        const startIndex =
            this.totalItems === 0
                ? 0
                : (this.currentPage - 1) * this.pageSize;

        const endIndex = Math.min(
            startIndex + this.pageSize,
            this.totalItems
        );

        return Object.freeze({
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalItems: this.totalItems,
            pageSize: this.pageSize,

            hasNext:
                this.currentPage < this.totalPages,

            hasPrevious:
                this.currentPage > 1,

            startIndex,
            endIndex,

            isFirstPage:
                this.currentPage === 1,

            isLastPage:
                this.currentPage === this.totalPages,

            isEmpty:
                this.totalItems === 0,

            serverSide: this.serverSide
        });
    }
}
