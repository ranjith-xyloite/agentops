import React, { useState } from 'react';
import {
  Rocket, Play, CheckCircle2, AlertCircle, RefreshCw, Server,
  FolderGit2, Layers, Activity, GitBranch,
  Terminal, ShieldAlert, ExternalLink, HelpCircle
} from 'lucide-react';
import { Project, Environment, Server as ServerType, PreflightCheckResult, Task } from '../types';
import { runPreflightCheckApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DeploymentHubProps {
  projects: Project[];
  environments: Environment[];
  servers: ServerType[];
  tasks: Task[];
  onTriggerDeploy: (projectName: string, component: string, env: string) => void;
  onSelectTaskToStream?: (taskId: number) => void;
  onNavigateToWorkflows?: () => void;
}

export const DeploymentHub: React.FC<DeploymentHubProps> = ({
  projects,
  environments,
  servers,
  tasks,
  onTriggerDeploy,
  onSelectTaskToStream,
  onNavigateToWorkflows,
}) => {
  const { role } = useAuth();
  const isOperator = role === 'operator' || role === 'admin';

  // Selection States
  const [selectedProjectId, setSelectedProjectId] = useState<number>(projects[0]?.id || 1);
  const [selectedEnvId, setSelectedEnvId] = useState<number>(environments[0]?.id || 1);
  const [selectedBranch, setSelectedBranch] = useState<string>('main');

  // Pre-flight check state per component
  const [preflightResults, setPreflightResults] = useState<Record<string, PreflightCheckResult>>({});
  const [checkingComponent, setCheckingComponent] = useState<string | null>(null);

  // Active Project & Environment Objects
  const activeProject = projects.find((p) => p.id === Number(selectedProjectId)) || projects[0];
  const activeEnvironment = environments.find((e) => e.id === Number(selectedEnvId)) || environments[0];

  // Configured flows for this Project & Environment
  const activeFlows = (activeProject?.deployments || []).filter(
    (d) => d.environment_id === activeEnvironment?.id
  );

  const envName = activeEnvironment?.name?.toUpperCase() || 'UAT';
  const isProd = envName.toLowerCase().includes('prod');
  const isUat = envName.toLowerCase().includes('uat');
  const isDev = envName.toLowerCase().includes('dev');
  const envBadgeClass = isProd ? 'badge-warning' : isUat ? 'badge-success' : isDev ? 'badge-primary' : 'badge-info';

  const handleRunPreflight = async (component: string) => {
    if (!activeProject || !activeEnvironment) return;
    setCheckingComponent(component);
    try {
      const res = await runPreflightCheckApi({
        project_id: activeProject.id,
        environment_id: activeEnvironment.id,
        component,
      });
      setPreflightResults((prev) => ({ ...prev, [component]: res }));
    } catch (err: any) {
      setPreflightResults((prev) => ({
        ...prev,
        [component]: {
          success: false,
          server_reachable: false,
          details: [err.message || 'Preflight check failed to reach target server.'],
        },
      }));
    } finally {
      setCheckingComponent(null);
    }
  };

  const handleDeployAll = () => {
    if (!isOperator) return;
    if (activeFlows.length === 0) return;
    if (window.confirm(`Trigger batch deployment for ALL ${activeFlows.length} component flows on ${envName}?`)) {
      activeFlows.forEach((flow) => {
        onTriggerDeploy(activeProject.name, flow.component, activeEnvironment.name);
      });
    }
  };

  // Recent task executions for this project & environment
  const relevantTasks = tasks.filter((t) => {
    const req = t.user_request.toLowerCase();
    const projMatch = activeProject ? req.includes(activeProject.name.toLowerCase()) : false;
    const envMatch = activeEnvironment ? req.includes(activeEnvironment.name.toLowerCase()) : false;
    return projMatch || envMatch;
  }).slice(0, 5);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Main Deployment Selector Panel */}
      <div className="card-panel">
        <div className="panel-header">
          <div className="panel-title">
            <Rocket size={18} style={{ color: 'var(--status-success)' }} />
            <span>1-Click Deployment Hub</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className={`badge ${envBadgeClass}`} style={{ fontSize: '11px', fontWeight: 700 }}>
              {envName} ACTIVE
            </span>
            {!isOperator && (
              <span className="badge badge-pending" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ShieldAlert size={12} /> READ-ONLY
              </span>
            )}
          </div>
        </div>

        {/* Dropdown Selection Toolbar */}
        <div style={{
          padding: '24px 28px',
          background: 'var(--bg-tertiary)',
          borderBottom: '1px solid var(--border-subtle)'
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            {/* Project Selection Dropdown */}
            <div>
              <label style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent-cyan)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <FolderGit2 size={15} /> 1. Select Project
              </label>
              <select
                className="chat-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
                }}
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(Number(e.target.value));
                  setPreflightResults({});
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.description ? `— ${p.description}` : ''}
                  </option>
                ))}
              </select>
              {activeProject?.repository_url && (
                <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ExternalLink size={11} /> {activeProject.repository_url}
                </div>
              )}
            </div>

            {/* Environment Selection Dropdown */}
            <div>
              <label style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent-blue)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <Activity size={15} /> 2. Target Environment
              </label>
              <select
                className="chat-input"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '13.5px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
                }}
                value={selectedEnvId}
                onChange={(e) => {
                  setSelectedEnvId(Number(e.target.value));
                  setPreflightResults({});
                }}
              >
                {environments.map((env) => {
                  const flowCount = (activeProject?.deployments || []).filter((d) => d.environment_id === env.id).length;
                  return (
                    <option key={env.id} value={env.id}>
                      {env.name.toUpperCase()} {flowCount > 0 ? `(${flowCount} configured ${flowCount === 1 ? 'flow' : 'flows'})` : '(No flows configured)'}
                    </option>
                  );
                })}
              </select>
              <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
                {activeFlows.length} mapped component {activeFlows.length === 1 ? 'pipeline' : 'pipelines'} ready on {envName}
              </div>
            </div>

            {/* Target Branch Selector */}
            <div>
              <label style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent-purple)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginBottom: 8,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                <GitBranch size={15} /> 3. Target Branch
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  className="chat-input"
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    fontSize: '13.5px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)'
                  }}
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                >
                  <option value="main">main (production ready)</option>
                  <option value="master">master</option>
                  <option value="qa">qa (integration)</option>
                  <option value="dev">dev (active development)</option>
                  <option value="staging">staging</option>
                  <option value="release">release</option>
                </select>
              </div>
              <div style={{ marginTop: 6, fontSize: '11px', color: 'var(--text-muted)' }}>
                Git branch passed to autonomous pipeline execution
              </div>
            </div>
          </div>
        </div>

        {/* 2. Mapped Flows Matrix Section */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={16} style={{ color: 'var(--accent-cyan)' }} />
                Configured Flows for {activeProject?.name} &rarr; {envName}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, marginTop: 3 }}>
                The following deployment pipelines are mapped from your Workflow configuration.
              </p>
            </div>

            {activeFlows.length > 1 && isOperator && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDeployAll}
                style={{
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
                  fontWeight: 700,
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <Rocket size={15} /> Deploy Full Stack ({activeFlows.length} Components)
              </button>
            )}
          </div>

          {activeFlows.length === 0 ? (
            <div style={{
              padding: 36,
              textAlign: 'center',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}>
              <HelpCircle size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '4px 0 6px' }}>
                No deployment flows found for {activeProject?.name} on {envName}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: 450, margin: '0 auto 16px' }}>
                You have not yet configured any component pipelines for this environment in Workflows.
              </p>
              {onNavigateToWorkflows && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onNavigateToWorkflows}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Rocket size={13} /> Configure Flows in Workflows Tab
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {activeFlows.map((flow) => {
                const srvObj = (flow.server_id ? servers.find((s) => s.id === flow.server_id) : null)
                  || servers.find((s) => s.environment_id === flow.environment_id)
                  || servers[0];

                const preflight = preflightResults[flow.component];
                const isCheckingThis = checkingComponent === flow.component;

                return (
                  <div
                    key={flow.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-subtle)',
                      borderLeft: '4px solid var(--accent-cyan)',
                      borderRadius: 'var(--radius-md)',
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    {/* Flow Card Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          padding: 6,
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(6, 182, 212, 0.15)',
                          color: 'var(--accent-cyan)'
                        }}>
                          <Layers size={16} />
                        </div>
                        <div>
                          <strong style={{ fontSize: '14px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                            {flow.component} Service
                          </strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Component Pipeline #{flow.id}
                          </div>
                        </div>
                      </div>

                      <span className="badge badge-primary" style={{ fontSize: '10.5px' }}>
                        READY
                      </span>
                    </div>

                    {/* Configuration Specs */}
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                      background: 'var(--bg-primary)',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '11.5px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Target Host:</span>
                        <strong style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Server size={12} style={{ color: 'var(--accent-blue)' }} />
                          {srvObj ? `${srvObj.name} (${srvObj.hostname})` : 'Auto-resolving Fleet Node'}
                        </strong>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Remote Path:</span>
                        <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                          {flow.repository_path || '/opt/app'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Deploy Command:</span>
                        <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>
                          {flow.deployment_script || './deploy.sh'}
                        </span>
                      </div>
                    </div>

                    {/* Preflight Check Status Banner */}
                    {preflight && (
                      <div style={{
                        padding: '8px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        background: preflight.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        border: `1px solid ${preflight.success ? 'var(--status-success)' : 'var(--status-error)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: preflight.success ? 'var(--status-success)' : 'var(--status-error)' }}>
                          {preflight.success ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                          <span>{preflight.success ? 'Preflight Check Succeeded' : 'Preflight Issues Detected'}</span>
                        </div>
                        {preflight.details && preflight.details.length > 0 && (
                          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            {preflight.details[0]}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRunPreflight(flow.component)}
                        disabled={isCheckingThis}
                        style={{ fontSize: '11.5px', padding: '6px 10px' }}
                        title="Audit node reachability & path before deploying"
                      >
                        <RefreshCw size={12} className={isCheckingThis ? 'spin' : ''} />
                        {isCheckingThis ? 'Checking...' : 'Preflight'}
                      </button>

                      {isOperator ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{
                            flex: 1,
                            fontSize: '12px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6
                          }}
                          onClick={() => onTriggerDeploy(activeProject.name, flow.component, activeEnvironment.name)}
                          title={`Deploy ${flow.component} to ${envName}`}
                        >
                          <Play size={12} /> Deploy {flow.component}
                        </button>
                      ) : (
                        <span className="badge badge-pending" style={{ flex: 1, textAlign: 'center', padding: '6px' }}>
                          View Only
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Recent Execution History for Selected Project / Environment */}
      {relevantTasks.length > 0 && (
        <div className="card-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Terminal size={17} style={{ color: 'var(--accent-blue)' }} />
              <span>Recent Deployments for {activeProject?.name} ({envName})</span>
            </div>
          </div>

          <div className="table-container" style={{ margin: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>Task</th>
                  <th style={{ width: '45%' }}>Request</th>
                  <th style={{ width: '15%' }}>Status</th>
                  <th style={{ width: '15%' }}>Time</th>
                  <th style={{ width: '15%' }}>Stream</th>
                </tr>
              </thead>
              <tbody>
                {relevantTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                      #{t.id}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      {t.user_request}
                    </td>
                    <td>
                      <span className={`badge ${
                        t.status === 'SUCCESS' ? 'badge-success' :
                        t.status === 'RUNNING' ? 'badge-running' :
                        t.status === 'FAILED' ? 'badge-danger' : 'badge-pending'
                      }`}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '11.5px' }}>
                      {t.created_at ? new Date(t.created_at).toLocaleTimeString() : 'Just now'}
                    </td>
                    <td>
                      {onSelectTaskToStream && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '11px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={() => onSelectTaskToStream(t.id)}
                        >
                          <Terminal size={11} /> View Stream
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
