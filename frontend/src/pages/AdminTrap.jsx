import { useState } from 'react';
import { api } from '../api.js';

const demoStats = [
  ['Registered users', '1,284'], ['Active sessions', '42'], ['Pending reviews', '07'], ['System uptime', '14d 06h'],
];

export default function AdminTrap() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setError(''); setResult(null);
    try { setResult(await api.adminDecoyLogin(username, password)); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); setPassword(''); }
  };

  if (result?.authenticated) return <main className="admin-shell">
    <header className="admin-topbar"><div><span className="admin-mark">T</span><strong>TRAPDOOR <small>ADMINISTRATION</small></strong></div><span className="admin-status"><i /> SYSTEM ONLINE</span></header>
    <section className="admin-content"><div className="admin-page-title"><div><p className="eyebrow">CONTROL PANEL / OVERVIEW</p><h1>Administration overview</h1><p>Good afternoon, {username}. Here is the current system summary.</p></div><button className="btn btn-light" onClick={() => { setResult(null); setUsername(''); }}>Sign out</button></div>
      <div className="admin-stats">{demoStats.map(([label, value]) => <article className="admin-stat" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
      <section className="admin-panel"><div className="admin-panel-head"><h2>Recent system activity</h2><span>LAST 24 HOURS</span></div><div className="admin-activity"><p><b>Access policy updated</b><span>Security policy revision completed · 10:42</span></p><p><b>Scheduled backup completed</b><span>Daily database snapshot · 02:00</span></p><p><b>New administrator session</b><span>Internal console · Yesterday, 16:18</span></p></div></section>
      <p className="admin-footnote">Administrative overview · Internal operations</p>
    </section>
  </main>;

  return <main className="admin-shell admin-login-shell">
    <header className="admin-topbar"><div><span className="admin-mark">T</span><strong>TRAPDOOR <small>ADMINISTRATION</small></strong></div><span className="admin-status"><i /> SECURE ACCESS</span></header>
    <section className="admin-login-wrap"><div className="admin-login-copy"><p className="eyebrow">INTERNAL MANAGEMENT CONSOLE</p><h1>Administrator sign in</h1><p>Sign in with your administrator account to continue to the management console.</p><div className="admin-security-note"><span>Protected area</span><p>All access attempts are monitored and recorded.</p></div></div>
      <form className="admin-login-card" onSubmit={submit}><div className="admin-card-heading"><h2>Welcome back</h2><p>Enter your account details below.</p></div>
        <label>Username<input autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {result && !result.authenticated && <p className="admin-error" role="alert">The username or password you entered is incorrect.</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="admin-submit" disabled={busy}>{busy ? 'Verifying…' : 'Sign in'}</button>
        <p className="admin-card-foot">Authorized personnel only</p>
      </form>
    </section><footer className="admin-footer">TRAPDOOR SYSTEMS <span>•</span> ADMINISTRATION CONSOLE</footer>
  </main>;
}
