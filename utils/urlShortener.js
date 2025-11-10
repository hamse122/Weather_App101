// URL Shortener utility
class URLShortener {
    constructor() {
        this.urls = new Map();
        this.baseUrl = 'https://short.url/';
        this.characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    }
    
    generateCode(length = 6) {
        let code = '';
        for (let i = 0; i < length; i++) {
            code += this.characters.charAt(Math.floor(Math.random() * this.characters.length));
        }
        return code;
    }
    
    shorten(longUrl, customCode = null) {
        if (customCode && this.urls.has(customCode)) {
            throw new Error('Custom code already exists');
        }
        
        const code = customCode || this.generateCode();
        const shortUrl = this.baseUrl + code;
        
        this.urls.set(code, {
            longUrl,
            shortUrl,
            createdAt: new Date(),
            clicks: 0
        });
        
        return shortUrl;
    }
    
    expand(shortUrl) {
        const code = shortUrl.replace(this.baseUrl, '');
        const urlData = this.urls.get(code);
        
        if (!urlData) {
            throw new Error('URL not found');
        }
        
        urlData.clicks++;
        return urlData.longUrl;
    }
    
    getStats(code) {
        const urlData = this.urls.get(code);
        return urlData ? {
            longUrl: urlData.longUrl,
            shortUrl: urlData.shortUrl,
            createdAt: urlData.createdAt,
            clicks: urlData.clicks
        } : null;
    }
    
    getAllUrls() {
        return Array.from(this.urls.entries()).map(([code, data]) => ({
            code,
            ...data
        }));
    }
}

module.exports = URLShortener;

