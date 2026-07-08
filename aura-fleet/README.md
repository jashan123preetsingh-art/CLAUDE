# Aura Fleet

Management app + business model for a commercial CNG cab fleet in Ludhiana and the Chandigarh tricity.

- **[BUSINESS_MODEL.md](./BUSINESS_MODEL.md)** — the full business model: LLP structure, GST/ITC, the three driver payment options, the ₹20k company floor, CNG economics, corporate contracts, risks.
- **`src/AuraFleetManager.jsx`** — the app itself (React + Recharts + Tailwind, sample data, no backend). Tabs: Overview, Fleet, Drivers, Calculators (EMI · Simulator · Rent Guide · Revenue Models · CNG · Depreciation · Scale), Expenses, Clients & Leads, Plan & Risk, Playbook.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Prototype with sample data — session data resets on reload. All figures are planning estimates, not accounting or tax advice.
