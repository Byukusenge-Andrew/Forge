/**
 * @file useTabs.ts
 * @description Custom React hook that owns all browser tab state.
 * Provides a clean API for creating, closing, switching, and updating tabs.
 *
 * Usage:
 * ```tsx
 * const { tabs, activeTab, openTab, closeTab, updateTab, setActiveTabId } = useTabs();
 * ```
 */

import { useState } from 'react';
import { createTab, type Tab } from '../lib/tabTypes';

const HOME_URL = 'http://localhost:5173/landing.html';

/** Creates the initial home tab with a stable ID. Called once via lazy useState. */
function makeInitialTab(): Tab {
    return createTab(HOME_URL, 'Home');
}

/**
 * Manages the full lifecycle of browser tabs.
 *
 * @returns tabs          - The ordered array of all open tabs.
 * @returns activeTab     - The currently visible Tab object.
 * @returns activeTabId   - The ID of the active tab (string).
 * @returns setActiveTabId - Directly set which tab is active (used when clicking a tab).
 * @returns openTab       - Open a new tab and switch to it. Optionally pass a URL.
 * @returns closeTab      - Close a tab by ID. Always keeps at least one tab open.
 * @returns updateTab     - Patch any field on a tab (e.g., update title after navigation).
 */
export function useTabs() {
    const [tabs, setTabs] = useState<Tab[]>(() => [makeInitialTab()]);
    const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '');

    const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

    /** Opens a new tab at the given URL (defaults to home) and switches focus to it. */
    const openTab = (url = HOME_URL) => {
        const tab = createTab(url);
        setTabs(prev => [...prev, tab]);
        setActiveTabId(tab.id);
    };

    /**
     * Closes the tab with the given ID.
     * If closing the last tab, a fresh home tab is created automatically.
     * If closing the currently active tab, focus shifts to the last remaining tab.
     */
    const closeTab = (id: string) => {
        setTabs(prev => {
            const remaining = prev.filter(t => t.id !== id);
            if (remaining.length === 0) {
                const fresh = makeInitialTab();
                setActiveTabId(fresh.id);
                return [fresh];
            }
            if (id === activeTabId) {
                setActiveTabId(remaining[remaining.length - 1].id);
            }
            return remaining;
        });
    };

    /**
     * Partially updates a tab's fields without replacing the whole object.
     * Commonly used to update the title after a navigation completes.
     *
     * @param id    - ID of the tab to update.
     * @param patch - Partial Tab object with only the fields to change.
     */
    const updateTab = (id: string, patch: Partial<Tab>) => {
        setTabs(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));
    };

    return { tabs, activeTab, activeTabId, setActiveTabId, openTab, closeTab, updateTab };
}
