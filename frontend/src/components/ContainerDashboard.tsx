import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  ExternalLink,
  Tag,
  Plus,
  Hash
} from 'lucide-react';
import { ServerContainers, DockerContainer } from '../types';
import { listContainersApi, subscribeToContainerLogs, addContainerTagApi, removeContainerTagApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface SelectedContainerForLogs {
  serverId: number;
  serverName: string;
  container: DockerContainer;
}

export const ContainerDashboard: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const [serversData, setServersData] = useState<ServerContainers[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedServerFilter, setSelectedServerFilter] = useState<string>('all');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(false);

  // Inline Tag Input State
  const [tagInputTarget, setTagInputTarget] = useState<{ serverId: number; containerName: string } | null>(null);
  const [newTagText, setNewTagText] = useState<string>('');
  const [isTagSubmitting, setIsTagSubmitting] = useState<boolean>(false);

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
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Fetch containers list
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

  // Focus tag input when opened
  useEffect(() => {
    if (tagInputTarget && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [tagInputTarget]);

  // Extract all unique tags across fleet
  const allAvailableTags = useMemo(() => {
    const tagSet = new Set<string>();
    serversData.forEach((s) => {
      (s.containers || []).forEach((c) => {
        (c.tags || []).forEach((t) => tagSet.add(t));
      });
    });
    return Array.from(tagSet).sort();
  }, [serversData]);

  // Add Tag Handler (Admin only)
  const handleAddTag = async (serverId: number, containerName: string) => {
    if (!newTagText.trim()) return;
    setIsTagSubmitting(true);
    const tagClean = newTagText.trim();
    try {
      await addContainerTagApi(serverId, containerName, tagClean);
      // Optimistically update state
      setServersData((prev) =>
        prev.map((s) => {
          if (s.server_id !== serverId) return s;
          return {
            ...s,
            containers: (s.containers || []).map((c) => {
              if (c.name !== containerName) return c;
              const currentTags = c.tags || [];
              if (currentTags.includes(tagClean)) return c;
              return { ...c, tags: [...currentTags, tagClean] };
            }),
          };
        })
      );
      setNewTagText('');
      setTagInputTarget(null);
    } catch (err: any) {
      alert(`Failed to add tag: ${err?.message || err}`);
    } finally {
      setIsTagSubmitting(false);
    }
  };

  // Remove Tag Handler (Admin only)
  const handleRemoveTag = async (serverId: number, containerName: string, tag: string) => {
    try {
      await removeContainerTagApi(serverId, containerName, tag);
      setServersData((prev) =>
        prev.map((s) => {
          if (s.server_id !== serverId) return s;
          return {
            ...s,
            containers: (s.containers || []).map((c) => {
              if (c.name !== containerName) return c;
              return { ...c, tags: (c.tags || []).filter((t) => t !== tag) };
            }),
          };
        })
      );
    } catch (err: any) {
      alert(`Failed to remove tag: ${err?.message || err}`);
    }
  };

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

  // Calculate dynamic contextual metrics (reflecting selected server + tag + search query)
  let contextualContainers = 0;
  let contextualRunning = 0;
  let contextualStopped = 0;
  let contextualReachableNodes = 0;

  filteredServers.forEach((s) => {
    if (s.reachable) contextualReachableNodes++;
    (s.containers || []).forEach((c) => {
      const matchesTag = selectedTagFilter === 'all' || (c.tags && c.tags.includes(selectedTagFilter));
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || (
        c.name.toLowerCase().includes(q) ||
        c.image.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.ports.toLowerCase().includes(q) ||
        (c.tags && c.tags.some(t => t.toLowerCase().includes(q)))
      );
      if (matchesTag && matchesSearch) {
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
                Multi-server container inventory with custom categorization tags and real-time SSE streaming logs
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
                {selectedServerFilter !== 'all' || selectedTagFilter !== 'all' ? 'Filtered Containers' : 'Total Containers'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 260, flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div className="search-input-wrapper" style={{ position: 'relative', flex: 1, minWidth: 220, maxWidth: 360 }}>
              <Search
                size={15}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Search container, tag, image, port..."
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

            {/* Server Selector Dropdown */}
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

            {/* Tag / Category Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Tag size={14} style={{ color: 'var(--accent-purple)' }} />
              <select
                value={selectedTagFilter}
                onChange={(e) => setSelectedTagFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  fontSize: '13px',
                  background: 'var(--bg-card)',
                  border: selectedTagFilter !== 'all' ? '1px solid var(--accent-purple)' : '1px solid var(--border-color)',
                  color: selectedTagFilter !== 'all' ? 'var(--accent-purple)' : 'var(--text-primary)',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                <option value="all">All Tags ({allAvailableTags.length})</option>
                {allAvailableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    🏷️ {tag}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Tag filter if set */}
            {selectedTagFilter !== 'all' && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedTagFilter('all')}
                style={{ fontSize: '11px', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <X size={12} /> Clear Tag
              </button>
            )}
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

        {/* Quick Tag Chips Row (if any tags exist) */}
        {allAvailableTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Hash size={12} /> Categories:
            </span>
            <button
              onClick={() => setSelectedTagFilter('all')}
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: 12,
                border: '1px solid',
                borderColor: selectedTagFilter === 'all' ? 'var(--accent-blue)' : 'var(--border-subtle)',
                background: selectedTagFilter === 'all' ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-tertiary)',
                color: selectedTagFilter === 'all' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: selectedTagFilter === 'all' ? 700 : 500,
              }}
            >
              All
            </button>
            {allAvailableTags.map((tag) => {
              const isSelected = selectedTagFilter === tag;
              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTagFilter(isSelected ? 'all' : tag)}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: 12,
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--accent-purple)' : 'rgba(168, 85, 247, 0.25)',
                    background: isSelected ? 'rgba(168, 85, 247, 0.3)' : 'rgba(168, 85, 247, 0.08)',
                    color: isSelected ? '#e9d5ff' : '#c084fc',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span>#{tag}</span>
                </button>
              );
            })}
          </div>
        )}
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
            if (selectedTagFilter !== 'all' && (!c.tags || !c.tags.includes(selectedTagFilter))) return false;
            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              return (
                c.name.toLowerCase().includes(q) ||
                c.image.toLowerCase().includes(q) ||
                c.id.toLowerCase().includes(q) ||
                c.ports.toLowerCase().includes(q) ||
                (c.tags && c.tags.some(t => t.toLowerCase().includes(q)))
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
                      ? searchQuery || statusFilter !== 'all' || selectedTagFilter !== 'all'
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
                      const isAddingTagToThis = tagInputTarget?.serverId === server.server_id && tagInputTarget?.containerName === container.name;

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

                            {/* Tags Section */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                              {(container.tags || []).map((t) => (
                                <span
                                  key={t}
                                  style={{
                                    fontSize: '11px',
                                    padding: '2px 8px',
                                    borderRadius: 6,
                                    background: 'rgba(168, 85, 247, 0.15)',
                                    border: '1px solid rgba(168, 85, 247, 0.35)',
                                    color: '#c084fc',
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <span
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedTagFilter(t)}
                                    title={`Filter by tag: ${t}`}
                                  >
                                    🏷️ {t}
                                  </span>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleRemoveTag(server.server_id, container.name, t)}
                                      title="Remove tag"
                                      style={{
                                        background: 'none',
                                        border: 'none',
                                        color: 'rgba(255, 255, 255, 0.5)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                      }}
                                    >
                                      <X size={11} />
                                    </button>
                                  )}
                                </span>
                              ))}

                              {/* Admin Add Tag Button / Input */}
                              {isAdmin && !isAddingTagToThis && (
                                <button
                                  onClick={() => {
                                    setTagInputTarget({ serverId: server.server_id, containerName: container.name });
                                    setNewTagText('');
                                  }}
                                  style={{
                                    fontSize: '10.5px',
                                    padding: '2px 7px',
                                    borderRadius: 6,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px dashed rgba(255, 255, 255, 0.25)',
                                    color: '#8b949e',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                  }}
                                  title="Add project or category tag"
                                >
                                  <Plus size={11} /> Tag
                                </button>
                              )}

                              {isAdmin && isAddingTagToThis && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <input
                                    ref={tagInputRef}
                                    type="text"
                                    placeholder="e.g. backend, payment"
                                    value={newTagText}
                                    onChange={(e) => setNewTagText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddTag(server.server_id, container.name);
                                      } else if (e.key === 'Escape') {
                                        setTagInputTarget(null);
                                      }
                                    }}
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '11px',
                                      borderRadius: 4,
                                      background: '#0d1117',
                                      border: '1px solid var(--accent-purple)',
                                      color: '#f0f6fc',
                                      outline: 'none',
                                      width: '120px',
                                    }}
                                  />
                                  <button
                                    onClick={() => handleAddTag(server.server_id, container.name)}
                                    disabled={isTagSubmitting || !newTagText.trim()}
                                    style={{
                                      background: 'var(--accent-purple)',
                                      border: 'none',
                                      borderRadius: 4,
                                      color: '#fff',
                                      padding: '2px 6px',
                                      fontSize: '10.5px',
                                      cursor: 'pointer',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Add
                                  </button>
                                  <button
                                    onClick={() => setTagInputTarget(null)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#8b949e',
                                      cursor: 'pointer',
                                      padding: '2px',
                                    }}
                                  >
                                    <X size={12} />
                                  </button>
                                </div>
                              )}
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
                  <Radio size={12} className={streamStatus === 'live' ? 'pulse-live' : ''} />
                  <span>{streamStatus === 'live' ? 'LIVE STREAM' : streamStatus}</span>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: '15px', color: '#f0f6fc' }}>
                      {logModalTarget.container.name}
                    </span>
                    <span style={{ fontSize: '12px', color: '#8b949e' }}>
                      ({logModalTarget.serverName})
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#6e7681', fontFamily: 'monospace' }}>
                    {logModalTarget.container.image} • ID: {logModalTarget.container.id}
                  </div>
                </div>
              </div>

              {/* Header Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Popout New Tab */}
                <button
                  onClick={() => openInNewTab(logModalTarget.serverId, logModalTarget.serverName, logModalTarget.container)}
                  title="Open live logs in new browser tab"
                  style={{
                    background: 'rgba(56, 189, 248, 0.12)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    color: '#38bdf8',
                    padding: '5px 10px',
                    borderRadius: 6,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  <ExternalLink size={13} />
                  <span>Open in Tab</span>
                </button>

                {/* Tail Count Selector */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: '#8b949e' }}>
                  <Clock size={13} />
                  <select
                    value={tailCount}
                    onChange={(e) => setTailCount(Number(e.target.value))}
                    style={{
                      background: '#0d1117',
                      border: '1px solid #30363d',
                      color: '#f0f6fc',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: '12px',
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value={50}>Last 50 lines</option>
                    <option value={100}>Last 100 lines</option>
                    <option value={250}>Last 250 lines</option>
                    <option value={500}>Last 500 lines</option>
                    <option value={1000}>Last 1000 lines</option>
                  </select>
                </div>

                {/* Log Search */}
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#8b949e' }} />
                  <input
                    type="text"
                    placeholder="Filter logs..."
                    value={logFilterQuery}
                    onChange={(e) => setLogFilterQuery(e.target.value)}
                    style={{
                      background: '#0d1117',
                      border: '1px solid #30363d',
                      color: '#f0f6fc',
                      padding: '4px 8px 4px 26px',
                      borderRadius: 6,
                      fontSize: '12px',
                      width: 140,
                      outline: 'none',
                    }}
                  />
                  {logFilterQuery && (
                    <button
                      onClick={() => setLogFilterQuery('')}
                      style={{
                        position: 'absolute',
                        right: 6,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: '#8b949e',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Auto Scroll toggle */}
                <button
                  onClick={() => setAutoScroll(!autoScroll)}
                  title={autoScroll ? 'Auto-scroll is ON' : 'Auto-scroll is OFF'}
                  style={{
                    background: autoScroll ? 'rgba(52, 211, 153, 0.15)' : '#0d1117',
                    border: autoScroll ? '1px solid rgba(52, 211, 153, 0.3)' : '1px solid #30363d',
                    color: autoScroll ? '#34d399' : '#8b949e',
                    padding: '5px 9px',
                    borderRadius: 6,
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <ArrowDown size={12} />
                  <span>Auto-scroll</span>
                </button>

                {/* Copy logs */}
                <button
                  onClick={() => handleCopy(logs.join('\n'), 'logs')}
                  title="Copy full logs"
                  style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    padding: '5px 9px',
                    borderRadius: 6,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {copiedText === 'logs' ? <Check size={12} color="#34d399" /> : <Copy size={12} />}
                  <span>{copiedText === 'logs' ? 'Copied' : 'Copy'}</span>
                </button>

                {/* Download logs */}
                <button
                  onClick={handleDownloadLogs}
                  title="Download logs as text"
                  style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    padding: '5px 9px',
                    borderRadius: 6,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Download size={12} />
                </button>

                {/* Clear buffer */}
                <button
                  onClick={() => setLogs([])}
                  title="Clear log viewer"
                  style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    padding: '5px 9px',
                    borderRadius: 6,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Trash2 size={12} />
                </button>

                {/* Maximize / Restore */}
                <button
                  onClick={() => setIsMaximized(!isMaximized)}
                  title={isMaximized ? 'Restore window size' : 'Maximize window'}
                  style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#8b949e',
                    padding: '5px 9px',
                    borderRadius: 6,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>

                {/* Close modal */}
                <button
                  onClick={handleCloseLogs}
                  title="Close viewer"
                  style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    color: '#f87171',
                    padding: '5px 9px',
                    borderRadius: 6,
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div
              ref={logContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 20px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                fontSize: '12.5px',
                lineHeight: 1.65,
                background: '#090d13',
                color: '#e6edf3',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap',
              }}
            >
              {filteredLogs.length === 0 ? (
                <div style={{ color: '#6e7681', textAlign: 'center', padding: '60px 0' }}>
                  {streamStatus === 'connecting' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <RefreshCw size={24} className="spin-animation" style={{ color: '#38bdf8' }} />
                      <span>Connecting to SSH live stream for {logModalTarget.container.name}...</span>
                    </div>
                  ) : logFilterQuery ? (
                    <span>No log lines matching "{logFilterQuery}"</span>
                  ) : (
                    <span>Streaming active. Waiting for container log output...</span>
                  )}
                </div>
              ) : (
                filteredLogs.map((line, idx) => {
                  const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('err') || line.toLowerCase().includes('fatal');
                  const isWarn = line.toLowerCase().includes('warn');
                  const isInfo = line.toLowerCase().includes('info');

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        padding: '1px 0',
                        color: isError ? '#f87171' : isWarn ? '#fbbf24' : isInfo ? '#38bdf8' : '#c9d1d9',
                      }}
                    >
                      <span
                        style={{
                          userSelect: 'none',
                          color: '#484f58',
                          fontSize: '11px',
                          minWidth: '40px',
                          textAlign: 'right',
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

            {/* Terminal Status Bar */}
            <div
              style={{
                padding: '8px 18px',
                background: '#161b22',
                borderTop: '1px solid #30363d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: '#8b949e',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span>
                  Lines buffered: <strong style={{ color: '#f0f6fc' }}>{logs.length}</strong>
                  {logFilterQuery && ` (Matching: ${filteredLogs.length})`}
                </span>
                <span>
                  Target Node: <strong style={{ color: '#f0f6fc' }}>{logModalTarget.serverName}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: streamStatus === 'live' ? '#34d399' : '#f87171',
                  }}
                />
                <span>SSE Protocol Connected</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
