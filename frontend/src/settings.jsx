import React, { useState, useEffect } from 'react';

function Step({ n, done, title, children }) {
  return (
    <div className="space-y-2">
      <p className="nb-label">
        Step {n}{done ? ' (done)' : ''}: {title}
      </p>
      {children}
    </div>
  );
}

function Row({ label, r }) {
  const text = r.ok === null ? 'Not set' : r.ok ? 'OK' : 'Failed';
  return (
    <p className="text-sm">
      <b>{label}:</b> {text}. {r.ok === null ? '' : r.message}
    </p>
  );
}

function Settings({ token, email, onClose }) {
  const [tab, setTab] = useState('');
  const [status, setStatus] = useState(null);
  const [geminiKey, setGeminiKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [calendarId, setCalendarId] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const link = 'underline';

  useEffect(() => {
    fetch('/api/settings', { headers })
      .then((r) => r.json())
      .then((s) => {
        setStatus(s);
        setCalendarId(s.calendarId || '');
        setTab((t) => t || (s.mode === 'own' && !s.hasGemini && !s.hasGroq ? 'guide' : 'mine'));
      })
      .catch(() => setMessage('Could not load settings.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (body, okMessage) => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch('/api/settings', { method: 'PUT', headers, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error || 'Could not save.');
        return false;
      }
      setStatus(data);
      setCalendarId(data.calendarId || '');
      setGeminiKey('');
      setGroqKey('');
      setTestResult(null);
      setMessage(okMessage);
      return true;
    } catch {
      setMessage('Could not reach the server.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const chooseMode = async (m) => {
    if (status?.mode === m) return;
    const ok = await send({ mode: m }, m === 'shared' ? 'Now using the shared AI.' : 'Now using your own keys.');
    if (ok) setTab(m === 'own' && !(status?.hasGemini || status?.hasGroq) ? 'guide' : 'mine');
  };

  const save = (e) => {
    e.preventDefault();
    send({ geminiKey, groqKey, calendarId }, 'Saved. Press Test setup to check it.');
  };

  const removeKey = (which) => {
    if (!window.confirm('Remove this key?')) return;
    send(which === 'gemini' ? { clearGemini: true } : { clearGroq: true }, 'Key removed.');
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test', { method: 'POST', headers });
      const data = await res.json().catch(() => null);
      setTestResult(res.ok && data ? data : { error: 'The test could not run.' });
    } catch {
      setTestResult({ error: 'Could not reach the server.' });
    } finally {
      setTesting(false);
    }
  };

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(status.serviceEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const activeTab = tab || 'mine';
  const needsChoice = status && !status.mode;
  const q = status?.quota;

  const header = (
    <div className="flex items-center justify-between">
      <h2 className="font-mono font-bold uppercase tracking-wider">Settings</h2>
      <button type="button" onClick={onClose} className="nb-btn">Close</button>
    </div>
  );

  if (needsChoice) {
    return (
      <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
        <div className="nb-panel w-full max-w-md space-y-4 bg-surface p-5 fade-in">
          {header}
          <p className="text-sm">How should Pocket Me use AI for you? You can switch any time in Settings.</p>

          <button
            type="button"
            onClick={() => chooseMode('shared')}
            disabled={saving || !status.sharedAvailable}
            className="nb-card w-full space-y-1 p-4 text-left"
          >
            <div className="font-bold">Share the common AI</div>
            <div className="text-sm">
              No setup, start right away. A daily allowance is split between everyone who shares, so your share gets smaller as more people join.
            </div>
          </button>

          <button
            type="button"
            onClick={() => chooseMode('own')}
            disabled={saving}
            className="nb-card w-full space-y-1 p-4 text-left"
          >
            <div className="font-bold">Use my own keys</div>
            <div className="text-sm">
              One-time setup of about 5 minutes with your own free Gemini and Groq accounts. No shared limit.
            </div>
          </button>

          {message && <p className="text-sm font-bold text-accent">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="nb-panel w-full max-w-md space-y-5 bg-surface p-5 fade-in">
        {header}

        <div className="space-y-2">
          <p className="nb-label">AI source</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => chooseMode('shared')}
              disabled={saving || !status?.sharedAvailable}
              className={`nb-btn flex-1 ${status?.mode === 'shared' ? 'nb-btn-accent' : ''}`}
            >
              Shared AI
            </button>
            <button
              type="button"
              onClick={() => chooseMode('own')}
              disabled={saving}
              className={`nb-btn flex-1 ${status?.mode === 'own' ? 'nb-btn-accent' : ''}`}
            >
              My own keys
            </button>
          </div>
          {status?.mode === 'shared' && q && (
            <p className="text-sm">
              Shared AI: about {q.used} of {q.budget} tokens used in the last 24 hours. {q.sharers} {q.sharers === 1 ? 'person shares' : 'people share'} the daily pool, so more people means smaller shares. These are estimates. Switch to your own keys for no limit.
            </p>
          )}
          {status?.mode === 'own' && !status.hasGemini && !status.hasGroq && (
            <p className="text-sm font-bold text-accent">Add at least one key to start chatting. See the Setup guide.</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab('guide')}
            className={`nb-btn ${activeTab === 'guide' ? 'nb-btn-accent' : ''}`}
          >
            Setup guide
          </button>
          <button
            type="button"
            onClick={() => setTab('mine')}
            className={`nb-btn ${activeTab === 'mine' ? 'nb-btn-accent' : ''}`}
          >
            My keys
          </button>
        </div>

        {message && <p className="text-sm font-bold text-accent">{message}</p>}

        {activeTab === 'guide' && (
          <div className="space-y-6">
            <p className="text-sm">
              Steps 1 and 2 are only needed for your own keys. Step 3 (your calendar) is needed by everyone, because calendars are never shared. It is a one-time setup of about 5 minutes.
            </p>

            <Step n={1} done={!!status?.hasGemini} title="Get a free Gemini key">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>
                  Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className={link}>aistudio.google.com/apikey</a> and sign in with Google.
                </li>
                <li>Click Create API key. If it asks for a project, create a new one.</li>
                <li>Copy the key. It starts with AQ. or AIza.</li>
                <li>Open the My keys tab and paste it under Gemini key.</li>
              </ol>
            </Step>

            <Step n={2} done={!!status?.hasGroq} title="Get a free Groq key (backup)">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>
                  Open <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className={link}>console.groq.com/keys</a> and sign up.
                </li>
                <li>Click Create API Key, name it Pocket Me, and copy it right away. It is shown only once and starts with gsk_.</li>
                <li>Paste it under Groq key in the My keys tab.</li>
              </ol>
              <p className="text-sm">One key is enough to start. Having both lets the app switch when one is busy.</p>
            </Step>

            <Step n={3} done={!!status?.calendarId} title="Connect your Google Calendar for reminders">
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                <li>On a computer, open <a href="https://calendar.google.com" target="_blank" rel="noreferrer" className={link}>calendar.google.com</a>.</li>
                <li>In the left list, hover over your calendar, click the three dots, then Settings and sharing.</li>
                <li>
                  Under Share with specific people or groups, click Add people and groups. Paste this email, set the permission to Make changes to events, and click Send:
                  <div className="mt-1 flex items-center gap-2">
                    <code className="break-all text-xs">{status?.serviceEmail || '...'}</code>
                    {status?.serviceEmail && (
                      <button type="button" onClick={copyEmail} className="nb-btn">{copied ? 'Copied' : 'Copy'}</button>
                    )}
                  </div>
                </li>
                <li>On the same page, scroll to Integrate calendar and copy the Calendar ID. For your main calendar it is your Gmail address.</li>
                <li>Paste it under Calendar ID in the My keys tab.</li>
                <li>For phone alerts, install the Google Calendar app and sign in with the same account. On the same settings page, add an event notification so reminders ring.</li>
              </ol>
            </Step>

            <Step n={4} done={false} title="Check that it works">
              <p className="text-sm">Open the My keys tab, press Save, then Test setup. Each line should say OK.</p>
            </Step>

            <button type="button" onClick={() => setTab('mine')} className="nb-btn nb-btn-accent w-full">
              Go to My keys
            </button>
          </div>
        )}

        {activeTab === 'mine' && (
          <form onSubmit={save} className="space-y-5">
            {email && <p className="text-sm">Signed in as <b>{email}</b></p>}

            <div className="space-y-2">
              <p className="nb-label">Your Gemini key</p>
              {status?.hasGemini && (
                <div className="flex items-center gap-2 text-sm">
                  <span>Saved: <code>{status.geminiHint}</code></span>
                  <button type="button" onClick={() => removeKey('gemini')} className="nb-link">Remove</button>
                </div>
              )}
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={status?.hasGemini ? 'Paste a new key to replace it' : 'AIza...'}
                className="nb-input"
              />
            </div>

            <div className="space-y-2">
              <p className="nb-label">Your Groq key</p>
              {status?.hasGroq && (
                <div className="flex items-center gap-2 text-sm">
                  <span>Saved: <code>{status.groqHint}</code></span>
                  <button type="button" onClick={() => removeKey('groq')} className="nb-link">Remove</button>
                </div>
              )}
              <input
                type="password"
                value={groqKey}
                onChange={(e) => setGroqKey(e.target.value)}
                placeholder={status?.hasGroq ? 'Paste a new key to replace it' : 'gsk_...'}
                className="nb-input"
              />
            </div>

            <div className="space-y-2">
              <p className="nb-label">Your Calendar ID</p>
              <input
                type="text"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
                placeholder="you@gmail.com"
                className="nb-input"
              />
              <p className="text-xs">Share your calendar with this email (Make changes to events):</p>
              <div className="flex items-center gap-2">
                <code className="break-all text-xs">{status?.serviceEmail || '...'}</code>
                {status?.serviceEmail && (
                  <button type="button" onClick={copyEmail} className="nb-btn">{copied ? 'Copied' : 'Copy'}</button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="nb-btn nb-btn-accent flex-1">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={runTest} disabled={testing} className="nb-btn flex-1">
                {testing ? 'Testing...' : 'Test setup'}
              </button>
            </div>

            {testResult && (
              <div className="space-y-1">
                {testResult.error ? (
                  <p className="text-sm font-bold text-accent">{testResult.error}</p>
                ) : (
                  <>
                    <Row label="Gemini" r={testResult.gemini} />
                    <Row label="Groq" r={testResult.groq} />
                    <Row label="Calendar" r={testResult.calendar} />
                  </>
                )}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

export default Settings;