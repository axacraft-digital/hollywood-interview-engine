import React from 'react';

/**
 * BrochureIntro
 *
 * Marketing-style landing page. Renders entirely from instrument.brochure
 * and instrument.quadrants — no hardcoded copy. The goal is to widen the funnel
 * by hooking curiosity ("which one am I?") before asking for an email.
 */
export default function BrochureIntro({ instrument, onBegin, branding }) {
  const b = instrument.brochure || {};

  // Order quadrants for visual flow: weak/low → high/ideal so the reader
  // moves from "is that me?" curiosity toward the aspirational top-right.
  const visualOrder = ['service-mechanic', 'tinkerer', 'master-technician', 'vintage-specialist'];
  const quadrants = visualOrder
    .map((id) => instrument.quadrants.find((q) => q.id === id))
    .filter(Boolean);

  return (
    <section className="via-card via-brochure">
      {branding?.companyName && <div className="via-brand">{branding.companyName}</div>}
      {b.eyebrow && <div className="via-eyebrow">{b.eyebrow}</div>}

      <h1 className="via-brochure-hero">
        {b.hero || instrument.title}
      </h1>

      {b.kicker && <p className="via-brochure-kicker">{b.kicker}</p>}

      <div className="via-quadrant-cards">
        {quadrants.map((q) => (
          <article
            key={q.id}
            className={`via-quadrant-card via-fit-${q.fit}`}
          >
            <div className="via-quadrant-card-fit">
              {q.fit === 'ideal' && 'What we hire'}
              {q.fit === 'secondary' && 'Secondary fit'}
              {q.fit === 'weak' && 'Less common fit'}
              {q.fit === 'exclude' && 'Different role entirely'}
            </div>
            <h3 className="via-quadrant-card-title">{q.label}</h3>
            <p className="via-quadrant-card-headline">{q.headline}</p>
          </article>
        ))}
      </div>

      {b.shopBlurb && <p className="via-brochure-shopblurb">{b.shopBlurb}</p>}

      <div className="via-brochure-cta">
        <button className="via-btn via-btn-primary via-btn-large" onClick={onBegin}>
          {b.ctaPrimary || 'Begin the assessment'}
        </button>
        {b.ctaSecondary && <div className="via-brochure-ctasub">{b.ctaSecondary}</div>}
      </div>
    </section>
  );
}
