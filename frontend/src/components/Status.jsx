// One component for loading, empty and error states so they look consistent.
export default function Status({ kind = 'empty', title, message, action }) {
  const defaults = {
    loading: 'Loading',
    empty: 'Nothing here yet',
    error: 'Something went wrong',
  };
  return (
    <div className={`status status-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      {kind === 'loading' && <span className="spinner" aria-hidden="true" />}
      <p className="status-title">{title || defaults[kind]}</p>
      {message && <p className="status-message">{message}</p>}
      {action}
    </div>
  );
}
