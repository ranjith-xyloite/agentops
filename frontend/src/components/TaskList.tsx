import React, { useState, useMemo } from 'react';
import {
  ListTodo,
  Search,
  Play,
  XCircle,
  Terminal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
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

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Filter tasks based on search and status
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.user_request.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.intent && t.intent.toLowerCase().includes(searchTerm.toLowerCase())) ||
        String(t.id).includes(searchTerm);
      const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [tasks, searchTerm, filterStatus]);

  // Calculate pagination details
  const totalTasks = filteredTasks.length;
  const totalPages = Math.max(1, Math.ceil(totalTasks / pageSize));

  // Ensure current page is valid when totalPages changes
  const validCurrentPage = Math.min(currentPage, totalPages);

  const paginatedTasks = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * pageSize;
    return filteredTasks.slice(startIndex, startIndex + pageSize);
  }, [filteredTasks, validCurrentPage, pageSize]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

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

  const startEntry = totalTasks === 0 ? 0 : (validCurrentPage - 1) * pageSize + 1;
  const endEntry = Math.min(validCurrentPage * pageSize, totalTasks);

  // Generate visible page numbers
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (validCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (validCurrentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', validCurrentPage - 1, validCurrentPage, validCurrentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header Bar */}
      <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="panel-title">
          <ListTodo size={18} style={{ color: 'var(--accent-blue)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>Task Lifecycle & Live Operations</span>
            <span className="badge badge-primary" style={{ fontSize: '11px' }}>
              {totalTasks} {totalTasks === 1 ? 'Task' : 'Tasks'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="chat-input"
              style={{ padding: '7px 12px 7px 32px', fontSize: '12.5px', width: '230px' }}
              placeholder="Search prompt, intent, ID..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* Filter Status Chips */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        gap: 8,
        background: 'var(--bg-tertiary)',
        overflowX: 'auto',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        {['ALL', 'RUNNING', 'AWAITING_CONFIRMATION', 'SUCCESS', 'FAILED', 'CANCELLED'].map((s) => {
          const isActive = filterStatus === s;
          return (
            <button
              key={s}
              className={`prompt-chip ${isActive ? 'active' : ''}`}
              style={{
                background: isActive ? 'var(--accent-blue-subtle)' : 'var(--bg-secondary)',
                color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                borderColor: isActive ? 'var(--accent-blue)' : 'var(--border-subtle)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '11.5px',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)'
              }}
              onClick={() => handleStatusFilterChange(s)}
            >
              {s.replace('_', ' ')}
            </button>
          );
        })}
      </div>

      {/* Main Table */}
      <div className="table-container" style={{ margin: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Task ID</th>
              <th>Request & Automated Intent</th>
              <th style={{ width: '180px' }}>Lifecycle Status</th>
              <th style={{ width: '170px' }}>Created Timestamp</th>
              <th style={{ width: '150px', textAlign: 'right' }}>Execution Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedTasks.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                  <ListTodo size={28} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                  <div>No tasks matching the selected filters.</div>
                </td>
              </tr>
            ) : (
              paginatedTasks.map((t) => (
                <tr key={t.id}>
                  <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 700 }}>
                    #{t.id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                      {t.user_request}
                    </div>
                    {t.intent && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        intent: {t.intent}
                      </span>
                    )}
                  </td>
                  <td>{getStatusBadge(t.status)}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                    {t.created_at ? new Date(t.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Just now'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      {t.status === 'AWAITING_CONFIRMATION' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onConfirmTask(t.id)}
                          title="Confirm & Run Task"
                          style={{ padding: '4px 8px' }}
                        >
                          <Play size={12} />
                        </button>
                      )}
                      {['RUNNING', 'AWAITING_CONFIRMATION'].includes(t.status) && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => onCancelTask(t.id)}
                          title="Cancel Task Execution"
                          style={{ padding: '4px 8px' }}
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
                        title="Stream Terminal Logs"
                        style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '11.5px' }}
                      >
                        <Terminal size={12} />
                        <span>Stream</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: '12.5px',
        color: 'var(--text-secondary)'
      }}>
        {/* Left: Rows Per Page Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>Rows per page:</span>
          <select
            className="input-field"
            value={pageSize}
            onChange={handlePageSizeChange}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              width: '75px',
              height: '30px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>

          <span style={{ color: 'var(--text-muted)' }}>
            Showing {startEntry}-{endEntry} of {totalTasks}
          </span>
        </div>

        {/* Right: Page Navigation Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* First Page */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage(1)}
            disabled={validCurrentPage <= 1}
            title="First Page"
            style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronsLeft size={14} />
          </button>

          {/* Previous Page */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={validCurrentPage <= 1}
            title="Previous Page"
            style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={14} />
          </button>

          {/* Numbered Page Buttons */}
          <div style={{ display: 'flex', gap: 3, margin: '0 4px' }}>
            {getPageNumbers().map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} style={{ padding: '4px 6px', color: 'var(--text-muted)' }}>
                    ...
                  </span>
                );
              }
              const isCurrent = p === validCurrentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCurrentPage(Number(p))}
                  className={`btn btn-sm ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    minWidth: '28px',
                    height: '28px',
                    padding: '0 6px',
                    fontSize: '11.5px',
                    fontWeight: isCurrent ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Next Page */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={validCurrentPage >= totalPages}
            title="Next Page"
            style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronRight size={14} />
          </button>

          {/* Last Page */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={validCurrentPage >= totalPages}
            title="Last Page"
            style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>

      {/* Selected Task Details Drawer */}
      {selectedTaskDetail && selectedTaskDetail.executions && selectedTaskDetail.executions.length > 0 && (
        <div style={{ padding: 20, borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: '14px', color: 'var(--text-primary)' }}>
            <Terminal size={15} style={{ color: 'var(--accent-cyan)' }} />
            Execution Output Logs for Task #{selectedTaskDetail.id}
          </h4>
          {selectedTaskDetail.executions.map((e) => (
            <div key={e.id} style={{ background: 'var(--bg-terminal)', padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 8, border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '11.5px', color: 'var(--text-muted)' }}>
                <span>Tool: <strong style={{ color: 'var(--text-primary)' }}>{e.tool_name}</strong></span>
                <span>Status: <strong style={{ color: e.status === 'SUCCESS' ? 'var(--status-success)' : e.status === 'FAILED' ? 'var(--status-failed)' : 'var(--text-primary)' }}>{e.status}</strong></span>
              </div>
              <pre style={{ fontSize: '12px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto', fontFamily: 'var(--font-mono)' }}>
                {e.output || e.error || 'No recorded output'}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
