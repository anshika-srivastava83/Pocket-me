import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    const { data, error } = isSignup
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
    } else if (isSignup && !data.session) {
      setMessage('Account created. Check your email to confirm it, then log in.');
    }
    setBusy(false);
  };

    return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <form onSubmit={handleSubmit} className="nb-panel w-full max-w-sm space-y-4 p-6">
        <h1 className="font-mono text-xl font-bold uppercase tracking-wider">Pocket Me</h1>
        <p className="nb-label">{isSignup ? 'Create your account' : 'Log in to continue'}</p>

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="nb-input"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
          minLength={isSignup ? 6 : undefined}
          className="nb-input"
        />

        {message && <p className="text-sm font-bold text-accent">{message}</p>}

        <button type="submit" disabled={busy} className="nb-btn nb-btn-accent w-full">
          {busy ? 'Please wait' : isSignup ? 'Sign up' : 'Log in'}
        </button>

        <button
          type="button"
          onClick={() => { setIsSignup(!isSignup); setMessage(''); }}
          className="nb-link w-full text-center"
        >
          {isSignup ? 'Already have an account? Log in' : 'New here? Sign up'}
        </button>
      </form>
    </div>
  );
}

export default Login;