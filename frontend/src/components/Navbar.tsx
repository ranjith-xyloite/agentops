import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Terminal, Server, FolderGit2, ListTodo, Users, Key, History,
  LogOut, User as UserIcon, Activity, CalendarClock,
  ShieldAlert, Sparkles, Cpu, X, Rocket, Layers,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { LLMProviderStatus } from '../types';
import { getLLMStatusApi, setLLMProviderApi } from '../services/api';
import { ThemeToggle } from './ThemeToggle';

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
  setActiveTab?: (tab: NavTab) => void;
  activeTasksCount: number;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  llmStatus?: LLMProviderStatus | null;
  onRefreshLLM?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  activeTasksCount,
}) => {
  const { user, role, logout } = useAuth();
  const [llmStatus, setLlmStatus] = useState<LLMProviderStatus | null>(null);
  const [showLLMModal, setShowLLMModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [selectedModel, setSelectedModel] = useState('qwen3');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const defaultModels: Record<string, string> = {
    ollama: 'qwen3',
    nvidia: 'meta/llama-3.3-70b-instruct',
    groq: 'llama-3.3-70b-versatile',
    openrouter: 'meta-llama/llama-3.3-70b-instruct',
    deepseek: 'deepseek-chat',
    together: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    openai_compatible: 'llama-3.3-70b-instruct',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20241022',
    gemini: 'gemini-1.5-flash',
    heuristic_fallback: 'deterministic',
  };

  const fetchLLMStatus = async () => {
    try {
      const res = await getLLMStatusApi();
      setLlmStatus(res);
      setSelectedProvider(res.active_provider);
      setSelectedModel(res.active_model);
      if (res.active_base_url) {
        setBaseUrl(res.active_base_url);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchLLMStatus();
  }, []);

  const handleProviderChange = (newProvider: string) => {
    setSelectedProvider(newProvider);
    if (defaultModels[newProvider]) {
      setSelectedModel(defaultModels[newProvider]);
    }
  };

  const handleSaveLLM = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setLLMProviderApi({
        provider: selectedProvider,
        model_name: selectedModel,
        api_key: apiKey || undefined,
        base_url: baseUrl || undefined,
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
      default:
        return 'badge-pending';
    }
  };

  const getTabDetails = (tab: NavTab) => {
    switch (tab) {
      case 'console':
        return { label: 'AI Console', icon: <Terminal size={16} style={{ color: 'var(--accent-blue)' }} /> };
      case 'deploy':
        return { label: 'Deploy Hub', icon: <Rocket size={16} style={{ color: 'var(--status-success)' }} /> };
      case 'tasks':
        return { label: 'Live Tasks', icon: <ListTodo size={16} style={{ color: 'var(--accent-cyan)' }} /> };
      case 'workflows':
        return { label: 'Workflows', icon: <Layers size={16} style={{ color: 'var(--accent-purple)' }} /> };
      case 'infrastructure':
        return { label: 'Server Fleet', icon: <Server size={16} style={{ color: '#38bdf8' }} /> };
      case 'projects':
        return { label: 'Projects', icon: <FolderGit2 size={16} style={{ color: '#fbbf24' }} /> };
      case 'schedules':
        return { label: 'Schedules', icon: <CalendarClock size={16} style={{ color: '#f472b6' }} /> };
      case 'policies-webhooks':
        return { label: 'Policies & Webhooks', icon: <ShieldAlert size={16} style={{ color: 'var(--status-warning)' }} /> };
      case 'observability':
        return { label: 'Observability', icon: <Activity size={16} style={{ color: 'var(--status-info)' }} /> };
      case 'users':
        return { label: 'Users & Access', icon: <Users size={16} style={{ color: '#a78bfa' }} /> };
      case 'api-keys':
        return { label: 'API Keys', icon: <Key size={16} style={{ color: '#34d399' }} /> };
      case 'audit-logs':
        return { label: 'Audit Logs', icon: <History size={16} style={{ color: '#94a3b8' }} /> };
    }
  };

  const currentTab = getTabDetails(activeTab);

  return (
    <header className="navbar" style={{ padding: '0 20px' }}>
      {/* Left: Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div className="nav-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>XyOps</span>
          <ChevronRight size={13} style={{ color: 'var(--text-muted)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {currentTab.icon}
            <span>{currentTab.label}</span>
          </div>

          {activeTab === 'tasks' && activeTasksCount > 0 && (
            <span className="badge badge-running" style={{ fontSize: '10px', marginLeft: 4 }}>
              {activeTasksCount} Active
            </span>
          )}
        </div>
      </div>

      {/* Right: Status, LLM Switcher, Theme Toggle, User Profile */}
      <div className="nav-status-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Live System Indicator */}
        <div className="system-status-indicator" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="status-dot"></span>
          <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>System Online</span>
        </div>

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

        {/* Dark / Light / System Mode Switcher */}
        <ThemeToggle />

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
              onClick={() => setShowLogoutConfirm(true)}
              title="Sign Out"
              style={{ padding: '6px 10px', cursor: 'pointer' }}
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

      {/* Logout Confirmation Popup Modal */}
      {showLogoutConfirm && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setShowLogoutConfirm(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(5, 8, 15, 0.75)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              width: '380px',
              maxWidth: '92vw',
              boxShadow: '0 20px 45px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--status-danger-bg)',
                  color: 'var(--status-danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <LogOut size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Confirm Sign Out
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Are you sure you want to log out?
                </p>
              </div>
            </div>

            {user && (
              <div
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span>Active User:</span>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                  {user.username} {role && `(${role})`}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px', borderRadius: 'var(--radius-sm)' }}
              >
                No, Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
                className="btn btn-danger"
                style={{
                  padding: '8px 18px',
                  fontSize: '13px',
                  backgroundColor: 'var(--status-danger)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Multi-LLM Provider Configuration Modal */}
      {showLLMModal && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 10, 17, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowLLMModal(false);
          }}
        >
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '500px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Cpu size={18} style={{ color: 'var(--accent-purple)' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Multi-LLM Gateway Settings</h3>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setShowLLMModal(false)}
                type="button"
                style={{ padding: '4px 8px' }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveLLM} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Active LLM Provider</label>
                <select className="input-field" value={selectedProvider} onChange={(e) => handleProviderChange(e.target.value)}>
                  <option value="ollama">Local Ollama (qwen3, llama3, deepseek)</option>
                  <option value="nvidia">NVIDIA NIM / NVIDIA AI (Llama 3.3 70B, Nemotron, DeepSeek R1)</option>
                  <option value="groq">Groq Cloud (Llama 3.3 70B, Mixtral - Ultra Fast)</option>
                  <option value="openrouter">OpenRouter (DeepSeek R1, Llama 3.3, Qwen 2.5)</option>
                  <option value="deepseek">DeepSeek Official API (DeepSeek V3 / R1)</option>
                  <option value="together">Together AI (Llama 3.3, Qwen 2.5)</option>
                  <option value="openai_compatible">Custom OpenAI-Compatible Endpoint (vLLM, etc.)</option>
                  <option value="openai">OpenAI (GPT-4o, GPT-4o-mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="gemini">Google Gemini (Gemini 1.5 / 2.0)</option>
                  <option value="heuristic_fallback">Offline Deterministic Heuristic</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Model Name / ID</label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="e.g. meta/llama-3.3-70b-instruct, llama-3.3-70b-versatile, deepseek-chat"
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
                    placeholder="Enter provider API key (e.g. nvapi-..., gsk_..., sk-...)"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
              )}

              {(selectedProvider === 'openai_compatible' || selectedProvider === 'nvidia' || selectedProvider === 'groq' || selectedProvider === 'openrouter' || selectedProvider === 'deepseek' || selectedProvider === 'together') && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                    Custom Base URL {selectedProvider === 'openai_compatible' ? '(Required)' : '(Optional Override)'}
                  </label>
                  <input
                    type="text"
                    className="input-field font-mono"
                    placeholder={
                      selectedProvider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1' :
                      selectedProvider === 'groq' ? 'https://api.groq.com/openai/v1' :
                      selectedProvider === 'openrouter' ? 'https://openrouter.ai/api/v1' :
                      selectedProvider === 'deepseek' ? 'https://api.deepseek.com/v1' :
                      selectedProvider === 'together' ? 'https://api.together.xyz/v1' :
                      'https://your-custom-endpoint.com/v1'
                    }
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLLMModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Apply Provider</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
