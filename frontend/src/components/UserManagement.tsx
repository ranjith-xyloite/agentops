import React, { useState, useEffect, useMemo } from 'react';
import { Users, UserPlus, Trash2, Check, X, Edit3, Search, Shield, KeyRound, Mail, User as UserIcon } from 'lucide-react';
import { User, Project, UserRole } from '../types';
import { listUsersApi, createUserApi, updateUserApi, deleteUserApi, assignUserProjectsApi } from '../services/api';
import { PaginationControls } from './PaginationControls';

interface UserManagementProps {
  projects: Project[];
}

export const UserManagement: React.FC<UserManagementProps> = ({ projects }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Add User State
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [createProjectIds, setCreateProjectIds] = useState<number[]>([]);

  // Edit User State (Inline)
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('operator');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editPassword, setEditPassword] = useState('');
  const [editProjectIds, setEditProjectIds] = useState<number[]>([]);

  // Inline project assignment quick modal state
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

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term) ||
        u.role.toLowerCase().includes(term) ||
        (u.assigned_projects && u.assigned_projects.some((p) => p.toLowerCase().includes(term)))
    );
  }, [users, searchTerm]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  const startEditingUser = (u: User) => {
    if (editingUser?.id === u.id) {
      setEditingUser(null);
      return;
    }
    setEditingUser(u);
    setEditUsername(u.username);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditIsActive(u.is_active !== false);
    setEditPassword('');
    const currentIds = projects.filter((p) => u.assigned_projects?.includes(p.name)).map((p) => p.id);
    setEditProjectIds(currentIds);
    setEditingProjectsUserId(null);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) return;
    try {
      await createUserApi({
        username: username.trim(),
        email: email.trim(),
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
        username: editUsername.trim(),
        email: editEmail.trim(),
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
        if (editingUser?.id === userId) setEditingUser(null);
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
    <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header bar */}
      <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="panel-title">
          <Users size={18} style={{ color: 'var(--accent-blue)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>User Management & RBAC Governance</span>
            <span className="badge badge-primary" style={{ fontSize: '11px' }}>
              {filteredUsers.length} Users
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="chat-input"
              style={{ padding: '6px 12px 6px 30px', fontSize: '12px', width: '200px' }}
              placeholder="Search user, email, role..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowAddModal(!showAddModal);
              setEditingUser(null);
              setCreateProjectIds([]);
            }}
          >
            <UserPlus size={14} />
            Create User
          </button>
        </div>
      </div>

      {/* Add User Panel */}
      {showAddModal && (
        <form
          onSubmit={handleCreateUser}
          style={{
            padding: 24,
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h4 style={{ fontSize: '14px', color: 'var(--accent-blue)', margin: 0, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
              <UserPlus size={16} /> Create New User
            </h4>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              ℹ️ Users can sign in using either their <strong>Username</strong> or <strong>Email ID</strong>.
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <UserIcon size={12} /> Username *
              </label>
              <input
                type="text"
                className="chat-input"
                style={{ width: '100%', marginTop: 5 }}
                placeholder="e.g. ranjith"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mail size={12} /> Email Address *
              </label>
              <input
                type="email"
                className="chat-input"
                style={{ width: '100%', marginTop: 5 }}
                placeholder="e.g. ranjith.g@xyloite.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <KeyRound size={12} /> Password *
              </label>
              <input
                type="password"
                className="chat-input font-mono"
                style={{ width: '100%', marginTop: 5 }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Shield size={12} /> Assigned Role *
              </label>
              <select
                className="chat-input"
                style={{ width: '100%', marginTop: 5 }}
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
              >
                <option value="operator">Operator (Deploy & Execute)</option>
                <option value="viewer">Viewer (Read Only)</option>
                <option value="admin">Admin (Full Control)</option>
              </select>
            </div>

            {role !== 'admin' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: 6, fontWeight: 600 }}>
                  Assigned Projects (Multi-Tenancy Access):
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, gridColumn: '1 / -1', marginTop: 4 }}>
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px' }}>
                Save & Create User
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Users Table */}
      <div className="table-container" style={{ margin: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Username & Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Assigned Projects (Multi-Tenancy)</th>
              <th>Created</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px' }}>
                  <Users size={28} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                  <div>No users found matching the search criteria.</div>
                </td>
              </tr>
            ) : (
              paginatedUsers.map((u) => {
                const isCurrentlyEditing = editingUser?.id === u.id;

                return (
                  <React.Fragment key={u.id}>
                    <tr style={{ background: isCurrentlyEditing ? 'rgba(56, 189, 248, 0.05)' : undefined }}>
                      <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                        #{u.id}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#f0f6fc' }}>{u.username}</div>
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
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            className={isCurrentlyEditing ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                            onClick={() => startEditingUser(u)}
                            title="Edit User Profile"
                          >
                            <Edit3 size={12} />
                            {isCurrentlyEditing ? 'Editing' : 'Edit'}
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

                    {/* Inline Edit Form Row (Stays in the exact same place right below the user) */}
                    {isCurrentlyEditing && (
                      <tr>
                        <td colSpan={7} style={{ padding: 0, background: '#111827', borderBottom: '2px solid var(--accent-blue)' }}>
                          <form
                            onSubmit={handleUpdateUser}
                            style={{
                              padding: '18px 24px',
                              borderLeft: '4px solid var(--accent-blue)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 14,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Edit3 size={15} style={{ color: 'var(--accent-blue)' }} />
                                <span style={{ fontWeight: 700, fontSize: '13.5px', color: '#f0f6fc' }}>
                                  Editing User #{u.id}: <span style={{ color: 'var(--accent-cyan)' }}>{u.username}</span>
                                </span>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                Press 'Save Changes' to apply updates immediately.
                              </span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  Username *
                                </label>
                                <input
                                  type="text"
                                  className="chat-input"
                                  style={{ width: '100%', marginTop: 4, background: '#0d1117' }}
                                  value={editUsername}
                                  onChange={(e) => setEditUsername(e.target.value)}
                                  required
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  Email *
                                </label>
                                <input
                                  type="email"
                                  className="chat-input"
                                  style={{ width: '100%', marginTop: 4, background: '#0d1117' }}
                                  value={editEmail}
                                  onChange={(e) => setEditEmail(e.target.value)}
                                  required
                                />
                              </div>

                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  Role *
                                </label>
                                <select
                                  className="chat-input"
                                  style={{ width: '100%', marginTop: 4, background: '#0d1117' }}
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                                >
                                  <option value="operator">Operator (Deploy & Execute)</option>
                                  <option value="viewer">Viewer (Read Only)</option>
                                  <option value="admin">Admin (Full Control)</option>
                                </select>
                              </div>

                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  Status *
                                </label>
                                <select
                                  className="chat-input"
                                  style={{ width: '100%', marginTop: 4, background: '#0d1117' }}
                                  value={editIsActive ? 'active' : 'disabled'}
                                  onChange={(e) => setEditIsActive(e.target.value === 'active')}
                                >
                                  <option value="active">Active</option>
                                  <option value="disabled">Disabled / Suspended</option>
                                </select>
                              </div>

                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  Reset Password (Optional)
                                </label>
                                <input
                                  type="password"
                                  className="chat-input font-mono"
                                  style={{ width: '100%', marginTop: 4, background: '#0d1117' }}
                                  placeholder="New password (leave blank to keep)"
                                  value={editPassword}
                                  onChange={(e) => setEditPassword(e.target.value)}
                                />
                              </div>
                            </div>

                            {editRole !== 'admin' && (
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                                  Assigned Projects (Multi-Tenancy Access):
                                </label>
                                {projects.length > 0 ? (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 8, background: '#0d1117', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                                    {projects.map((p) => {
                                      const isChecked = editProjectIds.includes(p.id);
                                      return (
                                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', cursor: 'pointer', background: isChecked ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.04)', padding: '4px 10px', borderRadius: 4, border: `1px solid ${isChecked ? 'var(--accent-blue)' : 'rgba(255, 255, 255, 0.1)'}` }}>
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                              <button type="submit" className="btn btn-primary" style={{ padding: '7px 18px', fontSize: '12px' }}>
                                Save Changes
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary"
                                style={{ padding: '7px 14px', fontSize: '12px' }}
                                onClick={() => setEditingUser(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <PaginationControls
        currentPage={currentPage}
        totalItems={filteredUsers.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel="users"
      />
    </div>
  );
};
