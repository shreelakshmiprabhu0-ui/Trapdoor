import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import EventList from '../components/EventList.jsx';

export default function Defender() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.getEvents()
      .then((data) => setEvents(data.events))
      .catch((err) => setError(err.status === 403 ? 'Your account is not allowed to view events.' : err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="case">
      <div className="case-inner">
        <div className="case-head">
          <div>
            <h1>Trap activity</h1>
            <p>Requests to configured trap routes, newest first. Responses to these requests were synthetic.</p>
          </div>
          <button className="btn btn-light" onClick={load} disabled={loading}>Refresh</button>
        </div>
        <EventList events={events} loading={loading} error={error} onRetry={load} />
      </div>
    </div>
  );
}
