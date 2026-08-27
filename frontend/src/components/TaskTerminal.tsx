import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Terminal as TerminalIcon,
  Copy,
  Trash2,
  StopCircle,
  Play,
  XCircle,
  AlertTriangle,
  Download,
  Search,
  ArrowDown,
  Maximize2,
  Minimize2,
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { Task, TaskStatus } from '../types';
import { useAuth } from '../context/AuthContext';

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
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const terminalContainerRef = useRef<HTMLDivElement>(null);

  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const effectiveStatus = currentStatus || activeTask?.status || null;
  const isRunning = effectiveStatus === 'RUNNING';

  // Elapsed timer while RUNNING
  useEffect(() => {
    let timer: any = null;
    if (isRunning) {
      const startTime = Date.now();
      timer = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, activeTaskId]);

  // Auto-scroll when logs change if autoScroll is enabled
  useEffect(() => {
    if (autoScroll) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Handle user manual scroll
  const handleScroll = () => {
    if (!terminalContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    if (isAtBottom !== autoScroll) {
      setAutoScroll(isAtBottom);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(logs.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `agentops-task-${activeTaskId || 'live'}-logs.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getStatusBadge = (status: TaskStatus | null) => {
    if (!status) return null;
    switch (status) {
      case 'RUNNING':
        return (
          <span className="badge badge-running" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px' }}>
            <span className="live-radar-dot" />
            RUNNING
          </span>
        );
      case 'SUCCESS':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px' }}>
            <CheckCircle2 size={12} /> SUCCESS
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px' }}>
            <AlertCircle size={12} /> FAILED
          </span>
        );
      case 'CANCELLED':
        return <span className="badge badge-warning">CANCELLED</span>;
      case 'ROLLED_BACK':
        return <span className="badge badge-warning" style={{ background: '#7c3aed', color: '#fff' }}>ROLLED BACK</span>;
      case 'AWAITING_CONFIRMATION':
        return <span className="badge badge-warning">AWAITING CONFIRMATION</span>;
      default:
        return <span className="badge badge-pending">{status}</span>;
    }
  };

  // Filtered log lines
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) {
      return logs.map((text, index) => ({ text, index }));
    }
    const q = searchQuery.toLowerCase();
    return logs
      .map((text, index) => ({ text, index }))
      .filter((item) => item.text.toLowerCase().includes(q));
  }, [logs, searchQuery]);

  // Syntax classifier for log lines
  const renderLogLine = (rawLine: string, originalIndex: number) => {
    const line = rawLine.trimStart();
    const isStep = line.startsWith('▶') || line.startsWith('🚀') || line.startsWith('🔨') || line.startsWith('📂') || line.startsWith('📡') || line.startsWith('⚡') || line.startsWith('🩺');
    const isError = line.includes('❌') || line.includes('[stderr]') || line.toLowerCase().includes('failed') || line.toLowerCase().includes('error:') || line.toLowerCase().includes('fatal:') || line.includes('[System Error]');
    const isSuccess = line.includes('✔') || line.includes('✅') || line.includes('🎉') || line.includes('PASSED') || line.toLowerCase().includes('successfully');
    const isWarning = line.includes('⚠️') || line.toLowerCase().includes('warning:');
    const isSystem = line.startsWith('[System]') || line.startsWith('Safety Gate:');

    let lineClass = 'terminal-text';
    let lineStyle: React.CSSProperties = {};

    if (isStep) {
      lineClass += ' log-step-header';
      lineStyle = { color: '#38bdf8', fontWeight: 600, background: 'rgba(56, 189, 248, 0.08)', padding: '2px 6px', borderRadius: 4 };
    } else if (isError) {
      lineClass += ' log-error';
      lineStyle = { color: '#f87171', background: 'rgba(239, 68, 68, 0.08)', padding: '1px 6px', borderRadius: 3 };
    } else if (isSuccess) {
      lineClass += ' log-success';
      lineStyle = { color: '#34d399', fontWeight: 500 };
    } else if (isWarning) {
      lineClass += ' log-warning';
      lineStyle = { color: '#fbbf24' };
    } else if (isSystem) {
      lineClass += ' log-system';
      lineStyle = { color: '#a78bfa', fontStyle: 'italic' };
    }

    return (
      <div key={originalIndex} className="terminal-log-line" style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span className="terminal-ts" style={{ color: '#475569', fontSize: '11px', userSelect: 'none', minWidth: '45px', textAlign: 'right' }}>
          {originalIndex + 1}
        </span>
        <span className={lineClass} style={{ flex: 1, wordBreak: 'break-word', ...lineStyle }}>
          {rawLine}
        </span>
      </div>
    );
  };

  return (
    <div className={`card-panel ${isFullScreen ? 'terminal-fullscreen' : ''}`} style={isFullScreen ? {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      borderRadius: 0,
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      maxHeight: '100vh',
      margin: 0
    } : {}}>
      {/* Header Bar */}
      <div className="panel-header" style={{ padding: '12px 18px' }}>
        <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(6, 182, 212, 0.1)',
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(6, 182, 212, 0.25)'
          }}>
            <TerminalIcon size={16} style={{ color: '#06b6d4' }} />
            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
              Execution Stream {activeTaskId ? `#${activeTaskId}` : ''}
            </span>
          </div>

          {getStatusBadge(effectiveStatus)}

          {isRunning && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: '#38bdf8',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '2px 8px',
              borderRadius: '12px',
              border: '1px solid rgba(56, 189, 248, 0.3)'
            }}>
              <Clock size={12} /> {formatDuration(elapsedSeconds)}
            </span>
          )}

          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {logs.length} {logs.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        {/* Action Controls */}
        <div className="panel-actions" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

          {/* Search Toggle / Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={13} style={{ position: 'absolute', left: 8, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 8px 4px 26px',
                fontSize: '11.5px',
                color: 'var(--text-primary)',
                width: searchQuery ? 140 : 100,
                transition: 'width 0.2s ease',
                outline: 'none'
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 6,
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: 0
                }}
              >
                &times;
              </button>
            )}
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleCopy}
            disabled={logs.length === 0}
            title="Copy all logs to clipboard"
          >
            <Copy size={13} />
            {copied ? 'Copied!' : 'Copy'}
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDownload}
            disabled={logs.length === 0}
            title="Download raw logs file"
          >
            <Download size={13} />
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsFullScreen(!isFullScreen)}
            title={isFullScreen ? 'Exit full screen' : 'Expand full screen'}
          >
            {isFullScreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>

          {isAdmin && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onClearLogs}
              disabled={logs.length === 0}
              title="Clear output terminal (Admin only)"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Safety Gate Confirmation Banner */}
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

      {/* Active task details subtitle if available */}
      {activeTask && (
        <div style={{
          padding: '6px 18px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '11.5px',
          color: 'var(--text-secondary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>Target Request:</span>
            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{activeTask.user_request}</span>
          </div>
          {activeTask.intent && (
            <span className="badge badge-primary" style={{ fontSize: '10px' }}>
              {activeTask.intent}
            </span>
          )}
        </div>
      )}

      {/* Terminal Output Viewport */}
      <div
        ref={terminalContainerRef}
        onScroll={handleScroll}
        className="terminal-view"
        style={{
          flex: 1,
          position: 'relative',
          maxHeight: isFullScreen ? 'calc(100vh - 120px)' : '520px',
          overflowY: 'auto'
        }}
      >
        {logs.length === 0 ? (
          <div className="terminal-empty-state">
            <TerminalIcon size={36} style={{ color: 'var(--accent-cyan)', opacity: 0.6 }} />
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
              No active execution stream. Trigger a deployment from 1-Click Hub or issue a command in AI Console.
            </p>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Real-time SSH stdout/stderr will stream live in this window like GitHub Actions.
            </span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '12.5px' }}>
            No log lines matching &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          filteredLogs.map(({ text, index }) => renderLogLine(text, index))
        )}

        {/* Live streaming blinking cursor */}
        {isRunning && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, color: '#38bdf8', fontSize: '12px' }}>
            <span className="live-radar-dot" />
            <span className="font-mono" style={{ opacity: 0.85 }}>Streaming live remote output...</span>
          </div>
        )}

        <div ref={terminalEndRef} />
      </div>

      {/* Floating Resume Auto-Scroll Button */}
      {!autoScroll && logs.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          style={{
            position: 'absolute',
            bottom: 20,
            right: 24,
            background: 'var(--accent-blue)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '20px',
            padding: '6px 14px',
            fontSize: '11.5px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          <ArrowDown size={13} /> Auto-Scroll to Latest
        </button>
      )}
    </div>
  );
};
