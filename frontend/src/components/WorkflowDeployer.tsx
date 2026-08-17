import React, { useState, useEffect } from 'react';
import {
  Rocket, Play, CheckCircle2, AlertCircle, RefreshCw, Server,
  FolderGit2, Layers, ShieldCheck, Activity, Plus, Trash2,
  Code, Settings2, Edit3, X, ShieldAlert
} from 'lucide-react';
import { Project, Environment, Server as ServerType, PreflightCheckResult, ProjectDeployment } from '../types';
import { runPreflightCheckApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface WorkflowDeployerProps {
  projects: Project[];
  environments: Environment[];
  servers: ServerType[];
  onTriggerDeploy: (projectName: string, component: string, env: string) => void;
  onAddDeployment?: (projectId: number, data: {
    environment_id: number;
    component: string;
    server_id?: number | null;
    repository_path?: string;
    deployment_script?: string;
    health_check_url?: string;
  }) => Promise<void>;
  onUpdateDeployment?: (deploymentId: number, data: {
    environment_id?: number;
    component?: string;
    server_id?: number | null;
    repository_path?: string;
    deployment_script?: string;
    health_check_url?: string;
  }) => Promise<void>;
  onDeleteDeployment?: (deploymentId: number) => Promise<void>;
}

export const WorkflowDeployer: React.FC<WorkflowDeployerProps> = ({
  projects,
  environments,
  servers,
  onTriggerDeploy,
  onAddDeployment,
  onUpdateDeployment,
  onDeleteDeployment,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isOperator = role === 'operator' || role === 'admin';

  // Selected Deployment Trigger State
  const [selectedProjectId, setSelectedProjectId] = useState<number>(projects[0]?.id || 1);
  const [selectedEnvId, setSelectedEnvId] = useState<number>(environments[0]?.id || 1);
  const [selectedComponent, setSelectedComponent] = useState<string>('frontend');
  const [targetBranch, setTargetBranch] = useState<string>('main');

  // Pre-flight check state
  const [isChecking, setIsChecking] = useState(false);
  const [preflightResult, setPreflightResult] = useState<PreflightCheckResult | null>(null);

  // Add Flow Modal State
  const [showAddFlowModal, setShowAddFlowModal] = useState(false);
  const [modalProjectId, setModalProjectId] = useState<number>(projects[0]?.id || 1);
  const [modalEnvId, setModalEnvId] = useState<number>(environments[0]?.id || 1);
  const [modalServerId, setModalServerId] = useState<number | undefined>(servers[0]?.id);
  const [modalComponent, setModalComponent] = useState('frontend');
  const [modalRepoPath, setModalRepoPath] = useState('/opt/app/frontend');
  const [modalScript, setModalScript] = useState('./deploy.sh');
  const [modalHealthUrl, setModalHealthUrl] = useState('');

  // Edit Flow Modal State
  const [editingFlow, setEditingFlow] = useState<ProjectDeployment | null>(null);
  const [editFlowEnvId, setEditFlowEnvId] = useState<number>(1);
  const [editFlowServerId, setEditFlowServerId] = useState<number | undefined>(undefined);
  const [editFlowComponent, setEditFlowComponent] = useState('');
  const [editFlowRepoPath, setEditFlowRepoPath] = useState('');
  const [editFlowScript, setEditFlowScript] = useState('');
  const [editFlowHealthUrl, setEditFlowHealthUrl] = useState('');

  const activeProject = projects.find((p) => p.id === Number(selectedProjectId)) || projects[0];
  const activeEnvironment = environments.find((e) => e.id === Number(selectedEnvId)) || environments[0];

  // Resolve matching deployment flow for project + environment
  const matchingDeployments = (activeProject?.deployments || []).filter(
    (d) => d.environment_id === activeEnvironment?.id
  );
  const activeDeployment = matchingDeployments.find((d) => d.component === selectedComponent) || matchingDeployments[0];

  // Resolve matching server node for the active deployment flow (explicit server_id, or environment match, or any fleet server)
  const mappedServer = (activeDeployment?.server_id ? servers.find((s) => s.id === activeDeployment.server_id) : null)
    || servers.find((s) => s.environment_id === activeEnvironment?.id)
    || servers[0];

  // Automatically update component selection if available flows change
  useEffect(() => {
    if (matchingDeployments.length > 0) {
      if (!matchingDeployments.some((d) => d.component === selectedComponent)) {
        setSelectedComponent(matchingDeployments[0].component);
      }
    }
  }, [selectedProjectId, selectedEnvId]);

  const handleRunPreflight = async () => {
    if (!activeProject || !activeEnvironment) return;
    setIsChecking(true);
    setPreflightResult(null);
    try {
      const res = await runPreflightCheckApi({
        project_id: activeProject.id,
        environment_id: activeEnvironment.id,
        component: activeDeployment?.component || selectedComponent,
      });
      setPreflightResult(res);
    } catch (err: any) {
      setPreflightResult({
        success: false,
        server_reachable: false,
        details: [`Pre-flight verification failed: ${err.message || err}`],
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleExecuteDeploy = () => {
    if (!activeProject || !activeEnvironment) return;
    const comp = activeDeployment?.component || selectedComponent;
    onTriggerDeploy(activeProject.name, comp, activeEnvironment.name);
  };

  const startEditingFlow = (flow: ProjectDeployment) => {
    setEditingFlow(flow);
    setEditFlowEnvId(flow.environment_id);
    setEditFlowServerId(flow.server_id ? flow.server_id : undefined);
    setEditFlowComponent(flow.component);
    setEditFlowRepoPath(flow.repository_path || '');
    setEditFlowScript(flow.deployment_script || './deploy.sh');
    setEditFlowHealthUrl(flow.health_check_url || '');
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalComponent.trim() || !onAddDeployment) return;
    try {
      await onAddDeployment(Number(modalProjectId), {
        environment_id: Number(modalEnvId),
        server_id: modalServerId ? Number(modalServerId) : undefined,
        component: modalComponent.trim(),
        repository_path: modalRepoPath.trim() || undefined,
        deployment_script: modalScript.trim() || undefined,
        health_check_url: modalHealthUrl.trim() || undefined,
      });
      setShowAddFlowModal(false);
    } catch (err: any) {
      alert(`Failed to save deployment flow: ${err.message || err}`);
    }
  };

  const handleUpdateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlow || !onUpdateDeployment) return;
    try {
      await onUpdateDeployment(editingFlow.id, {
        environment_id: Number(editFlowEnvId),
        server_id: editFlowServerId ? Number(editFlowServerId) : null,
        component: editFlowComponent.trim(),
        repository_path: editFlowRepoPath.trim() || undefined,
        deployment_script: editFlowScript.trim() || undefined,
        health_check_url: editFlowHealthUrl.trim() || undefined,
      });
      setEditingFlow(null);
    } catch (err: any) {
      alert(`Failed to update deployment flow: ${err.message || err}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Main Deployment Execution Panel */}
      <div className="card-panel">
        <div className="panel-header">
          <div className="panel-title">
            <Rocket size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span>Workflow & Deployment Control Center</span>
          </div>

          {isAdmin ? (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setModalProjectId(activeProject?.id || 1);
                setModalEnvId(activeEnvironment?.id || 1);
                setModalServerId(servers[0]?.id);
                setModalComponent(selectedComponent || 'frontend');
                setModalRepoPath(`/opt/${activeProject?.name || 'app'}/${selectedComponent || 'frontend'}`);
                setModalScript('./deploy.sh');
                setShowAddFlowModal(!showAddFlowModal);
                setEditingFlow(null);
              }}
            >
              <Plus size={14} />
              Configure New Flow
            </button>
          ) : (
            <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ShieldAlert size={12} /> {role.toUpperCase()} MODE
            </span>
          )}
        </div>

        {/* 4-Step Interactive Deployment Wizard */}
        <div style={{ padding: 24, borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {/* Step 1: Select Project */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <FolderGit2 size={14} style={{ color: 'var(--accent-cyan)' }} />
                1. Project Workspace
              </label>
              <select
                className="chat-input"
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#111827', color: '#f8fafc' }}
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(Number(e.target.value));
                  setPreflightResult(null);
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: '#111827', color: '#f8fafc' }}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select Environment */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Activity size={14} style={{ color: 'var(--accent-blue)' }} />
                2. Target Environment
              </label>
              <select
                className="chat-input"
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px', background: '#111827', color: '#f8fafc' }}
                value={selectedEnvId}
                onChange={(e) => {
                  setSelectedEnvId(Number(e.target.value));
                  setPreflightResult(null);
                }}
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id} style={{ background: '#111827', color: '#f8fafc' }}>
                    {env.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Select Component */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  <Layers size={14} style={{ color: 'var(--accent-purple)' }} />
                  3. Component Service
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalProjectId(activeProject?.id || 1);
                      setModalEnvId(activeEnvironment?.id || 1);
                      setModalServerId(servers[0]?.id);
                      const hasFe = matchingDeployments.some(d => d.component.toLowerCase() === 'frontend');
                      const nextComp = hasFe ? 'backend' : 'frontend';
                      setModalComponent(nextComp);
                      setModalRepoPath(`/opt/${activeProject?.name || 'app'}/${nextComp}`);
                      setModalScript('./deploy.sh');
                      setShowAddFlowModal(true);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      padding: 0
                    }}
                    title="Add another component flow to this environment"
                  >
                    <Plus size={11} /> + Add Component
                  </button>
                )}
              </div>

              {matchingDeployments.length > 0 ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {matchingDeployments.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`btn btn-sm ${
                        (activeDeployment?.id === d.id || selectedComponent === d.component)
                          ? 'btn-primary'
                          : 'btn-secondary'
                      }`}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                      onClick={() => {
                        setSelectedComponent(d.component);
                        setPreflightResult(null);
                      }}
                    >
                      <Layers size={12} />
                      <strong>{d.component}</strong>
                    </button>
                  ))}
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '6px 10px',
                        fontSize: '12px',
                        borderStyle: 'dashed',
                        color: 'var(--text-secondary)'
                      }}
                      onClick={() => {
                        setModalProjectId(activeProject?.id || 1);
                        setModalEnvId(activeEnvironment?.id || 1);
                        setModalServerId(servers[0]?.id);
                        const hasFe = matchingDeployments.some(d => d.component.toLowerCase() === 'frontend');
                        const nextComp = hasFe ? 'backend' : 'frontend';
                        setModalComponent(nextComp);
                        setModalRepoPath(`/opt/${activeProject?.name || 'app'}/${nextComp}`);
                        setModalScript('./deploy.sh');
                        setShowAddFlowModal(true);
                      }}
                    >
                      <Plus size={12} /> Add Component
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="text"
                    className="chat-input"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '13px' }}
                    placeholder="e.g. frontend / backend"
                    value={selectedComponent}
                    onChange={(e) => setSelectedComponent(e.target.value)}
                  />
                  {isAdmin && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setModalProjectId(activeProject?.id || 1);
                        setModalEnvId(activeEnvironment?.id || 1);
                        setModalServerId(servers[0]?.id);
                        setModalComponent(selectedComponent || 'frontend');
                        setModalRepoPath(`/opt/${activeProject?.name || 'app'}/${selectedComponent || 'frontend'}`);
                        setModalScript('./deploy.sh');
                        setShowAddFlowModal(true);
                      }}
                    >
                      <Plus size={12} /> Save Flow
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Step 4: Branch */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Code size={14} style={{ color: 'var(--status-success)' }} />
                4. Git Branch
              </label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="main"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Target Server & Workflow Resolution Card */}
        <div style={{ padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            {/* Resolved Server Node Card */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Mapped Server Node</span>
                <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                  {activeEnvironment?.name?.toUpperCase() || 'NODE'}
                </span>
              </div>

              {mappedServer ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Node Name:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{mappedServer.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Host IP:</span>
                    <span className="font-mono">{mappedServer.hostname}:{mappedServer.port}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>SSH User:</span>
                    <span className="font-mono">{mappedServer.username}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Auth Mode:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-cyan)' }}>
                      <ShieldCheck size={13} /> {mappedServer.authentication_method === 'password' ? 'Password Auth' : 'SSH Key'}
                    </span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 12, borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-error)', fontSize: '12px' }}>
                  <AlertCircle size={14} style={{ display: 'inline', marginRight: 4 }} />
                  No server node is currently assigned. Add a compute node in the <strong>Fleet</strong> tab.
                </div>
              )}
            </div>

            {/* Resolved Execution Pipeline Parameters */}
            <div style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Execution Flow Specs</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="badge badge-primary" style={{ fontSize: '10.5px' }}>
                      {activeDeployment?.component || selectedComponent}
                    </span>
                    {isAdmin && activeDeployment && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', fontSize: '11px' }}
                        onClick={() => startEditingFlow(activeDeployment)}
                        title="Edit Location & Script"
                      >
                        <Edit3 size={11} /> Edit
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '12.5px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Remote Path:</span>
                    <span className="font-mono">{activeDeployment?.repository_path || `/opt/${activeProject?.name || 'app'}/${selectedComponent}`}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Deploy Script:</span>
                    <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{activeDeployment?.deployment_script || './deploy.sh'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Health Probe:</span>
                    <span style={{ color: activeDeployment?.health_check_url ? 'var(--status-success)' : 'var(--text-muted)' }}>
                      {activeDeployment?.health_check_url ? activeDeployment.health_check_url : 'None configured'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Target Git Ref:</span>
                    <span className="font-mono">origin/{targetBranch}</span>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11.5px', padding: '4px 10px' }}
                    onClick={() => {
                      setModalProjectId(activeProject?.id || 1);
                      setModalEnvId(activeEnvironment?.id || 1);
                      setModalServerId(servers[0]?.id);
                      const hasFe = matchingDeployments.some(d => d.component.toLowerCase() === 'frontend');
                      const nextComp = hasFe ? 'backend' : 'frontend';
                      setModalComponent(nextComp);
                      setModalRepoPath(`/opt/${activeProject?.name || 'app'}/${nextComp}`);
                      setModalScript('./deploy.sh');
                      setShowAddFlowModal(true);
                    }}
                  >
                    <Plus size={12} /> Add Component (e.g. Backend)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Pre-flight Result Inspector */}
          {preflightResult && (
            <div style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 'var(--radius-md)',
              background: preflightResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${preflightResult.success ? 'var(--status-success)' : 'var(--status-error)'}`,
              fontSize: '12.5px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8, color: preflightResult.success ? 'var(--status-success)' : 'var(--status-error)' }}>
                {preflightResult.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{preflightResult.success ? 'Pre-flight Verification Passed - Ready for Deployment' : 'Pre-flight Check Detected Warnings/Issues'}</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--text-secondary)' }}>
                {preflightResult.details.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Trigger Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            {isOperator ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '10px 18px', fontSize: '13px' }}
                  onClick={handleRunPreflight}
                  disabled={isChecking || !mappedServer}
                >
                  {isChecking ? <RefreshCw size={15} className="spin" /> : <Activity size={15} />}
                  Run Pre-flight Audit
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '10px 22px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={handleExecuteDeploy}
                  disabled={!mappedServer}
                >
                  <Play size={15} />
                  Deploy to {activeEnvironment?.name?.toUpperCase()} Now
                </button>
              </>
            ) : (
              <span className="badge badge-pending" style={{ padding: '8px 16px', fontSize: '12px' }}>
                Viewer Mode (Read-Only Access)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Add Flow Modal */}
      {isAdmin && showAddFlowModal && (
        <form onSubmit={handleCreateFlow} style={{ padding: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings2 size={15} /> Configure Component Deployment Flow
            </h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddFlowModal(false)}>
              <X size={13} />
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 14 }}>
            Specify the target environment, assigned fleet server node, remote path, and deployment script / command.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Project *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={modalProjectId}
                onChange={(e) => setModalProjectId(Number(e.target.value))}
                required
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: '#111827', color: '#f8fafc' }}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Environment *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={modalEnvId}
                onChange={(e) => setModalEnvId(Number(e.target.value))}
                required
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id} style={{ background: '#111827', color: '#f8fafc' }}>
                    {env.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Fleet Server Node</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={modalServerId || ''}
                onChange={(e) => setModalServerId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="" style={{ background: '#111827', color: '#f8fafc' }}>Auto-resolve from fleet</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: '#111827', color: '#f8fafc' }}>
                    {s.name} ({s.hostname}:{s.port} - {s.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Component Name *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. frontend, backend, app"
                value={modalComponent}
                onChange={(e) => setModalComponent(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remote Server Path (Location) *</label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. /home/xyloite/app"
                value={modalRepoPath}
                onChange={(e) => setModalRepoPath(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Deployment Script / Command *</label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. ./deploy.sh"
                value={modalScript}
                onChange={(e) => setModalScript(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Health Check URL (Optional)</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. http://localhost:3000/api/health"
                value={modalHealthUrl}
                onChange={(e) => setModalHealthUrl(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, gridColumn: 'span 2' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Save Deployment Flow
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddFlowModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Edit Flow Modal */}
      {isAdmin && editingFlow && (
        <form onSubmit={handleUpdateFlow} style={{ padding: 20, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={15} /> Edit Flow: {editingFlow.component}
            </h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingFlow(null)}>
              <X size={13} />
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 14 }}>
            Update the configuration for this deployment pipeline.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Component Name *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editFlowComponent}
                onChange={(e) => setEditFlowComponent(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Environment *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={editFlowEnvId}
                onChange={(e) => setEditFlowEnvId(Number(e.target.value))}
                required
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id} style={{ background: '#111827', color: '#f8fafc' }}>
                    {env.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Fleet Server Node</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={editFlowServerId || ''}
                onChange={(e) => setEditFlowServerId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="" style={{ background: '#111827', color: '#f8fafc' }}>Auto-resolve from fleet</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id} style={{ background: '#111827', color: '#f8fafc' }}>
                    {s.name} ({s.hostname}:{s.port} - {s.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remote Server Path (Location) *</label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                value={editFlowRepoPath}
                onChange={(e) => setEditFlowRepoPath(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Deployment Script / Command *</label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                value={editFlowScript}
                onChange={(e) => setEditFlowScript(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Health Check URL (Optional)</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editFlowHealthUrl}
                onChange={(e) => setEditFlowHealthUrl(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, gridColumn: 'span 2' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Update Deployment Flow
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingFlow(null)}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 2. Global Workflow Mapping Overview */}
      <div className="card-panel">
        <div className="panel-header">
          <div className="panel-title">
            <Layers size={18} style={{ color: 'var(--accent-purple)' }} />
            <span>Multi-Environment Workflow Mappings</span>
          </div>

          {isAdmin && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setModalProjectId(activeProject?.id || 1);
                setModalEnvId(activeEnvironment?.id || 1);
                setModalServerId(servers[0]?.id);
                setShowAddFlowModal(true);
              }}
            >
              <Plus size={14} /> Add Deployment Flow
            </button>
          )}
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {projects.map((p) => (
            <div key={p.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FolderGit2 size={16} style={{ color: 'var(--accent-cyan)' }} />
                    {p.name}
                    {p.deployments && p.deployments.length > 0 && (
                      <span className="badge badge-primary" style={{ fontSize: '10.5px' }}>
                        {p.deployments.length} {p.deployments.length === 1 ? 'Flow' : 'Flows'}
                      </span>
                    )}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>{p.description || 'Configured Project Service'}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isAdmin && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setModalProjectId(p.id);
                        setModalEnvId(activeEnvironment?.id || 1);
                        setModalServerId(servers[0]?.id);
                        setShowAddFlowModal(true);
                      }}
                      title="Add another component flow to this project"
                    >
                      <Plus size={13} /> Add Flow
                    </button>
                  )}

                  {p.repository_url && (
                    <a
                      href={p.repository_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <Code size={13} />
                      {p.repository_url}
                    </a>
                  )}
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Component Flow</th>
                      <th>Target Environment</th>
                      <th>Assigned Node</th>
                      <th>Remote Path (Location)</th>
                      <th>Script</th>
                      <th>1-Click Action</th>
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {p.deployments && p.deployments.length > 0 ? (
                      p.deployments.map((d) => {
                        const envObj = environments.find((e) => e.id === d.environment_id);
                        const srvObj = (d.server_id ? servers.find((s) => s.id === d.server_id) : null)
                          || servers.find((s) => s.environment_id === d.environment_id);

                        return (
                          <tr key={d.id}>
                            <td>
                              <strong style={{ color: 'var(--accent-cyan)' }}>{d.component}</strong>
                            </td>
                            <td>
                              <span className="badge badge-success">
                                {envObj?.name?.toUpperCase() || `ENV-${d.environment_id}`}
                              </span>
                            </td>
                            <td>
                              {srvObj ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}>
                                  <Server size={12} style={{ color: 'var(--accent-blue)' }} /> {srvObj.name} ({srvObj.hostname})
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Auto (Fleet Node)</span>
                              )}
                            </td>
                            <td className="font-mono" style={{ fontSize: '12px' }}>{d.repository_path || '/opt/app'}</td>
                            <td className="font-mono" style={{ color: 'var(--accent-cyan)', fontSize: '12px' }}>{d.deployment_script || './deploy.sh'}</td>
                            <td>
                              {isOperator ? (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => onTriggerDeploy(p.name, d.component, envObj?.name || 'uat')}
                                >
                                  <Play size={12} /> Deploy
                                </button>
                              ) : (
                                <span className="badge badge-pending" style={{ fontSize: '11px' }}>View Only</span>
                              )}
                            </td>
                            {isAdmin && (
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => startEditingFlow(d)}
                                    title="Edit Configuration"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  {onDeleteDeployment && (
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => {
                                        if (window.confirm(`Delete deployment flow for component "${d.component}"?`)) {
                                          onDeleteDeployment(d.id);
                                        }
                                      }}
                                      title="Delete Flow"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                          No deployment flows defined for this project.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
