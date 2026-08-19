import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarClock, Plus, Trash2, Power, Clock,
  RefreshCw, CheckCircle2, AlertCircle, Play,
  FolderGit2, Activity, GitBranch, Layers, Rocket,
  Sparkles, X, Search
} from 'lucide-react';
import { ScheduledTask, Project, Environment } from '../types';
import {
  listSchedulesApi,
  createScheduleApi,
  deleteScheduleApi,
  toggleScheduleApi,
  runScheduleApi,
  listProjects,
  listEnvironments
} from '../services/api';
import { PaginationControls } from './PaginationControls';

interface SchedulerManagerProps {
  projects?: Project[];
  environments?: Environment[];
}

export const SchedulerManager: React.FC<SchedulerManagerProps> = ({
  projects: propProjects,
  environments: propEnvironments,
}) => {
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>(propProjects || []);
  const [environments, setEnvironments] = useState<Environment[]>(propEnvironments || []);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal Mode: 'workflow' (Deploy Hub style) or 'custom' (Freeform Prompt)
  const [scheduleMode, setScheduleMode] = useState<'workflow' | 'custom'>('workflow');

  // Workflow Selection State (Deploy Hub Style)
  const [selectedProjectId, setSelectedProjectId] = useState<number>(0);
  const [selectedEnvId, setSelectedEnvId] = useState<number>(0);
  const [selectedComponent, setSelectedComponent] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');

  // Form General State
  const [name, setName] = useState('');
  const [cronExpression, setCronExpression] = useState('0 2 * * *');
  const [userRequest, setUserRequest] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [runningScheduleId, setRunningScheduleId] = useState<number | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

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

  // Load auxiliary data if not provided in props
  useEffect(() => {
    if (!propProjects || propProjects.length === 0) {
      listProjects().then(setProjects).catch(console.error);
    } else {
      setProjects(propProjects);
    }

    if (!propEnvironments || propEnvironments.length === 0) {
      listEnvironments().then(setEnvironments).catch(console.error);
    } else {
      setEnvironments(propEnvironments);
    }
  }, [propProjects, propEnvironments]);

  useEffect(() => {
    loadSchedules();
  }, []);

  // Initialize selected project and environment
  useEffect(() => {
    if (projects.length > 0 && (!selectedProjectId || !projects.some(p => p.id === selectedProjectId))) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects]);

  useEffect(() => {
    if (environments.length > 0 && (!selectedEnvId || !environments.some(e => e.id === selectedEnvId))) {
      setSelectedEnvId(environments[0].id);
    }
  }, [environments]);

  const filteredSchedules = useMemo(() => {
    if (!searchTerm.trim()) return schedules;
    const term = searchTerm.toLowerCase();
    return schedules.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.user_request.toLowerCase().includes(term) ||
        s.cron_expression.toLowerCase().includes(term) ||
        String(s.id).includes(term)
    );
  }, [schedules, searchTerm]);

  const paginatedSchedules = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredSchedules.slice(start, start + pageSize);
  }, [filteredSchedules, currentPage, pageSize]);

  const activeProject = projects.find((p) => p.id === selectedProjectId);
  const activeEnv = environments.find((e) => e.id === selectedEnvId);
  const envName = activeEnv?.name ? activeEnv.name.toUpperCase() : 'UAT';
  const availableFlows = (activeProject?.deployments || []).filter(
    (d) => d.environment_id === selectedEnvId
  );

  // Auto-generate Schedule Name and User Request prompt when in Workflow mode
  useEffect(() => {
    if (scheduleMode === 'workflow' && activeProject && activeEnv) {
      const componentLabel = selectedComponent === 'ALL' ? 'Full Stack' : selectedComponent;
      const genName = `Scheduled Deploy: ${activeProject.name} (${componentLabel}) → ${envName}`;
      setName(genName);

      const promptTarget = selectedComponent === 'ALL' ? 'all' : selectedComponent;
      const genPrompt = `Deploy ${activeProject.name} ${promptTarget} branch ${selectedBranch} to ${activeEnv.name.toLowerCase()}`;
      setUserRequest(genPrompt);
    }
  }, [scheduleMode, selectedProjectId, selectedEnvId, selectedComponent, selectedBranch, activeProject, activeEnv, envName]);

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
      setActionSuccessMsg(`Schedule "${name}" created successfully!`);
      setTimeout(() => setActionSuccessMsg(null), 4000);
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

  const handleRunNow = async (schedule: ScheduledTask) => {
    setRunningScheduleId(schedule.id);
    try {
      await runScheduleApi(schedule.id);
      setActionSuccessMsg(`Triggered execution for schedule: "${schedule.name}"! Check AI Console or Tasks tab.`);
      await loadSchedules();
      setTimeout(() => setActionSuccessMsg(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to trigger schedule execution');
    } finally {
      setRunningScheduleId(null);
    }
  };

  const applyPreset = (presetName: string, cron: string, prompt: string) => {
    setScheduleMode('custom');
    setName(presetName);
    setCronExpression(cron);
    setUserRequest(prompt);
  };

  const cronFrequencies = [
    { label: 'Every 15 Mins', cron: '*/15 * * * *', desc: 'Frequent poll / sync' },
    { label: 'Hourly', cron: '0 * * * *', desc: 'At minute 0 of every hour' },
    { label: 'Nightly (02:00 UTC)', cron: '0 2 * * *', desc: 'Off-peak scheduled deployment' },
    { label: 'Daily (09:00 UTC)', cron: '0 9 * * *', desc: 'Morning release cycle' },
    { label: 'Weekly (Mon 00:00)', cron: '0 0 * * 1', desc: 'Weekly production refresh' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Action Notification Alert */}
      {actionSuccessMsg && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--status-success-bg)',
          border: '1px solid var(--status-success)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--status-success)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: '13px',
          fontWeight: 500,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="card-panel" style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="brand-icon" style={{ background: 'var(--accent-blue-subtle)', color: 'var(--accent-blue)' }}>
              <CalendarClock size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)' }}>Autonomous Workflow & Cron Scheduler</h2>
                <span className="badge badge-running" style={{ fontSize: '11px' }}>
                  AUTONOMOUS ENGINE
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>
                Schedule automated deployment workflows across your environments, nightly production releases, and health audits.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="chat-input"
                style={{ padding: '6px 12px 6px 30px', fontSize: '12px', width: '200px' }}
                placeholder="Search schedules..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
            </div>

            <button className="btn btn-secondary btn-sm" onClick={loadSchedules} disabled={isLoading}>
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
              Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setScheduleMode('workflow');
                setShowAddModal(true);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />
              Schedule Workflow
            </button>
          </div>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="card-panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="table-container" style={{ margin: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Scheduled Operation</th>
                <th style={{ width: '18%' }}>Cron Cadence</th>
                <th style={{ width: '27%' }}>AI Pipeline Command</th>
                <th style={{ width: '12%' }}>Last Run</th>
                <th style={{ width: '10%' }}>Status</th>
                <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedSchedules.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <CalendarClock size={32} style={{ opacity: 0.4, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Scheduled Tasks Found</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: 12 }}>
                      {searchTerm ? 'No schedules match your search query.' : 'Automate deployment flows or maintenance routines with custom cron schedules.'}
                    </p>
                    {!searchTerm && (
                      <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                        <Plus size={13} /> Schedule Workflow Now
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedSchedules.map((s) => {
                  const isRunningThis = runningScheduleId === s.id;
                  const isDeployTask = s.user_request.toLowerCase().startsWith('deploy');
                  return (
                    <tr key={s.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            padding: 5,
                            borderRadius: 'var(--radius-sm)',
                            background: isDeployTask ? 'var(--accent-blue-subtle)' : 'var(--bg-tertiary)',
                            color: isDeployTask ? 'var(--accent-blue)' : 'var(--text-secondary)'
                          }}>
                            {isDeployTask ? <Rocket size={14} /> : <Clock size={14} />}
                          </div>
                          <div>
                            <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                              {s.name}
                            </strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Schedule #{s.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <code className="font-mono" style={{ background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent-cyan)', fontSize: '12px', width: 'fit-content' }}>
                            {s.cron_expression}
                          </code>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {cronFrequencies.find(f => f.cron === s.cron_expression)?.label || 'Custom Cron Schedule'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="font-mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          "{s.user_request}"
                        </span>
                      </td>
                      <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                        {s.last_run_at ? new Date(s.last_run_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never Run'}
                      </td>
                      <td>
                        <span className={`badge ${s.is_active ? 'badge-success' : 'badge-danger'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {s.is_active ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                          {s.is_active ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleRunNow(s)}
                            disabled={isRunningThis}
                            title="Run Schedule Immediately (Trigger Pipeline Now)"
                            style={{ padding: '4px 8px' }}
                          >
                            <Play size={12} style={{ color: 'var(--status-success)' }} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleToggle(s.id)}
                            title={s.is_active ? 'Pause Schedule' : 'Activate Schedule'}
                            style={{ padding: '4px 8px' }}
                          >
                            <Power size={12} style={{ color: s.is_active ? 'var(--status-warning)' : 'var(--status-success)' }} />
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(s.id)}
                            title="Delete Schedule"
                            style={{ padding: '4px 8px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <PaginationControls
          currentPage={currentPage}
          totalItems={filteredSchedules.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          itemLabel="scheduled flows"
        />
      </div>

      {/* Add / Configure Schedule Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7, 10, 17, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: 16
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setShowAddModal(false);
        }}
        >
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '640px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 24,
            boxShadow: 'var(--shadow-lg)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <CalendarClock size={20} style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Schedule Autonomous Task / Workflow
                  </h3>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Configure automated deployment pipelines or periodic maintenance runs
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowAddModal(false)}
                style={{ padding: '4px 8px' }}
              >
                <X size={15} />
              </button>
            </div>

            {/* Mode Toggle Tabs */}
            <div style={{
              display: 'flex',
              gap: 6,
              background: 'var(--bg-tertiary)',
              padding: 4,
              borderRadius: 'var(--radius-md)',
              marginBottom: 18
            }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setScheduleMode('workflow')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: scheduleMode === 'workflow' ? 'var(--bg-secondary)' : 'transparent',
                  color: scheduleMode === 'workflow' ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  boxShadow: scheduleMode === 'workflow' ? 'var(--shadow-sm)' : 'none',
                  fontWeight: scheduleMode === 'workflow' ? 600 : 500,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px'
                }}
              >
                <Rocket size={14} />
                1. Workflow Deployment Flow (Deploy Hub Style)
              </button>

              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setScheduleMode('custom')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: scheduleMode === 'custom' ? 'var(--bg-secondary)' : 'transparent',
                  color: scheduleMode === 'custom' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  boxShadow: scheduleMode === 'custom' ? 'var(--shadow-sm)' : 'none',
                  fontWeight: scheduleMode === 'custom' ? 600 : 500,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: '8px'
                }}
              >
                <Sparkles size={14} />
                2. Custom Prompt / Maintenance Ops
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Workflow Selection Options (Deploy Hub Style) */}
              {scheduleMode === 'workflow' && (
                <div style={{
                  padding: '16px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Rocket size={13} /> Select Workflow Deployment Targets
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                    {/* Project Workspace Dropdown */}
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <FolderGit2 size={13} style={{ color: 'var(--accent-cyan)' }} /> Project Workspace
                      </label>
                      <select
                        className="chat-input"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(Number(e.target.value))}
                      >
                        {projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.description ? `(${p.description})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Environment Dropdown */}
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Activity size={13} style={{ color: 'var(--accent-blue)' }} /> Target Environment
                      </label>
                      <select
                        className="chat-input"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                        value={selectedEnvId}
                        onChange={(e) => setSelectedEnvId(Number(e.target.value))}
                      >
                        {environments.map((env) => (
                          <option key={env.id} value={env.id}>
                            {env.name.toUpperCase()} {env.name.toLowerCase() === 'prod' || env.name.toLowerCase() === 'production' ? '— (Production)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Component Flow Dropdown */}
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <Layers size={13} style={{ color: 'var(--accent-purple)' }} /> Component Service
                      </label>
                      <select
                        className="chat-input"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                        value={selectedComponent}
                        onChange={(e) => setSelectedComponent(e.target.value)}
                      >
                        <option value="ALL">All Components (Full Stack Deploy)</option>
                        {availableFlows.map((f) => (
                          <option key={f.id} value={f.component}>
                            {f.component} Service ({f.deployment_script || './deploy.sh'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Git Branch Selector */}
                    <div>
                      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <GitBranch size={13} style={{ color: '#fbbf24' }} /> Target Branch
                      </label>
                      <select
                        className="chat-input"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                      >
                        <option value="main">main (production ready)</option>
                        <option value="master">master</option>
                        <option value="staging">staging</option>
                        <option value="qa">qa (integration test)</option>
                        <option value="dev">dev (active development)</option>
                        <option value="release">release</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Presets for Custom Ops */}
              {scheduleMode === 'custom' && (
                <div style={{
                  padding: '12px 14px',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    QUICK MAINTENANCE PRESETS
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
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '11px' }}
                      onClick={() => applyPreset('Daily Database Backup', '0 3 * * *', 'Run database backup on production')}
                    >
                      <Play size={10} /> Daily DB Backup
                    </button>
                  </div>
                </div>
              )}

              {/* Frequency / Cron Helper Chips */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                  Execution Cadence & Frequency
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {cronFrequencies.map((f) => (
                    <button
                      key={f.cron}
                      type="button"
                      onClick={() => setCronExpression(f.cron)}
                      className="prompt-chip"
                      style={{
                        background: cronExpression === f.cron ? 'var(--accent-blue-subtle)' : 'var(--bg-tertiary)',
                        borderColor: cronExpression === f.cron ? 'var(--accent-blue)' : 'var(--border-subtle)',
                        color: cronExpression === f.cron ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        fontWeight: cronExpression === f.cron ? 600 : 400
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder="0 2 * * *"
                    value={cronExpression}
                    onChange={(e) => setCronExpression(e.target.value)}
                    required
                    style={{ flex: 1 }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 4 }}>
                  Standard 5-part cron format: (Minute Hour Day-of-Month Month Day-of-Week)
                </div>
              </div>

              {/* Schedule Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Schedule Name / Label *
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Nightly Production Deploy or Hourly Health Sweep"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              {/* Natural Language Prompt */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Autonomous Agent Prompt / Pipeline Action *
                </label>
                <textarea
                  className="input-field font-mono"
                  rows={2}
                  placeholder="e.g. Deploy mom frontend branch main to uat"
                  value={userRequest}
                  onChange={(e) => setUserRequest(e.target.value)}
                  required
                  style={{ fontSize: '12.5px' }}
                />
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating Schedule...' : 'Save Scheduled Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
