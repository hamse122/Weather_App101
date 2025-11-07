// Array utility functions
const arrayUtils = {
    // Remove duplicates from array
    removeDuplicates: (arr) => [...new Set(arr)],
    
    // Flatten nested arrays
    flatten: (arr) => arr.flat(Infinity),
    
    // Chunk array into smaller arrays
    chunk: (arr, size) => {
        const chunks = [];
        for (let i = 0; i < arr.length; i += size) {
            chunks.push(arr.slice(i, i + size));
        }
        return chunks;
    },
    
    // Get random item from array
    randomItem: (arr) => arr[Math.floor(Math.random() * arr.length)]
};

module.exports = arrayUtils;
