/**
 * @file distanceScanner.ts
 * JavaScript snippet injected into a webview to show pixel distances
 * between the hovered element and its neighbours on hover.
 * Exported as a string for use with webContents.executeJavaScript().
 */

export const DISTANCE_SCANNER_INJECT = `(function() {
    if (window.__devBrowserDistanceScanner) return 'already active';
    window.__devBrowserDistanceScanner = true;

    const overlay = document.createElement('div');
    overlay.id = '__dev_distance_overlay';
    Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 999999,
    });
    document.body.appendChild(overlay);

    function clearOverlay() { overlay.innerHTML = ''; }

    function drawLine(x1, y1, x2, y2, label) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        Object.assign(svg.style, { position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' });
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', '#f0a'); line.setAttribute('stroke-width', '1');
        line.setAttribute('stroke-dasharray', '4,2');
        svg.appendChild(line);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.textContent = label;
        text.setAttribute('x', (x1 + x2) / 2);
        text.setAttribute('y', (y1 + y2) / 2 - 3);
        text.setAttribute('fill', '#f0a');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-family', 'monospace');
        text.setAttribute('text-anchor', 'middle');
        svg.appendChild(text);
        overlay.appendChild(svg);
    }

    function highlight(el) {
        const r = el.getBoundingClientRect();
        const box = document.createElement('div');
        Object.assign(box.style, {
            position: 'fixed',
            top: r.top + 'px', left: r.left + 'px',
            width: r.width + 'px', height: r.height + 'px',
            outline: '2px solid #f0a',
            background: 'rgba(255,0,170,0.05)',
            pointerEvents: 'none',
            zIndex: 999998,
            boxSizing: 'border-box',
        });
        overlay.appendChild(box);
    }

    document.addEventListener('mousemove', function handler(e) {
        if (!window.__devBrowserDistanceScanner) {
            document.removeEventListener('mousemove', handler);
            overlay.remove();
            return;
        }
        clearOverlay();
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el === overlay) return;

        const r = el.getBoundingClientRect();
        highlight(el);

        // Distance to viewport edges
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Left
        drawLine(0, r.top + r.height/2, r.left, r.top + r.height/2, Math.round(r.left) + 'px');
        // Right
        drawLine(r.right, r.top + r.height/2, vw, r.top + r.height/2, Math.round(vw - r.right) + 'px');
        // Top
        drawLine(r.left + r.width/2, 0, r.left + r.width/2, r.top, Math.round(r.top) + 'px');
        // Bottom
        drawLine(r.left + r.width/2, r.bottom, r.left + r.width/2, vh, Math.round(vh - r.bottom) + 'px');
    });

    return 'distance scanner active';
})()`;

export const DISTANCE_SCANNER_REMOVE = `(function() {
    window.__devBrowserDistanceScanner = false;
    const el = document.getElementById('__dev_distance_overlay');
    if (el) el.remove();
    return 'distance scanner removed';
})()`;
