/**
 * @file devicePresets.ts
 * @description Defines the list of mobile and tablet device viewport dimensions used by the
 * mobile WebviewPane. Adding a new device here automatically makes it appear in the dropdown.
 */

/** A named viewport size representing a real device. */
export interface DevicePreset {
    /** Display name shown in the device selector dropdown. */
    label: string;
    /** Viewport width in CSS pixels. */
    width: number;
    /** Viewport height in CSS pixels. */
    height: number;
}

/**
 * All available device presets.
 * Source: official device specifications (logical CSS pixels, not physical pixels).
 */
export const DEVICE_PRESETS: DevicePreset[] = [
    { label: 'iPhone SE', width: 375, height: 667 },
    { label: 'iPhone 14 Pro', width: 393, height: 852 },
    { label: 'iPhone 14 Pro Max', width: 430, height: 932 },
    { label: 'Pixel 7', width: 412, height: 915 },
    { label: 'Galaxy S23', width: 360, height: 780 },
    { label: 'iPad Mini', width: 768, height: 1024 },
    { label: 'iPad Air', width: 820, height: 1180 },
    { label: 'iPad Pro 12.9"', width: 1024, height: 1366 },
];

/** The default device shown when the mobile pane first opens. */
export const DEFAULT_PRESET = DEVICE_PRESETS[0]; // iPhone SE
