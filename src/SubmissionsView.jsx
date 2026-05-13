import React, { useEffect, useState, useMemo } from 'react';

/**
 * SubmissionsView
 *
 * Hiring-authority view of all assessment submissions. Fetches /api/admin/submissions
 * (with token query param) and renders a sortable, filterable table.
 *
 * This is the prototype answer to "where does the hiring authority see the
 * results?" In production, swap this for whatever backend admin you set up
 * (Supabase Studio, Retool, Metabase, etc.).
 */
export default function SubmissionsView({ adminToken = 'dev-admin-token' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [filterFit, setFilterFit] = useState('all');
  const [sortBy, setSortBy] = useState('startedAt');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    const url = `/api/admin/submissions?token=${encodeURIComponent(adminToken)}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
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
  }, [adminToken]);

  // Build a per-email summary: total attempts + most-recent result
  const byEmail = useMemo(() => {
    const map = new Map();
    for (const s of submissions) {
      if (!map.has(s.email)) map.set(s.email, []);
      map.get(s.email).push(s);
    }
    return map;
  }, [submissions]);

  const fitOf = (s) => {
    // Derive fit from quadrantId via a known map (for the v1 instrument).
    // In a real deployment this would come from the instrument JSON cached server-side.
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

  if (loading) return <div className="via-card via-loading">Loading submissions…</div>;
  if (error)
    return (
      <div className="via-card via-error">
        <h2>Couldn't load submissions</h2>
        <p>{error}</p>
        <p style={{ fontSize: 13, color: 'var(--via-muted)' }}>
          Tip: pass the admin token in the URL, e.g.{' '}
          <code>?submissions=1&token=dev-admin-token</code>
        </p>
      </div>
    );

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
