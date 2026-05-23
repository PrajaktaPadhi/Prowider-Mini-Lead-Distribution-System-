'use client';

import { useState, useRef } from 'react';

export default function TestToolsPage() {
  const [resetLog, setResetLog] = useState('');
  const [idempotencyLog, setIdempotencyLog] = useState('');
  const [concurrencyLog, setConcurrencyLog] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [idempotencyLoading, setIdempotencyLoading] = useState(false);
  const [concurrencyLoading, setConcurrencyLoading] = useState(false);

  // Generate a unique idempotency key for the current reset session
  const idempotencyKeyRef = useRef(`reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const appendLog = (setter, message) => {
    const timestamp = new Date().toLocaleTimeString();
    setter(prev => `[${timestamp}] ${message}\n${prev}`);
  };

  // ===== 1. Reset Provider Quotas =====
  const handleResetQuota = async () => {
    setResetLoading(true);
    // Generate a NEW idempotency key for this reset action
    const key = `reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    appendLog(setResetLog, `Calling webhook with key: ${key}`);

    try {
      const res = await fetch('/api/webhook/reset-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: key }),
      });
      const data = await res.json();
      appendLog(setResetLog, `Response: ${JSON.stringify(data, null, 2)}`);
    } catch (err) {
      appendLog(setResetLog, `Error: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  // ===== 2. Test Idempotency (call 5x with SAME key) =====
  const handleIdempotencyTest = async () => {
    setIdempotencyLoading(true);
    const key = idempotencyKeyRef.current;
    appendLog(setIdempotencyLog, `Sending 5 webhook calls with SAME key: ${key}`);

    const results = [];

    for (let i = 1; i <= 5; i++) {
      try {
        const res = await fetch('/api/webhook/reset-quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: key }),
        });
        const data = await res.json();
        results.push(data);
        appendLog(setIdempotencyLog, `Call #${i}: alreadyProcessed=${data.alreadyProcessed}, message="${data.message}"`);
      } catch (err) {
        appendLog(setIdempotencyLog, `Call #${i}: Error - ${err.message}`);
      }
    }

    const processedCount = results.filter(r => !r.alreadyProcessed).length;
    appendLog(setIdempotencyLog, `\nSummary: ${processedCount}/5 calls actually processed. ${5 - processedCount}/5 were deduplicated.`);

    // Regenerate key for next test
    idempotencyKeyRef.current = `reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setIdempotencyLoading(false);
  };

  // ===== 3. Generate 10 Concurrent Leads =====
  const handleGenerateLeads = async () => {
    setConcurrencyLoading(true);
    appendLog(setConcurrencyLog, 'Generating 10 concurrent leads...');

    try {
      const res = await fetch('/api/test/generate-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();

      appendLog(setConcurrencyLog, `Summary: ${data.summary?.successful || 0} successful, ${data.summary?.failed || 0} failed`);

      if (data.results) {
        for (const r of data.results) {
          if (r.error) {
            appendLog(setConcurrencyLog, `  Lead #${r.index}: ERROR - ${r.error}`);
          } else {
            appendLog(setConcurrencyLog, `  Lead #${r.index}: ${r.service} → [${r.allocation?.providers?.join(', ')}]`);
          }
        }
      }
    } catch (err) {
      appendLog(setConcurrencyLog, `Error: ${err.message}`);
    } finally {
      setConcurrencyLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Test Tools</h1>
        <p>Simulate webhooks, test idempotency, and stress-test concurrent lead generation.</p>
      </div>

      <div className="test-panel">
        {/* Section 1: Reset Quotas */}
        <div className="test-section">
          <h3>1. Reset Provider Quotas</h3>
          <p>
            Simulates a payment gateway confirming subscription renewal.
            Resets all providers&apos; monthly quotas back to 10.
            Each call uses a unique idempotency key.
          </p>
          <div className="test-actions">
            <button
              className="btn btn-success"
              onClick={handleResetQuota}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <><span className="spinner"></span> Resetting...</>
              ) : (
                '🔄 Reset All Quotas'
              )}
            </button>
          </div>
          {resetLog && <div className="test-log">{resetLog}</div>}
        </div>

        {/* Section 2: Idempotency Test */}
        <div className="test-section">
          <h3>2. Webhook Idempotency Test</h3>
          <p>
            Calls the reset-quota webhook 5 times with the <strong>same</strong> idempotency key.
            Only the first call should actually process. The rest should return cached results.
          </p>
          <div className="test-actions">
            <button
              className="btn btn-warning"
              onClick={handleIdempotencyTest}
              disabled={idempotencyLoading}
            >
              {idempotencyLoading ? (
                <><span className="spinner"></span> Testing...</>
              ) : (
                '🔁 Call Webhook 5x (Same Key)'
              )}
            </button>
          </div>
          {idempotencyLog && <div className="test-log">{idempotencyLog}</div>}
        </div>

        {/* Section 3: Concurrent Leads */}
        <div className="test-section">
          <h3>3. Concurrent Lead Generation</h3>
          <p>
            Generates 10 leads concurrently to test allocation logic under simultaneous requests.
            Verify that quotas are respected and round-robin distribution is fair.
          </p>
          <div className="test-actions">
            <button
              className="btn btn-danger"
              onClick={handleGenerateLeads}
              disabled={concurrencyLoading}
            >
              {concurrencyLoading ? (
                <><span className="spinner"></span> Generating...</>
              ) : (
                '⚡ Generate 10 Leads'
              )}
            </button>
          </div>
          {concurrencyLog && <div className="test-log">{concurrencyLog}</div>}
        </div>
      </div>
    </>
  );
}
