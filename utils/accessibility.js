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
