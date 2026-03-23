import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const AUTO_REFRESH_MS = 5_000;
const STREAM_URL = `${API_URL}/events/stream`;

const regions = ['ASIA', 'EUROPE', 'US'];

function getRemainingTime(expiresAt, nowMs) {
  const remainingMs = new Date(expiresAt).getTime() - nowMs;
  if (remainingMs <= 0) {
    return { label: 'Expired', tone: 'danger' };
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const label = `${minutes}:${String(seconds).padStart(2, '0')}`;

  if (totalSeconds <= 60) {
    return { label, tone: 'danger' };
  }

  if (totalSeconds <= 5 * 60) {
    return { label, tone: 'warn' };
  }

  return { label, tone: 'normal' };
}

async function api(path, options = {}, token) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  return response.json();
}

export default function App() {
  const [userId, setUserId] = useState('mod-asia-1');
  const [region, setRegion] = useState('ASIA');
  const [token, setToken] = useState('');
  const [events, setEvents] = useState([]);
  const [activeAssignments, setActiveAssignments] = useState([]);
  const [metrics, setMetrics] = useState({ totalAvailable: 0, active: 0, expired: 0 });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [toasts, setToasts] = useState([]);

  const toastTimeoutsRef = useRef(new Map());
  const activeEventIdsRef = useRef(new Set());
  const acknowledgedEventIdsRef = useRef(new Set());

  const loggedIn = useMemo(() => Boolean(token), [token]);

  const errorMessage = useMemo(() => {
    if (!error) {
      return '';
    }

    try {
      const parsed = JSON.parse(error);
      if (parsed?.message) {
        return String(parsed.message);
      }
    } catch {
      return error;
    }

    return error;
  }, [error]);

  function removeToast(id) {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timeoutId = toastTimeoutsRef.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      toastTimeoutsRef.current.delete(id);
    }
  }

  function pushToast(message, tone = 'info') {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, message, tone }].slice(-4));

    const timeoutId = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      toastTimeoutsRef.current.delete(id);
    }, 3000);

    toastTimeoutsRef.current.set(id, timeoutId);
  }

  async function login() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ userId, region }),
      });
      setToken(data.accessToken);
      setError('');
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailable() {
    setLoading(true);
    setError('');
    try {
      const [data, metricsData] = await Promise.all([
        api('/events/available', { method: 'GET' }, token),
        api('/metrics', { method: 'GET' }, token),
      ]);
      setEvents(data);
      setMetrics({
        totalAvailable: data.length,
        active: Number(metricsData.active ?? 0),
        expired: Number(metricsData.expired ?? 0),
      });
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function loadAssignments() {
    setLoading(true);
    setError('');
    try {
      const [data, metricsData] = await Promise.all([
        api('/assignments/me/active', { method: 'GET' }, token),
        api('/metrics', { method: 'GET' }, token),
      ]);
      setActiveAssignments(data);
      setMetrics((prev) => ({
        ...prev,
        active: Number(metricsData.active ?? 0),
        expired: Number(metricsData.expired ?? 0),
      }));
    } catch (err) {
      setError(String(err.message ?? err));
    } finally {
      setLoading(false);
    }
  }

  async function claim(eventId) {
    setLoading(true);
    setError('');
    try {
      await api(`/events/${eventId}/claim`, { method: 'POST' }, token);
      await Promise.all([loadAvailable(), loadAssignments()]);
      pushToast('Event claimed successfully', 'success');
    } catch (err) {
      setError(String(err.message ?? err));
      setLoading(false);
    }
  }

  async function acknowledge(eventId) {
    setLoading(true);
    setError('');
    try {
      await api(`/events/${eventId}/acknowledge`, { method: 'POST' }, token);
      acknowledgedEventIdsRef.current.add(eventId);
      await Promise.all([loadAvailable(), loadAssignments()]);
      pushToast('Event acknowledged', 'success');
    } catch (err) {
      setError(String(err.message ?? err));
      setLoading(false);
    }
  }

  async function reseedEvents() {
    setLoading(true);
    setError('');
    try {
      const result = await api('/events/reseed', { method: 'POST' }, token);
      await Promise.all([loadAvailable(), loadAssignments()]);
      pushToast(`Events reseeded (${result.inserted} added)`, 'success');
    } catch (err) {
      setError(String(err.message ?? err));
      setLoading(false);
    }
  }

  function logout() {
    setToken('');
    setEvents([]);
    setActiveAssignments([]);
    setMetrics({ totalAvailable: 0, active: 0, expired: 0 });
    setError('');
    activeEventIdsRef.current = new Set();
    acknowledgedEventIdsRef.current = new Set();
    toastTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    toastTimeoutsRef.current.clear();
    setToasts([]);
  }

  async function refreshDashboard() {
    const [availableData, assignmentsData, metricsData] = await Promise.all([
      api('/events/available', { method: 'GET' }, token),
      api('/assignments/me/active', { method: 'GET' }, token),
      api('/metrics', { method: 'GET' }, token),
    ]);

    setEvents(availableData);
    setActiveAssignments(assignmentsData);
    setMetrics({
      totalAvailable: availableData.length,
      active: Number(metricsData.active ?? 0),
      expired: Number(metricsData.expired ?? 0),
    });

    const previous = activeEventIdsRef.current;
    const current = new Set(assignmentsData.map((assignment) => assignment.eventId));

    previous.forEach((eventId) => {
      if (!current.has(eventId)) {
        if (acknowledgedEventIdsRef.current.has(eventId)) {
          acknowledgedEventIdsRef.current.delete(eventId);
          return;
        }
        pushToast('Event expired', 'warn');
      }
    });

    activeEventIdsRef.current = current;
  }

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    let cancelled = false;

    const refreshDashboardInterval = async () => {
      try {
        await refreshDashboard();
        if (cancelled) {
          return;
        }
      } catch {
        if (cancelled) {
          return;
        }
      }
    };

    refreshDashboardInterval();
    const intervalId = setInterval(refreshDashboardInterval, AUTO_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const eventSource = new EventSource(`${STREAM_URL}?access_token=${encodeURIComponent(token)}`);

    eventSource.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type && payload.type !== 'stream.connected') {
          await refreshDashboard();
          pushToast(`Live update: ${payload.type}`, 'info');
        }
      } catch {
        // ignore malformed stream events
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

  useEffect(() => {
    return () => {
      toastTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
      toastTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const ticker = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(ticker);
  }, [token]);

  if (!loggedIn) {
    return (
      <main className="app-shell login-page">
        <div className="login-card card">
          <header className="app-header login-header">
            <p className="eyebrow">Moderation Console</p>
            <h1>Region-Aware Event Assignment</h1>
            <p>Sign in to access your region-specific moderation queue.</p>
          </header>

          <section className="login-section">
            <h2>Login</h2>
            <div className="login-row">
              <input
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user_id"
                className="input"
              />
              <select value={region} onChange={(e) => setRegion(e.target.value)} className="input select">
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button onClick={login} disabled={loading} className="btn btn-primary">
                Login
              </button>
            </div>
          </section>

          {errorMessage && <p className="error">{errorMessage}</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="app-container">
        <header className="app-header">
          <h1>Region-Aware Event Assignment</h1>
          <div className="dashboard-topbar">
            <p>
              Logged in as <strong>{userId}</strong>
            </p>
            <div className="topbar-actions">
              <span className="badge badge-region">{region}</span>
              <button onClick={logout} className="btn">
                Logout
              </button>
            </div>
          </div>
        </header>

        <section className="metrics-bar card" aria-label="System metrics">
          <div className="metric-item">
            <p className="metric-label">Total Available Events</p>
            <p className="metric-value">{metrics.totalAvailable}</p>
          </div>
          <div className="metric-item">
            <p className="metric-label">Active (Claimed)</p>
            <p className="metric-value">{metrics.active}</p>
          </div>
          <div className="metric-item">
            <p className="metric-label">Expired</p>
            <p className="metric-value">{metrics.expired}</p>
          </div>
        </section>

        <div className="dashboard-meta-row">
          <p className="auto-refresh-indicator">Auto-refreshing every 5s...</p>
          <div className="status-legend" aria-label="Status colors">
            <span className="badge badge-status available">Available</span>
            <span className="badge badge-status claimed">Claimed</span>
            <span className="badge badge-status acknowledged">Acknowledged</span>
            <span className="badge badge-status expired">Expired</span>
          </div>
        </div>

        <div className="grid">
          <section className="card">
            <div className="section-head">
              <h2>Available Events</h2>
              <div className="section-actions">
                <button onClick={loadAvailable} disabled={loading} className="btn">
                  Refresh
                </button>
                <button onClick={reseedEvents} disabled={loading} className="btn">
                  Reseed
                </button>
              </div>
            </div>

            {events.length === 0 ? (
              <p className="empty">No events available right now 🎉</p>
            ) : (
              <ul className="list">
                {events.map((event) => (
                  <li key={event.id} className="list-item">
                    <div>
                      <p className="title">{event.title}</p>
                      <div className="meta-row">
                        <span className="badge badge-region">{event.region}</span>
                        <span className={`badge badge-status ${String(event.status).toLowerCase()}`}>
                          {event.status}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => claim(event.id)} disabled={loading} className="btn btn-primary">
                      Claim
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="section-head">
              <h2>My Active Assignments</h2>
              <button onClick={loadAssignments} disabled={loading} className="btn">
                Refresh
              </button>
            </div>

            {activeAssignments.length === 0 ? (
              <p className="empty">You haven’t claimed any events yet.</p>
            ) : (
              <ul className="list">
                {activeAssignments.map((assignment) => {
                  const remaining = getRemainingTime(assignment.expiresAt, nowMs);
                  return (
                    <li key={assignment.id} className="list-item">
                      <div>
                        <p className={`meta assignment-timer ${remaining.tone}`}>
                          Time left: {remaining.label}
                        </p>
                        <p className="title">Event: {assignment.eventId}</p>
                        <div className="meta-row">
                          <span className="badge badge-status claimed">Claimed</span>
                        </div>
                        <p className="meta mono">Expires: {new Date(assignment.expiresAt).toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => acknowledge(assignment.eventId)}
                        disabled={loading}
                        className="btn btn-primary"
                      >
                        Acknowledge
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {errorMessage && <p className="error">{errorMessage}</p>}
      </div>

      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone}`}>
            <span>{toast.message}</span>
            <button className="toast-close" onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
