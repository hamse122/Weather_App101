/**
 * Search Engine Utility
 * Simple search engine with ranking and tokenization
 */

/**
 * SearchEngine class for text search with ranking
 */
export class SearchEngine {
    constructor() {
        this.documents = new Map();
        this.index = new Map();
    }
    
    /**
     * Add a document to the search index
     * @param {string} id - Unique document identifier
     * @param {string} text - Document text content
     */
    addDocument(id, text) {
        this.documents.set(id, text);
        this.updateIndex(id, text);
    }
    
    /**
     * Update the search index for a document
     * @param {string} id - Document identifier
     * @param {string} text - Document text content
     */
    updateIndex(id, text) {
        const words = this.tokenize(text);
        words.forEach(word => {
            if (!this.index.has(word)) {
                this.index.set(word, new Set());
            }
            this.index.get(word).add(id);
        });
    }
    
    /**
     * Tokenize text into searchable words
     * @param {string} text - Text to tokenize
     * @returns {Array} - Array of tokens
     */
    tokenize(text) {
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(word => word.length > 2);
    }
    
    /**
     * Search for documents matching the query
     * @param {string} query - Search query
     * @param {number} limit - Maximum number of results
     * @returns {Array} - Array of search results with scores
     */
    search(query, limit = 10) {
        const queryWords = this.tokenize(query);
        const results = new Map();
        
        queryWords.forEach(word => {
            const documents = this.index.get(word);
            if (documents) {
                documents.forEach(docId => {
                    const score = results.get(docId) || 0;
                    results.set(docId, score + 1);
                });
            }
        });
        
        return Array.from(results.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, limit)
            .map(([docId, score]) => ({
                id: docId,
                score,
                text: this.documents.get(docId)
            }));
    }
}


