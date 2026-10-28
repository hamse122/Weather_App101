// ==========================
// RENDER HTML (v4)
// ==========================
static #renderHTML(tokens) {
    if (!Array.isArray(tokens)) {
        throw new TypeError("Tokens must be an array");
    }

    let html = "";
    let listOpen = null;

    const closeList = () => {
        if (listOpen) {
            html += `</${listOpen}>`;
            listOpen = null;
        }
    };

    for (const token of tokens) {
        if (!token || typeof token.type !== "string") continue;

        const isList = token.type === "ul" || token.type === "ol";

        if (listOpen && (!isList || listOpen !== token.type)) {
            closeList();
        }

        switch (token.type) {
            case "heading": {
                const level = Number(token.level);

                if (!Number.isInteger(level) || level < 1 || level > 6) {
                    break;
                }

                const text = String(token.text ?? "");
                const id =
                    text
                        .toLowerCase()
                        .trim()
                        .replace(/[^\p{L}\p{N}\s-]/gu, "")
                        .replace(/\s+/g, "-") || "heading";

                html += `<h${level} id="${this.#escapeAttribute(id)}">${this.#inline(text)}</h${level}>`;
                break;
            }

            case "paragraph":
                html += `<p>${this.#inline(String(token.text ?? ""))}</p>`;
                break;

            case "quote":
                html += `<blockquote>${this.#inline(String(token.text ?? ""))}</blockquote>`;
                break;

            case "ul":
            case "ol": {
                if (listOpen !== token.type) {
                    closeList();
                    html += `<${token.type}>`;
                    listOpen = token.type;
                }

                const text = String(token.text ?? "");
                const task = text.match(/^\[( |x|X)\]\s+(.*)$/);

                if (task) {
                    const checked = task[1].toLowerCase() === "x";

                    html +=
                        `<li class="task-list-item">` +
                        `<input type="checkbox" disabled${checked ? " checked" : ""} aria-label="${checked ? "Completed task" : "Incomplete task"}">` +
                        ` ${this.#inline(task[2])}</li>`;
                } else {
                    html += `<li>${this.#inline(text)}</li>`;
                }

                break;
            }

            case "code": {
                const language = typeof token.language === "string"
                    ? token.language
                    : "";

                const langClass = /^[a-zA-Z0-9_+-]{1,40}$/.test(language)
                    ? ` class="language-${this.#escapeAttribute(language)}"`
                    : "";

                html += `<pre><code${langClass}>${this.#escape(String(token.content ?? ""))}</code></pre>`;
                break;
            }

            case "hr":
                html += "<hr>";
                break;

            default:
                break;
        }
    }

    closeList();

    return html;
}

// ==========================
// ATTRIBUTE ESCAPING
// ==========================
static #escapeAttribute(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
