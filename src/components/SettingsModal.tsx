/**
 * @file SettingsModal.tsx
 * @description A modal dialog where the user enters and saves their Gemini API key.
 * The key is persisted via Electron IPC (settings:save) and hot-reloaded into the sidecar.
 */

import { useState } from 'react';
import { useSettings } from '../hooks/useSettings';

interface SettingsModalProps {
    onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
    const { settings, saveSettings, isLoading } = useSettings();
    const [keyInput, setKeyInput] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [saved, setSaved] = useState(false);

    // Pre-fill with masked placeholder once loaded
    const placeholder = isLoading
        ? 'Loading…'
        : settings.geminiApiKey
            ? '••••••••••••••••' + settings.geminiApiKey.slice(-4)
            : 'AIza…';

    const handleSave = async () => {
        if (!keyInput.trim()) return;
        await saveSettings({ geminiApiKey: keyInput.trim() });
        setKeyInput('');
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <span>⚙️ Settings</span>
                    <button className="icon-btn xs-btn" onClick={onClose}>✕</button>
                </div>

                <div className="modal-body">
                    <section className="settings-section">
                        <h3 className="settings-heading">Gemini API Key</h3>
                        <p className="settings-desc">
                            Your key is stored locally on your machine and never shared.
                            Get one at{' '}
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                                aistudio.google.com
                            </a>.
                        </p>

                        <div className="api-key-row">
                            <input
                                type={showKey ? 'text' : 'password'}
                                className="address-input api-key-input"
                                placeholder={placeholder}
                                value={keyInput}
                                onChange={e => setKeyInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSave()}
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <button
                                className="icon-btn xs-btn"
                                onClick={() => setShowKey(v => !v)}
                                title={showKey ? 'Hide key' : 'Show key'}
                            >
                                {showKey ? '🙈' : '👁️'}
                            </button>
                        </div>

                        {saved && <p className="settings-success">✓ API key saved and applied to sidecar.</p>}

                        <div className="settings-actions">
                            <button className="primary-btn" onClick={handleSave} disabled={!keyInput.trim()}>
                                Save Key
                            </button>
                            {settings.geminiApiKey && (
                                <button
                                    className="danger-btn"
                                    onClick={() => { saveSettings({ geminiApiKey: '' }); setKeyInput(''); }}
                                >
                                    Clear Key
                                </button>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
