/**
 * XML Parser Utility
 * Simple XML parser for parsing and generating XML
 */

/**
 * XMLParser class for parsing and generating XML
 */
export class XMLParser {
    /**
     * Parse XML string to JavaScript object
     * @param {string} xmlString - XML string to parse
     * @returns {Object} - Parsed XML object
     */
    static parse(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
        
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
            throw new Error('Invalid XML format');
        }
        
        return this.nodeToObject(xmlDoc.documentElement);
    }
    
    /**
     * Convert XML node to JavaScript object
     * @param {Node} node - XML node
     * @returns {Object|string} - Converted object or string
     */
    static nodeToObject(node) {
        if (node.nodeType === 3) {
            return node.textContent.trim();
        }
        
        const obj = {};
        obj['@name'] = node.nodeName;
        
        if (node.attributes && node.attributes.length > 0) {
            obj['@attributes'] = {};
            for (let i = 0; i < node.attributes.length; i++) {
                obj['@attributes'][node.attributes[i].name] = node.attributes[i].value;
            }
        }
        
        if (node.childNodes.length > 0) {
            const children = Array.from(node.childNodes)
                .filter(n => n.nodeType !== 3 || n.textContent.trim())
                .map(n => this.nodeToObject(n));
            
            if (children.length === 1 && typeof children[0] === 'string') {
                obj['@text'] = children[0];
            } else if (children.length > 0) {
                obj['@children'] = children;
            }
        }
        
        return obj;
    }
    
    /**
     * Convert JavaScript object to XML string
     * @param {Object} obj - Object to convert
     * @param {string} rootName - Root element name
     * @returns {string} - XML string
     */
    static stringify(obj, rootName = 'root') {
        return `<?xml version="1.0" encoding="UTF-8"?>\n${this.objectToXML(obj, rootName)}`;
    }
    
    /**
     * Convert object to XML string
     * @param {Object} obj - Object to convert
     * @param {string} tagName - Tag name
     * @returns {string} - XML string
     */
    static objectToXML(obj, tagName) {
        if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
            return `<${tagName}>${obj}</${tagName}>`;
        }
        
        let xml = `<${tagName}`;
        
        if (obj['@attributes']) {
            for (const [key, value] of Object.entries(obj['@attributes'])) {
                xml += ` ${key}="${value}"`;
            }
        }
        
        xml += '>';
        
        if (obj['@text']) {
            xml += obj['@text'];
        } else if (obj['@children']) {
            obj['@children'].forEach(child => {
                const childTag = child['@name'] || tagName;
                xml += '\n  ' + this.objectToXML(child, childTag).replace(/\n/g, '\n  ');
            });
            xml += '\n';
        } else {
            for (const [key, value] of Object.entries(obj)) {
                if (!key.startsWith('@')) {
                    xml += '\n  ' + this.objectToXML(value, key).replace(/\n/g, '\n  ');
                }
            }
            xml += '\n';
        }
        
        xml += `</${tagName}>`;
        return xml;
    }
}


