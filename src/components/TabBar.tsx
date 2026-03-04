import type { Tab } from '../lib/tabTypes';


interface TabBarProps {
    tabs: Tab[];
    activeTabId: string;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    onNew: () => void;
}

export function TabBar({ tabs, activeTabId, onSelect, onClose, onNew }: TabBarProps) {
    return (
        <div className="tab-bar">
            <div className="tab-list">
                {tabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`tab-item ${tab.id === activeTabId ? 'tab-active' : ''}`}
                        onClick={() => onSelect(tab.id)}
                        title={tab.url}
                    >
                        <span className="tab-title">{tab.title}</span>
                        <button
                            className="tab-close"
                            onClick={e => { e.stopPropagation(); onClose(tab.id); }}
                            title="Close tab"
                        >×</button>
                    </div>
                ))}
            </div>
            <button className="tab-new-btn" onClick={onNew} title="Open new tab">＋</button>
        </div>
    );
}
