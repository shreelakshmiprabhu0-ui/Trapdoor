import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Status from '../components/Status.jsx';

const bytes = (n) => n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(1)} GB` : `${(n / 1024 ** 2).toFixed(1)} MB`;
export default function BackupExplorer() {
  const [backups, setBackups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { api.getBackups().then((data) => setBackups(data.backups || [])).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, []);
  return <main className="backup-shell"><header className="backup-header"><div><p className="eyebrow">INTERNAL STORAGE / ARCHIVE</p><h1>Backup archive</h1><p>Scheduled database snapshots and system archives.</p></div><span className="backup-count">{backups.length} FILES</span></header>
    <section className="backup-panel"><div className="backup-panel-head"><div><h2>Available backups</h2><p>Archive index · Read-only view</p></div><span>LAST UPDATED: 01 NOV 2026</span></div>
      {loading && <Status kind="loading" message="Loading archive index…" />}{error && <Status kind="error" message={error} />}
      {!loading && !error && <div className="backup-table-wrap"><table className="backup-table"><thead><tr><th>File name</th><th>Size</th><th>Date created</th><th>Status</th><th /></tr></thead><tbody>{backups.map((file) => <tr key={file.filename}><td><span className="file-icon">SQL</span><span className="file-name">{file.filename}</span></td><td>{bytes(file.sizeBytes)}</td><td>{new Date(file.createdAt).toLocaleString()}</td><td><span className="backup-status">{file.status}</span></td><td><button className="text-button" onClick={() => setSelected(file)}>Details</button></td></tr>)}</tbody></table></div>}
    </section>
    {selected && <section className="backup-detail"><div><h2>{selected.filename}</h2><p>Backup record details</p></div><button className="btn btn-light" onClick={() => setSelected(null)}>Close</button><dl><dt>File size</dt><dd>{bytes(selected.sizeBytes)}</dd><dt>Created</dt><dd>{new Date(selected.createdAt).toLocaleString()}</dd><dt>Status</dt><dd>{selected.status}</dd><dt>Checksum</dt><dd>{selected.sha256 || 'Available in archive metadata'}</dd></dl><p className="backup-notice">This is a simulated archive record. No physical backup file is opened or downloaded.</p></section>}
  </main>;
}
