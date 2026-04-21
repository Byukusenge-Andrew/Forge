/**
 * @file adblocker.ts
 * Curated list of common ad/tracker domains and cosmetic selectors
 * specifically targeted at pop-ups and overlays.
 */

export const AD_DOMAINS = [
    'doubleclick.net',
    'googlesyndication.com',
    'google-analytics.com',
    'adnxs.com',
    'quantserve.com',
    'scorecardresearch.com',
    'exponential.com',
    'advertising.com',
    'amazon-adsystem.com',
    'adbrn.com',
    'adform.net',
    'adroll.com',
    'adsrvr.org',
    'adtech.de',
    'adtheta.com',
    'taboola.com',
    'outbrain.com',
    'mgid.com',
    'revcontent.com',
    'popads.net',
    'popcash.net',
    'yandex.ru',
    'openx.net',
    'pubmatic.com',
    'rubiconproject.com',
    'yieldmo.com',
    'moatads.com',
    'lijit.com',
    'bidswitch.net',
    'casalemedia.com',
    'criteo.com',
    'indexww.com',
    'smartadserver.com',
    'sovrn.com',
    'teads.tv',
    'triplelift.com',
    'adnxs.com',
];

export const COSMETIC_SELECTORS = [
    '.ad-container',
    '.ad-wrapper',
    '.ads-by-google',
    '#ad-banner',
    '[id*="google_ads"]',
    '[class*="ad-box"]',
    '.popup-overlay',
    '.floating-ad',
    '.floating-widget',
    '[class*="floating-pop"]',
    '[id*="floating-pop"]',
    'iframe[src*="ads"]',
    'iframe[id*="google_ads"]',
    '.sidebar-ad',
    '.bottom-ad',
    '.top-ad',
    '[class*="sponsored-box"]',
    '.sponsored-content',
    '.native-ad',
    '[class*="latina-ka"]',
    '[class*="memecoin-monster"]',
    '.ad-zilla-alert',
    '.novel-bin-ad',
    '[class*="popup"]',
    '[id*="popup"]',
    '[class*="overlay"]',
    '[class*="widget"]',
    '.floating-container',
    '.modal-ad',
];

/**
 * Checks if a URL matches any known ad/tracker domain.
 */
export function isAdRequest(url: string): boolean {
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return AD_DOMAINS.some(domain => hostname.includes(domain));
    } catch {
        return false;
    }
}

/**
 * Generates the CSS string to hide ad-related elements.
 */
export function getCosmeticCSS(): string {
    return `${COSMETIC_SELECTORS.join(', ')} { display: none !important; visibility: hidden !important; pointer-events: none !important; opacity: 0 !important; }`;
}
