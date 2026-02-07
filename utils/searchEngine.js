/**
 * Advanced Search Engine Utility
 * Tokenization, TF-IDF ranking, and document management
 */

export class SearchEngine {
    constructor() {
        this.documents = new Map();     // id -> text
        this.index = new Map();         // term -> Map<docId, termFrequency>
        this.stopWords = new Set([
            'the', 'and', 'for', 'with', 'this', 'that', 'from', 'are', 'was'
        ]);
    }

    /**
     * Add or update a document
     * @param {string} id
     * @param {string} text
     */
    addDocument(id, text) {
        if (this.documents.has(id)) {
            this.removeDocument(id);
        }

        this.documents.set(id, text);
        this.indexDocument(id, text);
    }

    /**
     * Remove a document from index
     * @param {string} id
     */
    removeDocument(id) {
        this.documents.delete(id);

        for (const [, postings] of this.index) {
            postings.delete(id);
        }
    }

    /**
     * Index document with term frequencies
     * @param {string} id
     * @param {string} text
     */
    indexDocument(id, text) {
        const tokens = this.tokenize(text);
        const frequencies = new Map();

        tokens.forEach(token => {
            frequencies.set(token, (frequencies.get(token) || 0) + 1);
        });

        for (const [term, count] of frequencies) {
            if (!this.index.has(term)) {
                this.index.set(term, new Map());
            }
            this.index.get(term).set(id, count);
        }
    }

    /**
     * Tokenize and normalize text
     * @param {string} text
     * @returns {string[]}
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(
                word =>
                    word.length > 2 &&
                    !this.stopWords.has(word)
            );
    }

    /**
     * Compute IDF value
     * @param {string} term
     */
    idf(term) {
        const docsWithTerm = this.index.get(term)?.size || 0;
        return Math.log((this.documents.size + 1) / (docsWithTerm + 1));
    }

    /**
     * Search documents
     * @param {string} query
     * @param {number} limit
     */
    search(query, limit = 10) {
        const queryTokens = this.tokenize(query);
        const scores = new Map();

        queryTokens.forEach(term => {
            const postings = this.index.get(term);
            if (!postings) return;

            const idf = this.idf(term);

            postings.forEach((tf, docId) => {
                const prevScore = scores.get(docId) || 0;
                scores.set(docId, prevScore + tf * idf);
            });
        });

        return [...scores.entries()]
            .sort(([, a], [, b]) => b - a)
            .slice(0, limit)
            .map(([id, score]) => ({
                id,
                score: Number(score.toFixed(4)),
                text: this.documents.get(id)
            }));
    }
}
