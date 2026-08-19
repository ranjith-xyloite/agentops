import React, { useState, useMemo } from 'react';
import { Server as ServerIcon, Plus, Trash2, Activity, Key, Lock, Eye, EyeOff, CheckCircle2, AlertCircle, RefreshCw, Edit3, X, Search } from 'lucide-react';
import { Server, ServerTestResult, ServerHealthAuditResult } from '../types';
import { testServerConnectionApi, testExistingServerConnectionApi, auditServerHealthApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PaginationControls } from './PaginationControls';

interface ServerFleetProps {
  servers: Server[];
  environments?: any[];
  onAddServer: (server: Omit<Server, 'id' | 'environment_name'>) => Promise<void>;
  onUpdateServer?: (serverId: number, server: Partial<Server>) => Promise<void>;
  onDeleteServer: (serverId: number) => Promise<void>;
}

export const ServerFleet: React.FC<ServerFleetProps> = ({
  servers,
  onAddServer,
  onUpdateServer,
  onDeleteServer,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Add Form State
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('deploy');
  const [authMethod, setAuthMethod] = useState<'password' | 'ssh_key' | 'custom_key'>('password');
  const [password, setPassword] = useState('');
  const [sshKey, setSshKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Edit Form State
  const [editName, setEditName] = useState('');
  const [editHostname, setEditHostname] = useState('');
  const [editPort, setEditPort] = useState(22);
  const [editUsername, setEditUsername] = useState('deploy');
  const [editAuthMethod, setEditAuthMethod] = useState<'password' | 'ssh_key' | 'custom_key'>('password');
  const [editPassword, setEditPassword] = useState('');
  const [editSshKey, setEditSshKey] = useState('');
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Form Test Connection State
  const [isTestingModal, setIsTestingModal] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<ServerTestResult | null>(null);

  // Node Card Test State
  const [testingServerId, setTestingServerId] = useState<number | null>(null);
  const [serverTestResults, setServerTestResults] = useState<Record<number, ServerTestResult>>({});

  // Single Server Health Audit Modal State
  const [auditingServer, setAuditingServer] = useState<Server | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<ServerHealthAuditResult | null>(null);

  const filteredServers = useMemo(() => {
    if (!searchTerm.trim()) return servers;
    const term = searchTerm.toLowerCase();
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.hostname.toLowerCase().includes(term) ||
        s.username.toLowerCase().includes(term) ||
        (s.environment_name && s.environment_name.toLowerCase().includes(term)) ||
        String(s.port).includes(term)
    );
  }, [servers, searchTerm]);

  const paginatedServers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServers.slice(start, start + pageSize);
  }, [filteredServers, currentPage, pageSize]);

  const handleOpenAuditModal = async (server: Server) => {
    setAuditingServer(server);
    setIsAuditing(true);
    setAuditResult(null);
    try {
      const res = await auditServerHealthApi(server.id);
      setAuditResult(res);
    } catch (err: any) {
      setAuditResult({
        server_id: server.id,
        server_name: server.name,
        hostname: server.hostname,
        success: false,
        status: 'UNREACHABLE',
        logs: [`❌ Health probe failed to connect: ${err.message || err}`],
        checked_at: new Date().toISOString()
      });
    } finally {
      setIsAuditing(false);
    }
  };

  const startEditingServer = (s: Server) => {
    setEditingServer(s);
    setEditName(s.name);
    setEditHostname(s.hostname);
    setEditPort(s.port);
    setEditUsername(s.username);
    setEditAuthMethod((s.authentication_method as any) || 'password');
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
    <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="panel-title">
          <ServerIcon size={18} style={{ color: '#3b82f6' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Server Fleet & Node Infrastructure</span>
            <span className="badge badge-primary" style={{ fontSize: '11px' }}>
              {filteredServers.length} Nodes
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="chat-input"
              style={{ padding: '6px 12px 6px 30px', fontSize: '12px', width: '200px' }}
              placeholder="Search host, name, IP..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
          </div>

          {isAdmin && (
            <button className="btn btn-primary btn-sm" onClick={() => { setShowAddModal(!showAddModal); setEditingServer(null); }}>
              <Plus size={14} />
              Add Node
            </button>
          )}
        </div>
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <form onSubmit={handleSubmitAdd} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--accent-blue)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={15} /> Configure New Server Node
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Server Identifier *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. general-node-01"
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
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Authentication Method *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={authMethod}
                onChange={(e) => setAuthMethod(e.target.value as any)}
              >
                <option value="password">SSH Password Authentication</option>
                <option value="ssh_key">SSH Key (Default Host Key)</option>
                <option value="custom_key">Custom SSH Private Key</option>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
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
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Authentication Method *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editAuthMethod}
                onChange={(e) => setEditAuthMethod(e.target.value as any)}
              >
                <option value="password">SSH Password Authentication</option>
                <option value="ssh_key">SSH Key (Default Host Key)</option>
                <option value="custom_key">Custom SSH Private Key</option>
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
        {paginatedServers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
            <ServerIcon size={32} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>No Servers Found</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {searchTerm ? 'No nodes match your search query.' : 'Add your first server node to manage infrastructure.'}
            </p>
          </div>
        ) : (
          <div className="server-grid">
            {paginatedServers.map((s) => {
              const testRes = serverTestResults[s.id];
              const isTesting = testingServerId === s.id;

              return (
                <div key={s.id} className="server-card">
                  <div className="server-card-header">
                    <div className="server-title">{s.name}</div>
                    <span className="badge badge-primary" style={{ fontSize: '10px' }}>
                      FLEET NODE
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
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onClick={() => handleOpenAuditModal(s)}
                      title={`Run real-time health audit on ${s.name}`}
                    >
                      <Activity size={12} style={{ color: 'var(--accent-cyan)' }} />
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
        )}
      </div>

      {/* Pagination Footer */}
      <PaginationControls
        currentPage={currentPage}
        totalItems={filteredServers.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel="server nodes"
      />

      {/* Dedicated Single Server Live Health Audit Window / Modal */}
      {auditingServer && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: 680,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-primary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  padding: 8,
                  borderRadius: 'var(--radius-md)',
                  background: 'rgba(6, 182, 212, 0.1)',
                  color: 'var(--accent-cyan)'
                }}>
                  <Activity size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    Health Audit: {auditingServer.name}
                    {auditResult && (
                      <span className={`badge ${auditResult.success ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10.5px' }}>
                        {auditResult.status}
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: 2 }}>
                    Dedicated live probe for node <span className="font-mono">{auditingServer.hostname}:{auditingServer.port}</span>
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenAuditModal(auditingServer)}
                  disabled={isAuditing}
                  title="Re-run audit"
                >
                  <RefreshCw size={13} className={isAuditing ? 'spin' : ''} />
                  {isAuditing ? 'Auditing...' : 'Re-run Probe'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAuditingServer(null)}
                  style={{ padding: '6px' }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div style={{ padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {isAuditing && !auditResult ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <RefreshCw size={32} className="spin" style={{ color: 'var(--accent-cyan)', marginBottom: 12 }} />
                  <p style={{ fontSize: '13px' }}>Executing live diagnostic probes on {auditingServer.name}...</p>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Testing SSH handshake, CPU, RAM, Disk, and Docker daemon</p>
                </div>
              ) : auditResult ? (
                <>
                  {/* System Metrics Cards */}
                  {auditResult.success && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>⚡ CPU Load</span>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{auditResult.cpu_usage || 'Active'}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>🧠 Memory Usage</span>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{auditResult.memory_usage || 'Nominal'}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>💾 Disk Space</span>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{auditResult.disk_usage || 'Nominal'}</div>
                      </div>
                      <div style={{ background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)' }}>🐳 Docker Daemon</span>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-cyan)', marginTop: 2 }}>{auditResult.docker_status || 'Online'}</div>
                      </div>
                    </div>
                  )}

                  {/* Terminal Log Output Window */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Live Probe Terminal Output (Single Node Stream)
                      </span>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        Probe time: {new Date(auditResult.checked_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="font-mono" style={{
                      background: '#090d16',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 'var(--radius-md)',
                      padding: 14,
                      fontSize: '12px',
                      color: '#e2e8f0',
                      lineHeight: '1.7',
                      maxHeight: 240,
                      overflowY: 'auto'
                    }}>
                      {auditResult.logs.map((logLine, idx) => (
                        <div key={idx} style={{
                          color: logLine.startsWith('❌') ? 'var(--status-error)' : logLine.startsWith('✅') ? 'var(--status-success)' : logLine.startsWith('🎉') ? 'var(--accent-cyan)' : 'inherit'
                        }}>
                          {logLine}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--bg-primary)'
            }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setAuditingServer(null)}
              >
                Close Audit Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


