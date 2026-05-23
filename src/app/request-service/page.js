'use client';

import { useState, useEffect } from 'react';

export default function RequestServicePage() {
  const [services, setServices] = useState([]);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    city: '',
    serviceId: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/services')
      .then(res => res.json())
      .then(data => {
        if (data.services) setServices(data.services);
      })
      .catch(err => console.error('Failed to load services:', err));
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit lead');
      } else {
        setResult(data);
        setForm({ name: '', phone: '', city: '', serviceId: '', description: '' });
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h1>Request a Service</h1>
        <p>Submit your enquiry and we&apos;ll connect you with the right providers.</p>
      </div>

      <div className="form-container">
        {result && (
          <div className="alert alert-success">
            ✅ Lead submitted successfully! Assigned to{' '}
            <strong>{result.allocation?.totalAssigned || 0}</strong> provider(s):
            {result.allocation?.assignments?.map(a => a.providerName).join(', ')}
          </div>
        )}

        {error && (
          <div className="alert alert-error">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="card">
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              className="form-input"
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              className="form-input"
              placeholder="9999999999"
              value={form.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="city">City</label>
            <input
              id="city"
              name="city"
              type="text"
              className="form-input"
              placeholder="Mumbai"
              value={form.city}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="serviceId">Service Type</label>
            <select
              id="serviceId"
              name="serviceId"
              className="form-select"
              value={form.serviceId}
              onChange={handleChange}
              required
            >
              <option value="">Select a service</option>
              {services.map(svc => (
                <option key={svc._id} value={svc._id}>{svc.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              className="form-textarea"
              placeholder="Describe your requirements..."
              value={form.description}
              onChange={handleChange}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Submitting...
              </>
            ) : (
              'Submit Enquiry'
            )}
          </button>
        </form>
      </div>
    </>
  );
}
