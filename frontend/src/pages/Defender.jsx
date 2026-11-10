import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import EventList from '../components/EventList.jsx';

export default function Defender() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [route, setRoute] = useState('all');
  const [query, setQuery] = useState('');
  const load = useCallback(() => {
    setLoading(true); setError('');
    api.getEvents().then((data) => setEvents(data.events || []))
      .catch((err) => setError(err.status === 403 ? 'Your account is not allowed to view events.' : err.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  const counts = useMemo(() => ({ total: events.length, admin: events.filter((e) => e.route.includes('/admin')).length, backups: events.filter((e) => e.route.includes('/backups')).length, config: events.filter((e) => e.route.includes('/config')).length }), [events]);
  const filtered = useMemo(() => events.filter((e) => (route === 'all' || e.route.includes(route)) && `${e.route} ${e.sessionRef || ''} ${e.eventType}`.toLowerCase().includes(query.toLowerCase())), [events, route, query]);
  return <div className="case"><div className="case-inner">
    <div className="case-head"><div><p className="eyebrow">SECURITY OPERATIONS</p><h1>Trap activity</h1><p>Recorded interactions with configured deception resources.</p></div><button className="btn btn-light" onClick={load} disabled={loading}>Refresh events</button></div>
    <div className="event-stats"><article><span>Total events</span><strong>{counts.total}</strong></article><article><span>Admin activity</span><strong>{counts.admin}</strong></article><article><span>Backup activity</span><strong>{counts.backups}</strong></article><article><span>Config activity</span><strong>{counts.config}</strong></article></div>
    <div className="event-tools"><div><h2>Event history</h2><p>Newest recorded interactions first.</p></div><div className="event-filters"><input aria-label="Search events" placeholder="Search route or session…" value={query} onChange={(e) => setQuery(e.target.value)} /><select aria-label="Filter events by route" value={route} onChange={(e) => setRoute(e.target.value)}><option value="all">All trap routes</option><option value="/admin">Admin</option><option value="/backups">Backups</option><option value="/config">Config</option></select></div></div>
    <EventList events={filtered} loading={loading} error={error} onRetry={load} />
  </div></div>;
}
