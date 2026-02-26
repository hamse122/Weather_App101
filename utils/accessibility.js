/**
 * Advanced Accessibility Utility
 * Modern, unified, production-ready accessibility helper
 */

export default class Accessibility {
    constructor() {
        this.liveRegions = new Map();
        this.focusTraps = new Map();
        this.previousFocus = new Map();
    }

    /* ======================================================
       FOCUS MANAGEMENT
    ====================================================== */

    getFocusableElements(container) {
        if (!container) return [];

        const selector = [
            'a[href]:not([tabindex="-1"])',
            'area[href]',
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[contenteditable="true"]',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        return Array.from(container.querySelectorAll(selector))
            .filter(el => {
                const style = window.getComputedStyle(el);
                return (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    el.offsetParent !== null
                );
            });
    }

    trapFocus(container) {
        if (!container) return null;

        const focusable = this.getFocusableElements(container);
        if (!focusable.length) return null;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const trapId = this.#generateId();

        this.previousFocus.set(trapId, document.activeElement);

        const handleKeydown = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        container.addEventListener('keydown', handleKeydown);
        first.focus();

        this.focusTraps.set(trapId, { container, handleKeydown });
        return trapId;
    }

    releaseFocusTrap(trapId) {
        const trap = this.focusTraps.get(trapId);
        if (!trap) return;

        trap.container.removeEventListener('keydown', trap.handleKeydown);
        this.focusTraps.delete(trapId);

        const previous = this.previousFocus.get(trapId);
        if (previous && typeof previous.focus === 'function') {
            previous.focus();
        }

        this.previousFocus.delete(trapId);
    }

    /* ======================================================
       LIVE REGIONS
    ====================================================== */

    createLiveRegion(type = 'polite', label = 'Announcements') {
        const region = document.createElement('div');

        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', type);
        region.setAttribute('aria-atomic', 'true');
        region.setAttribute('aria-label', label);

        region.style.cssText = `
            position: absolute;
            width: 1px;
            height: 1px;
            margin: -1px;
            padding: 0;
            overflow: hidden;
            clip: rect(0 0 0 0);
            border: 0;
        `;

        document.body.appendChild(region);

        const id = this.#generateId();
        this.liveRegions.set(id, region);
        return id;
    }

    announce(message, type = 'polite') {
        if (!message) return;

        let region = Array.from(this.liveRegions.values())
            .find(r => r.getAttribute('aria-live') === type);

        if (!region) {
            const id = this.createLiveRegion(type);
            region = this.liveRegions.get(id);
        }

        region.textContent = '';
        requestAnimationFrame(() => {
            region.textContent = message;
        });
    }

    removeLiveRegion(id) {
        const region = this.liveRegions.get(id);
        if (region) {
            region.remove();
            this.liveRegions.delete(id);
        }
    }

    /* ======================================================
       ARIA HELPERS
    ====================================================== */

    static setAriaLabel(element, label) {
        element?.setAttribute('aria-label', label);
    }

    static setAriaDescribedBy(element, id) {
        element?.setAttribute('aria-describedby', id);
    }

    static setAriaHidden(element, hidden) {
        element?.setAttribute('aria-hidden', String(hidden));
    }

    static setAriaExpanded(element, expanded) {
        element?.setAttribute('aria-expanded', String(expanded));
    }

    static setAriaControls(element, id) {
        element?.setAttribute('aria-controls', id);
    }

    /* ======================================================
       ACCESSIBLE LIST (Arrow Navigation)
    ====================================================== */

    makeAccessibleList(container) {
        if (!container) return;

        const items = Array.from(container.children);
        if (!items.length) return;

        let index = 0;

        container.setAttribute('role', 'listbox');

        items.forEach((item, i) => {
            item.setAttribute('role', 'option');
            item.setAttribute('tabindex', i === 0 ? '0' : '-1');
        });

        const setFocus = (i) => {
            items[index].setAttribute('tabindex', '-1');
            index = i;
            items[index].setAttribute('tabindex', '0');
            items[index].focus();
        };

        container.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setFocus((index + 1) % items.length);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setFocus((index - 1 + items.length) % items.length);
                    break;
                case 'Home':
                    e.preventDefault();
                    setFocus(0);
                    break;
                case 'End':
                    e.preventDefault();
                    setFocus(items.length - 1);
                    break;
            }
        });
    }

    /* ======================================================
       USER PREFERENCES
    ====================================================== */

    static prefersReducedMotion() {
        return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    }

    static prefersDarkMode() {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    }

    /* ======================================================
       SKIP LINK
    ====================================================== */

    addSkipLink(text = 'Skip to main content', target = 'main') {
        const link = document.createElement('a');
        link.href = `#${target}`;
        link.textContent = text;

        link.style.cssText = `
            position:absolute;
            top:-40px;
            left:0;
            background:#000;
            color:#fff;
            padding:8px 12px;
            z-index:10000;
            transition:top .2s;
        `;

        link.addEventListener('focus', () => link.style.top = '0');
        link.addEventListener('blur', () => link.style.top = '-40px');

        document.body.prepend(link);
        return link;
    }

    /* ======================================================
       CLEANUP
    ====================================================== */

    cleanup() {
        this.liveRegions.forEach(region => region.remove());
        this.liveRegions.clear();

        this.focusTraps.forEach(trap => {
            trap.container.removeEventListener('keydown', trap.handleKeydown);
        });

        this.focusTraps.clear();
        this.previousFocus.clear();
    }

    /* ======================================================
       PRIVATE
    ====================================================== */

    #generateId() {
        return `acc_${crypto.randomUUID?.() || Date.now()}`;
    }
}
