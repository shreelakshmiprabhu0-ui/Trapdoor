import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Status from '../components/Status.jsx';

export default function Portal() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setLoading(true); setError('');
    api.getPortal().then((data) => setItems(data.items || []))
      .catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => items.filter((n) => `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const resetForm = () => { setEditing(null); setTitle(''); setContent(''); setFormError(''); };
  const startEdit = (note) => { setEditing(note.id); setTitle(note.title); setContent(note.body || ''); setFormError(''); };
  const save = async (e) => {
    e.preventDefault(); setFormError('');
    if (!title.trim() || title.trim().length > 100 || content.length > 1000) { setFormError('Enter a title (1–100 characters) and keep content under 1,000 characters.'); return; }
    setSaving(true);
    try {
      if (editing) await api.updateNote(editing, title.trim(), content.trim());
      else await api.createNote(title.trim(), content.trim());
      resetForm(); load();
    } catch (err) { setFormError(err.message); } finally { setSaving(false); }
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    try { await api.deleteNote(id); setItems((old) => old.filter((n) => n.id !== id)); }
    catch (err) { setError(err.message); }
  };

  return <div className="page">
    <div className="portal-heading"><div><p className="eyebrow">PERSONAL WORKSPACE</p><h1>Welcome back, {user.name.split(' ')[0]}</h1><p className="lead">Your notes and resources, kept private to your account.</p></div><div className="portal-count"><strong>{items.length}</strong><span>Saved notes</span></div></div>
    <section className="notes-toolbar"><div><h2>Your notes</h2><p className="section-copy">Capture reminders, ideas and things to come back to.</p></div><input className="search-input" aria-label="Search notes" placeholder="Search your notes…" value={query} onChange={(e) => setQuery(e.target.value)} /></section>
    <form className="card note-form" onSubmit={save}>
      <div className="form-title"><h2>{editing ? 'Edit note' : 'Create a note'}</h2>{editing && <button type="button" className="text-button" onClick={resetForm}>Cancel editing</button>}</div>
      <label>Title<input value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} placeholder="Give your note a title" required /></label>
      <label>Content<textarea value={content} maxLength={1000} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="Write something worth remembering…" /></label>
      <div className="note-form-footer"><span>{content.length}/1000 characters</span><button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Add note'}</button></div>
      {formError && <p className="form-error" role="alert">{formError}</p>}
    </form>
    {loading && <Status kind="loading" message="Loading your notes…" />}
    {error && <Status kind="error" message={error} action={<button className="btn btn-light" onClick={load}>Try again</button>} />}
    {!loading && !error && filtered.length === 0 && <Status kind="empty" title={items.length ? 'No matching notes' : 'No notes yet'} message={items.length ? 'Try a different search term.' : 'Create your first note above. It will be visible only to your account.'} />}
    {!loading && !error && filtered.length > 0 && <ul className="notes">{filtered.map((n) => <li key={n.id} className="card note"><div className="note-content"><h2>{n.title}</h2><p>{n.body}</p></div><div className="note-actions"><time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</time><div><button className="text-button" onClick={() => startEdit(n)}>Edit</button><button className="text-button danger-text" onClick={() => remove(n.id)}>Delete</button></div></div></li>)}</ul>}
  </div>;
}
