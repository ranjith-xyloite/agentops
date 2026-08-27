import React, { useState, useEffect, useRef } from 'react';
import {
  Boxes,
  Terminal,
  Radio,
  Search,
  ArrowDown,
  Trash2,
  Download,
  Copy,
  Check,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { subscribeToContainerLogs } from '../services/api';

interface StandaloneContainerLogsProps {
  serverId: number;
  serverName: string;
  containerName: string;
  imageName?: string;
  containerId?: string;
}

export const StandaloneContainerLogs: React.FC<StandaloneContainerLogsProps> = ({
  serverId,
  serverName,
  containerName,
  imageName,
  containerId,
}) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [logFilterQuery, setLogFilterQuery] = useState<string>('');
  const [tailCount, setTailCount] = useState<number>(100);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [streamStatus, setStreamStatus] = useState<string>('connecting');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const unsubscribeLogRef = useRef<(() => void) | null>(null);

  // Set browser document title
  useEffect(() => {
    document.title = `[Logs] ${containerName} (${serverName}) - XyOps`;
    return () => {
      document.title = 'XyOps DevOps Platform';
    };
  }, [containerName, serverName]);

  // Connect SSE log stream
  const connectStream = () => {
    if (unsubscribeLogRef.current) {
      unsubscribeLogRef.current();
      unsubscribeLogRef.current = null;
    }

    setLogs([]);
    setStreamStatus('connecting');

    const unsubscribe = subscribeToContainerLogs(
      serverId,
      containerName,
      tailCount,
      (line: string) => {
        setLogs((prev) => [...prev, line]);
      },
      (status) => {
        if (status.type === 'connected') {
          setStreamStatus('live');
        } else if (status.type === 'error') {
          setStreamStatus(`error: ${status.message || 'Unknown'}`);
        } else if (status.type === 'disconnected') {
          setStreamStatus('disconnected');
        }
      },
      (err) => {
        setStreamStatus('error');
        console.error('SSE container log error:', err);
      }
    );

    unsubscribeLogRef.current = unsubscribe;
  };

  useEffect(() => {
    connectStream();
    return () => {
      if (unsubscribeLogRef.current) {
        unsubscribeLogRef.current();
        unsubscribeLogRef.current = null;
      }
    };
  }, [serverId, containerName, tailCount]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Download log file
  const handleDownloadLogs = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${containerName}_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredLogs = logs.filter((l) =>
    logFilterQuery ? l.toLowerCase().includes(logFilterQuery.toLowerCase()) : true
  );

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: '#010409',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Top Header */}
      <header
        style={{
          padding: '12px 20px',
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          zIndex: 10,
        }}
      >
        {/* Left: Container Metadata */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              color: '#38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Boxes size={20} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 700, fontSize: '16px', color: '#f0f6fc' }}>
                {containerName}
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: streamStatus === 'live' ? 'rgba(52, 211, 153, 0.15)' : 'rgba(248, 113, 113, 0.15)',
                  color: streamStatus === 'live' ? '#34d399' : '#f87171',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                <Radio size={12} className={streamStatus === 'live' ? 'pulse-animation' : ''} />
                <span>{streamStatus === 'live' ? 'LIVE STREAM' : streamStatus}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#8b949e', marginTop: 2 }}>
              <span>Server: <strong style={{ color: '#c9d1d9' }}>{serverName}</strong></span>
              {imageName && <span>• Image: <code style={{ color: '#79c0ff', fontFamily: 'monospace' }}>{imageName}</code></span>}
              {containerId && <span>• ID: <code style={{ color: '#8b949e', fontFamily: 'monospace' }}>{containerId}</code></span>}
            </div>
          </div>
        </div>

        {/* Right: Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Search Filter */}
          <div style={{ position: 'relative' }}>
            <Search
              size={13}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }}
            />
            <input
              type="text"
              placeholder="Filter logs..."
              value={logFilterQuery}
              onChange={(e) => setLogFilterQuery(e.target.value)}
              style={{
                padding: '6px 10px 6px 30px',
                borderRadius: 6,
                fontSize: '12px',
                background: '#0d1117',
                border: '1px solid #30363d',
                color: '#c9d1d9',
                width: 180,
                outline: 'none',
              }}
            />
          </div>

          {/* Tail Selector */}
          <select
            value={tailCount}
            onChange={(e) => setTailCount(parseInt(e.target.value, 10))}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              fontSize: '12px',
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#c9d1d9',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value={50}>50 lines</option>
            <option value={100}>100 lines</option>
            <option value={250}>250 lines</option>
            <option value={500}>500 lines</option>
            <option value={1000}>1000 lines</option>
          </select>

          {/* Auto-Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            style={{
              padding: '6px 12px',
              borderRadius: 6,
              fontSize: '12px',
              background: autoScroll ? 'rgba(56, 189, 248, 0.2)' : '#0d1117',
              border: '1px solid #30363d',
              color: autoScroll ? '#38bdf8' : '#8b949e',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontWeight: 500,
            }}
            title="Auto-scroll to latest log"
          >
            <ArrowDown size={13} />
            <span>Auto-scroll</span>
          </button>

          {/* Reconnect */}
          <button
            onClick={connectStream}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#8b949e',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '12px',
            }}
            title="Reconnect stream"
          >
            <RefreshCw size={13} />
            <span>Reconnect</span>
          </button>

          {/* Copy All */}
          <button
            onClick={() => handleCopy(logs.join('\n'), 'all_logs')}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#8b949e',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '12px',
            }}
            title="Copy logs to clipboard"
          >
            {copiedText === 'all_logs' ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
            <span>Copy</span>
          </button>

          {/* Download Logs */}
          <button
            onClick={handleDownloadLogs}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#8b949e',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '12px',
            }}
            title="Download logs as .txt"
          >
            <Download size={13} />
            <span>Download</span>
          </button>

          {/* Clear View */}
          <button
            onClick={() => setLogs([])}
            style={{
              padding: '6px 10px',
              borderRadius: 6,
              background: '#0d1117',
              border: '1px solid #30363d',
              color: '#8b949e',
              cursor: 'pointer',
            }}
            title="Clear output window"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      {/* Terminal Log Screen */}
      <div
        ref={logContainerRef}
        style={{
          flex: 1,
          padding: '16px 20px',
          overflowY: 'auto',
          fontFamily: '"Fira Code", "Cascadia Code", Consolas, Monaco, monospace',
          fontSize: '13px',
          lineHeight: '1.6',
          color: '#e6edf3',
          background: '#010409',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {logs.length === 0 ? (
          <div style={{ color: '#8b949e', padding: '40px 0', textAlign: 'center' }}>
            <Terminal size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={{ fontSize: '15px', fontWeight: 600 }}>Connected to {containerName} on {serverName}</div>
            <p style={{ fontSize: '13px', color: '#6e7681', margin: '6px 0 0 0' }}>
              Streaming live Docker logs via SSH SSE...
            </p>
          </div>
        ) : (
          filteredLogs.map((line, idx) => {
            const isErr = /error|fatal|fail|panic|exception/i.test(line);
            const isWarn = /warn|warning/i.test(line);
            const isInfo = /info|notice/i.test(line);

            let color = '#c9d1d9';
            if (isErr) color = '#ff7b72';
            else if (isWarn) color = '#d29922';
            else if (isInfo) color = '#79c0ff';

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  padding: '1px 0',
                  color,
                }}
              >
                <span
                  style={{
                    color: '#484f58',
                    userSelect: 'none',
                    minWidth: 48,
                    textAlign: 'right',
                    fontSize: '11.5px',
                  }}
                >
                  {idx + 1}
                </span>
                <span style={{ flex: 1 }}>{line}</span>
              </div>
            );
          })
        )}
        <div ref={logEndRef} />
      </div>

      {/* Footer Status Bar */}
      <footer
        style={{
          padding: '8px 20px',
          background: '#161b22',
          borderTop: '1px solid #30363d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#8b949e',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span>Total Lines: <strong style={{ color: '#c9d1d9' }}>{logs.length}</strong></span>
          {logFilterQuery && <span>Filtered: <strong style={{ color: '#38bdf8' }}>{filteredLogs.length}</strong></span>}
          <span>Buffer: {tailCount} tail + live follow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={12} />
          <span>Active SSH SSE Stream • XyOps</span>
        </div>
      </footer>
    </div>
  );
};
