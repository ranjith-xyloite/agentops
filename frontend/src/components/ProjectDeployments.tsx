import React from 'react';
import { FolderGit2, Play, Globe, Code } from 'lucide-react';
import { Project } from '../types';

interface ProjectDeploymentsProps {
  projects: Project[];
  onTriggerDeploy: (projectName: string, component: string, env: string) => void;
}

export const ProjectDeployments: React.FC<ProjectDeploymentsProps> = ({
  projects,
  onTriggerDeploy,
}) => {
  return (
    <div className="card-panel">
      <div className="panel-header">
        <div className="panel-title">
          <FolderGit2 size={18} style={{ color: '#06b6d4' }} />
          <span>Projects & Component Deployments</span>
        </div>
      </div>

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {projects.map((p) => (
          <div key={p.id} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{p.name}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 2 }}>{p.description || 'Configured Project Service'}</p>
              </div>

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

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Repo Path</th>
                    <th>Script</th>
                    <th>Health Check Endpoint</th>
                    <th>Quick Deploy</th>
                  </tr>
                </thead>
                <tbody>
                  {p.deployments && p.deployments.length > 0 ? (
                    p.deployments.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong style={{ color: 'var(--accent-cyan)' }}>{d.component}</strong>
                        </td>
                        <td className="font-mono" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                          {d.repository_path || '/opt/app'}
                        </td>
                        <td className="font-mono" style={{ fontSize: '11.5px' }}>
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
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onTriggerDeploy(p.name, d.component, 'uat')}
                              title="Deploy to UAT"
                            >
                              <Play size={12} />
                              Deploy UAT
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => onTriggerDeploy(p.name, d.component, 'production')}
                              title="Deploy to Production"
                            >
                              Deploy Prod
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No deployments configured for this project.
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
  );
};
