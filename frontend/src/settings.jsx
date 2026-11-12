import React, { useState, useEffect } from 'react';

function Row({ label, r }) {
  const text = r.ok === null ? 'Not set' : r.ok ? 'OK' : 'Failed';
  return (
    <p className="text-sm">
      <b>{label}:</b> {text}. {r.ok === null ? '' : r.message}
    </p>
  );
}

function Settings({ token, email, onClose }) {
  const [view, setView] = useState(null); // null = decide automatically, 'choose' or 'mode'
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
      })
      .catch(() => setMessage('Could not load settings.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = status?.mode;
  const currentView = view || (mode ? 'mode' : 'choose');
  const q = status?.quota;

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
    if (mode === m) {
      setMessage('');
      setView('mode');
      return;
    }
    const ok = await send({ mode: m }, m === 'shared' ? 'Now using the shared AI.' : 'Now using your own keys.');
    if (ok) setView('mode');
  };

  const goBack = () => {
    setMessage('');
    setTestResult(null);
    setView('choose');
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

  const header = (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {currentView === 'mode' && (
          <button type="button" onClick={goBack} className="nb-ghost" aria-label="Back to options" title="Back">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        )}
        <h2 className="font-mono font-bold uppercase tracking-wider">Settings</h2>
      </div>
      <button type="button" onClick={onClose} className="nb-btn">Close</button>
    </div>
  );

  const calendarSection = (
    <div className="space-y-2">
      <p className="nb-label">Your Calendar ID (for reminders)</p>
      <input
        type="text"
        value={calendarId}
        onChange={(e) => setCalendarId(e.target.value)}
        placeholder="your Gmail address"
        className="nb-input"
      />
      <details className="text-sm">
        <summary className="nb-link cursor-pointer">How to connect your Google Calendar</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
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
          <li>On the same page, scroll to Integrate calendar and copy the Calendar ID. For a main calendar it is the Gmail address of the account that owns it. Paste it above.</li>
          <li>For phone alerts, install the Google Calendar app and sign in with the same account. Add an event notification in the same settings so reminders ring.</li>
        </ol>
      </details>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="nb-panel w-full max-w-md space-y-5 bg-surface p-5 fade-in">
        {header}

        {email && <p className="text-sm">Signed in as <b>{email}</b></p>}

        {!status && !message && <p className="text-sm">Loading...</p>}

        {status && currentView === 'choose' && (
          <div className="space-y-4">
            <p className="text-sm">
              {mode
                ? 'Choose how Pocket Me uses AI for you. You can switch any time and nothing is deleted.'
                : 'Choose how Pocket Me should use AI for you. You can switch any time.'}
            </p>

            <button
              type="button"
              onClick={() => chooseMode('shared')}
              disabled={saving || !status.sharedAvailable}
              className="nb-card w-full space-y-1 p-4 text-left"
            >
              <div className="font-bold">Shared AI {mode === 'shared' && '(current)'}</div>
              <div className="text-sm">
                No setup. A daily allowance is split between everyone who shares, so your share gets smaller as more people join.
              </div>
            </button>

            <button
              type="button"
              onClick={() => chooseMode('own')}
              disabled={saving}
              className="nb-card w-full space-y-1 p-4 text-left"
            >
              <div className="font-bold">My own keys {mode === 'own' && '(current)'}</div>
              <div className="text-sm">
                One-time setup with your own free Gemini and Groq accounts. No shared limit.
              </div>
            </button>

            {message && <p className="text-sm font-bold text-accent">{message}</p>}
          </div>
        )}

        {status && currentView === 'mode' && (
          <form onSubmit={save} className="space-y-5">
            <p className="nb-label">{mode === 'shared' ? 'Shared AI' : 'My own keys'}</p>

            {mode === 'shared' && q && (
              <p className="text-sm">
                About {q.used} of {q.budget} tokens used in the last 24 hours. {q.sharers} {q.sharers === 1 ? 'person shares' : 'people share'} the daily pool, so your share shrinks as more people join. These are estimates. Use the arrow to switch to your own keys for no limit.
              </p>
            )}

            {mode === 'own' && (
              <>
                {!status.hasGemini && !status.hasGroq && (
                  <p className="text-sm font-bold text-accent">Add at least one key to start chatting.</p>
                )}

                <div className="space-y-2">
                  <p className="nb-label">Your Gemini key</p>
                  {status.hasGemini && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>Saved: <code>{status.geminiHint}</code></span>
                      <button type="button" onClick={() => removeKey('gemini')} className="nb-link">Remove</button>
                    </div>
                  )}
                  <input
                    type="password"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder={status.hasGemini ? 'Paste a new key to replace it' : 'AQ... or AIza...'}
                    className="nb-input"
                  />
                  <details className="text-sm">
                    <summary className="nb-link cursor-pointer">How to get a free Gemini key</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      <li>
                        Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className={link}>aistudio.google.com/apikey</a> and sign in with Google.
                      </li>
                      <li>Click Create API key. If it asks for a project, create a new one.</li>
                      <li>Copy the whole key and paste it above.</li>
                    </ol>
                  </details>
                </div>

                <div className="space-y-2">
                  <p className="nb-label">Your Groq key</p>
                  {status.hasGroq && (
                    <div className="flex items-center gap-2 text-sm">
                      <span>Saved: <code>{status.groqHint}</code></span>
                      <button type="button" onClick={() => removeKey('groq')} className="nb-link">Remove</button>
                    </div>
                  )}
                  <input
                    type="password"
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder={status.hasGroq ? 'Paste a new key to replace it' : 'gsk_...'}
                    className="nb-input"
                  />
                  <details className="text-sm">
                    <summary className="nb-link cursor-pointer">How to get a free Groq key</summary>
                    <ol className="mt-2 list-decimal space-y-1 pl-5">
                      <li>
                        Open <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className={link}>console.groq.com/keys</a> and sign up.
                      </li>
                      <li>Click Create API Key, name it Pocket Me, and copy it right away. It is shown only once.</li>
                      <li>Paste it above. One key is enough to start. Having both lets the app switch when one is busy.</li>
                    </ol>
                  </details>
                </div>
              </>
            )}

            {calendarSection}

            {message && <p className="text-sm font-bold text-accent">{message}</p>}

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