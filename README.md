# LabLoop: Campus Resource-Sharing & Physical Equipment Lifecycle Platform

> **Academic Resource Governance, Chain-of-Custody Handovers, and Explainable Scheduling.**  
> Built with Next.js 15 (App Router), Supabase (PostgreSQL, Storage, RLS), Tailwind CSS, Lucide Icons, and Google Gemini AI Advisory.

---

## 1. Project Overview

Universities and research institutions struggle with informal, fragmented equipment sharing. Expensive 3D printers, RF spectrum analyzers, cleanroom bays, GPU compute clusters, and camera kits are often reserved via spreadsheets, damaged without accountability, or monopolized by single research groups.

**LabLoop** solves this crisis by engineering a closed-loop physical equipment lifecycle:
1. **Safety Credential Prerequisite Engine**: Guarantees that students and researchers hold verified certifications (e.g. Laser Safety, Cleanroom Protocol, 3D Printer Induction) before booking requests can be submitted or approved.
2. **Postgres GIST Exclusion Non-Overlap**: Eliminates double-booking race conditions directly at the database engine level with `btree_gist` temporal constraints.
3. **Chain-of-Custody Handovers**: Objective dual-stage check-out and return condition inspections with checklist states, condition grades, and photographic evidence.
4. **Explainable Fair Allocation**: Transparent point-based queuing (Coursework > Research > Personal), category hour quotas, recent usage decay, and non-blocking safety strikes.
5. **Human-in-the-Loop AI Advisory**: Google Gemini provides advisory semantic matching and incident damage summaries, with deterministic rule-based fallbacks and strict human-only decisions.

---

## 2. Quickstart & Local Setup

### Prerequisites
- Node.js 18.18+ or Node.js 20+
- A Supabase project (hosted or local) with PostgreSQL and Storage enabled.
- A Google Gemini API key (optional; system includes deterministic rule-based fallbacks).

### Step 1: Clone & Install Dependencies
```bash
git clone <repository-url>
cd yoga_project
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```
Configure your environment keys in `.env.local`:
```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Google Gemini AI Advisory (Optional - Rule-based fallback active if omitted)
GEMINI_API_KEY=AIzaSy...
GEMINI_MODEL=gemini-2.5-flash
```

### Step 3: Run Database Schema
Execute `supabase/schema.sql` in your Supabase SQL Editor. This provisions:
- Core tables (`profiles`, `resources`, `resource_requirements`, `availability_windows`, `credentials`, `bookings`, `condition_reports`, `incidents`, `notifications`, `audit_log`, `fairness_settings`, `resource_managers`).
- `btree_gist` non-overlapping reservation constraint.
- Row-Level Security (RLS) policies and private storage buckets (`credentials`, `condition-photos`).

### Step 4: Seed Demo Data
Populate the 6 demo personas, 8 verified equipment items, availability windows, safety certificates, and active bookings:
```bash
npm run seed
```
*(The seed script is strictly idempotent and safe to re-run at any time).*

### Step 5: Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Demo Persona Accounts

All demo accounts share the password: **`Demo@1234`**

| Role | Email | Name | Department | Key Responsibilities & Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Central Admin** | `admin@labloop.demo` | Central Admin | Academic Facilities | Full governance, dispute adjudication, fairness limits, central audit log. |
| **Faculty Owner** | `owner@labloop.demo` | Dr. Meera Iyer | ECE Department | Verified owner of 8 equipment benches; reviews requests, verifies credentials. |
| **Lab Manager** | `manager@labloop.demo` | Arjun Lab Tech | Makerspace Central | Co-manager; handles day-to-day check-outs, return inspections, condition grades. |
| **Certified Student** | `student1@labloop.demo` | Priya S | Computer Science | Verified 3D printer & lab induction; can reserve advanced equipment. |
| **Overdue Student** | `student2@labloop.demo` | Rahul K | Electrical Engg | Pending credential review; waitlisted reservation; overdue soldering station. |
| **Fresh Student** | `student3@labloop.demo` | Divya M | Mechanical Engg | Clean account with no credentials; tests prerequisite blockers and upload flows. |

---

## 4. Step-by-Step Judge Test Script (End-to-End Walkthrough)

To evaluate the complete lifecycle from request to dispute adjudication, follow this 10-minute judge flow:

### Phase 1: Browse, Semantic AI Match, & Eligibility Check
1. Go to `http://localhost:3000/login` and sign in as **`student1@labloop.demo`** (`Demo@1234`).
2. You will be redirected to the **User Dashboard** (`/dashboard`). Notice your upcoming bookings, waitlist positions, safety credentials, and strikes count.
3. Click **Browse Resources** (`/resources`).
4. In the **Smart Match** box at the top, type:  
   *`"Need to 3D print a high-precision robotic drone chassis for my capstone"`*  
   Click **Find Resource**. Notice the **AI-Suggested** badge with ranked matches and explanatory reasoning (or keyword fallback if API key is inactive).
5. Toggle the **"Only eligible for me"** filter. Observe how equipment requiring certifications Priya holds remain visible, while uncertified ones are filtered out.
6. Click on the **Prusa MK4 3D Printer**.
7. Examine the **Eligibility Check** panel: green checkmarks show Priya's verified *3D Printer Induction*.
8. Note the **Weekly Schedule & Reserved Intervals (Anonymized)**: time slots are shown without applicant names to preserve privacy.

### Phase 2: Booking Request & Live Fair Allocation Pre-Check
9. Click **Request Reservation** (`/resources/<id>/request`).
10. Select tomorrow's date, 10:00 AM to 12:00 PM.
11. Enter Purpose: `"Fabricating custom motor housing brackets for ECE senior coursework"`.
12. Select **Priority Tier**: `Coursework`.
13. Observe the **Live Pre-Check Panel** updates dynamically:
    - Verifies safety prerequisite credentials (`Eligible`).
    - Verifies weekly category hour quota (`Within weekly quota`).
    - Verifies concurrent active booking quota (`Allowed`).
    - Verifies operating availability windows.
14. Check the mandatory usage rules acknowledgment checkbox and click **Submit Reservation**.
15. You are redirected to `/bookings/<id>` showing the status `pending` with an explainable system check breakdown.

### Phase 3: Custodian Review & Approval
16. Sign out and sign in as **`owner@labloop.demo`** (`Demo@1234`).
17. The **Owner Dashboard** surfaces 6 metric counters: Pending Requests, Waitlisted, Checked Out, Overdue, Incidents, and Pending Credentials.
18. Click **Review Queue** (`/review-queue`).
19. Locate Priya's reservation request. Notice the advisory chips displaying her priority tier and usage metrics.
20. Click **Approve Reservation** with an optional note (`"Approved for ECE senior design laboratory usage"`).
21. The reservation transitions to `approved`.

### Phase 4: Chain-of-Custody Check-Out
22. Go to **Active Handovers** (`/handovers`).
23. Under **Today & Upcoming Approved**, locate the approved booking and click **Start Check-Out** (`/bookings/<id>/checkout`).
24. Complete the check-out inspection:
    - Select Condition Grade: `Good`.
    - Check off category checklist items: *Powers on cleanly*, *All accessories present*, *No physical housing cracks*.
    - Add Custodian Note: `"Issued in good working order with power supply"`.
    - Upload an equipment photo (optional).
25. Click **Confirm Check-Out Handover**.
26. The booking transitions to `checked_out`.

### Phase 5: Return Inspection & Condition Comparison
27. In `/handovers`, under **Currently Checked Out**, locate the booking and click **Process Return** (`/bookings/<id>/return`).
28. Simulate damage during student use:
    - Select Condition Grade: `Damaged`.
    - Uncheck: *No physical housing cracks*.
    - Add Return Note: `"Returned with fractured extruder mount and chipped glass plate"`.
29. Click **Confirm Return Inspection**.
30. The system displays a prominent **BEFORE vs. AFTER Condition Comparison**:
    - Side-by-side grade regression: `Good` &rarr; `Damaged`.
    - Highlighted checklist discrepancies.
    - Prominent call-to-action: **"Condition changed: Report an incident?"**.

### Phase 6: AI-Assisted Incident Report & Resolution
31. Click **Report Incident** (`/bookings/<id>/incident`).
32. Select Type: `Damage`, Severity: `High`.
33. Enter Description: `"Extruder assembly sheared off during rapid print head transit. Build plate fractured"`.
34. Click **Submit Incident Report**.
35. On the incident detail view (`/incidents/<id>`):
    - View the **AI Advisory Summary**: Gemini analyzes the description and before/after grades to provide a 3-4 sentence evidence summary and recommended resolution.
    - Clear label: *"AI-generated summary. Advisory only. A human custodian makes all final decisions."*
36. Click **Mark Under Review**, then under **Resolve Incident**:
    - Select Resolution: `Charge repair fee and issue safety strike`.
    - Check **Apply 1 Reliability Strike to Borrower**.
    - Click **Resolve Incident**.
37. The incident moves to `resolved`, and 1 strike is recorded to Priya's profile with an audit trail entry.

### Phase 7: Student Strike Notification & Dispute Lodging
38. Sign out and sign in as **`student1@labloop.demo`**.
39. In the User Dashboard (`/dashboard`), notice the **Reliability Standing** now shows `1 Active Strike` with the explanation:
    > *"Strikes lower your waitlist priority; they never block you automatically. A person reviews every penalty."*
40. Navigate to **Incidents** (`/incidents`) and click on the resolved damage incident.
41. Under **Contest Resolution (Borrower Dispute)**, enter:
    `"The extruder mount had existing micro-fractures from the previous session before my print started. I followed official speed guidelines."`
42. Click **Submit Dispute**. Status updates to `disputed`.

### Phase 8: Central Admin Adjudication & Audit Log
43. Sign out and sign in as **`admin@labloop.demo`**.
44. The **Admin Dashboard** displays:
    - Platform totals (Users, Active Resources, Bookings, Open Incidents).
    - **Fairness Snapshot**: Monopolisation risk table showing top 5 users by hours booked in 30 days vs platform average.
    - **Contested Incident Disputes**: Highlights the dispute filed by Priya.
45. Click **Adjudicate** on the dispute:
    - Review before/after condition reports, AI summary, and borrower contest rationale.
    - Choose Decision: `Overturn strike penalty`.
    - Enter Admin Finding: `"Hardware wear fatigue confirmed on extruder bracket; strike revoked from student profile"`.
    - Click **Finalize Dispute Adjudication**.
46. The strike is reversed from Priya's profile, and the incident moves to `closed`.
47. Go to **Audit Log** (`/admin/audit`):
    - Filter by Action (`dispute_resolved`, `incident_resolved`, `checkout_completed`).
    - Expand any row to view cryptographic JSON metadata payloads and actor IDs.
    - Click **Export CSV** to download a complete event export.
48. Go to **Fairness Settings** (`/admin/settings`):
    - Review the plain-language formula breakdown: Base Tier (100/70/30) &minus; Recent Usage (&minus;5 pts/hr) &minus; Strikes (&minus;25 pts/strike).
    - Edit max active bookings or category quotas and click **Save Policy Changes**; observe immediate audit logging.

---

## 5. Architectural Deep Dive

```
┌─────────────────────────────────────────────────────────────┐
│                   Next.js 15 App Router                     │
│  Server Components (SSR) • Server Actions • React 19 Client │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
               ▼                               ▼
┌───────────────────────────────┐ ┌───────────────────────────┐
│     Supabase PostgreSQL       │ │      Google Gemini        │
│ • btree_gist exclusion        │ │ • REST API Wrapper        │
│ • Row-Level Security (RLS)    │ │ • Smart Match Ranking     │
│ • Append-Only Audit Trail     │ │ • Incident Evidence Summ. │
│ • Private Storage Buckets     │ │ • Fallback Rule Engine    │
└───────────────────────────────┘ └───────────────────────────┘
```

### PostgreSQL Non-Overlapping Slot Constraint (`btree_gist`)
Double bookings are prevented mathematically in PostgreSQL. The `bookings` table enforces:
```sql
ALTER TABLE public.bookings
ADD CONSTRAINT no_overlapping_active_bookings
EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
)
WHERE (status IN ('approved', 'checked_out'));
```
No concurrent request or server action race condition can bypass this constraint.

### Immutable Append-Only Audit Logging
All state transitions (`booking_approved`, `checkout_completed`, `return_completed`, `incident_resolved`, `fairness_settings_updated`, `user_role_changed`) call `logAudit()`:
- Records `actor_id`, `actor_name`, `action`, `entity_type`, `entity_id`, `reason`, and JSON `details`.
- RLS policy prohibits `UPDATE` and `DELETE` queries on `audit_log`, ensuring an immutable forensic record.

### Pure Tailwind Visuals
Resource utilisation bars and monopolisation ratios are rendered with lightweight, zero-dependency Tailwind CSS classes (`w-full bg-slate-800 rounded-full h-2.5` filled with `bg-gradient-to-r from-indigo-500 to-cyan-400`). No bulky external chart libraries are included.

---

## 6. Fairness Quotas & Waitlist Ranking Engine

### Priority Score Calculation
Waitlist rank is calculated transparently via `computePriorityScore()` in `src/lib/fairness.ts`:

$$\text{Priority Score} = \max\Big(0, \text{Base Points} - (25 \times \text{Strikes}) - (5 \times \text{Hours Used in Last 7 Days})\Big)$$

- **Base Points by Tier**:
  - `coursework`: 100 points (Curriculum graduation requirements receive top priority)
  - `research`: 70 points (Sponsored academic thesis & laboratory work)
  - `personal`: 30 points (Hobbyist or exploratory projects)
- **Recent Usage Decay**: 5 points deducted per hour booked in that category over the past 7 days to prevent resource monopolization.
- **Reliability Strikes**: 25 points deducted per active strike. **Strikes never automatically block booking requests.** Human custodians review every application.
- **Tie-Breaking**: Requests with identical scores are ordered FIFO (First In, First Out) by `created_at` timestamp.

---

## 7. Privacy & Security Safeguards

- **Anonymized Availability**: The public schedule view on `/resources/[id]` renders only booked intervals (`10:00 - 12:00 (Reserved)`) without revealing applicant names, departments, or research descriptions.
- **Short-Lived Signed URLs**: Uploaded credential PDFs and condition inspection photos are stored in private Supabase buckets (`credentials`, `condition-photos`). Pre-signed download URLs are generated on-demand with a maximum lifetime of **3,600 seconds (1 hour)**.
- **Service Role Isolation**: `createAdminClient()` includes `import "server-only";` at line 1, prohibiting compilation or leakage of `SUPABASE_SERVICE_ROLE_KEY` into browser bundles.
- **Strict Role-Based Access Control**: Server actions enforce `requireUser()` and `requireRole(["owner", "manager", "admin"])`.
- **HTTP Security Headers**: `next.config.ts` enforces `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.

---

## 8. AI Disclosures & Safety Boundaries

- **Service**: Google Gemini REST API (`gemini-2.5-flash` or specified model) with 8-second HTTP timeout and JSON schema response parsing.
- **Capabilities**:
  1. *Smart Match*: Semantic ranking of campus equipment from informal student prompts (`"record 4k video on Saturday"`).
  2. *Incident Analysis*: Synthesizes condition grades, checklist discrepancies, and damage descriptions into a concise 3-4 sentence evidence summary.
- **Advisory Disclosure**: AI outputs are strictly informative. The AI **never** approves bookings, never assesses damage liability, and never applies disciplinary strikes autonomously. All final decisions require human custodian action.
- **Deterministic Rule Fallbacks**: If `GEMINI_API_KEY` is not provided, or the network request times out, the platform seamlessly defaults to keyword scoring and rule-based template summaries with zero user disruption.

---

## 9. Limitations & Future Scope

### Current Limitations
- Physical door and bench locks currently rely on digital check-out verification rather than automated IoT solenoid relays.
- Photo uploads require mobile camera upload or file attachment rather than direct optical QR scanner integration.

### Future Scope
- Hardware IoT integration with campus NFC student ID card readers for tap-to-unlock benches.
- Multi-campus resource federation allowing inter-university consortium equipment sharing.
- Predictive maintenance analytics forecasting component failures based on aggregated hours and return checklist regressions.

---

## 10. Vibe Coding & Tool Disclosures

This application was engineered with human-guided agentic pair programming:
- **Framework**: Next.js 15.2.1 App Router with React 19.
- **Language**: TypeScript (strict typecheck verified).
- **Styling**: Tailwind CSS with dark-mode aesthetic and Lucide React icons.
- **Database & Storage**: Supabase Postgres with RLS and Storage S3 API.
- **Date Handling**: `date-fns` v4.

---

## 11. Verification & Testing Commands

To run all automated verification checks locally:

```bash
# 1. Typecheck the entire TypeScript codebase
npm run typecheck

# 2. Compile production Next.js build
npm run build

# 3. Test idempotent database seeding
npm run seed
```

*LabLoop: Engineered for Trust, Safety, and Academic Collaboration.*

