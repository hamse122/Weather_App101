/**
 * Pagination Utility
 * Advanced pagination system for handling item pagination
 */

/**
 * Pagination class for managing paginated data
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
     * @returns {Array} - Items for the current page
     */
    getCurrentPage() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return this.items.slice(start, end);
    }
    
    /**
     * Move to the next page
     * @returns {Array} - Items for the next page
     */
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
        return this.getCurrentPage();
    }
    
    /**
     * Move to the previous page
     * @returns {Array} - Items for the previous page
     */
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
        return this.getCurrentPage();
    }
    
    /**
     * Go to a specific page
     * @param {number} page - Page number to go to
     * @returns {Array} - Items for the specified page
     */
    goToPage(page) {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
        }
        return this.getCurrentPage();
    }
    
    /**
     * Get pagination information
     * @returns {Object} - Pagination info object
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
     * @param {Array} newItems - New items to paginate
     */
    updateItems(newItems) {
        this.items = newItems;
        this.totalPages = Math.ceil(newItems.length / this.pageSize);
        this.currentPage = 1;
    }
}


