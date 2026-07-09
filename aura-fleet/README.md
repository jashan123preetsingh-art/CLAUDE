# Aura Fleet

Management app + business model for a professional fleet company running **Maruti Suzuki Dzire Tour S CNG** cabs in Ludhiana and the Chandigarh tricity, on a **60% driver / 40% company revenue share** (driver pays only CNG; the company provides the car, insurance, servicing, fleet management, platform subscription and support) with **8% p.a. / 7-year** commercial financing. Corporate contracts are an additional best-effort benefit — never guaranteed.

- **[BUSINESS_MODEL.md](./BUSINESS_MODEL.md)** — the full business model: LLP structure, GST/ITC, the 60/40 revenue share, the ₹20k company floor, CNG economics, corporate contract pricing, risks.
- **`src/AuraFleetManager.jsx`** — the app itself (React + Recharts + Tailwind, sample data, no backend). Tabs: Overview (dashboard + daily/weekly/monthly/yearly reports), Fleet, Drivers (60/40 auto-split ledger), Calculators (EMI · Revenue sharing · Corporate · CNG · Maintenance · Depreciation · Break-even · Expansion · Cash flow · Projections), Expenses, Clients & Leads, Plan & Risk, Playbook.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Prototype with sample data — session data resets on reload. All figures are planning estimates, not accounting or tax advice.
