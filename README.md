# 🧪 MED Lab — AI Medical Education Platform (Full Stack)

پلتفرم هوشمند آموزش، ارزیابی و پژوهش دانشجویان پزشکی (دوزبانه فارسی/انگلیسی) — **MED Lab**.

A bilingual (FA/EN), fully responsive (desktop + mobile) platform for teaching,
assessing and researching medical students, built as a real full-stack application.

---

## 🚀 Deployment (HTTPS + auto-backup)

Production-ready one-command deploy with **Caddy** (automatic HTTPS) + **Docker**:

```bash
cp .env.deploy.example .env          # then edit JWT_SECRET
docker compose -f docker-compose.deploy.yml up -d --build
# → https://medschool.localhost  (or your real domain, see deploy/Caddyfile)
```

Includes automatic daily database backups into `./backups`.
**Full step-by-step Persian guide: `docs/راهنمای-استقرار.md`**

## 🧱 Tech Stack

| Layer     | Technology                                   |
|-----------|----------------------------------------------|
| Backend   | Node.js · Express · better-sqlite3 · JWT     |
| Frontend  | React 18 · Vite                              |
| Database  | SQLite (file-based, zero config)             |
| AI Engine | Real-ready (OpenAI-compatible) + mock fallback |

---

## ✨ Features (mapped to the project spec)

- **Classrooms (replaces the traditional logbook):** a teacher/admin creates a
  class, attaches cases (with per-case weights) and enrolls students. Students
  enter their class, complete the assigned cases interactively and earn a
  **weighted class grade**. Teachers get a live **gradebook** with per-student
  progress. Non-enrolled students cannot access a class (HTTP 403).
- **Responsive UI:** works on desktop and mobile, with a refined design system
  and proper fonts (Vazirmatn for Persian, Inter for English).
- **Three student modules**
  - **Virtual Patient (ASKI/OSCE):** chat with an AI patient, order tests/imaging,
    enter differential & final diagnosis, timed exam, then a checklist-based
    AI evaluation with **strengths / weaknesses / missed items / common mistakes**
    and a **personalized Microlearning lesson** built only from the student's mistakes.
  - **Flashcards:** practice decks grouped by course.
    - **Question types:** image, text, or **both** (image + text).
    - **Answer modes:** classic **multiple choice**, or a **professional search box
      (autocomplete)** where the student types and picks the matching answer from a
      filtered list — with fuzzy/bilingual matching and keyboard navigation, so
      typos never cause problems.
    - A wrong answer reveals a **progressive hint** instead of the solution.
    - A **deck picker** lets students choose a course or practice everything.
- **Admin dashboard:** users, patient bank (cases), flashcards, checklists,
  AI configuration, prompt management, exam settings, and research reports.
- **Teacher-controlled content:** the AI never invents cases; it only role-plays
  and evaluates from teacher-authored data.
- **Model-agnostic AI:** provider/model/API-key configurable from the Admin panel.
  With no key it falls back to a deterministic checklist-based engine.
- **Prompt management:** all prompts live in the DB and are editable in the panel —
  none are hard-coded.
- **Content versioning:** editing a case or flashcard archives the previous version.
- **Research export:** every interaction is stored; export to CSV.
- **Full bilingual UI** with instant RTL/LTR switching.
- **Auth & RBAC:** JWT login; student / teacher / admin roles enforced server-side.

---

## 👤 Profile & self-service password change

Every user has a **Profile** page (👤 in the top bar) showing account info and a
**change-password** form (verifies the current password). Students also see their
personal stats and a **score-trend chart**.

## 📊 Graphical dashboard

The admin **Dashboard** renders dependency-free charts (inline SVG/CSS): a
**score-trend line**, an **activity-by-type donut** (virtual patient vs. flashcards),
and a **score-distribution bar chart** — alongside the KPI cards and recent activity.

## ✅ Continuous Integration

`.github/workflows/ci.yml` runs on every push/PR: **server tests** (vitest),
**client build**, and a **Docker image build** — so regressions are caught automatically.

## 🩻 Medical image upload

Teachers/admins can attach real medical images (radiology, pathology, histology)
to **cases** (multiple, each with a bilingual label) and to **flashcards** (one image).
Uploads go to `server/uploads/` and are served from `/uploads/...`. During an exam,
students view a case's images under the **Images** tab. Only staff can upload;
files are validated (image types only, ≤ 8 MB).

## 🐳 Run with Docker (one command)

```bash
docker compose up --build      # → http://localhost:4000
```

The image builds the client, installs the server, seeds the DB on first run, and
serves everything on port 4000. The SQLite DB and uploaded images persist in a
named volume (`medlab-data`). Configure AI/JWT via environment variables (see
`docker-compose.yml`).

## 🧪 Tests

**API / integration (75 tests — vitest + supertest):**
```bash
cd server && npm test
```
Covers auth, granular RBAC, exam access control, virtual patient, evaluation,
classrooms, class grading, all flashcard types, gamified learner track (XP,
streak, hearts, leagues, SRS review, challenges), feature-flag enforcement,
impersonation guards, the super-admin panel, and account-universe separation.

**End-to-end / browser (29 tests — Playwright):**
```bash
cd client && npm run build      # the server serves the built client
cd ../e2e && npm install && npx playwright install chromium && npm test
```
Drives a real Chromium browser through the full UI for every role: student,
teacher, admin, content-manager, support, and competitive learner — including a
complete virtual-patient interview and a full gamified lesson. See `e2e/README.md`.

## 🚀 Getting Started

### 1) Backend

```bash
cd server
npm install
cp .env.example .env      # optional: set JWT_SECRET / AI_API_KEY
npm run seed              # load demo content (idempotent)
npm start                 # API on http://localhost:4000
```

### 2) Frontend (development, with hot reload)

```bash
cd client
npm install
npm run dev               # http://localhost:5173 (proxies /api to :4000)
```

### 3) Production (single server serves the built client)

```bash
cd client && npm install && npm run build   # outputs client/dist
cd ../server && npm start                    # serves API + client on :4000
```

Then open **http://localhost:4000**.

---

## 🔐 Demo Accounts (password: `demo`)

| Username / Student № | Role    | Assigned exams          |
|----------------------|---------|-------------------------|
| `teacher`            | Teacher | (all)                   |
| `admin`              | Admin   | (all)                   |
| `40012345` (Ali)     | Student | Case 1                  |
| `40067890` (Maryam)  | Student | Cases 1 & 2             |
| `40099999` (Nima)    | Student | inactive (cannot log in)|

> Students log in with their **student number** as the username.

---

## 🎓 Student enrollment & exam access control

- In **Admin → Users → + Add student**, staff create a student by **student number**
  (used as the username). If the password field is left blank, the **password
  defaults to the student number**.
- During creation (or later via **Manage access**) the admin selects exactly which
  **exams (cases)** the student may take, plus a **max-attempts** limit.
- A student **only sees and can open the exams assigned to them**. Any attempt to
  reach an unassigned case is rejected by the server (HTTP 403).
- A student with **no assignments** sees a "no exams assigned" screen.
- Inactive accounts cannot log in.

## 🤖 Supported AI providers

The engine speaks the **OpenAI-compatible** `/chat/completions` protocol, so a wide
range of providers work out of the box (base URL auto-fills on selection):

`OpenAI` · `OpenRouter` · `Groq` · `DeepSeek` · `Mistral` · `Together` ·
`Fireworks` · `Perplexity` · `xAI (Grok)` · `Anthropic` · `Google (Gemini)` ·
`Azure OpenAI` · `Ollama` (local) · `LM Studio` (local) · `Custom`.

---

## 🧠 How the AI uses your prompts & case data

- **Virtual patient:** the admin-authored *patient prompt* is combined with a
  **sanitized copy of the case chart** and the **full conversation history**, then
  sent to the model. The patient answers in character from the case data only.
- **Safety:** the case's **final diagnosis, correct answers, checklist keys and
  learning objectives are stripped** before anything reaches the patient model, so
  the answer can never leak. (The examiner still uses the full data.)
- **AI examiner:** the objective **checklist score is always computed
  deterministically** (reliable & reproducible). When an API key is set, the
  *examiner* and *microlearning* prompts additionally produce richer qualitative
  feedback and a personalized lesson. Without a key, the built-in engine is used.
- All of this is editable in **Admin → Prompt Management**; nothing is hard-coded.

## 🤖 Connecting a real AI model

The engine calls an **OpenAI-compatible** `/chat/completions` endpoint.
Set the provider, model, API key and (optionally) base URL either in
`server/.env` or in **Admin → AI Configuration → Test connection**.
If no key is present, the app transparently uses the built-in mock engine,
so the whole platform is fully demonstrable offline.

---

## 🗂️ Project Structure

```
medlab-fullstack/
├── server/
│   ├── src/
│   │   ├── index.js          # Express entry
│   │   ├── db.js             # SQLite schema (+ versioning tables)
│   │   ├── seed.js           # Bilingual demo content
│   │   ├── lib/
│   │   │   ├── ai-engine.js  # Real-ready AI + mock fallback
│   │   │   └── auth.js       # JWT + RBAC middleware
│   │   └── routes/           # auth · content · exam · reports
│   └── package.json
└── client/
    ├── src/
    │   ├── App.jsx           # Router
    │   ├── context.jsx       # Auth + language context
    │   ├── api.js            # Fetch wrapper (JWT)
    │   ├── i18n.js           # FA/EN dictionary
    │   ├── components/UI.jsx
    │   └── pages/            # Login · StudentHome · CaseList · Exam · Flashcards · Admin
    └── package.json
```

---

## 🔬 REST API (summary)

| Method | Endpoint                     | Role         |
|--------|------------------------------|--------------|
| POST   | `/api/auth/login`            | public       |
| GET    | `/api/cases`                 | any          |
| POST/PUT/DELETE | `/api/cases`        | teacher/admin|
| GET    | `/api/flashcards`            | any          |
| POST   | `/api/exam/patient-reply`    | any          |
| POST   | `/api/exam/evaluate`         | any          |
| POST   | `/api/exam/flashcard-result` | any          |
| GET    | `/api/reports/summary`       | teacher/admin|
| GET    | `/api/reports/export.csv`    | teacher/admin|
| GET/PUT| `/api/prompts`               | teacher/admin|
| GET/PUT| `/api/settings/:key`         | any / t+a    |
```
