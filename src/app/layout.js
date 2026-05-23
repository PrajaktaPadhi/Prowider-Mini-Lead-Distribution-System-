import "./globals.css";

export const metadata = {
  title: "Prowider Mini — Lead Distribution System",
  description: "A lead generation and distribution platform with fair allocation, real-time dashboards, and webhook idempotency.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="navbar-inner">
            <a href="/" className="navbar-brand">
              Prowider<span>Mini</span>
            </a>
            <ul className="navbar-links">
              <li><a href="/request-service">Request Service</a></li>
              <li><a href="/dashboard">Dashboard</a></li>
              <li><a href="/test-tools">Test Tools</a></li>
            </ul>
          </div>
        </nav>
        <main className="app-container">
          {children}
        </main>
      </body>
    </html>
  );
}
