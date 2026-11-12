import React from 'react';
import Snowfall from './snowfall';

function ModeToggle({ mode, onChange }) {
  if (!onChange) return null;
  const btn = (m, label) => (
    <button
      type="button"
      onClick={() => onChange(m)}
      aria-pressed={mode === m}
      className={`nb-btn ${mode === m ? 'nb-btn-accent' : ''}`}
    >
      {label}
    </button>
  );
  return (
    <div className="mb-5 flex items-center gap-2">
      {btn('shared', 'Shared AI')}
      {btn('own', 'My keys')}
    </div>
  );
}

function Landing({ spaces, loaded, onOpen, mode, onModeChange }) {
  return (
    <div className="relative flex-1 overflow-hidden">
      <Snowfall />
      <div className="relative z-10 h-full overflow-y-auto p-5 md:p-10">
        <ModeToggle mode={mode} onChange={onModeChange} />
        {loaded && spaces.length === 0 ? (
          <p className="nb-label max-w-sm">No spaces yet. Open the menu and tap + to create your first one.</p>
        ) : (
          <>
            <h1 className="nb-label mb-6">Your spaces</h1>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
              {spaces.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => onOpen(s.id)}
                  style={{ '--i': i }}
                  className="nb-card nb-slide text-left p-5"
                >
                  <div className="text-lg font-bold">{s.name}</div>
                  <div className="mt-2 text-sm text-muted line-clamp-2">
                    {s.instructions || 'No instructions'}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Landing;