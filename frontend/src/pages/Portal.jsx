import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Status from '../components/Status.jsx';

export default function Portal() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.getPortal()
      .then((data) => setItems(data.items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page">
      <h1>Welcome back, {user.name.split(' ')[0]}</h1>
      <p className="lead">Your saved notes and resources.</p>

      {loading && <Status kind="loading" message="Loading your notes…" />}
      {error && (
        <Status kind="error" message={error}
          action={<button className="btn btn-light" onClick={load}>Try again</button>} />
      )}
      {!loading && !error && items.length === 0 && (
        <Status kind="empty" title="No notes yet" message="Notes you save will show up here." />
      )}
      {!loading && !error && items.length > 0 && (
        <ul className="notes">
          {items.map((n) => (
            <li key={n.id} className="card note">
              <h2>{n.title}</h2>
              <p>{n.body}</p>
              <time dateTime={n.createdAt}>
                {new Date(n.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
