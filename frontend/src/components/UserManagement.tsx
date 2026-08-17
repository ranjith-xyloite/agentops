import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Check, X } from 'lucide-react';
import { User, Project, UserRole } from '../types';
import { listUsersApi, createUserApi, deleteUserApi, assignUserProjectsApi } from '../services/api';

interface UserManagementProps {
  projects: Project[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ projects }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) return;
    try {
      await createUserApi({ username, email, password, role });
      setUsername('');
      setEmail('');
      setPassword('');
      setShowAddModal(false);
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
      setEditingUserId(null);
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

        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(!showAddModal)}>
          <UserPlus size={14} />
          Create User
        </button>
      </div>

      {showAddModal && (
        <form onSubmit={handleCreateUser} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Username</label>
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
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Email</label>
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
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Password</label>
            <input
              type="password"
              className="chat-input"
              style={{ width: '100%', marginTop: 4 }}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assigned Role</label>
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

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save User</button>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
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
                  {u.role === 'admin' ? (
                    <span style={{ fontSize: '12px', color: 'var(--status-warning)' }}>
                      All Projects (Global Admin)
                    </span>
                  ) : editingUserId === u.id ? (
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
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingUserId(null)}>
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
                          setEditingUserId(u.id);
                          const currentIds = projects.filter((p) => u.assigned_projects?.includes(p.name)).map((p) => p.id);
                          setSelectedProjectIds(currentIds);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </td>
                <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Active'}
                </td>
                <td>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDeleteUser(u.id)}
                    title="Delete User"
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
