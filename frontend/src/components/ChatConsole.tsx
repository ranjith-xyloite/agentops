import React, { useState } from 'react';
import { Send, Bot, User, Play, XCircle, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';
import { ChatPlanResponse } from '../types';
import { useAuth } from '../context/AuthContext';

interface Message {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  plan?: ChatPlanResponse;
  timestamp: string;
}

interface ChatConsoleProps {
  onSendMessage: (msg: string) => Promise<ChatPlanResponse>;
  onConfirmTask: (taskId: number) => Promise<void>;
  onCancelTask: (taskId: number) => Promise<void>;
  onSelectTaskToStream: (taskId: number) => void;
  isProcessing: boolean;
}

const QUICK_PROMPTS = [
  'Deploy MOM frontend QA branch to UAT',
  'Deploy MOM backend main branch to UAT',
  'Check Docker containers on UAT',
  'Run server health checks on UAT',
  'Restart container mom-frontend on UAT',
];

export const ChatConsole: React.FC<ChatConsoleProps> = ({
  onSendMessage,
  onConfirmTask,
  onCancelTask,
  onSelectTaskToStream,
  isProcessing,
}) => {
  const { role } = useAuth();
  const isViewer = role === 'viewer';

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: 'Hello! I am your AgentOps DevOps Assistant. Tell me what you would like to deploy, monitor, or inspect across your infrastructure.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const handleSend = async (textToSend?: string) => {
    if (isViewer) {
      alert('Read-only mode: Viewer accounts cannot dispatch DevOps commands.');
      return;
    }
    const text = (textToSend || input).trim();
    if (!text || isProcessing) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');

    try {
      const plan = await onSendMessage(text);
      const agentMsg: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: plan.execution_plan.tool
          ? `I have formulated an execution plan for task #${plan.task_id}:`
          : (plan.execution_plan.question || 'I could not determine an appropriate tool for this request.'),
        plan,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, agentMsg]);
      onSelectTaskToStream(plan.task_id);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        text: `Error processing request: ${err.message || 'Unknown error'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  return (
    <div className="card-panel">
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

      <div className="chat-messages-container">
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.sender}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              {m.sender === 'agent' ? <Bot size={13} /> : <User size={13} />}
              <span style={{ fontSize: '11px', opacity: 0.8 }}>
                {m.sender === 'agent' ? 'AgentOps' : 'You'} • {m.timestamp}
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
                  <div className="plan-action-bar">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => onCancelTask(m.plan!.task_id)}
                      disabled={isViewer}
                    >
                      <XCircle size={13} />
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onConfirmTask(m.plan!.task_id)}
                      disabled={isViewer}
                    >
                      <Play size={13} />
                      Confirm & Execute {m.plan.execution_plan.steps ? 'Pipeline' : ''}
                    </button>
                  </div>
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
