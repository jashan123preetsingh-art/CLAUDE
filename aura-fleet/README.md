# Auto Moto Mobility Solutions · Fleet CRM

Fleet CRM + business model for **Auto Moto Mobility Solutions**, a professional fleet management company running **Maruti Suzuki Dzire Tour S CNG** cabs in Ludhiana and the Chandigarh tricity, on a **60% driver / 40% company revenue share** (driver pays only CNG; the company provides the car, insurance, servicing, fleet management, platform subscription and support) with **8% p.a. / 7-year** commercial financing. Corporate contracts are an additional best-effort benefit — never guaranteed.

- **[BUSINESS_MODEL.md](./BUSINESS_MODEL.md)** — the full business model: LLP structure, GST/ITC, the 60/40 revenue share, the ₹20k company floor, CNG economics, corporate contract pricing, risks.
- **`src/AutoMotoCRM.jsx`** — the app itself (React + Recharts + Tailwind, data persists in the browser). Tabs: Overview (dashboard + daily/weekly/monthly/yearly reports), Fleet, Drivers (60/40 auto-split ledger + per-driver earnings history), Calculators (EMI · Revenue sharing · Corporate · CNG · Maintenance · Depreciation · Break-even · Expansion · Cash flow · Projections), Expenses, Clients & Leads (with GST invoice generator), Plan & Risk, **Plan Book** (the 10-phase growth blueprint: ride-hailing → EV gig scooters → commercial fleet → public mobility → fleet services → driver ecosystem → SaaS → logistics → future mobility → global, each with unlock gates and a 13-point research checklist), and Sales Kit.
- **[HOW_TO_RUN.md](./HOW_TO_RUN.md)** — beginner guide; on Windows just double-click `START-WINDOWS.bat`.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Prototype with sample data — session data resets on reload. All figures are planning estimates, not accounting or tax advice.
