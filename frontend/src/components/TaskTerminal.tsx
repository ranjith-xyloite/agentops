import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Copy, Trash2, StopCircle, Play, XCircle, AlertTriangle } from 'lucide-react';
import { Task, TaskStatus } from '../types';

interface TaskTerminalProps {
  activeTaskId: number | null;
  activeTask: Task | null;
  logs: string[];
  currentStatus: TaskStatus | null;
  onConfirmTask?: (taskId: number) => Promise<void> | void;
  onCancelTask: (taskId: number) => void;
  onClearLogs: () => void;
}

export const TaskTerminal: React.FC<TaskTerminalProps> = ({
  activeTaskId,
  activeTask,
  logs,
  currentStatus,
  onConfirmTask,
  onCancelTask,
  onClearLogs,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const effectiveStatus = currentStatus || activeTask?.status || null;

  const getStatusBadge = (status: TaskStatus | null) => {
    if (!status) return null;
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
          <TerminalIcon size={18} style={{ color: '#06b6d4' }} />
          <span>
            Execution Stream {activeTaskId ? `#${activeTaskId}` : ''}
          </span>
          {getStatusBadge(effectiveStatus)}
        </div>

        <div className="panel-actions">
          {effectiveStatus === 'AWAITING_CONFIRMATION' && activeTaskId && onConfirmTask && (
            <button
              className="btn btn-primary btn-sm"
              style={{ background: '#10b981', color: '#0f172a', fontWeight: 700, border: 'none' }}
              onClick={() => onConfirmTask(activeTaskId)}
              title="Confirm and execute this deployment on the server"
            >
              <Play size={13} fill="#0f172a" />
              Confirm & Execute
            </button>
          )}

          {effectiveStatus === 'RUNNING' && activeTaskId && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => onCancelTask(activeTaskId)}
              title="Abort running execution"
            >
              <StopCircle size={13} />
              Abort
            </button>
          )}

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleCopy}
            disabled={logs.length === 0}
            title="Copy logs"
          >
            <Copy size={13} />
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onClearLogs}
            disabled={logs.length === 0}
            title="Clear output"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Prominent Confirmation Banner */}
      {effectiveStatus === 'AWAITING_CONFIRMATION' && activeTaskId && (
        <div style={{
          padding: '12px 18px',
          background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15) 0%, rgba(16, 185, 129, 0.15) 100%)',
          borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fbbf24', fontSize: '13px', fontWeight: 500 }}>
            <AlertTriangle size={17} />
            <span>Safety Gate: Task #{activeTaskId} requires operator confirmation to execute commands on the remote node.</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onCancelTask(activeTaskId)}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              <XCircle size={13} /> Cancel
            </button>
            {onConfirmTask && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onConfirmTask(activeTaskId)}
                style={{
                  background: '#10b981',
                  color: '#0f172a',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '6px 14px',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Play size={13} fill="#0f172a" /> Confirm & Execute Now
              </button>
            )}
          </div>
        </div>
      )}

      <div className="terminal-view">
        {logs.length === 0 ? (
          <div className="terminal-empty-state">
            <TerminalIcon size={32} />
            <p>No active execution stream. Issue a command from the AI Console or click Deploy to view real-time logs.</p>
          </div>
        ) : (
          logs.map((line, idx) => (
            <div key={idx} className="terminal-log-line">
              <span className="terminal-ts">[{idx + 1}]</span>
              <span className="terminal-text">{line}</span>
            </div>
          ))
        )}
        <div ref={terminalEndRef} />
      </div>
    </div>
  );
};
