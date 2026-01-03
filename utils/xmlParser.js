/**
 * Advanced XML Parser Utility
 * - Browser compatible
 * - Structured output
 * - Safe XML escaping
 * - Pretty formatting
 */

export class XMLParser {

    // =====================
    // PARSE
    // =====================
    static parse(xmlString, options = {}) {
        if (typeof DOMParser === 'undefined') {
            throw new Error('DOMParser not available (Node.js requires xmldom or similar)');
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'application/xml');

        if (xmlDoc.getElementsByTagName('parsererror').length) {
            throw new Error('Invalid XML');
        }

        return this.#nodeToObject(xmlDoc.documentElement, options);
    }

    static #nodeToObject(node, options) {
        const obj = {
            name: node.nodeName,
            attributes: {},
            children: [],
            text: null
        };

        // Attributes
        if (node.attributes) {
            for (const attr of node.attributes) {
                obj.attributes[attr.name] = attr.value;
            }
        }

        for (const child of node.childNodes) {
            // Text / CDATA
            if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
                const text = child.textContent.trim();
                if (text) obj.text = (obj.text || '') + text;
            }

            // Element
            if (child.nodeType === Node.ELEMENT_NODE) {
                obj.children.push(this.#nodeToObject(child, options));
            }
        }

        // Cleanup
        if (!Object.keys(obj.attributes).length) delete obj.attributes;
        if (!obj.children.length) delete obj.children;
        if (!obj.text) delete obj.text;

        return obj;
    }

    // =====================
    // STRINGIFY
    // =====================
    static stringify(obj, options = {}) {
        const {
            pretty = true,
            indent = '  ',
            declaration = true
        } = options;

        const xml =
            this.#objectToXML(obj, 0, pretty, indent);

        return declaration
            ? `<?xml version="1.0" encoding="UTF-8"?>\n${xml}`
            : xml;
    }

    static #objectToXML(node, level, pretty, indent) {
        const pad = pretty ? indent.repeat(level) : '';
        const newline = pretty ? '\n' : '';

        let xml = `${pad}<${node.name}`;

        // Attributes
        if (node.attributes) {
            for (const [k, v] of Object.entries(node.attributes)) {
                xml += ` ${k}="${this.#escape(v)}"`;
            }
        }

        // Empty
        if (!node.text && !node.children) {
            return xml + `/>${newline}`;
        }

        xml += '>';

        // Text
        if (node.text) {
            xml += this.#escape(node.text);
        }

        // Children
        if (node.children) {
            xml += newline;
            for (const child of node.children) {
                xml += this.#objectToXML(child, level + 1, pretty, indent);
            }
            xml += pad;
        }

        xml += `</${node.name}>${newline}`;
        return xml;
    }

    // =====================
    // UTIL
    // =====================
    static #escape(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
}
