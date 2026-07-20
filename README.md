# JobLens — AI Powered Job Market Analyzer

> **This README is written for a complete beginner.** If you can read English and click a mouse,
> you should be able to follow every section here and explain this project to anyone — including
> a hackathon judge tomorrow. Nothing is assumed. Every technical word is explained the first time
> it shows up.

---

## Table of Contents

1. [The 30-second pitch (say this first)](#1-the-30-second-pitch-say-this-first)
2. [What problem does this solve?](#2-what-problem-does-this-solve)
3. [Glossary — words you'll hear yourself say tomorrow](#3-glossary--words-youll-hear-yourself-say-tomorrow)
4. [The tech stack — what we built it with, and why](#4-the-tech-stack--what-we-built-it-with-and-why)
5. [Big picture architecture](#5-big-picture-architecture)
6. [Folder structure — where everything lives](#6-folder-structure--where-everything-lives)
7. [Feature-by-feature walkthrough](#7-feature-by-feature-walkthrough)
   - 7.1 [Sign up / Log in (Authentication)](#71-sign-up--log-in-authentication)
   - 7.2 [Uploading a Job Dataset (Excel/CSV)](#72-uploading-a-job-dataset-excelcsv)
   - 7.3 [Dashboard (analytics)](#73-dashboard-analytics)
   - 7.4 [All Jobs (browse / search / filter)](#74-all-jobs-browse--search--filter)
   - 7.5 [Resume Analyzer (the AI part)](#75-resume-analyzer-the-ai-part)
   - 7.6 [Progressive match unlocking + daily limits (Basic vs Pro)](#76-progressive-match-unlocking--daily-limits-basic-vs-pro)
   - 7.7 [History (Resume History + Job Dataset History)](#77-history-resume-history--job-dataset-history)
   - 7.8 [Billing / Subscriptions (Stripe)](#78-billing--subscriptions-stripe)
   - 7.9 [Multi-tenant data isolation (the most important design decision)](#79-multi-tenant-data-isolation-the-most-important-design-decision)
8. [The database — what data looks like under the hood](#8-the-database--what-data-looks-like-under-the-hood)
9. [How a request flows through the whole system (step by step)](#9-how-a-request-flows-through-the-whole-system-step-by-step)
10. [Security — how we keep it safe](#10-security--how-we-keep-it-safe)
11. [Known limitations (be honest about these if asked)](#11-known-limitations-be-honest-about-these-if-asked)
12. [Changelog — bugs we found and fixed](#12-changelog--bugs-we-found-and-fixed)
13. [Anticipated judge questions + ready-made answers](#13-anticipated-judge-questions--ready-made-answers)
14. [How to run this project locally, from zero](#14-how-to-run-this-project-locally-from-zero)
15. [Deployment (going live)](#15-deployment-going-live)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. The 30-second pitch (say this first)

> "JobLens is a website where a company or job-seeker can upload their own list of job openings
> (an Excel or CSV file), instantly get a dashboard of analytics about that job market (top
> skills, top companies, salary trends), and — using Google's Gemini AI — upload a resume to get
> an ATS (Applicant Tracking System) compatibility score plus a ranked list of the best-matching
> jobs from that dataset, along with AI-written tips to improve the resume. Every user's data is
> completely private to their own account, there's a free 'Basic' plan and a paid 'Pro' plan
> handled through Stripe, and a public demo dataset lets visitors try the dashboard/jobs pages
> before signing up."

That's it. Everything below is just "how" we built that.

---

## 2. What problem does this solve?

- **Recruiters / companies** have a spreadsheet of job openings and no easy way to see patterns in
  it (which skills are most in demand, what's the average salary, which locations hire the most).
- **Job seekers** have a resume and don't know how well it matches a specific batch of job
  postings, or what an ATS (the automated software companies use to filter resumes before a human
  ever reads them) actually "sees" when it scans their resume.

JobLens solves both at once: upload the job data once, and it powers both the analytics dashboard
**and** the resume matching — because they use the exact same underlying job records.

---

## 3. Glossary — words you'll hear yourself say tomorrow

Read this once. You will use these words constantly when explaining the project.

| Word | What it actually means |
|---|---|
| **Frontend** | The part that runs in the user's browser — everything they see and click. Built with **React**. |
| **Backend** | The part that runs on a server, invisible to the user. It receives requests, talks to the database, calls the AI, and sends back answers. Built with **Node.js + Express**. |
| **Database** | Where all the data (users, jobs, resumes) is permanently stored. We use **MongoDB** (a "NoSQL" database — stores flexible JSON-like documents instead of rigid spreadsheet-style tables). |
| **MERN stack** | The combo we used: **M**ongoDB + **E**xpress + **R**eact + **N**ode.js. The most common stack for JavaScript-only full-stack apps (one language, front and back). |
| **API** | "Application Programming Interface." Just means: a set of URLs the frontend can call to ask the backend to do something (e.g. `POST /api/auth/login`). Think of it as a menu of actions the backend offers. |
| **REST API** | A style of API where every action maps to a URL + an HTTP verb (`GET` = read, `POST` = create, `DELETE` = remove, etc). Ours follows this style. |
| **Schema / Model** | A blueprint describing what fields a piece of data has (e.g. a "User" always has a name, email, password). Defined with **Mongoose** (a library that sits on top of MongoDB and enforces these blueprints). |
| **JWT (JSON Web Token)** | A signed, tamper-proof string that proves "this browser is logged in as user X" without the server needing to remember every login in memory. We store it in an httpOnly cookie (see below). |
| **Cookie** | A small piece of data the browser automatically stores and sends back with every request to the same website. We use one to hold the login token. |
| **httpOnly cookie** | A cookie that JavaScript running in the browser **cannot read** — only the browser itself can send it back to the server. This stops malicious scripts from stealing your login token. |
| **Middleware** | A function that runs *before* your actual route logic, e.g. "check if this person is logged in" runs before "let them see /account". |
| **bcrypt** | A one-way scrambling algorithm for passwords. We never store an actual password — only its scrambled ("hashed") version, so even if the database leaks, passwords can't be un-scrambled. |
| **CORS** | A browser security rule that blocks a webpage from calling an API on a different domain unless that API explicitly allows it. We configure the backend to allow our specific frontend domain. |
| **Multer** | A Node.js library that lets the backend receive uploaded files (Excel sheets, PDF/DOCX resumes) from a web form. |
| **Gemini API** | Google's AI model (like ChatGPT, but Google's version). We send it resume text + job listings and ask it to score/match them and write feedback, and it replies with structured JSON. |
| **ATS** | Applicant Tracking System — the software companies use to auto-scan resumes before a human sees them. Poor formatting (tables, columns, missing keywords) can get a resume auto-rejected. Our "ATS Score" simulates how well a resume would survive that scan. |
| **Stripe** | A third-party payment company. We never touch anyone's actual credit card — Stripe's hosted checkout page does, and it tells our backend "this user paid" via a secure webhook. |
| **Webhook** | A URL that another service (Stripe) calls automatically when something happens on their end (e.g. "payment succeeded") — the reverse of us calling them. |
| **Multi-tenant** | Multiple separate users/customers ("tenants") share one app and one database, but each only ever sees their own data. This is the core design principle of the whole backend. |
| **Vite** | A fast build tool for the React frontend — turns our source code into the optimized files a browser actually loads. |
| **Axios** | A small library for making API calls from the frontend to the backend (a nicer version of the browser's built-in `fetch`). |
| **Context (React Context)** | A way to share data (like "is the user logged in?" or "what's the current resume analysis result?") across many components without manually passing it down through every single one. |
| **bfcache (back/forward cache)** | A browser feature that, when you hit Back/Forward, can instantly restore a page exactly as it was in memory — instead of reloading it from scratch. Fast for the user, but it means any in-memory app state (like "who's logged in?") can go stale if you don't explicitly re-check it. See section 12. |

---

## 4. The tech stack — what we built it with, and why

### Frontend (what runs in the browser)
| Tool | Why we used it |
|---|---|
| **React** (with **Vite**) | Lets us build the UI out of reusable "components" (Navbar, JobCard, Modal, etc.) instead of one giant HTML file. Vite makes development fast (instant reload on save). |
| **React Router** | Lets the app have multiple "pages" (`/dashboard`, `/jobs`, `/account`...) without actually reloading the browser — it just swaps the visible component. |
| **Tailwind CSS** | A CSS framework where you style things with short utility classes (`p-4`, `rounded-xl`, `bg-cream`) directly in the markup instead of writing separate CSS files. Much faster for a hackathon. |
| **Axios** | Makes the actual HTTP calls to our backend API. |
| **Recharts** | Draws the charts on the Dashboard page (bar charts, line charts, pie charts). |
| **Framer Motion** | Adds the small animations (fade-ins, slide-ins) you see throughout the UI. |
| **lucide-react** | Provides all the small icons (trash can, upload cloud, lock, etc). |

### Backend (what runs on the server)
| Tool | Why we used it |
|---|---|
| **Node.js** | Lets us run JavaScript on the server, not just in the browser — so frontend and backend can share one language. |
| **Express** | A minimal framework for defining API routes (`app.get("/api/jobs", ...)`) and middleware, on top of Node. |
| **MongoDB Atlas** | The actual database, hosted for free in the cloud (no need to install/manage a database server ourselves). |
| **Mongoose** | Defines our data "schemas" (User, Job, JobDataset, ResumeUpload) and gives us easy query methods (`.find()`, `.create()`, etc). |
| **Multer** | Handles file uploads (job spreadsheets, resumes) coming in from HTML forms. |
| **xlsx** | Reads and parses Excel/CSV files into plain JavaScript arrays we can validate and save. |
| **pdf-parse / mammoth** | Extract raw text out of uploaded PDF (`pdf-parse`) or DOCX (`mammoth`) resume files, since the AI needs plain text, not a binary file. |
| **jsonwebtoken (JWT)** | Creates and verifies the signed login tokens. |
| **bcryptjs** | Hashes (scrambles) passwords before they're ever saved to the database. |
| **cookie-parser** | Lets Express read cookies sent by the browser. |
| **cors** | Controls which frontend domains are allowed to call this API. |
| **@google/generative-ai (Gemini SDK)** | The official library for calling Google's Gemini AI models from our backend. |
| **stripe** | The official library for creating checkout sessions, billing portal links, and verifying webhook events from Stripe. |
| **dotenv** | Loads secret configuration (API keys, database URL) from a local `.env` file instead of hardcoding them in the source code. |

---

## 5. Big picture architecture

```
+-----------------------------+
|         BROWSER              |
|  React app (Vite)            |
|  - Pages: Upload, Dashboard, |
|    All Jobs, Resume Analyzer,|
|    Login, Signup, Account    |
+--------------+---------------+
               |  every action = an HTTP call via axios
               |  e.g. POST /api/resume, GET /api/dashboard
               v
+---------------------------------------------------------------+
|                     EXPRESS BACKEND (Node.js)                  |
|                                                                 |
|  middleware/auth.js  ->  reads the login cookie on every       |
|                          request, figures out "who is this?"   |
|                                                                 |
|  routes/*.js  ->  controllers/*.js  ->  models/*.js (Mongoose) |
|  (URL map)        (business logic)      (data blueprints)      |
|                                                                 |
|  +---------------+   +------------------+   +-------------+   |
|  | Auth          |   | Upload / Jobs /  |   | Resume      |   |
|  | (signup/login)|   | Dashboard        |   | Analyzer    |   |
|  +-------+-------+   +--------+---------+   +------+------+   |
|          |                    |                     |          |
|          |                    |                     v          |
|          |                    |            Gemini AI API       |
|          |                    |            (Google, external)  |
|          |                    |                     |          |
|  +-------v--------------------v---------------------v------+  |
|  |                  MongoDB Atlas (cloud database)          |  |
|  |   Users . Jobs . JobDatasets . ResumeUploads              |  |
|  +------------------------------------------------------------+ |
|                                                                 |
|  Billing routes  --------------->  Stripe API (external)       |
|  (checkout / portal / webhook)     (payments)                  |
+-----------------------------------------------------------------+
```

**In plain words:** the browser never talks to the database or to Gemini/Stripe directly. It only
ever talks to *our* backend, and the backend is the only thing that talks to MongoDB, Gemini, and
Stripe. This is standard, safe web-app architecture — API keys and database passwords only ever
live on the server, never in the browser where anyone could steal them from the page source.

---

## 6. Folder structure — where everything lives

```
Job-Analyzer/
├── backend/
│   ├── server.js               ← the entry point; wires everything together
│   ├── config/db.js            ← connects to MongoDB Atlas
│   ├── models/                 ← Mongoose schemas (the "shape" of our data)
│   │   ├── User.js
│   │   ├── Job.js
│   │   ├── JobDataset.js
│   │   └── ResumeUpload.js
│   ├── routes/                 ← URL → controller function mapping
│   │   ├── authRoutes.js
│   │   ├── uploadRoutes.js
│   │   ├── jobRoutes.js
│   │   ├── dashboardRoutes.js
│   │   ├── resumeRoutes.js
│   │   ├── historyRoutes.js
│   │   └── billingRoutes.js
│   ├── controllers/            ← the actual logic for each route
│   │   ├── authController.js
│   │   ├── uploadController.js
│   │   ├── jobController.js
│   │   ├── dashboardController.js
│   │   ├── resumeController.js
│   │   ├── historyController.js
│   │   └── billingController.js
│   ├── middleware/
│   │   ├── auth.js             ← "is this user logged in?" checks
│   │   └── upload.js           ← multer file-upload config
│   ├── utils/
│   │   ├── token.js            ← JWT create/verify + cookie settings
│   │   ├── parseExcel.js       ← reads/validates/dedupes job spreadsheets
│   │   ├── parseResume.js      ← extracts text from PDF/DOCX resumes
│   │   ├── aiService.js        ← talks to Gemini AI, has a local fallback
│   │   └── matchPlan.js        ← Basic vs Pro match-count rules
│   ├── scripts/                ← one-off maintenance scripts (not run automatically)
│   └── uploads/                ← uploaded files are temporarily/permanently stored here
│
├── frontend/
│   └── src/
│       ├── main.jsx            ← React app entry point
│       ├── App.jsx             ← defines all the page routes
│       ├── pages/              ← one file per page (UploadPage, Dashboard, AllJobs, ...)
│       ├── components/         ← reusable pieces (Navbar, JobCard, Modal, FilterPanel, ...)
│       ├── context/            ← app-wide shared state (AuthContext, ResumeAnalysisContext)
│       └── api/axios.js        ← the configured axios instance every page uses to call the API
│
└── sample-data/
    └── sample-jobs.csv         ← the public demo dataset shown to guests
```

**Rule of thumb for navigating the backend:** a request always flows
`routes → controllers → models`. Routes just say *which* function handles a URL. Controllers
contain the actual logic. Models define what gets saved to the database.

---

## 7. Feature-by-feature walkthrough

### 7.1 Sign up / Log in (Authentication)

- User fills the Signup form (name, email, password) → frontend calls `POST /api/auth/signup`.
- Backend (`authController.js`):
  1. Validates the input (valid email format, password ≥ 6 characters).
  2. Checks no account already has that email.
  3. Hashes the password with **bcrypt** (so the raw password is never stored).
  4. Saves the new `User` document in MongoDB.
  5. Signs a **JWT** containing the user's id, and sends it back as an **httpOnly cookie**.
- From then on, every request the browser makes automatically includes that cookie. The
  `middleware/auth.js` file reads it on protected routes, verifies the signature, looks up the
  user in the database, and attaches it to `req.user` so the rest of the code knows who's asking.
- **Login** does the same thing but compares the submitted password against the stored hash with
  `bcrypt.compare()` instead of creating a new account.
- **Logout** just clears the cookie.
- Why a cookie and not just storing the token in the browser's `localStorage`? Because an
  **httpOnly** cookie can't be read by JavaScript at all — even if a malicious script somehow ran
  on our page, it couldn't steal the login token. `localStorage` can be read by any script.
- **Session freshness (`AuthContext.jsx`)**: on first load the app checks `GET /api/auth/me` once
  to find out who's logged in. It also now re-checks that same endpoint whenever the browser
  restores this tab from **bfcache** (e.g. after clicking Back from Stripe's checkout/billing
  pages) — see [section 12](#12-changelog--bugs-we-found-and-fixed) for why that matters. The
  `/api/auth/*` routes also send `Cache-Control: no-store` so a browser or proxy never caches a
  stale "who am I" answer.

### 7.2 Uploading a Job Dataset (Excel/CSV)

- On the Upload page, the user drags in a `.csv`/`.xlsx` file of job postings.
- Frontend sends it via `POST /api/upload-excel` as `multipart/form-data` (the standard way
  browsers send files).
- Backend (`uploadController.js` + `utils/parseExcel.js`):
  1. **Multer** saves the file to disk temporarily.
  2. We compute a SHA-256 hash of the file's bytes — a unique fingerprint — so re-uploading the
     exact same file is recognized instantly instead of re-processing it.
  3. `xlsx` parses the spreadsheet into rows.
  4. Each row's column headers are matched against known field names (e.g. "Job Title", "Role",
     "Position" all map to `jobTitle`) — flexible so the user doesn't need an exact template.
  5. Salaries get normalized (handles `"5-8 LPA"`, `"50k-80k"`, `"/month"`, plain numbers — all
     converted to a consistent annual-rupee range).
  6. Rows are de-duplicated (matched on job title + company + location) both within the file and
     against what's already in the database for that user.
  7. Every valid row is saved as a `Job` document, tagged with `owner: <that user's id>`.
  8. A `JobDataset` record is also created — a summary receipt of "this user uploaded this file,
     here are the stats" — used later by the History page.
- If the columns can't be matched to at least Job Title + Company, the upload is rejected with a
  clear error instead of silently saving garbage data.

### 7.3 Dashboard (analytics)

- Pure read-only page. Calls `GET /api/dashboard`.
- The backend runs several **MongoDB aggregation pipelines** (a way to ask the database to
  group/count/average data directly, instead of pulling everything into JavaScript and computing
  it manually — much faster) scoped to *only this user's jobs* (or the public sample dataset for
  guests):
  - Total jobs, total companies, total unique locations.
  - Average salary.
  - Top 10 skills (case-insensitive, so "Python" and "python" count as one).
  - Top hiring companies.
  - Top paying companies (companies with ≥2 salaried postings, ranked by average salary).
  - Jobs by experience level, by industry, by job type.
  - A weekly posting-trend line (how many jobs were posted each week).
  - Top locations (splits multi-city cells like `"Hyderabad, Bengaluru"` into separate counts).
- The frontend just renders these numbers into cards and Recharts charts.

### 7.4 All Jobs (browse / search / filter)

- Lists every job the user (or guest) has access to, with:
  - Free-text search (title/company/skills).
  - Filters: category (job type), location, skill, minimum salary, etc.
  - Sorting and pagination (so 1,000+ jobs don't all render/load at once).
- Clicking a job opens a `Modal` with the full description, requirements, and an "Apply Now" link.

### 7.5 Resume Analyzer (the AI part)

This is the flagship feature. Step by step, when a signed-in user uploads a resume:

1. **Guardrail**: they must already have their own job dataset uploaded — otherwise there's
   nothing to match against, and we show a clear "please upload your job data first" message.
2. `pdf-parse` (for `.pdf`) or `mammoth` (for `.docx`) extracts the raw text out of the resume.
3. **Local pre-filter (`localShortlist`)**: before ever calling the AI, we do a cheap keyword-overlap
   scan ourselves to figure out which of the user's jobs are even remotely relevant, and shortlist
   the top ~40 (up to 300 for big unlock requests). We also detect the resume's "dominant tech
   stack" (e.g. MERN vs Python vs Java) from keyword signatures, so a Python resume doesn't get
   falsely boosted against unrelated Java roles just because both mention "SQL". This keeps the
   AI prompt small, fast, and focused — sending all 1,000+ jobs to the AI every time would be slow
   and expensive.
4. **One Gemini API call** analyzes the shortlisted jobs against the resume text and returns
   structured JSON: for each job, an ATS score, a match percentage, matched skills, and missing
   skills — plus one overall entry with the resume's overall ATS score and 8-10 specific, actionable
   improvement suggestions.
   - The prompt explicitly tells Gemini to write **plain text only** (no markdown asterisks) and
     to never split one sentence across multiple array entries, and a `cleanSuggestedImprovements()`
     safety-net in `aiService.js` repairs the array (strips stray markdown, rejoins fragments into
     full sentences) even if the model ignores that instruction — see section 12.
5. Results are saved as a `ResumeUpload` document and returned to the frontend, which renders:
   - A big ATS score badge.
   - The "Suggested Improvements" list (Pro-only — see below).
   - A sortable/filterable/searchable list of the matched jobs, each with a color-coded score,
     matched/missing skill chips, and "View Details"/"Apply Now" buttons.
6. **If Gemini fails or no API key is configured**, a local keyword-based fallback scorer kicks in
   automatically so the demo never fully breaks — it just gives a simpler, less accurate result.
   Gemini calls are also tried across a short list of current model names
   (`gemini-2.5-flash` → `gemini-flash-latest`) so a single retired/renamed or quota-exhausted
   model name doesn't take the whole feature down.

### 7.6 Progressive match unlocking + daily limits (Basic vs Pro)

Instead of dumping every match at once, matches unlock progressively:

- **Basic plan**: starts by revealing the top 5 matches. A dropdown lets you unlock more in steps
  of 5, up to a **shared daily budget of 20 total matches across every resume you analyze that
  day** (not per-resume — uploading a second resume the same day only gives you whatever's left of
  that day's 20, not a fresh 20). This budget resets automatically at midnight.
- **Pro plan**: no daily cap — every resume gets a dropdown that jumps straight to 20/40/60/80/100
  total matches, and also unlocks the AI-written "Suggested Improvements" text (Basic users see a
  locked/blurred version with an "Upgrade to Pro" prompt).
- This is tracked with two fields on the `User` document: `dailyMatchDate` (today's date) and
  `dailyMatchCount` (how much of today's 20 has been used) — see `utils/matchPlan.js` and
  `User.js` for the exact rules.
- **Upgrading mid-session**: `overallAtsScore` and `suggestedImprovements` are generated once, at
  the initial analysis, and intentionally never regenerated just from clicking "unlock more
  matches" (re-running the AI every click would make the same resume show *different* advice each
  time). This means if you upgrade to Pro *after* already analyzing a resume, the improvement text
  Gemini already wrote for you is still sitting in the database — it just needed the app to
  re-check your plan and un-hide it, which it now does automatically (section 12).

### 7.7 History (Resume History + Job Dataset History)

- **Resume History**: every past resume analysis is listed with its ATS score, match count, and
  date. Clicking "View" reloads that exact saved result instantly (no re-analysis, no new AI
  call) — and re-shapes it against your **current** plan every time (`GET /api/history/:id`), so
  it correctly unlocks Pro content even for a resume you analyzed back when you were on Basic.
  "Download" re-downloads the original uploaded file. A delete button removes that analysis
  entirely (and best-effort deletes the stored file from disk).
- **Job Dataset History**: every past Excel/CSV upload is listed. "Use this dataset" re-activates
  an older upload (re-points your active `Job` rows at it) without re-uploading the file. A delete
  button removes that dataset **and** any `Job` rows that came from it (so deleting your active
  dataset cleanly leaves you with zero active jobs, exactly like a brand-new account, instead of
  orphaned data pointing at nothing).

### 7.8 Billing / Subscriptions (Stripe)

- The Account page has an "Upgrade to Pro" button. Clicking it calls
  `POST /api/billing/create-checkout-session`, which:
  1. Creates a Stripe **Customer** for this user (once, then reuses it).
  2. Creates a Stripe **Checkout Session** (a hosted, Stripe-built payment page — we never see or
     touch the actual card number) for a monthly subscription.
  3. Returns the checkout URL; the browser redirects there.
- After payment, Stripe redirects back to `/account?checkout=success&session_id=...`. The frontend
  immediately calls `POST /api/billing/sync-checkout-session` with that id, which verifies the
  session belongs to this user and updates their `subscriptionStatus` to `active` right away — so
  Pro activates instantly instead of waiting on a webhook.
- **Stripe webhooks** (`POST /api/billing/webhook`) are the long-term source of truth: Stripe calls
  this URL automatically whenever a subscription renews, fails payment, or gets canceled, keeping
  `subscriptionStatus` accurate over time without the user needing to be on the page.
- A user is considered "Pro" (`user.isPro()`) whenever their `subscriptionStatus` is `active` or
  `trialing`.
- "Manage Billing" opens Stripe's **hosted billing portal** (another Stripe-built page) where a Pro
  user can update their card or cancel — we don't build any of that UI ourselves. Because this
  sends the browser fully away from our app and back, we specifically hardened this round trip
  against two bugs — a stale account showing up on Back, and Pro features staying "locked" after
  upgrading — both explained in section 12.

### 7.9 Multi-tenant data isolation (the most important design decision)

Every piece of user-uploaded data — `Job`, `JobDataset`, `ResumeUpload` — has an `owner` field
(the uploading user's id). Every single query in every controller filters by
`{ owner: req.user._id }`. This means:

- User A can never see, analyze against, or accidentally delete User B's jobs or resumes.
- Guests (not logged in) only ever see a separate public sample dataset (`isSample: true`,
  `owner: null`) seeded once from `sample-data/sample-jobs.csv` — so they can try the Dashboard and
  All Jobs pages before signing up, without ever touching real user data.
- Resume analysis is **only** available to signed-in users (guests are redirected to Login),
  because it needs the user's own private job dataset to match against.

---

## 8. The database — what data looks like under the hood

MongoDB stores flexible JSON-like "documents" grouped into "collections" (roughly = tables). Here
are our four collections, in plain English:

**`User`**
```
name, email, passwordHash (never the real password),
stripeCustomerId, stripeSubscriptionId, subscriptionStatus, currentPeriodEnd,
dailyMatchDate, dailyMatchCount   (today's Basic-plan match usage)
```

**`Job`** (one row per job posting)
```
jobTitle, company, location, salary, salaryMin, salaryMax, experience,
skills[], description, employmentType, industry, education, jobType,
applyLink, postedDate, source, remote,
owner (which user this belongs to — null if it's public sample data),
isSample (true only for the public demo dataset),
dataset (which JobDataset upload this row came from)
```

**`JobDataset`** (one row per Excel/CSV file a user has uploaded — a "receipt")
```
owner, fileName, storedFileName, fileHash, stats {total, inserted, duplicates, errors},
isActive
```

**`ResumeUpload`** (one row per resume analysis)
```
fileName, extractedText, overallAtsScore, suggestedImprovements[],
recommendedJobs[] (each with atsScore, matchPercent, matchedSkills, missingSkills),
matchesUnlocked, user, storedFileName, originalFileName
```

Note: `suggestedImprovements` is always saved in full, regardless of plan — it's only ever
*hidden* in the API response for Basic users (see `shapeForPlan()` in `resumeController.js`). This
is exactly what makes the "Pro unlocks it instantly, no new AI call" behavior in section 7.6/7.7
possible.

---

## 9. How a request flows through the whole system (step by step)

Example: **a logged-in user uploads a resume.**

1. Browser: user drops a PDF onto the dropzone. React's `analyzeResume()` function (in
   `ResumeAnalysisContext.jsx`) builds a `FormData` object and calls
   `api.post("/resume", formData)` (Axios).
2. The request travels over HTTPS to the Express backend, cookie included automatically.
3. Express matches the URL to `resumeRoutes.js`, which runs `protect` middleware first — this
   reads the cookie, verifies the JWT, loads the `User` from MongoDB, and attaches it as
   `req.user`. If there's no valid cookie, the request is rejected with 401 before it ever reaches
   the actual logic.
4. `resumeController.analyzeResume` runs:
   - Confirms the user has their own job data (`Job.exists({ owner: req.user._id })`).
   - `parseResume.js` extracts text from the uploaded PDF/DOCX.
   - `matchPlan.js` figures out how many matches this user is allowed to see right now (Basic
     daily budget vs Pro).
   - `aiService.js` shortlists relevant jobs locally, then calls the Gemini API once.
   - The AI's JSON reply is parsed, sanitized (`cleanSuggestedImprovements`), and mapped onto our
     own job records.
   - Everything is saved as a new `ResumeUpload` document in MongoDB.
   - The day's match-usage counter on `User` is updated (Basic plan only).
5. Express sends the result back as JSON.
6. The React context stores it in state (and in `sessionStorage`, tagged with the user's id, so a
   page refresh doesn't lose it — but a *different* user logging in on the same tab never sees it,
   and an upgrade to Pro mid-session triggers an automatic re-fetch instead of showing the stale
   cached snapshot — section 12).
7. The `ResumeAnalyzer` page renders the ATS score, suggestions, and job list from that state.

---

## 10. Security — how we keep it safe

- **Passwords** are never stored in plain text — only a bcrypt hash.
- **Login tokens (JWTs)** live in an httpOnly cookie, invisible to JavaScript, reducing theft risk
  from malicious scripts (XSS).
- **CORS** is locked down to only allow our known frontend origins (localhost during development,
  our deployed Vercel domain in production) — a random website can't call our API from a victim's
  browser using their cookie.
- **Every data query is scoped by `owner`** — there is no endpoint that returns another user's
  private jobs, resumes, or datasets.
- **Stripe webhook signatures are verified** (`stripe.webhooks.constructEvent`) using a secret key,
  so nobody can fake a "payment succeeded" event by just POSTing to our webhook URL.
- **Checkout session ownership is double-checked** — when confirming a payment, we verify the
  Stripe session's `metadata.userId` matches the currently logged-in user before touching anyone's
  subscription status.
- **Auth responses are never cached** (`Cache-Control: no-store` on `/api/auth/*`) so a browser or
  intermediary proxy can't serve a stale "who am I" answer after a login/logout.
- Uploaded files are validated (file type, and that the spreadsheet's columns look like actual job
  data) before being processed, so a garbage/malicious file gets rejected instead of crashing
  anything.

---

## 11. Known limitations (be honest about these if asked)

- **Gemini API free tier**: the Google AI key currently used is on the free tier, which caps
  requests **per model, per day** (e.g. 20/day for `gemini-2.5-flash`). Once that's used up, the
  code automatically tries the next model name in the fallback list
  (`gemini-2.5-flash` → `gemini-flash-latest`), and ultimately falls back to a local
  keyword-matching scorer if all of them are exhausted — so the app never crashes, but the AI
  quality temporarily degrades. **This is the single biggest thing to fix before a real/live
  deployment**: enable billing on the Google AI Studio project so the app isn't limited to 20
  total AI-scored resumes per day across every visitor.
- **No real-time collaboration** — this isn't built for two people editing the same dataset live.
- **File storage is local disk** (`backend/uploads/`), not cloud storage (like S3) — fine for a
  hackathon/demo, but would need migrating to something like AWS S3 for a real production
  deployment with multiple servers.
- **No password reset flow yet** — if a user forgets their password, there's currently no
  "forgot password" email flow.
- **Bundle size warning**: the frontend build is a single large JavaScript bundle; for a bigger
  production app you'd want to code-split it (load pages on demand) rather than all at once.
- **MongoDB Atlas uses DNS-based connection strings (`mongodb+srv://`)**, so a machine with a
  flaky or just-woken-up network connection (e.g. right after a laptop resumes from sleep) can
  briefly fail to resolve the database host and show connection errors in the terminal until the
  network fully reconnects. Not an app bug — just something to be aware of when demoing on Wi-Fi.

---

## 12. Changelog — bugs we found and fixed

While polishing this project for the hackathon, we found and fixed a batch of real, subtle bugs.
Explaining these well is a great way to show a judge you understand your own system, not just that
you can build a demo — for each one: what it looked like, why it was actually happening, and what
the fix was.

### 12.1 Wrong account showing after returning from Stripe (bfcache)
- **What it looked like:** log out of Account A, log in as Account B, open Stripe's Billing
  Portal, click the browser's Back button → the app would sometimes show Account A again, even
  though B was really still logged in.
- **Root cause:** `AuthContext` only checked "who's logged in" once, when the app first loaded.
  Going to Stripe and clicking Back doesn't reload the page — the browser restores it instantly
  from **bfcache**, an in-memory snapshot of exactly how the page looked the moment you left it.
  If that snapshot was stale, the UI showed stale data even though the actual login cookie was
  correct the whole time.
- **Fix:** `AuthContext` now listens for the browser's `pageshow` event and re-checks
  `GET /api/auth/me` with the server whenever `event.persisted` is true (i.e. "this page just came
  from bfcache"). Also added `Cache-Control: no-store` to every `/api/auth/*` response as a second
  layer of protection.

### 12.2 Browser Back button feeling like it goes "forever"
- **What it looked like:** clicking Back repeatedly seemed to endlessly cycle through old pages,
  landing all the way back on the very first Upload page.
- **Root cause:** this part is actually normal browser behavior — every page you visit in a
  React Router app becomes its own browser history entry, same as any multi-page website. It only
  *felt* broken because some of those history stops were showing the wrong account (bug 12.1).
- **Fix:** none needed on its own — fixing 12.1 made the whole Back-button experience feel normal
  again, since every stop now shows the correct, live account.

### 12.3 "Suggested Improvements" showing broken half-sentences
- **What it looked like:** instead of clean bullet points, the Pro "Suggested Improvements" list
  showed fragments like *"Quantify the impact of the"* / *"Customer Churn Prediction"* / *"project
  by stating the business value..."* as three separate, nonsensical bullets.
- **Root cause:** Gemini sometimes wraps an important term in markdown emphasis
  (`*Customer Churn Prediction*`) out of habit, and occasionally splits that emphasized term into
  its own array entry — turning one sentence into two or three broken pieces before it ever
  reaches the frontend (which just renders whatever's in the array, one bullet per entry).
- **Fix:** two layers, in `backend/utils/aiService.js`. First, the prompt now explicitly says
  "plain text only, no markdown, never split one sentence across array entries." Second, a new
  `cleanSuggestedImprovements()` function repairs the array regardless of what the model actually
  returns — it strips stray markdown characters, glues every fragment back into one block of text,
  then re-splits it only on real sentence boundaries.

### 12.4 Resume Analyzer still "locked" right after upgrading to Pro
- **What it looked like:** the Account page correctly showed "Pro Plan," but the Resume Analyzer
  page still showed the old "20 of 20 daily matches used" banner and a locked "Upgrade to Pro"
  prompt over Suggested Improvements — as if nothing had changed.
- **Root cause:** the last resume result is cached in the browser (`sessionStorage`) purely so
  switching tabs and coming back doesn't lose your results. That cache was never rechecked against
  the user's *current* plan — so it kept showing the exact Basic-tier snapshot from before the
  upgrade, frozen in memory.
- **Fix:** `ResumeAnalysisContext.jsx` now watches for the user's Pro status changing and, when it
  does, silently re-fetches the same analysis from `GET /api/history/:id` — an endpoint that
  already recomputes everything fresh from the current plan. No re-upload, no new AI call: the
  improvement suggestions were already generated and saved, just hidden.

### 12.5 Gemini `429 Quota exceeded` errors during testing
- **What it looked like:** resume analysis started failing with `429 Too Many Requests` /
  `quota exceeded` errors in the backend terminal.
- **Root cause:** the free-tier Gemini API key allows only **20 requests per day, per model, total
  across every user** — not 20 per person. It gets exhausted fast during active testing/demoing.
- **Fix (code):** the model fallback list used to include `gemini-2.5-flash-lite` as a middle
  option, but Google retired that model for new API keys (`404 ... no longer available to new
  users`), so every fallback attempt was burning a full guaranteed-dead retry cycle before ever
  reaching `gemini-flash-latest`, the one that actually works. Removed the dead model from the
  list.
- **Action still needed before real deployment:** enable billing on the Google AI Studio project.
  Code-side fallbacks can't fix a hard 20/day ceiling — that's an account-level setting.

### 12.6 Mongoose `VersionError` on "Unlock more matches"
- **What it looked like:** `VersionError: No matching document found for id ... version 1` in the
  backend terminal when clicking "unlock more matches."
- **Root cause:** the old code loaded a `ResumeUpload` document, mutated it in memory, then called
  `.save()` — Mongoose's optimistic-concurrency check throws this error if anything else touches
  the same document between the load and the save (e.g. a double-fired click).
- **Fix:** switched to an atomic `findOneAndUpdate()` in `resumeController.requestMoreMatches`,
  which applies the change directly in the database in one step and sidesteps this failure mode
  entirely.

### 12.7 Things that looked like bugs but weren't
- **Vite's `"Could not Fast Refresh (... export is incompatible)"` warning** for
  `AuthContext.jsx` / `ResumeAnalysisContext.jsx` during `npm run dev`: expected, dev-only, and
  harmless. It happens because those files export both a Provider *component* and a `useX` *hook*
  from the same file, which Vite's hot-reload can't hot-swap cleanly — it just does a full reload
  of that one file instead of an instant patch. Has zero effect on the production build.
- **`MongoServerSelectionError: getaddrinfo ENOTFOUND ...` right after restarting your computer**:
  a local DNS/network issue, not application code — see the note at the end of section 11 and the
  Troubleshooting table below.
- **`StripeConnectionError: getaddrinfo EAI_AGAIN api.stripe.com`**: same local network blip as
  above, happening to hit the Stripe call instead of the database call.

---

## 13. Anticipated judge questions + ready-made answers

**Q: Why MongoDB instead of a SQL database?**
A: Job postings from different companies/spreadsheets have wildly inconsistent shapes and optional
fields (some have salary, some don't; some have 3 skills, some have 20). MongoDB's flexible
document model handles that naturally without needing a rigid, pre-defined table schema for every
possible column combination.

**Q: How do you prevent User A from seeing User B's data?**
A: Every job, resume, and dataset record has an `owner` field, and every single database query in
every controller filters by `owner: req.user._id`. There is no code path that queries data without
that filter for authenticated endpoints.

**Q: What happens if the AI (Gemini) fails or is slow?**
A: There's an automatic local fallback — a simple keyword-overlap scorer — so a resume analysis
never just crashes or spins forever; it just returns a less-precise but instant result if the AI is
unavailable. There's also a two-model fallback chain before it even reaches that local scorer.

**Q: How does the free vs paid plan actually get enforced — could someone just fake being Pro?**
A: Pro status lives on the `User` document in the database (`subscriptionStatus`), set only by our
backend after verifying either (a) a Stripe webhook event or (b) a checkout session id that Stripe
confirms belongs to that exact logged-in user. The frontend never decides who's Pro — it just
displays whatever the backend's `isPro()` check returns, and the backend enforces the match-count
caps server-side regardless of what the frontend UI shows.

**Q: Why store a hash of the uploaded file instead of just checking the filename?**
A: Filenames can be identical for completely different content (or a renamed same file). A
SHA-256 hash is a fingerprint of the actual bytes — so we can reliably say "this exact file was
already uploaded" and skip reprocessing it, no matter what it's named.

**Q: What's the ATS score actually measuring?**
A: It's the AI's estimate of how well a resume would survive an automated resume-scanning system —
things like keyword alignment with the job, clear section structure, and avoiding
graphics/tables/columns that these systems often fail to parse correctly.

**Q: Why did you cap Basic users at 20 matches/day instead of per resume?**
A: To keep the free tier meaningfully limited (and the paid Pro tier meaningfully more valuable)
without letting someone bypass the limit just by re-uploading the same or a new resume repeatedly
in one day.

**Q: What was the trickiest bug you ran into?**
A: The bfcache-related stale-account bug (section 12.1). It only reproduced in a specific sequence
(log out, log in as someone else, visit Stripe, hit Back) and the login cookie itself was always
correct the whole time — the bug was purely in the React app trusting an old in-memory snapshot
instead of re-checking the server. It's a good example of why "the data was actually always
right" and "the UI ever shows it correctly" are two different engineering problems.

**Q: Is the app production-ready right now?**
A: The core architecture (auth, data isolation, billing) is production-grade, and we've since
fixed several real client-state bugs around plan upgrades and cached session data (section 12).
The main things you'd still want before a real launch: move file storage to cloud storage (S3),
enable a paid Gemini API tier to remove the free-tier 20/day ceiling, and add a password-reset
email flow.

---

## 14. How to run this project locally, from zero

### Prerequisites (install once)
1. **Node.js v18+** → https://nodejs.org (download the LTS version, install, restart your terminal).
   Check it worked: `node -v` and `npm -v`.
2. A code editor — VS Code is recommended.
3. A free MongoDB Atlas account (steps below).
4. A free Gemini API key (steps below).

### Step 1 — Get a MongoDB Atlas connection string (free)
1. Sign up at https://www.mongodb.com/cloud/atlas/register.
2. Create a free **M0 cluster**.
3. Under *Database Access*, create a database user (username + password — avoid special
   characters like `@` in the password, or URL-encode them).
4. Under *Network Access*, click "Allow Access from Anywhere" (`0.0.0.0/0`) — fine for a hackathon.
5. Click **Connect → Drivers** on your cluster and copy the connection string, e.g.:
   `mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
6. Fill in your real username/password and add a database name before the `?`:
   `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/job-analyzer?retryWrites=true&w=majority`
   This full string is your `MONGO_URI`.

### Step 2 — Get a Gemini API key (free)
1. Go to https://aistudio.google.com/app/apikey → sign in with Google → "Create API key".
2. Copy it — this is your `GEMINI_API_KEY`.
   (If you skip this, the Resume Analyzer still works using the local keyword fallback.)
3. **Before a real/live deployment**, enable billing on this Google AI Studio project — the free
   tier is capped at 20 requests/day/model total (see section 11 and section 12.5).

### Step 3 — (Optional) Get Stripe test keys, for billing
1. Sign up at https://dashboard.stripe.com/register.
2. Go to **Developers → API keys** and copy the **Secret key** (starts with `sk_test_...`) —
   this is your `STRIPE_SECRET_KEY`.
3. For local webhook testing, install the Stripe CLI and run
   `stripe listen --forward-to localhost:5000/api/billing/webhook` — it will print a `whsec_...`
   value, your `STRIPE_WEBHOOK_SECRET`. (Not strictly required for a demo — the checkout-session
   sync path activates Pro immediately without needing the webhook to be running.)

### Step 4 — Backend setup
```bash
cd backend
npm install
cp .env.example .env
```
Fill in `backend/.env`:
```
MONGO_URI=<your connection string>
PORT=5000
GEMINI_API_KEY=<your gemini key>
CLIENT_URL=http://localhost:5173
JWT_SECRET=<any long random string>
STRIPE_SECRET_KEY=<optional>
STRIPE_WEBHOOK_SECRET=<optional>
```
Run it:
```bash
npm run dev
```
You should see `MongoDB Connected` and `Server running on port 5000`.

### Step 5 — Frontend setup
Open a **new terminal tab** (keep the backend running):
```bash
cd frontend
npm install
cp .env.example .env
```
`frontend/.env`:
```
VITE_API_URL=http://localhost:5000/api
```
Run it:
```bash
npm run dev
```
Open the printed URL (usually http://localhost:5173).

### Step 6 — Try it end-to-end
1. Sign up for an account.
2. On the **Upload** page, drag in `sample-data/sample-jobs.csv`.
3. Go to **Dashboard** — see the charts populate.
4. Go to **All Jobs** — search/filter/sort.
5. Go to **Resume Analyzer** — upload a PDF/DOCX resume and see your ATS score + matches.
6. Go to **Account** — try "Upgrade to Pro" (if Stripe keys are set) and check Resume/Job Dataset
   History.

---

## 15. Deployment (going live)

### Backend → Render (free tier)
1. Push the project to GitHub.
2. On https://render.com, create a **New Web Service** from your repo.
3. Root Directory: `backend` · Build Command: `npm install` · Start Command: `npm start`.
4. Add the same environment variables as your local `.env` (set `CLIENT_URL` to your eventual
   Vercel URL, and `NODE_ENV=production`).
5. Deploy. Note the URL (e.g. `https://joblens-backend.onrender.com`).

### Frontend → Vercel (free tier)
1. On https://vercel.com, import the same GitHub repo.
2. Root Directory: `frontend` · Framework: Vite · Build Command: `npm run build` · Output: `dist`.
3. Environment variable: `VITE_API_URL=https://joblens-backend.onrender.com/api`.
4. Deploy. Note the URL (e.g. `https://joblens.vercel.app`).
5. Go back to Render and update `CLIENT_URL` to that Vercel URL, then redeploy the backend so CORS
   allows it.

### Stripe webhook in production
Set your Stripe Dashboard webhook endpoint to
`https://joblens-backend.onrender.com/api/billing/webhook`, subscribe to
`checkout.session.completed`, `customer.subscription.updated`, and
`customer.subscription.deleted`, and copy the signing secret into `STRIPE_WEBHOOK_SECRET` on
Render.

### Before you flip this live, double-check
- [ ] Billing enabled on the Google AI Studio project (section 11 / 12.5) — the free 20/day cap
      will otherwise break the demo for real visitors.
- [ ] `CLIENT_URL` on the backend exactly matches your deployed frontend origin (CORS).
- [ ] Stripe is switched from test keys to live keys if you want real payments.
- [ ] Atlas Network Access still allows your Render backend's outbound IPs (or `0.0.0.0/0`).

---

## 16. Troubleshooting

| Problem | Fix |
|---|---|
| `MongoServerError: bad auth` | Double-check username/password in `MONGO_URI`; URL-encode special characters (e.g. `@` → `%40`). |
| Backend can't connect / times out | Check Atlas Network Access allows `0.0.0.0/0`. |
| `MongoServerSelectionError: getaddrinfo ENOTFOUND ...`, especially right after restarting your computer | Local DNS/network hasn't fully reconnected yet — wait ~30s, restart the backend, or run `ipconfig /flushdns` (Windows). If it keeps happening, try setting your Wi-Fi adapter's DNS to `8.8.8.8`/`1.1.1.1`. Not an app bug — `mongodb+srv://` needs a working DNS lookup to find Atlas. |
| `StripeConnectionError: getaddrinfo EAI_AGAIN` | Same root cause as above — a transient local network/DNS blip, not a code issue. |
| CORS error in browser console | Make sure `CLIENT_URL` in the backend `.env` matches the frontend's exact origin. |
| Upload fails with "columns don't match" | The sheet's headers couldn't be matched to at least Job Title + Company — check the in-app format guide or download the sample template. |
| Resume analyzer gives generic/keyword-only scores | `GEMINI_API_KEY` missing/invalid, or the daily free-tier quota is exhausted — the local fallback is active. |
| `429 Too Many Requests` / `quota exceeded` from Gemini in the backend logs | Free-tier Gemini key hit its 20 requests/day/model limit — see section 11/12.5. Enable billing on the Google AI Studio project before a real deployment. |
| Vite prints `Could not Fast Refresh ("useAuth"/"useResumeAnalysis" export is incompatible)` | Expected, dev-only, harmless — see section 12.7. Doesn't affect production builds. |
| `npm install` fails | Make sure Node.js v18+ is installed (`node -v`). |
| "Upgrade to Pro" doesn't activate after payment | Check `STRIPE_SECRET_KEY` is set; the checkout-session sync should activate Pro instantly without needing the webhook, but confirm `CLIENT_URL` matches so the success redirect lands back correctly. |
| Resume Analyzer still shows locked/Basic content right after upgrading to Pro | Fixed as of section 12.4 — make sure you're running the updated `ResumeAnalysisContext.jsx`. If it still happens, log out and back in once to force a full state reset. |
| Wrong account shows after clicking Back from Stripe | Fixed as of section 12.1 — make sure you're running the updated `AuthContext.jsx`. |

---

Good luck at the hackathon 🚀 — you now know this project better than most people who built it.