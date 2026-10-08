import React, { useState } from 'react';

function App() {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hello Anshika! Pocket Me is ready.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input;
    setMessages(prev => [...prev, { sender: 'user', text: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage })
      });
      const data = await res.json();

      if (data.success) {
        setMessages(prev => [...prev, { sender: 'ai', text: `${data.response} (via ${data.provider})` }]);
      } else {
        setMessages(prev => [...prev, { sender: 'ai', text: `Error: ${data.error}` }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'ai', text: 'Failed to connect to backend server.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      <header className="p-4 bg-slate-800 border-b border-slate-700 font-bold text-lg">
        Pocket Me - AI Assistant
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 border border-slate-700'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && <div className="text-slate-400 text-sm italic">AI is thinking...</div>}
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-slate-800 border-t border-slate-700 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
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