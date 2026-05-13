/**
 * Example Node/Express endpoint for receiving assessment submissions.
 *
 * Drop this into your existing backend (or adapt for Lambda / Cloud Function).
 * The component POSTs JSON with this shape:
 *
 *   {
 *     instrumentId: "vintage-mechanic-v1",
 *     instrumentVersion: 1,
 *     completedAt: "2026-05-13T18:00:00.000Z",
 *     responses: { c1: 1, c2: 0, ... },
 *     axisScores: { curiosity: 0.83, mastery: 0.67 },
 *     quadrantId: "vintage-specialist",
 *     borderline: false,
 *     lead: { name, email, phone, experienceYears }
 *   }
 */

import express from 'express';
import crypto from 'crypto';

const router = express.Router();

router.post('/api/submit', express.json(), async (req, res) => {
  const body = req.body || {};

  // 1. Basic validation
  if (!body.lead?.email || !body.quadrantId) {
    return res.status(400).json({ ok: false, message: 'Missing required fields.' });
  }

  // 2. Persist (replace with your DB of choice — Postgres, Mongo, Airtable, etc.)
  const record = {
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    ...body,
  };
  // await db.assessmentSubmissions.insert(record);
  console.log('Assessment submission:', record);

  // 3. Trigger downstream actions based on quadrant fit
  //    - ideal fit  -> notify hiring manager immediately
  //    - secondary  -> add to nurture list
  //    - weak       -> auto-respond with a polite thanks
  //    - exclude    -> auto-respond with a polite thanks, no follow-up
  switch (body.quadrantId) {
    case 'vintage-specialist':
      // await slack.send('#hiring', `Strong applicant: ${body.lead.name} <${body.lead.email}>`);
      break;
    case 'master-technician':
      // await mailchimp.addToList('nurture-master-tech', body.lead);
      break;
    default:
      break;
  }

  return res.json({
    ok: true,
    message:
      "Thanks — we'll be in touch within a few business days. In the meantime, expect an email with your full result.",
  });
});

export default router;
