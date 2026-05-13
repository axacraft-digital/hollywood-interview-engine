# How to edit `vintage-mechanic-v1.json`

This is the configuration file for the Hollywood Mechanic fit assessment. Every
question, both options, the scoring axis each option pulls toward, and the
four-archetype labels live in this one JSON file. Edit it and send it back —
we'll plug it in.

## Quick rules

1. **Don't change anything starting with `_`** at the top of the file
   (`_exportedAt`, `_exportedFrom`, `_note`). Those are bookkeeping fields,
   not configuration.
2. **Don't change any `id` field.** Internal identifiers like `vintage-specialist`,
   `curiosity`, `mastery`, or `c1` are referenced elsewhere in the code and stored
   submissions; renaming them would break things. Wording (`label`, `prompt`,
   `headline`, etc.) is safe to edit.
3. **Bump `version`** by one whenever you make a substantive change to question
   wording. Stored candidate responses are pinned to the version they were taken
   under, which is how we keep comparisons honest across edits.

## The two axes

The assessment plots each candidate on two axes. Each question option pulls a
candidate's score toward one end of one axis.

- **Axis X — Cognitive Style:** `-1` (Procedural, follows documented fixes) to
  `+1` (Exploratory, reasons from first principles).
- **Axis Y — Motivation Source:** `-1` (Task-driven, work is a job done well) to
  `+1` (Mastery-driven, work is who I am).

A candidate's two final scores (one per axis, each summed from their option
picks) place them in one of four corners — the four archetypes.

## The four archetypes

| Quadrant id | Position | Label (editable) | Hiring intent |
|---|---|---|---|
| `vintage-specialist` | high X, high Y | The Hollywood Mechanic | **Ideal — what we hire** |
| `master-technician`  | low X, high Y  | The Master Technician  | Secondary fit |
| `tinkerer`           | high X, low Y  | The Tinkerer           | Weak fit |
| `service-mechanic`   | low X, low Y   | The Service Mechanic   | Different role entirely |

Change the labels, headlines, and descriptions however you want. Don't change
the `id` or `x`/`y` positions.

## Editing a question

Every question lives inside `groups[*].questions[]`. A typical question looks like:

```json
{
  "id": "c1",
  "type": "forced-choice",
  "prompt": "When I encounter a problem I've never seen before, I most often:",
  "options": [
    { "label": "Research what others have tried first.", "axis": "curiosity", "score": -1 },
    { "label": "Start poking at it to see how it responds.", "axis": "curiosity", "score":  1 }
  ]
}
```

- **`prompt`** — the question text the candidate sees.
- **`options[].label`** — the two answer choices. Forced-choice means both
  options should sound positive; we're measuring preference, not virtue.
- **`options[].axis`** — which axis this option scores on (`curiosity` or
  `mastery`).
- **`options[].score`** — `-1` (pulls toward low end of the axis) or `+1`
  (pulls toward the high end). The two options on a question almost always
  score `-1` and `+1` on the same axis.

### Rules of thumb when authoring questions

- Both options should describe a real, capable craftsman. If one option sounds
  obviously worse, candidates will pick the "right" one regardless of how they
  actually work, and the screen loses signal.
- Aim for roughly even coverage of both axes — currently the 24 items are
  twelve on `curiosity` and twelve on `mastery`.
- Keep prompts short. The faster a candidate has to choose, the more
  first-instinct (and therefore accurate) the answer.

## Groups

Questions are organized into `groups` for visual sectioning during the
candidate flow. The four current groups are: how-you-approach-problems,
what-drives-you-at-work, off-the-clock, in-the-shop. You can rename group
titles/descriptions or move questions between groups. Each question's
`id` (e.g. `c1`, `m4`) does not need to match its group.

## After you're done

Send the edited file back to Kelly. The new version of the assessment will be
live within a few minutes of plug-in.
