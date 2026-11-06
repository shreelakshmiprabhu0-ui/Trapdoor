import Status from './Status.jsx';

const formatTime = (iso) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

const labelFor = (type) =>
  type.toLowerCase().replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

export default function EventList({ events, loading, error, onRetry }) {
  if (loading) return <Status kind="loading" message="Fetching recorded events…" />;
  if (error) {
    return (
      <Status
        kind="error"
        message={error}
        action={<button className="btn btn-light" onClick={onRetry}>Try again</button>}
      />
    );
  }
  if (!events.length) {
    return (
      <Status
        kind="empty"
        title="No trap activity recorded"
        message="When someone requests a configured trap route, the event will appear here."
      />
    );
  }

  return (
    <ul className="events">
      {events.map((e) => (
        <li key={e.id} className="event">
          <div className="event-head">
            <span className="method">{e.method}</span>
            <code className="event-route">{e.route}</code>
            <time className="event-time" dateTime={e.createdAt}>{formatTime(e.createdAt)}</time>
          </div>
          <div className="event-meta">
            <span>{labelFor(e.eventType)}</span>
            {e.sessionRef && <span>Session {e.sessionRef}</span>}
            <span>Event #{e.id}</span>
          </div>
          {e.details && Object.keys(e.details).length > 0 && (
            <details className="event-details">
              <summary>Details</summary>
              <dl>
                {Object.entries(e.details).map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
