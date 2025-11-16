/**
 * Pagination Utility
 * Advanced pagination system for handling item pagination
 */

export class Pagination {
    constructor(items = [], pageSize = 10) {
        this.items = items;
        this.pageSize = pageSize;
        this.currentPage = 1;
        this.totalPages = Math.ceil(items.length / pageSize);
    }
    
    /**
     * Get the current page items
     */
    getCurrentPage() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.items.slice(start, end);
    }

    /**
     * Move to the next page
     */
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
        return this.getCurrentPage();
    }

    /**
     * Move to the previous page
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
        return this.getCurrentPage();
    }

    /**
     * Go to a specific page
     */
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
        }
        return this.getCurrentPage();
    }

    /**
     * Get pagination information
     */
    getPageInfo() {
        return {
            currentPage: this.currentPage,
            totalPages: this.totalPages,
            totalItems: this.items.length,
            hasNext: this.currentPage < this.totalPages,
            hasPrevious: this.currentPage > 1,
            startIndex: (this.currentPage - 1) * this.pageSize,
            endIndex: Math.min(this.currentPage * this.pageSize, this.items.length)
        };
    }

    /**
     * Update the items array
     */
    updateItems(newItems) {
        this.items = newItems;
        this.totalPages = Math.ceil(newItems.length / this.pageSize);
        this.currentPage = 1;
    }

    /* ---------------------------------------------------------
     * ADDITIONAL LINES ADDED BELOW
     * --------------------------------------------------------- */

    /**
     * Change the page size dynamically
     * @param {number} newSize
     */
    updatePageSize(newSize) {
        if (newSize <= 0) throw new Error("Page size must be greater than zero.");
        this.pageSize = newSize;
        this.totalPages = Math.ceil(this.items.length / newSize);
        this.currentPage = 1;
    }

    /**
     * Check if the pagination is empty
     * @returns {boolean}
     */
    isEmpty() {
        return this.items.length === 0;
    }

    /**
     * Get the first page
     */
    firstPage() {
        this.currentPage = 1;
        return this.getCurrentPage();
    }

    /**
     * Get the last page
     */
    lastPage() {
        this.currentPage = this.totalPages;
        return this.getCurrentPage();
    }

    /**
     * Append items to existing list
     * @param {Array} extraItems
     */
    appendItems(extraItems) {
        this.items = [...this.items, ...extraItems];
        this.totalPages = Math.ceil(this.items.length / this.pageSize);
    }

    /**
     * Remove an item by index
     * @param {number} index
     */
    removeItem(index) {
        if (index < 0 || index >= this.items.length) return false;
        this.items.splice(index, 1);
        this.totalPages = Math.ceil(this.items.length / this.pageSize);
        if (this.currentPage > this.totalPages) this.currentPage = this.totalPages;
        return true;
    }

    /**
     * Reset pagination
     */
    reset() {
        this.currentPage = 1;
    }
}
