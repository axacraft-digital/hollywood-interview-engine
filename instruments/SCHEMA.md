# Instrument JSON Schema

Instruments are JSON documents that fully define an assessment: its axes, its quadrants (typology outputs), and one or more groups of questions. The React component is a pure renderer over this schema.

## Top-level shape

```jsonc
{
  "id": "vintage-mechanic-v1",          // string, unique slug
  "version": 1,                          // integer, bump on item changes
  "title": "...",                        // shown on intro
  "subtitle": "...",                     // shown on intro
  "intro": "Markdown-ish paragraph...",  // shown on intro page
  "completionMinutes": 5,                // estimate shown to candidate
  "axes": [ Axis, Axis ],                // exactly two for quadrant mode
  "quadrants": [ Quadrant, ... ],        // typically four
  "groups": [ Group, ... ],              // ordered list of question groups
  "leadCapture": LeadCapture,            // optional; controls the capture form
  "resultCopy": { ... }                  // optional global copy overrides
}
```

## Axis

```jsonc
{
  "id": "curiosity",                     // referenced by option.axis
  "label": "Cognitive Style",
  "lowLabel": "Procedural",              // -1 end
  "highLabel": "Exploratory",            // +1 end
  "lowDescription": "Prefers established procedures...",
  "highDescription": "Pattern-matches across unfamiliar problems..."
}
```

## Quadrant

```jsonc
{
  "id": "vintage-specialist",
  "label": "The Vintage Specialist",
  "x": "high",   // "low" | "high" — position on axes[0]
  "y": "high",   // "low" | "high" — position on axes[1]
  "fit": "ideal", // "ideal" | "secondary" | "weak" | "exclude"
  "headline": "Short tagline shown on results page.",
  "description": "Paragraph describing how this person typically thinks and works."
}
```

## Group

```jsonc
{
  "id": "problem-approach",
  "title": "How you approach problems",
  "description": "Optional intro paragraph shown before this group's questions.",
  "questions": [ Question, ... ]
}
```

## Question

v1 supports `forced-choice`. The schema is intentionally extensible to add `likert-5`, `scenario`, or `slider` types later without breaking the component.

```jsonc
{
  "id": "q1",
  "type": "forced-choice",
  "prompt": "When I encounter a problem I've never seen before, I most often:",
  "options": [
    { "label": "Research what others have tried first.", "axis": "curiosity", "score": -1 },
    { "label": "Start poking at it to see how it responds.", "axis": "curiosity", "score": 1 }
  ],
  "weight": 1   // optional, default 1 — multiplies the option score on this item
}
```

## Lead capture

```jsonc
{
  "enabled": true,
  "mode": "post-result",         // "pre-result" | "post-result" | "gated"
  "fields": [ "name", "email", "phone", "experienceYears" ],
  "cta": "Send me my detailed result",
  "consentLine": "I consent to being contacted about the role."
}
```

## Scoring algorithm

For each axis:

1. Sum `option.score * question.weight` for every answered item where the option's `axis` matches.
2. Divide by the maximum possible absolute sum (`Σ |max(option.score)| * weight`) for that axis to normalize into `-1..+1`.
3. The candidate's quadrant is the one whose `x`/`y` direction matches the sign of their normalized score on each axis. (Scores within `±0.1` of zero are flagged as borderline in the result.)

The quadrant returned in the submission payload is one of the `quadrants[].id`s.
