import React, { useState, useEffect, useRef } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardStats } from './components/DashboardStats';
import { ChatConsole, ChatMessage } from './components/ChatConsole';
import { TaskTerminal } from './components/TaskTerminal';
import { TaskList } from './components/TaskList';
import { ServerFleet } from './components/ServerFleet';
import { ProjectDeployments } from './components/ProjectDeployments';
import { WorkflowDeployer } from './components/WorkflowDeployer';
import { DeploymentHub } from './components/DeploymentHub';
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
  updateServerApi,
  deleteServer,
  listProjects,
  createProject,
  deleteProject,
  updateProject,
  createProjectDeployment,
  updateProjectDeployment,
  deleteProjectDeployment,
  listEnvironments,
  getStats,
  subscribeToTaskEvents,
} from './services/api';

export const App: React.FC = () => {
  const { isAuthenticated, role } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab>('console');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('agentops_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('agentops_sidebar_collapsed', String(isCollapsed));
    } catch {
      // ignore
    }
  }, [isCollapsed]);

  // Global Ctrl+B shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Data state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Chat conversation state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Hello! I am your AgentOps DevOps Assistant. Tell me what you would like to deploy, monitor, or inspect across your infrastructure.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

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
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: msg,
      timestamp: nowStr,
    };
    setChatMessages((prev) => [...prev, userMsg]);

    try {
      const plan = await sendMessage(msg);
      setActiveTaskId(plan.task_id);
      setCurrentTaskStatus(plan.status);
      setTerminalLogs([`[System] Initialized plan for task #${plan.task_id} (${plan.status})`]);

      const agentMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: plan.execution_plan.tool
          ? `I have formulated an execution plan for task #${plan.task_id}:`
          : (plan.execution_plan.question || 'I could not determine an appropriate tool for this request.'),
        plan,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, agentMsg]);

      await refreshAllData();
      return plan;
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: `Error processing request: ${err.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
      throw err;
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

  const handleUpdateServer = async (serverId: number, serverData: Partial<Server>) => {
    await updateServerApi(serverId, serverData);
    await refreshAllData();
  };

  const handleDeleteServer = async (serverId: number) => {
    if (window.confirm('Are you sure you want to remove this server node?')) {
      await deleteServer(serverId);
      await refreshAllData();
    }
  };

  const handleTriggerDeploy = async (projectName: string, component: string, env: string) => {
    setActiveTab('console');
    await handleSendMessage(`Deploy ${projectName} ${component} branch main to ${env}`);
  };

  const handleAddProject = async (projectData: { name: string; description?: string; repository_url?: string }): Promise<Project> => {
    const newProj = await createProject(projectData);
    await refreshAllData();
    return newProj;
  };

  const handleUpdateProject = async (
    projectId: number,
    data: { name?: string; description?: string; repository_url?: string }
  ) => {
    await updateProject(projectId, data);
    await refreshAllData();
  };

  const handleDeleteProject = async (projectId: number) => {
    await deleteProject(projectId);
    await refreshAllData();
  };

  const handleAddDeployment = async (
    projectId: number,
    data: { environment_id: number; component: string; repository_path?: string; deployment_script?: string; health_check_url?: string }
  ) => {
    await createProjectDeployment(projectId, data);
    await refreshAllData();
  };

  const handleUpdateDeployment = async (
    deploymentId: number,
    data: { environment_id?: number; component?: string; repository_path?: string; deployment_script?: string; health_check_url?: string }
  ) => {
    await updateProjectDeployment(deploymentId, data);
    await refreshAllData();
  };

  const handleDeleteDeployment = async (deploymentId: number) => {
    await deleteProjectDeployment(deploymentId);
    await refreshAllData();
  };

  const runningTasksCount = tasks.filter((t) => t.status === 'RUNNING').length;

  return (
    <div className="app-layout">
      <LoginModal />

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        activeTasksCount={runningTasksCount}
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        llmStatus={null}
        onOpenLLMModal={() => {}}
      />

      <div className="app-main-wrapper">
        <Navbar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          activeTasksCount={runningTasksCount}
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
        />

        <main className="main-content">
          <DashboardStats stats={stats} />

          {activeTab === 'console' && (
            <div className="console-workspace">
              <ChatConsole
                messages={chatMessages}
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
                onConfirmTask={handleConfirmTask}
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

          {activeTab === 'deploy' && (
            <DeploymentHub
              projects={projects}
              environments={environments}
              servers={servers}
              tasks={tasks}
              onTriggerDeploy={handleTriggerDeploy}
              onSelectTaskToStream={(id) => {
                setActiveTaskId(id);
                setActiveTab('console');
              }}
              onNavigateToWorkflows={() => setActiveTab('workflows')}
            />
          )}

          {activeTab === 'workflows' && (
            <WorkflowDeployer
              projects={projects}
              environments={environments}
              servers={servers}
              onTriggerDeploy={handleTriggerDeploy}
              onAddDeployment={handleAddDeployment}
              onUpdateDeployment={handleUpdateDeployment}
              onDeleteDeployment={handleDeleteDeployment}
            />
          )}

          {activeTab === 'infrastructure' && (
            <ServerFleet
              servers={servers}
              environments={environments}
              onAddServer={handleAddServer}
              onUpdateServer={handleUpdateServer}
              onDeleteServer={handleDeleteServer}
            />
          )}

          {activeTab === 'projects' && (
            <ProjectDeployments
              projects={projects}
              environments={environments}
              servers={servers}
              onTriggerDeploy={handleTriggerDeploy}
              onAddProject={handleAddProject}
              onDeleteProject={handleDeleteProject}
              onUpdateProject={handleUpdateProject}
              onAddDeployment={handleAddDeployment}
              onUpdateDeployment={handleUpdateDeployment}
              onDeleteDeployment={handleDeleteDeployment}
            />
          )}

          {activeTab === 'schedules' && (
            <SchedulerManager
              projects={projects}
              environments={environments}
            />
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
    </div>
  );
};
