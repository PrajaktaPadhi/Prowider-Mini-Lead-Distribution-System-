import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="home-hero">
      <h1>Prowider Mini</h1>
      <p>Lead distribution system with fair allocation, real-time updates, and webhook idempotency.</p>

      <div className="home-cards">
        <Link href="/request-service" className="home-card">
          <span className="home-card-icon">📋</span>
          <h3>Request a Service</h3>
          <p>Submit a service enquiry. Your lead will be automatically assigned to providers based on fair distribution rules.</p>
        </Link>

        <Link href="/dashboard" className="home-card">
          <span className="home-card-icon">📊</span>
          <h3>Provider Dashboard</h3>
          <p>View all providers, their quotas, and assigned leads. Updates in real time via Server-Sent Events.</p>
        </Link>

        <Link href="/test-tools" className="home-card">
          <span className="home-card-icon">🔧</span>
          <h3>Test Tools</h3>
          <p>Simulate webhooks, test idempotency, and generate concurrent leads to stress-test the system.</p>
        </Link>
      </div>
    </div>
  );
}
