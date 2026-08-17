import React, { useState } from 'react';
import { Server as ServerIcon, Plus, Trash2, Activity, Shield } from 'lucide-react';
import { Server, Environment } from '../types';

interface ServerFleetProps {
  servers: Server[];
  environments: Environment[];
  onAddServer: (server: Omit<Server, 'id' | 'environment_name'>) => Promise<void>;
  onDeleteServer: (serverId: number) => Promise<void>;
  onTriggerHealthCheck: (envName: string) => void;
}

export const ServerFleet: React.FC<ServerFleetProps> = ({
  servers,
  environments,
  onAddServer,
  onDeleteServer,
  onTriggerHealthCheck,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('deploy');
  const [envId, setEnvId] = useState<number>(environments[0]?.id || 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !hostname) return;
    await onAddServer({
      name,
      hostname,
      port,
      username,
      environment_id: Number(envId),
      authentication_method: 'ssh_key',
    });
    setName('');
    setHostname('');
    setShowAddModal(false);
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ServerIcon size={18} style={{ color: '#3b82f6' }} />
          <span>Server Fleet & Node Infrastructure</span>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(!showAddModal)}>
          <Plus size={14} />
          Add Node
        </button>
      </div>

      {showAddModal && (
        <form onSubmit={handleSubmit} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Server Name</label>
            <input
              type="text"
              className="chat-input"
              style={{ width: '100%', marginTop: 4 }}
              placeholder="e.g. uat-app-02"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Hostname / IP</label>
            <input
              type="text"
              className="chat-input"
              style={{ width: '100%', marginTop: 4 }}
              placeholder="e.g. 192.168.1.10"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SSH Port</label>
            <input
              type="number"
              className="chat-input"
              style={{ width: '100%', marginTop: 4 }}
              value={port}
              onChange={(e) => setPort(Number(e.target.value))}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SSH Username</label>
            <input
              type="text"
              className="chat-input"
              style={{ width: '100%', marginTop: 4 }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Environment</label>
            <select
              className="chat-input"
              style={{ width: '100%', marginTop: 4 }}
              value={envId}
              onChange={(e) => setEnvId(Number(e.target.value))}
            >
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Save
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ padding: 20 }}>
        <div className="server-grid">
          {servers.map((s) => (
            <div key={s.id} className="server-card">
              <div className="server-card-header">
                <div className="server-title">{s.name}</div>
                <span className="badge badge-success">
                  {(s.environment_name || 'NODE').toUpperCase()}
                </span>
              </div>

              <div className="server-details">
                <div className="server-metric-row">
                  <span>Host:</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{s.hostname}</strong>
                </div>
                <div className="server-metric-row">
                  <span>Port:</span>
                  <span>{s.port}</span>
                </div>
                <div className="server-metric-row">
                  <span>User:</span>
                  <span>{s.username}</span>
                </div>
                <div className="server-metric-row">
                  <span>Auth:</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Shield size={12} style={{ color: 'var(--accent-blue)' }} /> {s.authentication_method}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => onTriggerHealthCheck(s.environment_name || 'uat')}
                  title="Run real-time health audit"
                >
                  <Activity size={13} />
                  Health Audit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => onDeleteServer(s.id)}
                  title="Remove Node"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
