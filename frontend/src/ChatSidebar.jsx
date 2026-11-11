import React, { useState } from 'react';

function ChatSidebar({
  open,
  chats,
  activeChatId,
  onSelect,
  onNew,
  onTogglePin,
  onStartRename,
  onDelete,
  renamingId,
  renameValue,
  setRenameValue,
  onSaveRename,
  onCancelRename,
  chatError,
}) {
  const [menuId, setMenuId] = useState(null);
  const pinned = chats.filter((c) => c.pinned);
  const recent = chats.filter((c) => !c.pinned);

  const row = (c) => (
    <li key={c.id} className="relative">
      {renamingId === c.id ? (
        <form onSubmit={onSaveRename} className="flex items-center gap-3 px-4 py-2">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={100}
            autoFocus
            className="nb-input nb-input-sm flex-1 min-w-0"
          />
          <button type="submit" className="nb-link">Save</button>
          <button type="button" onClick={onCancelRename} className="nb-link">Cancel</button>
        </form>
      ) : (
        <div className="flex items-center pr-2">
          <button
            className="nb-chatrow flex-1 min-w-0 truncate"
            aria-current={c.id === activeChatId ? 'page' : undefined}
            onClick={() => {
              setMenuId(null);
              onSelect(c.id);
            }}
          >
            {c.title}
          </button>
          <button
            className="nb-ghost"
            aria-label="Chat options"
            onClick={() => setMenuId(menuId === c.id ? null : c.id)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="3" y="10" width="4" height="4" />
              <rect x="10" y="10" width="4" height="4" />
              <rect x="17" y="10" width="4" height="4" />
            </svg>
          </button>
        </div>
      )}

      {menuId === c.id && (
        <div className="nb-menu nb-menu-down">
          <button className="nb-menu-item" onClick={() => { setMenuId(null); onTogglePin(c.id); }}>
            {c.pinned ? 'Unpin' : 'Pin'}
          </button>
          <button className="nb-menu-item" onClick={() => { setMenuId(null); onStartRename(c.id); }}>
            Rename
          </button>
          <button className="nb-menu-item" onClick={() => { setMenuId(null); onDelete(c.id); }}>
            Delete
          </button>
        </div>
      )}
    </li>
  );

  return (
    <aside className={`nb-chats ${open ? 'nb-chats-open' : ''}`} aria-label="Chats">
      <div className="nb-drawer-head">
        <span className="nb-label">Chats</span>
        <button onClick={onNew} className="nb-ghost" aria-label="New chat">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M12 4v16M4 12h16" />
          </svg>
        </button>
      </div>

      {menuId && <div className="fixed inset-0 z-20" onClick={() => setMenuId(null)} />}

      <div className="nb-chat-list">
        {chats.length === 0 && <p className="nb-label px-4 py-3">No chats yet</p>}
        {pinned.length > 0 && (
          <>
            <div className="nb-label px-4 pt-3 pb-1">Pinned</div>
            <ul>{pinned.map(row)}</ul>
          </>
        )}
        {recent.length > 0 && (
          <>
            <div className="nb-label px-4 pt-3 pb-1">{pinned.length > 0 ? 'Recent' : 'Chats'}</div>
            <ul>{recent.map(row)}</ul>
          </>
        )}
        {chatError && <p className="px-4 pt-2 text-sm font-bold text-accent">{chatError}</p>}
      </div>
    </aside>
  );
}

export default ChatSidebar;