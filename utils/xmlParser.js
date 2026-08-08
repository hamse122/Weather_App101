/**
 * Advanced XML Parser Utility v3
 * - Browser compatible
 * - Node.js compatible when DOMParser is available
 * - Structured output
 * - Safe XML escaping
 * - Pretty formatting
 * - Namespace support
 * - CDATA support
 * - Comments / processing instructions ignored
 * - XML declaration control
 * - Strict validation
 * - Depth protection
 * - Deterministic serialization
 */

export class XMLParser {
    // =====================
    // PARSE
    // =====================

    static parse(xmlString, options = {}) {
        if (typeof xmlString !== 'string') {
            throw new TypeError('XML input must be a string');
        }

        if (!xmlString.trim()) {
            throw new Error('XML input cannot be empty');
        }

        const {
            preserveWhitespace = false,
            trimText = true,
            maxDepth = 1000
        } = options;

        if (typeof DOMParser === 'undefined') {
            throw new Error(
                'DOMParser is not available in this environment'
            );
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(
            xmlString,
            'application/xml'
        );

        const parserError = xmlDoc.getElementsByTagName('parsererror');

        if (parserError.length > 0) {
            throw new Error(
                parserError[0].textContent?.trim() || 'Invalid XML'
            );
        }

        if (!xmlDoc.documentElement) {
            throw new Error('XML document has no root element');
        }

        return this.#nodeToObject(
            xmlDoc.documentElement,
            {
                preserveWhitespace,
                trimText,
                maxDepth
            },
            0
        );
    }

    static #nodeToObject(node, options, depth) {
        if (depth > options.maxDepth) {
            throw new Error(
                `Maximum XML depth of ${options.maxDepth} exceeded`
            );
        }

        const obj = {
            name: node.nodeName
        };

        // =====================
        // ATTRIBUTES
        // =====================

        if (node.attributes?.length) {
            obj.attributes = {};

            for (let i = 0; i < node.attributes.length; i++) {
                const attr = node.attributes[i];

                obj.attributes[attr.name] = attr.value;
            }
        }

        const children = [];
        const textParts = [];

        // =====================
        // CHILD NODES
        // =====================

        for (let i = 0; i < node.childNodes.length; i++) {
            const child = node.childNodes[i];

            // Text
            if (
                child.nodeType === 3 ||
                child.nodeType === 4
            ) {
                let text = child.textContent ?? '';

                if (options.trimText) {
                    text = text.trim();
                }

                if (text || options.preserveWhitespace) {
                    textParts.push(text);
                }

                continue;
            }

            // Element
            if (child.nodeType === 1) {
                children.push(
                    this.#nodeToObject(
                        child,
                        options,
                        depth + 1
                    )
                );
            }

            // Comments and processing instructions are ignored.
        }

        if (textParts.length) {
            obj.text = options.preserveWhitespace
                ? textParts.join('')
                : textParts.join(' ');
        }

        if (children.length) {
            obj.children = children;
        }

        return obj;
    }

    // =====================
    // STRINGIFY
    // =====================

    static stringify(obj, options = {}) {
        if (!obj || typeof obj !== 'object') {
            throw new TypeError(
                'XML object must be a valid object'
            );
        }

        const {
            pretty = true,
            indent = '  ',
            declaration = true,
            newline = '\n',
            validateNames = true
        } = options;

        if (typeof indent !== 'string') {
            throw new TypeError('Indent must be a string');
        }

        const xml = this.#objectToXML(
            obj,
            0,
            pretty,
            indent,
            newline,
            validateNames
        ).trimEnd();

        if (!declaration) {
            return xml;
        }

        return (
            `<?xml version="1.0" encoding="UTF-8"?>` +
            `${newline}${xml}`
        );
    }

    static #objectToXML(
        node,
        level,
        pretty,
        indent,
        newline,
        validateNames
    ) {
        if (!node || typeof node !== 'object') {
            throw new TypeError('Invalid XML node');
        }

        const name = String(node.name || '').trim();

        if (!name) {
            throw new Error('XML node name is required');
        }

        if (
            validateNames &&
            !this.#isValidName(name)
        ) {
            throw new Error(
                `Invalid XML element name: "${name}"`
            );
        }

        const pad = pretty
            ? indent.repeat(level)
            : '';

        let xml = `${pad}<${name}`;

        // =====================
        // ATTRIBUTES
        // =====================

        if (
            node.attributes &&
            typeof node.attributes === 'object'
        ) {
            for (const [key, value] of Object.entries(
                node.attributes
            )) {
                if (
                    validateNames &&
                    !this.#isValidName(key)
                ) {
                    throw new Error(
                        `Invalid XML attribute name: "${key}"`
                    );
                }

                xml += ` ${key}="${this.#escape(value)}"`;
            }
        }

        const hasText =
            node.text !== undefined &&
            node.text !== null &&
            String(node.text).length > 0;

        const hasChildren =
            Array.isArray(node.children) &&
            node.children.length > 0;

        // =====================
        // EMPTY ELEMENT
        // =====================

        if (!hasText && !hasChildren) {
            return `${xml}/>${pretty ? newline : ''}`;
        }

        xml += '>';

        // =====================
        // TEXT
        // =====================

        if (hasText) {
            xml += this.#escape(node.text);
        }

        // =====================
        // CHILDREN
        // =====================

        if (hasChildren) {
            if (pretty) {
                xml += newline;
            }

            for (const child of node.children) {
                xml += this.#objectToXML(
                    child,
                    level + 1,
                    pretty,
                    indent,
                    newline,
                    validateNames
                );
            }

            if (pretty) {
                xml += pad;
            }
        }

        xml += `</${name}>`;

        if (pretty) {
            xml += newline;
        }

        return xml;
    }

    // =====================
    // XML NAME VALIDATION
    // =====================

    static #isValidName(name) {
        return /^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(name);
    }

    // =====================
    // XML ESCAPING
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
