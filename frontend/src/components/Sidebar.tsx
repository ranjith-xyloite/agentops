import React, { useState } from 'react';
import {
  Terminal,
  Rocket,
  ListTodo,
  Layers,
  Server,
  FolderGit2,
  CalendarClock,
  ShieldAlert,
  Activity,
  Users,
  Key,
  History,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sparkles,
  User as UserIcon,
  LogOut,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { NavTab } from './Navbar';
import { ThemeToggle } from './ThemeToggle';
import { LLMProviderStatus } from '../types';

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  activeTasksCount: number;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  llmStatus: LLMProviderStatus | null;
  onOpenLLMModal: () => void;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ReactNode;
  badge?: string | number | null;
  badgeType?: 'running' | 'success' | 'warning';
  roles?: string[];
  shortcut?: string;
}

interface NavGroupConfig {
  title: string;
  items: NavItemConfig[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  activeTasksCount,
  isCollapsed,
  setIsCollapsed,
  llmStatus,
  onOpenLLMModal,
}) => {
  const { user, role, logout } = useAuth();
  const [filterQuery, setFilterQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  const navGroups: NavGroupConfig[] = [
    {
      title: 'OPERATIONS & AI',
      items: [
        {
          id: 'console',
          label: 'AI Console',
          icon: <Terminal size={17} style={{ color: 'var(--accent-blue)' }} />,
          shortcut: '⌘1',
        },
        {
          id: 'deploy',
          label: 'Deploy Hub',
          icon: <Rocket size={17} style={{ color: 'var(--status-success)' }} />,
          shortcut: '⌘2',
        },
        {
          id: 'tasks',
          label: 'Live Tasks',
          icon: <ListTodo size={17} style={{ color: 'var(--accent-cyan)' }} />,
          badge: activeTasksCount > 0 ? activeTasksCount : null,
          badgeType: 'running',
          shortcut: '⌘3',
        },
      ],
    },
    {
      title: 'FLEET & WORKFLOWS',
      items: [
        {
          id: 'workflows',
          label: 'Workflows',
          icon: <Layers size={17} style={{ color: 'var(--accent-purple)' }} />,
          shortcut: '⌘4',
        },
        {
          id: 'infrastructure',
          label: 'Server Fleet',
          icon: <Server size={17} style={{ color: '#38bdf8' }} />,
          shortcut: '⌘5',
        },
        {
          id: 'projects',
          label: 'Projects',
          icon: <FolderGit2 size={17} style={{ color: '#fbbf24' }} />,
          shortcut: '⌘6',
        },
        {
          id: 'schedules',
          label: 'Schedules',
          icon: <CalendarClock size={17} style={{ color: '#f472b6' }} />,
          shortcut: '⌘7',
        },
      ],
    },
    {
      title: 'OBSERVABILITY & POLICIES',
      items: [
        {
          id: 'observability',
          label: 'Observability',
          icon: <Activity size={17} style={{ color: 'var(--status-info)' }} />,
          shortcut: '⌘8',
        },
        {
          id: 'policies-webhooks',
          label: 'Policies & Webhooks',
          icon: <ShieldAlert size={17} style={{ color: 'var(--status-warning)' }} />,
          shortcut: '⌘9',
        },
      ],
    },
    {
      title: 'ADMIN & SECURITY',
      items: [
        {
          id: 'users',
          label: 'Users',
          icon: <Users size={17} style={{ color: '#a78bfa' }} />,
          roles: ['admin'],
        },
        {
          id: 'api-keys',
          label: 'API Keys',
          icon: <Key size={17} style={{ color: '#34d399' }} />,
          roles: ['admin', 'operator'],
        },
        {
          id: 'audit-logs',
          label: 'Audit Logs',
          icon: <History size={17} style={{ color: '#94a3b8' }} />,
          roles: ['admin', 'operator'],
        },
      ],
    },
  ];

  return (
    <aside
      className={`app-sidebar ${isCollapsed ? 'collapsed' : 'expanded'}`}
      style={{
        width: isCollapsed ? '64px' : '260px',
        minWidth: isCollapsed ? '64px' : '260px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-subtle)',
        zIndex: 60,
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        userSelect: 'none',
      }}
    >
      {/* Sidebar Top Brand Header */}
      <div
        className="sidebar-header"
        style={{
          height: '64px',
          padding: isCollapsed ? '0 12px' : '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'space-between',
          borderBottom: '1px solid var(--border-subtle)',
          gap: '8px',
        }}
      >
        <div
          className="sidebar-brand-wrapper"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
          onClick={() => setActiveTab('console')}
          title="XyOps — Xyloite Technologies Autonomous DevOps"
        >
          <div
            className="brand-icon"
            style={{
              width: '32px',
              height: '32px',
              minWidth: '32px',
              background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)',
            }}
          >
            <Shield size={18} />
          </div>

          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: '1.2' }}>
                XyOps
              </div>
              <div style={{ fontSize: '9.5px', fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Xyloite Technologies
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="sidebar-toggle-btn"
          title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
          aria-label="Toggle Sidebar"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: isCollapsed ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.15s ease, background-color 0.15s ease',
          }}
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Optional Search / Filter bar (when expanded) */}
      {!isCollapsed && (
        <div style={{ padding: '12px 14px 4px 14px' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={13}
              style={{
                position: 'absolute',
                left: '10px',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Jump to view..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                fontSize: '12px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                outline: 'none',
                fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
        </div>
      )}

      {/* Main Scrollable Navigation Area */}
      <div
        className="sidebar-scrollable-content"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: isCollapsed ? '12px 6px' : '10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {navGroups.map((group) => {
          // Filter items based on user role
          const visibleItems = group.items.filter((item) => {
            if (item.roles && (!role || !item.roles.includes(role))) {
              return false;
            }
            if (filterQuery.trim()) {
              return item.label.toLowerCase().includes(filterQuery.toLowerCase());
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          const isGroupCollapsed = !isCollapsed && !!collapsedGroups[group.title];

          return (
            <div key={group.title} className="sidebar-group" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {/* Group Title Header */}
              {!isCollapsed && (
                <div
                  onClick={() => toggleGroup(group.title)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px 4px 8px',
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  <span>{group.title}</span>
                  {isGroupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </div>
              )}

              {/* Items List */}
              {(!isGroupCollapsed || isCollapsed) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {visibleItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                        title={isCollapsed ? item.label : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: isCollapsed ? '0' : '10px',
                          justifyContent: isCollapsed ? 'center' : 'flex-start',
                          padding: isCollapsed ? '10px 0' : '8px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: 'none',
                          background: isActive ? 'var(--accent-blue-subtle)' : 'transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontSize: '13px',
                          fontWeight: isActive ? 600 : 500,
                          position: 'relative',
                          transition: 'all 0.15s ease',
                          width: '100%',
                        }}
                      >
                        {/* Left Active indicator pill */}
                        {isActive && (
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: '4px',
                              bottom: '4px',
                              width: '3px',
                              borderRadius: '0 2px 2px 0',
                              backgroundColor: 'var(--accent-blue)',
                            }}
                          />
                        )}

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '20px',
                          }}
                        >
                          {item.icon}
                        </div>

                        {!isCollapsed && (
                          <div
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              overflow: 'hidden',
                            }}
                          >
                            <span
                              style={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.label}
                            </span>

                            {item.badge !== undefined && item.badge !== null && (
                              <span
                                className={`badge badge-${item.badgeType || 'running'}`}
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  borderRadius: '10px',
                                }}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Collapsed dot / badge indicator */}
                        {isCollapsed && item.badge !== undefined && item.badge !== null && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '6px',
                              right: '10px',
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--accent-blue)',
                            }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer Controls */}
      <div
        className="sidebar-footer"
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: isCollapsed ? '12px 6px' : '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          background: 'var(--bg-secondary)',
        }}
      >
        {/* Multi-LLM status button */}
        {llmStatus && (
          <button
            type="button"
            onClick={onOpenLLMModal}
            className="btn btn-secondary btn-sm"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '6px',
              padding: isCollapsed ? '8px 0' : '6px 8px',
              fontSize: '11px',
            }}
            title={`Active LLM: ${llmStatus.active_provider.toUpperCase()} (${llmStatus.active_model})`}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-purple)', flexShrink: 0 }} />
            {!isCollapsed && (
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {llmStatus.active_provider.toUpperCase()}
              </span>
            )}
          </button>
        )}

        {/* Theme mode and User profile row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
          }}
        >
          <ThemeToggle />

          {isCollapsed && (
            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              title="Expand Sidebar"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <PanelLeftOpen size={16} />
            </button>
          )}

          {!isCollapsed && user && (
            <button
              type="button"
              onClick={logout}
              className="btn btn-secondary btn-sm"
              title={`Logged in as ${user.username} (${role}) - Click to Sign Out`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                fontSize: '11.5px',
              }}
            >
              <UserIcon size={12} style={{ color: 'var(--accent-blue)' }} />
              <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.username}
              </span>
              <LogOut size={11} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
