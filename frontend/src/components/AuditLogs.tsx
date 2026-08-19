import React, { useState, useEffect, useMemo } from 'react';
import { History, RefreshCw, Eye, User, X } from 'lucide-react';
import { AuditLog } from '../types';
import { listAuditLogsApi } from '../services/api';
import { PaginationControls } from './PaginationControls';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

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

  const filteredLogs = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const term = searchTerm.toLowerCase();
    return logs.filter(
      (l) =>
        l.username.toLowerCase().includes(term) ||
        l.action.toLowerCase().includes(term) ||
        l.resource_type.toLowerCase().includes(term) ||
        (l.resource_id && l.resource_id.toLowerCase().includes(term)) ||
        (l.ip_address && l.ip_address.toLowerCase().includes(term))
    );
  }, [logs, searchTerm]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const handleFilterChange = (action: string) => {
    setFilterAction(action);
    setCurrentPage(1);
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

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
    <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="panel-title">
          <History size={18} style={{ color: 'var(--accent-purple)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Security & Compliance Audit Trail</span>
            <span className="badge badge-primary" style={{ fontSize: '11px' }}>
              {filteredLogs.length} Records
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            className="chat-input"
            style={{ padding: '6px 12px', fontSize: '12px', width: 170 }}
            placeholder="Search actor, IP, action..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
          />

          <select
            className="chat-input"
            style={{ padding: '6px 12px', fontSize: '12px', width: 170 }}
            value={filterAction}
            onChange={(e) => handleFilterChange(e.target.value)}
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

      <div className="table-container" style={{ margin: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Target Resource</th>
              <th>IP Address</th>
              <th>Timestamp</th>
              <th style={{ textAlign: 'right' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px' }}>
                  <History size={28} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                  <div>No audit logs recorded matching this filter.</div>
                </td>
              </tr>
            ) : (
              paginatedLogs.map((log) => (
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
                    {log.timestamp ? new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
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

      {/* Pagination Footer */}
      <PaginationControls
        currentPage={currentPage}
        totalItems={filteredLogs.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel="audit logs"
      />

      {/* Detail Inspector Drawer / Modal */}
      {selectedLog && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7, 10, 17, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSelectedLog(null);
        }}
        >
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '560px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={18} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Audit Event #{selectedLog.id}</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Actor:</span>
                <strong>{selectedLog.username}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Action:</span>
                <span>{getActionBadge(selectedLog.action)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Target Resource:</span>
                <span>{selectedLog.resource_type} {selectedLog.resource_id ? `#${selectedLog.resource_id}` : ''}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Client IP:</span>
                <code className="font-mono">{selectedLog.ip_address || 'internal'}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Timestamp:</span>
                <span>{selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '-'}</span>
              </div>

              <div style={{ marginTop: 10 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Action Payload Details:</span>
                <pre style={{
                  background: 'var(--bg-terminal)',
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '11.5px',
                  color: 'var(--text-primary)',
                  overflowX: 'auto',
                  maxHeight: '220px',
                  fontFamily: 'var(--font-mono)'
                }}>
                  {JSON.stringify(selectedLog.details, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
