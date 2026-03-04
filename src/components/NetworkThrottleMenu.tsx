import { NETWORK_PROFILES, type NetworkProfile } from '../lib/networkProfiles';

interface NetworkThrottleMenuProps {
    activeProfile: NetworkProfile;
    onChange: (profile: NetworkProfile) => void;
}

export function NetworkThrottleMenu({ activeProfile, onChange }: NetworkThrottleMenuProps) {
    const isThrottled = activeProfile.label !== 'No Throttle';

    return (
        <div className="throttle-wrapper" title="Network Throttle">
            <span className={`throttle-icon ${activeProfile.offline ? 'offline' : isThrottled ? 'throttled' : ''}`}>
                {activeProfile.offline ? '🚫' : isThrottled ? '🐢' : '⚡'}
            </span>
            <select
                className="device-select throttle-select"
                value={activeProfile.label}
                onChange={e => {
                    const p = NETWORK_PROFILES.find(p => p.label === e.target.value);
                    if (p) onChange(p);
                }}
            >
                {NETWORK_PROFILES.map(p => (
                    <option key={p.label} value={p.label}>{p.label}</option>
                ))}
            </select>
        </div>
    );
}
