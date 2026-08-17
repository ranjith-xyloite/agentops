import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Eye, User } from 'lucide-react';
import { AuditLog } from '../types';
import { listAuditLogsApi } from '../services/api';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await listAuditLogsApi(filterAction || undefined);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [filterAction]);

  const getActionBadge = (action: string) => {
    if (action.includes('delete') || action.includes('cancel') || action.includes('revoke')) {
      return <span className="badge badge-failed">{action}</span>;
    }
    if (action.includes('confirm') || action.includes('create') || action.includes('register')) {
      return <span className="badge badge-success">{action}</span>;
    }
    if (action.includes('chat_command')) {
      return <span className="badge badge-running">{action}</span>;
    }
    return <span className="badge badge-pending">{action}</span>;
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div className="panel-title">
          <History size={18} style={{ color: 'var(--accent-purple)' }} />
          <span>Security & Compliance Audit Trail</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            className="chat-input"
            style={{ padding: '6px 12px', fontSize: '12px', width: 180 }}
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          >
            <option value="">All Actions</option>
            <option value="chat_command">Chat Command</option>
            <option value="task_confirmed">Task Confirmed</option>
            <option value="task_cancelled">Task Cancelled</option>
            <option value="user_login">User Login</option>
            <option value="create_server">Create Server</option>
            <option value="delete_server">Delete Server</option>
            <option value="create_api_key">Create API Key</option>
            <option value="revoke_api_key">Revoke API Key</option>
          </select>

          <button className="btn btn-secondary btn-sm" onClick={loadLogs} disabled={isLoading}>
            <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target Resource</th>
              <th>IP Address</th>
              <th>Timestamp</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No audit logs recorded yet for this filter.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                    #{log.id}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                      <User size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>{log.username}</span>
                    </div>
                  </td>
                  <td>{getActionBadge(log.action)}</td>
                  <td>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{log.resource_type}</span>
                      {log.resource_id ? ` #${log.resource_id}` : ''}
                    </span>
                  </td>
                  <td className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {log.ip_address || 'internal'}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {log.timestamp ? new Date(log.timestamp).toLocaleString() : '-'}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye size={12} /> Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Inspector Drawer / Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7, 10, 17, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '560px',
            padding: 24,
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={18} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Audit Event #{selectedLog.id}</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>Close</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16, fontSize: '12.5px' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>User:</span> <strong>{selectedLog.username}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Action:</span> <strong>{selectedLog.action}</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Resource:</span> <strong>{selectedLog.resource_type} ({selectedLog.resource_id})</strong></div>
              <div><span style={{ color: 'var(--text-muted)' }}>Timestamp:</span> <strong>{new Date(selectedLog.timestamp || '').toLocaleString()}</strong></div>
            </div>

            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: 6, fontWeight: 600 }}>PAYLOAD DETAILS:</div>
            <pre style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 12,
              maxHeight: 240,
              overflowY: 'auto',
              fontSize: '12px',
              color: 'var(--accent-cyan)',
              fontFamily: 'monospace'
            }}>
              {JSON.stringify(selectedLog.details, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
