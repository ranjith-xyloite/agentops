import React, { useState, useEffect } from 'react';
import {
  Rocket, Play, CheckCircle2, AlertCircle, RefreshCw, Server,
  FolderGit2, Layers, ShieldCheck, Activity, Plus, Trash2,
  Code, Settings2, Edit3, X, ShieldAlert, Filter
} from 'lucide-react';
import { Project, Environment, Server as ServerType, PreflightCheckResult, ProjectDeployment } from '../types';
import { runPreflightCheckApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PaginationControls } from './PaginationControls';

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
  const [targetBranch, setTargetBranch] = useState<string>('');

  // Workflow Overview Filter & Pagination State
  const [filterProjectId, setFilterProjectId] = useState<number | 'ALL'>('ALL');
  const [filterEnvId, setFilterEnvId] = useState<number | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

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

  // Resolve matching deployment flows for project + environment
  const matchingDeployments = (activeProject?.deployments || []).filter(
    (d) => d.environment_id === activeEnvironment?.id
  );
  const activeDeployment = matchingDeployments.find((d) => d.component === selectedComponent) || (matchingDeployments.length > 0 ? matchingDeployments[0] : null);

  // Resolve matching server node for the active deployment flow (explicit server_id, or environment match, or null)
  const mappedServer = activeDeployment?.server_id
    ? (servers.find((s) => s.id === activeDeployment.server_id) || null)
    : (activeDeployment && activeEnvironment ? (servers.find((s) => s.environment_id === activeEnvironment.id) || null) : null);

  // Automatically update component selection if available flows change
  useEffect(() => {
    if (matchingDeployments.length > 0) {
      if (!matchingDeployments.some((d) => d.component === selectedComponent)) {
        setSelectedComponent(matchingDeployments[0].component);
      }
    }
  }, [selectedProjectId, selectedEnvId, matchingDeployments]);

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
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                value={selectedProjectId}
                onChange={(e) => {
                  setSelectedProjectId(Number(e.target.value));
                  setPreflightResult(null);
                }}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Select Environment */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                  <Activity size={14} style={{ color: 'var(--accent-blue)' }} />
                  2. Target Environment
                </label>
              </div>
              <select
                className="chat-input"
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                value={selectedEnvId}
                onChange={(e) => {
                  setSelectedEnvId(Number(e.target.value));
                  setPreflightResult(null);
                }}
              >
                {environments.map((env) => {
                  const flowCount = (activeProject?.deployments || []).filter((d) => d.environment_id === env.id).length;
                  return (
                    <option key={env.id} value={env.id}>
                      {env.name.toUpperCase()} {flowCount > 0 ? `(${flowCount} active ${flowCount === 1 ? 'flow' : 'flows'})` : ''}
                    </option>
                  );
                })}
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

            {/* Step 4: Branch (Optional) */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Code size={14} style={{ color: 'var(--status-success)' }} />
                4. Git Branch (Optional)
              </label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                placeholder="Optional (managed by script)"
              />
            </div>
          </div>
        </div>

        {/* Dynamic Target Server & Workflow Resolution Card */}
        <div style={{ padding: 24 }}>
          {matchingDeployments.length === 0 || !activeDeployment ? (
            <div style={{
              padding: '32px 24px',
              textAlign: 'center',
              background: 'var(--bg-primary)',
              border: '1px dashed var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-secondary)'
            }}>
              <AlertCircle size={32} style={{ color: 'var(--status-warning)', margin: '0 auto 10px', display: 'block' }} />
              <h4 style={{ fontSize: '15px', color: 'var(--text-primary)', margin: '0 0 6px' }}>
                No Deployment Flow Configured for {activeProject?.name} on {activeEnvironment?.name?.toUpperCase()}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 16px' }}>
                No component services (e.g. frontend, backend) have been mapped to the <strong>{activeEnvironment?.name?.toUpperCase()}</strong> environment for project <strong>{activeProject?.name}</strong> yet.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setModalProjectId(activeProject?.id || 1);
                    setModalEnvId(activeEnvironment?.id || 1);
                    setModalServerId(servers[0]?.id);
                    setModalComponent('frontend');
                    setModalRepoPath('');
                    setModalScript('./deploy.sh');
                    setModalHealthUrl('');
                    setShowAddFlowModal(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 auto' }}
                >
                  <Plus size={13} /> Configure Flow for {activeEnvironment?.name?.toUpperCase()}
                </button>
              )}
            </div>
          ) : (
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
                  <span className={`badge ${mappedServer ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '10.5px' }}>
                    {mappedServer ? activeEnvironment?.name?.toUpperCase() : 'NO NODE MAPPED'}
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
                    No server node is mapped to this flow. Click <strong>Edit</strong> on the flow specs to assign a fleet node.
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
                        {activeDeployment.component}
                      </span>
                      {isAdmin && (
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
                      <span className="font-mono">{activeDeployment.repository_path || 'None configured'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Deploy Script:</span>
                      <span className="font-mono" style={{ color: 'var(--accent-cyan)' }}>{activeDeployment.deployment_script || 'None configured'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Health Probe:</span>
                      <span style={{ color: activeDeployment.health_check_url ? 'var(--status-success)' : 'var(--text-muted)' }}>
                        {activeDeployment.health_check_url || 'None configured'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Target Git Ref:</span>
                      <span className="font-mono">{targetBranch ? `origin/${targetBranch}` : 'Default (Managed by Script)'}</span>
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
                        setModalRepoPath('');
                        setModalScript('./deploy.sh');
                        setModalHealthUrl('');
                        setShowAddFlowModal(true);
                      }}
                    >
                      <Plus size={12} /> Add Component (e.g. Backend)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

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
                  disabled={isChecking || !activeDeployment || !mappedServer}
                  title={!activeDeployment ? 'Configure a deployment flow for this environment first' : !mappedServer ? 'Assign a server node to this flow first' : 'Run connectivity & path check'}
                >
                  {isChecking ? <RefreshCw size={15} className="spin" /> : <Activity size={15} />}
                  Run Pre-flight Audit
                </button>

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ padding: '10px 22px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={handleExecuteDeploy}
                  disabled={!activeDeployment || !mappedServer}
                  title={!activeDeployment ? 'Configure a deployment flow for this environment first' : !mappedServer ? 'Assign a server node to this flow first' : `Trigger deployment to ${activeEnvironment?.name?.toUpperCase()}`}
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

      {/* Add Flow Floating Modal Overlay */}
      {isAdmin && showAddFlowModal && (
        <div
          style={{
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
            if (e.target === e.currentTarget) setShowAddFlowModal(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '620px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px 28px',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <form onSubmit={handleCreateFlow}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Settings2 size={16} style={{ color: 'var(--accent-cyan)' }} /> Configure Component Deployment Flow
                </h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddFlowModal(false)}>
                  <X size={14} />
                </button>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 18 }}>
                Specify the target environment, assigned fleet server node, remote path, and deployment script for this pipeline.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Project *</label>
                  <select
                    className="chat-input"
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px' }}
                    value={modalProjectId}
                    onChange={(e) => setModalProjectId(Number(e.target.value))}
                    required
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Environment *</label>
                  <select
                    className="chat-input"
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px' }}
                    value={modalEnvId}
                    onChange={(e) => setModalEnvId(Number(e.target.value))}
                    required
                  >
                    {environments.map((env) => (
                      <option key={env.id} value={env.id}>
                        {env.name.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Target Fleet Server Node</label>
                  <select
                    className="chat-input"
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px' }}
                    value={modalServerId || ''}
                    onChange={(e) => setModalServerId(e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <option value="">Auto-resolve from fleet</option>
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.hostname}:{s.port} - {s.username})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Component Name *</label>
                  <input
                    type="text"
                    className="chat-input"
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px' }}
                    placeholder="e.g. frontend, backend, app"
                    value={modalComponent}
                    onChange={(e) => setModalComponent(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Remote Server Path (Location) *</label>
                  <input
                    type="text"
                    className="chat-input font-mono"
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px' }}
                    placeholder="e.g. /home/xyloite/app"
                    value={modalRepoPath}
                    onChange={(e) => setModalRepoPath(e.target.value)}
                    required
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Deployment Script / Command *</label>
                  <input
                    type="text"
                    className="chat-input font-mono"
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px' }}
                    placeholder="e.g. ./deploy.sh or ./wd-node-deploy.sh"
                    value={modalScript}
                    onChange={(e) => setModalScript(e.target.value)}
                    required
                  />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>Health Check URL (Optional)</label>
                  <input
                    type="text"
                    className="chat-input"
                    style={{ width: '100%', marginTop: 4, padding: '8px 12px' }}
                    placeholder="e.g. http://localhost:3000/api/health"
                    value={modalHealthUrl}
                    onChange={(e) => setModalHealthUrl(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, gridColumn: 'span 2', marginTop: 8 }}>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '10px 16px' }}>
                    Save Deployment Flow
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '10px 16px' }} onClick={() => setShowAddFlowModal(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* 2. Global Workflow Mapping Overview with Project & Environment Filtering */}
      <div className="card-panel">
        <div className="panel-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div className="panel-title">
            <Layers size={18} style={{ color: 'var(--accent-purple)' }} />
            <span>Multi-Environment Workflow Mappings</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Filter by Project */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FolderGit2 size={13} style={{ color: 'var(--accent-cyan)' }} />
              <select
                className="chat-input"
                style={{ padding: '4px 8px', fontSize: '12px', minWidth: '150px' }}
                value={filterProjectId}
                onChange={(e) => {
                  setFilterProjectId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Projects ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Environment */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Activity size={13} style={{ color: 'var(--accent-blue)' }} />
              <select
                className="chat-input"
                style={{ padding: '4px 8px', fontSize: '12px', minWidth: '140px' }}
                value={filterEnvId}
                onChange={(e) => {
                  setFilterEnvId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Environments</option>
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Reset Filters */}
            {(filterProjectId !== 'ALL' || filterEnvId !== 'ALL') && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '11px', padding: '4px 8px' }}
                onClick={() => {
                  setFilterProjectId('ALL');
                  setFilterEnvId('ALL');
                  setCurrentPage(1);
                }}
              >
                <X size={12} /> Clear Filter
              </button>
            )}

            {isAdmin && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setModalProjectId(typeof filterProjectId === 'number' ? filterProjectId : (activeProject?.id || 1));
                  setModalEnvId(typeof filterEnvId === 'number' ? filterEnvId : (activeEnvironment?.id || 1));
                  setModalServerId(servers[0]?.id);
                  setShowAddFlowModal(true);
                }}
              >
                <Plus size={14} /> Add Deployment Flow
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {(() => {
            const displayedProjects = projects.filter((p) => {
              if (filterProjectId !== 'ALL' && p.id !== filterProjectId) return false;
              if (filterEnvId !== 'ALL') {
                const hasEnv = (p.deployments || []).some((d) => d.environment_id === filterEnvId);
                if (!hasEnv) return false;
              }
              return true;
            });

            if (displayedProjects.length === 0) {
              const selProjName = projects.find(p => p.id === filterProjectId)?.name;
              const selEnvName = environments.find(e => e.id === filterEnvId)?.name?.toUpperCase();

              return (
                <div style={{
                  padding: 32,
                  textAlign: 'center',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-secondary)'
                }}>
                  <Filter size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                  <h4 style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '4px 0 8px' }}>
                    No matching deployment flows found
                  </h4>
                  <p style={{ fontSize: '12px', margin: 0, marginBottom: 16 }}>
                    No flows configured for {selProjName ? `project "${selProjName}"` : 'selected projects'} in {selEnvName ? `"${selEnvName}" environment` : 'selected environments'}.
                  </p>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setFilterProjectId('ALL');
                        setFilterEnvId('ALL');
                      }}
                    >
                      Reset Filters
                    </button>
                    {isAdmin && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          if (typeof filterProjectId === 'number') setModalProjectId(filterProjectId);
                          if (typeof filterEnvId === 'number') setModalEnvId(filterEnvId);
                          setShowAddFlowModal(true);
                        }}
                      >
                        <Plus size={13} /> Configure Flow for this Selection
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            const paginatedProjects = displayedProjects.slice(
              (currentPage - 1) * pageSize,
              (currentPage - 1) * pageSize + pageSize
            );

            return paginatedProjects.map((p) => {
              const allDeployments = p.deployments || [];
              const envMap: { [envId: number]: ProjectDeployment[] } = {};
              allDeployments.forEach((d) => {
                if (!envMap[d.environment_id]) envMap[d.environment_id] = [];
                envMap[d.environment_id].push(d);
              });

              const configuredEnvIds = Object.keys(envMap)
                .map(Number)
                .filter((eId) => filterEnvId === 'ALL' || eId === filterEnvId);

            return (
              <div key={p.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 18 }}>
                {/* Project Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                  <div>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FolderGit2 size={16} style={{ color: 'var(--accent-cyan)' }} />
                      {p.name}
                      <span className="badge badge-primary" style={{ fontSize: '10.5px' }}>
                        {allDeployments.length} {allDeployments.length === 1 ? 'Flow' : 'Total Flows'}
                      </span>
                      {configuredEnvIds.map((eId) => {
                        const envObj = environments.find((e) => e.id === eId);
                        const eName = envObj?.name?.toUpperCase() || `ENV-${eId}`;
                        const isProd = eName.toLowerCase().includes('prod');
                        const isUat = eName.toLowerCase().includes('uat');
                        const isDev = eName.toLowerCase().includes('dev');
                        const badgeClass = isProd ? 'badge-warning' : isUat ? 'badge-success' : isDev ? 'badge-primary' : 'badge-info';
                        return (
                          <span key={eId} className={`badge ${badgeClass}`} style={{ fontSize: '10px' }}>
                            {eName}
                          </span>
                        );
                      })}
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
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <Plus size={13} /> Add Flow
                      </button>
                    )}

                    {p.repository_url && (
                      <a
                        href={p.repository_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: 4 }}
                      >
                        <Code size={13} />
                        {p.repository_url}
                      </a>
                    )}
                  </div>
                </div>

                {/* Grouped Environment Flow Blocks */}
                {configuredEnvIds.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {configuredEnvIds.map((eId) => {
                      const envObj = environments.find((e) => e.id === eId);
                      const eName = envObj?.name?.toUpperCase() || `ENV-${eId}`;
                      const envFlows = envMap[eId] || [];
                      const isProd = eName.toLowerCase().includes('prod');
                      const isUat = eName.toLowerCase().includes('uat');
                      const isDev = eName.toLowerCase().includes('dev');
                      const badgeClass = isProd ? 'badge-warning' : isUat ? 'badge-success' : isDev ? 'badge-primary' : 'badge-info';
                      const accentColor = isProd ? 'var(--status-warning)' : isUat ? 'var(--status-success)' : isDev ? 'var(--accent-cyan)' : 'var(--accent-purple)';

                      return (
                        <div
                          key={eId}
                          style={{
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)',
                            borderLeft: `3px solid ${accentColor}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '12px 14px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span className={`badge ${badgeClass}`} style={{ fontSize: '10.5px', fontWeight: 700 }}>
                                {eName} ENVIRONMENT
                              </span>
                              <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                ({envFlows.length} {envFlows.length === 1 ? 'component' : 'components'})
                              </span>
                            </div>

                            {isAdmin && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '11px', padding: '2px 8px', whiteSpace: 'nowrap' }}
                                onClick={() => {
                                  setModalProjectId(p.id);
                                  setModalEnvId(eId);
                                  setModalServerId(servers[0]?.id);
                                  const hasFe = envFlows.some(f => f.component.toLowerCase() === 'frontend');
                                  setModalComponent(hasFe ? 'backend' : 'frontend');
                                  setShowAddFlowModal(true);
                                }}
                              >
                                <Plus size={11} /> Add to {eName}
                              </button>
                            )}
                          </div>

                          <div className="table-container" style={{ margin: 0, border: 'none', background: 'transparent' }}>
                            <table className="data-table" style={{ width: '100%' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '18%', whiteSpace: 'nowrap' }}>Component Flow</th>
                                  <th style={{ width: '22%', whiteSpace: 'nowrap' }}>Assigned Node</th>
                                  <th style={{ width: '24%', whiteSpace: 'nowrap' }}>Remote Path (Location)</th>
                                  <th style={{ width: '18%', whiteSpace: 'nowrap' }}>Script</th>
                                  <th style={{ width: '10%', whiteSpace: 'nowrap' }}>1-Click Action</th>
                                  {isAdmin && <th style={{ width: '8%', whiteSpace: 'nowrap' }}>Actions</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {envFlows.map((d) => {
                                  const srvObj = (d.server_id ? servers.find((s) => s.id === d.server_id) : null)
                                    || servers.find((s) => s.environment_id === d.environment_id);

                                  return (
                                    <React.Fragment key={d.id}>
                                      <tr>
                                      <td>
                                        <strong style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px' }}>
                                          <Layers size={13} />
                                          {d.component}
                                        </strong>
                                      </td>
                                      <td>
                                        {srvObj ? (
                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', whiteSpace: 'nowrap' }}>
                                            <Server size={12} style={{ color: 'var(--accent-blue)' }} /> {srvObj.name} ({srvObj.hostname})
                                          </span>
                                        ) : (
                                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Auto (Fleet Node)</span>
                                        )}
                                      </td>
                                      <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{d.repository_path || '/opt/app'}</td>
                                      <td className="font-mono" style={{ color: 'var(--accent-cyan)', fontSize: '11.5px' }}>{d.deployment_script || './deploy.sh'}</td>
                                      <td>
                                        {isOperator ? (
                                          <button
                                            className="btn btn-primary btn-sm"
                                            onClick={() => onTriggerDeploy(p.name, d.component, envObj?.name || 'uat')}
                                            style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '11.5px' }}
                                            title={`Deploy ${d.component} to ${eName}`}
                                          >
                                            <Play size={12} /> Deploy
                                          </button>
                                        ) : (
                                          <span className="badge badge-pending" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>View Only</span>
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
                                                  if (window.confirm(`Delete deployment flow for component "${d.component}" on ${eName}?`)) {
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
                                    {isAdmin && editingFlow?.id === d.id && (
                                      <tr>
                                        <td colSpan={isAdmin ? 6 : 5} style={{ padding: 0 }}>
                                          <form onSubmit={handleUpdateFlow} style={{ padding: '20px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--accent-cyan)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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
                                                  style={{ width: '100%', marginTop: 4 }}
                                                  value={editFlowEnvId}
                                                  onChange={(e) => setEditFlowEnvId(Number(e.target.value))}
                                                  required
                                                >
                                                  {environments.map((env) => (
                                                    <option key={env.id} value={env.id}>
                                                      {env.name.toUpperCase()}
                                                    </option>
                                                  ))}
                                                </select>
                                              </div>

                                              <div>
                                                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Fleet Server Node</label>
                                                <select
                                                  className="chat-input"
                                                  style={{ width: '100%', marginTop: 4 }}
                                                  value={editFlowServerId || ''}
                                                  onChange={(e) => setEditFlowServerId(e.target.value ? Number(e.target.value) : undefined)}
                                                >
                                                  <option value="">Auto-resolve from fleet</option>
                                                  {servers.map((s) => (
                                                    <option key={s.id} value={s.id}>
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
                                        </td>
                                      </tr>
                                    )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '12px' }}>
                    No deployment flows defined yet for this project.
                  </div>
                )}
              </div>
            );
          });
        })()}
        </div>

        {/* Pagination Footer */}
        {(() => {
          const matchingProjectsCount = projects.filter((p) => {
            if (filterProjectId !== 'ALL' && p.id !== filterProjectId) return false;
            if (filterEnvId !== 'ALL') {
              const hasEnv = (p.deployments || []).some((d) => d.environment_id === filterEnvId);
              if (!hasEnv) return false;
            }
            return true;
          }).length;

          if (matchingProjectsCount === 0) return null;

          return (
            <PaginationControls
              currentPage={currentPage}
              totalItems={matchingProjectsCount}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              pageSizeOptions={[3, 5, 10, 20]}
              itemLabel="projects"
            />
          );
        })()}
      </div>
    </div>
  );
};
