import React, { useEffect, useMemo, useState } from 'react';
import QuadrantChart from './QuadrantChart.jsx';
import BrochureIntro from './BrochureIntro.jsx';
import SubmissionsView from './SubmissionsView.jsx';
import {
  computeAxisScores,
  resolveQuadrant,
  flattenQuestions,
  totalQuestions,
} from './scoring.js';

/**
 * MechanicAssessment
 *
 * JSON-driven candidate self-screen. Pure renderer over the instrument JSON.
 *
 * Flow: brochure → email gate → questions → result
 *
 * Props:
 *  - instrument (object): parsed instrument JSON. Required unless instrumentUrl is given.
 *  - instrumentUrl (string): fetch instrument JSON from this URL on mount.
 *  - leadEndpoint (string): URL to POST lead capture (default /api/leads).
 *  - submissionEndpoint (string): URL template to POST results, with ":sessionId"
 *    placeholder. Default /api/submissions/:sessionId.
 *  - onLeadCapture (async function): override lead POST. Called with
 *    { instrumentId, instrumentVersion, email, name, phone, experienceYears }.
 *    Must return { ok, sessionId, attemptNumber, message? }.
 *  - onSubmit (async function): override result POST. Called with sessionId and
 *    { responses, axisScores, quadrantId, borderline, completedAt }.
 *    Should return { ok, message? }.
 *  - adminMode (boolean): show instrument preview at /?admin=1.
 *  - submissionsMode (boolean): show admin submissions table at /?submissions=1.
 *  - adminToken (string): token passed to /api/admin/submissions for the submissions view.
 *  - branding (object): { companyName, logoUrl }.
 */
export default function MechanicAssessment({
  instrument: instrumentProp,
  instrumentUrl,
  leadEndpoint = '/api/leads',
  submissionEndpoint = '/api/submissions/:sessionId',
  onLeadCapture,
  onSubmit,
  adminMode = false,
  submissionsMode = false,
  adminToken,
  branding = {},
}) {
  const [instrument, setInstrument] = useState(instrumentProp || null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!instrumentProp && instrumentUrl) {
      fetch(instrumentUrl)
        .then((r) => r.json())
        .then(setInstrument)
        .catch((e) => setLoadError(String(e)));
    }
  }, [instrumentProp, instrumentUrl]);

  if (loadError) return <div className="via-error">Failed to load assessment: {loadError}</div>;
  if (!instrument) return <div className="via-loading">Loading assessment…</div>;
  if (submissionsMode) return <SubmissionsView adminToken={adminToken} />;
  if (adminMode) return <AdminView instrument={instrument} />;

  return (
    <CandidateFlow
      instrument={instrument}
      leadEndpoint={leadEndpoint}
      submissionEndpoint={submissionEndpoint}
      onLeadCapture={onLeadCapture}
      onSubmit={onSubmit}
      branding={branding}
    />
  );
}

// ---------------------------------------------------------------------------
// Candidate flow: brochure → email-gate → questions → result
// ---------------------------------------------------------------------------

function CandidateFlow({
  instrument,
  leadEndpoint,
  submissionEndpoint,
  onLeadCapture,
  onSubmit,
  branding,
}) {
  const [stage, setStage] = useState('brochure'); // brochure | gate | questions | result
  const [lead, setLead] = useState(null);          // { sessionId, attemptNumber, ...fields }
  const [responses, setResponses] = useState({});
  const [cursor, setCursor] = useState(0);
  const [submitStatus, setSubmitStatus] = useState('idle'); // idle | submitting | submitted | error
  const [submitMessage, setSubmitMessage] = useState('');

  const flat = useMemo(() => flattenQuestions(instrument), [instrument]);
  const total = flat.length;

  // ---- stage transitions ----

  const beginFromBrochure = () => setStage('gate');

  const handleGateSubmit = async (fields) => {
    // POST to /api/leads (or caller-provided endpoint/function)
    try {
      let result;
      if (onLeadCapture) {
        result = await onLeadCapture({
          instrumentId: instrument.id,
          instrumentVersion: instrument.version,
          ...fields,
        });
      } else {
        const r = await fetch(leadEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instrumentId: instrument.id,
            instrumentVersion: instrument.version,
            ...fields,
          }),
        });
        result = await r.json();
      }
      if (!result?.ok || !result?.sessionId) {
        return { ok: false, message: result?.message || 'Could not start the assessment.' };
      }
      setLead({ ...fields, sessionId: result.sessionId, attemptNumber: result.attemptNumber });
      setResponses({});
      setCursor(0);
      setStage('questions');
      return { ok: true };
    } catch (e) {
      return { ok: false, message: String(e) };
    }
  };

  const handleAnswer = (qid, optionIdx) => {
    const next = { ...responses, [qid]: optionIdx };
    setResponses(next);
    setTimeout(() => {
      if (cursor + 1 < total) setCursor(cursor + 1);
      else completeAssessment(next);
    }, 180);
  };

  const goBack = () => {
    if (cursor > 0) setCursor(cursor - 1);
  };

  const completeAssessment = async (finalResponses) => {
    const axisScores = computeAxisScores(instrument, finalResponses);
    const resolution = resolveQuadrant(instrument, axisScores);
    const payload = {
      responses: finalResponses,
      axisScores,
      quadrantId: resolution.quadrant?.id,
      borderline: resolution.borderline,
      completedAt: new Date().toISOString(),
    };
    setStage('result');
    setSubmitStatus('submitting');
    try {
      let result;
      if (onSubmit) {
        result = await onSubmit(lead.sessionId, payload);
      } else {
        const url = submissionEndpoint.replace(':sessionId', lead.sessionId);
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        result = await r.json();
      }
      if (result?.ok) {
        setSubmitStatus('submitted');
        setSubmitMessage(result.message || '');
      } else {
        setSubmitStatus('error');
        setSubmitMessage(result?.message || 'Could not save your result. Please contact the shop.');
      }
    } catch (e) {
      setSubmitStatus('error');
      setSubmitMessage(String(e));
    }
  };

  // ---- compute result derived values ----

  const axisScores = useMemo(
    () => (stage === 'result' ? computeAxisScores(instrument, responses) : null),
    [stage, instrument, responses]
  );
  const resolution = useMemo(
    () => (axisScores ? resolveQuadrant(instrument, axisScores) : null),
    [axisScores, instrument]
  );

  // ---- render ----

  return (
    <div className="via-root">
      {stage === 'brochure' && (
        <BrochureIntro
          instrument={instrument}
          branding={branding}
          onBegin={beginFromBrochure}
        />
      )}

      {stage === 'gate' && (
        <EmailGate
          instrument={instrument}
          branding={branding}
          onBack={() => setStage('brochure')}
          onSubmit={handleGateSubmit}
        />
      )}

      {stage === 'questions' && flat[cursor] && (
        <QuestionScreen
          flat={flat}
          cursor={cursor}
          total={total}
          selected={responses[flat[cursor].question.id]}
          onAnswer={handleAnswer}
          onBack={goBack}
        />
      )}

      {stage === 'result' && resolution && (
        <ResultScreen
          instrument={instrument}
          axisScores={axisScores}
          resolution={resolution}
          submitStatus={submitStatus}
          submitMessage={submitMessage}
          lead={lead}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email gate
// ---------------------------------------------------------------------------

function EmailGate({ instrument, branding, onBack, onSubmit }) {
  const config = instrument.leadCapture || {};
  const [form, setForm] = useState({});
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const fields = config.fields || ['name', 'email'];
  const fieldDefs = {
    name: { label: 'Full name', type: 'text', required: true },
    email: { label: 'Email', type: 'email', required: true },
    phone: { label: 'Phone (optional)', type: 'tel', required: false },
    experienceYears: {
      label: 'Years of professional mechanic experience',
      type: 'number',
      required: false,
    },
  };

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (config.consentLine && !consent) return;
    setStatus('submitting');
    const result = await onSubmit(form);
    if (!result.ok) {
      setStatus('error');
      setMessage(result.message || 'Could not start the assessment.');
    }
  };

  return (
    <section className="via-card via-gate">
      <button className="via-link-btn" onClick={onBack}>← Back</button>
      {branding?.companyName && <div className="via-brand">{branding.companyName}</div>}
      <h1 className="via-title">{config.gateHeading || 'Tell us who you are'}</h1>
      {config.gateBlurb && <p className="via-intro-copy">{config.gateBlurb}</p>}

      <form className="via-lead-form" onSubmit={handleSubmit}>
        <div className="via-lead-fields">
          {fields.map((f) => {
            const def = fieldDefs[f];
            if (!def) return null;
            return (
              <label key={f} className="via-field">
                <span>{def.label}</span>
                <input
                  type={def.type}
                  required={def.required}
                  value={form[f] || ''}
                  onChange={(e) => update(f, e.target.value)}
                />
              </label>
            );
          })}
        </div>
        {config.consentLine && (
          <label className="via-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            <span>{config.consentLine}</span>
          </label>
        )}
        <button
          type="submit"
          className="via-btn via-btn-primary"
          disabled={status === 'submitting' || (config.consentLine && !consent)}
        >
          {status === 'submitting' ? 'Starting…' : (config.cta || 'Start the assessment')}
        </button>
        {status === 'error' && <div className="via-form-error">{message}</div>}
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Question screen
// ---------------------------------------------------------------------------

function QuestionScreen({ flat, cursor, total, selected, onAnswer, onBack }) {
  const { group, question } = flat[cursor];
  const isFirstInGroup = cursor === 0 || flat[cursor - 1].group.id !== group.id;
  const progress = ((cursor + 1) / total) * 100;

  return (
    <section className="via-card via-question-card">
      <div className="via-progress-row">
        <button className="via-link-btn" onClick={onBack} aria-label="Go back" disabled={cursor === 0}>
          ← Back
        </button>
        <div className="via-progress-text">
          Question {cursor + 1} of {total}
        </div>
      </div>
      <div className="via-progress-bar">
        <div className="via-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      {isFirstInGroup && (
        <div className="via-group-header">
          <div className="via-group-eyebrow">{group.title}</div>
          {group.description && <p className="via-group-desc">{group.description}</p>}
        </div>
      )}

      <h2 className="via-prompt">{question.prompt}</h2>

      <div className="via-options">
        {question.options.map((opt, i) => (
          <button
            key={i}
            className={`via-option ${selected === i ? 'via-option-selected' : ''}`}
            onClick={() => onAnswer(question.id, i)}
          >
            <span className="via-option-letter">{String.fromCharCode(65 + i)}</span>
            <span className="via-option-label">{opt.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Result screen
// ---------------------------------------------------------------------------

function ResultScreen({ instrument, axisScores, resolution, submitStatus, submitMessage, lead }) {
  const { quadrant, borderline, xScore, yScore } = resolution;
  const fitClass = quadrant?.fit ? `via-fit-${quadrant.fit}` : '';

  return (
    <section className="via-card via-result">
      <div className={`via-result-header ${fitClass}`}>
        <div className="via-eyebrow">
          {lead?.attemptNumber && lead.attemptNumber > 1
            ? `Your profile (attempt ${lead.attemptNumber})`
            : 'Your profile'}
        </div>
        <h1 className="via-title">{quadrant?.label || 'Result'}</h1>
        {quadrant?.headline && <p className="via-headline">{quadrant.headline}</p>}
        {borderline && (
          <div className="via-borderline-note">
            Borderline result — you scored close to the middle of one or both axes,
            so this profile is indicative rather than definitive.
          </div>
        )}
      </div>

      <div className="via-result-body">
        <div className="via-chart-wrap">
          <QuadrantChart
            instrument={instrument}
            xScore={xScore}
            yScore={yScore}
            resultQuadrantId={quadrant?.id}
          />
        </div>
        <div className="via-result-text">
          <h3>What this means</h3>
          <p>{quadrant?.description}</p>
          <div className="via-score-breakdown">
            {instrument.axes.map((axis) => {
              const score = axisScores[axis.id];
              const pct = Math.round(((score + 1) / 2) * 100);
              return (
                <div key={axis.id} className="via-score-row">
                  <div className="via-score-axis">{axis.label}</div>
                  <div className="via-score-bar">
                    <div className="via-score-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="via-score-ends">
                    <span>{axis.lowLabel}</span>
                    <span>{axis.highLabel}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {quadrant?.postResultMessage && (
        <div className={`via-post-result via-fit-${quadrant.fit}`}>
          <p>{quadrant.postResultMessage}</p>
        </div>
      )}

      {submitStatus === 'submitting' && (
        <div className="via-status-line">Saving your result…</div>
      )}
      {submitStatus === 'error' && (
        <div className="via-form-error">
          {submitMessage} (Your result is shown above — the shop will reach out if needed.)
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Admin / instrument preview
// ---------------------------------------------------------------------------

function AdminView({ instrument }) {
  return (
    <section className="via-card via-admin">
      <div className="via-eyebrow">Admin preview</div>
      <h1 className="via-title">{instrument.title}</h1>
      <p className="via-subtitle">
        Instrument <code>{instrument.id}</code> v{instrument.version} •{' '}
        {totalQuestions(instrument)} questions • {instrument.groups.length} groups
      </p>

      <h3>Axes</h3>
      <ul className="via-admin-axes">
        {instrument.axes.map((a) => (
          <li key={a.id}>
            <strong>{a.label}</strong> <code>({a.id})</code>: {a.lowLabel} ↔ {a.highLabel}
          </li>
        ))}
      </ul>

      <h3>Quadrants</h3>
      <ul className="via-admin-quads">
        {instrument.quadrants.map((q) => (
          <li key={q.id}>
            <strong>{q.label}</strong> — {q.fit.toUpperCase()} — x:{q.x}, y:{q.y}
            <div className="via-admin-desc">{q.description}</div>
          </li>
        ))}
      </ul>

      <h3>Items</h3>
      {instrument.groups.map((g) => (
        <div key={g.id} className="via-admin-group">
          <h4>{g.title}</h4>
          {g.description && <p>{g.description}</p>}
          <ol>
            {g.questions.map((q) => (
              <li key={q.id}>
                <div className="via-admin-prompt">{q.prompt}</div>
                <ul>
                  {q.options.map((o, i) => (
                    <li key={i}>
                      <code>
                        {o.axis} {o.score > 0 ? '+' : ''}
                        {o.score}
                      </code>{' '}
                      — {o.label}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
