# LeadForge AI

AI-powered lead generation and outreach platform for agencies, freelancers, and B2B companies.

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│   Landing │ Dashboard │ Leads │ CRM │ Outreach │ Campaigns│
├─────────────────────────────────────────────────────────┤
│                   Backend API (Express)                   │
│  Auth │ Leads │ Projects │ Campaigns │ Outreach │ Export  │
├───────────┬──────────────┬──────────────┬───────────────┤
│  Scraper  │  AI Service  │Email Service │ Export Service │
│(Playwright)│ (Claude API) │(SendGrid/SMTP)│  (CSV/XLSX)  │
├───────────┴──────────────┴──────────────┴───────────────┤
│              PostgreSQL  │  Redis (Job Queues)            │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer     | Technology                    |
|-----------|-------------------------------|
| Frontend  | Next.js 15, React 19, Tailwind CSS |
| Backend   | Node.js, Express, TypeScript  |
| Database  | PostgreSQL + Prisma ORM       |
| Scraping  | Playwright (headless Chrome)   |
| AI        | Claude API (Anthropic)         |
| Email     | SendGrid / SMTP / Nodemailer   |
| Auth      | JWT (bcrypt + jsonwebtoken)    |
| Deploy    | Docker Compose                 |

## Features

1. **Business Lead Search** - Search Google Maps by niche + location, extract business data
2. **Contact Extraction** - Crawl websites for emails, phones, social links (Instagram, Facebook, LinkedIn, Twitter)
3. **AI Outreach Generator** - Generate personalized cold emails, DMs, and messages using Claude
4. **Campaign Automation** - Bulk email sending with personalization tags, scheduling, follow-ups
5. **CRM Pipeline** - Kanban-style pipeline (New → Contacted → Replied → Meeting → Closed)
6. **Lead Scoring** - 0-100 score based on website, reviews, social presence, contact availability
7. **Export** - CSV, Excel export with filtering

## Database Schema

```
Users ──┬── Projects ──┬── Businesses ──┬── Contacts
        │              │               ├── SocialProfiles
        │              │               └── EmailsSent
        │              ├── OutreachCampaigns ──── EmailsSent
        │              └── LeadSearches ──── Businesses
        └── EmailAccounts ──── OutreachCampaigns
```

**Key Models:** Users, Projects, LeadSearches, Businesses, Contacts, SocialProfiles, EmailAccounts, OutreachCampaigns, EmailsSent

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Sign in
- `GET /api/auth/me` - Get current user

### Leads
- `POST /api/leads/search` - Start Google Maps search
- `GET /api/leads/search/:id` - Get search status/results
- `GET /api/leads/searches` - List all searches
- `GET /api/leads` - List leads with filtering/pagination
- `GET /api/leads/:id` - Get lead details
- `PATCH /api/leads/:id/status` - Update lead status
- `POST /api/leads/:id/extract-contacts` - Extract contacts from website
- `PATCH /api/leads/:id/notes` - Add notes

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `GET /api/projects/:id` - Project details
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### AI Outreach
- `POST /api/outreach/generate` - Generate outreach messages
- `POST /api/outreach/follow-up` - Generate follow-up

### Campaigns
- `POST /api/campaigns` - Create campaign
- `GET /api/campaigns` - List campaigns
- `GET /api/campaigns/:id` - Campaign details
- `POST /api/campaigns/:id/start` - Start sending
- `POST /api/campaigns/:id/pause` - Pause campaign
- `GET /api/campaigns/:id/analytics` - Campaign stats

### Export
- `GET /api/export/csv` - Export leads as CSV
- `GET /api/export/excel` - Export leads as Excel

### Dashboard
- `GET /api/dashboard/stats` - Dashboard statistics

## Folder Structure

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema
│   │   └── seed.ts                # Demo data
│   ├── src/
│   │   ├── api/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts        # JWT authentication
│   │   │   │   └── validate.ts    # Zod validation
│   │   │   └── routes/
│   │   │       ├── auth.routes.ts
│   │   │       ├── leads.routes.ts
│   │   │       ├── projects.routes.ts
│   │   │       ├── campaigns.routes.ts
│   │   │       ├── outreach.routes.ts
│   │   │       ├── export.routes.ts
│   │   │       └── dashboard.routes.ts
│   │   ├── config/
│   │   │   ├── index.ts           # App configuration
│   │   │   └── database.ts        # Prisma client
│   │   ├── services/
│   │   │   ├── auth.service.ts    # Authentication
│   │   │   ├── scraper.service.ts # Google Maps + contact extraction
│   │   │   ├── ai.service.ts      # Claude AI outreach generation
│   │   │   ├── email.service.ts   # Email sending + campaigns
│   │   │   └── export.service.ts  # CSV/Excel export
│   │   └── server.ts              # Express app entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── layout.tsx         # Root layout
│   │   │   ├── globals.css        # Tailwind styles
│   │   │   ├── auth/login/        # Login page
│   │   │   ├── auth/register/     # Register page
│   │   │   ├── dashboard/         # Main dashboard
│   │   │   ├── leads/             # Lead search + results
│   │   │   ├── crm/               # CRM pipeline (kanban)
│   │   │   ├── outreach/          # AI message generator
│   │   │   ├── campaigns/         # Email campaigns
│   │   │   └── settings/          # Settings page
│   │   ├── components/
│   │   │   └── layout/
│   │   │       ├── Sidebar.tsx    # Navigation sidebar
│   │   │       └── DashboardLayout.tsx
│   │   ├── lib/
│   │   │   └── api.ts             # Axios API client
│   │   └── types/
│   │       └── index.ts           # TypeScript types
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
├── docker/
│   ├── docker-compose.yml         # Full stack deployment
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── .env.example
└── README.md
```

## Quick Start

### Local Development

```bash
# 1. Start database
cd docker && docker compose up postgres redis -d

# 2. Backend
cd backend
cp .env.example .env  # Edit with your API keys
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# 3. Frontend
cd frontend
npm install
npm run dev
```

### Docker (Production)

```bash
cd docker
cp .env.example .env  # Add your API keys
docker compose up --build
```

App: http://localhost:3000 | API: http://localhost:4000

Demo login: `demo@leadforge.ai` / `demo1234`

## SaaS Pricing

| Plan    | Price   | Leads/mo  | Features                              |
|---------|---------|-----------|---------------------------------------|
| Starter | $49/mo  | 1,000     | Basic search, outreach, CSV export    |
| Pro     | $99/mo  | 5,000     | AI generation, campaigns, follow-ups  |
| Agency  | $249/mo | Unlimited | Full CRM, analytics, API, integrations|

## Lead Scoring Algorithm (0-100)

| Factor              | Points |
|---------------------|--------|
| Website present     | 25     |
| Review count (100+) | 25     |
| Rating (4.5+)       | 20     |
| Phone available     | 10     |
| Address complete    | 10     |
| Name quality        | 10     |
| Email found         | +15    |
| Social profiles     | +5/each (max 20) |
