import React, { useState } from 'react';
import { authApi } from '../services/api';

interface Props {
  onLogin: () => void;
}

const AuthPage: React.FC<Props> = ({ onLogin }) => {
  const [mode,     setMode]     = useState<'login' | 'register'>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      if (mode === 'register') {
        await authApi.register(email, password);
        setMode('login');
        setError(null);
        return;
      }
      const res = await authApi.login(email, password);
      localStorage.setItem('token', res.access_token);
      onLogin();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .auth-wrap  { min-height:100vh; display:flex; align-items:center; justify-content:center;
                      background:#080a0f; font-family:'Space Grotesk',sans-serif; }
        .auth-card  { background:#111318; border:1px solid rgba(255,255,255,0.07);
                      border-radius:16px; padding:40px; width:100%; max-width:380px; }
        .auth-logo  { font-family:'Playfair Display',serif; font-size:1.6rem;
                      color:#e8c97a; text-align:center; margin-bottom:6px; }
        .auth-logo em { font-style:italic; color:#f5dfa0; }
        .auth-sub   { text-align:center; font-size:.75rem; color:#5a6070;
                      letter-spacing:.08em; text-transform:uppercase; margin-bottom:28px; }
        .auth-tabs  { display:flex; gap:6px; margin-bottom:24px; }
        .auth-tab   { flex:1; padding:8px; border:1px solid rgba(255,255,255,0.07);
                      border-radius:8px; background:transparent; color:#9aa0b0;
                      font-size:.82rem; cursor:pointer; font-family:'Space Grotesk',sans-serif;
                      transition:.15s; }
        .auth-tab.active { background:#e8c97a; border-color:#e8c97a;
                           color:#080a0f; font-weight:700; }
        .auth-label { font-size:.75rem; color:#9aa0b0; margin-bottom:6px; display:block; }
        .auth-input { width:100%; background:#161a22; border:1px solid rgba(255,255,255,0.07);
                      border-radius:8px; padding:11px 14px; font-size:.85rem; color:#e8eaf0;
                      outline:none; font-family:'Space Grotesk',sans-serif;
                      margin-bottom:14px; transition:.15s; }
        .auth-input:focus { border-color:#e8c97a; }
        .auth-btn   { width:100%; background:#e8c97a; color:#080a0f; border:none;
                      border-radius:8px; padding:12px; font-size:.88rem; font-weight:700;
                      cursor:pointer; font-family:'Space Grotesk',sans-serif;
                      margin-top:4px; transition:.15s; letter-spacing:.03em; }
        .auth-btn:hover    { background:#f5dfa0; }
        .auth-btn:disabled { opacity:.4; cursor:not-allowed; }
        .auth-err   { background:rgba(232,122,140,.1); border:1px solid rgba(232,122,140,.25);
                      border-radius:8px; padding:10px 14px; font-size:.8rem;
                      color:#e87a8c; margin-bottom:14px; }
        .auth-ok    { background:rgba(94,207,177,.1); border:1px solid rgba(94,207,177,.25);
                      border-radius:8px; padding:10px 14px; font-size:.8rem;
                      color:#5ecfb1; margin-bottom:14px; }
      `}</style>
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo">Docu<em>Query</em></div>
          <div className="auth-sub">PDF · Audio · Video</div>

          <div className="auth-tabs">
            <button className={`auth-tab ${mode === 'login'    ? 'active' : ''}`} onClick={() => { setMode('login');    setError(null); }}>Sign in</button>
            <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(null); }}>Register</button>
          </div>

          {error && <div className="auth-err">{error}</div>}

          <form onSubmit={handle}>
            <label className="auth-label">Email</label>
            <input className="auth-input" type="email"    value={email}    onChange={e => setEmail(e.target.value)}    placeholder="you@example.com" required />
            <label className="auth-label">Password</label>
            <input className="auth-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"        required />
            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};

export default AuthPage;