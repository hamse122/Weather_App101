/**
 * Markdown Parser Utility
 * Simple markdown parser for converting markdown to HTML
 */

/**
 * MarkdownParser class for parsing markdown text
 */
export class MarkdownParser {
    /**
     * Parse markdown text to HTML
     * @param {string} markdown - Markdown text
     * @returns {string} - HTML string
     */
    static parse(markdown) {
        let html = markdown;
        
        // Headers
        html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
        
        // Bold
        html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
        html = html.replace(/__(.*?)__/gim, '<strong>$1</strong>');
        
        // Italic
        html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
        html = html.replace(/_(.*?)_/gim, '<em>$1</em>');
        
        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');
        
        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/gim, '<img src="$2" alt="$1" />');
        
        // Code blocks
        html = html.replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>');
        html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
        
        // Line breaks
        html = html.replace(/\n\n/gim, '</p><p>');
        html = '<p>' + html + '</p>';
        
        // Lists
        html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
        html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Blockquotes
        html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');
        
        return html;
    }
    
    /**
     * Convert HTML to markdown (basic)
     * @param {string} html - HTML string
     * @returns {string} - Markdown string
     */
    static toMarkdown(html) {
        let markdown = html;
        
        // Headers
        markdown = markdown.replace(/<h1>(.*?)<\/h1>/gim, '# $1\n');
        markdown = markdown.replace(/<h2>(.*?)<\/h2>/gim, '## $1\n');
        markdown = markdown.replace(/<h3>(.*?)<\/h3>/gim, '### $1\n');
        
        // Bold
        markdown = markdown.replace(/<strong>(.*?)<\/strong>/gim, '**$1**');
        markdown = markdown.replace(/<b>(.*?)<\/b>/gim, '**$1**');
        
        // Italic
        markdown = markdown.replace(/<em>(.*?)<\/em>/gim, '*$1*');
        markdown = markdown.replace(/<i>(.*?)<\/i>/gim, '*$1*');
        
        // Links
        markdown = markdown.replace(/<a href="([^"]+)">([^<]+)<\/a>/gim, '[$2]($1)');
        
        // Images
        markdown = markdown.replace(/<img src="([^"]+)" alt="([^"]*)" \/>/gim, '![$2]($1)');
        
        // Code
        markdown = markdown.replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/gim, '```\n$1\n```');
        markdown = markdown.replace(/<code>([^<]+)<\/code>/gim, '`$1`');
        
        // Remove paragraph tags
        markdown = markdown.replace(/<p>/gim, '');
        markdown = markdown.replace(/<\/p>/gim, '\n\n');
        
        return markdown.trim();
    }
}


