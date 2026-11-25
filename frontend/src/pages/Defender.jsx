
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import EventList from '../components/EventList.jsx';

export default function Defender() {
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    admin: 0,
    backups: 0,
    config: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [route, setRoute] = useState('all');
  const [query, setQuery] = useState('');

  // Prevent multiple event requests from running simultaneously.
  const inFlight = useRef(false);

  const load = useCallback(async (showLoading = false) => {
    if (inFlight.current) return;

    inFlight.current = true;

    if (showLoading) {
      setLoading(true);
    }

    setError('');

    try {
      const data = await api.getEvents();

      setEvents(data.events || []);
      setTotal(Number(data.total ?? 0));

      setStats({
        admin: Number(data.stats?.admin ?? 0),
        backups: Number(data.stats?.backups ?? 0),
        config: Number(data.stats?.config ?? 0),
      });
    } catch (err) {
      setError(
        err.status === 403
          ? 'Your account is not allowed to view events.'
          : err.message
      );
    } finally {
      inFlight.current = false;

      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  // Initial load and automatic refresh every 3 seconds.
  useEffect(() => {
    load(true);

    const interval = setInterval(() => {
      load(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [load]);

  // These statistics come from the entire database, not just the displayed events.
  const counts = useMemo(() => ({
    total,
    admin: stats.admin,
    backups: stats.backups,
    config: stats.config,
  }), [total, stats]);

  const filtered = useMemo(
    () => events.filter((e) => {
      const eventRoute = e.route || '';

      return (
        (route === 'all' || eventRoute.includes(route)) &&
        `${eventRoute} ${e.sessionRef || ''} ${e.eventType || ''}`
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    }),
    [events, route, query]
  );

  return (
    <div className="case">
      <div className="case-inner">

        <div className="case-head">
          <div>
            <p className="eyebrow">SECURITY OPERATIONS</p>
            <h1>Trap activity</h1>
            <p>Recorded interactions with configured deception resources.</p>
          </div>

          <button
            className="btn btn-light"
            onClick={() => load(true)}
            disabled={loading}
          >
            Refresh events
          </button>
        </div>

        <div className="event-stats">
          <article>
            <span>Total events</span>
            <strong>{counts.total}</strong>
          </article>

          <article>
            <span>Admin activity</span>
            <strong>{counts.admin}</strong>
          </article>

          <article>
            <span>Backup activity</span>
            <strong>{counts.backups}</strong>
          </article>

          <article>
            <span>Config activity</span>
            <strong>{counts.config}</strong>
          </article>
        </div>

        <div className="event-tools">
          <div>
            <h2>Event history</h2>
            <p>Newest recorded interactions first.</p>
          </div>

          <div className="event-filters">
            <input
              aria-label="Search events"
              placeholder="Search route or session…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            <select
              aria-label="Filter events by route"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
            >
              <option value="all">All trap routes</option>
              <option value="/admin">Admin</option>
              <option value="/backups">Backups</option>
              <option value="/config">Config</option>
            </select>
          </div>
        </div>

        <EventList
          events={filtered}
          loading={loading}
          error={error}
          onRetry={() => load(true)}
        />

      </div>
    </div>
  );
}
