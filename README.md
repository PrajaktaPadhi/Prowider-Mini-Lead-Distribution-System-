# Prowider Mini — Lead Distribution System

A fully functional, highly reliable, and concurrent-safe Lead Generation and Distribution system simulated for platforms like **Prowider**. It is built using **Next.js 14/15 (App Router)**, **MongoDB** (via Mongoose ORM), and utilizes **Server-Sent Events (SSE)** for real-time dashboard updates without page refreshes.

This system guarantees engineered correctness, data consistency under heavy concurrency, and webhook safety.

---

## 🚀 Live Demo & Repository
- **GitHub Repository:** `[Your GitHub Repo URL]`
- **Live Demo URL:** `[Your Vercel Deployment URL]`

---

## 🛠️ Tech Stack & Key Choices

- **Frontend & Backend:** Next.js 14/15 (App Router) — Unified architecture with efficient API Route Handlers.
- **Database:** MongoDB Atlas (Production-grade, document-based transactional support).
- **ORM:** Mongoose — Type safety, schema enforcement, validation, and query builders.
- **Real-Time Updates:** Server-Sent Events (SSE) — Lightweight, unidirectional streaming over standard HTTP. Ideal for single-direction server-to-client updates.
- **Styling:** Vanilla CSS (Dark Theme, Custom variables) — Designed for readability and responsive layout.

---

## 📂 Project Structure

```
project/
├── package.json
├── next.config.mjs
├── .env.local                    # Environment configuration
├── scripts/
│   └── seed.js                   # Idempotent DB seeder
├── src/
│   ├── lib/
│   │   ├── db.js                 # MongoDB connection manager (cached)
│   │   ├── config.js             # Mandatory rules & allocation pools
│   │   ├── allocation.js         # Lead allocation core engine
│   │   └── models/
│   │       ├── Service.js        # Service model
│   │       ├── Provider.js       # Provider model (quota tracking)
│   │       ├── Lead.js           # Lead model (duplicate checks)
│   │       ├── LeadAssignment.js # Lead-Provider mapping
│   │       ├── RoundRobinState.js# Fair rotation pointer persistence
│   │       └── WebhookEvent.js   # Webhook idempotency keys
│   └── app/
│       ├── layout.js             # Global layout & Nav
│       ├── page.js               # Welcome / Features entry
│       ├── globals.css           # Premium dark-theme styling
│       ├── request-service/
│       │   └── page.js           # Customer request form
│       ├── dashboard/
│       │   └── page.js           # Real-time provider list & leads
│       ├── test-tools/
│       │   └── page.js           # Simulators panel
│       └── api/
│           ├── services/         # GET: Fetch services
│           ├── leads/            # POST: Create lead & allocate
│           ├── providers/        # GET: Fetch providers + assignments
│           ├── dashboard/stream/ # GET: SSE updates stream
│           ├── webhook/reset-quota/ # POST: Idempotent quota reset
│           └── test/generate-leads/ # POST: Bulk concurrent lead generator
```

---

## ⚙️ Setup & Installation Instructions

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or later)
- An active [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (or local MongoDB Community Server)

### 2. Clone and Install Dependencies
```bash
git clone <repository-url>
cd project
npm install
```

### 3. Environment Setup
Create a `.env.local` file in the root of the project:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/prowider?retryWrites=true&w=majority
```
*(Replace the placeholder with your actual MongoDB Atlas cluster URI or local connection string: `mongodb://localhost:277017/prowider`)*

### 4. Seed the Database
Run the idempotent seeding script to initialize the services, 8 providers, and round-robin pointer state:
```bash
npm run seed
```

### 5. Run the Local Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to interact with the application.

---

## 🧠 Core Engineering Architecture

### 1. The Allocation Algorithm

For every new lead, the system must assign exactly **3 providers total**:

1. **Mandatory Check:**
   - The system checks the `MANDATORY_RULES` for the selected service:
     - **Service 1:** Provider 1 must always receive
     - **Service 2:** Provider 5 must always receive
     - **Service 3:** Provider 1 AND Provider 4 must always receive
   - For each mandatory provider, it verifies if their **remaining quota** is $> 0$ (`leadsReceived < monthlyQuota`). If so, they are assigned to the lead.

2. **Fair Selection (Round-Robin with Persistence):**
   - The remaining slots (e.g. $3 - \text{assigned\_mandatory\_count}$) are filled from the eligible pool:
     - **Service 1 pool:** Providers 2, 3, 4
     - **Service 2 pool:** Providers 6, 7, 8
     - **Service 3 pool:** Providers 2, 3, 5, 6, 7, 8
   - It reads the persisted round-robin `nextIndex` for that service from the database.
   - It iterates through the pool starting from `nextIndex`, filtering out:
     - Providers already assigned via mandatory rules.
     - Providers with an exhausted quota.
   - If a provider is eligible, it increments `leadsReceived` atomically and adds them to the assignment.
   - Finally, the `nextIndex` is advanced to point to the next provider, ensuring future calls pick up right where the last allocation left off.

---

### 2. Concurrency Handling & Data Consistency

Simultaneous lead creation poses a serious risk: multiple parallel requests might read a provider's remaining quota as `1` and attempt to assign both leads, leading to a quota overflow (e.g. `11/10`).

Prowider Mini solves this at the database level using two key techniques:

* **Atomic Decrements with Guard Conditions (`findOneAndUpdate`):**
  We do not do a read-then-write check. Instead, when assigning a lead to a provider, we issue an atomic update query:
  ```javascript
  const updatedProvider = await Provider.findOneAndUpdate(
    {
      _id: provider._id,
      leadsReceived: { $lt: provider.monthlyQuota } // Guard condition
    },
    { $inc: { leadsReceived: 1 } },
    { new: true }
  );
  ```
  If another request concurrently consumed the last remaining slot, `leadsReceived` would equal `monthlyQuota`, the guard condition would fail, and `findOneAndUpdate` would return `null`. The system detects this immediately and moves to the next provider in the pool.

* **Round-Robin Point Progression:**
  We increment the pointer atomically using MongoDB's `$inc` operator on `RoundRobinState`:
  ```javascript
  const rrState = await RoundRobinState.findOneAndUpdate(
    { serviceSlug },
    { $inc: { nextIndex: remainingSlots } },
    { new: false, upsert: true } // Returns the index *before* incrementing
  );
  ```
  This guarantees that concurrent requests obtain strictly different starting offsets in the fair rotation pool, eliminating duplicate selection issues.

* **Unique Database Indexes:**
  - **Duplicate Leads Rule:** To enforce that a phone number cannot submit multiple leads for the same service, a compound unique index is created on the `leads` collection:
    ```javascript
    LeadSchema.index({ phone: 1, serviceId: 1 }, { unique: true });
    ```
    If two concurrent requests attempt to create duplicate leads, one is rejected immediately at the database level with a `11000 Duplicate Key` exception, returning a `409 Conflict` to the client.
  - **Single Lead Assignment:** A compound unique index on `lead_assignments` prevents the same provider from being assigned the same lead twice:
    ```javascript
    LeadAssignmentSchema.index({ leadId: 1, providerId: 1 }, { unique: true });
    ```

---

### 3. Webhook Safety & Idempotency

The test suite panel allows resetting provider quotas to `10`. To make this production-safe and resilient to network retries, we implement an **Idempotency Key validation**:

1. The payment gateway/client generates a unique `idempotencyKey` (e.g. UUID) for the transaction.
2. The server receives the request and searches for the key in the `webhook_events` collection:
   ```javascript
   const existingEvent = await WebhookEvent.findOne({ idempotencyKey });
   ```
3. **If found:** The server immediately returns the recorded result without modifying the database or resetting quotas again.
4. **If not found:** The server resets the quotas, records the action, and commits the `idempotencyKey` to the collection:
   ```javascript
   await WebhookEvent.create({ idempotencyKey, action: 'reset_quota', result });
   ```
5. If the request is sent 5 times in a row with the same key, only the first transaction modifies the database, ensuring zero side-effects.

---

### 4. Real-Time Dashboard Mechanics

The `/dashboard` requires immediate visibility of new leads.
We implement this via a highly robust **polling-based Server-Sent Events (SSE)** connection:
- The dashboard client establishes a connection to `/api/dashboard/stream` on page load.
- The route opens a persistent HTTP connection (`text/event-stream`).
- The server polls the `lead_assignments` collection every 2 seconds for new assignments created after the last checked timestamp.
- When new assignments are detected, the server streams the payload to the browser.
- The dashboard detects this event, automatically triggers a fetch request to reload the fresh state, updating the UI dynamically without a full page reload.

---

## 🧪 Testing Scenarios

Visit the `/test-tools` page to run the simulated test suite:

1. **Reset Provider Quota:** Triggers a webhook reset using a unique idempotency key.
2. **Call Webhook 5x:** Fires 5 concurrent requests with the *same* key. The log pane will show `alreadyProcessed=true` for 4 of the calls, verifying idempotency.
3. **Generate 10 Leads Instantly:** Fires 10 concurrent requests creating leads with unique phone numbers across random services. You can watch the real-time `/dashboard` in another window populate instantly, rotating fair allocations and respecting the 10-quota cap.
4. **Duplicate Leads:** Try to submit the same phone number for the same service on `/request-service` twice. The database will reject it, and the client will display a clear error message.

---

## 🌐 Production Deployment Guide (Vercel + Atlas)

### Step 1: Create a MongoDB Atlas Database
1. Sign up on [MongoDB Atlas](https://www.mongodb.com/).
2. Create a Free Cluster (M0).
3. Under **Database Access**, create a user with read/write privileges.
4. Under **Network Access**, whitelist IP `0.0.0.0/0` to allow Vercel serverless functions to connect.
5. Copy the connection string.

### Step 2: Push code to GitHub
```bash
git init
git add .
git commit -m "feat: complete lead distribution system"
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

### Step 3: Deploy to Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Select your imported GitHub repository.
3. In the **Environment Variables** section, add:
   - **Key:** `MONGODB_URI`
   - **Value:** *[Your MongoDB Atlas connection string]*
4. Click **Deploy**.
5. Once built, copy your live project domain.

### Step 4: Run Seeding on Production DB
You can either run the seed command locally using your production MongoDB Atlas string:
```bash
MONGODB_URI="mongodb+srv://..." npm run seed
```
Or trigger it by making a request to the seed script if it was integrated into your pipeline.

---

This project represents a highly reliable, concurrent-safe full-stack lead distribution system conforming perfectly to real-world software engineering practices.
