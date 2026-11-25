// ==UserScript==
// @name         ADO dark theme: restore highlight and font colors
// @namespace    https://github.com/latenightsurfer/ado-dark-theme-highlights
// @version      2.0.0
// @description  Azure DevOps dark theme overrides inline highlight (background) and font colors in rich text (comments, descriptions). This script re-applies them and keeps the text readable.
// @homepageURL  https://github.com/latenightsurfer/ado-dark-theme-highlights
// @supportURL   https://github.com/latenightsurfer/ado-dark-theme-highlights/issues
// @updateURL    https://raw.githubusercontent.com/latenightsurfer/ado-dark-theme-highlights/main/ado-dark-theme-highlights.user.js
// @downloadURL  https://raw.githubusercontent.com/latenightsurfer/ado-dark-theme-highlights/main/ado-dark-theme-highlights.user.js
// @match        https://dev.azure.com/*
// @match        https://*.visualstudio.com/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// Installation (Firefox, Chrome or Edge):
//   1. Install the browser extension "Tampermonkey" (addons.mozilla.org / Chrome Web Store).
//   2. Open the @downloadURL above in the browser; Tampermonkey shows its install page.
//      Click "Install".
//   3. Reload the Azure DevOps page. Highlights in comments and descriptions now show
//      in the dark theme (system or dark theme setting in Azure DevOps).
// Tampermonkey checks the @updateURL regularly and installs new versions by itself.
//
// Domains: out of the box the script only runs on Azure DevOps Services
// (dev.azure.com, *.visualstudio.com). For Azure DevOps Server (on-premises) you MUST
// add your server's address, otherwise the script does nothing there. Add one entry per
// address you use (also the http variant if your server is reachable that way). Add it in
// Tampermonkey instead of editing the script, so it survives updates:
//   Tampermonkey dashboard -> this script -> tab "Settings" -> "Includes/Excludes"
//   -> "User matches" -> "Add..." -> e.g. https://devops.example.com/*
// Domains can't be set in the configuration: Tampermonkey decides from the header where
// the script runs, before any script code is executed.
//
// Check: in the browser console (F12) run
//   document.querySelectorAll('[data-ado-color-fix="fixed"]').length
// A number greater than 0 means the script corrected colors on the page.
//
// Configuration: don't edit the script, automatic updates would overwrite it. Set your
// values in the script's Tampermonkey storage instead; they survive updates:
//   1. Tampermonkey dashboard -> tab "Settings" -> "Config mode": "Advanced".
//   2. Open this script -> tab "Storage". After the first run it contains "config": {}.
//   3. Add only the options you want to change and save, e.g.
//        { "config": { "highlightMode": "dimmed", "originalColorUnderline": false } }
//   4. Reload the Azure DevOps page.
// The script only changes colors the dark theme has overridden; the light theme stays as is.
// Options (defaults in the CONFIG block of the code):
//   highlightMode          How highlights are shown. Highlight colors work as categories
//                          (e.g. question / answer / action), so every mode keeps them apart:
//                            'tinted'   dark tint with the same hue for any color (default)
//                            'dimmed'   author's color blended into the dark background
//                            'original' exactly the color the author picked (bright)
//   tintLightness          'tinted': brightness of the tint, 0..1 (default 0.3)
//   tintSaturation         'tinted': maximum color strength of the tint, 0..1 (default 0.6)
//   dimStrength            'dimmed': share of the original color kept, 0..1 (default 0.55)
//   originalColorUnderline Underline in the author's original color under a tinted or
//                          dimmed highlight; true = on (default), false = off
//   highlightMap           Fixed replacement per color, wins over highlightMode,
//                          e.g. "highlightMap": { "#80ffff": "#1f5f6b" }
//   textOnLightHighlight   Text color on light highlights (default black)
//   textOnDarkHighlight    Text color on dark highlights (default white)
//   tooDarkFontColor       Font colors too dark for the dark background:
//                            'lighten' keep the hue and lighten it (default)
//                            'theme'   use the theme's normal text color
//   minTextContrast        Minimum contrast for font colors, 3 (default) or 4.5 (stricter)
//   debug                  true = log every corrected element to the console (F12)
// Hovering a highlight shows the author's original color as a tooltip.

(function () {
    'use strict';

    // ===== Default configuration ==============================================
    // Don't change values here (updates overwrite them); override them in the
    // Tampermonkey storage key "config", see the header. All colors accept any CSS
    // color ('#80ff80', 'lime', 'rgb(...)').
    const CONFIG = {
        // How to show a highlight the author set. Authors use colors as categories
        // (e.g. cyan = question, green = answer, orange = action), so every mode keeps
        // different colors distinguishable and works for any color, not only known ones.
        //   'tinted'   - same hue, recalculated as a dark tint with uniform brightness (default)
        //   'dimmed'   - the author's color blended into the dark page background
        //   'original' - exactly the color the author picked (bright on dark background)
        highlightMode: 'tinted',

        // 'tinted' mode: lightness and maximum saturation of the tint (0..1).
        tintLightness: 0.3,
        tintSaturation: 0.6,

        // 'dimmed' mode: share of the original color kept (0..1, 1 = original).
        dimStrength: 0.55,

        // 'tinted'/'dimmed' mode: underline in the author's original color, so the
        // exact color stays recognizable. false = no underline.
        originalColorUnderline: true,

        // Fixed replacements per highlight color; they win over highlightMode.
        // Key = color the author picked, value = color to show. Example:
        //   '#80ffff': '#1f5f6b',   // cyan   -> dark teal
        //   '#80ff80': '#2e6b2e',   // green  -> dark green
        highlightMap: {
        },

        // Text color on a highlight; chosen automatically by the highlight's brightness.
        textOnLightHighlight: '#000000',
        textOnDarkHighlight: '#ffffff',

        // Font colors the author set that are too dark for the dark background:
        //   'theme'   - fall back to the theme's normal text color
        //   'lighten' - keep the hue, lighten it until it is readable
        tooDarkFontColor: 'lighten',

        // Minimum WCAG contrast ratio for font colors (3 = large text, 4.5 = normal text).
        minTextContrast: 3,

        // Log every fixed element to the browser console (F12).
        debug: false,
    };
    // ==========================================================================

    // User overrides from the Tampermonkey storage; survive script updates.
    const overrides = GM_getValue('config', null);
    if (overrides && typeof overrides === 'object') {
        Object.assign(CONFIG, overrides);
    } else {
        GM_setValue('config', {}); // makes the key visible in the "Storage" tab
    }

    const DEBUG = CONFIG.debug;

    const MARKER = 'data-ado-color-fix';
    const CANDIDATE_SELECTOR = '[style*="background"], [style*="color"], font[color]';

    const rgbCache = new Map();
    let probe = null;

    /** Normalizes any CSS color (hex, name, rgb) to [r, g, b, a] via the browser itself. */
    function toRgba(color) {
        if (!color) return null;
        if (rgbCache.has(color)) return rgbCache.get(color);
        if (!probe) {
            probe = document.createElement('span');
            probe.style.display = 'none';
            document.documentElement.appendChild(probe);
        }
        probe.style.color = '';
        probe.style.color = color;
        const parsed = probe.style.color
            ? parseRgb(getComputedStyle(probe).color)
            : null;
        rgbCache.set(color, parsed);
        return parsed;
    }

    function parseRgb(value) {
        const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)/.exec(value || '');
        if (!m) return null;
        let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
        return [Number(m[1]), Number(m[2]), Number(m[3]), a];
    }

    function sameColor(a, b) {
        return !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) < 1);
    }

    function luminance([r, g, b]) {
        const c = [r, g, b].map((v) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    }

    function contrast(a, b) {
        const la = luminance(a);
        const lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    /** First non-transparent computed background of the element or its ancestors. */
    function effectiveBackground(el) {
        for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
            const bg = parseRgb(getComputedStyle(node).backgroundColor);
            if (bg && bg[3] > 0.5) return bg;
        }
        return [255, 255, 255, 1];
    }

    function toCss([r, g, b]) {
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    /** Blends color a into b; share = part of a that is kept (0..1). */
    function mix(a, b, share) {
        return [0, 1, 2].map((i) => a[i] * share + b[i] * (1 - share)).concat(1);
    }

    let highlightMap = null;

    /** CONFIG.highlightMap normalized to [[fromRgba, toCss], ...]; built lazily (needs the DOM). */
    function normalizedHighlightMap() {
        if (!highlightMap) {
            highlightMap = Object.entries(CONFIG.highlightMap)
                .map(([from, to]) => [toRgba(from), toRgba(to)])
                .filter(([from, to]) => from && to)
                .map(([from, to]) => [from, toCss(to)]);
        }
        return highlightMap;
    }

    function rgbToHsl([r, g, b]) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        if (max === min) return [0, 0, l];
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        return [h / 6, s, l];
    }

    function hslToRgb([h, s, l]) {
        if (s === 0) return [l * 255, l * 255, l * 255, 1];
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const channel = (t) => {
            t = (t + 1) % 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255, 1];
    }

    /** The highlight color to show for the author's color, according to CONFIG. */
    function highlightToShow(inlineBg, el) {
        const mapped = normalizedHighlightMap().find(([from]) => sameColor(from, inlineBg));
        if (mapped) return mapped[1];
        if (CONFIG.highlightMode === 'tinted') {
            const [h, s] = rgbToHsl(inlineBg);
            return toCss(hslToRgb([h, Math.min(s, CONFIG.tintSaturation), CONFIG.tintLightness]));
        }
        if (CONFIG.highlightMode === 'dimmed') {
            const pageBg = effectiveBackground(el.parentElement);
            return toCss(mix(inlineBg, pageBg, CONFIG.dimStrength));
        }
        return el.style.backgroundColor;
    }

    /** Font color to show, or null to keep the theme's text color. */
    function fontColorToShow(color, background) {
        if (contrast(color, background) >= CONFIG.minTextContrast) return toCss(color);
        if (CONFIG.tooDarkFontColor !== 'lighten') return null;
        // Black/grey carries no meaning worth keeping: use the theme's text color instead of grey.
        if (Math.max(...color.slice(0, 3)) - Math.min(...color.slice(0, 3)) < 24) return null;
        const towards = luminance(background) < 0.5 ? [255, 255, 255] : [0, 0, 0];
        for (let share = 0.9; share > 0; share -= 0.1) {
            const candidate = mix(color, towards, share);
            if (contrast(candidate, background) >= CONFIG.minTextContrast) return toCss(candidate);
        }
        return null;
    }

    function fixElement(el) {
        if (el.hasAttribute(MARKER)) return;
        let fixed = false;

        // 1. Highlight (background color)
        const inlineBg = toRgba(el.style.backgroundColor);
        if (inlineBg && inlineBg[3] > 0) {
            let shownBg = inlineBg;
            const computedBg = parseRgb(getComputedStyle(el).backgroundColor);
            if (!sameColor(inlineBg, computedBg)) {
                const shown = highlightToShow(inlineBg, el);
                el.style.setProperty('background-color', shown, 'important');
                if (CONFIG.originalColorUnderline && !sameColor(toRgba(shown), inlineBg)) {
                    el.style.setProperty('box-shadow', `inset 0 -2px 0 ${toCss(inlineBg)}`, 'important');
                }
                el.title = el.title || `Highlight: ${toCss(inlineBg)}`;
                shownBg = toRgba(shown) || inlineBg;
                fixed = true;
            }
            // Keep text readable on the highlight (light theme text on light highlight is unreadable).
            const textColor = parseRgb(getComputedStyle(el).color);
            if (textColor && contrast(textColor, shownBg) < 4.5) {
                const readable = luminance(shownBg) > 0.18
                    ? CONFIG.textOnLightHighlight
                    : CONFIG.textOnDarkHighlight;
                el.style.setProperty('color', readable, 'important');
                fixed = true;
            }
        }

        // 2. Font color (inline style or legacy <font color>)
        const specifiedColor = el.style.color || (el.tagName === 'FONT' ? el.getAttribute('color') : '');
        const inlineColor = toRgba(specifiedColor);
        if (inlineColor && !el.style.getPropertyPriority('color')) {
            const computedColor = parseRgb(getComputedStyle(el).color);
            if (!sameColor(inlineColor, computedColor)) {
                const css = fontColorToShow(inlineColor, effectiveBackground(el));
                if (css) {
                    el.style.setProperty('color', css, 'important');
                    fixed = true;
                }
            }
        }

        el.setAttribute(MARKER, fixed ? 'fixed' : 'ok');
        if (fixed && DEBUG) console.debug('[ado-color-fix]', el);
    }

    function scan(root) {
        if (!root || root.nodeType !== 1) return;
        if (root.matches(CANDIDATE_SELECTOR)) fixElement(root);
        root.querySelectorAll(CANDIDATE_SELECTOR).forEach(fixElement);
    }

    // ADO is a single-page app: comments load and re-render lazily, so watch for new nodes.
    // Only childList is observed; our own style changes therefore never retrigger the observer.
    let pending = new Set();
    let scheduled = false;
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) m.addedNodes.forEach((n) => n.nodeType === 1 && pending.add(n));
        if (!scheduled && pending.size) {
            scheduled = true;
            requestAnimationFrame(() => {
                const batch = pending;
                pending = new Set();
                scheduled = false;
                batch.forEach((n) => n.isConnected && scan(n));
            });
        }
    });

    scan(document.body);
    observer.observe(document.body, { childList: true, subtree: true });

    // Theme switch (dark/light) changes computed colors: re-check everything.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        document.querySelectorAll(`[${MARKER}="ok"]`).forEach((el) => el.removeAttribute(MARKER));
        scan(document.body);
    });
})();
