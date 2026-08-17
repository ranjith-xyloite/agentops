import React from 'react';
import { Server, CheckCircle2, XCircle, FolderGit2 } from 'lucide-react';
import { SystemStats } from '../types';

interface DashboardStatsProps {
  stats: SystemStats | null;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
          <Server size={22} />
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.total_servers}</span>
          <span className="stat-label">Active Nodes</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4' }}>
          <FolderGit2 size={22} />
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.total_projects}</span>
          <span className="stat-label">Configured Projects</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
          <CheckCircle2 size={22} />
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.successful_tasks}</span>
          <span className="stat-label">Successful Tasks</span>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon-wrapper" style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
          <XCircle size={22} />
        </div>
        <div className="stat-info">
          <span className="stat-value">{stats.failed_tasks}</span>
          <span className="stat-label">Failed Operations</span>
        </div>
      </div>
    </div>
  );
};
