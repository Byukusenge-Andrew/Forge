export function Rulers() {
    return (
        <>
            <div className="global-ruler ruler-horizontal">
                {Array.from({ length: 40 }).map((_, i) => (
                    <div key={`h-${i}`} className="ruler-tick" style={{ left: `${i * 100}px` }}>
                        {i > 0 && <span>{i * 100}</span>}
                    </div>
                ))}
            </div>
            <div className="global-ruler ruler-vertical">
                {Array.from({ length: 30 }).map((_, i) => (
                    <div key={`v-${i}`} className="ruler-tick-v" style={{ top: `${i * 100}px` }}>
                        {i > 0 && <span>{i * 100}</span>}
                    </div>
                ))}
            </div>
        </>
    );
}
