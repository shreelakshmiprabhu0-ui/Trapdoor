import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { USE_MOCK } from '../api.js';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/portal" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setBusy(true);
    try {
      const u = await login(email.trim(), password);
      const fallback = u.role === 'DEFENDER' ? '/defender' : '/portal';
      navigate(location.state?.from || fallback, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <div className="login-intro">
        <h1>Sign in to your portal</h1>
        <p>Your notes and resources, kept private to your account.</p>
      </div>

      <form className="card form" onSubmit={handleSubmit} noValidate>
        <label>
          Email
          <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {USE_MOCK && (
          <p className="hint">
            Mock mode. Try demo@trapdoor.test / demo123 or defender@trapdoor.test / defender123.
          </p>
        )}
      </form>
    </div>
  );
}
