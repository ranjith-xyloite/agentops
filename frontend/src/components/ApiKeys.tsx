import React, { useState, useEffect, useMemo } from 'react';
import { Key, Plus, Trash2, Copy, Check, ShieldCheck, Search } from 'lucide-react';
import { APIKey } from '../types';
import { listApiKeysApi, createApiKeyApi, revokeApiKeyApi } from '../services/api';
import { PaginationControls } from './PaginationControls';

export const ApiKeys: React.FC = () => {
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(30);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const loadKeys = async () => {
    try {
      const data = await listApiKeysApi();
      setKeys(data);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const filteredKeys = useMemo(() => {
    if (!searchTerm.trim()) return keys;
    const term = searchTerm.toLowerCase();
    return keys.filter(
      (k) =>
        k.name.toLowerCase().includes(term) ||
        k.key_prefix.toLowerCase().includes(term) ||
        String(k.id).includes(term)
    );
  }, [keys, searchTerm]);

  const paginatedKeys = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredKeys.slice(start, start + pageSize);
  }, [filteredKeys, currentPage, pageSize]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName) return;
    try {
      const res = await createApiKeyApi(keyName, expiresInDays);
      setNewlyCreatedKey(res.raw_key || null);
      setKeyName('');
      setShowCreateModal(false);
      await loadKeys();
    } catch (err: any) {
      alert(`Error creating key: ${err.message}`);
    }
  };

  const handleRevokeKey = async (keyId: number) => {
    if (window.confirm('Are you sure you want to revoke this API key? Any pipelines using it will fail immediately.')) {
      try {
        await revokeApiKeyApi(keyId);
        await loadKeys();
      } catch (err: any) {
        alert(`Error revoking key: ${err.message}`);
      }
    }
  };

  const handleCopy = () => {
    if (newlyCreatedKey) {
      navigator.clipboard.writeText(newlyCreatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="card-panel" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div className="panel-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="panel-title">
          <Key size={18} style={{ color: 'var(--accent-cyan)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>API Keys (CI/CD Automation)</span>
            <span className="badge badge-primary" style={{ fontSize: '11px' }}>
              {filteredKeys.length} Keys
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="chat-input"
              style={{ padding: '6px 12px 6px 30px', fontSize: '12px', width: '180px' }}
              placeholder="Search key name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
            />
            <Search size={13} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
          </div>

          <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} />
            Generate Key
          </button>
        </div>
      </div>

      {newlyCreatedKey && (
        <div style={{
          margin: 16,
          padding: 16,
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 'var(--radius-md)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-success)', fontWeight: 600, fontSize: '13px', marginBottom: 8 }}>
            <ShieldCheck size={16} />
            <span>API Key Generated Successfully! Copy it now as it will NOT be shown again.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              readOnly
              value={newlyCreatedKey}
              className="chat-input font-mono"
              style={{ width: '100%', color: 'var(--accent-cyan)', background: 'var(--bg-primary)' }}
            />
            <button className="btn btn-primary" onClick={handleCopy}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button className="btn btn-secondary" onClick={() => setNewlyCreatedKey(null)}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {showCreateModal && (
        <form onSubmit={handleCreateKey} style={{ padding: 20, background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Key Name / Pipeline Identifier</label>
            <input
              type="text"
              className="chat-input"
              style={{ width: '100%', marginTop: 4 }}
              placeholder="e.g. GitHub Actions UAT Deployer"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              required
            />
          </div>

          <div style={{ flex: 1, minWidth: '140px' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Expiration (Days)</label>
            <select
              className="chat-input"
              style={{ width: '100%', marginTop: 4 }}
              value={expiresInDays || ''}
              onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : undefined)}
            >
              <option value="30">30 Days</option>
              <option value="90">90 Days</option>
              <option value="365">1 Year</option>
              <option value="">Never Expires</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary">Generate Key</button>
          <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
        </form>
      )}

      <div className="table-container" style={{ margin: 0 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>ID</th>
              <th>Name</th>
              <th>Key Prefix</th>
              <th>Status</th>
              <th>Expires</th>
              <th>Last Used</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedKeys.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '36px' }}>
                  <Key size={28} style={{ opacity: 0.4, margin: '0 auto 8px', display: 'block' }} />
                  <div>No active API keys found matching the filter.</div>
                </td>
              </tr>
            ) : (
              paginatedKeys.map((k) => (
                <tr key={k.id}>
                  <td className="font-mono" style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>
                    #{k.id}
                  </td>
                  <td style={{ fontWeight: 600 }}>{k.name}</td>
                  <td>
                    <span className="font-mono" style={{ background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: 4, fontSize: '12px', color: 'var(--accent-cyan)' }}>
                      agops_{k.key_prefix}_••••••••
                    </span>
                  </td>
                  <td>
                    {k.is_active ? (
                      <span className="badge badge-success">ACTIVE</span>
                    ) : (
                      <span className="badge badge-failed">REVOKED</span>
                    )}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {k.expires_at ? new Date(k.expires_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never used'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleRevokeKey(k.id)}
                      title="Revoke Key"
                      style={{ padding: '4px 8px' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <PaginationControls
        currentPage={currentPage}
        totalItems={filteredKeys.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel="API keys"
      />
    </div>
  );
};
