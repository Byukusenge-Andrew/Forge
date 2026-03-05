/**
 * @file tabTypes.ts
 * @description Defines the Tab data structure and a factory function for creating new tabs.
 * This is the single source of truth for tab shape. Import this in useTabs.ts and TabBar.tsx.
 */

/** Represents a single browser tab. */
export interface Tab {
    /** Unique identifier generated via `crypto.randomUUID()`. Used as React list keys and for state lookups. */
    id: string;
    /** Human-readable label shown in the tab strip. Defaults to the site's hostname. */
    title: string;
    /** The full URL currently loaded in this tab. */
    url: string;
    /** Whether the mobile split-view is active for this specific tab. */
    splitView?: boolean;
    /** Optional favicon URL. Reserved for future use. */
    favicon?: string;
}

/**
 * Creates a new Tab object with a unique ID.
 * @param url  - The URL to load in the tab.
 * @param title - Optional override for the tab title. Defaults to the URL's hostname.
 * @returns    A new Tab object ready to be inserted into the tabs array.
 */
export function createTab(url: string, title?: string): Tab {
    let defaultTitle = 'New Tab';
    try {
        const parsed = new URL(url);
        defaultTitle = parsed.hostname || parsed.pathname || url;
    } catch {
        defaultTitle = url;
    }
    return {
        id: crypto.randomUUID(),
        title: title ?? defaultTitle,
        url,
    };
}
