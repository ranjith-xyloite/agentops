import React, { useState, useEffect } from 'react';
import {
  Terminal, Server, FolderGit2, ListTodo, Users, Key, History,
  LogOut, User as UserIcon, Shield, Activity, CalendarClock,
  ShieldAlert, Sparkles, Cpu, X, Rocket, Layers
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LLMProviderStatus } from '../types';
import { getLLMStatusApi, setLLMProviderApi } from '../services/api';

export type NavTab =
  | 'console'
  | 'deploy'
  | 'tasks'
  | 'workflows'
  | 'infrastructure'
  | 'projects'
  | 'schedules'
  | 'policies-webhooks'
  | 'observability'
  | 'users'
  | 'api-keys'
  | 'audit-logs';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeTasksCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, activeTasksCount }) => {
  const { user, role, logout } = useAuth();
  const [llmStatus, setLlmStatus] = useState<LLMProviderStatus | null>(null);
  const [showLLMModal, setShowLLMModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [selectedModel, setSelectedModel] = useState('qwen3');
  const [apiKey, setApiKey] = useState('');

  const fetchLLMStatus = async () => {
    try {
      const res = await getLLMStatusApi();
      setLlmStatus(res);
      setSelectedProvider(res.active_provider);
      setSelectedModel(res.active_model);
    } catch (e) {
      // ignore
    }
  };

  useEffect(() => {
    fetchLLMStatus();
  }, []);

  const handleSaveLLM = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setLLMProviderApi({
        provider: selectedProvider,
        model_name: selectedModel,
        api_key: apiKey || undefined,
      });
      await fetchLLMStatus();
      setShowLLMModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to update LLM provider');
    }
  };

  const getRoleBadgeClass = () => {
    switch (role) {
      case 'admin':
        return 'badge-warning';
      case 'operator':
        return 'badge-running';
      case 'viewer':
        return 'badge-pending';
    }
  };

  return (
    <header className="navbar">
      <div className="nav-brand">
        <div className="brand-icon">
          <Shield size={18} />
        </div>
        <div className="brand-title">
          AgentOps <span className="brand-badge">Phase 6 Autonomous</span>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${activeTab === 'console' ? 'active' : ''}`}
          onClick={() => setActiveTab('console')}
        >
          <Terminal size={15} />
          AI Console
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'deploy' ? 'active' : ''}`}
          onClick={() => setActiveTab('deploy')}
        >
          <Rocket size={15} style={{ color: 'var(--status-success)' }} />
          Deploy Hub
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          <ListTodo size={15} />
          Tasks
          {activeTasksCount > 0 && (
            <span className="badge badge-running" style={{ marginLeft: 4, padding: '1px 5px' }}>
              {activeTasksCount}
            </span>
          )}
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'workflows' ? 'active' : ''}`}
          onClick={() => setActiveTab('workflows')}
        >
          <Layers size={15} style={{ color: 'var(--accent-purple)' }} />
          Workflows
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'infrastructure' ? 'active' : ''}`}
          onClick={() => setActiveTab('infrastructure')}
        >
          <Server size={15} />
          Fleet
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => setActiveTab('projects')}
        >
          <FolderGit2 size={15} />
          Projects
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'schedules' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedules')}
        >
          <CalendarClock size={15} />
          Schedules
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'policies-webhooks' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies-webhooks')}
        >
          <ShieldAlert size={15} />
          Policies & Webhooks
        </button>

        <button
          className={`nav-tab-btn ${activeTab === 'observability' ? 'active' : ''}`}
          onClick={() => setActiveTab('observability')}
        >
          <Activity size={15} />
          Observability
        </button>

        {role === 'admin' && (
          <button
            className={`nav-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <Users size={15} />
            Users
          </button>
        )}

        {(role === 'admin' || role === 'operator') && (
          <button
            className={`nav-tab-btn ${activeTab === 'api-keys' ? 'active' : ''}`}
            onClick={() => setActiveTab('api-keys')}
          >
            <Key size={15} />
            API Keys
          </button>
        )}

        {(role === 'admin' || role === 'operator') && (
          <button
            className={`nav-tab-btn ${activeTab === 'audit-logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit-logs')}
          >
            <History size={15} />
            Audit Logs
          </button>
        )}
      </nav>

      <div className="nav-status-group">
        {/* Multi-LLM Gateway Switcher Badge */}
        {llmStatus && (
          <button
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', padding: '4px 8px' }}
            onClick={() => setShowLLMModal(true)}
            title="Configure Multi-LLM Provider Engine"
          >
            <Sparkles size={13} style={{ color: 'var(--accent-purple)' }} />
            <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{llmStatus.active_provider}</span>
            <span style={{ color: 'var(--text-muted)' }}>({llmStatus.active_model})</span>
          </button>
        )}

        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '4px 10px',
              fontSize: '12px'
            }}>
              <UserIcon size={14} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ fontWeight: 600 }}>{user.username}</span>
              <span className={`badge ${getRoleBadgeClass()}`} style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                {role}
              </span>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={logout}
              title="Sign Out"
              style={{ padding: '6px 10px' }}
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <div className="system-status-indicator">
            <span className="status-dot"></span>
            <span>Unauthenticated</span>
          </div>
        )}
      </div>

      {/* Multi-LLM Provider Configuration Modal */}
      {showLLMModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(7, 10, 17, 0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '480px', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={18} style={{ color: 'var(--accent-purple)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Multi-LLM Gateway Settings</h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowLLMModal(false)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveLLM} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Active LLM Provider</label>
                <select className="input-field" value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)}>
                  <option value="ollama">Local Ollama (qwen3 / llama3)</option>
                  <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 / 2.0)</option>
                  <option value="heuristic_fallback">Offline Deterministic Heuristic</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Model Name</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="e.g. qwen3, gpt-4o-mini, claude-3-5-sonnet"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                />
              </div>

              {selectedProvider !== 'ollama' && selectedProvider !== 'heuristic_fallback' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>API Key / Secret</label>
                  <input
                    type="password"
                    className="input-field font-mono"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLLMModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Provider</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
