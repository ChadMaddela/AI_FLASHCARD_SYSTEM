# Sustainability & Maintenance Plan

This document outlines how the AI-Driven Adaptive Flash Learning System is
intended to be kept running, correct, and pedagogically useful after its
initial development and validation, and how it supports the research
lifecycle described in the accompanying study (instructor usage, expert
validation, and pretest/posttest deployment for teaching Anatomy and
Physiology).

## 1. Current Architecture Snapshot

- **Backend**: Django + Django REST Framework, JWT auth (`djangorestframework-simplejwt`).
- **Database**: managed Postgres (Supabase).
- **File storage**: Supabase Storage (original uploaded materials).
- **AI generation**: Google Gemini (`google-genai`), invoked from a Celery
  background task so uploads don't block on the ~15-30s generation call.
- **Task queue**: Celery + Redis (local via Docker in development; a managed
  Redis + a Background Worker service in production).
- **Frontend**: React + Vite, deployed as a static build (Vercel).
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) runs the backend
  `pytest` suite and a frontend build on every push/PR.

Anyone picking this project up later should be able to reconstruct "how it
runs" entirely from this list plus the setup steps in `README.md`.

## 2. Technical Maintenance

| Concern | Plan |
|---|---|
| Dependency updates | Review `backend/requirements.txt` and `frontend/package.json` on a regular cadence (e.g. each academic term); prioritize security advisories for Django, DRF, and `cryptography` over cosmetic version bumps. |
| Database schema changes | All changes go through Django migrations (`core/migrations/`) — never hand-edit the schema. Take a Supabase backup/snapshot before applying migrations in production. |
| Background workers | The Celery worker is a separate long-running process from the web server — monitor that it's actually running (a "PROCESSING" material that never flips to "DONE" or "FAILED" is the visible symptom of a dead worker). |
| Error visibility | Errors are currently captured via Python's standard `logging` module (see `logger.exception(...)` calls in `core/views.py` and `core/tasks.py`). For anything beyond a single-classroom pilot, wiring these into a hosted error tracker (e.g. Sentry) is the natural next step. |
| Test suite | `pytest` (see `backend/core/tests/`) covers auth/roles, adaptive scheduling, analytics math, and confidence calibration. Any new feature should add tests in the same style before merging; CI already gates on this. |
| External service costs | Three metered dependencies to watch: Gemini API usage (billed per generation call), Supabase (DB size + storage + bandwidth), and hosting (Render/Vercel plan limits). None of these are unbounded by the app itself — cost tracking is an operational, not code, responsibility. |

## 3. Content Maintenance

Because this system's "content" is AI-generated instructional material,
content maintenance is as important as code maintenance:

- **Periodic accuracy review**: an instructor should periodically re-review
  older AI-generated flashcards, especially after materials are updated, to
  catch drift or hallucinated content (see `PRIVACY_AND_ETHICS.md` §5).
- **Correction path already exists**: the teacher flashcard management page
  supports editing or deleting any card, AI-generated or manual — no new
  tooling is required to act on a review, only the review itself.
- **Source material updates**: as Anatomy & Physiology curricula or textbook
  editions change, teachers should re-upload updated materials rather than
  hand-editing stale AI-generated cards indefinitely, so the source-of-truth
  text and the generated cards don't silently diverge.

## 4. Feeding Instructor Feedback Back Into the System

The study's second research question is specifically about *challenges
instructors face* using this system. Operationally, that feedback should
have somewhere to go:

- Track recurring instructor-reported issues (e.g. "AI mislabels sub-topics,"
  "generation is slow," "confidence buttons are unclear") as lightweight
  issues/notes alongside the codebase.
- Prioritize fixes that unblock classroom use over speculative features —
  this project's implementation history so far (registration → adaptive
  scheduling/analytics → confidence reflection) already followed a
  "smallest useful phase first" discipline; continuing that pattern keeps
  maintenance load manageable for a small-team academic project.

## 5. Roles & Responsibilities

For a project at this scale, three informal roles cover everything:

- **Maintainer/developer**: keeps dependencies current, keeps CI green, owns
  migrations and deployment.
- **Subject-matter reviewer** (an instructor): owns content accuracy —
  reviewing generated flashcards, flagging errors, deciding when source
  material needs re-upload.
- **Data steward**: whoever is accountable for the commitments in
  `PRIVACY_AND_ETHICS.md` (what's collected, how long it's kept) — on a
  small project this is likely the same person as the maintainer, but the
  responsibility is worth naming explicitly rather than leaving implicit.

## 6. Versioning & Change Management

- Git history is the source of truth for what changed and why; write commit
  messages that explain *why*, not just *what* (already this repo's
  practice).
- For a project of this size, a lightweight `CHANGELOG.md` per major feature
  phase (registration, adaptive scheduling, analytics, reflection, this
  documentation) is enough — full semantic versioning is unlikely to be
  necessary unless the system is packaged for reuse at other institutions.

## 7. Scalability Considerations

The system was deliberately kept subject-agnostic (not hardcoded to Anatomy
& Physiology) — this means the same maintenance plan applies if it's ever
extended to other subjects or institutions. If usage grows:

- Celery worker concurrency can scale horizontally (`--concurrency=N` or
  multiple worker processes) independently of the web server.
- The adaptive scheduling and analytics queries are already aggregate SQL
  (not per-row Python loops), so they scale with the database rather than
  application memory.
- Supabase and the hosting provider's plan tiers are the practical scaling
  limits to monitor, not the application code itself.

## 8. Roadmap (Ties Back to Known Gaps)

Carried over from `PRIVACY_AND_ETHICS.md` §7, framed as maintenance backlog
rather than urgent defects:

- Student data export/delete self-service flow.
- Registration-time consent capture.
- A structured content-correction/moderation queue for instructors.
- Configurable data-retention windows.
- Hosted error tracking (Sentry or equivalent) once beyond pilot scale.
- A `render.yaml` (or equivalent) to codify the Celery Background Worker +
  managed Redis deployment currently set up manually (see `README.md`).
