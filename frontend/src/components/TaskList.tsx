import React, { useState } from 'react';
import { ListTodo, Search, Play, XCircle, Terminal } from 'lucide-react';
import { Task, TaskStatus } from '../types';

interface TaskListProps {
  tasks: Task[];
  onSelectTask: (taskId: number) => void;
  onConfirmTask: (taskId: number) => void;
  onCancelTask: (taskId: number) => void;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onSelectTask,
  onConfirmTask,
  onCancelTask,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [selectedTaskDetail, setSelectedTaskDetail] = useState<Task | null>(null);

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.user_request.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.intent && t.intent.toLowerCase().includes(searchTerm.toLowerCase())) ||
      String(t.id).includes(searchTerm);
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'RUNNING':
        return <span className="badge badge-running">RUNNING</span>;
      case 'SUCCESS':
        return <span className="badge badge-success">SUCCESS</span>;
      case 'FAILED':
        return <span className="badge badge-danger">FAILED</span>;
      case 'CANCELLED':
        return <span className="badge badge-warning">CANCELLED</span>;
      case 'AWAITING_CONFIRMATION':
        return <span className="badge badge-warning">AWAITING CONFIRMATION</span>;
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div className="panel-title">
          <ListTodo size={18} style={{ color: '#3b82f6' }} />
          <span>Task Lifecycle & Audit History</span>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="chat-input"
              style={{ padding: '6px 10px 6px 30px', fontSize: '12px', width: '220px' }}
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#64748b' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 8 }}>
        {['ALL', 'AWAITING_CONFIRMATION', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            className={`prompt-chip ${filterStatus === s ? 'active' : ''}`}
            style={filterStatus === s ? { background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)', borderColor: 'var(--accent-blue)' } : {}}
            onClick={() => setFilterStatus(s)}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Request & Intent</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  No tasks match the filter criteria.
                </td>
              </tr>
            ) : (
              filteredTasks.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                    #{t.id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{t.user_request}</div>
                    {t.intent && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        tool: {t.intent}
                      </span>
                    )}
                  </td>
                  <td>{getStatusBadge(t.status)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleString() : 'Just now'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {t.status === 'AWAITING_CONFIRMATION' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onConfirmTask(t.id)}
                          title="Confirm & Run"
                        >
                          <Play size={12} />
                        </button>
                      )}
                      {['RUNNING', 'AWAITING_CONFIRMATION'].includes(t.status) && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => onCancelTask(t.id)}
                          title="Cancel Task"
                        >
                          <XCircle size={12} />
                        </button>
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setSelectedTaskDetail(t);
                          onSelectTask(t.id);
                        }}
                        title="View Live Stream"
                      >
                        <Terminal size={12} />
                        Stream
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTaskDetail && selectedTaskDetail.executions && selectedTaskDetail.executions.length > 0 && (
        <div style={{ padding: 20, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={15} style={{ color: 'var(--accent-cyan)' }} />
            Execution Output for Task #{selectedTaskDetail.id}
          </h4>
          {selectedTaskDetail.executions.map((e) => (
            <div key={e.id} style={{ background: 'var(--bg-terminal)', padding: 12, borderRadius: 6, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Tool: <strong style={{ color: 'var(--text-primary)' }}>{e.tool_name}</strong></span>
                <span>Status: <strong>{e.status}</strong></span>
              </div>
              <pre style={{ fontSize: '12px', color: '#cbd5e1', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                {e.output || e.error || 'No recorded output'}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
