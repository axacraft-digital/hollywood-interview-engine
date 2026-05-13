import React, { useEffect, useState, useMemo, useCallback } from 'react';

const PIN_STORAGE_KEY = 'via-admin-pin';

function readStoredPin() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function writeStoredPin(pin) {
  if (typeof window === 'undefined') return;
  try {
    if (pin) window.localStorage.setItem(PIN_STORAGE_KEY, pin);
    else window.localStorage.removeItem(PIN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * SubmissionsView
 *
 * Hiring-authority view of all assessment submissions. The view is PIN-gated:
 * on first visit the owner enters a PIN, which is saved to localStorage so
 * future visits skip the prompt. The PIN itself is whatever string the
 * backend's /api/admin/submissions endpoint accepts via ?token=...
 *
 * Auth precedence:
 *   1. adminToken prop (passed via ?token= in URL — kept for dev convenience)
 *   2. localStorage 'via-admin-pin'
 *   3. PIN entry form
 *
 * Wrong PIN → server returns 401 → stored PIN is cleared → form re-appears.
 */
export default function SubmissionsView({ adminToken: initialToken }) {
  const [token, setToken] = useState(initialToken || readStoredPin());
  const [loading, setLoading] = useState(Boolean(initialToken || readStoredPin()));
  const [error, setError] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [filterFit, setFilterFit] = useState('all');
  const [sortBy, setSortBy] = useState('startedAt');
  const [sortDir, setSortDir] = useState('desc');
  const [pinInput, setPinInput] = useState('');

  const loadSubmissions = useCallback((t) => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/submissions?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (r.status === 401) {
          writeStoredPin('');
          setToken('');
          setError("That PIN didn't work. Try again.");
        } else if (!data.ok) {
          setError(data.message || 'Failed to load submissions.');
        } else {
          setSubmissions(data.submissions || []);
        }
        setLoading(false);
      })
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (token) loadSubmissions(token);
  }, [token, loadSubmissions]);

  const submitPin = (e) => {
    e.preventDefault();
    const trimmed = pinInput.trim();
    if (!trimmed) return;
    writeStoredPin(trimmed);
    setToken(trimmed);
    setPinInput('');
  };

  const signOut = () => {
    writeStoredPin('');
    setToken('');
    setSubmissions([]);
    setError(null);
  };

  const byEmail = useMemo(() => {
    const map = new Map();
    for (const s of submissions) {
      if (!map.has(s.email)) map.set(s.email, []);
      map.get(s.email).push(s);
    }
    return map;
  }, [submissions]);

  const fitOf = (s) => {
    const fitMap = {
      'vintage-specialist': 'ideal',
      'master-technician': 'secondary',
      tinkerer: 'weak',
      'service-mechanic': 'exclude',
    };
    return fitMap[s.quadrantId] || '—';
  };

  const filtered = useMemo(() => {
    let rows = submissions.filter((s) => {
      if (filterFit === 'all') return true;
      if (filterFit === 'incomplete') return !s.completedAt;
      return fitOf(s) === filterFit;
    });
    rows = [...rows].sort((a, b) => {
      const av = a[sortBy] || '';
      const bv = b[sortBy] || '';
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return rows;
  }, [submissions, filterFit, sortBy, sortDir]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const exportCsv = () => {
    const cols = [
      'email', 'name', 'phone', 'experienceYears', 'attemptNumber',
      'quadrantId', 'borderline', 'startedAt', 'completedAt',
      'curiosityScore', 'masteryScore',
    ];
    const rows = filtered.map((s) => [
      s.email,
      s.name,
      s.phone,
      s.experienceYears,
      s.attemptNumber,
      s.quadrantId || '',
      s.borderline ?? '',
      s.startedAt,
      s.completedAt || '',
      s.axisScores?.curiosity ?? '',
      s.axisScores?.mastery ?? '',
    ]);
    const csv = [cols.join(','), ...rows.map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // PIN gate — shown when no valid token is known.
  if (!token) {
    return (
      <section className="via-card via-pin-gate">
        <div className="via-eyebrow">Hiring authority view</div>
        <h1 className="via-title">Submissions admin</h1>
        <p className="via-subtitle">
          Enter the access PIN to see candidate submissions. The PIN is set by whoever
          deployed this site — ask them if you don't have it.
        </p>
        <form onSubmit={submitPin} className="via-pin-form">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Access PIN"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            className="via-pin-input"
            autoFocus
          />
          <button type="submit" className="via-btn via-btn-primary">Sign in</button>
        </form>
        {error && <p className="via-pin-error">{error}</p>}
      </section>
    );
  }

  if (loading) return <div className="via-card via-loading">Loading submissions…</div>;
  if (error) {
    return (
      <div className="via-card via-error">
        <h2>Couldn't load submissions</h2>
        <p>{error}</p>
        <button className="via-btn" onClick={signOut} style={{ marginTop: 12 }}>
          Sign out and re-enter PIN
        </button>
      </div>
    );
  }

  return (
    <section className="via-card via-submissions">
      <div className="via-eyebrow">Hiring authority view</div>
      <h1 className="via-title">Submissions</h1>
      <p className="via-subtitle">
        {submissions.length} total · {byEmail.size} unique candidates · {' '}
        {submissions.filter((s) => s.completedAt).length} completed
      </p>

      <div className="via-submissions-controls">
        <label>
          Filter:&nbsp;
          <select value={filterFit} onChange={(e) => setFilterFit(e.target.value)}>
            <option value="all">All</option>
            <option value="ideal">Ideal fit (Hollywood Mechanic)</option>
            <option value="secondary">Secondary (Master Technician)</option>
            <option value="weak">Weak (Tinkerer)</option>
            <option value="exclude">Exclude (Service Mechanic)</option>
            <option value="incomplete">Incomplete (abandoned)</option>
          </select>
        </label>
        <button className="via-btn" onClick={exportCsv}>Export CSV</button>
        <button className="via-btn" onClick={signOut}>Sign out</button>
      </div>

      <div className="via-table-wrap">
        <table className="via-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort('email')}>Email ↕</th>
              <th onClick={() => toggleSort('name')}>Name ↕</th>
              <th onClick={() => toggleSort('attemptNumber')}>Attempt ↕</th>
              <th onClick={() => toggleSort('quadrantId')}>Quadrant ↕</th>
              <th>Curiosity</th>
              <th>Mastery</th>
              <th onClick={() => toggleSort('startedAt')}>Started ↕</th>
              <th onClick={() => toggleSort('completedAt')}>Completed ↕</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const fit = fitOf(s);
              return (
                <tr key={s.sessionId} className={`via-fit-row-${fit}`}>
                  <td><strong>{s.email}</strong></td>
                  <td>{s.name}</td>
                  <td>{s.attemptNumber > 1 ? <span className="via-attempt-flag">{s.attemptNumber}</span> : s.attemptNumber}</td>
                  <td>
                    {s.quadrantId ? (
                      <span className={`via-quad-pill via-fit-${fit}`}>{s.quadrantId}</span>
                    ) : (
                      <span className="via-incomplete">incomplete</span>
                    )}
                  </td>
                  <td>{s.axisScores ? s.axisScores.curiosity.toFixed(2) : '—'}</td>
                  <td>{s.axisScores ? s.axisScores.mastery.toFixed(2) : '—'}</td>
                  <td>{formatDt(s.startedAt)}</td>
                  <td>{s.completedAt ? formatDt(s.completedAt) : '—'}</td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', color: 'var(--via-muted)', padding: 24 }}>
                  No submissions match the current filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function formatDt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString();
}
