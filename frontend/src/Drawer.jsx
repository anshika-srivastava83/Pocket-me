import React from 'react';

function Drawer({ open, onClose, spaces, activeSpaceId, onSelect, onNew, onLogout }) {
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

        <div className="nb-drawer-foot">
          <button onClick={onLogout} className="nb-btn w-full">
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}

export default Drawer;