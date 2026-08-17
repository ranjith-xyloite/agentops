import React, { useState, useEffect } from 'react';
import {
  Webhook, ShieldAlert, Plus, Trash2, Send,
  RefreshCw, ShieldCheck
} from 'lucide-react';
import { WebhookSubscription, PolicyRule } from '../types';
import {
  listWebhooksApi, createWebhookApi, deleteWebhookApi, testWebhookApi,
  listPoliciesApi, createPolicyApi, deletePolicyApi
} from '../services/api';

export const PoliciesAndWebhooks: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'webhooks' | 'policies'>('webhooks');

  // Webhooks state
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('');
  const [whSecret, setWhSecret] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  // Policies state
  const [policies, setPolicies] = useState<PolicyRule[]>([]);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [polName, setPolName] = useState('');
  const [polEnv, setPolEnv] = useState('production');
  const [blockWeekends, setBlockWeekends] = useState(true);
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(20);

  const [isLoading, setIsLoading] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [whs, pols] = await Promise.all([
        listWebhooksApi().catch(() => []),
        listPoliciesApi().catch(() => []),
      ]);
      setWebhooks(whs);
      setPolicies(pols);
    } catch (err) {
      console.error('Failed to load policies/webhooks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName || !whUrl) return;
    try {
      await createWebhookApi({
        name: whName,
        url: whUrl,
        secret: whSecret || undefined,
        event_types: ["task.failed", "task.success", "task.awaiting_confirmation", "task.rolled_back"]
      });
      setWhName('');
      setWhUrl('');
      setWhSecret('');
      setShowAddWebhook(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create webhook');
    }
  };

  const handleTestWebhook = async (url: string, secret?: string) => {
    setTestResult('Sending test ping payload...');
    try {
      const res = await testWebhookApi({ url, secret });
      setTestResult(`Ping Response (HTTP ${res.status_code}): ${res.response_text || 'OK'}`);
    } catch (err: any) {
      setTestResult(`Test Ping Error: ${err.message}`);
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    if (window.confirm('Delete this webhook subscription?')) {
      await deleteWebhookApi(id);
      await loadData();
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!polName) return;
    try {
      await createPolicyApi({
        name: polName,
        environment: polEnv,
        block_weekends: blockWeekends,
        allowed_hours_start: startHour,
        allowed_hours_end: endHour,
        require_double_confirm: true,
        is_active: true
      });
      setPolName('');
      setShowAddPolicy(false);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create policy');
    }
  };

  const handleDeletePolicy = async (id: number) => {
    if (window.confirm('Delete this policy rule?')) {
      await deletePolicyApi(id);
      await loadData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header Panel */}
      <div className="card-panel" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="brand-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-failed)' }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: '17px', fontWeight: 700 }}>DevOps Policies & Outbound Webhooks</h2>
                <span className="badge badge-success" style={{ fontSize: '11px' }}>
                  GUARDRAILS ACTIVE
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Enforce production change freezes, deployment time-windows, and broadcast real-time alerts to Slack/Discord.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'inline-flex', background: 'var(--bg-primary)', padding: 3, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <button
                className={`btn btn-sm ${activeSubTab === 'webhooks' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none' }}
                onClick={() => setActiveSubTab('webhooks')}
              >
                <Webhook size={13} />
                Webhooks ({webhooks.length})
              </button>
              <button
                className={`btn btn-sm ${activeSubTab === 'policies' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ border: 'none' }}
                onClick={() => setActiveSubTab('policies')}
              >
                <ShieldCheck size={13} />
                Guardrail Policies ({policies.length})
              </button>
            </div>

            <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={isLoading}>
              <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {testResult && (
        <div className="card-panel" style={{ padding: '12px 16px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid var(--accent-blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 600 }}>{testResult}</span>
          <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setTestResult(null)}>Dismiss</button>
        </div>
      )}

      {/* WEBHOOKS TAB */}
      {activeSubTab === 'webhooks' && (
        <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Outbound Webhook Subscriptions (Slack / Discord / Custom)</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddWebhook(true)}>
              <Plus size={13} /> Add Webhook
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Destination URL</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Subscribed Events</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No webhook subscriptions. Click "Add Webhook" to connect Slack or Discord channels.
                  </td>
                </tr>
              ) : (
                webhooks.map((wh) => (
                  <tr key={wh.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{wh.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <code className="font-mono" style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 4, color: 'var(--accent-cyan)' }}>
                        {wh.url}
                      </code>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {(wh.event_types || []).map((e) => (
                          <span key={e} className="badge badge-running" style={{ fontSize: '10px' }}>{e}</span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleTestWebhook(wh.url)}
                          title="Send Test Ping Event"
                          style={{ padding: '4px 8px' }}
                        >
                          <Send size={12} /> Test
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleDeleteWebhook(wh.id)}
                          title="Delete Webhook"
                          style={{ padding: '4px 8px', color: 'var(--status-failed)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* POLICIES TAB */}
      {activeSubTab === 'policies' && (
        <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Deployment Safety Guardrails & Change Freezes</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddPolicy(true)}>
              <Plus size={13} /> Add Policy Rule
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Policy Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Environment</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Weekend Freeze</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Allowed Window</th>
                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    No policy rules configured. Click "Add Policy Rule" to enforce deployment guardrails.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-warning" style={{ textTransform: 'uppercase' }}>{p.environment}</span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {p.block_weekends ? (
                        <span className="badge badge-failed">BLOCKED (FRI 18:00 - SUN 23:59)</span>
                      ) : (
                        <span className="badge badge-pending">ALLOWED</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <code className="font-mono">{p.allowed_hours_start}:00 - {p.allowed_hours_end}:00 UTC</code>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge-success">ACTIVE</span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDeletePolicy(p.id)}
                        title="Delete Policy"
                        style={{ padding: '4px 8px', color: 'var(--status-failed)' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Webhook Modal */}
      {showAddWebhook && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(7, 10, 17, 0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '520px', padding: 24 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 14 }}>Add Webhook Notification Channel</h3>
            <form onSubmit={handleCreateWebhook} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Channel Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Production Slack Alerts"
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Webhook URL</label>
                <input
                  type="url"
                  className="input-field font-mono"
                  placeholder="https://hooks.slack.com/services/..."
                  value={whUrl}
                  onChange={(e) => setWhUrl(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>
                  HMAC Secret Key <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional, for signed payloads)</span>
                </label>
                <input
                  type="text"
                  className="input-field font-mono"
                  placeholder="secret_signing_key_..."
                  value={whSecret}
                  onChange={(e) => setWhSecret(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddWebhook(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Webhook</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Policy Modal */}
      {showAddPolicy && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(7, 10, 17, 0.85)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16
        }}>
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '520px', padding: 24 }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: 14 }}>Create Deployment Policy Guardrail</h3>
            <form onSubmit={handleCreatePolicy} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Policy Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Strict Production Freeze"
                  value={polName}
                  onChange={(e) => setPolName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Target Environment</label>
                <select className="input-field" value={polEnv} onChange={(e) => setPolEnv(e.target.value)}>
                  <option value="production">production</option>
                  <option value="uat">uat</option>
                  <option value="qa">qa</option>
                  <option value="dev">dev</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  id="block_weekends_cb"
                  checked={blockWeekends}
                  onChange={(e) => setBlockWeekends(e.target.checked)}
                />
                <label htmlFor="block_weekends_cb" style={{ fontSize: '12px', fontWeight: 500 }}>
                  Enforce Weekend Change Freeze (Friday 18:00 - Sunday 23:59 UTC)
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Allowed Start Hour (UTC)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className="input-field"
                    value={startHour}
                    onChange={(e) => setStartHour(parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: 4 }}>Allowed End Hour (UTC)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    className="input-field"
                    value={endHour}
                    onChange={(e) => setEndHour(parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddPolicy(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Policy Rule</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
