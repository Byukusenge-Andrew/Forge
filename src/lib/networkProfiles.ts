/**
 * @file networkProfiles.ts
 * @description Defines the set of network throttle profiles selectable from the Toolbar.
 * Each profile maps to a Chrome DevTools Protocol `Network.emulateNetworkConditions` call
 * executed in the Electron main process via IPC.
 *
 * To add a new profile, append an entry to `NETWORK_PROFILES` — it will appear in the
 * `NetworkThrottleMenu` dropdown automatically.
 */

/**
 * A network condition preset used to emulate real-world connection speeds.
 * Values are passed directly to the CDP `Network.emulateNetworkConditions` command.
 */
export interface NetworkProfile {
    /** Display name shown in the throttle dropdown. */
    label: string;
    /**
     * Maximum download speed in bytes per second.
     * Use `-1` for unlimited (no throttle applied).
     */
    downloadThroughput: number;
    /**
     * Maximum upload speed in bytes per second.
     * Use `-1` for unlimited.
     */
    uploadThroughput: number;
    /**
     * Minimum round-trip latency in milliseconds.
     * Adds artificial delay to every network round-trip.
     */
    latency: number;
    /**
     * If `true`, all network requests are blocked, simulating a completely offline device.
     * When `true`, throughput values are ignored.
     */
    offline: boolean;
}

/** All available throttle profiles, ordered from fastest to slowest. */
export const NETWORK_PROFILES: NetworkProfile[] = [
    { label: 'No Throttle', downloadThroughput: -1, uploadThroughput: -1, latency: 0, offline: false },
    { label: 'Fast 4G', downloadThroughput: 4_000_000, uploadThroughput: 3_000_000, latency: 20, offline: false },
    { label: 'Slow 4G', downloadThroughput: 1_500_000, uploadThroughput: 750_000, latency: 80, offline: false },
    { label: 'Fast 3G', downloadThroughput: 750_000, uploadThroughput: 250_000, latency: 150, offline: false },
    { label: 'Slow 3G', downloadThroughput: 250_000, uploadThroughput: 50_000, latency: 400, offline: false },
    { label: 'Offline', downloadThroughput: 0, uploadThroughput: 0, latency: 0, offline: true },
];

/** The default profile applied on startup (no throttling). */
export const DEFAULT_PROFILE = NETWORK_PROFILES[0];
