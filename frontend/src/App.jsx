import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
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

  // Chats state: the chat list for the open space, and which chat is open
  const [chatList, setChatList] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null); // null means a new, unsaved chat
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);

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
          if (list.length > 0) setSelectedModel((current) => current || list[0].id);
        }
      })
      .catch(() => {});

    fetch('/api/spaces', { headers })
      .then((res) => res.json())
      .then((list) => {
        if (Array.isArray(list)) {
          setSpaces(list);
          if (list.length > 0) setActiveSpaceId((current) => current || list[0].id);
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

  const startNewChat = () => {
    setActiveChatId(null);
    setMessages([]);
  };

  const createSpace = async (e) => {
    e.preventDefault();
    setFormError('');

    const res = await fetch('/api/spaces', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: newName, instructions: newInstructions })
    });
    const data = await res.json();

    if (!res.ok) {
      setFormError(data.error || 'Could not create the space.');
      return;
    }
    setSpaces((prev) => [...prev, data]);
    setActiveSpaceId(data.id);
    setNewName('');
    setNewInstructions('');
    setShowForm(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeSpaceId || loading) return;

    const userMessage = input;
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

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      <header className="p-4 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center gap-3">
        <span className="font-bold text-lg">Pocket Me</span>

        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={autoFallback}
            onChange={(e) => setAutoFallback(e.target.checked)}
          />
          Auto fallback
        </label>

        <button
          onClick={() => supabase.auth.signOut()}
          className="ml-auto text-sm text-slate-400 hover:text-slate-200"
        >
          Log out
        </button>
      </header>

      {/* Space tabs. They scroll sideways on a phone. */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700 overflow-x-auto">
        {spaces.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSpaceId(s.id)}
            className={`whitespace-nowrap px-3 py-1 rounded-lg text-sm transition ${
              s.id === activeSpaceId ? 'bg-blue-600 text-white' : 'bg-slate-900 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {s.name}
          </button>
        ))}
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1 rounded-lg text-sm bg-slate-900 text-slate-300 hover:bg-slate-700"
          aria-label="Add a new space"
        >
          +
        </button>
      </div>

      {showForm && (
        <form onSubmit={createSpace} className="p-4 bg-slate-800 border-b border-slate-700 space-y-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Space name"
            maxLength={40}
            required
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <textarea
            value={newInstructions}
            onChange={(e) => setNewInstructions(e.target.value)}
            placeholder="Instructions for the AI in this space (optional)"
            rows={3}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          {formError && <p className="text-sm text-amber-300">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="bg-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-500 transition">
              Create space
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Chat bar: pick an earlier chat in this space, or start a new one */}
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
      </div>

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
              {msg.text}
              {msg.provider && <div className="mt-2 text-xs text-slate-400">via {msg.provider}</div>}
            </div>
          </div>
        ))}
        {loading && <div className="text-slate-400 text-sm">AI is thinking...</div>}
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={activeSpace ? `Message in ${activeSpace.name}...` : 'Type a message...'}
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
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
    </div>
  );
}

export default App;