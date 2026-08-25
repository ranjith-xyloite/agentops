import React, { useState } from 'react';
import { Send, Bot, User, XCircle, Sparkles, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { ChatPlanResponse } from '../types';
import { useAuth } from '../context/AuthContext';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  plan?: ChatPlanResponse;
  timestamp: string;
  /** Set after confirmation/cancellation to replace action buttons */
  resolved?: 'confirmed' | 'cancelled';
}

interface ChatConsoleProps {
  messages: ChatMessage[];
  pendingPlan?: ChatPlanResponse | null;
  onSendMessage: (msg: string) => Promise<ChatPlanResponse>;
  onConfirmTask: (taskId: number) => Promise<void>;
  onCancelTask: (taskId: number) => Promise<void>;
  onSelectTaskToStream: (taskId: number) => void;
  isProcessing: boolean;
  onAppendMessage: (msg: ChatMessage) => void;
}

const QUICK_PROMPTS = [
  'Deploy MOM frontend QA branch to UAT',
  'Deploy MOM backend main branch to UAT',
  'Check Docker containers on UAT',
  'Run server health checks on UAT',
  'Restart container mom-frontend on UAT',
];

export const ChatConsole: React.FC<ChatConsoleProps> = ({
  messages,
  pendingPlan,
  onSendMessage,
  onConfirmTask,
  onCancelTask,
  onSelectTaskToStream,
  isProcessing,
  onAppendMessage,
}) => {
  const { role } = useAuth();
  const isViewer = role === 'viewer';

  const [input, setInput] = useState('');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  // Track which task IDs have been resolved (confirmed or cancelled) and how
  const [resolvedTasks, setResolvedTasks] = useState<Map<number, 'confirmed' | 'cancelled'>>(new Map());

  const handleSend = async (textToSend?: string) => {
    if (isViewer) {
      alert('Read-only mode: Viewer accounts cannot dispatch DevOps commands.');
      return;
    }
    const text = (textToSend || input).trim();
    if (!text || isProcessing) return;

    if (!textToSend) setInput('');

    try {
      const plan = await onSendMessage(text);
      onSelectTaskToStream(plan.task_id);
    } catch (err: any) {
      console.error('Chat error:', err);
    }
  };

  const handleConfirm = async (taskId: number) => {
    if (confirmingId) return;
    setConfirmingId(taskId);
    try {
      await onConfirmTask(taskId);
      setResolvedTasks((prev) => new Map(prev).set(taskId, 'confirmed'));
      onAppendMessage({
        id: `sys-confirm-${Date.now()}`,
        sender: 'agent',
        text: `✅ Task #${taskId} confirmed — deployment is now running. Watch the Execution Stream for live logs.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancel = async (taskId: number) => {
    if (confirmingId) return;
    setConfirmingId(taskId);
    try {
      await onCancelTask(taskId);
      setResolvedTasks((prev) => new Map(prev).set(taskId, 'cancelled'));
      onAppendMessage({
        id: `sys-cancel-${Date.now()}`,
        sender: 'agent',
        text: `❌ Task #${taskId} was cancelled. No changes have been made to the remote server.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    } finally {
      setConfirmingId(null);
    }
  };

  // A plan's buttons are active only if it is still pending AND not yet resolved
  const isPlanPending = (taskId: number) =>
    pendingPlan?.task_id === taskId && !resolvedTasks.has(taskId);

  return (
    <div className="card-panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-header">
        <div className="panel-title">
          <Bot size={18} style={{ color: 'var(--accent-blue)' }} />
          <span>AI DevOps Command Center</span>
        </div>
        {isViewer && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '12px', color: 'var(--status-info)' }}>
            <ShieldAlert size={14} />
            <span>Viewer Mode (Read-Only)</span>
          </div>
        )}
      </div>

      {/* ── Shared Approval Banner (shown at top of chat when any plan is pending) ── */}
      {pendingPlan && pendingPlan.execution_plan.requires_confirmation && (
        <div style={{
          margin: '0 0 2px 0',
          padding: '10px 16px',
          background: 'linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(16,185,129,0.14) 100%)',
          borderBottom: '1px solid rgba(245,158,11,0.45)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: '#fbbf24', fontSize: '12.5px', fontWeight: 500 }}>
            <AlertTriangle size={16} />
            <span>
              Safety Gate: Task #{pendingPlan.task_id} requires confirmation before executing on the remote server.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleCancel(pendingPlan.task_id)}
              disabled={!!confirmingId || isViewer}
              style={{ fontSize: '12px', padding: '5px 10px' }}
            >
              <XCircle size={13} /> Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleConfirm(pendingPlan.task_id)}
              disabled={!!confirmingId || isViewer}
              style={{ fontSize: '12px', padding: '5px 10px', background: '#10b981', color: '#0f172a', fontWeight: 700, border: 'none' }}
            >
              ▶ {confirmingId ? 'Confirming...' : 'Confirm & Execute'}
            </button>
          </div>
        </div>
      )}

      <div className="chat-messages-container">
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {m.sender === 'agent' ? <Bot size={13} /> : <User size={13} />}
              <span style={{ fontSize: '11px', opacity: 0.8 }}>
                {m.sender === 'agent' ? 'XyOps' : 'You'} • {m.timestamp}
              </span>
            </div>

            <div>{m.text}</div>

            {m.plan && (m.plan.execution_plan.tool || (m.plan.execution_plan.steps && m.plan.execution_plan.steps.length > 0)) && (
              <div className="execution-plan-card">
                <div className="plan-header">
                  <span className="plan-tag">
                    <Sparkles size={13} />
                    {m.plan.execution_plan.steps ? 'Multi-Step DAG Pipeline' : 'Proposed Action Plan'}
                  </span>
                  <span className="plan-tool-name">
                    {m.plan.execution_plan.steps ? `${m.plan.execution_plan.steps.length} Steps Planned` : m.plan.execution_plan.tool}
                  </span>
                </div>

                {/* Multi-step DAG checklist */}
                {m.plan.execution_plan.steps && m.plan.execution_plan.steps.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
                    {m.plan.execution_plan.steps.map((st, sidx) => (
                      <div key={sidx} style={{
                        background: 'var(--bg-primary)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11.5px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>{sidx + 1}.</span>
                          <span>{st.description || st.tool}</span>
                          <code className="font-mono" style={{ color: 'var(--accent-blue)', fontSize: '10.5px' }}>({st.tool})</code>
                        </div>
                        {st.rollback_tool && (
                          <span style={{ fontSize: '10px', color: 'var(--status-warning)', background: 'rgba(245, 158, 11, 0.1)', padding: '1px 5px', borderRadius: 3 }}>
                            Rollback: {st.rollback_tool}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="plan-params-box">
                    <pre>{JSON.stringify(m.plan.execution_plan.parameters, null, 2)}</pre>
                  </div>
                )}

                {m.plan.execution_plan.requires_confirmation ? (
                  <>
                    {resolvedTasks.has(m.plan.task_id) ? (
                      /* Plan actioned — show resolved status chip */
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '11.5px' }}>
                        {resolvedTasks.get(m.plan.task_id) === 'cancelled' ? (
                          <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={13} /> Task #{m.plan!.task_id} was cancelled
                          </span>
                        ) : (
                          <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} /> Task #{m.plan!.task_id} confirmed — running
                          </span>
                        )}
                      </div>
                    ) : isPlanPending(m.plan.task_id) ? (
                      /* Awaiting confirmation — hint to use the banner above */
                      <div style={{ fontSize: '11px', color: '#fbbf24', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <AlertTriangle size={12} /> Use the Safety Gate above to confirm or cancel
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div style={{ fontSize: '11.5px', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={13} /> Safe operation auto-dispatched
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="prompt-chips-row">
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            className="prompt-chip"
            onClick={() => handleSend(prompt)}
            disabled={isProcessing || isViewer}
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className="chat-input-wrapper">
        <input
          type="text"
          className="chat-input"
          placeholder={
            isViewer
              ? 'Read-only mode: Viewer role cannot issue commands. Login as Operator or Admin.'
              : 'Type a natural language command (e.g. Deploy MOM frontend QA to UAT)...'
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={isProcessing || isViewer}
        />
        <button
          className="btn btn-primary"
          onClick={() => handleSend()}
          disabled={isProcessing || !input.trim() || isViewer}
        >
          <Send size={15} />
          Execute
        </button>
      </div>
    </div>
  );
};
