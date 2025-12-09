/**
 * Advanced Markdown Parser Utility
 * Improved safety, accuracy, and reversibility
 */

export class MarkdownParser {
    /**
     * Parse markdown to HTML (safe, improved, supports more syntax)
     * @param {string} markdown
     * @returns {string}
     */
    static parse(markdown = "") {
        let html = markdown;

        // Escape unsafe HTML (basic XSS protection)
        html = html
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Restore markdown tags later
        const restore = (str) =>
            str.replace(/&lt;/g, "<").replace(/&gt;/g, ">");

        // Fenced Code Blocks  ```js ... ```
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) => {
            return `<pre><code class="lang-${lang || "text"}">${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Headers
        html = html.replace(/^### (.*)/gim, "<h3>$1</h3>");
        html = html.replace(/^## (.*)/gim, "<h2>$1</h2>");
        html = html.replace(/^# (.*)/gim, "<h1>$1</h1>");

        // Horizontal Rule
        html = html.replace(/^\s*(---|\*\*\*)\s*$/gim, "<hr/>");

        // Bold & Italic (non-conflicting)
        html = html.replace(/\*\*\*(.*?)\*\*\*/gim, "<strong><em>$1</em></strong>");
        html = html.replace(/___(.*?)___/gim, "<strong><em>$1</em></strong>");

        html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
        html = html.replace(/__(.*?)__/gim, "<strong>$1</strong>");

        html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>");
        html = html.replace(/_(.*?)_/gim, "<em>$1</em>");

        // Strikethrough
        html = html.replace(/~~(.*?)~~/gim, "<del>$1</del>");

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2">$1</a>`);

        // Images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, `<img src="$2" alt="$1" />`);

        // Blockquotes
        html = html.replace(/^> (.*)$/gim, "<blockquote>$1</blockquote>");

        // Ordered Lists
        html = html.replace(/^\d+\. (.*)$/gim, "<ol><li>$1</li></ol>");
        html = html.replace(/<\/ol>\s*<ol>/gim, ""); // merge sequences

        // Unordered Lists
        html = html.replace(/^[\*\-] (.*)$/gim, "<ul><li>$1</li></ul>");
        html = html.replace(/<\/ul>\s*<ul>/gim, ""); // merge sequences

        // Paragraphs (safe)
        html = html.replace(/^(?!<(h\d|ul|ol|li|pre|blockquote|img|hr|code|a|strong|em)).+/gim, "<p>$&</p>");

        return html.trim();
    }

    /**
     * Convert HTML -> Markdown (reversible & safer)
     * @param {string} html
     * @returns {string}
     */
    static toMarkdown(html = "") {
        let md = html;

        // Code blocks
        md = md.replace(/<pre><code(?: class="lang-(.*?)")?>([\s\S]*?)<\/code><\/pre>/g,
            (_, lang, code) => `\`\`\`${lang || ""}\n${code.trim()}\n\`\`\``);

        // Inline code
        md = md.replace(/<code>(.*?)<\/code>/g, "`$1`");

        // Headings
        md = md.replace(/<h1>(.*?)<\/h1>/g, "# $1\n\n");
        md = md.replace(/<h2>(.*?)<\/h2>/g, "## $1\n\n");
        md = md.replace(/<h3>(.*?)<\/h3>/g, "### $1\n\n");

        // HR
        md = md.replace(/<hr\s*\/?>/g, "\n---\n");

        // Bold & Italic
        md = md.replace(/<strong><em>(.*?)<\/em><\/strong>/g, "***$1***");
        md = md.replace(/<strong>(.*?)<\/strong>/g, "**$1**");
        md = md.replace(/<em>(.*?)<\/em>/g, "*$1*");

        // Strikethrough
        md = md.replace(/<del>(.*?)<\/del>/g, "~~$1~~");

        // Links
        md = md.replace(/<a href="([^"]+)">(.*?)<\/a>/g, "[$2]($1)");

        // Images
        md = md.replace(/<img src="([^"]+)" alt="([^"]*)" \/>/g, "![$2]($1)");

        // Blockquotes
        md = md.replace(/<blockquote>(.*?)<\/blockquote>/g, "> $1");

        // Lists
        md = md.replace(/<ul>\s*<li>(.*?)<\/li>\s*<\/ul>/g, "* $1");
        md = md.replace(/<ol>\s*<li>(.*?)<\/li>\s*<\/ol>/g, "1. $1");

        // Paragraphs
        md = md.replace(/<p>(.*?)<\/p>/g, "$1\n\n");

        // Cleanup
        md = md.replace(/\n{3,}/g, "\n\n");

        return md.trim();
    }
}
