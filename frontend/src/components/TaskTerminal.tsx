import React, { useEffect, useRef, useState } from 'react';
import { Terminal as TerminalIcon, Copy, Trash2, StopCircle } from 'lucide-react';
import { Task, TaskStatus } from '../types';

interface TaskTerminalProps {
  activeTaskId: number | null;
  activeTask: Task | null;
  logs: string[];
  currentStatus: TaskStatus | null;
  onCancelTask: (taskId: number) => void;
  onClearLogs: () => void;
}

export const TaskTerminal: React.FC<TaskTerminalProps> = ({
  activeTaskId,
  activeTask,
  logs,
  currentStatus,
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
          {getStatusBadge(currentStatus || activeTask?.status || null)}
        </div>

        <div className="panel-actions">
          {currentStatus === 'RUNNING' && activeTaskId && (
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

      <div className="terminal-view">
        {logs.length === 0 ? (
          <div className="terminal-empty-state">
            <TerminalIcon size={32} />
            <p>No active execution stream. Issue a command from the AI Console to view real-time logs.</p>
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
