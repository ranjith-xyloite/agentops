import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Search,
  User as UserIcon,
  LogOut,
  ChevronDown,
  ChevronRight,
  Pin,
  Boxes,
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
  isPinned?: boolean;
  setIsPinned?: (pinned: boolean | ((prev: boolean) => boolean)) => void;
  llmStatus?: LLMProviderStatus | null;
  onOpenLLMModal?: () => void;
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
  isPinned = true,
  setIsPinned,
}) => {
  const { user, role, logout } = useAuth();
  const [filterQuery, setFilterQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isHovered, setIsHovered] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // If pinned, collapsed state controls open/close. If unpinned, hover expands side pane.
  const effectiveCollapsed = isPinned ? isCollapsed : !isHovered;

  const toggleGroup = (groupTitle: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupTitle]: !prev[groupTitle],
    }));
  };

  const navGroups: NavGroupConfig[] = [
    {
      title: 'Operations & AI',
      items: [
        {
          id: 'console',
          label: 'AI Console',
          icon: <Terminal size={17} style={{ color: '#38bdf8' }} />,
          shortcut: '1',
        },
        {
          id: 'deploy',
          label: 'Deploy Hub',
          icon: <Rocket size={17} style={{ color: '#34d399' }} />,
          shortcut: '2',
        },
        {
          id: 'tasks',
          label: 'Live Tasks',
          icon: <ListTodo size={17} style={{ color: '#22d3ee' }} />,
          badge: activeTasksCount > 0 ? activeTasksCount : null,
          badgeType: 'running',
          shortcut: '3',
        },
      ],
    },
    {
      title: 'Fleet & Workflows',
      items: [
        {
          id: 'workflows',
          label: 'Workflows',
          icon: <Layers size={17} style={{ color: '#c084fc' }} />,
          shortcut: '4',
        },
        {
          id: 'infrastructure',
          label: 'Server Fleet',
          icon: <Server size={17} style={{ color: '#38bdf8' }} />,
          shortcut: '5',
        },
        {
          id: 'containers',
          label: 'Containers',
          icon: <Boxes size={17} style={{ color: '#06b6d4' }} />,
          shortcut: '6',
        },
        {
          id: 'projects',
          label: 'Projects',
          icon: <FolderGit2 size={17} style={{ color: '#fbbf24' }} />,
          shortcut: '7',
        },
        {
          id: 'schedules',
          label: 'Schedules',
          icon: <CalendarClock size={17} style={{ color: '#f472b6' }} />,
          shortcut: '8',
        },
      ],
    },
    {
      title: 'Observability & Policies',
      items: [
        {
          id: 'observability',
          label: 'Observability',
          icon: <Activity size={17} style={{ color: '#38bdf8' }} />,
          shortcut: '8',
        },
        {
          id: 'policies-webhooks',
          label: 'Policies & Webhooks',
          icon: <ShieldAlert size={17} style={{ color: '#f59e0b' }} />,
          shortcut: '9',
        },
      ],
    },
    {
      title: 'Admin & Security',
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
          roles: ['admin'],
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
      className="app-sidebar-container"
      onMouseEnter={() => {
        if (!isPinned) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (!isPinned) setIsHovered(false);
      }}
      style={{
        display: 'flex',
        height: '100vh',
        position: 'sticky',
        top: 0,
        zIndex: 70,
        userSelect: 'none',
      }}
    >
      {/* ======================================================== */}
      {/* 1. STATIC ICON RAIL (Always 58px wide, rock solid)       */}
      {/* ======================================================== */}
      <div
        className="sidebar-static-rail"
        style={{
          width: '58px',
          minWidth: '58px',
          height: '100vh',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '0',
          zIndex: 2,
          position: 'relative',
        }}
      >
        {/* Rail Header: Brand Shield Icon (Matched 64px height) */}
        <div
          style={{
            height: '64px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid var(--border-subtle)',
            flexShrink: 0,
          }}
        >
          <div
            onClick={() => {
              setActiveTab('console');
              if (!isPinned) setIsHovered(true);
            }}
            title="XyOps — Xyloite Technologies"
            style={{
              width: '36px',
              height: '36px',
              background: 'linear-gradient(135deg, #2563eb, #06b6d4)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.45)',
              cursor: 'pointer',
            }}
          >
            <Shield size={19} />
          </div>
        </div>

        {/* Rail Search Trigger: Matched 48px height */}
        <div
          style={{
            height: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!isPinned) setIsHovered(true);
              setTimeout(() => searchInputRef.current?.focus(), 50);
            }}
            title="Search / Filter views"
            style={{
              width: '38px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Search size={15} />
          </button>
        </div>

        {/* Rail Grouped Section Icons: Matched 1-to-1 with Pane Grid */}
        <div
          className="sidebar-scrollable-content"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
            alignItems: 'center',
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '10px 0',
          }}
        >
          {navGroups.map((group) => {
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
            const isGroupCollapsed = !!collapsedGroups[group.title];

            return (
              <div
                key={group.title}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  width: '100%',
                  alignItems: 'center',
                }}
              >
                {/* Matched Group Header Line (24px height) */}
                <div
                  style={{
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      width: '18px',
                      height: '1px',
                      backgroundColor: 'var(--border-subtle)',
                    }}
                  />
                </div>

                {!isGroupCollapsed && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      width: '100%',
                      alignItems: 'center',
                    }}
                  >
                    {visibleItems.map((item) => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setActiveTab(item.id)}
                          title={item.label}
                          style={{
                            width: '40px',
                            height: '36px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: isActive ? 'var(--accent-blue-subtle)' : 'transparent',
                            color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            transition: 'background 0.15s ease, color 0.15s ease',
                            flexShrink: 0,
                          }}
                        >
                          {isActive && (
                            <div
                              style={{
                                position: 'absolute',
                                left: '0px',
                                top: '6px',
                                bottom: '6px',
                                width: '3px',
                                borderRadius: '0 3px 3px 0',
                                backgroundColor: 'var(--accent-blue)',
                              }}
                            />
                          )}

                          {item.icon}

                          {item.badge !== undefined && item.badge !== null && (
                            <span
                              style={{
                                position: 'absolute',
                                top: '4px',
                                right: '6px',
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

        {/* Rail Footer: Matched User Icon (Aligned with pane footer) */}
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            height: '110px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: '12px',
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            title={`Logged in as ${user?.username || 'User'} - Click to Sign Out`}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-blue)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <UserIcon size={16} />
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. SLIDING SIDE PANE (Drawer expands between 0px & 220px)*/}
      {/* ======================================================== */}
      <div
        className={`sidebar-sliding-pane ${effectiveCollapsed ? 'pane-collapsed' : 'pane-expanded'}`}
        style={{
          width: effectiveCollapsed ? '0px' : '220px',
          minWidth: effectiveCollapsed ? '0px' : '220px',
          height: '100vh',
          backgroundColor: 'var(--bg-secondary)',
          borderRight: effectiveCollapsed ? 'none' : '1px solid var(--border-subtle)',
          overflow: 'hidden',
          transition:
            'width 0.25s cubic-bezier(0.2, 0, 0, 1), min-width 0.25s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.25s ease',
          boxShadow: !isPinned && isHovered ? '12px 0 32px rgba(0,0,0,0.6)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          position: !isPinned && isHovered ? 'absolute' : 'relative',
          left: !isPinned && isHovered ? '58px' : 'auto',
          top: 0,
          zIndex: 1,
        }}
      >
        {/* Inner fixed-width container (220px) */}
        <div
          style={{
            width: '220px',
            minWidth: '220px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          {/* Header (Matched 64px height) */}
          <div
            style={{
              height: '64px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-subtle)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--text-primary)',
                  lineHeight: '1.2',
                }}
              >
                XyOps
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'var(--accent-blue)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Xyloite Technologies
              </span>
            </div>

            {setIsPinned && (
              <button
                type="button"
                onClick={() => {
                  setIsPinned((prev) => {
                    const next = !prev;
                    if (next) setIsCollapsed(false);
                    return next;
                  });
                }}
                className="sidebar-toggle-btn"
                title={isPinned ? 'Unpin Sidebar (Auto-collapse on mouse leave)' : 'Pin Sidebar Open (Docked)'}
                aria-label="Pin Sidebar"
                style={{
                  background: isPinned ? 'var(--accent-blue-subtle)' : 'transparent',
                  border: 'none',
                  color: isPinned ? 'var(--accent-blue)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
              >
                <Pin size={15} style={{ transform: isPinned ? 'rotate(45deg)' : 'none' }} />
              </button>
            )}
          </div>

          {/* Search bar (Matched 48px height) */}
          <div
            style={{
              height: '48px',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
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
                ref={searchInputRef}
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
                  height: '32px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Grouped Nav Items (Matched 1-to-1 with Rail) */}
          <div
            className="sidebar-scrollable-content"
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {navGroups.map((group) => {
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
              const isGroupCollapsed = !!collapsedGroups[group.title];

              return (
                <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {/* Matched Group Header (24px height) */}
                  <div
                    onClick={() => toggleGroup(group.title)}
                    style={{
                      height: '24px',
                      padding: '0 6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span>{group.title}</span>
                    {isGroupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  </div>

                  {!isGroupCollapsed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {visibleItems.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setActiveTab(item.id)}
                            className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              height: '36px',
                              padding: '0 10px',
                              borderRadius: 'var(--radius-sm)',
                              border: 'none',
                              background: isActive ? 'var(--accent-blue-subtle)' : 'transparent',
                              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                              cursor: 'pointer',
                              textAlign: 'left',
                              fontSize: '12.5px',
                              fontWeight: isActive ? 600 : 500,
                              position: 'relative',
                              transition: 'background 0.15s ease, color 0.15s ease',
                              width: '100%',
                              boxSizing: 'border-box',
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
                                  flexShrink: 0,
                                }}
                              >
                                {item.badge}
                              </span>
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

          {/* Pane Footer: Multi-LLM, Theme Lighting Modes & User Profile (Matched height) */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle)',
              height: '110px',
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              background: 'var(--bg-secondary)',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >
            {/* Lighting Modes Theme Toggle */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 2px',
                height: '34px',
              }}
            >
              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Theme Mode
              </span>
              <ThemeToggle />
            </div>

            {/* User Profile / Sign Out Button */}
            {user && (
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                className="btn btn-secondary btn-sm"
                title={`Logged in as ${user.username} (${role}) - Click to Sign Out`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  fontSize: '11.5px',
                  width: '100%',
                  height: '34px',
                  boxSizing: 'border-box',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                  <UserIcon size={12} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user.username}
                  </span>
                </div>
                <LogOut size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 3. LOGOUT CONFIRMATION POPUP MODAL                      */}
      {/* ======================================================== */}
      {showLogoutConfirm &&
        createPortal(
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
    </aside>
  );
};
