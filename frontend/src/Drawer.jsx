import React from 'react';

function Drawer({ open, onClose, spaces, activeSpaceId, onSelect, onNew, onLogout, onSettings }) {
  return (
    <>
      <div onClick={onClose} aria-hidden="true" className={`nb-scrim ${open ? 'nb-scrim-open' : ''}`} />
      <aside className={`nb-drawer ${open ? 'nb-drawer-open' : ''}`} aria-label="Spaces" inert={!open}>
        <div className="nb-drawer-head">
          <span className="nb-label">Spaces</span>
          <button onClick={onNew} className="nb-btn nb-plus" aria-label="Add a new space">
            +
          </button>
        </div>

        <nav className="nb-drawer-nav">
          {spaces.map((s) => (
            <button
              key={s.id}
              className="nb-row"
              aria-current={s.id === activeSpaceId ? 'page' : undefined}
              onClick={() => onSelect(s.id)}
            >
              {s.name}
            </button>
          ))}
          {spaces.length === 0 && <p className="nb-label px-2">No spaces yet. Tap + to add one.</p>}
        </nav>

        <div className="flex items-center gap-2 p-3 border-t-2 border-ink">
          <button type="button" onClick={onLogout} className="nb-btn flex-1">
            Log out
          </button>
          <button type="button" onClick={onSettings} className="nb-ghost" aria-label="Settings" title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Drawer;