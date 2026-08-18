import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, ChevronDown, Check } from 'lucide-react';
import { useTheme, ThemeMode } from '../context/ThemeContext';

export const ThemeToggle: React.FC = () => {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const options: { mode: ThemeMode; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      mode: 'light',
      label: 'Light',
      icon: <Sun size={15} style={{ color: '#eab308' }} />,
      desc: 'Crisp & clean daylight workspace',
    },
    {
      mode: 'dark',
      label: 'Dark',
      icon: <Moon size={15} style={{ color: '#38bdf8' }} />,
      desc: 'Deep slate engineering console',
    },
    {
      mode: 'system',
      label: 'System',
      icon: <Monitor size={15} style={{ color: 'var(--accent-purple)' }} />,
      desc: 'Sync with OS preference',
    },
  ];

  return (
    <div className="theme-toggle-container" ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Segmented Quick Switch / Dropdown Trigger */}
      <div
        className="theme-segmented-control"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '2px',
          gap: '2px',
        }}
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`theme-pill-btn ${theme === 'light' ? 'active' : ''}`}
          title="Switch to Light Mode"
          aria-label="Light Mode"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: theme === 'light' ? 'var(--bg-tertiary)' : 'transparent',
            color: theme === 'light' ? '#eab308' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: theme === 'light' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          <Sun size={15} />
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`theme-pill-btn ${theme === 'dark' ? 'active' : ''}`}
          title="Switch to Dark Mode"
          aria-label="Dark Mode"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: theme === 'dark' ? 'var(--bg-tertiary)' : 'transparent',
            color: theme === 'dark' ? '#38bdf8' : 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: theme === 'dark' ? 'var(--shadow-sm)' : 'none',
          }}
        >
          <Moon size={15} />
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="theme-pill-btn"
          title="Theme Options (Light / Dark / System)"
          aria-label="Theme Menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '28px',
            padding: '0 6px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: theme === 'system' ? 'var(--bg-tertiary)' : 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            gap: '2px',
          }}
        >
          {theme === 'system' ? (
            <Monitor size={14} style={{ color: 'var(--accent-purple)' }} />
          ) : (
            <ChevronDown size={13} />
          )}
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="theme-dropdown-menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            zIndex: 1000,
            minWidth: '220px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            backdropFilter: 'blur(16px)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              padding: '6px 10px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '2px',
            }}
          >
            Appearance Theme
          </div>

          {options.map((opt) => {
            const isSelected = theme === opt.mode;
            return (
              <button
                key={opt.mode}
                type="button"
                onClick={() => {
                  setTheme(opt.mode);
                  setIsOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: isSelected ? 'var(--accent-blue-subtle)' : 'transparent',
                  color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {opt.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{opt.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{opt.desc}</div>
                </div>
                {isSelected && <Check size={14} style={{ color: 'var(--accent-blue)' }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
