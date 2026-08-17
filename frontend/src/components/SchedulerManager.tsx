import React, { useState, useEffect } from 'react';
import {
  CalendarClock, Plus, Trash2, Power, Clock,
  RefreshCw, CheckCircle2, AlertCircle, Play
} from 'lucide-react';
import { ScheduledTask } from '../types';
import { listSchedulesApi, createScheduleApi, deleteScheduleApi, toggleScheduleApi } from '../services/api';

export const SchedulerManager: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 2 * * *');
  const [userRequest, setUserRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadSchedules = async () => {
    setIsLoading(true);
    try {
      const data = await listSchedulesApi();
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !cronExpression || !userRequest) return;

    setIsSubmitting(true);
    try {
      await createScheduleApi({
        name,
        cron_expression: cronExpression,
        user_request: userRequest,
        is_active: true
      });
      setName('');
      setUserRequest('');
      setShowAddModal(false);
      await loadSchedules();
    } catch (err: any) {
      alert(err.message || 'Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: number) => {
    try {
      await toggleScheduleApi(id);
      await loadSchedules();
    } catch (err: any) {
      alert('Failed to toggle schedule status');
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to remove this recurring schedule?')) {
      try {
        await deleteScheduleApi(id);
        await loadSchedules();
      } catch (err: any) {
        alert('Failed to delete schedule');
      }
    }
  };

  const applyPreset = (presetName: string, cron: string, prompt: string) => {
    setName(presetName);
    setCronExpression(cron);
    setUserRequest(prompt);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Panel */}
      <div className="card-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="brand-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--accent-blue)' }}>
              <CalendarClock size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700 }}>Cron & Recurring Task Scheduler</h2>
                <span className="badge badge-running" style={{ fontSize: '11px' }}>
                  AUTONOMOUS ENGINE
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Configure recurring background operations, automated nightly backups, and scheduled health sweeps.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={loadSchedules} disabled={isLoading}>
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
              Refresh
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
              <Plus size={14} />
              Create Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Schedule Name</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Cron Expression</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>AI Natural Language Prompt</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Last Run</th>
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No scheduled cron tasks configured. Click "Create Schedule" or use presets above.
                </td>
              </tr>
            ) : (
              schedules.map((s) => (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Clock size={14} style={{ color: 'var(--accent-blue)' }} />
                      {s.name}
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <code className="font-mono" style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent-cyan)' }}>
                      {s.cron_expression}
                    </code>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>
                    "{s.user_request}"
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    {s.last_run_at ? new Date(s.last_run_at).toLocaleString() : 'Never'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className={`badge ${s.is_active ? 'badge-success' : 'badge-failed'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {s.is_active ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                      {s.is_active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleToggle(s.id)}
                        title={s.is_active ? 'Pause Schedule' : 'Activate Schedule'}
                        style={{ padding: '4px 8px' }}
                      >
                        <Power size={12} style={{ color: s.is_active ? 'var(--status-warning)' : 'var(--status-success)' }} />
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDelete(s.id)}
                        title="Delete Schedule"
                        style={{ padding: '4px 8px', color: 'var(--status-failed)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add Schedule Modal */}
      {showAddModal && (
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
            maxWidth: '560px',
            padding: 24,
            boxShadow: 'var(--shadow-lg)'
          }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 14 }}>Create Scheduled Recurring Task</h3>

            {/* Quick Presets */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                QUICK PRESET TEMPLATES
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px' }}
                  onClick={() => applyPreset('Nightly Fleet Health Scan', '0 2 * * *', 'Run server health checks on production')}
                >
                  <Play size={10} /> Nightly Health (02:00 UTC)
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px' }}
                  onClick={() => applyPreset('Hourly Docker Audit', '0 * * * *', 'Inspect docker container status on production')}
                >
                  <Play size={10} /> Hourly Docker Check
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Schedule Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Nightly Production Health Check"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                  Cron Expression <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(e.g. `0 2 * * *` or `@hourly`)</span>
                </label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="0 2 * * *"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                  Natural Language Prompt to Execute
                </label>
                <textarea
                  className="input-field"
                  rows={3}
                  placeholder="e.g. Run server health checks on production"
                  value={userRequest}
                  onChange={(e) => setUserRequest(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
