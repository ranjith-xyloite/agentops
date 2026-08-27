import React, { useState, useEffect, useRef } from 'react';
import {
  Boxes,
  Server as ServerIcon,
  Play,
  Square,
  RefreshCw,
  Search,
  Terminal,
  X,
  ArrowDown,
  Download,
  Trash2,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  AlertCircle,
  Clock,
  Radio,
  ExternalLink
} from 'lucide-react';
import { ServerContainers, DockerContainer } from '../types';
import { listContainersApi, subscribeToContainerLogs } from '../services/api';

interface SelectedContainerForLogs {
  serverId: number;
  serverName: string;
  container: DockerContainer;
}

export const ContainerDashboard: React.FC = () => {
  const [serversData, setServersData] = useState<ServerContainers[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedServerFilter, setSelectedServerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Live Logs Modal State
  const [logModalTarget, setLogModalTarget] = useState<SelectedContainerForLogs | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [logFilterQuery, setLogFilterQuery] = useState<string>('');
  const [tailCount, setTailCount] = useState<number>(100);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<string>('connecting');

  const logEndRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const unsubscribeLogRef = useRef<(() => void) | null>(null);

  // Fetch containers list (always fetch all servers so dropdown options and stats are preserved)
  const fetchContainers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await listContainersApi();
      setServersData(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch container statuses from servers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchContainers();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  // Handle opening live log modal
  const handleOpenLogs = (serverId: number, serverName: string, container: DockerContainer) => {
    setLogModalTarget({ serverId, serverName, container });
    setLogs([]);
    setStreamStatus('connecting');
  };

  // Close logs
  const handleCloseLogs = () => {
    if (unsubscribeLogRef.current) {
      unsubscribeLogRef.current();
      unsubscribeLogRef.current = null;
    }
    setLogModalTarget(null);
    setLogs([]);
  };

  // Setup / teardown SSE log streaming
  useEffect(() => {
    if (!logModalTarget) return;

    if (unsubscribeLogRef.current) {
      unsubscribeLogRef.current();
      unsubscribeLogRef.current = null;
    }

    setLogs([]);
    setStreamStatus('connecting');

    const unsubscribe = subscribeToContainerLogs(
      logModalTarget.serverId,
      logModalTarget.container.name,
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

    return () => {
      if (unsubscribeLogRef.current) {
        unsubscribeLogRef.current();
        unsubscribeLogRef.current = null;
      }
    };
  }, [logModalTarget, tailCount]);

  // Auto-scroll logs
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

  // Open in New Browser Tab helper
  const openInNewTab = (serverId: number, serverName: string, container: DockerContainer) => {
    const url = `/?view=container-logs&server_id=${serverId}&container=${encodeURIComponent(container.name)}&server_name=${encodeURIComponent(serverName)}&image=${encodeURIComponent(container.image)}&container_id=${encodeURIComponent(container.id)}`;
    window.open(url, '_blank');
  };

  // Download log file
  const handleDownloadLogs = () => {
    if (!logModalTarget) return;
    const blob = new Blob([logs.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${logModalTarget.container.name}_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Filter servers according to selectedServerFilter
  const filteredServers = serversData.filter((s) => {
    if (selectedServerFilter === 'all') return true;
    return String(s.server_id) === selectedServerFilter;
  });

  // Calculate dynamic contextual metrics (reflecting selected server + search query)
  let contextualContainers = 0;
  let contextualRunning = 0;
  let contextualStopped = 0;
  let contextualReachableNodes = 0;

  filteredServers.forEach((s) => {
    if (s.reachable) contextualReachableNodes++;
    (s.containers || []).forEach((c) => {
      const matchesSearch = !searchQuery || (
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.image.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.ports.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (matchesSearch) {
        contextualContainers++;
        if (c.running) contextualRunning++;
        else contextualStopped++;
      }
    });
  });

  const filteredLogs = logs.filter((l) =>
    logFilterQuery ? l.toLowerCase().includes(logFilterQuery.toLowerCase()) : true
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header Panel */}
      <div className="card-panel" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              className="brand-icon"
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2), rgba(59, 130, 246, 0.2))',
                border: '1px solid rgba(6, 182, 212, 0.4)',
                color: '#06b6d4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Boxes size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h1 style={{ fontSize: '20px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                  Container Fleet & Live Logs
                </h1>
                <span className="badge badge-info" style={{ fontSize: '11px', textTransform: 'uppercase', padding: '3px 8px' }}>
                  Docker Engine
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                Multi-server container inventory with real-time SSE streaming logs directly over SSH
                {lastRefreshed && <span> • Updated {lastRefreshed}</span>}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '12px',
                color: autoRefresh ? 'var(--status-success)' : 'var(--text-muted)',
                cursor: 'pointer',
                background: 'var(--surface-hover)',
                padding: '6px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                style={{ accentColor: 'var(--status-success)' }}
              />
              <span>Auto-refresh (10s)</span>
            </label>

            <button
              className="btn btn-secondary"
              onClick={fetchContainers}
              disabled={isLoading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '13px', padding: '7px 14px' }}
            >
              <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
              <span>{isLoading ? 'Scanning...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Metric Cards Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 14,
            marginTop: 20,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                {selectedServerFilter !== 'all' ? 'Server Containers' : 'Total Containers'}
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: 2 }}>
                {contextualContainers}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8' }}>
              <Boxes size={20} />
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Running</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399', marginTop: 2 }}>
                {contextualRunning}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}>
              <Play size={20} />
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Stopped / Exited</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: contextualStopped > 0 ? '#f87171' : 'var(--text-muted)', marginTop: 2 }}>
                {contextualStopped}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(248, 113, 113, 0.1)', color: '#f87171' }}>
              <Square size={20} />
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Selected Nodes</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#38bdf8', marginTop: 2 }}>
                {contextualReachableNodes} / {filteredServers.length}
              </div>
            </div>
            <div style={{ padding: 10, borderRadius: 10, background: 'rgba(168, 85, 247, 0.1)', color: '#c084fc' }}>
              <ServerIcon size={20} />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260 }}>
            {/* Search Input */}
            <div className="search-input-wrapper" style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search container name, image, ports..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 8,
                  fontSize: '13px',
                  background: 'var(--bg-input, var(--bg-card))',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: 10,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Server Selector Dropdown (Always contains all servers) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ServerIcon size={14} style={{ color: 'var(--text-muted)' }} />
              <select
                value={selectedServerFilter}
                onChange={(e) => setSelectedServerFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: '13px',
                  background: 'var(--bg-card)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <option value="all">All Servers ({serversData.length})</option>
                {serversData.map((s) => (
                  <option key={s.server_id} value={String(s.server_id)}>
                    {s.server_name} ({s.hostname})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Tabs */}
          <div
            style={{
              display: 'flex',
              background: 'var(--surface-hover)',
              padding: '3px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
            }}
          >
            {(['all', 'running', 'stopped'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                style={{
                  background: statusFilter === tab ? 'var(--bg-card)' : 'transparent',
                  color: statusFilter === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 6,
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  boxShadow: statusFilter === tab ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab === 'all'
                  ? `All (${contextualContainers})`
                  : tab === 'running'
                  ? `Running (${contextualRunning})`
                  : `Stopped (${contextualStopped})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {error && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#f87171',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '13px',
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Server & Container Cards */}
      {filteredServers.length === 0 && !isLoading ? (
        <div className="card-panel" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Boxes size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px 0' }}>No Servers or Containers Found</h3>
          <p style={{ fontSize: '13px', margin: 0 }}>Check your Server Fleet configuration to ensure SSH nodes are registered.</p>
        </div>
      ) : (
        filteredServers.map((server) => {
          const visibleContainers = (server.containers || []).filter((c) => {
            if (statusFilter === 'running' && !c.running) return false;
            if (statusFilter === 'stopped' && c.running) return false;
            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              return (
                c.name.toLowerCase().includes(q) ||
                c.image.toLowerCase().includes(q) ||
                c.id.toLowerCase().includes(q) ||
                c.ports.toLowerCase().includes(q)
              );
            }
            return true;
          });

          return (
            <div key={server.server_id} className="card-panel" style={{ padding: '0', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
              {/* Server Header bar */}
              <div
                style={{
                  padding: '14px 20px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: server.reachable ? '#34d399' : '#f87171',
                      boxShadow: server.reachable ? '0 0 8px #34d399' : 'none',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                      {server.server_name}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      ({server.hostname})
                    </span>
                  </div>
                  <span
                    className={`badge badge-${server.environment.toLowerCase() === 'production' ? 'danger' : 'info'}`}
                    style={{ fontSize: '11px', textTransform: 'uppercase' }}
                  >
                    {server.environment}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {visibleContainers.length} container{visibleContainers.length === 1 ? '' : 's'}
                  </span>
                  {!server.reachable && (
                    <span className="badge badge-danger" style={{ fontSize: '11px' }}>
                      Unreachable: {server.error || 'SSH Failed'}
                    </span>
                  )}
                </div>
              </div>

              {/* Containers List / Grid */}
              <div style={{ padding: '16px 20px' }}>
                {visibleContainers.length === 0 ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {server.reachable
                      ? searchQuery || statusFilter !== 'all'
                        ? 'No containers match the current filter on this server.'
                        : 'No Docker containers found running or stopped on this server.'
                      : 'Unable to connect to server via SSH.'}
                  </div>
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
                      gap: 16,
                    }}
                  >
                    {visibleContainers.map((container) => {
                      return (
                        <div
                          key={container.id + container.name}
                          style={{
                            background: '#161b22',
                            border: container.running
                              ? '1.5px solid rgba(52, 211, 153, 0.45)'
                              : '1.5px solid rgba(248, 113, 113, 0.45)',
                            boxShadow: container.running
                              ? '0 4px 14px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(52, 211, 153, 0.1)'
                              : '0 4px 14px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(248, 113, 113, 0.1)',
                            borderRadius: 12,
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            gap: 12,
                            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          }}
                        >
                          {/* Container Top Info */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                <div
                                  style={{
                                    width: 9,
                                    height: 9,
                                    borderRadius: '50%',
                                    background: container.running ? '#34d399' : '#f87171',
                                    boxShadow: container.running ? '0 0 8px rgba(52, 211, 153, 0.8)' : 'none',
                                    flexShrink: 0,
                                  }}
                                />
                                <span
                                  style={{
                                    fontWeight: 700,
                                    fontSize: '14.5px',
                                    color: '#f0f6fc',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={container.name}
                                >
                                  {container.name}
                                </span>
                              </div>

                              <button
                                onClick={() => handleCopy(container.id, container.id)}
                                title="Copy Container ID"
                                style={{
                                  background: 'rgba(255, 255, 255, 0.06)',
                                  border: '1px solid rgba(255, 255, 255, 0.15)',
                                  borderRadius: 6,
                                  padding: '3px 7px',
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  color: '#8b949e',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  cursor: 'pointer',
                                  flexShrink: 0,
                                }}
                              >
                                {copiedText === container.id ? <Check size={11} color="#34d399" /> : <Copy size={11} />}
                                {container.id}
                              </button>
                            </div>

                            {/* Image name */}
                            <div
                              style={{
                                fontSize: '12px',
                                color: '#8b949e',
                                marginTop: 8,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontFamily: 'monospace',
                              }}
                              title={container.image}
                            >
                              📦 {container.image}
                            </div>

                            {/* Status and Ports */}
                            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
                                <span style={{ color: '#8b949e' }}>Status:</span>
                                <span
                                  style={{
                                    color: container.running ? '#34d399' : '#f87171',
                                    fontWeight: 600,
                                  }}
                                >
                                  {container.status}
                                </span>
                              </div>

                              {container.ports && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 6,
                                    fontSize: '11.5px',
                                    color: '#8b949e',
                                    marginTop: 2,
                                  }}
                                >
                                  <span>Ports:</span>
                                  <span
                                    style={{
                                      fontFamily: 'monospace',
                                      color: '#38bdf8',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                    }}
                                    title={container.ports}
                                  >
                                    {container.ports}
                                  </span>
                                </div>
                              )}

                              {container.created_at && (
                                <div style={{ fontSize: '11px', color: '#6e7681', marginTop: 2 }}>
                                  Created: {container.created_at}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons: Live Logs & Open in New Tab */}
                          <div
                            style={{
                              paddingTop: 12,
                              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 8,
                            }}
                          >
                            <button
                              className="btn btn-primary"
                              onClick={() => handleOpenLogs(server.server_id, server.server_name, container)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: '12px',
                                padding: '6px 14px',
                                background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                                border: 'none',
                                color: '#fff',
                                borderRadius: 6,
                                fontWeight: 600,
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.4)',
                              }}
                            >
                              <Terminal size={13} />
                              <span>Live Logs</span>
                            </button>

                            <button
                              onClick={() => openInNewTab(server.server_id, server.server_name, container)}
                              title="Open live logs in new browser tab"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 32,
                                height: 32,
                                borderRadius: 6,
                                background: 'rgba(56, 189, 248, 0.12)',
                                border: '1px solid rgba(56, 189, 248, 0.3)',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              <ExternalLink size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* ========================================================= */}
      {/* Live Log Stream Modal */}
      {/* ========================================================= */}
      {logModalTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMaximized ? 0 : 20,
          }}
        >
          <div
            style={{
              width: isMaximized ? '100vw' : '92vw',
              maxWidth: isMaximized ? '100vw' : 1200,
              height: isMaximized ? '100vh' : '88vh',
              background: '#0d1117',
              border: isMaximized ? 'none' : '1px solid #30363d',
              borderRadius: isMaximized ? 0 : 12,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '12px 18px',
                background: '#161b22',
                borderBottom: '1px solid #30363d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 8px',
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

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#f0f6fc' }}>
                      {logModalTarget.container.name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#8b949e' }}>
                      on {logModalTarget.serverName}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#8b949e', fontFamily: 'monospace' }}>
                    Image: {logModalTarget.container.image} | ID: {logModalTarget.container.id}
                  </div>
                </div>
              </div>

              {/* Header Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Search within logs */}
                <div style={{ position: 'relative' }}>
                  <Search
                    size={13}
                    style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }}
                  />
                  <input
                    type="text"
                    placeholder="Filter logs..."
                    value={logFilterQuery}
                    onChange={(e) => setLogFilterQuery(e.target.value)}
                    style={{
                      padding: '5px 8px 5px 28px',
                      borderRadius: 6,
                      fontSize: '12px',
                      background: '#0d1117',
                      border: '1px solid #30363d',
                      color: '#c9d1d9',
                      width: 160,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Tail line count */}
                <select
                  value={tailCount}
                  onChange={(e) => setTailCount(parseInt(e.target.value, 10))}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    fontSize: '12px',
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#c9d1d9',
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                  title="Number of initial tail lines"
                >
                  <option value={50}>50 lines</option>
                  <option value={100}>100 lines</option>
                  <option value={250}>250 lines</option>
                  <option value={500}>500 lines</option>
                </select>

                {/* Auto-scroll toggle */}
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: '12px',
                    background: autoScroll ? 'rgba(56, 189, 248, 0.2)' : '#0d1117',
                    border: '1px solid #30363d',
                    color: autoScroll ? '#38bdf8' : '#8b949e',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                  title="Auto scroll to bottom"
                >
                  <ArrowDown size={13} />
                  <span>Auto-scroll</span>
                </button>

                {/* Clear local logs */}
                <button
                  onClick={() => setLogs([])}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    cursor: 'pointer',
                  }}
                  title="Clear console window"
                >
                  <Trash2 size={13} />
                </button>

                {/* Download logs */}
                <button
                  onClick={handleDownloadLogs}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    cursor: 'pointer',
                  }}
                  title="Download logs to text file"
                >
                  <Download size={13} />
                </button>

                {/* Open in New Tab Button */}
                <button
                  onClick={() => openInNewTab(logModalTarget.serverId, logModalTarget.serverName, logModalTarget.container)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#38bdf8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    fontSize: '12px',
                    fontWeight: 500,
                  }}
                  title="Open live logs in new browser tab to monitor simultaneously"
                >
                  <ExternalLink size={13} />
                  <span>New Tab</span>
                </button>

                {/* Maximize toggle */}
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    cursor: 'pointer',
                  }}
                  title={isMaximized ? 'Restore size' : 'Maximize'}
                >
                  {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>

                {/* Close modal */}
                <button
                  onClick={handleCloseLogs}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 6,
                    background: 'rgba(248, 113, 113, 0.15)',
                    border: '1px solid rgba(248, 113, 113, 0.3)',
                    color: '#f87171',
                    cursor: 'pointer',
                  }}
                  title="Close logs"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Modal Body: Log Terminal Screen */}
            <div
              ref={logContainerRef}
              style={{
                flex: 1,
                padding: '16px',
                overflowY: 'auto',
                fontFamily: '"Fira Code", "Cascadia Code", Consolas, Monaco, monospace',
                fontSize: '12.5px',
                lineHeight: '1.6',
                color: '#e6edf3',
                background: '#010409',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logs.length === 0 ? (
                <div style={{ color: '#8b949e', padding: '20px 0', textAlign: 'center' }}>
                  <Terminal size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <div>Connected. Awaiting container log output...</div>
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
                        gap: 12,
                        padding: '1px 0',
                        color,
                      }}
                    >
                      <span
                        style={{
                          color: '#484f58',
                          userSelect: 'none',
                          minWidth: 42,
                          textAlign: 'right',
                          fontSize: '11px',
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

            {/* Modal Footer status bar */}
            <div
              style={{
                padding: '8px 18px',
                background: '#161b22',
                borderTop: '1px solid #30363d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: '#8b949e',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span>Lines: {logs.length}</span>
                {logFilterQuery && <span>Filtered: {filteredLogs.length}</span>}
                <span>Buffer: {tailCount} tail + live follow</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={11} />
                <span>Active SSE Connection</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
