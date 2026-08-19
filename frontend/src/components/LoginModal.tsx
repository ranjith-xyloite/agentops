import React, { useState } from 'react';
import { Shield, Lock, User, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';

export const LoginModal: React.FC = () => {
  const { login, demoLogin, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (isAuthenticated) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    setIsLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async (role: UserRole) => {
    setIsLoading(true);
    setError(null);
    try {
      await demoLogin(role);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-medium)',
        borderRadius: 'var(--radius-lg)',
        width: '100%',
        maxWidth: '440px',
        padding: '32px',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div className="brand-icon" style={{ width: 40, height: 40 }}>
            <Shield size={22} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>XyOps Authentication</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Xyloite Technologies DevOps & Multi-Tenancy Portal</p>
          </div>
        </div>

        {/* Quick 1-Click Demo Login Selector */}
        <div style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '14px',
          marginBottom: '20px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} /> Quick Demo Logins (1-Click)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', flexDirection: 'column', padding: '8px 4px', gap: 2 }}
              onClick={() => handleDemo('admin')}
              disabled={isLoading}
            >
              <span style={{ fontWeight: 700, color: 'var(--status-warning)' }}>Admin</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Full Access</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', flexDirection: 'column', padding: '8px 4px', gap: 2 }}
              onClick={() => handleDemo('operator')}
              disabled={isLoading}
            >
              <span style={{ fontWeight: 700, color: 'var(--status-running)' }}>Operator</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Deploy & Fleet</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', flexDirection: 'column', padding: '8px 4px', gap: 2 }}
              onClick={() => handleDemo('viewer')}
              disabled={isLoading}
            >
              <span style={{ fontWeight: 700, color: 'var(--status-info)' }}>Viewer</span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Read Only</span>
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid var(--status-failed)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px',
            color: 'var(--status-failed)',
            fontSize: '12px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
              Username or Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="input-field"
                style={{ width: '100%', paddingLeft: '32px' }}
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
              <User size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="input-field"
                style={{ width: '100%', paddingLeft: '32px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <Lock size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 8, padding: '10px 16px' }}
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Sign In to XyOps'}
          </button>
        </form>
      </div>
    </div>
  );
};
