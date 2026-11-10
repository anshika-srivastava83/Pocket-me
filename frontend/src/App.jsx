import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Reminders from './reminders';
import Landing from './landing';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const markdownComponents = {
  p: ({ children }) => <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>,
  h1: ({ children }) => <h3 className="font-bold text-lg mb-2">{children}</h3>,
  h2: ({ children }) => <h3 className="font-bold text-lg mb-2">{children}</h3>,
  h3: ({ children }) => <h3 className="font-bold mb-2">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2">{children}</ol>,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 underline">{children}</a>
  ),
  pre: ({ children }) => (
    <pre className="bg-slate-950 rounded-lg p-3 mb-2 overflow-x-auto text-sm [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  code: ({ children, className }) => (
    <code className={`${className || ''} bg-slate-950 rounded px-1 text-sm`}>{children}</code>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-2">
      <table className="text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border border-slate-600 px-2 py-1 text-left">{children}</th>,
  td: ({ children }) => <td className="border border-slate-600 px-2 py-1">{children}</td>
};

function App() {
  // Login state
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Spaces state
  const [spaces, setSpaces] = useState([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [formError, setFormError] = useState('');
  const [editingSpaceId, setEditingSpaceId] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [chatError, setChatError] = useState('');

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
  const [autoFallback, setAutoFallback] = useState(false);

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
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

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
    try {
      const res = await fetch(`/api/chats/${chatId}/messages`, { headers: { Authorization: `Bearer ${token}` } });
      const list = await res.json();
      if (Array.isArray(list)) {
        setMessages(list.map((m) => ({ sender: m.sender, text: m.content, provider: m.provider })));
      }
    } catch (err) {
      setMessages([{ sender: 'ai', text: 'Could not load this chat.' }]);
    }
  };

  const startRename = () => {
    const current = chatList.find((c) => c.id === activeChatId);
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

  const deleteChat = async () => {
    if (!activeChatId) return;
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;

    const res = await fetch(`/api/chats/${activeChatId}`, { method: 'DELETE', headers: authHeaders });
    if (res.ok) {
      setChatList((prev) => prev.filter((c) => c.id !== activeChatId));
      startNewChat();
    }
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
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
    setFormError('');

        const res = await fetch(editingSpaceId ? `/api/spaces/${editingSpaceId}` : '/api/spaces', {
      method: editingSpaceId ? 'PATCH' : 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: newName, instructions: newInstructions })
    });
    const data = await res.json();

    if (!res.ok) {
      setFormError(data.error || 'Could not save the space.');
      return;
    }
    if (editingSpaceId) {
      setSpaces((prev) => prev.map((s) => (s.id === data.id ? data : s)));
    } else {
      setSpaces((prev) => [...prev, data]);
      setActiveSpaceId(data.id);
    }
    closeSpaceForm();
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

  // These checks come after all the hooks above, which React requires.
  if (authLoading) {
    return <div className="h-screen bg-slate-900 text-slate-400 p-4">Loading...</div>;
  }
  if (!session) {
    return <Login />;
  }

  const remindersSpace = spaces.find((s) => s.name === 'Reminders');
  return (
    <div className={`flex flex-col h-screen ${activeSpaceId ? 'bg-slate-900 text-slate-100' : 'bg-surface text-ink'}`}>
            <header className="relative z-10 px-4 py-3 bg-surface text-ink border-b-2 border-ink flex flex-wrap items-center gap-3">
        <button
          onClick={() => setActiveSpaceId('')}
          className="bg-transparent border-0 p-0"
        >
          <span className="pm-title">Pocket Me</span>
        </button>

        {activeSpaceId && (
          <>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="nb-input nb-input-sm"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 nb-label">
              <input
                type="checkbox"
                checked={autoFallback}
                onChange={(e) => setAutoFallback(e.target.checked)}
              />
              Auto fallback
            </label>
          </>
        )}

        <div className="ml-auto flex items-center gap-3">
          {!activeSpaceId && remindersSpace && (
            <div className="relative">
              <img
                src="/pikachu.png"
                alt=""
                className="absolute -top-7 -left-6 h-12 w-12 object-contain pointer-events-none z-20 -rotate-12"
              />
              <button onClick={() => setActiveSpaceId(remindersSpace.id)} className="nb-tab">
                Reminders
              </button>
            </div>
          )}
          {activeSpaceId && (
            <button onClick={() => setActiveSpaceId('')} className="nb-tab" aria-selected="false">
              All spaces
            </button>
          )}
          {activeSpace && (
            <button onClick={openEditSpace} className="nb-tab" aria-selected="false">
              Edit space
            </button>
          )}
          <button onClick={() => supabase.auth.signOut()} className="nb-link">
            Log out
          </button>
        </div>
      </header>

      {showForm && (
        <form onSubmit={createSpace} className="relative z-10 p-4 bg-surface text-ink border-b-2 border-ink space-y-3">
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
            <button type="submit" className="nb-btn nb-btn-accent">
              {editingSpaceId ? 'Save space' : 'Create space'}
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

      {/* Chat bar: only inside a space, never on the home page */}
      {activeSpaceId && (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 border-b border-slate-700">
          <select
            value={activeChatId || ''}
            onChange={(e) => (e.target.value ? openChat(e.target.value) : startNewChat())}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="">New chat</option>
            {chatList.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button
            onClick={startNewChat}
            className="whitespace-nowrap px-3 py-1 rounded-lg text-sm bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            New chat
          </button>
          {activeChatId && (
            <>
              <button
                onClick={startRename}
                className="whitespace-nowrap px-3 py-1 rounded-lg text-sm bg-slate-800 text-slate-300 hover:bg-slate-700"
              >
                Rename
              </button>
              <button
                onClick={deleteChat}
                className="whitespace-nowrap px-3 py-1 rounded-lg text-sm bg-slate-800 text-red-400 hover:bg-slate-700"
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}

      {!activeSpaceId ? (
        <Landing spaces={spaces} onOpen={setActiveSpaceId} onNew={() => setShowForm(true)} />
      ) : (
        <>
      {renamingId && renamingId === activeChatId && (
        <div className="px-4 py-2 bg-slate-900 border-b border-slate-700">
          <form onSubmit={saveRename} className="flex items-center gap-2">
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={100}
              autoFocus
              className="flex-1 min-w-0 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-blue-500"
            />
            <button type="submit" className="px-3 py-1 rounded-lg text-sm bg-blue-600 hover:bg-blue-500">
              Save
            </button>
            <button
              type="button"
              onClick={() => setRenamingId(null)}
              className="px-3 py-1 rounded-lg text-sm text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </form>
          {chatError && <p className="mt-1 text-sm text-amber-300">{chatError}</p>}
        </div>
      )}
      

      {activeSpace?.name === 'Reminders' && <Reminders token={token} />}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && activeSpace && (
          <div className="text-slate-400 text-sm">Start a conversation in {activeSpace.name}.</div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] md:max-w-2xl p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white whitespace-pre-wrap' : 'bg-slate-800 border border-slate-700'}`}>
              {msg.sender === 'user' ? (
                msg.text
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {msg.text}
                </ReactMarkdown>
              )}
              {msg.provider && <div className="mt-2 text-xs text-slate-400">via {msg.provider}</div>}
              <div className="mt-2 flex gap-3 text-xs opacity-70">
                <button type="button" onClick={() => copyText(msg.text)} className="hover:underline">
                  Copy
                </button>
                {msg.sender === 'user' && (
                  <>
                    <button type="button" onClick={() => editMessage(msg.text)} className="hover:underline">
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => sendText(msg.text)}
                      disabled={loading}
                      className="hover:underline disabled:opacity-40"
                    >
                      Resend
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        {loading && <div className="text-slate-400 text-sm">AI is thinking...</div>}
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
        <textarea
          ref={inputRef}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // On desktop, Enter sends and Shift+Enter adds a new line. On a phone, Enter adds a new line.
            if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(min-width: 768px)').matches) {
              e.preventDefault();
              sendText(input);
            }
          }}
          placeholder={activeSpace ? `Message in ${activeSpace.name}...` : 'Type a message...'}
          className="flex-1 resize-none bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
        />
        {loading ? (
          <button
            type="button"
            onClick={() => abortRef.current?.abort()}
            className="bg-red-600 px-5 py-2 rounded-lg font-semibold hover:bg-red-500 transition"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="bg-blue-600 px-5 py-2 rounded-lg font-semibold hover:bg-blue-500 transition"
          >
            Send
          </button>
        )}
           </form>
        </>
      )}
    </div>
  );
}

export default App;