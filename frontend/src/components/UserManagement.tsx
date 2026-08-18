import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Check, X, Edit3 } from 'lucide-react';
import { User, Project, UserRole } from '../types';
import { listUsersApi, createUserApi, updateUserApi, deleteUserApi, assignUserProjectsApi } from '../services/api';

interface UserManagementProps {
  projects: Project[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ projects }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Add User State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [createProjectIds, setCreateProjectIds] = useState<number[]>([]);

  // Edit User State
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('operator');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState('');
  const [editProjectIds, setEditProjectIds] = useState<number[]>([]);

  // Inline project assignment state
  const [editingProjectsUserId, setEditingProjectsUserId] = useState<number | null>(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);

  const loadUsers = async () => {
    try {
      const data = await listUsersApi();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const startEditingUser = (u: User) => {
    setEditingUser(u);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditIsActive(u.is_active !== false);
    setEditPassword('');
    const currentIds = projects.filter((p) => u.assigned_projects?.includes(p.name)).map((p) => p.id);
    setEditProjectIds(currentIds);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) return;
    try {
      await createUserApi({
        username,
        email,
        password,
        role,
        project_ids: role === 'admin' ? undefined : createProjectIds,
      });
      setUsername('');
      setEmail('');
      setPassword('');
      setCreateProjectIds([]);
      setShowAddModal(false);
      await loadUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await updateUserApi(editingUser.id, {
        email: editEmail,
        role: editRole,
        is_active: editIsActive,
        password: editPassword ? editPassword : undefined,
        project_ids: editRole === 'admin' ? undefined : editProjectIds,
      });
      setEditingUser(null);
      await loadUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await deleteUserApi(userId);
        await loadUsers();
      } catch (err: any) {
        alert(`Error: ${err.message}`);
      }
    }
  };

  const handleSaveProjects = async (userId: number) => {
    try {
      await assignUserProjectsApi(userId, selectedProjectIds);
      setEditingProjectsUserId(null);
      await loadUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return <span className="badge badge-warning">ADMIN</span>;
      case 'operator':
        return <span className="badge badge-running">OPERATOR</span>;
      case 'viewer':
        return <span className="badge badge-pending">VIEWER</span>;
    }
  };

  return (
    <div className="card-panel">
      <div className="panel-header">
        <div className="panel-title">
          <Users size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>User Management & RBAC Governance</span>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => { setShowAddModal(!showAddModal); setEditingUser(null); setCreateProjectIds([]); }}>
          <UserPlus size={14} />
          Create User
        </button>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <form onSubmit={handleCreateUser} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <h4 style={{ fontSize: '13px', color: 'var(--accent-blue)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserPlus size={15} /> Create New User
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Username *</label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="e.g. devops_lead"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Email *</label>
              <input
                type="email"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Password *</label>
              <input
                type="password"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assigned Role *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="operator">Operator (Deploy & Execute)</option>
                <option value="viewer">Viewer (Read Only)</option>
                <option value="admin">Admin (Full Control)</option>
              </select>
            </div>

            {role !== 'admin' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Assigned Projects (Select Multiple Projects for Operator / Viewer Access):
                </label>
                {projects.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                    {projects.map((p) => {
                      const isChecked = createProjectIds.includes(p.id);
                      return (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer', background: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 4, border: `1px solid ${isChecked ? 'var(--accent-blue)' : 'var(--border-subtle)'}` }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCreateProjectIds((prev) => [...prev, p.id]);
                              } else {
                                setCreateProjectIds((prev) => prev.filter((id) => id !== p.id));
                              }
                            }}
                          />
                          <strong>{p.name}</strong>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No projects available to assign. Create a project in the Projects tab first.</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, gridColumn: 'span 2' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save User</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <form onSubmit={handleUpdateUser} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontSize: '13px', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Edit3 size={15} /> Edit User: {editingUser.username} (#{editingUser.id})
            </h4>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingUser(null)}>
              <X size={13} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Email *</label>
              <input
                type="email"
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Role *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
              >
                <option value="operator">Operator (Deploy & Execute)</option>
                <option value="viewer">Viewer (Read Only)</option>
                <option value="admin">Admin (Full Control)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Status *</label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 4 }}
                value={editIsActive ? 'active' : 'disabled'}
                onChange={(e) => setEditIsActive(e.target.value === 'active')}
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled / Suspended</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Reset Password (Optional)</label>
              <input
                type="password"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 4 }}
                placeholder="Enter new password to reset"
                value={editPassword}
                onChange={(e) => setEditPassword(e.target.value)}
              />
            </div>

            {editRole !== 'admin' && (
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                  Assigned Projects (Multi-Select for Operator / Viewer Access):
                </label>
                {projects.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)' }}>
                    {projects.map((p) => {
                      const isChecked = editProjectIds.includes(p.id);
                      return (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer', background: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-secondary)', padding: '4px 10px', borderRadius: 4, border: `1px solid ${isChecked ? 'var(--accent-blue)' : 'var(--border-subtle)'}` }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEditProjectIds((prev) => [...prev, p.id]);
                              } else {
                                setEditProjectIds((prev) => prev.filter((id) => id !== p.id));
                              }
                            }}
                          />
                          <strong>{p.name}</strong>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No projects available to assign.</div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, gridColumn: 'span 2' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Update User</button>
              <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
            </div>
          </div>
        </form>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Username & Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Assigned Projects (Multi-Tenancy)</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                  #{u.id}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{u.username}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{u.email}</div>
                </td>
                <td>{getRoleBadge(u.role)}</td>
                <td>
                  {u.is_active !== false ? (
                    <span className="badge badge-success">ACTIVE</span>
                  ) : (
                    <span className="badge badge-danger">DISABLED</span>
                  )}
                </td>
                <td>
                  {u.role === 'admin' ? (
                    <span style={{ fontSize: '12px', color: 'var(--status-warning)' }}>
                      All Projects (Global Admin)
                    </span>
                  ) : editingProjectsUserId === u.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {projects.map((p) => {
                          const isChecked = selectedProjectIds.includes(p.id);
                          return (
                            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '12px', cursor: 'pointer', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4 }}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProjectIds((prev) => [...prev, p.id]);
                                  } else {
                                    setSelectedProjectIds((prev) => prev.filter((id) => id !== p.id));
                                  }
                                }}
                              />
                              {p.name}
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary btn-sm" onClick={() => handleSaveProjects(u.id)}>
                          <Check size={12} /> Save
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingProjectsUserId(null)}>
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {u.assigned_projects && u.assigned_projects.length > 0
                          ? u.assigned_projects.join(', ')
                          : 'No projects assigned'}
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '2px 6px', fontSize: '10px' }}
                        onClick={() => {
                          setEditingProjectsUserId(u.id);
                          const currentIds = projects.filter((p) => u.assigned_projects?.includes(p.name)).map((p) => p.id);
                          setSelectedProjectIds(currentIds);
                        }}
                      >
                        Projects
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => startEditingUser(u)}
                      title="Edit User Profile"
                    >
                      <Edit3 size={12} />
                      Edit
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDeleteUser(u.id)}
                      title="Delete User"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

