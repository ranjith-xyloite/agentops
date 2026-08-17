import React, { useState, useEffect, useRef } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardStats } from './components/DashboardStats';
import { ChatConsole } from './components/ChatConsole';
import { TaskTerminal } from './components/TaskTerminal';
import { TaskList } from './components/TaskList';
import { ServerFleet } from './components/ServerFleet';
import { ProjectDeployments } from './components/ProjectDeployments';
import { SchedulerManager } from './components/SchedulerManager';
import { PoliciesAndWebhooks } from './components/PoliciesAndWebhooks';
import { UserManagement } from './components/UserManagement';
import { ApiKeys } from './components/ApiKeys';
import { AuditLogs } from './components/AuditLogs';
import { Observability } from './components/Observability';
import { LoginModal } from './components/LoginModal';
import { useAuth } from './context/AuthContext';

import {
  Task,
  Server,
  Project,
  Environment,
  SystemStats,
  TaskStatus,
  ChatPlanResponse,
} from './types';

import {
  sendMessage,
  confirmTask,
  cancelTask,
  getTask,
  listTasks,
  listServers,
  createServer,
  deleteServer,
  listProjects,
  listEnvironments,
  getStats,
  subscribeToTaskEvents,
} from './services/api';

export const App: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('console');

  // Data state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Active terminal stream state
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [currentTaskStatus, setCurrentTaskStatus] = useState<TaskStatus | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Initial data loading
  const refreshAllData = async () => {
    if (!isAuthenticated) return;
    try {
      const [tasksData, serversData, projectsData, envsData, statsData] = await Promise.all([
        listTasks().catch(() => []),
        listServers().catch(() => []),
        listProjects().catch(() => []),
        listEnvironments().catch(() => []),
        getStats().catch(() => null),
      ]);
      setTasks(tasksData);
      setServers(serversData);
      setProjects(projectsData);
      setEnvironments(envsData);
      if (statsData) setStats(statsData);
    } catch (err) {
      console.error('Failed to load system data:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      refreshAllData();
      const interval = setInterval(refreshAllData, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  // Connect to SSE stream whenever activeTaskId changes
  useEffect(() => {
    if (!activeTaskId || !isAuthenticated) return;

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Fetch snapshot
    getTask(activeTaskId)
      .then((t) => {
        setActiveTask(t);
        setCurrentTaskStatus(t.status);
        if (t.executions && t.executions.length > 0) {
          const combinedLogs = t.executions
            .map((e) => e.output || e.error || '')
            .filter(Boolean)
            .flatMap((s) => s.split('\n'));
          setTerminalLogs((prev) => (prev.length === 0 ? combinedLogs : prev));
        }
      })
      .catch(console.error);

    const closeSub = subscribeToTaskEvents(
      activeTaskId,
      (event) => {
        if (event.log) {
          setTerminalLogs((prev) => [...prev, event.log!]);
        }
        if (event.status) {
          setCurrentTaskStatus(event.status);
        }
        if (event.type === 'init' && event.executions) {
          const initLogs = event.executions
            .map((e: any) => e.output || '')
            .filter(Boolean)
            .flatMap((s: string) => s.split('\n'));
          if (initLogs.length > 0) {
            setTerminalLogs(initLogs);
          }
        }
        refreshAllData();
      },
      (err) => {
        console.warn('SSE connection error:', err);
      }
    );

    unsubscribeRef.current = closeSub;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [activeTaskId, isAuthenticated]);

  const handleSendMessage = async (msg: string): Promise<ChatPlanResponse> => {
    setIsProcessing(true);
    try {
      const plan = await sendMessage(msg);
      setActiveTaskId(plan.task_id);
      setCurrentTaskStatus(plan.status);
      setTerminalLogs([`[System] Initialized plan for task #${plan.task_id} (${plan.status})`]);
      await refreshAllData();
      return plan;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmTask = async (taskId: number) => {
    try {
      setActiveTaskId(taskId);
      setTerminalLogs((prev) => [...prev, `[System] Confirming task #${taskId}...`]);
      await confirmTask(taskId);
      setCurrentTaskStatus('RUNNING');
      await refreshAllData();
    } catch (err: any) {
      setTerminalLogs((prev) => [...prev, `[System Error] ${err.message}`]);
    }
  };

  const handleCancelTask = async (taskId: number) => {
    try {
      await cancelTask(taskId);
      setCurrentTaskStatus('CANCELLED');
      setTerminalLogs((prev) => [...prev, `[System] Task #${taskId} has been cancelled.`]);
      await refreshAllData();
    } catch (err: any) {
      setTerminalLogs((prev) => [...prev, `[System Error] ${err.message}`]);
    }
  };

  const handleAddServer = async (serverData: Omit<Server, 'id' | 'environment_name'>) => {
    await createServer(serverData);
    await refreshAllData();
  };

  const handleDeleteServer = async (serverId: number) => {
    if (window.confirm('Are you sure you want to remove this server node?')) {
      await deleteServer(serverId);
      await refreshAllData();
    }
  };

  const handleTriggerHealthCheck = async (envName: string) => {
    setActiveTab('console');
    await handleSendMessage(`Run server health checks on ${envName}`);
  };

  const handleTriggerDeploy = async (projectName: string, component: string, env: string) => {
    setActiveTab('console');
    await handleSendMessage(`Deploy ${projectName} ${component} branch main to ${env}`);
  };

  const runningTasksCount = tasks.filter((t) => t.status === 'RUNNING').length;

  return (
    <div className="app-container">
      <LoginModal />

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeTasksCount={runningTasksCount}
      />

      <main className="main-content">
        <DashboardStats stats={stats} />

        {activeTab === 'console' && (
          <div className="console-workspace">
            <ChatConsole
              onSendMessage={handleSendMessage}
              onConfirmTask={handleConfirmTask}
              onCancelTask={handleCancelTask}
              onSelectTaskToStream={(id) => setActiveTaskId(id)}
              isProcessing={isProcessing}
            />

            <TaskTerminal
              activeTaskId={activeTaskId}
              activeTask={activeTask}
              logs={terminalLogs}
              currentStatus={currentTaskStatus}
              onCancelTask={handleCancelTask}
              onClearLogs={() => setTerminalLogs([])}
            />
          </div>
        )}

        {activeTab === 'tasks' && (
          <TaskList
            tasks={tasks}
            onSelectTask={(id) => {
              setActiveTaskId(id);
              setActiveTab('console');
            }}
            onConfirmTask={handleConfirmTask}
            onCancelTask={handleCancelTask}
          />
        )}

        {activeTab === 'infrastructure' && (
          <ServerFleet
            servers={servers}
            environments={environments}
            onAddServer={handleAddServer}
            onDeleteServer={handleDeleteServer}
            onTriggerHealthCheck={handleTriggerHealthCheck}
          />
        )}

        {activeTab === 'projects' && (
          <ProjectDeployments
            projects={projects}
            onTriggerDeploy={handleTriggerDeploy}
          />
        )}

        {activeTab === 'schedules' && (
          <SchedulerManager />
        )}

        {activeTab === 'policies-webhooks' && (
          <PoliciesAndWebhooks />
        )}

        {activeTab === 'observability' && (
          <Observability />
        )}

        {activeTab === 'users' && role === 'admin' && (
          <UserManagement projects={projects} />
        )}

        {activeTab === 'api-keys' && (
          <ApiKeys />
        )}

        {activeTab === 'audit-logs' && (
          <AuditLogs />
        )}
      </main>
    </div>
  );
};
