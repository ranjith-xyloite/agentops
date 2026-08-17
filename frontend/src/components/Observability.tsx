import React, { useState, useEffect } from 'react';
import {
  Activity, CheckCircle2, Database, Gauge,
  RefreshCw, Cpu, Server, Code2
} from 'lucide-react';
import { ObservabilityData } from '../types';
import { getObservabilityDataApi, getRawPrometheusMetricsApi } from '../services/api';

export const Observability: React.FC = () => {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [rawMetrics, setRawMetrics] = useState<string | null>(null);
  const [showRawMetrics, setShowRawMetrics] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const res = await getObservabilityDataApi();
      setData(res);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to fetch observability data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchRawMetrics = async () => {
    try {
      const text = await getRawPrometheusMetricsApi();
      setRawMetrics(text);
      setShowRawMetrics(true);
    } catch (err) {
      alert('Failed to fetch raw metrics endpoint');
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Bar */}
      <div className="card-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="brand-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-success)' }}>
              <Activity size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Production Observability & Telemetry</h2>
                <span className="badge badge-success" style={{ fontSize: '11px' }}>
                  PROMETHEUS ACTIVE
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Kubernetes Liveness/Readiness, Connection Pool Metrics & Request Tracing (Refreshed: {lastRefreshed || 'Just now'})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleFetchRawMetrics}>
              <Code2 size={13} />
              Raw /api/metrics
            </button>

            <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Key Telemetry Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {/* Kubernetes Health & Probes */}
        <div className="card-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--accent-blue)', fontWeight: 600, fontSize: '14px' }}>
            <Cpu size={17} />
            <span>Kubernetes Probes</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Liveness Probe</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>GET /api/health/live</div>
              </div>
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} /> {data?.k8s_probes.liveness || 'PASSING'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600 }}>Readiness Probe</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>GET /api/health/ready</div>
              </div>
              <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle2 size={11} /> {data?.k8s_probes.readiness || 'PASSING'}
              </span>
            </div>
          </div>
        </div>

        {/* Database Connection Pool */}
        <div className="card-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--accent-cyan)', fontWeight: 600, fontSize: '14px' }}>
            <Database size={17} />
            <span>PostgreSQL Connection Pool</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>DB Ping Latency</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--status-success)', marginTop: 2 }}>
                {data?.database.latency_ms ?? 0} <span style={{ fontSize: '12px', fontWeight: 500 }}>ms</span>
              </div>
            </div>

            <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Pool Status</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: 4, textTransform: 'uppercase' }}>
                {data?.database.status || 'CONNECTED'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Max Pool Size: 20</span>
            <span>Max Overflow: 10</span>
            <span>Pre-Ping: Enabled</span>
          </div>
        </div>

        {/* Task Reliability & SLA */}
        <div className="card-panel" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--accent-purple)', fontWeight: 600, fontSize: '14px' }}>
            <Gauge size={17} />
            <span>Task Reliability & SLA</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Execution Success Rate</div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-success)' }}>
                {data?.metrics.success_rate_percent ?? 100}%
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Total Executions</div>
              <div style={{ fontSize: '18px', fontWeight: 700 }}>
                {data?.metrics.total_tasks ?? 0}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-success" style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}>
              {data?.metrics.success_tasks ?? 0} Success
            </span>
            <span className="badge badge-failed" style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}>
              {data?.metrics.failed_tasks ?? 0} Failed
            </span>
            <span className="badge badge-running" style={{ flex: 1, textAlign: 'center', justifyContent: 'center' }}>
              {data?.metrics.running_tasks ?? 0} Running
            </span>
          </div>
        </div>
      </div>

      {/* Production Hardening & Architecture Info Card */}
      <div className="card-panel" style={{ padding: 20 }}>
        <div className="panel-title" style={{ marginBottom: 12 }}>
          <Server size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>Production Hardening Architecture</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ background: 'var(--bg-primary)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-blue)', marginBottom: 4 }}>Structured JSON Logs</div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Outputs standard JSON with ISO-8601 timestamps, loglevel, module name, and automatic correlation ID binding.
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--accent-cyan)', marginBottom: 4 }}>Distributed Tracing</div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Injects <code className="font-mono" style={{ color: 'var(--accent-cyan)' }}>X-Request-ID</code> / <code className="font-mono" style={{ color: 'var(--accent-cyan)' }}>X-Correlation-ID</code> in every HTTP response.
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--status-warning)', marginBottom: 4 }}>Adaptive Rate Limiter</div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Sliding-window IP rate limiter enforcing 180 req/min general and 30 req/min for authentication protection.
            </p>
          </div>

          <div style={{ background: 'var(--bg-primary)', padding: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--status-success)', marginBottom: 4 }}>Security Headers</div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
              Enforces <code className="font-mono" style={{ color: 'var(--status-success)' }}>nosniff</code>, <code className="font-mono" style={{ color: 'var(--status-success)' }}>DENY</code>, and HSTS headers.
            </p>
          </div>
        </div>
      </div>

      {/* Raw Prometheus Metrics Inspector Drawer */}
      {showRawMetrics && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7, 10, 17, 0.85)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '750px',
            padding: 24,
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} style={{ color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Prometheus Metrics Stream (/api/metrics)</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowRawMetrics(false)}>Close</button>
            </div>

            <pre style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: 14,
              maxHeight: '400px',
              overflowY: 'auto',
              fontSize: '11.5px',
              color: 'var(--accent-cyan)',
              fontFamily: 'monospace'
            }}>
              {rawMetrics || 'Loading Prometheus metrics...'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
