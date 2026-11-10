
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import Status from '../components/Status.jsx';

const formatDuration = (seconds) => {
  if (!Number.isFinite(seconds)) return 'Not available';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours} hours ${minutes} minutes`;
};

function ConfigRow({ label, value }) {
  return (
    <div className="config-row">
      <span>{label}</span>
      <strong>{String(value ?? 'Not available')}</strong>
    </div>
  );
}

function ConfigPanel({ title, description, children }) {
  return (
    <section className="backup-panel config-panel">
      <div className="backup-panel-head">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span>READ ONLY</span>
      </div>
      <div className="config-panel-content">{children}</div>
    </section>
  );
}

export default function ConfigConsole() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    api.getConfig()
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const app = config?.app || {};
  const database = config?.database || {};
  const session = config?.session || {};
  const flags = config?.featureFlags || {};

  return (
    <main className="backup-shell config-shell">
      <header className="backup-header">
        <div>
          <p className="eyebrow">SYSTEM MANAGEMENT / CONFIGURATION</p>
          <h1>Configuration console</h1>
          <p>Application runtime settings and system configuration.</p>
        </div>

        <span className="backup-count">SYSTEM CONFIG</span>
      </header>

      {loading && (
        <Status kind="loading" message="Loading system configuration…" />
      )}

      {error && (
        <Status kind="error" message={error} />
      )}

      {!loading && !error && config && (
        <>
          <section className="config-summary">
            <div>
              <span>APPLICATION</span>
              <strong>{app.name || 'Unknown'}</strong>
            </div>

            <div>
              <span>VERSION</span>
              <strong>{app.version || 'Unknown'}</strong>
            </div>

            <div>
              <span>ENVIRONMENT</span>
              <strong>{app.environment || 'Unknown'}</strong>
            </div>

            <div>
              <span>DEBUG MODE</span>
              <strong>{app.debug ? 'Enabled' : 'Disabled'}</strong>
            </div>
          </section>

          <ConfigPanel
            title="Application settings"
            description="General application runtime information."
          >
            <ConfigRow label="Application name" value={app.name} />
            <ConfigRow label="Application version" value={app.version} />
            <ConfigRow label="Environment" value={app.environment} />
            <ConfigRow label="Debug mode" value={app.debug ? 'Enabled' : 'Disabled'} />
          </ConfigPanel>

          <ConfigPanel
            title="Database configuration"
            description="Database connection metadata."
          >
            <ConfigRow label="Database host" value={database.host} />
            <ConfigRow label="Port" value={database.port} />
            <ConfigRow label="Database name" value={database.name} />
            <ConfigRow label="Connection pool size" value={database.poolSize} />
          </ConfigPanel>

          <ConfigPanel
            title="Session configuration"
            description="Session and cookie security settings."
          >
            <ConfigRow label="Session secret" value="REDACTED" />
            <ConfigRow
              label="Maximum session age"
              value={formatDuration(session.maxAgeSecs)}
            />
            <ConfigRow
              label="Secure cookie"
              value={session.secure ? 'Enabled' : 'Disabled'}
            />
          </ConfigPanel>

          <ConfigPanel
            title="Feature flags"
            description="Application feature availability."
          >
            <ConfigRow
              label="Maintenance mode"
              value={flags.maintenanceMode ? 'Enabled' : 'Disabled'}
            />
            <ConfigRow
              label="New dashboard"
              value={flags.newDashboard ? 'Enabled' : 'Disabled'}
            />
          </ConfigPanel>

          <p className="backup-notice">
            This is a simulated configuration view. Values are synthetic
            demonstration data. No actual system settings can be changed.
          </p>
        </>
      )}
    </main>
  );
}
