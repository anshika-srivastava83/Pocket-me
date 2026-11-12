import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Reminders from './reminders';
import Landing from './landing';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Drawer from './Drawer';
import ChatSidebar from './ChatSidebar';
import Thinking from './thinking';
import Settings from './settings';
import { CardsSkeleton, ChatSkeleton, PageLoader } from './skeleton';

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
  h1: ({ children }) => <h3 className="font-bold text-lg mb-2">{children}</h3>,
  h2: ({ children }) => <h3 className="font-bold text-lg mb-2">{children}</h3>,
  h3: ({ children }) => <h3 className="font-bold mb-2">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">{children}</a>
  ),
  pre: ({ children }) => <pre className="mb-2 text-sm">{children}</pre>,
  code: ({ children, className }) => <code className={`${className || ''} text-sm`}>{children}</code>,
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-2 border-ink px-2 py-1 text-left">{children}</th>,
  td: ({ children }) => <td className="border-2 border-ink px-2 py-1">{children}</td>
};

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
};

const CopyIcon = () => (
  <svg {...iconProps}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </svg>
);
const CheckIcon = () => (
  <svg {...iconProps}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const EditIcon = () => (
  <svg {...iconProps}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const RetryIcon = () => (
  <svg {...iconProps}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

function App() {
  // Login state
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Spaces state
  const [spaces, setSpaces] = useState([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [spacesLoaded, setSpacesLoaded] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [formError, setFormError] = useState('');
  const [editingSpaceId, setEditingSpaceId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [chatError, setChatError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [savingSpace, setSavingSpace] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  // Chats state: the chat list for the open space, and which chat is open
  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null); // null means a new, unsaved chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const inputRef = useRef(null);

  // Model picker state
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [autoFallback, setAutoFallback] = useState(true);

  const token = session?.access_token;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  // Check for an existing login when the page opens, and listen for login or logout.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // Once logged in, load the model list and the spaces.
  useEffect(() => {
    if (!token) {
      setSpaces([]);
      setSpacesLoaded(false);
      setActiveSpaceId('');
      setActiveChatId(null);
      setChatList([]);
      setMessages([]);
      setDrawerOpen(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };

    fetch('/api/settings', { headers })
      .then((res) => res.json())
      .then((s) => {
        if (!s.mode) {
          window.history.pushState({ spaceId: '', settings: true }, '');
          setShowSettings(true);
        }
      })
      .catch(() => {});

    fetch('/api/models', { headers })
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list)) {
          setModels(list);
          //if (list.length > 0) setSelectedModel((current) => current || list[0].id);
        }
      })
      .catch(() => {});

    fetch('/api/spaces', { headers })
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list)) {
          setSpaces(list);
          setSpacesLoaded(true);
          //if (list.length > 0) setActiveSpaceId((current) => current || list[0].id);
        }
      })
      .catch(() => {});
  }, [token]);

  // When you open a different space, load its chats and show the newest one.
  useEffect(() => {
    if (!token || !activeSpaceId) return;
    let cancelled = false;

    setChatList([]);
    setMessages([]);
    setActiveChatId(null);

    fetch(`/api/spaces/${activeSpaceId}/chats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        setChatList(list);
        if (list.length > 0) openChat(list[0].id);
      })
      .catch(() => {});

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeSpaceId]);

  const openChat = async (chatId) => {
    setActiveChatId(chatId);
    setMessages([]);
    setChatLoading(true);
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const list = await res.json();
      if (Array.isArray(list)) {
        setMessages(list.map((m) => ({ sender: m.sender, text: m.content, provider: m.provider })));
      }
    } catch (err) {
      setMessages([{ sender: 'ai', text: 'Could not load this chat.' }]);
    } finally {
      setChatLoading(false);
    }
  };
  const startRename = (chatId) => {
    const current = chatList.find((c) => c.id === chatId);
    if (!current) return;
    setRenameValue(current.title);
    setChatError('');
    setRenamingId(current.id);
  };

  const saveRename = async (e) => {
    e.preventDefault();
    if (!renameValue.trim() || !renamingId) return;

    try {
      const res = await fetch(`/api/chats/${renamingId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ title: renameValue })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setChatError(data.error || `Rename failed (status ${res.status}).`);
        return;
      }
      setChatList((prev) => prev.map((c) => (c.id === data.id ? { ...c, title: data.title } : c)));
      setRenamingId(null);
    } catch {
      setChatError('Could not reach the server.');
    }
  };

  const togglePin = async (chatId) => {
    const current = chatList.find((c) => c.id === chatId);
    if (!current) return;
    const pinned = !current.pinned;
    setChatList((prev) => prev.map((c) => (c.id === chatId ? { ...c, pinned } : c)));
    try {
      const res = await fetch(`/api/chats/${chatId}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ pinned })
      });
      if (!res.ok) throw new Error('failed');
    } catch {
      setChatList((prev) => prev.map((c) => (c.id === chatId ? { ...c, pinned: !pinned } : c)));
    }
  };

  const deleteChat = async (chatId) => {
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;

    const res = await fetch(`/api/chats/${chatId}`, { method: 'DELETE', headers: authHeaders });
    if (res.ok) {
      setChatList((prev) => prev.filter((c) => c.id !== chatId));
      if (chatId === activeChatId) startNewChat();
    }
  };

  const copyText = async (text, index) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // Clipboard access can fail on non-secure pages. Nothing to do.
    }
  };

  const editMessage = (text) => {
    setInput(text);
    inputRef.current?.focus();
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
  };

  const createSpace = async (e) => {
    e.preventDefault();
    if (savingSpace) return;
    setFormError('');

    if (editingSpaceId) {
      const id = editingSpaceId;
      const previous = spaces;
      const name = newName.trim();
      const instructions = newInstructions.trim();
      setSpaces((prev) => prev.map((s) => (s.id === id ? { ...s, name, instructions } : s)));
      closeSpaceForm();
      fetch(`/api/spaces/${id}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ name, instructions })
      })
        .then((res) => {
          if (!res.ok) throw new Error('failed');
        })
        .catch(() => {
          setSpaces(previous);
          window.alert('Could not save the space. Your change was reverted.');
        });
      return;
    }

    setSavingSpace(true);
    try {
      const res = await fetch('/api/spaces', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ name: newName, instructions: newInstructions })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || `Could not save the space (status ${res.status}).`);
        return;
      }
      setSpaces((prev) => [...prev, data]);
      openSpace(data.id);
      closeSpaceForm();
    } catch {
      setFormError('Could not reach the server. Try again.');
    } finally {
      setSavingSpace(false);
    }
  };
const closeSpaceForm = () => {
    setEditingSpaceId(null);
    setNewName('');
    setNewInstructions('');
    setFormError('');
    setShowForm(false);
  };

  const openEditSpace = () => {
    if (!activeSpace) return;
    setEditingSpaceId(activeSpace.id);
    setNewName(activeSpace.name);
    setNewInstructions(activeSpace.instructions || '');
    setFormError('');
    setShowForm(true);
  };

  const deleteSpace = async () => {
    if (!editingSpaceId) return;
    if (!window.confirm('Delete this space and all its chats? This cannot be undone.')) return;

    const res = await fetch(`/api/spaces/${editingSpaceId}`, { method: 'DELETE', headers: authHeaders });
    if (!res.ok) {
      setFormError('Could not delete the space.');
      return;
    }
    const remaining = spaces.filter((s) => s.id !== editingSpaceId);
    setSpaces(remaining);
    window.history.replaceState({ spaceId: '' }, '');
    setActiveSpaceId('');
    closeSpaceForm();
  };

  const sendMessage = (e) => {
    e.preventDefault();
    sendText(input);
  };

  const sendText = async (text) => {
    if (!text.trim() || !activeSpaceId || loading) return;

    const userMessage = text;
    setMessages((prev) => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
        const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          prompt: userMessage,
          modelId: selectedModel,
          autoFallback: autoFallback,
          spaceId: activeSpaceId,
          chatId: activeChatId
        })
      });
      const data = await res.json();

      // A new chat was created on the server: remember it and add it to the list.
      if (data.chatId && !activeChatId) {
        setActiveChatId(data.chatId);
        setChatList((prev) => [{ id: data.chatId, title: userMessage.slice(0, 50) }, ...prev]);
      }

      if (data.success) {
        setMessages((prev) => [...prev, { sender: 'ai', text: data.response, provider: data.provider }]);
      } else {
        setMessages((prev) => [...prev, { sender: 'ai', text: `Error: ${data.error}` }]);
      }
      } catch (err) {
      if (err.name === 'AbortError') {
        setMessages((prev) => [...prev, { sender: 'ai', text: 'Stopped.' }]);
      } else {
        setMessages((prev) => [...prev, { sender: 'ai', text: 'Failed to connect to backend server.' }]);
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  };

    // Back button support: every screen change is a browser history entry.
  useEffect(() => {
    window.history.replaceState({ spaceId: '' }, '');
    const onPop = (e) => {
      const s = e.state || {};
      setActiveSpaceId(s.spaceId || '');
      setDrawerOpen(Boolean(s.drawer));
      setShowSettings(Boolean(s.settings));
      setChatsOpen(false);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openSpace = (id) => {
    if (id === activeSpaceId) {
      if (drawerOpen) window.history.back();
      return;
    }
    if (drawerOpen) window.history.replaceState({ spaceId: id }, '');
    else window.history.pushState({ spaceId: id }, '');
    setActiveSpaceId(id);
    setDrawerOpen(false);
  };

  const openDrawer = () => {
    window.history.pushState({ spaceId: activeSpaceId, drawer: true }, '');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (drawerOpen) window.history.back();
  };

  const openSettings = () => {
    if (drawerOpen) {
      window.history.replaceState({ spaceId: activeSpaceId, settings: true }, '');
      setDrawerOpen(false);
    } else {
      window.history.pushState({ spaceId: activeSpaceId, settings: true }, '');
    }
    setShowSettings(true);
  };

  const closeSettings = () => {
    if (showSettings) window.history.back();
  };

  // These checks come after all the hooks above, which React requires.
  if (authLoading) {
    return <PageLoader />;
  }
  if (!session) {
    return <Login />;
  }

    const inReminders = activeSpace?.name === 'Reminders';

  return (
    <div className="flex flex-col h-screen bg-surface text-ink">
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onSelect={openSpace}
        onNew={() => {
          openSpace('');
          setShowForm(true);
        }}
        onLogout={() => {
          setDrawerOpen(false);
          supabase.auth.signOut();
        }}
        onSettings={openSettings}
      />

      <header className="relative z-10 px-4 py-3 bg-surface border-b-2 border-ink flex items-center gap-3">
        <button onClick={openDrawer} className="nb-btn nb-icon-btn" aria-label="Open menu">
          <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
            <rect y="0" width="20" height="2" fill="currentColor" />
            <rect y="6" width="20" height="2" fill="currentColor" />
            <rect y="12" width="20" height="2" fill="currentColor" />
          </svg>
        </button>
        <button onClick={() => openSpace('')} className="font-mono font-bold uppercase tracking-wider whitespace-nowrap">
          Pocket Me
        </button>

        {activeSpace && (
          <div className="ml-auto flex items-center gap-2 min-w-0">
            {!inReminders && (
              <button
                onClick={() => setChatsOpen(true)}
                className="nb-ghost md:hidden"
                aria-label="Open chats"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="16" />
                  <path d="M9 4v16" />
                </svg>
              </button>
            )}
            {!inReminders && (
              <button onClick={openEditSpace} className="nb-ghost" aria-label="Edit space">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M4 20h4L19 9l-4-4L4 16v4z" />
                  <path d="M13.5 6.5l4 4" />
                </svg>
              </button>
            )}
            <span className="nb-label truncate max-w-[40vw]">{activeSpace.name}</span>
          </div>
        )}
        </header>

      {showSettings && <Settings token={token} email={session?.user?.email} onClose={closeSettings} />}
      {showForm && (
        <form onSubmit={createSpace} className="relative z-10 p-4 bg-surface border-b-2 border-ink space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Space name"
            maxLength={40}
            required
            className="nb-input"
          />
          <textarea
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
            placeholder="Instructions for the AI in this space (optional)"
            rows={3}
            className="nb-input"
          />
          {formError && <p className="text-sm font-bold text-accent">{formError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={savingSpace} className="nb-btn nb-btn-accent">
              {savingSpace ? 'Saving...' : editingSpaceId ? 'Save space' : 'Create space'}
            </button>
            <button type="button" onClick={closeSpaceForm} className="nb-btn">
              Cancel
            </button>
            {editingSpaceId && (
              <button type="button" onClick={deleteSpace} className="ml-auto nb-link">
                Delete space
              </button>
            )}
          </div>
        </form>
      )}

      {!activeSpaceId ? (
        spacesLoaded ? <Landing spaces={spaces} loaded={spacesLoaded} onOpen={openSpace} /> : <CardsSkeleton />
      ) : (
        <div className="flex flex-1 min-h-0">
          {!inReminders && (
            <>
              <div
                onClick={() => setChatsOpen(false)}
                aria-hidden="true"
                className={`nb-scrim md:hidden ${chatsOpen ? 'nb-scrim-open' : ''}`}
              />
              <ChatSidebar
                open={chatsOpen}
                chats={chatList}
                activeChatId={activeChatId}
                onSelect={(id) => {
                  openChat(id);
                  setChatsOpen(false);
                }}
                onNew={() => {
                  startNewChat();
                  setChatsOpen(false);
                }}
                onTogglePin={togglePin}
                onStartRename={startRename}
                onDelete={deleteChat}
                renamingId={renamingId}
                renameValue={renameValue}
                setRenameValue={setRenameValue}
                onSaveRename={saveRename}
                onCancelRename={() => setRenamingId(null)}
                chatError={chatError}
              />
            </>
          )}

          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            {inReminders && <Reminders token={token} />}

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {chatLoading && <ChatSkeleton />}
              {!chatLoading && messages.length === 0 && activeSpace && !inReminders && (
                <div className="nb-label">Start a conversation in {activeSpace.name}</div>
              )}
              {messages.map((msg, index) => (
                <div key={index} className={`fade-in flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] md:max-w-2xl ${
                      msg.sender === 'user' ? 'nb-msg-user whitespace-pre-wrap' : 'nb-msg-ai'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      msg.text
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {msg.text}
                      </ReactMarkdown>
                    )}
                    {msg.provider && <div className="mt-2 nb-label">via {msg.provider}</div>}
                    <div className="mt-2 flex gap-1 -ml-1">
                      <button type="button" onClick={() => copyText(msg.text, index)} className="nb-msg-action" aria-label="Copy" title="Copy">
                        {copiedIndex === index ? <CheckIcon /> : <CopyIcon />}
                      </button>
                      {msg.sender === 'user' && (
                        <>
                          <button type="button" onClick={() => editMessage(msg.text)} className="nb-msg-action" aria-label="Edit" title="Edit">
                            <EditIcon />
                          </button>
                          <button type="button" onClick={() => sendText(msg.text)} disabled={loading} className="nb-msg-action" aria-label="Resend" title="Resend">
                            <RetryIcon />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {loading && <Thinking />}
            </div>

            <form onSubmit={sendMessage} className="p-4 bg-surface border-t-2 border-ink flex gap-3 items-end">
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter sends. Shift+Enter adds a new line.
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      sendText(input);
                    }
                  }}
                  placeholder={activeSpace ? `Message in ${activeSpace.name}` : 'Type a message'}
                  className="nb-input resize-none pr-11"
                />

                <button
                  type="button"
                  onClick={() => setModelMenuOpen((o) => !o)}
                  className="nb-ghost absolute right-1.5 bottom-1.5"
                  aria-label="Choose model"
                  aria-expanded={modelMenuOpen}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {modelMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setModelMenuOpen(false)} />
                    <div className="nb-menu nb-menu-up" role="menu">
                      <div className="nb-label px-3 pt-2 pb-1">Model</div>
                      {models.map((m, i) => (
                        <button
                          key={m.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selectedModel === m.id || (!selectedModel && i === 0)}
                          className="nb-menu-item"
                          onClick={() => {
                            setSelectedModel(m.id);
                            setModelMenuOpen(false);
                          }}
                        >
                          {m.label}
                        </button>
                      ))}
                      <div className="flex items-center justify-between nb-label px-3 py-2 mt-1 border-t-2 border-ink">
                        <span>Auto fallback</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={autoFallback}
                          aria-label="Auto fallback"
                          onClick={() => setAutoFallback((v) => !v)}
                          className="nb-switch"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {loading ? (
                <button type="button" onClick={() => abortRef.current?.abort()} className="nb-btn">
                  Stop
                </button>
              ) : (
                <button type="submit" className="nb-btn nb-btn-accent">
                  Send
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;