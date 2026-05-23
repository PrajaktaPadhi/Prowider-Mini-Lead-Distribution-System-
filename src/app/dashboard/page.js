'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function DashboardPage() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef(null);

  // Fetch full provider data
  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      if (data.providers) {
        setProviders(data.providers);
      }
    } catch (err) {
      console.error('Failed to fetch providers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // SSE connection for real-time updates
  useEffect(() => {
    const connectSSE = () => {
      const es = new EventSource('/api/dashboard/stream');
      eventSourceRef.current = es;

      es.onopen = () => {
        setSseConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connected') {
            setSseConnected(true);
            return;
          }

          if (data.type === 'new_assignments' && data.assignments?.length > 0) {
            // Refetch full data to get accurate state
            fetchProviders();
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };

      es.onerror = () => {
        setSseConnected(false);
        es.close();
        // Reconnect after 3 seconds
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fetchProviders]);

  if (loading) {
    return (
      <>
        <div className="page-header">
          <h1>Provider Dashboard</h1>
          <p>Loading...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>Provider Dashboard</h1>
            <p>Real-time view of all providers and their assigned leads.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="sse-indicator">
              <span className={`sse-dot ${sseConnected ? 'connected' : ''}`}></span>
              {sseConnected ? 'Live' : 'Reconnecting...'}
            </span>
            <button className="btn btn-outline" onClick={fetchProviders} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="providers-grid">
        {providers.map(provider => (
          <div key={provider.id} className="provider-card">
            <div className="provider-card-header">
              <span className="provider-name">{provider.name}</span>
              {provider.remainingQuota <= 0 ? (
                <span className="badge badge-danger">Quota Full</span>
              ) : provider.remainingQuota <= 3 ? (
                <span className="badge badge-warning">Low Quota</span>
              ) : (
                <span className="badge badge-success">Active</span>
              )}
            </div>

            <div className="provider-stats">
              <div className="stat-item">
                <div className="stat-value">{provider.remainingQuota}</div>
                <div className="stat-label">Remaining</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{provider.leadsReceived}</div>
                <div className="stat-label">Received</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{provider.monthlyQuota}</div>
                <div className="stat-label">Quota</div>
              </div>
            </div>

            <div className="provider-leads-list">
              {provider.assignments.length === 0 ? (
                <div className="leads-empty">No leads assigned yet</div>
              ) : (
                provider.assignments.map(assignment => (
                  <div key={assignment.id} className="lead-item">
                    <div className="lead-item-name">
                      {assignment.lead?.name || 'Unknown'}
                    </div>
                    <div className="lead-item-meta">
                      {assignment.lead?.phone} · {assignment.lead?.city} · {assignment.service}
                      {' · '}
                      {new Date(assignment.assignedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
