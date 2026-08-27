import React, { useState, useEffect, useMemo } from 'react';
import {
  History, RefreshCw, Eye, User, X, Rocket, AlertTriangle, Filter
} from 'lucide-react';
import { AuditLog } from '../types';
import { listAuditLogsApi, getDeploymentAuditApi } from '../services/api';
import { PaginationControls } from './PaginationControls';

type Tab = 'deployments' | 'security';

const STATUS_BADGE: Record<string, React.ReactNode> = {
  SUCCESS: <span className="badge badge-success">SUCCESS</span>,
  FAILED: <span className="badge badge-failed">FAILED</span>,
  RUNNING: <span className="badge badge-running">RUNNING</span>,
  CANCELLED: <span className="badge badge-pending">CANCELLED</span>,
  AWAITING_CONFIRMATION: <span className="badge badge-pending">PENDING</span>,
  PLANNED: <span className="badge badge-pending">PLANNED</span>,
};

function durationLabel(s: number | null): string {
  if (s === null || s === undefined) return '—';
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export const AuditLogs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('deployments');

  // ── Deployment audit state ────────────────────────────────
  const [deploys, setDeploys] = useState<any[]>([]);
  const [deployStatus, setDeployStatus] = useState('');
  const [deployTool, setDeployTool] = useState('');
  const [deploySearch, setDeploySearch] = useState('');
  const [deployLoading, setDeployLoading] = useState(false);
  const [deployPage, setDeployPage] = useState(1);
  const deployPageSize = 20;

  // ── Security audit state ─────────────────────────────────
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [secLoading, setSecLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [secPage, setSecPage] = useState(1);
  const secPageSize = 20;

  // ── Loaders ───────────────────────────────────────────────
  const loadDeploys = async () => {
    setDeployLoading(true);
    try {
      const data = await getDeploymentAuditApi({
        tool: deployTool || undefined,
        status: deployStatus || undefined,
        limit: 100,
      });
      setDeploys(data);
      setDeployPage(1);
    } catch (err) {
      console.error('Failed to load deployment audit:', err);
    } finally {
      setDeployLoading(false);
    }
  };

  const loadSecurity = async () => {
    setSecLoading(true);
    try {
      const data = await listAuditLogsApi(filterAction || undefined);
      setLogs(data);
      setSecPage(1);
    } catch (err) {
      console.error('Failed to load security audit:', err);
    } finally {
      setSecLoading(false);
    }
  };

  useEffect(() => { loadDeploys(); }, [deployTool, deployStatus]);
  useEffect(() => { loadSecurity(); }, [filterAction]);

  // ── Filtered/paginated deploys ────────────────────────────
  const filteredDeploys = useMemo(() => {
    if (!deploySearch.trim()) return deploys;
    const t = deploySearch.toLowerCase();
    return deploys.filter(d =>
      d.user_request?.toLowerCase().includes(t) ||
      d.triggered_by?.toLowerCase().includes(t) ||
      d.tool?.toLowerCase().includes(t) ||
      JSON.stringify(d.parameters || {}).toLowerCase().includes(t)
    );
  }, [deploys, deploySearch]);

  const pagedDeploys = useMemo(() => {
    const start = (deployPage - 1) * deployPageSize;
    return filteredDeploys.slice(start, start + deployPageSize);
  }, [filteredDeploys, deployPage]);

  // ── Filtered/paginated security logs ─────────────────────
  const filteredSec = useMemo(() => {
    if (!searchTerm.trim()) return logs;
    const t = searchTerm.toLowerCase();
    return logs.filter(l =>
      l.username?.toLowerCase().includes(t) ||
      l.action?.toLowerCase().includes(t) ||
      l.resource_type?.toLowerCase().includes(t) ||
      (l.ip_address && l.ip_address.toLowerCase().includes(t))
    );
  }, [logs, searchTerm]);

  const pagedSec = useMemo(() => {
    const start = (secPage - 1) * secPageSize;
    return filteredSec.slice(start, start + secPageSize);
  }, [filteredSec, secPage]);

  const getActionBadge = (action: string) => {
    if (action.includes('delete') || action.includes('cancel') || action.includes('revoke'))
      return <span className="badge badge-failed">{action}</span>;
    if (action.includes('confirm') || action.includes('create') || action.includes('register'))
      return <span className="badge badge-success">{action}</span>;
    if (action.includes('chat_command'))
      return <span className="badge badge-running">{action}</span>;
    return <span className="badge badge-pending">{action}</span>;
  };

  const toolLabel = (tool: string) => {
    const map: Record<string, string> = {
      deploy_frontend: '🚀 Deploy Frontend',
      deploy_backend: '🛠 Deploy Backend',
      docker_status: '🐳 Docker Status',
      restart_container: '🔄 Restart Container',
      server_health_check: '🩺 Health Check',
      get_server_metrics: '📊 Server Metrics',
    };
    return map[tool] || tool;
  };

  return (
    <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header with tabs */}
      <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: 12 }}>
        <div className="panel-title">
          <History size={18} style={{ color: 'var(--accent-purple)' }} />
          <span>Audit &amp; History</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Tab switcher */}
          <div style={{ display: 'flex', background: 'var(--bg-primary)', borderRadius: 8, padding: 3, gap: 2 }}>
            <button
              onClick={() => setActiveTab('deployments')}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                background: activeTab === 'deployments' ? 'var(--accent-blue)' : 'transparent',
                color: activeTab === 'deployments' ? '#0f172a' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <Rocket size={12} /> Deployments
            </button>
            <button
              onClick={() => setActiveTab('security')}
              style={{
                padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                background: activeTab === 'security' ? 'var(--accent-purple)' : 'transparent',
                color: activeTab === 'security' ? '#fff' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <AlertTriangle size={12} /> Security Events
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={activeTab === 'deployments' ? loadDeploys : loadSecurity}
            disabled={deployLoading || secLoading}
          >
            <RefreshCw size={13} className={(deployLoading || secLoading) ? 'spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── DEPLOYMENTS TAB ── */}
      {activeTab === 'deployments' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="chat-input"
              style={{ padding: '5px 10px', fontSize: '12px', width: 180 }}
              placeholder="Search request, user, tool..."
              value={deploySearch}
              onChange={e => { setDeploySearch(e.target.value); setDeployPage(1); }}
            />
            <select className="chat-input" style={{ padding: '5px 10px', fontSize: '12px', width: 160 }}
              value={deployTool} onChange={e => setDeployTool(e.target.value)}>
              <option value="">All Tools</option>
              <option value="deploy_frontend">Deploy Frontend</option>
              <option value="deploy_backend">Deploy Backend</option>
              <option value="docker_status">Docker Status</option>
              <option value="restart_container">Restart Container</option>
              <option value="server_health_check">Health Check</option>
              <option value="get_server_metrics">Server Metrics</option>
            </select>
            <select className="chat-input" style={{ padding: '5px 10px', fontSize: '12px', width: 140 }}
              value={deployStatus} onChange={e => setDeployStatus(e.target.value)}>
              <option value="">All Statuses</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
              <option value="RUNNING">Running</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
              {filteredDeploys.length} records
            </span>
          </div>

          <div className="table-container" style={{ margin: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>#</th>
                  <th>Request</th>
                  <th>Tool</th>
                  <th>Triggered By</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {pagedDeploys.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 36 }}>
                      <Rocket size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                      <div>No deployment records found.</div>
                    </td>
                  </tr>
                ) : pagedDeploys.map(d => (
                  <tr key={d.id}>
                    <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>#{d.id}</td>
                    <td style={{ maxWidth: 260, fontSize: '12px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {d.user_request}
                      </div>
                      {d.parameters?.environment && (
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                          env: {d.parameters.environment}
                          {d.parameters.project ? ` · ${d.parameters.project}` : ''}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>{toolLabel(d.tool)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '12px' }}>
                        <User size={12} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontWeight: 600 }}>{d.triggered_by}</span>
                      </div>
                    </td>
                    <td>{STATUS_BADGE[d.status] || <span className="badge badge-pending">{d.status}</span>}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>
                      {durationLabel(d.duration_s)}
                    </td>
                    <td style={{ fontSize: '11.5px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {d.created_at ? new Date(d.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls
            currentPage={deployPage}
            totalItems={filteredDeploys.length}
            pageSize={deployPageSize}
            onPageChange={setDeployPage}
            onPageSizeChange={() => {}}
            itemLabel="deployments"
          />
        </>
      )}

      {/* ── SECURITY EVENTS TAB ── */}
      {activeTab === 'security' && (
        <>
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={13} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="chat-input"
              style={{ padding: '5px 10px', fontSize: '12px', width: 180 }}
              placeholder="Search actor, IP, action..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setSecPage(1); }}
            />
            <select className="chat-input" style={{ padding: '5px 10px', fontSize: '12px', width: 170 }}
              value={filterAction} onChange={e => { setFilterAction(e.target.value); setSecPage(1); }}>
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
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{filteredSec.length} records</span>
          </div>

          <div className="table-container" style={{ margin: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 60 }}>ID</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target Resource</th>
                  <th>IP Address</th>
                  <th>Timestamp</th>
                  <th style={{ textAlign: 'right' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {pagedSec.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 36 }}>
                      <History size={28} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                      <div>No security audit logs found.</div>
                    </td>
                  </tr>
                ) : pagedSec.map(log => (
                  <tr key={log.id}>
                    <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>#{log.id}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                        <User size={13} style={{ color: 'var(--text-muted)' }} />
                        {log.username}
                      </div>
                    </td>
                    <td>{getActionBadge(log.action)}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{log.resource_type}</span>
                      {log.resource_id ? ` #${log.resource_id}` : ''}
                    </td>
                    <td className="font-mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {log.ip_address || 'internal'}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => setSelectedLog(log)}>
                        <Eye size={12} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <PaginationControls currentPage={secPage} totalItems={filteredSec.length} pageSize={secPageSize}
            onPageChange={setSecPage} onPageSizeChange={() => {}} itemLabel="events" />
        </>
      )}

      {/* Security log detail modal */}
      {selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,10,17,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSelectedLog(null); }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24, boxShadow: 'var(--shadow-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={18} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Audit Event #{selectedLog.id}</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}><X size={14} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '13px' }}>
              {[
                ['Actor', selectedLog.username],
                ['Action', getActionBadge(selectedLog.action)],
                ['Target Resource', `${selectedLog.resource_type}${selectedLog.resource_id ? ' #' + selectedLog.resource_id : ''}`],
                ['Client IP', <code className="font-mono">{selectedLog.ip_address || 'internal'}</code>],
                ['Timestamp', selectedLog.timestamp ? new Date(selectedLog.timestamp).toLocaleString() : '-'],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{label}:</span>
                  {typeof value === 'string' ? <strong>{value}</strong> : value}
                </div>
              ))}
              <div style={{ marginTop: 10 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Action Payload:</span>
                <pre style={{ background: 'var(--bg-terminal)', padding: 12, borderRadius: 'var(--radius-sm)', fontSize: '11.5px', color: 'var(--text-primary)', overflowX: 'auto', maxHeight: 220, fontFamily: 'var(--font-mono)' }}>
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
