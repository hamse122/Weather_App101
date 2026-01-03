/**
 * MarkdownParser v2
 * - Safe
 * - Reversible
 * - Deterministic
 * - Regex-minimized
 */

export class MarkdownParser {

    // ==========================
    // MARKDOWN → HTML
    // ==========================
    static parse(markdown = "") {
        const tokens = this.#tokenize(markdown);
        return this.#renderHTML(tokens);
    }

    // ==========================
    // HTML → MARKDOWN
    // ==========================
    static toMarkdown(html = "") {
        let md = html;

        md = md.replace(/<pre><code class="lang-(.*?)">([\s\S]*?)<\/code><\/pre>/g,
            (_, l, c) => `\`\`\`${l}\n${this.#unescape(c)}\n\`\`\``);

        md = md.replace(/<code>(.*?)<\/code>/g, "`$1`");

        md = md.replace(/<h([1-6])>(.*?)<\/h\1>/g,
            (_, l, t) => `${"#".repeat(+l)} ${t}\n\n`);

        md = md.replace(/<strong><em>(.*?)<\/em><\/strong>/g, "***$1***");
        md = md.replace(/<strong>(.*?)<\/strong>/g, "**$1**");
        md = md.replace(/<em>(.*?)<\/em>/g, "*$1*");
        md = md.replace(/<del>(.*?)<\/del>/g, "~~$1~~");

        md = md.replace(/<a href="([^"]+)">(.*?)<\/a>/g, "[$2]($1)");
        md = md.replace(/<img src="([^"]+)" alt="([^"]*)" ?\/?>/g, "![$2]($1)");

        md = md.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g,
            (_, t) => t.split('\n').map(l => `> ${l}`).join('\n'));

        md = md.replace(/<li>(.*?)<\/li>/g, "* $1\n");
        md = md.replace(/<\/?(ul|ol)>/g, "");

        md = md.replace(/<hr\s*\/?>/g, "\n---\n");
        md = md.replace(/<p>(.*?)<\/p>/g, "$1\n\n");

        return md.replace(/\n{3,}/g, "\n\n").trim();
    }

    // ==========================
    // TOKENIZER
    // ==========================
    static #tokenize(input) {
        const lines = input.split('\n');
        const tokens = [];
        let inCode = false;
        let buffer = [];

        for (let line of lines) {
            if (line.startsWith("```")) {
                if (inCode) {
                    tokens.push({ type: "code", content: buffer.join('\n') });
                    buffer = [];
                }
                inCode = !inCode;
                continue;
            }

            if (inCode) {
                buffer.push(line);
                continue;
            }

            if (/^#{1,6}\s/.test(line))
                tokens.push({ type: "heading", level: line.match(/^#+/)[0].length, text: line.replace(/^#+\s/, "") });

            else if (/^>\s?/.test(line))
                tokens.push({ type: "quote", text: line.replace(/^>\s?/, "") });

            else if (/^(\*|-)\s/.test(line))
                tokens.push({ type: "ul", text: line.replace(/^(\*|-)\s/, "") });

            else if (/^\d+\.\s/.test(line))
                tokens.push({ type: "ol", text: line.replace(/^\d+\.\s/, "") });

            else if (/^---$/.test(line))
                tokens.push({ type: "hr" });

            else if (line.trim())
                tokens.push({ type: "paragraph", text: line });

        }

        return tokens;
    }

    // ==========================
    // RENDER HTML
    // ==========================
    static #renderHTML(tokens) {
        let html = "";
        let listOpen = null;

        for (const t of tokens) {
            if (listOpen && t.type !== listOpen) {
                html += `</${listOpen}>`;
                listOpen = null;
            }

            switch (t.type) {
                case "heading":
                    html += `<h${t.level}>${this.#inline(t.text)}</h${t.level}>`;
                    break;

                case "paragraph":
                    html += `<p>${this.#inline(t.text)}</p>`;
                    break;

                case "quote":
                    html += `<blockquote>${this.#inline(t.text)}</blockquote>`;
                    break;

                case "ul":
                    if (!listOpen) {
                        html += "<ul>";
                        listOpen = "ul";
                    }
                    html += `<li>${this.#inline(t.text)}</li>`;
                    break;

                case "ol":
                    if (!listOpen) {
                        html += "<ol>";
                        listOpen = "ol";
                    }
                    html += `<li>${this.#inline(t.text)}</li>`;
                    break;

                case "code":
                    html += `<pre><code>${this.#escape(t.content)}</code></pre>`;
                    break;

                case "hr":
                    html += "<hr/>";
            }
        }

        if (listOpen) html += `</${listOpen}>`;
        return html;
    }

    // ==========================
    // INLINE PARSER
    // ==========================
    static #inline(text) {
        return this.#escape(text)
            .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
            .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
            .replace(/\*(.*?)\*/g, "<em>$1</em>")
            .replace(/~~(.*?)~~/g, "<del>$1</del>")
            .replace(/`([^`]+)`/g, "<code>$1</code>")
            .replace(/!\[(.*?)\]\((.*?)\)/g, `<img src="$2" alt="$1"/>`)
            .replace(/\[(.*?)\]\((.*?)\)/g, `<a href="$2">$1</a>`);
    }

    // ==========================
    // ESCAPE
    // ==========================
    static #escape(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    static #unescape(str) {
        return str
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&");
    }
}
