// Web accessibility utilities
class Accessibility {
    constructor() {
        this.observers = new Map();
        this.focusTraps = new Map();
        this.liveRegions = new Map();
    }

    trapFocus(container) {
        const focusableElements = this.getFocusableElements(container);
        if (focusableElements.length === 0) {
            return null;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const trapId = this.generateId();

        const keyHandler = event => {
            if (event.key !== 'Tab') {
                return;
            }
            if (event.shiftKey && document.activeElement === firstElement) {
                event.preventDefault();
                lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
                event.preventDefault();
                firstElement.focus();
            }
        };

        container.addEventListener('keydown', keyHandler);
        this.focusTraps.set(trapId, { container, keyHandler });
        firstElement.focus();
        return trapId;
    }

    releaseFocusTrap(trapId) {
        const trap = this.focusTraps.get(trapId);
        if (trap) {
            trap.container.removeEventListener('keydown', trap.keyHandler);
            this.focusTraps.delete(trapId);
        }
    }

    getFocusableElements(container) {
        const selectors = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]'
        ].join(', ');

        return Array.from(container.querySelectorAll(selectors)).filter(element => {
            const style = window.getComputedStyle(element);
            return style.visibility !== 'hidden' && style.display !== 'none' && !element.hasAttribute('disabled');
        });
    }

    createLiveRegion(type = 'polite', label = '') {
        const region = document.createElement('div');
        region.setAttribute('aria-live', type);
        region.setAttribute('aria-atomic', 'true');
        region.setAttribute('aria-label', label);
        region.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;

        document.body.appendChild(region);
        const regionId = this.generateId();
        this.liveRegions.set(regionId, region);
        return regionId;
    }

    announce(message, regionId = null, type = 'polite') {
        let region;
        if (regionId) {
            region = this.liveRegions.get(regionId);
        } else {
            region = Array.from(this.liveRegions.values()).find(r => r.getAttribute('aria-live') === type);
            if (!region) {
                const newRegionId = this.createLiveRegion(type, 'Announcements');
                region = this.liveRegions.get(newRegionId);
            }
        }

        if (region) {
            region.textContent = '';
            region.textContent = message;
        }
    }

    makeAccessibleList(container) {
        const items = Array.from(container.children);
        let focusedIndex = -1;

        const setFocus = index => {
            if (focusedIndex >= 0) {
                items[focusedIndex].setAttribute('tabindex', '-1');
            }
            focusedIndex = index;
            items[focusedIndex].setAttribute('tabindex', '0');
            items[focusedIndex].focus();
        };

        container.addEventListener('keydown', event => {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    setFocus((focusedIndex + 1) % items.length);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    setFocus((focusedIndex - 1 + items.length) % items.length);
                    break;
                case 'Home':
                    event.preventDefault();
                    setFocus(0);
                    break;
                case 'End':
                    event.preventDefault();
                    setFocus(items.length - 1);
                    break;
                default:
                    break;
            }
        });

        items.forEach((item, index) => {
            item.setAttribute('tabindex', index === 0 ? '0' : '-1');
            item.setAttribute('role', 'option');
        });

        if (items.length > 0) {
            focusedIndex = 0;
        }

        container.setAttribute('role', 'listbox');
    }

    addSkipLink(text = 'Skip to main content', target = 'main') {
        const skipLink = document.createElement('a');
        skipLink.href = `#${target}`;
        skipLink.textContent = text;
        skipLink.style.cssText = `
            position: absolute;
            top: -40px;
            left: 6px;
            background: #000;
            color: #fff;
            padding: 8px;
            text-decoration: none;
            z-index: 10000;
            transition: top 0.2s;
        `;

        skipLink.addEventListener('focus', () => {
            skipLink.style.top = '6px';
        });
        skipLink.addEventListener('blur', () => {
            skipLink.style.top = '-40px';
        });

        document.body.insertBefore(skipLink, document.body.firstChild);
        return skipLink;
    }

    generateId() {
        return `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    cleanup() {
        this.liveRegions.forEach(region => {
            if (region.parentNode) {
                region.parentNode.removeChild(region);
            }
        });
        this.liveRegions.clear();

        this.focusTraps.forEach(trap => {
            trap.container.removeEventListener('keydown', trap.keyHandler);
        });
        this.focusTraps.clear();
    }
}

module.exports = Accessibility;
/**
 * Accessibility Utility
 * Accessibility helpers for improving web accessibility
 */

/**
 * Accessibility class for managing accessibility features
 */
export class Accessibility {
    /**
     * Set ARIA label on an element
     * @param {HTMLElement} element - DOM element
     * @param {string} label - ARIA label
     */
    static setAriaLabel(element, label) {
        if (element) {
            element.setAttribute('aria-label', label);
        }
    }
    
    /**
     * Set ARIA described by
     * @param {HTMLElement} element - DOM element
     * @param {string} descriptionId - Description element ID
     */
    static setAriaDescribedBy(element, descriptionId) {
        if (element) {
            element.setAttribute('aria-describedby', descriptionId);
        }
    }
    
    /**
     * Set ARIA hidden
     * @param {HTMLElement} element - DOM element
     * @param {boolean} hidden - Whether element should be hidden
     */
    static setAriaHidden(element, hidden) {
        if (element) {
            element.setAttribute('aria-hidden', hidden.toString());
        }
    }
    
    /**
     * Set ARIA live region
     * @param {HTMLElement} element - DOM element
     * @param {string} politeness - Politeness level (polite, assertive, off)
     */
    static setAriaLive(element, politeness = 'polite') {
        if (element) {
            element.setAttribute('aria-live', politeness);
        }
    }
    
    /**
     * Announce a message to screen readers
     * @param {string} message - Message to announce
     * @param {string} politeness - Politeness level
     */
    static announce(message, politeness = 'polite') {
        const announcement = document.createElement('div');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', politeness);
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.cssText = 'position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden;';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
    
    /**
     * Focus an element
     * @param {HTMLElement} element - DOM element to focus
     */
    static focus(element) {
        if (element && typeof element.focus === 'function') {
            element.focus();
        }
    }
    
    /**
     * Trap focus within an element
     * @param {HTMLElement} container - Container element
     * @returns {Function} - Cleanup function
     */
    static trapFocus(container) {
        const focusableElements = container.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        const handleTab = (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        };
        
        container.addEventListener('keydown', handleTab);
        
        return () => {
            container.removeEventListener('keydown', handleTab);
        };
    }
    
    /**
     * Check if user prefers reduced motion
     * @returns {boolean} - True if user prefers reduced motion
     */
    static prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    
    /**
     * Check if user prefers dark mode
     * @returns {boolean} - True if user prefers dark mode
     */
    static prefersDarkMode() {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    /**
     * Get keyboard navigation handler
     * @param {Object} handlers - Keyboard event handlers
     * @returns {Function} - Event handler function
     */
    static getKeyboardHandler(handlers) {
        return (e) => {
            const handler = handlers[e.key];
            if (handler) {
                handler(e);
            }
        };
    }
}
