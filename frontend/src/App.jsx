import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';

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

  // Chat state: messages are kept per space, keyed by the space id
  const [chats, setChats] = useState({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Model picker state
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [autoFallback, setAutoFallback] = useState(false);

  const token = session?.access_token;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);
  const messages = chats[activeSpaceId] || [];

  const addMessage = (spaceId, msg) =>
    setChats((prev) => ({ ...prev, [spaceId]: [...(prev[spaceId] || []), msg] }));

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
  // The dependency is the token string, so token refreshes do not reload everything.
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
    if (!input.trim() || !activeSpaceId) return;

    const userMessage = input;
    const spaceId = activeSpaceId; // remember which space this message belongs to
    addMessage(spaceId, { sender: 'user', text: userMessage });
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          prompt: userMessage,
          modelId: selectedModel,
          autoFallback: autoFallback,
          spaceId: spaceId
        })
      });
      const data = await res.json();

      if (data.success) {
        addMessage(spaceId, { sender: 'ai', text: `${data.response} (via ${data.provider})` });
      } else {
        addMessage(spaceId, { sender: 'ai', text: `Error: ${data.error}` });
      }
    } catch (err) {
      addMessage(spaceId, { sender: 'ai', text: 'Failed to connect to backend server.' });
    } finally {
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

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && activeSpace && (
          <div className="text-slate-400 text-sm">Start a conversation in {activeSpace.name}.</div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 border border-slate-700'}`}>
              {msg.text}
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
        <button type="submit" className="bg-blue-600 px-5 py-2 rounded-lg font-semibold hover:bg-blue-500 transition">
          Send
        </button>
      </form>
    </div>
  );
}

export default App;