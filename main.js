// String manipulation helpers
class StringHelpers {
    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }
    
    static reverse(str) {
        return str.split('').reverse().join('');
    }
    
    static isPalindrome(str) {
        const cleanStr = str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return cleanStr === this.reverse(cleanStr);
    }
    
    static truncate(str, length) {
        return str.length > length ? str.substring(0, length) + '...' : str;
    }
    
    static countVowels(str) {
        const matches = str.match(/[aeiou]/gi);
        return matches ? matches.length : 0;
    }
}

module.exports = StringHelpers;
