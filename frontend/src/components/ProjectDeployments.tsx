import React, { useState } from 'react';
import { FolderGit2, Play, Globe, Code, Plus, Trash2, Layers, Settings2, Edit3, X, Server as ServerIcon, ShieldAlert } from 'lucide-react';
import { Project, Environment, Server, ProjectDeployment as ProjectDeploymentType } from '../types';
import { useAuth } from '../context/AuthContext';

interface ProjectDeploymentsProps {
  projects: Project[];
  environments: Environment[];
  servers?: Server[];
  onTriggerDeploy: (projectName: string, component: string, env: string) => void;
  onAddProject?: (projectData: { name: string; description?: string; repository_url?: string }) => Promise<Project>;
  onUpdateProject?: (projectId: number, projectData: { name?: string; description?: string; repository_url?: string }) => Promise<void>;
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
  onUpdateProject,
  onDeleteProject,
  onAddDeployment,
  onUpdateDeployment,
  onDeleteDeployment,
}) => {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const isOperator = role === 'operator' || role === 'admin';

  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showAddFlowModal, setShowAddFlowModal] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ProjectDeploymentType | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Add Project Form State
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [createEnvId, setCreateEnvId] = useState<number>(environments.find(e => e.name === 'uat')?.id || environments[0]?.id || 1);
  const [provisionFrontend, setProvisionFrontend] = useState(true);
  const [provisionBackend, setProvisionBackend] = useState(true);
  const [createServerId, setCreateServerId] = useState<number | undefined>(servers[0]?.id);

  // Edit Project Form State
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [editProjectRepo, setEditProjectRepo] = useState('');

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
      const newProj = await onAddProject({
        name: projectName.trim(),
        description: projectDesc.trim() || undefined,
        repository_url: repoUrl.trim() || undefined,
      });

      // Automatically provision selected initial component flows (e.g. UAT or DEVELOP)
      if (newProj && newProj.id && onAddDeployment) {
        const pName = projectName.trim();
        if (provisionFrontend) {
          await onAddDeployment(newProj.id, {
            environment_id: createEnvId,
            component: 'frontend',
            server_id: createServerId ? Number(createServerId) : undefined,
            repository_path: `/opt/${pName}/frontend`,
            deployment_script: './deploy.sh',
          });
        }
        if (provisionBackend) {
          await onAddDeployment(newProj.id, {
            environment_id: createEnvId,
            component: 'backend',
            server_id: createServerId ? Number(createServerId) : undefined,
            repository_path: `/opt/${pName}/backend`,
            deployment_script: './deploy.sh',
          });
        }
      }

      setProjectName('');
      setProjectDesc('');
      setRepoUrl('');
      setShowAddProjectModal(false);
    } catch (err: any) {
      alert(`Failed to create project: ${err.message || err}`);
    }
  };

  const startEditProject = (project: Project) => {
    setEditingProject(project);
    setEditProjectName(project.name);
    setEditProjectDesc(project.description || '');
    setEditProjectRepo(project.repository_url || '');
    setShowEditProjectModal(true);
    setShowAddProjectModal(false);
    setShowAddFlowModal(false);
    setEditingFlow(null);
  };

  const handleUpdateProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !onUpdateProject) return;
    try {
      await onUpdateProject(editingProject.id, {
        name: editProjectName.trim() || undefined,
        description: editProjectDesc.trim() || undefined,
        repository_url: editProjectRepo.trim() || undefined,
      });
      setShowEditProjectModal(false);
      setEditingProject(null);
    } catch (err: any) {
      alert(`Failed to update project: ${err.message || err}`);
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
                setShowEditProjectModal(false);
                setShowAddFlowModal(false);
                setEditingFlow(null);
                setEditingProject(null);
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
              <Plus size={15} /> Create New Project Workspace & Initial Environment Flows
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
                placeholder="e.g. Core Billing Platform"
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Initial Target Environment *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={createEnvId}
                onChange={(e) => setCreateEnvId(Number(e.target.value))}
              >
                {environments.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.name.toUpperCase()} {env.name.toLowerCase() === 'uat' ? '(UAT Environment)' : env.name.toLowerCase() === 'develop' ? '(Development Environment)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assign Fleet Server Node</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={createServerId || ''}
                onChange={(e) => setCreateServerId(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">Auto-resolve from fleet</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.hostname})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Auto-Provision Initial Component Flows in this Environment:
              </label>
              <div style={{ display: 'flex', gap: 16, background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={provisionFrontend}
                    onChange={(e) => setProvisionFrontend(e.target.checked)}
                  />
                  <strong>Frontend Flow</strong> <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>(/opt/{projectName || 'project'}/frontend)</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={provisionBackend}
                    onChange={(e) => setProvisionBackend(e.target.checked)}
                  />
                  <strong>Backend Flow</strong> <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>(/opt/{projectName || 'project'}/backend)</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, gridColumn: 'span 2' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Create Project & Flows
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddProjectModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Edit Project Modal */}
      {isAdmin && showEditProjectModal && editingProject && (
        <form onSubmit={handleUpdateProjectSubmit} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={15} /> Edit Project Workspace: {editingProject.name}
            </h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditProjectModal(false)}>
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
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Git Repository URL</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editProjectRepo}
                onChange={(e) => setEditProjectRepo(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Description</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editProjectDesc}
                onChange={(e) => setEditProjectDesc(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, gridColumn: 'span 2' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                Save Project Details
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowEditProjectModal(false)}>
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
                style={{ width: '100%', marginTop: 4 }}
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(Number(e.target.value))}
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
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Target Environment *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={envId}
                onChange={(e) => setEnvId(Number(e.target.value))}
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
                value={targetServerId || ''}
                onChange={(e) => setTargetServerId(e.target.value ? Number(e.target.value) : undefined)}
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

      {/* Projects List */}
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            <FolderGit2 size={36} style={{ marginBottom: 10, opacity: 0.5 }} />
            <p>No projects accessible for your account. Contact an administrator to allocate projects to your profile.</p>
          </div>
        ) : (
          projects.map((p) => {
            // Group deployments by environment_id
            const allDeployments = p.deployments || [];
            const envMap: { [envId: number]: ProjectDeploymentType[] } = {};
            allDeployments.forEach((d) => {
              if (!envMap[d.environment_id]) envMap[d.environment_id] = [];
              envMap[d.environment_id].push(d);
            });

            const configuredEnvIds = Object.keys(envMap).map(Number);

            return (
              <div key={p.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                {/* Project Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: '17px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FolderGit2 size={18} style={{ color: 'var(--accent-cyan)' }} />
                      {p.name}
                      <span className="badge badge-primary" style={{ fontSize: '11px' }}>
                        {allDeployments.length} {allDeployments.length === 1 ? 'Flow' : 'Total Flows'}
                      </span>
                      {configuredEnvIds.map((eId) => {
                        const envObj = environments.find(e => e.id === eId);
                        const eName = envObj?.name?.toUpperCase() || `ENV-${eId}`;
                        const isProd = eName.toLowerCase().includes('prod');
                        const isUat = eName.toLowerCase().includes('uat');
                        const isDev = eName.toLowerCase().includes('dev');
                        const badgeStyle = isProd ? 'badge-warning' : isUat ? 'badge-success' : isDev ? 'badge-primary' : 'badge-info';
                        return (
                          <span key={eId} className={`badge ${badgeStyle}`} style={{ fontSize: '10px' }}>
                            {eName}
                          </span>
                        );
                      })}
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 3 }}>{p.description || 'Configured Project Workspace'}</p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isAdmin && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openAddFlowModal(p.id)}
                        title="Add another component flow to this project"
                        style={{ whiteSpace: 'nowrap' }}
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
                        style={{ color: 'var(--accent-blue)', textDecoration: 'none', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: 4 }}
                      >
                        <Code size={13} />
                        {p.repository_url}
                      </a>
                    )}

                    {isAdmin && onUpdateProject && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => startEditProject(p)}
                        title="Edit Project Details"
                      >
                        <Edit3 size={13} />
                      </button>
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

                {/* Categorized Environment Flow Blocks */}
                {configuredEnvIds.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {configuredEnvIds.map((eId) => {
                      const envObj = environments.find(e => e.id === eId);
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
                            border: `1px solid var(--border-subtle)`,
                            borderLeft: `3px solid ${accentColor}`,
                            borderRadius: 'var(--radius-md)',
                            padding: '14px 16px',
                          }}
                        >
                          {/* Environment Group Header */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className={`badge ${badgeClass}`} style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.5px' }}>
                                {eName} ENVIRONMENT
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                ({envFlows.length} {envFlows.length === 1 ? 'component service' : 'component services'})
                              </span>
                            </div>

                            {isAdmin && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
                                onClick={() => openAddFlowModal(p.id, eId, envFlows.some(f => f.component.toLowerCase() === 'frontend') ? 'backend' : 'frontend')}
                              >
                                <Plus size={12} /> Add Component to {eName}
                              </button>
                            )}
                          </div>

                          {/* Environment Flow Table */}
                          <div className="table-container" style={{ margin: 0, border: 'none', background: 'transparent' }}>
                            <table className="data-table" style={{ width: '100%' }}>
                              <thead>
                                <tr>
                                  <th style={{ width: '15%', whiteSpace: 'nowrap' }}>Component Flow</th>
                                  <th style={{ width: '22%', whiteSpace: 'nowrap' }}>Assigned Fleet Node</th>
                                  <th style={{ width: '22%', whiteSpace: 'nowrap' }}>Repo Path (Location)</th>
                                  <th style={{ width: '16%', whiteSpace: 'nowrap' }}>Deploy Script / Command</th>
                                  <th style={{ width: '13%', whiteSpace: 'nowrap' }}>Health Check</th>
                                  <th style={{ width: '12%', whiteSpace: 'nowrap' }}>1-Click Trigger</th>
                                  {isAdmin && <th style={{ width: '8%', whiteSpace: 'nowrap' }}>Actions</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {envFlows.map((d) => (
                                  <React.Fragment key={d.id}>
                                    <tr>
                                    <td>
                                      <strong style={{ color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6, fontSize: '12.5px' }}>
                                        <Layers size={13} />
                                        {d.component}
                                      </strong>
                                    </td>
                                    <td>
                                      {d.server_name ? (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '12px', whiteSpace: 'nowrap' }}>
                                          <ServerIcon size={12} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} /> {d.server_name} ({d.server_hostname})
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
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--status-success)', fontSize: '11.5px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                          <Globe size={11} style={{ flexShrink: 0 }} /> {d.health_check_url}
                                        </span>
                                      ) : (
                                        <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>None</span>
                                      )}
                                    </td>
                                    <td>
                                      {isOperator ? (
                                        <button
                                          className="btn btn-primary btn-sm"
                                          onClick={() => onTriggerDeploy(p.name, d.component, envObj?.name || 'uat')}
                                          title={`Trigger ${d.component} deployment on ${eName}`}
                                          style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', fontSize: '11.5px' }}
                                        >
                                          <Play size={12} />
                                          Deploy {eName}
                                        </button>
                                      ) : (
                                        <span className="badge badge-pending" style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
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
                                                if (window.confirm(`Delete flow for component "${d.component}" on ${eName}?`)) {
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
                                  {isAdmin && editingFlow?.id === d.id && (
                                    <tr>
                                      <td colSpan={isAdmin ? 7 : 6} style={{ padding: 0 }}>
                                        <form onSubmit={handleUpdateFlow} style={{ padding: '20px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--accent-cyan)' }}>
                                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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
                                                style={{ width: '100%', marginTop: 4 }}
                                                value={editEnvId}
                                                onChange={(e) => setEditEnvId(Number(e.target.value))}
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
                                                value={editServerId || ''}
                                                onChange={(e) => setEditServerId(e.target.value ? Number(e.target.value) : undefined)}
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
                                      </td>
                                    </tr>
                                  )}
                                  </React.Fragment>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 16px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-subtle)' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 12, fontSize: '13px' }}>
                      No environment deployment flows configured yet for <strong>{p.name}</strong>.
                    </p>
                    {isAdmin && (
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openAddFlowModal(p.id, environments.find(e => e.name === 'uat')?.id || 1, 'frontend')}
                        >
                          <Plus size={13} /> + Add UAT Flow (Frontend/Backend)
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openAddFlowModal(p.id, environments.find(e => e.name === 'develop')?.id || 4, 'frontend')}
                        >
                          <Plus size={13} /> + Add DEVELOP Flow
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
