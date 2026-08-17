import React, { useState } from 'react';
import { Server as ServerIcon, Plus, Trash2, Activity, Key, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Edit3, X } from 'lucide-react';
import { Server, Environment, ServerTestResult } from '../types';
import { testServerConnectionApi, testExistingServerConnectionApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface ServerFleetProps {
  servers: Server[];
  environments: Environment[];
  onAddServer: (server: Omit<Server, 'id' | 'environment_name'>) => Promise<void>;
  onUpdateServer?: (serverId: number, server: Partial<Server>) => Promise<void>;
  onDeleteServer: (serverId: number) => Promise<void>;
  onTriggerHealthCheck: (envName: string) => void;
}

export const ServerFleet: React.FC<ServerFleetProps> = ({
  servers,
  environments,
  onAddServer,
  onUpdateServer,
  onDeleteServer,
  onTriggerHealthCheck,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);

  // Add Form State
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('deploy');
  const [authMethod, setAuthMethod] = useState<'password' | 'ssh_key' | 'custom_key'>('password');
  const [password, setPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [envId, setEnvId] = useState<number | undefined>(undefined);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editHostname, setEditHostname] = useState('');
  const [editPort, setEditPort] = useState(22);
  const [editUsername, setEditUsername] = useState('deploy');
  const [editAuthMethod, setEditAuthMethod] = useState<'password' | 'ssh_key' | 'custom_key'>('password');
  const [editPassword, setEditPassword] = useState('');
  const [editSshKey, setEditSshKey] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [editEnvId, setEditEnvId] = useState<number | undefined>(undefined);

  // Form Test Connection State
  const [isTestingModal, setIsTestingModal] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<ServerTestResult | null>(null);

  // Node Card Test State
  const [testingServerId, setTestingServerId] = useState<number | null>(null);
  const [serverTestResults, setServerTestResults] = useState<Record<number, ServerTestResult>>({});

  const startEditingServer = (s: Server) => {
    setEditingServer(s);
    setEditName(s.name);
    setEditHostname(s.hostname);
    setEditPort(s.port);
    setEditUsername(s.username);
    setEditAuthMethod((s.authentication_method as any) || 'password');
    setEditEnvId(s.environment_id || undefined);
    setEditPassword('');
    setEditSshKey(s.ssh_key || '');
    setModalTestResult(null);
  };

  const handleTestModalConnection = async (isEdit = false) => {
    const host = isEdit ? editHostname : hostname;
    const user = isEdit ? editUsername : username;
    const p = isEdit ? editPort : port;
    const auth = isEdit ? editAuthMethod : authMethod;
    const pwd = isEdit ? editPassword : password;
    const key = isEdit ? editSshKey : sshKey;

    if (!host || !user) {
      alert('Please provide Hostname and SSH Username to test connection.');
      return;
    }
    setIsTestingModal(true);
    setModalTestResult(null);
    try {
      const res = await testServerConnectionApi({
        hostname: host,
        port: p,
        username: user,
        authentication_method: auth,
        password: auth === 'password' && pwd ? pwd : undefined,
        ssh_key: auth === 'custom_key' && key ? key : undefined,
      });
      setModalTestResult(res);
    } catch (err: any) {
      setModalTestResult({
        success: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setIsTestingModal(false);
    }
  };

  const handleTestExistingServer = async (serverId: number) => {
    setTestingServerId(serverId);
    try {
      const res = await testExistingServerConnectionApi(serverId);
      setServerTestResults((prev) => ({ ...prev, [serverId]: res }));
    } catch (err: any) {
      setServerTestResults((prev) => ({
        ...prev,
        [serverId]: { success: false, message: err.message || 'Test failed' },
      }));
    } finally {
      setTestingServerId(null);
    }
  };

  const handleSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !hostname) return;
    try {
      await onAddServer({
        name,
        hostname,
        port,
        username,
        environment_id: Number(envId),
        authentication_method: authMethod,
        password: authMethod === 'password' ? password : undefined,
        ssh_key: authMethod === 'custom_key' ? sshKey : undefined,
      });
      setName('');
      setHostname('');
      setPassword('');
      setSshKey('');
      setModalTestResult(null);
      setShowAddModal(false);
    } catch (err: any) {
      alert(`Failed to add server: ${err.message || err}`);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingServer || !editName || !editHostname || !onUpdateServer) return;
    try {
      await onUpdateServer(editingServer.id, {
        name: editName,
        hostname: editHostname,
        port: editPort,
        username: editUsername,
        environment_id: Number(editEnvId),
        authentication_method: editAuthMethod,
        password: editAuthMethod === 'password' && editPassword ? editPassword : undefined,
        ssh_key: editAuthMethod === 'custom_key' ? editSshKey : undefined,
      });
      setEditingServer(null);
      setModalTestResult(null);
    } catch (err: any) {
      alert(`Failed to update server: ${err.message || err}`);
    }
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ServerIcon size={18} style={{ color: '#3b82f6' }} />
          <span>Server Fleet & Node Infrastructure</span>
        </div>

        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={() => { setShowAddModal(!showAddModal); setEditingServer(null); }}>
            <Plus size={14} />
            Add Node
          </button>
        )}
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <form onSubmit={handleSubmitAdd} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--accent-blue)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Configure New Server Node
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Server Identifier *</label>
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
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Hostname / IP *</label>
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
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SSH Username *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Environment *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={envId}
                onChange={(e) => setEnvId(Number(e.target.value))}
              >
                {environments.length > 0 ? (
                  environments.map((env) => (
                    <option key={env.id} value={env.id} style={{ background: '#111827', color: '#f8fafc' }}>
                      {env.name.toUpperCase()}
                    </option>
                  ))
                ) : (
                  <>
                    <option value={1} style={{ background: '#111827', color: '#f8fafc' }}>UAT</option>
                    <option value={2} style={{ background: '#111827', color: '#f8fafc' }}>QA</option>
                    <option value={3} style={{ background: '#111827', color: '#f8fafc' }}>PRODUCTION</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Authentication Method *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value as any)}
              >
                <option value="password" style={{ background: '#111827', color: '#f8fafc' }}>SSH Password Authentication</option>
                <option value="ssh_key" style={{ background: '#111827', color: '#f8fafc' }}>SSH Key (Default Host Key)</option>
                <option value="custom_key" style={{ background: '#111827', color: '#f8fafc' }}>Custom SSH Private Key</option>
              </select>
            </div>

            {authMethod === 'password' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>User Password *</label>
                <div style={{ position: 'relative', marginTop: 4 }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="chat-input font-mono"
                    style={{ width: '100%', paddingRight: 36 }}
                    placeholder="Enter SSH password for node user"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                    }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {authMethod === 'custom_key' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Private Key (PEM format)</label>
                <textarea
                  className="chat-input font-mono"
                  style={{ width: '100%', marginTop: 4, height: 70, fontSize: '11px' }}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  value={sshKey}
                  onChange={(e) => setSshKey(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, gridColumn: 'span 2' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleTestModalConnection(false)}
                disabled={isTestingModal}
              >
                {isTestingModal ? <RefreshCw size={13} className="spin" /> : <Activity size={13} />}
                Test SSH Handshake
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Save Node
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </div>

          {modalTestResult && (
            <div style={{
              marginTop: 14,
              padding: 10,
              borderRadius: 'var(--radius-md)',
              background: modalTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${modalTestResult.success ? 'var(--status-success)' : 'var(--status-error)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '12px'
            }}>
              {modalTestResult.success ? (
                <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
              ) : (
                <AlertCircle size={16} style={{ color: 'var(--status-error)' }} />
              )}
              <span>{modalTestResult.message}</span>
              {modalTestResult.latency_ms !== undefined && (
                <span className="badge badge-primary" style={{ marginLeft: 'auto' }}>
                  {modalTestResult.latency_ms}ms
                </span>
              )}
            </div>
          )}
        </form>
      )}

      {/* Edit Server Modal */}
      {editingServer && (
        <form onSubmit={handleSubmitEdit} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={15} /> Edit Server Node: {editingServer.name}
            </h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingServer(null)}>
              <X size={13} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Server Identifier *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Hostname / IP *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editHostname}
                onChange={(e) => setEditHostname(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SSH Port</label>
              <input
                type="number"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editPort}
                onChange={(e) => setEditPort(Number(e.target.value))}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>SSH Username *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Environment *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={editEnvId}
                onChange={(e) => setEditEnvId(Number(e.target.value))}
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id} style={{ background: '#111827', color: '#f8fafc' }}>
                    {env.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Authentication Method *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={editAuthMethod}
                onChange={(e) => setEditAuthMethod(e.target.value as any)}
              >
                <option value="password" style={{ background: '#111827', color: '#f8fafc' }}>SSH Password Authentication</option>
                <option value="ssh_key" style={{ background: '#111827', color: '#f8fafc' }}>SSH Key (Default Host Key)</option>
                <option value="custom_key" style={{ background: '#111827', color: '#f8fafc' }}>Custom SSH Private Key</option>
              </select>
            </div>

            {editAuthMethod === 'password' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  User Password {editingServer.has_password ? '(Leave blank to keep existing password)' : '*'}
                </label>
                <div style={{ position: 'relative', marginTop: 4 }}>
                  <input
                    type={showEditPassword ? 'text' : 'password'}
                    className="chat-input font-mono"
                    style={{ width: '100%', paddingRight: 36 }}
                    placeholder={editingServer.has_password ? '•••••••• (Password configured - enter new to change)' : 'Enter SSH password'}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer'
                    }}
                  >
                    {showEditPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {editAuthMethod === 'custom_key' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Private Key (PEM format)</label>
                <textarea
                  className="chat-input font-mono"
                  style={{ width: '100%', marginTop: 4, height: 70, fontSize: '11px' }}
                  placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
                  value={editSshKey}
                  onChange={(e) => setEditSshKey(e.target.value)}
                />
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, gridColumn: 'span 2' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleTestModalConnection(true)}
                disabled={isTestingModal}
              >
                {isTestingModal ? <RefreshCw size={13} className="spin" /> : <Activity size={13} />}
                Test SSH Handshake
              </button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Update Node
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingServer(null)}>
                Cancel
              </button>
            </div>
          </div>

          {modalTestResult && (
            <div style={{
              marginTop: 14,
              padding: 10,
              borderRadius: 'var(--radius-md)',
              background: modalTestResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${modalTestResult.success ? 'var(--status-success)' : 'var(--status-error)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '12px'
            }}>
              {modalTestResult.success ? (
                <CheckCircle2 size={16} style={{ color: 'var(--status-success)' }} />
              ) : (
                <AlertCircle size={16} style={{ color: 'var(--status-error)' }} />
              )}
              <span>{modalTestResult.message}</span>
              {modalTestResult.latency_ms !== undefined && (
                <span className="badge badge-primary" style={{ marginLeft: 'auto' }}>
                  {modalTestResult.latency_ms}ms
                </span>
              )}
            </div>
          )}
        </form>
      )}

      {/* Server Grid */}
      <div style={{ padding: 20 }}>
        <div className="server-grid">
          {servers.map((s) => {
            const testRes = serverTestResults[s.id];
            const isTesting = testingServerId === s.id;

            return (
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
                      {s.authentication_method === 'password' ? (
                        <>
                          <Lock size={12} style={{ color: 'var(--accent-cyan)' }} /> Password
                        </>
                      ) : (
                        <>
                          <Key size={12} style={{ color: 'var(--accent-blue)' }} /> SSH Key
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {testRes && (
                  <div style={{
                    margin: '8px 0',
                    padding: '6px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    background: testRes.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    border: `1px solid ${testRes.success ? 'var(--status-success)' : 'var(--status-error)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}>
                    {testRes.success ? (
                      <CheckCircle2 size={13} style={{ color: 'var(--status-success)' }} />
                    ) : (
                      <AlertCircle size={13} style={{ color: 'var(--status-error)' }} />
                    )}
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {testRes.message}
                    </span>
                    {testRes.latency_ms !== undefined && (
                      <span style={{ color: 'var(--text-secondary)' }}>{testRes.latency_ms}ms</span>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleTestExistingServer(s.id)}
                    disabled={isTesting}
                    title="Test SSH handshake"
                  >
                    {isTesting ? <RefreshCw size={12} className="spin" /> : <Activity size={12} />}
                    Test SSH
                  </button>
                  {isAdmin && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => startEditingServer(s)}
                      title="Edit Node Configuration"
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => onTriggerHealthCheck(s.environment_name || 'uat')}
                    title="Run real-time health audit"
                  >
                    Health Audit
                  </button>
                  {isAdmin && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => onDeleteServer(s.id)}
                      title="Remove Node"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};


