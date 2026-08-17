import React, { useState } from 'react';
import { FolderGit2, Play, Globe, Code, Plus, Trash2, Layers, Settings2, Edit3, X, Server as ServerIcon, ShieldAlert } from 'lucide-react';
import { Project, Environment, Server, ProjectDeployment as ProjectDeploymentType } from '../types';
import { useAuth } from '../context/AuthContext';

interface ProjectDeploymentsProps {
  projects: Project[];
  environments: Environment[];
  servers?: Server[];
  onTriggerDeploy: (projectName: string, component: string, env: string) => void;
  onAddProject?: (projectData: { name: string; description?: string; repository_url?: string }) => Promise<void>;
  onDeleteProject?: (projectId: number) => Promise<void>;
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

export const ProjectDeployments: React.FC<ProjectDeploymentsProps> = ({
  projects,
  environments,
  servers = [],
  onTriggerDeploy,
  onAddProject,
  onDeleteProject,
  onAddDeployment,
  onUpdateDeployment,
  onDeleteDeployment,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isOperator = role === 'operator' || role === 'admin';

  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showAddFlowModal, setShowAddFlowModal] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ProjectDeploymentType | null>(null);

  // Add Project Form State
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [repoUrl, setRepoUrl] = useState('');

  // Add Flow Form State
  const [targetProjectId, setTargetProjectId] = useState<number>(projects[0]?.id || 1);
  const [componentName, setComponentName] = useState('frontend');
  const [envId, setEnvId] = useState<number>(environments[0]?.id || 1);
  const [targetServerId, setTargetServerId] = useState<number | undefined>(servers[0]?.id);
  const [repoPath, setRepoPath] = useState('/opt/app/frontend');
  const [deployScript, setDeployScript] = useState('./deploy.sh');
  const [healthUrl, setHealthUrl] = useState('');

  // Edit Flow Form State
  const [editComponent, setEditComponent] = useState('');
  const [editEnvId, setEditEnvId] = useState<number>(1);
  const [editServerId, setEditServerId] = useState<number | undefined>(undefined);
  const [editRepoPath, setEditRepoPath] = useState('');
  const [editDeployScript, setEditDeployScript] = useState('');
  const [editHealthUrl, setEditHealthUrl] = useState('');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim() || !onAddProject) return;
    try {
      await onAddProject({
        name: projectName.trim(),
        description: projectDesc.trim() || undefined,
        repository_url: repoUrl.trim() || undefined,
      });
      setProjectName('');
      setProjectDesc('');
      setRepoUrl('');
      setShowAddProjectModal(false);
    } catch (err: any) {
      alert(`Failed to create project: ${err.message || err}`);
    }
  };

  const openAddFlowModal = (projectId?: number, defaultEnvId?: number, suggestedComp?: string) => {
    const proj = projects.find(p => p.id === projectId) || projects[0];
    const pId = proj ? proj.id : 1;
    const eId = defaultEnvId || environments[0]?.id || 1;
    setTargetProjectId(pId);
    setEnvId(eId);
    setTargetServerId(servers[0]?.id);
    const comp = suggestedComp || 'frontend';
    setComponentName(comp);
    setRepoPath(`/opt/${proj?.name || 'app'}/${comp}`);
    setDeployScript('./deploy.sh');
    setHealthUrl('');
    setShowAddFlowModal(true);
    setShowAddProjectModal(false);
    setEditingFlow(null);
  };

  const handleCreateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!componentName.trim() || !onAddDeployment) return;
    try {
      await onAddDeployment(Number(targetProjectId), {
        environment_id: Number(envId),
        server_id: targetServerId ? Number(targetServerId) : undefined,
        component: componentName.trim(),
        repository_path: repoPath.trim() || undefined,
        deployment_script: deployScript.trim() || undefined,
        health_check_url: healthUrl.trim() || undefined,
      });
      setShowAddFlowModal(false);
    } catch (err: any) {
      alert(`Failed to create deployment flow: ${err.message || err}`);
    }
  };

  const startEditFlow = (flow: ProjectDeploymentType) => {
    setEditingFlow(flow);
    setEditComponent(flow.component);
    setEditEnvId(flow.environment_id);
    setEditServerId(flow.server_id ? flow.server_id : undefined);
    setEditRepoPath(flow.repository_path || '');
    setEditDeployScript(flow.deployment_script || '');
    setEditHealthUrl(flow.health_check_url || '');
    setShowAddFlowModal(false);
    setShowAddProjectModal(false);
  };

  const handleUpdateFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFlow || !onUpdateDeployment) return;
    try {
      await onUpdateDeployment(editingFlow.id, {
        component: editComponent.trim(),
        environment_id: Number(editEnvId),
        server_id: editServerId ? Number(editServerId) : null,
        repository_path: editRepoPath.trim() || undefined,
        deployment_script: editDeployScript.trim() || undefined,
        health_check_url: editHealthUrl.trim() || undefined,
      });
      setEditingFlow(null);
    } catch (err: any) {
      alert(`Failed to update flow: ${err.message || err}`);
    }
  };

  const getEnvName = (envId: number) => {
    const env = environments.find(e => e.id === envId);
    return env ? env.name : 'uat';
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div className="panel-title">
          <FolderGit2 size={18} style={{ color: '#06b6d4' }} />
          <span>Projects & Component Deployment Flows</span>
        </div>

        {isAdmin ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowAddProjectModal(!showAddProjectModal);
                setShowAddFlowModal(false);
                setEditingFlow(null);
              }}
            >
              <Plus size={14} />
              Add Project
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openAddFlowModal()}
            >
              <Settings2 size={14} />
              Add Deployment Flow
            </button>
          </div>
        ) : (
          <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ShieldAlert size={12} /> {role.toUpperCase()} MODE (Assigned Projects Only)
          </span>
        )}
      </div>

      {/* Add Project Modal */}
      {isAdmin && showAddProjectModal && (
        <form onSubmit={handleCreateProject} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} /> Create New Project Workspace
            </h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddProjectModal(false)}>
              <X size={13} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Project Name *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. billing-service"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Git Repository URL</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. https://github.com/org/billing"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Description</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. Payment and invoices service"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Create Project
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddProjectModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Add Flow Modal */}
      {isAdmin && showAddFlowModal && (
        <form onSubmit={handleCreateFlow} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings2 size={15} /> Add Component Deployment Flow (e.g. Frontend / Backend / Worker)
            </h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddFlowModal(false)}>
              <X size={13} />
            </button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 14 }}>
            Configure individual component services (e.g. frontend, backend) for your environments with custom script paths, execution commands, and assigned Fleet Server nodes.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Project *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(Number(e.target.value))}
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
                value={envId}
                onChange={(e) => setEnvId(Number(e.target.value))}
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
                value={targetServerId || ''}
                onChange={(e) => setTargetServerId(e.target.value ? Number(e.target.value) : undefined)}
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
                placeholder="e.g. frontend, backend, api, worker"
                value={componentName}
                onChange={(e) => setComponentName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Remote Server Path (Location) *</label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. /home/xyloite/agentops or /opt/app"
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Deployment Script / Command *</label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. ./deploy.sh or agentops.sh or docker compose up -d"
                value={deployScript}
                onChange={(e) => setDeployScript(e.target.value)}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Health Check URL (Optional)</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. http://localhost:3000/api/health"
                value={healthUrl}
                onChange={(e) => setHealthUrl(e.target.value)}
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
        <form onSubmit={handleUpdateFlow} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={15} /> Edit Flow: {editingFlow.component}
            </h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingFlow(null)}>
              <X size={13} />
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Component Name *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editComponent}
                onChange={(e) => setEditComponent(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Environment *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4, background: '#111827', color: '#f8fafc' }}
                value={editEnvId}
                onChange={(e) => setEditEnvId(Number(e.target.value))}
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
                value={editServerId || ''}
                onChange={(e) => setEditServerId(e.target.value ? Number(e.target.value) : undefined)}
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
                value={editRepoPath}
                onChange={(e) => setEditRepoPath(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Deployment Script / Command *</label>
              <input
                type="text"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                value={editDeployScript}
                onChange={(e) => setEditDeployScript(e.target.value)}
                required
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Health Check URL (Optional)</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editHealthUrl}
                onChange={(e) => setEditHealthUrl(e.target.value)}
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

      {/* Projects List */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <FolderGit2 size={36} style={{ marginBottom: 10, opacity: 0.5 }} />
            <p>No projects accessible for your account. Contact an administrator to allocate projects to your profile.</p>
          </div>
        ) : (
          projects.map((p) => (
            <div key={p.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
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
                      onClick={() => openAddFlowModal(p.id)}
                      title="Add another component flow (e.g. backend / frontend) to this project"
                    >
                      <Plus size={13} />
                      Add Flow
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

                  {isAdmin && onDeleteProject && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete project "${p.name}"?`)) {
                          onDeleteProject(p.id);
                        }
                      }}
                      title="Delete Project Workspace"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Component Flow</th>
                      <th>Environment</th>
                      <th>Assigned Fleet Node</th>
                      <th>Repo Path (Location)</th>
                      <th>Deploy Script / Command</th>
                      <th>Health Check Endpoint</th>
                      <th>1-Click Trigger</th>
                      {isAdmin && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {p.deployments && p.deployments.length > 0 ? (
                      p.deployments.map((d) => {
                        const envName = getEnvName(d.environment_id);
                        return (
                          <tr key={d.id}>
                            <td>
                              <strong style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Layers size={13} />
                                {d.component}
                              </strong>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  envName.toLowerCase() === 'production'
                                    ? 'badge-warning'
                                    : envName.toLowerCase() === 'qa'
                                    ? 'badge-info'
                                    : 'badge-primary'
                                }`}
                                style={{ fontSize: '10.5px', textTransform: 'uppercase' }}
                              >
                                {envName}
                              </span>
                            </td>
                            <td>
                              {d.server_name ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px' }}>
                                  <ServerIcon size={12} style={{ color: 'var(--accent-blue)' }} /> {d.server_name} ({d.server_hostname})
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Auto (Fleet Node)</span>
                              )}
                            </td>
                            <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                              {d.repository_path || '/opt/app'}
                            </td>
                            <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--accent-cyan)' }}>
                              {d.deployment_script || './deploy.sh'}
                            </td>
                            <td>
                              {d.health_check_url ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-success)', fontSize: '12px' }}>
                                  <Globe size={12} /> {d.health_check_url}
                                </span>
                              ) : (
                                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>None</span>
                              )}
                            </td>
                            <td>
                              {isOperator ? (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => onTriggerDeploy(p.name, d.component, envName)}
                                  title={`Trigger ${d.component} deployment on ${envName.toUpperCase()}`}
                                >
                                  <Play size={12} />
                                  Deploy {envName.toUpperCase()}
                                </button>
                              ) : (
                                <span className="badge badge-pending" style={{ fontSize: '11px' }}>
                                  View Only
                                </span>
                              )}
                            </td>
                            {isAdmin && (
                              <td>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => startEditFlow(d)}
                                    title="Edit Flow Specs"
                                  >
                                    <Edit3 size={12} />
                                  </button>

                                  {onDeleteDeployment && (
                                    <button
                                      className="btn btn-danger btn-sm"
                                      onClick={() => {
                                        if (window.confirm(`Delete flow for component "${d.component}" on ${envName.toUpperCase()}?`)) {
                                          onDeleteDeployment(d.id);
                                        }
                                      }}
                                      title="Remove Flow"
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
                        <td colSpan={isAdmin ? 8 : 7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 16px' }}>
                          <p style={{ marginBottom: 10 }}>No component deployment flows configured yet for <strong>{p.name}</strong>.</p>
                          {isAdmin && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => openAddFlowModal(p.id)}
                            >
                              <Plus size={13} /> Add First Flow (e.g. Frontend or Backend)
                            </button>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
