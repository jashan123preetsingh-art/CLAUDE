import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, Car, Users, Calculator, Wallet, Building2, TrendingUp, BookOpen, Bell, IndianRupee,
} from "lucide-react";

/* ================= formatting & finance math ================= */
const MONO = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace" };
const DISP = { fontFamily: "'Archivo', system-ui, sans-serif" };
const NOW = new Date();
const inr = (n) => (n < 0 ? "−₹" : "₹") + Math.round(Math.abs(n)).toLocaleString("en-IN");
const inrS = (n) => {
  const a = Math.abs(n), s = n < 0 ? "−" : "";
  if (a >= 1e7) return `${s}₹${(a / 1e7).toFixed(2)} Cr`;
  if (a >= 1e5) return `${s}₹${(a / 1e5).toFixed(1)} L`;
  if (a >= 1e3) return `${s}₹${(a / 1e3).toFixed(0)}k`;
  return `${s}₹${Math.round(a)}`;
};
const emiCalc = (P, annual, years) => {
  const r = annual / 1200, n = years * 12;
  if (n <= 0 || P <= 0) return 0;
  if (r === 0) return P / n;
  const f = Math.pow(1 + r, n);
  return (P * r * f) / (f - 1);
};
const balanceAt = (P, annual, years, m) => {
  const r = annual / 1200, n = years * 12, e = emiCalc(P, annual, years);
  if (m >= n) return 0;
  if (r === 0) return Math.max(0, P - e * m);
  const f = Math.pow(1 + r, m);
  return Math.max(0, P * f - (e * (f - 1)) / r);
};
const monthsSince = (iso) => Math.max(0, (NOW - new Date(iso)) / (86400000 * 30.44));
const yearsSince = (iso) => Math.max(0, (NOW - new Date(iso)) / (86400000 * 365.25));
const daysUntil = (iso) => Math.ceil((new Date(iso) - NOW) / 86400000);
const fmtD = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
/* Indian used-market resale curve for a CNG sedan (fraction of on-road price) */
const RESALE = [1, 0.74, 0.63, 0.54, 0.46, 0.39, 0.33, 0.28];
const resaleFrac = (y) => {
  if (y <= 0) return 1;
  if (y >= 7) return Math.max(0.12, 0.28 - 0.04 * (y - 7));
  const lo = Math.floor(y), hi = Math.ceil(y);
  if (lo === hi) return RESALE[lo];
  return RESALE[lo] + (RESALE[hi] - RESALE[lo]) * (y - lo);
};

/* per-car owner-side running cost assumptions (editable in Calculators) */
const OPEX = { insurance: 28000, service: 15000, tyres: 16000, tyreLife: 3, battery: 6500, batteryLife: 3 };
const perCarOpexMo = (o = OPEX) =>
  o.insurance / 12 + o.service / 12 + o.tyres / (o.tyreLife * 12) + o.battery / (o.batteryLife * 12);

const carLoan = (c) => {
  const P = c.onRoad - c.downPayment;
  const e = emiCalc(P, c.rate, c.tenure);
  const m = monthsSince(c.purchaseDate);
  const remaining = balanceAt(P, c.rate, c.tenure, m);
  return { principal: P, emi: m >= c.tenure * 12 ? 0 : e, remaining, monthsLeft: Math.max(0, Math.round(c.tenure * 12 - m)) };
};
const carValue = (c) => c.onRoad * resaleFrac(yearsSince(c.purchaseDate));

/* ================= seed data ================= */
const SEED_CARS = [
  { id: "c1", reg: "PB 10 XY 4821", city: "Ludhiana", chassis: "MALBB51RLPM104821", engine: "G4LNCM104821", purchaseDate: "2024-03-10", onRoad: 705000, downPayment: 100000, rate: 9.4, tenure: 5, dailyRent: 1050, driverId: "d1", status: "Active", insuranceExpiry: "2026-07-20", pucExpiry: "2026-09-15", serviceDue: "2026-08-22", tyreDate: "2024-03-10", batteryDate: "2024-03-10", gps: true, rcCopy: true, insCopy: true },
  { id: "c2", reg: "PB 10 AB 7734", city: "Ludhiana", chassis: "MALBB51RLRM207734", engine: "G4LNCM207734", purchaseDate: "2024-08-02", onRoad: 712000, downPayment: 120000, rate: 9.9, tenure: 5, dailyRent: 1100, driverId: "d2", status: "Active", insuranceExpiry: "2026-08-01", pucExpiry: "2026-10-05", serviceDue: "2026-09-10", tyreDate: "2026-06-14", batteryDate: "2024-08-02", gps: true, rcCopy: true, insCopy: true },
  { id: "c3", reg: "CH 01 CD 2210", city: "Chandigarh", chassis: "MALBB51RLSM302210", engine: "G4LNCM302210", purchaseDate: "2025-01-15", onRoad: 718000, downPayment: 100000, rate: 9.5, tenure: 5, dailyRent: 1100, driverId: "d3", status: "Active", insuranceExpiry: "2027-01-14", pucExpiry: "2026-07-28", serviceDue: "2026-07-08", tyreDate: "2025-01-15", batteryDate: "2025-01-15", gps: true, rcCopy: true, insCopy: true },
  { id: "c4", reg: "PB 65 EF 9902", city: "Mohali", chassis: "MALBB51RLSM409902", engine: "G4LNCM409902", purchaseDate: "2025-06-20", onRoad: 720000, downPayment: 150000, rate: 9.2, tenure: 4, dailyRent: 1150, driverId: "d4", status: "Active", insuranceExpiry: "2027-06-19", pucExpiry: "2026-12-18", serviceDue: "2026-10-02", tyreDate: "2025-06-20", batteryDate: "2025-06-20", gps: true, rcCopy: true, insCopy: true },
  { id: "c5", reg: "PB 10 GH 5566", city: "Ludhiana", chassis: "MALBB51RLTM505566", engine: "G4LNCM505566", purchaseDate: "2025-11-05", onRoad: 722000, downPayment: 100000, rate: 9.75, tenure: 5, dailyRent: 1000, driverId: "d5", status: "Service", insuranceExpiry: "2027-11-04", pucExpiry: "2026-11-01", serviceDue: "2026-07-03", tyreDate: "2025-11-05", batteryDate: "2026-06-28", gps: true, rcCopy: true, insCopy: false },
  { id: "c6", reg: "CH 01 JK 3141", city: "Chandigarh", chassis: "MALBB51RLTM603141", engine: "G4LNCM603141", purchaseDate: "2026-02-18", onRoad: 725000, downPayment: 100000, rate: 9.6, tenure: 5, dailyRent: 1100, driverId: null, status: "Idle", insuranceExpiry: "2028-02-17", pucExpiry: "2027-02-17", serviceDue: "2026-08-18", tyreDate: "2026-02-18", batteryDate: "2026-02-18", gps: true, rcCopy: true, insCopy: true },
];

const SEED_DRIVERS = [
  { id: "d1", name: "Gurpreet Singh", mobile: "98140 22xx7", aadhaar: "XXXX XXXX 4821", pan: "AXBPP1234K", dl: "PB10 20190004821", address: "Model Town, Ludhiana", emergency: "Harleen Kaur · 98550 22xx1", policeVerified: true, deposit: 25000, joined: "2024-03-12", dailyRent: 1050, paid: 848000, pending: 0, lateDays: 3, rating: 4.6, complaints: 0, active: true, history: [{ d: "2026-07-01", a: 7350 }, { d: "2026-06-24", a: 7350 }, { d: "2026-06-17", a: 7350 }] },
  { id: "d2", name: "Harjinder Singh", mobile: "97790 88xx2", aadhaar: "XXXX XXXX 7734", pan: "BYCPJ5678L", dl: "PB10 20170007734", address: "Focal Point, Ludhiana", emergency: "Manpreet Singh · 90410 45xx8", policeVerified: true, deposit: 25000, joined: "2024-08-05", dailyRent: 1100, paid: 751300, pending: 2200, lateDays: 9, rating: 4.1, complaints: 1, active: true, history: [{ d: "2026-06-29", a: 6600 }, { d: "2026-06-21", a: 7700 }, { d: "2026-06-14", a: 7700 }] },
  { id: "d3", name: "Manjinder Singh", mobile: "99880 31xx4", aadhaar: "XXXX XXXX 2210", pan: "CZDPS9012M", dl: "CH01 20200002210", address: "Sector 22, Chandigarh", emergency: "Rajwinder Kaur · 98153 77xx0", policeVerified: true, deposit: 30000, joined: "2025-01-18", dailyRent: 1100, paid: 577500, pending: 0, lateDays: 1, rating: 4.8, complaints: 0, active: true, history: [{ d: "2026-07-02", a: 7700 }, { d: "2026-06-25", a: 7700 }, { d: "2026-06-18", a: 7700 }] },
  { id: "d4", name: "Balwinder Singh", mobile: "80540 55xx9", aadhaar: "XXXX XXXX 9902", pan: "DAEPM3456N", dl: "PB65 20180009902", address: "Phase 7, Mohali", emergency: "Simran Kaur · 98140 90xx3", policeVerified: true, deposit: 25000, joined: "2025-06-22", dailyRent: 1150, paid: 429800, pending: 1150, lateDays: 5, rating: 4.3, complaints: 0, active: true, history: [{ d: "2026-06-30", a: 6900 }, { d: "2026-06-23", a: 8050 }] },
  { id: "d5", name: "Sukhwinder Singh", mobile: "91530 12xx6", aadhaar: "XXXX XXXX 5566", pan: "EBFPK7890P", dl: "PB10 20160005566", address: "Dugri, Ludhiana", emergency: "Gagandeep Singh · 95610 34xx2", policeVerified: true, deposit: 20000, joined: "2025-11-08", dailyRent: 1000, paid: 230000, pending: 3000, lateDays: 12, rating: 3.7, complaints: 2, active: true, history: [{ d: "2026-06-26", a: 5000 }, { d: "2026-06-15", a: 7000 }] },
  { id: "d6", name: "Jaspreet Singh", mobile: "98550 67xx1", aadhaar: "XXXX XXXX 3141", pan: "FCGPG2345Q", dl: "PB10 20150003141", address: "Kharar, Mohali", emergency: "Navjot Kaur · 90280 11xx5", policeVerified: true, deposit: 0, joined: "2024-05-01", dailyRent: 1050, paid: 468000, pending: 0, lateDays: 14, rating: 3.9, complaints: 1, active: false, history: [{ d: "2026-01-31", a: 7350 }] },
];

const EXP_CATEGORIES = ["Insurance", "Road Tax", "RC / Registration", "Fitness", "Permit", "FASTag", "GPS / Tracking", "Tyres", "Battery", "Engine Repair", "AC Repair", "Seat Covers", "Scheduled Service", "Oil & Consumables", "Unexpected Repair", "Accident Repair", "Replacement Vehicle", "Office Rent", "Employee Salary", "Internet", "Phone Bills", "Legal Fees", "CA Fees", "Marketing", "Emergency Fund", "Miscellaneous"];

const SEED_EXPENSES = [
  { id: "e1", date: "2026-07-02", carId: "c5", category: "Battery", amount: 6100, note: "Exide 35Ah replacement" },
  { id: "e2", date: "2026-07-01", carId: null, category: "CA Fees", amount: 2000, note: "Monthly retainer" },
  { id: "e3", date: "2026-06-28", carId: "c3", category: "Scheduled Service", amount: 3450, note: "40,000 km service" },
  { id: "e4", date: "2026-06-14", carId: "c2", category: "Tyres", amount: 15800, note: "4 × CEAT Milaze" },
  { id: "e5", date: "2026-06-10", carId: null, category: "GPS / Tracking", amount: 3540, note: "Annual renewal · 6 devices" },
  { id: "e6", date: "2026-06-05", carId: "c1", category: "FASTag", amount: 500, note: "Top-up" },
  { id: "e7", date: "2026-05-30", carId: "c4", category: "Unexpected Repair", amount: 2200, note: "Clutch cable" },
  { id: "e8", date: "2026-05-18", carId: "c1", category: "Insurance", amount: 27500, note: "Comprehensive renewal" },
];

const SEED_CLIENTS = [
  { id: "k1", name: "Focal Point Knitwear Pvt Ltd", type: "Ludhiana factory · night-shift worker drop", billing: 56000, gst: 5, start: "2025-10-01", end: "2026-09-30", cars: 2, timings: "9 PM – 5 AM · Mon–Sat", cost: 39000, invoicePending: true, sla: "Pickup within 10 min of slot · ₹200/miss penalty", penalties: 400 },
  { id: "k2", name: "Silverline Hotel, Chandigarh", type: "Airport transfers · Mohali", billing: 44000, gst: 5, start: "2026-01-15", end: "2027-01-14", cars: 1, timings: "On-call · 24×7 roster", cost: 29000, invoicePending: false, sla: "Sedan, uniformed driver · 30-min standby", penalties: 0 },
];

const SEED_LEADS = [
  { id: "l1", name: "Sunview Multispeciality Hospital, Ludhiana", type: "Hospital", status: "Meeting", next: "2026-07-08", value: 62000, note: "Nurse/staff shuttle, 2 shifts" },
  { id: "l2", name: "DataEdge Solutions, Mohali IT City", type: "IT Company", status: "Quotation", next: "2026-07-05", value: 108000, note: "4 cars, night-shift cab" },
  { id: "l3", name: "Sacred Heart School, Ludhiana", type: "School", status: "New", next: "2026-07-10", value: 46000, note: "Teacher pickup route" },
  { id: "l4", name: "Quark City IT firm, Mohali", type: "IT Company", status: "Negotiation", next: "2026-07-04", value: 84000, note: "Wants 3-car pilot, asking 8% off" },
  { id: "l5", name: "Golden Temple Tours, Amritsar", type: "Travel Agency", status: "Won", next: "", value: 38000, note: "Weekend airport + Amritsar runs" },
  { id: "l6", name: "Steelbird Auto Parts, Ludhiana", type: "Factory", status: "Lost", next: "", value: 52000, note: "Chose in-house buses" },
];
const LEAD_STATUSES = ["New", "Contacted", "Meeting", "Quotation", "Negotiation", "Won", "Lost"];

/* ================= tiny UI atoms ================= */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md ${className}`}>{children}</div>
);
const H = ({ children, sub }) => (
  <div className="mb-3">
    <h2 style={DISP} className="text-lg font-extrabold uppercase tracking-wide text-zinc-900">{children}</h2>
    {sub && <p className="text-xs text-zinc-500">{sub}</p>}
  </div>
);
const Stat = ({ label, value, tone = "zinc", hint }) => {
  const tones = { zinc: "text-zinc-900", green: "text-emerald-700", red: "text-rose-700", amber: "text-amber-600" };
  const bars = { zinc: "bg-zinc-300", green: "bg-emerald-400", red: "bg-rose-400", amber: "bg-amber-400" };
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-200/80 bg-white p-3 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <span className={`absolute left-0 top-0 h-full w-1 ${bars[tone]}`} />
      <div className="pl-1.5">
        <div className="text-xs uppercase tracking-wider text-zinc-500">{label}</div>
        <div style={MONO} className={`mt-1 text-xl font-semibold ${tones[tone]}`}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-zinc-400">{hint}</div>}
      </div>
    </div>
  );
};
const Plate = ({ reg }) => (
  <span style={MONO} className="inline-block whitespace-nowrap rounded border-2 border-zinc-900 bg-amber-400 px-1.5 py-0.5 text-xs font-bold tracking-wider text-zinc-900">
    {reg}
  </span>
);
const Chip = ({ children, tone = "zinc" }) => {
  const m = {
    zinc: "bg-zinc-100 text-zinc-700", green: "bg-emerald-100 text-emerald-800",
    red: "bg-rose-100 text-rose-800", amber: "bg-amber-100 text-amber-800", blue: "bg-sky-100 text-sky-800",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${m[tone]}`}>{children}</span>;
};
const Btn = ({ children, onClick, kind = "dark", className = "", disabled }) => {
  const m = {
    dark: "bg-zinc-900 text-white hover:bg-zinc-700",
    accent: "bg-amber-400 text-zinc-900 hover:bg-amber-300",
    ghost: "border border-zinc-300 text-zinc-700 hover:bg-zinc-100",
  };
  return (
    <button disabled={disabled} onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40 ${m[kind]} ${className}`}>
      {children}
    </button>
  );
};
const Field = ({ label, children }) => (
  <label className="block text-xs font-medium text-zinc-600">
    <span className="mb-1 block uppercase tracking-wide">{label}</span>
    {children}
  </label>
);
const inputCls = "w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-400";
const NumIn = ({ value, onChange, step = 1, min }) => (
  <input type="number" step={step} min={min} value={value} className={inputCls} style={MONO}
    onChange={(e) => onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))} />
);
const TextIn = ({ value, onChange, placeholder }) => (
  <input type="text" value={value} placeholder={placeholder} className={inputCls} onChange={(e) => onChange(e.target.value)} />
);
const DateIn = ({ value, onChange }) => (
  <input type="date" value={value} className={inputCls} onChange={(e) => onChange(e.target.value)} />
);
const Sel = ({ value, onChange, options }) => (
  <select value={value} className={inputCls} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
);
const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
    <div className={`max-h-[88vh] w-full overflow-y-auto rounded-2xl bg-white p-4 shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 style={DISP} className="text-base font-extrabold uppercase tracking-wide text-zinc-900">{title}</h3>
        <button onClick={onClose} className="rounded-full px-2 py-0.5 text-zinc-500 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-amber-400">✕</button>
      </div>
      {children}
    </div>
  </div>
);
const Table = ({ head, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-max text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500">
          {head.map((h, i) => <th key={i} className={`py-2 pr-4 ${i > 0 ? "text-right" : ""}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-zinc-100">
            {r.map((c, j) => (
              <td key={j} style={j > 0 ? MONO : undefined} className={`py-2 pr-4 ${j > 0 ? "text-right" : "font-medium text-zinc-800"}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
const PIE_COLORS = ["#18181b", "#b45309", "#065f46", "#9f1239", "#155e75", "#a16207", "#3f3f46", "#7c2d12", "#4d7c0f", "#6d28d9"];
const tooltipFmt = (v) => inr(v);

/* ================= OVERVIEW ================= */
function Overview({ cars, drivers, stats }) {
  const trend = useMemo(() => {
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 15);
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      let rev = 0, emi = 0, n = 0;
      cars.forEach((c) => {
        if (new Date(c.purchaseDate) <= d) {
          n++;
          rev += c.dailyRent * 29;
          const L = carLoan(c);
          emi += emiCalc(L.principal, c.rate, c.tenure);
        }
      });
      rev *= 0.955;
      out.push({ m: label, Revenue: Math.round(rev), EMI: Math.round(emi), Profit: Math.round(rev - emi - n * perCarOpexMo()) });
    }
    return out;
  }, [cars]);

  const alerts = [];
  cars.forEach((c) => {
    const ins = daysUntil(c.insuranceExpiry);
    if (ins <= 45) alerts.push({ tone: ins <= 10 ? "red" : "amber", text: `Insurance expires in ${ins} d`, car: c.reg });
    const puc = daysUntil(c.pucExpiry);
    if (puc <= 45) alerts.push({ tone: puc <= 10 ? "red" : "amber", text: `PUC expires in ${puc} d`, car: c.reg });
    const sv = daysUntil(c.serviceDue);
    if (sv <= 21) alerts.push({ tone: sv <= 3 ? "red" : "amber", text: sv < 0 ? `Service overdue by ${-sv} d` : `Service due in ${sv} d`, car: c.reg });
  });
  drivers.filter((d) => d.active && d.pending > 0).forEach((d) =>
    alerts.push({ tone: d.pending > 2000 ? "red" : "amber", text: `${inr(d.pending)} rent pending · ${d.name}`, car: null })
  );
  if (NOW.getDate() <= 5) alerts.push({ tone: "blue", text: `EMI of ${inr(stats.emiMo)} due by 5th`, car: null });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total cars" value={stats.total} />
        <Stat label="Active on rent" value={stats.active} tone="green" />
        <Stat label="In service / idle" value={`${stats.service} / ${stats.idle}`} tone="amber" />
        <Stat label="Monthly revenue" value={inrS(stats.revenueMo)} tone="green" />
        <Stat label="Monthly EMI" value={inrS(stats.emiMo)} />
        <Stat label="Monthly profit" value={inrS(stats.profitMo)} tone={stats.profitMo >= 0 ? "green" : "red"} hint="after EMI + provisions" />
        <Stat label="Pending payments" value={inr(stats.pending)} tone={stats.pending > 0 ? "red" : "green"} />
        <Stat label="Loan outstanding" value={inrS(stats.loanOut)} />
        <Stat label="Fleet market value" value={inrS(stats.fleetValue)} />
        <Stat label="Total depreciation" value={inrS(stats.depreciation)} tone="red" hint="vs on-road price" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <H sub="Last 12 months · fleet revenue vs EMI vs net">Revenue & profit trend</H>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 4, right: 8, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={tooltipFmt} />
                <Legend />
                <Line type="monotone" dataKey="Revenue" stroke="#065f46" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="EMI" stroke="#71717a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Profit" stroke="#b45309" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <H sub={`${alerts.length} item${alerts.length === 1 ? "" : "s"} need attention`}>Notifications</H>
          <div className="space-y-2">
            {alerts.length === 0 && <p className="text-sm text-zinc-500">All clear. Nothing due in the next 45 days.</p>}
            {alerts.map((a, i) => (
              <div key={i} className="flex items-start justify-between gap-2 rounded-lg bg-zinc-50 p-2">
                <div className="text-sm text-zinc-800">{a.text}</div>
                {a.car ? <Plate reg={a.car.split(" ").slice(-2).join(" ")} /> : <Chip tone={a.tone}>due</Chip>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <H sub="Business intelligence · computed live from the ledger">Fleet KPIs</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Avg revenue / car" value={inr(stats.avgRevCar)} hint="per month, active cars" />
          <Stat label="Avg profit / car" value={inr(stats.avgProfitCar)} tone="green" />
          <Stat label="Utilization" value={`${Math.round(stats.utilization * 100)}%`} tone={stats.utilization >= 0.8 ? "green" : "amber"} />
          <Stat label="Collection default" value={`${(stats.defaultRate * 100).toFixed(1)}%`} tone={stats.defaultRate > 0.03 ? "red" : "green"} hint="pending vs monthly billing" />
          <Stat label="Maintenance %" value={`${(stats.maintPct * 100).toFixed(1)}%`} hint="provisions vs revenue" />
          <Stat label="ROI on capital" value={`${(stats.roi * 100).toFixed(1)}%`} tone="green" hint="annual profit / down payments" />
          <Stat label="Break-even / car" value={`${stats.breakEvenMo} mo`} hint="down payment recovery" />
          <Stat label="ITC claimed on fleet" value={inrS(stats.itcFleet)} tone="green" hint="~18% GST credit on cars" />
        </div>
      </Card>
    </div>
  );
}

/* ================= FLEET ================= */
function Fleet({ cars, setCars, drivers }) {
  const [open, setOpen] = useState(null);
  const [add, setAdd] = useState(false);
  const blank = { reg: "", onRoad: 715000, downPayment: 100000, rate: 9.5, tenure: 5, dailyRent: 1150, purchaseDate: NOW.toISOString().slice(0, 10) };
  const [f, setF] = useState(blank);
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "—";

  const saveCar = () => {
    if (!f.reg.trim()) return;
    const y = new Date(f.purchaseDate); const plus = (n) => { const d = new Date(y); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10); };
    setCars([{ ...f, id: "c" + Date.now(), chassis: "—", engine: "—", driverId: null, status: "Idle", insuranceExpiry: plus(1), pucExpiry: plus(1), serviceDue: plus(1), tyreDate: f.purchaseDate, batteryDate: f.purchaseDate, gps: true, rcCopy: false, insCopy: false }, ...cars]);
    setF(blank); setAdd(false);
  };
  const toggleStatus = (c) => setCars(cars.map((x) => x.id === c.id ? { ...x, status: x.status === "Service" ? (x.driverId ? "Active" : "Idle") : "Service" } : x));
  const assign = (c, driverId) => setCars(cars.map((x) => x.id === c.id ? { ...x, driverId: driverId || null, status: driverId ? (x.status === "Service" ? "Service" : "Active") : "Idle" } : x));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <H sub="Every vehicle, its loan and its papers">Fleet register</H>
        <Btn kind="accent" onClick={() => setAdd(true)}>+ Add car</Btn>
      </div>
      {cars.map((c) => {
        const L = carLoan(c), mv = carValue(c), expanded = open === c.id;
        const tone = c.status === "Active" ? "green" : c.status === "Service" ? "amber" : "zinc";
        return (
          <Card key={c.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Plate reg={c.reg} />
                <Chip tone={tone}>{c.status}</Chip>
                {c.city && <Chip tone="zinc">{c.city}</Chip>}
                {c.gps && <Chip tone="blue">GPS</Chip>}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Daily rent</div>
                  <div style={MONO} className="text-sm font-semibold text-emerald-700">{inr(c.dailyRent)}</div>
                </div>
                <Btn kind="ghost" onClick={() => setOpen(expanded ? null : c.id)}>{expanded ? "Hide" : "Details"}</Btn>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><span className="text-zinc-500">Driver: </span>{driverName(c.driverId)}</div>
              <div><span className="text-zinc-500">EMI: </span><span style={MONO}>{inr(L.emi)}</span></div>
              <div><span className="text-zinc-500">Loan left: </span><span style={MONO}>{inrS(L.remaining)}</span></div>
              <div><span className="text-zinc-500">Value now: </span><span style={MONO}>{inrS(mv)}</span></div>
            </div>
            {expanded && (
              <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  <div><span className="text-zinc-500">Chassis:</span> <span style={MONO} className="text-xs">{c.chassis}</span></div>
                  <div><span className="text-zinc-500">Engine:</span> <span style={MONO} className="text-xs">{c.engine}</span></div>
                  <div><span className="text-zinc-500">Purchased:</span> {fmtD(c.purchaseDate)}</div>
                  <div><span className="text-zinc-500">On-road:</span> <span style={MONO}>{inr(c.onRoad)}</span></div>
                  <div><span className="text-zinc-500">Down payment:</span> <span style={MONO}>{inr(c.downPayment)}</span></div>
                  <div><span className="text-zinc-500">Loan:</span> <span style={MONO}>{inr(L.principal)} @ {c.rate}% · {c.tenure} yr</span></div>
                  <div><span className="text-zinc-500">Months left:</span> {L.monthsLeft}</div>
                  <div><span className="text-zinc-500">Insurance:</span> {fmtD(c.insuranceExpiry)}</div>
                  <div><span className="text-zinc-500">PUC:</span> {fmtD(c.pucExpiry)}</div>
                  <div><span className="text-zinc-500">Service due:</span> {fmtD(c.serviceDue)}</div>
                  <div><span className="text-zinc-500">Tyres:</span> {fmtD(c.tyreDate)}</div>
                  <div><span className="text-zinc-500">Battery:</span> {fmtD(c.batteryDate)}</div>
                  <div><span className="text-zinc-500">RC copy:</span> {c.rcCopy ? "on file" : <span className="text-rose-700">missing</span>}</div>
                  <div><span className="text-zinc-500">Insurance copy:</span> {c.insCopy ? "on file" : <span className="text-rose-700">missing</span>}</div>
                  <div><span className="text-zinc-500">Depreciation:</span> <span style={MONO} className="text-rose-700">{inrS(c.onRoad - mv)}</span></div>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="w-44">
                    <Field label="Assign driver">
                      <select className={inputCls} value={c.driverId || ""} onChange={(e) => assign(c, e.target.value)}>
                        <option value="">— none —</option>
                        {drivers.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </Field>
                  </div>
                  <Btn kind="ghost" onClick={() => toggleStatus(c)}>{c.status === "Service" ? "Back from service" : "Send to service"}</Btn>
                </div>
              </div>
            )}
          </Card>
        );
      })}
      {add && (
        <Modal title="Add car" onClose={() => setAdd(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Registration number"><TextIn value={f.reg} onChange={(v) => setF({ ...f, reg: v.toUpperCase() })} placeholder="MH 12 AB 1234" /></Field></div>
            <Field label="On-road price"><NumIn value={f.onRoad} step={1000} onChange={(v) => setF({ ...f, onRoad: v })} /></Field>
            <Field label="Down payment"><NumIn value={f.downPayment} step={5000} onChange={(v) => setF({ ...f, downPayment: v })} /></Field>
            <Field label="Interest % p.a."><NumIn value={f.rate} step={0.1} onChange={(v) => setF({ ...f, rate: v })} /></Field>
            <Field label="Tenure (years)"><Sel value={String(f.tenure)} onChange={(v) => setF({ ...f, tenure: +v })} options={["3", "4", "5", "6", "7"]} /></Field>
            <Field label="Daily rent"><NumIn value={f.dailyRent} step={50} onChange={(v) => setF({ ...f, dailyRent: v })} /></Field>
            <Field label="Purchase date"><DateIn value={f.purchaseDate} onChange={(v) => setF({ ...f, purchaseDate: v })} /></Field>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-50 p-2 text-sm">
            <span className="text-zinc-500">EMI comes to</span>
            <span style={MONO} className="font-semibold">{inr(emiCalc(f.onRoad - f.downPayment, f.rate, f.tenure))}/mo</span>
          </div>
          <div className="mt-3 flex justify-end gap-2"><Btn kind="ghost" onClick={() => setAdd(false)}>Cancel</Btn><Btn kind="accent" onClick={saveCar}>Save car</Btn></div>
        </Modal>
      )}
    </div>
  );
}

/* ================= DRIVERS ================= */
function agreementText(d, car) {
  const reg = car ? car.reg : "____________";
  return `DAILY RENTAL AGREEMENT

This agreement is made on ${fmtD(NOW.toISOString())} between the Owner (First Party) and ${d.name}, holder of DL ${d.dl}, residing at ${d.address} (Second Party / Driver).

1. VEHICLE. The Owner hands over Hyundai Aura CNG bearing registration ${reg} in roadworthy condition, with valid insurance, registration and permit.
2. RENT. The Driver shall pay a fixed daily rent of ${inr(d.dailyRent)} by UPI/cash before 9:00 PM each day, for every day the vehicle remains in his custody, irrespective of earnings.
3. DEPOSIT. A refundable security deposit of ${inr(d.deposit)} is held by the Owner and is adjustable against unpaid rent, challans or damage.
4. OWNER PROVIDES: insurance, registration, permit and scheduled servicing.
5. DRIVER BEARS: CNG/fuel, daily cleaning, parking, challans/fines caused by him, and minor daily running expenses.
6. GPS. The vehicle carries a GPS device which shall not be tampered with. Removal is grounds for immediate termination and deposit forfeiture.
7. DEFAULT. Rent unpaid for 7 consecutive days, or misuse of the vehicle, entitles the Owner to repossess the vehicle without notice.
8. TERMINATION. Either party may terminate with 15 days written notice. Deposit is refunded within 7 days of vehicle return, after inspection and dues.
9. JURISDICTION. Courts at the Owner's registered city shall have exclusive jurisdiction.

Owner: ____________________        Driver: ____________________
Witness 1: _________________       Witness 2: _________________`;
}
function receiptText(d, car, amount) {
  return `RENT RECEIPT · ${fmtD(NOW.toISOString())}

Received with thanks from ${d.name} (DL ${d.dl})
the sum of ${inr(amount)} towards daily vehicle rent
for vehicle ${car ? car.reg : "—"} at ${inr(d.dailyRent)}/day.

Balance pending after this payment: ${inr(Math.max(0, d.pending - amount))}

Received by: ____________________ (Owner / Authorised signatory)`;
}

function Drivers({ drivers, setDrivers, cars }) {
  const [add, setAdd] = useState(false);
  const [doc, setDoc] = useState(null);
  const [pay, setPay] = useState(null);
  const [payAmt, setPayAmt] = useState(0);
  const blank = { name: "", mobile: "", dailyRent: 1150, deposit: 25000, dl: "", address: "" };
  const [f, setF] = useState(blank);
  const carOf = (d) => cars.find((c) => c.driverId === d.id);

  const save = () => {
    if (!f.name.trim()) return;
    setDrivers([{ ...f, id: "d" + Date.now(), aadhaar: "XXXX XXXX —", pan: "—", emergency: "—", policeVerified: false, joined: NOW.toISOString().slice(0, 10), paid: 0, pending: 0, lateDays: 0, rating: 5, complaints: 0, active: true, history: [] }, ...drivers]);
    setF(blank); setAdd(false);
  };
  const recordPay = () => {
    setDrivers(drivers.map((d) => d.id === pay.id ? { ...d, pending: Math.max(0, d.pending - payAmt), paid: d.paid + payAmt, history: [{ d: NOW.toISOString().slice(0, 10), a: payAmt }, ...d.history] } : d));
    setPay(null);
  };
  const copyDoc = async (t) => { try { await navigator.clipboard.writeText(t); } catch (e) { /* noop */ } };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <H sub="KYC, deposits, rent ledger and paperwork">Drivers</H>
        <Btn kind="accent" onClick={() => setAdd(true)}>+ Add driver</Btn>
      </div>
      {drivers.map((d) => {
        const car = carOf(d);
        const days = Math.round(monthsSince(d.joined) * 30.44);
        return (
          <Card key={d.id} className={d.active ? "" : "opacity-60"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span style={DISP} className="font-bold text-zinc-900">{d.name}</span>
                  <Chip tone={d.active ? "green" : "zinc"}>{d.active ? "Active" : "Inactive"}</Chip>
                  {d.policeVerified && <Chip tone="blue">Police verified</Chip>}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">{d.mobile} · DL {d.dl} · joined {fmtD(d.joined)}</div>
              </div>
              {car ? <Plate reg={car.reg} /> : <Chip tone="amber">No car</Chip>}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><span className="text-zinc-500">Daily rent: </span><span style={MONO}>{inr(d.dailyRent)}</span></div>
              <div><span className="text-zinc-500">Deposit: </span><span style={MONO}>{inr(d.deposit)}</span></div>
              <div><span className="text-zinc-500">Days worked: </span><span style={MONO}>{days}</span></div>
              <div><span className="text-zinc-500">Rent paid: </span><span style={MONO}>{inrS(d.paid)}</span></div>
              <div><span className="text-zinc-500">Pending: </span><span style={MONO} className={d.pending > 0 ? "font-semibold text-rose-700" : "text-emerald-700"}>{inr(d.pending)}</span></div>
              <div><span className="text-zinc-500">Late days: </span><span style={MONO}>{d.lateDays}</span></div>
              <div><span className="text-zinc-500">Rating: </span><span style={MONO}>{d.rating.toFixed(1)} ★</span></div>
              <div><span className="text-zinc-500">Complaints: </span><span style={MONO}>{d.complaints}</span></div>
            </div>
            {d.history.length > 0 && (
              <div className="mt-2 text-xs text-zinc-500">
                Last payments:{" "}
                {d.history.slice(0, 3).map((h, i) => (
                  <span key={i} style={MONO} className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">{fmtD(h.d)} · {inr(h.a)}</span>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn kind="dark" onClick={() => { setPay(d); setPayAmt(d.pending || d.dailyRent * 7); }}>Record payment</Btn>
              <Btn kind="ghost" onClick={() => setDoc({ title: "Rental agreement", text: agreementText(d, car) })}>Agreement</Btn>
              <Btn kind="ghost" onClick={() => setDoc({ title: "Rent receipt", text: receiptText(d, car, d.history[0]?.a || d.dailyRent * 7) })}>Receipt</Btn>
              <Btn kind="ghost" onClick={() => setDrivers(drivers.map((x) => x.id === d.id ? { ...x, active: !x.active } : x))}>{d.active ? "Mark inactive" : "Reactivate"}</Btn>
            </div>
          </Card>
        );
      })}

      {add && (
        <Modal title="Add driver" onClose={() => setAdd(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Full name"><TextIn value={f.name} onChange={(v) => setF({ ...f, name: v })} /></Field></div>
            <Field label="Mobile"><TextIn value={f.mobile} onChange={(v) => setF({ ...f, mobile: v })} /></Field>
            <Field label="Driving licence"><TextIn value={f.dl} onChange={(v) => setF({ ...f, dl: v })} /></Field>
            <Field label="Daily rent"><NumIn value={f.dailyRent} step={50} onChange={(v) => setF({ ...f, dailyRent: v })} /></Field>
            <Field label="Security deposit"><NumIn value={f.deposit} step={1000} onChange={(v) => setF({ ...f, deposit: v })} /></Field>
            <div className="col-span-2"><Field label="Address"><TextIn value={f.address} onChange={(v) => setF({ ...f, address: v })} /></Field></div>
          </div>
          <div className="mt-3 flex justify-end gap-2"><Btn kind="ghost" onClick={() => setAdd(false)}>Cancel</Btn><Btn kind="accent" onClick={save}>Save driver</Btn></div>
        </Modal>
      )}
      {pay && (
        <Modal title={`Record payment · ${pay.name}`} onClose={() => setPay(null)}>
          <Field label="Amount received"><NumIn value={payAmt} step={50} onChange={setPayAmt} /></Field>
          <p className="mt-2 text-xs text-zinc-500">Pending before this payment: <span style={MONO}>{inr(pay.pending)}</span></p>
          <div className="mt-3 flex justify-end gap-2"><Btn kind="ghost" onClick={() => setPay(null)}>Cancel</Btn><Btn kind="accent" onClick={recordPay}>Save & issue receipt</Btn></div>
        </Modal>
      )}
      {doc && (
        <Modal title={doc.title} onClose={() => setDoc(null)} wide>
          <pre style={MONO} className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800">{doc.text}</pre>
          <div className="mt-3 flex justify-end gap-2"><Btn kind="ghost" onClick={() => setDoc(null)}>Close</Btn><Btn kind="accent" onClick={() => copyDoc(doc.text)}>Copy text</Btn></div>
        </Modal>
      )}
    </div>
  );
}

/* ================= CALCULATORS ================= */
function EmiTab() {
  const [p, setP] = useState(710000), [dp, setDp] = useState(100000), [r, setR] = useState(9.5), [t, setT] = useState(5);
  const [preAmt, setPreAmt] = useState(100000), [preAt, setPreAt] = useState(24);
  const P = Math.max(0, p - dp), e = emiCalc(P, r, t), n = t * 12;
  const totalPay = e * n, totalInt = totalPay - P;

  const withPrepay = useMemo(() => {
    const mr = r / 1200;
    let bal = P, months = 0, interest = 0;
    while (bal > 1 && months < 600) {
      months++;
      const int = bal * mr;
      interest += int;
      bal = bal + int - e;
      if (months === preAt) bal = Math.max(0, bal - preAmt);
    }
    return { months, interest, saved: totalInt - interest, cut: n - months };
  }, [P, r, e, n, totalInt, preAmt, preAt]);

  const amort = useMemo(() => {
    const out = [];
    for (let m = 0; m <= n; m += 3) out.push({ m, Balance: Math.round(balanceAt(P, r, t, m)) });
    return out;
  }, [P, r, t, n]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Car price (on-road)"><NumIn value={p} step={5000} onChange={setP} /></Field>
          <Field label="Down payment"><NumIn value={dp} step={5000} onChange={setDp} /></Field>
          <Field label="Interest % p.a."><NumIn value={r} step={0.1} onChange={setR} /></Field>
          <Field label="Tenure (yrs)"><Sel value={String(t)} onChange={(v) => setT(+v)} options={["3", "4", "5", "6", "7"]} /></Field>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Monthly EMI" value={inr(e)} tone="amber" />
        <Stat label="Loan amount" value={inrS(P)} />
        <Stat label="Total interest" value={inrS(totalInt)} tone="red" />
        <Stat label="Total payment" value={inrS(totalPay)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <H sub="Outstanding principal over the tenure">Loan balance</H>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={amort} margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} label={{ value: "month", position: "insideBottomRight", offset: -2, fontSize: 10 }} />
                <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={tooltipFmt} />
                <Line type="monotone" dataKey="Balance" stroke="#18181b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <H sub="Lump-sum prepayment, same EMI continues">Prepayment benefit</H>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prepay amount"><NumIn value={preAmt} step={10000} onChange={setPreAmt} /></Field>
            <Field label="After month #"><NumIn value={preAt} step={1} min={1} onChange={setPreAt} /></Field>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between rounded-lg bg-emerald-50 p-2"><span>Interest saved</span><span style={MONO} className="font-semibold text-emerald-700">{inr(withPrepay.saved)}</span></div>
            <div className="flex justify-between rounded-lg bg-zinc-50 p-2"><span>Tenure cut by</span><span style={MONO} className="font-semibold">{withPrepay.cut} months</span></div>
            <div className="flex justify-between rounded-lg bg-zinc-50 p-2"><span>Loan closes in</span><span style={MONO} className="font-semibold">{withPrepay.months} months</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function simDerive(s) {
  const P = s.price - s.dp;
  const e = emiCalc(P, s.rate, s.tenure);
  const revMo = s.rent * s.days;
  const carOpexMo = s.insurance / 12 + s.service / 12 + s.tyres / (36) + s.battery / (36) + s.misc + s.parking + s.annualMaint / 12;
  const fleetFixedMo = s.accountant + s.office;
  const profitMo1 = revMo - e - carOpexMo; // per car, before fleet fixed costs
  return { P, e, revMo, carOpexMo, fleetFixedMo, profitMo1 };
}

function SimulatorTab({ sim, setSim }) {
  const d = simDerive(sim);
  const N = sim.cars;
  const isCo = sim.mode === "company";

  /* ---- GST / ITC engine ---- */
  const g = useMemo(() => {
    const revYr = d.revMo * 12 * N;
    const inputExpYr = d.carOpexMo * 12 * N + d.fleetFixedMo * 12; // taxable input services
    const outputGstYr = isCo ? revYr * sim.outputGstPct / 100 : 0;   // owner absorbs 18% on dry-lease rent
    const inputItcYr = isCo ? inputExpYr * sim.inputItcPct / 100 : 0; // recurring credit on inputs
    const itcPool = isCo && sim.claimItc ? sim.itcPerCar * N : 0;     // one-time credit on car purchase
    const netGstYr = Math.max(0, outputGstYr - inputItcYr);          // steady-state cash to govt
    const poolMonths = netGstYr > 0 ? Math.round(itcPool / (netGstYr / 12)) : 0;
    return { revYr, outputGstYr, inputItcYr, itcPool, netGstYr, poolMonths };
  }, [d, N, isCo, sim]);

  /* ---- yearly P&L with WDV depreciation + corporate tax ---- */
  const yearly = useMemo(() => {
    const out = [];
    const depBase = (sim.price - (isCo && sim.claimItc ? sim.itcPerCar : 0)) * N; // ex-ITC block for tax dep
    let wdv = depBase;
    let cum = -(sim.dp + sim.processing) * N + (isCo && sim.claimItc ? sim.itcPerCar * N : 0); // ITC realised upfront
    let poolLeft = g.itcPool;
    for (let y = 1; y <= Math.max(7, sim.tenure); y++) {
      const rev = d.revMo * 12 * N;
      const opex = d.carOpexMo * 12 * N + d.fleetFixedMo * 12;
      const emiYr = y <= sim.tenure ? d.e * 12 * N : 0;
      const openBal = balanceAt(d.P, sim.rate, sim.tenure, (y - 1) * 12) * N;
      const closeBal = balanceAt(d.P, sim.rate, sim.tenure, y * 12) * N;
      const interest = Math.max(0, emiYr - (openBal - closeBal));
      const dep = wdv * sim.wdvRate / 100; wdv -= dep;
      // GST cash this year: net output GST, drawn against the one-time pool first
      const grossGst = g.netGstYr;
      const fromPool = Math.min(poolLeft, grossGst); poolLeft -= fromPool;
      const gstCash = grossGst - fromPool;
      const pbt = rev - opex - interest - dep - g.netGstYr; // book profit (GST is a real cost here)
      const tax = isCo ? Math.max(0, pbt) * sim.corpTaxPct / 100 : 0;
      const cash = rev - opex - emiYr - gstCash - tax; // post-tax operating cash
      cum += cash;
      out.push({
        y: `Y${y}`, Revenue: Math.round(rev), PBT: Math.round(pbt), Dep: Math.round(dep),
        Tax: Math.round(tax), Cash: Math.round(cash), "Cumulative cash": Math.round(cum),
        "Loan remaining": Math.round(closeBal), "Asset value": Math.round(sim.price * resaleFrac(y) * N),
      });
    }
    return out;
  }, [sim, d, N, isCo, g]);

  /* steady-state monthly = year 2 (avoids the one-time ITC distortion) */
  const steady = yearly[1] || yearly[0];
  const monthlyRev = d.revMo * N;
  const monthlyEmi = d.e * N;
  const monthlyOpex = d.carOpexMo * N + d.fleetFixedMo;
  const monthlyPostTax = steady.Cash / 12;

  const F = ({ k, label, step = 500 }) => (
    <Field label={label}><NumIn value={sim[k]} step={step} onChange={(v) => setSim({ ...sim, [k]: v })} /></Field>
  );
  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <H sub="Every figure is editable — defaults are realistic Indian assumptions">Assumptions</H>
          <div className="inline-flex rounded-lg border border-zinc-300 p-0.5">
            {[["company", "Company · GST + ITC + tax"], ["personal", "No GST · pre-tax"]].map(([k, l]) => (
              <button key={k} onClick={() => setSim({ ...sim, mode: k })}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 ${sim.mode === k ? "bg-zinc-900 text-amber-300" : "text-zinc-600"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <F k="cars" label="Number of cars" step={1} />
          <F k="price" label="On-road price" step={5000} />
          <F k="dp" label="Down payment / car" step={5000} />
          <Field label="Interest % p.a."><NumIn value={sim.rate} step={0.1} onChange={(v) => setSim({ ...sim, rate: v })} /></Field>
          <Field label="Tenure (yrs)"><Sel value={String(sim.tenure)} onChange={(v) => setSim({ ...sim, tenure: +v })} options={["3", "4", "5", "6", "7"]} /></Field>
          <F k="rent" label="Daily rent" step={50} />
          <F k="days" label="Rent days / month" step={1} />
          <F k="insurance" label="Insurance / yr / car" step={1000} />
          <F k="service" label="Service / yr / car" step={1000} />
          <F k="tyres" label="Tyres (every 3 yr)" step={1000} />
          <F k="battery" label="Battery (every 3 yr)" step={500} />
          <F k="annualMaint" label="Other maint. / yr" step={1000} />
          <F k="misc" label="Misc / mo / car" step={100} />
          <F k="parking" label="Parking / mo / car" step={100} />
          <F k="accountant" label="Accountant / mo" step={500} />
          <F k="office" label="Office / mo" step={500} />
          <F k="processing" label="Loan processing / car" step={500} />
        </div>
        {isCo && (
          <div className="mt-3 rounded-lg bg-zinc-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span style={DISP} className="text-xs font-bold uppercase tracking-wide text-zinc-700">GST & company tax</span>
              <label className="flex items-center gap-1.5 text-xs text-zinc-600">
                <input type="checkbox" checked={sim.claimItc} onChange={(e) => setSim({ ...sim, claimItc: e.target.checked })} className="accent-amber-500" />
                Claim ITC on car purchase
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Output GST on rent %"><NumIn value={sim.outputGstPct} step={1} onChange={(v) => setSim({ ...sim, outputGstPct: v })} /></Field>
              <Field label="ITC / car (one-time)"><NumIn value={sim.itcPerCar} step={1000} onChange={(v) => setSim({ ...sim, itcPerCar: v })} /></Field>
              <Field label="Input ITC on expenses %"><NumIn value={sim.inputItcPct} step={1} onChange={(v) => setSim({ ...sim, inputItcPct: v })} /></Field>
              <Field label="Corporate tax %"><NumIn value={sim.corpTaxPct} step={0.01} onChange={(v) => setSim({ ...sim, corpTaxPct: v })} /></Field>
              <Field label="WDV depreciation %"><NumIn value={sim.wdvRate} step={1} onChange={(v) => setSim({ ...sim, wdvRate: v })} /></Field>
            </div>
          </div>
        )}
      </Card>

      {isCo && (
        <Card>
          <H sub="Driver dry-lease — you absorb 18% output GST; ITC offsets it">GST & ITC position</H>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Output GST / mo" value={inrS(g.outputGstYr / 12)} tone="red" hint={`${sim.outputGstPct}% on rent`} />
            <Stat label="Input ITC / mo" value={inrS(g.inputItcYr / 12)} tone="green" hint="on insurance, service, etc." />
            <Stat label="Net GST / mo" value={inrS(g.netGstYr / 12)} tone={g.netGstYr > 0 ? "amber" : "green"} hint="steady state to govt" />
            <Stat label="One-time ITC" value={inrS(g.itcPool)} tone="green" hint={`covers first ~${g.poolMonths} mo of GST`} />
          </div>
          <p className="mt-2 text-xs text-zinc-400">The ₹{Math.round(sim.itcPerCar / 1000)}k/car purchase credit is realised upfront and wipes out your net GST for roughly {g.poolMonths} months. After that, GST costs ~{inrS(g.netGstYr / 12)}/mo.</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Monthly revenue" value={inrS(monthlyRev)} tone="green" />
        <Stat label="Monthly EMI" value={inrS(monthlyEmi)} />
        <Stat label="Monthly opex" value={inrS(monthlyOpex)} />
        <Stat label={isCo ? "Post-tax profit / mo" : "Pre-tax profit / mo"} value={inrS(monthlyPostTax)} tone={monthlyPostTax >= 0 ? "green" : "red"} hint={isCo ? "after GST + 25% tax" : "before tax"} />
        <Stat label="Profit / car / day" value={inr(N ? monthlyPostTax / N / sim.days : 0)} tone="amber" hint="target ₹1,100–1,200 rent" />
      </div>

      <Card>
        <H sub={`${N} car${N === 1 ? "" : "s"} · ${isCo ? "post-tax, WDV depreciation, GST netted" : "pre-tax"} · year-wise`}>Yearly projection</H>
        <Table
          head={isCo
            ? ["Year", "Revenue", "Book PBT", "Depreciation", "Corp tax", "Post-tax cash", "Cum. cash", "Loan left"]
            : ["Year", "Revenue", "Book PBT", "Depreciation", "—", "Net cash", "Cum. cash", "Loan left"]}
          rows={yearly.map((r) => [
            r.y, inrS(r.Revenue),
            <span key="pbt" className={r.PBT >= 0 ? "text-zinc-800" : "text-rose-700"}>{inrS(r.PBT)}</span>,
            inrS(r.Dep),
            isCo ? inrS(r.Tax) : "—",
            <span key="cash" className={r.Cash >= 0 ? "text-emerald-700" : "text-rose-700"}>{inrS(r.Cash)}</span>,
            <span key="cum" className={r["Cumulative cash"] >= 0 ? "text-emerald-700" : "text-rose-700"}>{inrS(r["Cumulative cash"])}</span>,
            inrS(r["Loan remaining"]),
          ])}
        />
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={yearly} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="y" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Line type="monotone" dataKey="Cumulative cash" name="Cumulative cash" stroke="#065f46" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Cash" name={isCo ? "Post-tax cash" : "Net cash"} stroke="#b45309" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Loan remaining" name="Loan remaining" stroke="#9f1239" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Post-tax cash = revenue − opex − full EMI − net GST − corporate tax. Year 1 includes the one-time purchase ITC as a cash inflow. Depreciation is a non-cash tax shield (30% WDV on ex-ITC cost). Estimates only — confirm structuring with your CA.</p>
      </Card>
    </div>
  );
}

function DepTab() {
  const [price, setPrice] = useState(715000);
  const [slmYears, setSlmYears] = useState(8);
  const [wdvRate, setWdvRate] = useState(20);
  const [residual, setResidual] = useState(10);
  const rows = useMemo(() => {
    const out = [];
    for (let y = 0; y <= 7; y++) {
      const slm = Math.max(price * residual / 100, price - (price * (1 - residual / 100) / slmYears) * y);
      const wdv = price * Math.pow(1 - wdvRate / 100, y);
      const mkt = price * resaleFrac(y);
      out.push({ y, SLM: Math.round(slm), WDV: Math.round(wdv), Market: Math.round(mkt) });
    }
    return out;
  }, [price, slmYears, wdvRate, residual]);
  return (
    <div className="space-y-4">
      <Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Purchase price"><NumIn value={price} step={5000} onChange={setPrice} /></Field>
          <Field label="SLM life (yrs)"><NumIn value={slmYears} step={1} onChange={setSlmYears} /></Field>
          <Field label="WDV rate % / yr"><NumIn value={wdvRate} step={1} onChange={setWdvRate} /></Field>
          <Field label="Residual % (SLM)"><NumIn value={residual} step={1} onChange={setResidual} /></Field>
        </div>
      </Card>
      <Card>
        <H sub="Book value under SLM & WDV vs realistic Indian used-market resale (CNG sedan)">Depreciation · 3 methods</H>
        <Table
          head={["End of year", "Straight line", "WDV", "Market resale", "Total dep. (mkt)", "Sold vs loan*"]}
          rows={rows.filter((r) => r.y > 0).map((r) => {
            const loanLeft = balanceAt(price - 100000, 9.5, 5, r.y * 12);
            const net = r.Market - loanLeft;
            return [`Year ${r.y}`, inrS(r.SLM), inrS(r.WDV), inrS(r.Market), <span key="d" className="text-rose-700">{inrS(price - r.Market)}</span>, <span key="n" className={net >= 0 ? "text-emerald-700" : "text-rose-700"}>{inrS(net)}</span>];
          })}
        />
        <p className="mt-2 text-xs text-zinc-400">*Sale proceeds minus loan outstanding, assuming ₹1L down @ 9.5% for 5 yrs. Rental income earned meanwhile is separate (see Simulator).</p>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="y" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Line type="monotone" dataKey="SLM" stroke="#71717a" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="WDV" stroke="#155e75" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Market" stroke="#b45309" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function ScaleTab({ sim }) {
  const d = simDerive(sim);
  const sizes = [1, 5, 10, 20, 50, 100];
  const rows = sizes.map((N) => {
    const rev = d.revMo * N;
    const emi = d.e * N;
    const maint = (sim.service / 12 + sim.tyres / 36 + sim.battery / 36 + sim.annualMaint / 12 + sim.misc) * N;
    const ins = sim.insurance / 12 * N;
    const dep = sim.price * (1 - resaleFrac(5)) / 60 * N;
    const fixed = d.fleetFixedMo * (N >= 20 ? 2 : 1);
    const intMo = (d.e * sim.tenure * 12 - d.P) / (sim.tenure * 12);
    const taxable = Math.max(0, rev - maint - ins - dep - fixed - intMo * N);
    const tax = taxable * 0.25;
    const net = rev - emi - maint - ins - fixed - tax;
    const capital = (sim.dp + sim.processing) * N;
    const roi = capital > 0 ? (net * 12) / capital : 0;
    const payback = net > 0 ? Math.ceil(capital / net) : Infinity;
    return { N, rev, emi, maint, ins, dep, tax, net, roi, payback, cash: net };
  });
  return (
    <Card>
      <H sub="Same assumptions as the simulator · tax est. @ 25% on book profit · admin doubles beyond 20 cars">Profit at scale</H>
      <Table
        head={["Cars", "Revenue/mo", "EMI/mo", "Maint./mo", "Insurance/mo", "Depreciation/mo", "Tax (est)/mo", "Net profit/mo", "ROI p.a.", "Payback"]}
        rows={rows.map((r) => [
          <span key="n" style={MONO} className="font-bold">{r.N}</span>,
          inrS(r.rev), inrS(r.emi), inrS(r.maint), inrS(r.ins), inrS(r.dep), inrS(r.tax),
          <span key="p" className={r.net >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{inrS(r.net)}</span>,
          `${(r.roi * 100).toFixed(0)}%`,
          r.payback === Infinity ? "—" : `${r.payback} mo`,
        ])}
      />
      <div className="mt-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows.map((r) => ({ n: `${r.N} cars`, "Net profit / mo": Math.round(r.net) }))} margin={{ left: 4, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
            <XAxis dataKey="n" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={56} />
            <Tooltip formatter={tooltipFmt} />
            <Bar dataKey="Net profit / mo" fill="#065f46" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* city CNG (₹/kg) — Ludhiana & Mohali from mid-2026 market data; others editable */
const CITY_CNG = { Ludhiana: 84.25, "Mohali / tricity": 97.5, Chandigarh: 90, Amritsar: 87.58, "Other Punjab": 88 };
/* tenure discount — longer commitment, lower daily rent (new car) */
const TERM_RENT = { "Monthly": 1100, "3-month": 1000, "12-month": 900 };

function RentGuideTab({ sim }) {
  const [city, setCity] = useState("Ludhiana");
  const [term, setTerm] = useState("12-month");
  const [rent, setRent] = useState(900);
  const [collDays, setCollDays] = useState(28);
  const [km, setKm] = useState(150);
  const [tankCost, setTankCost] = useState(750);
  const [tankKm, setTankKm] = useState(150);
  const [gross, setGross] = useState(2200);
  const [carAge, setCarAge] = useState("New (0–1 yr)");
  const [hybrid, setHybrid] = useState(false);
  const [officeValue, setOfficeValue] = useState(17000);
  const [officeKm, setOfficeKm] = useState(24);
  const [corpRent, setCorpRent] = useState(800);
  const [officeFuelOwner, setOfficeFuelOwner] = useState(false);
  const cng = CITY_CNG[city];

  /* owner side, per day */
  const P = sim.price - sim.dp;
  const emiMo = emiCalc(P, sim.rate, sim.tenure);
  const opexMo = sim.insurance / 12 + sim.service / 12 + sim.tyres / 36 + sim.battery / 36 + sim.misc + sim.parking + sim.annualMaint / 12;
  const emiDay = emiMo / collDays;
  const opexDay = opexMo / collDays;
  const gstDay = sim.mode === "company" ? Math.max(0, rent * sim.outputGstPct / 100 - opexDay * sim.inputItcPct / 100) : 0;
  const floor = emiDay + opexDay + gstDay;                 // break-even rent/day
  const ownerMargin = rent - floor;                        // profit/day at chosen rent
  const recLow = Math.round((floor + 200) / 25) * 25;
  const recHigh = Math.round((floor + 450) / 25) * 25;

  /* driver side, per day */
  const cngPerKm = tankKm > 0 ? tankCost / tankKm : 0;
  const cngDay = km * cngPerKm;
  const driverTakeHome = gross - rent - cngDay;      // driver keeps fares; his own small extras are his
  const driverMo = driverTakeHome * collDays;

  const ageFactor = { "New (0–1 yr)": [850, 1000], "2–3 yr": [800, 950], "4–5 yr": [700, 850], "6–7 yr": [600, 750] };
  const band = ageFactor[carAge];

  /* hybrid: assign a corporate client to this driver; his reward is a rent cut */
  const officeFuelMo = officeFuelOwner ? officeKm * collDays * cngPerKm : 0;
  const gstHybridMo = sim.mode === "company"
    ? Math.max(0, corpRent * collDays * sim.outputGstPct / 100 + officeValue * 0.05 - opexMo * sim.inputItcPct / 100)
    : 0;
  const ownerPlainMo = ownerMargin * collDays;
  const ownerHybridMo = corpRent * collDays + officeValue - emiMo - opexMo - officeFuelMo - gstHybridMo;
  const driverRentSaveMo = (rent - corpRent) * collDays;
  const driverPlainMo = driverMo;
  const driverHybridMo = driverMo + driverRentSaveMo - (officeFuelOwner ? 0 : officeKm * collDays * cngPerKm);

  const bothWork = ownerMargin > 0 && driverTakeHome >= 250;
  const verdict = ownerMargin <= 0
    ? { t: "Below your break-even — you'd lose money at this rent.", tone: "red" }
    : driverTakeHome < 150
      ? { t: "Works for you, but the driver keeps too little — expect churn or late payments.", tone: "amber" }
      : { t: "Sustainable for both sides at these assumptions.", tone: "green" };

  return (
    <div className="space-y-4">
      <Card>
        <H sub="Find a daily rent that keeps you profitable AND the driver willing to stay">Rent guide · {city}</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="City"><Sel value={city} onChange={setCity} options={Object.keys(CITY_CNG)} /></Field>
          <Field label="Contract term"><Sel value={term} onChange={(v) => { setTerm(v); setRent(TERM_RENT[v]); }} options={Object.keys(TERM_RENT)} /></Field>
          <Field label="Your daily rent"><NumIn value={rent} step={50} onChange={setRent} /></Field>
          <Field label="Collectible days / mo"><NumIn value={collDays} step={1} onChange={setCollDays} /></Field>
          <Field label="Car age band"><Sel value={carAge} onChange={setCarAge} options={Object.keys(ageFactor)} /></Field>
          <Field label="Km driven / day"><NumIn value={km} step={10} onChange={setKm} /></Field>
          <Field label={`CNG tank ₹ (₹${cng}/kg)`}><NumIn value={tankCost} step={10} onChange={setTankCost} /></Field>
          <Field label="Km per tank"><NumIn value={tankKm} step={10} onChange={setTankKm} /></Field>
          <Field label="Driver gross / day"><NumIn value={gross} step={50} onChange={setGross} /></Field>
        </div>
      </Card>

      <div className={`rounded-xl border p-3 text-sm font-medium ${verdict.tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : verdict.tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
        {verdict.t}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <H sub="What the rent must cover before you profit">Your side</H>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">EMI / day</span><span style={MONO}>{inr(emiDay)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Running provisions / day</span><span style={MONO}>{inr(opexDay)}</span></div>
            {sim.mode === "company" && <div className="flex justify-between"><span className="text-zinc-500">Net GST / day</span><span style={MONO}>{inr(gstDay)}</span></div>}
            <div className="flex justify-between border-t border-zinc-100 pt-1.5 font-semibold"><span>Break-even rent</span><span style={MONO}>{inr(floor)}</span></div>
            <div className="flex justify-between font-semibold"><span>Your margin / day</span><span style={MONO} className={ownerMargin >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(ownerMargin)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Your profit / month</span><span style={MONO} className={ownerMargin >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(ownerMargin * collDays)}</span></div>
          </div>
          <div className="mt-2 rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">Suggested rent for this car: <span style={MONO} className="font-semibold text-zinc-900">{inr(recLow)}–{inr(recHigh)}</span>/day</div>
        </Card>
        <Card>
          <H sub="Whether the driver can live on what's left">Driver's side</H>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-zinc-500">Gross earning / day</span><span style={MONO}>{inr(gross)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">− Your rent</span><span style={MONO}>{inr(rent)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">− CNG ({km} km @ ₹{cngPerKm.toFixed(1)}/km)</span><span style={MONO}>{inr(cngDay)}</span></div>
            <div className="flex justify-between border-t border-zinc-100 pt-1.5 font-semibold"><span>Driver take-home / day</span><span style={MONO} className={driverTakeHome >= 250 ? "text-emerald-700" : driverTakeHome >= 150 ? "text-amber-600" : "text-rose-700"}>{inr(driverTakeHome)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-500">Driver income / month</span><span style={MONO}>{inr(driverMo)}</span></div>
          </div>
          <div className="mt-2 rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">If this drops below ~₹8,000/mo, drivers leave for Ola/Uber self-attach or another owner.</div>
        </Card>
      </div>

      <Card>
        <H sub="Typical fixed-lease band for an Aura-class CNG sedan, by car age">Ludhiana / tricity rate card</H>
        <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
          <Chip tone="zinc">Monthly ₹1,100</Chip>
          <Chip tone="zinc">3-month ₹1,000</Chip>
          <Chip tone="amber">12-month ₹900</Chip>
          <span className="text-zinc-400">longer commitment → lower rent, less churn</span>
        </div>
        <Table
          head={["Car age", "Rent band / day", "Note"]}
          rows={Object.entries(ageFactor).map(([age, [lo, hi]]) => [
            age,
            <span key="b" style={MONO}>{inr(lo)}–{inr(hi)}</span>,
            age === carAge ? <Chip key="c" tone="amber">selected</Chip> : "",
          ])}
        />
        <p className="mt-2 text-xs text-zinc-400">Bands are practical estimates for Ludhiana & the Chandigarh tricity, not published rates. Real CNG runs about ₹750 a tank for ~150 km (≈₹5/km); Mohali CNG (~₹97.5/kg) is dearer than Ludhiana (~₹84.25/kg), so expect slightly lower rent tolerance there.</p>
      </Card>

      <Card>
        <H sub={`At ₹${rent}/day rent · driver keeps 100% of earnings · ${/Chandigarh|Mohali|tricity/.test(city) ? "Chandigarh" : "Ludhiana"} fares`}>Driver earning ladder</H>
        <Table
          head={["Day length", "Gross / day", "CNG", "Take-home / month"]}
          rows={[["8 hr · part-time", 1900, 130], ["10 hr · steady", 2300, 160], ["12 hr · full day", 2700, 200], ["13 hr · busy / peak", 3200, 230]].map(([label, g0, k]) => {
            const cityFactor = /Chandigarh|Mohali|tricity/.test(city) ? 1.12 : 1;
            const g = Math.round(g0 * cityFactor);
            const cngD = k * cngPerKm;
            const th = (g - cngD - rent) * collDays;
            return [
              label,
              `₹${g.toLocaleString("en-IN")}`,
              `₹${Math.round(cngD)}`,
              <span key="t" className={th >= 25000 ? "font-semibold text-emerald-700" : th >= 18000 ? "text-amber-600" : "text-zinc-700"}>{inr(th)}</span>,
            ];
          })}
        />
        <p className="mt-2 text-xs text-zinc-500">A hard 12–13 hr day (8am–9pm) is where the money is: Ludhiana ~₹18–27k/mo, Chandigarh ~₹26–35k (airport + tourism + affluent riders push fares ~12% higher). One caution — don't multiply the ₹110–120-per-6km short-ride rate across the whole day: ~25–30% of km run empty and longer trips pay less per km, so blended is ~₹13–15/km. Fuel also rises with hours (a 13-hr day burns ~1.5 tanks). Your levers to lift him: feed corporate rides, all 3 apps, zero downtime.</p>
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <H sub="Give the driver a corporate client; his reward is a lower rent, you keep the billing">Corporate client · rent-cut deal</H>
          <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <input type="checkbox" checked={hybrid} onChange={(e) => setHybrid(e.target.checked)} className="accent-amber-500" />
            Enable
          </label>
        </div>
        {hybrid && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Corporate client / month"><NumIn value={officeValue} step={1000} onChange={setOfficeValue} /></Field>
              <Field label="Corporate km / day"><NumIn value={officeKm} step={2} onChange={setOfficeKm} /></Field>
              <Field label={`Reduced rent (vs ₹${rent})`}><NumIn value={corpRent} step={50} onChange={setCorpRent} /></Field>
              <label className="block text-xs font-medium text-zinc-600">
                <span className="mb-1 block uppercase tracking-wide">Corporate fuel paid by</span>
                <div className="flex overflow-hidden rounded-lg border border-zinc-300">
                  {[["driver", "Driver"], ["owner", "Owner"]].map(([k, l]) => (
                    <button key={k} onClick={() => setOfficeFuelOwner(k === "owner")}
                      className={`flex-1 px-2 py-1.5 text-xs font-semibold focus:outline-none ${(officeFuelOwner ? "owner" : "driver") === k ? "bg-zinc-900 text-amber-300" : "bg-white text-zinc-600"}`}>{l}</button>
                  ))}
                </div>
              </label>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-emerald-50 p-3 text-sm">
                <div className="mb-1 font-bold text-emerald-800">You (owner) / month / car</div>
                <div className="flex justify-between"><span className="text-zinc-600">Plain rent (₹{rent})</span><span style={MONO}>{inr(ownerPlainMo)}</span></div>
                <div className="flex justify-between font-semibold"><span>Rent-cut + corporate</span><span style={MONO} className={ownerHybridMo >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(ownerHybridMo)}</span></div>
                <div className="mt-1 flex justify-between border-t border-emerald-100 pt-1 text-xs"><span className="text-zinc-500">Extra profit</span><span style={MONO} className="font-semibold text-emerald-700">+{inr(ownerHybridMo - ownerPlainMo)}</span></div>
              </div>
              <div className="rounded-lg bg-sky-50 p-3 text-sm">
                <div className="mb-1 font-bold text-sky-800">Driver / month</div>
                <div className="flex justify-between"><span className="text-zinc-600">On ₹{rent} rent</span><span style={MONO}>{inr(driverPlainMo)}</span></div>
                <div className="flex justify-between font-semibold"><span>On ₹{corpRent} + corporate runs</span><span style={MONO} className={driverHybridMo >= driverPlainMo ? "text-emerald-700" : "text-amber-600"}>{inr(driverHybridMo)}</span></div>
                <div className="mt-1 flex justify-between border-t border-sky-100 pt-1 text-xs"><span className="text-zinc-500">His gain (rent saved)</span><span style={MONO} className="font-semibold text-sky-700">+{inr(driverHybridMo - driverPlainMo)}</span></div>
              </div>
            </div>
            <p className="mt-2 text-xs text-zinc-500">You keep the full ₹{(officeValue / 1000).toFixed(0)}k client and bill it (5% GST, your company name). The driver's only reward is the ₹{rent - corpRent}/day rent cut (≈{inr(driverRentSaveMo)}/mo). Keep the corporate runs light — they fall in peak app hours, so if they're heavy the driver won't accept just ₹{rent - corpRent}/day. Sweeten with a bigger rent cut if needed.</p>
          </>
        )}
        {!hybrid && <p className="text-sm text-zinc-500">Turn this on to model handing a driver a fixed corporate client (₹15–20k/month) in exchange for a lower daily rent — you keep the billing, he gets cheaper rent.</p>}
      </Card>
    </div>
  );
}

function RevenueModelsTab({ sim }) {
  const [days, setDays] = useState(26);
  const [maintMo, setMaintMo] = useState(6500);
  const [rentDay, setRentDay] = useState(1100);
  const [subFee, setSubFee] = useState(3500);
  const [subPayer, setSubPayer] = useState("LLP");
  const [grossFare, setGrossFare] = useState(2600);
  const [driverFuel, setDriverFuel] = useState(950);
  const [driverPct, setDriverPct] = useState(60);
  const [floor, setFloor] = useState(15000);
  const [corpBill, setCorpBill] = useState(60000);
  const [corpSalary, setCorpSalary] = useState(20000);
  const [corpFuel, setCorpFuel] = useState(20000);
  const [outMargin, setOutMargin] = useState(3000);
  const [outTrips, setOutTrips] = useState(10);
  const [dryFlat, setDryFlat] = useState(27000);

  const emiMo = emiCalc(sim.price - sim.dp, sim.rate, sim.tenure);
  const base = emiMo + maintMo;
  const subLLP = subPayer === "LLP" ? subFee : 0;
  const subDriver = subPayer === "Driver" ? subFee : 0;
  const gstOnRent = Math.max(0, rentDay * days * 0.18 - maintMo * 0.18); // 18% output on rent, ITC on upkeep

  // Subscription + fixed rent (the new core model)
  const subRentNet = rentDay * days - base - subLLP - gstOnRent;
  const driverTakeHome = (grossFare - rentDay - driverFuel) * days - subDriver;
  // Alternate models
  const corpNet = corpBill - corpSalary - corpFuel - base;
  const outNet = outMargin * outTrips - base;
  const dryNet = dryFlat - base;

  // Revenue share (% of gross, driver pays own CNG, company floor min)
  const rsGrossMo = grossFare * days;
  const rsCngMo = driverFuel * days;
  const rsCompanyShare = Math.max(rsGrossMo * (100 - driverPct) / 100, floor);
  const floorBinds = floor > rsGrossMo * (100 - driverPct) / 100;
  const rsDriver = rsGrossMo - rsCompanyShare - rsCngMo;
  const rsCompany = rsCompanyShare - base;
  const floorCoversCost = floor >= base;
  const rsSlowGross = rsGrossMo * 0.75;
  const rsCompanyShareSlow = Math.max(rsSlowGross * (100 - driverPct) / 100, floor);
  const rsCompanySlow = rsCompanyShareSlow - base;
  const rsDriverSlow = rsSlowGross - rsCompanyShareSlow - rsCngMo * 0.82;

  const models = [
    { k: "Subscription + rent", net: subRentNet, note: `driver keeps fares, pays ₹${rentDay} rent` },
    { k: "Corporate contract", net: corpNet, note: "you pay driver + fuel" },
    { k: "Outstation / airport", net: outNet, note: "client pays tolls + fuel" },
    { k: "Dry lease", net: dryNet, note: "flat rent, zero headache" },
  ];
  const fleet3 = 3 * subRentNet;

  return (
    <div className="space-y-4">
      <Card>
        <H sub="Subscription platform · no per-ride commission · EMI pulled from simulator car price">Shared assumptions</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Rent days / month"><NumIn value={days} step={1} onChange={setDays} /></Field>
          <Field label="Upkeep / mo / car"><NumIn value={maintMo} step={500} onChange={setMaintMo} /></Field>
          <Field label="Daily rent (to LLP)"><NumIn value={rentDay} step={50} onChange={setRentDay} /></Field>
          <div className="rounded-lg bg-zinc-50 p-2 text-xs">
            <div className="uppercase tracking-wide text-zinc-500">EMI / car</div>
            <div style={MONO} className="mt-1 text-sm font-semibold">{inr(emiMo)}</div>
          </div>
        </div>
      </Card>

      <Card>
        <H sub="Per-car net / month · subscription replaces commission">Revenue models</H>
        <Table
          head={["Model", "LLP net / car / mo", "Basis"]}
          rows={models.map((m) => [
            m.k,
            <span key="n" className={m.net >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{inr(m.net)}</span>,
            <span key="b" className="text-xs text-zinc-500">{m.note}</span>,
          ])}
        />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <H sub="The core model · driver keeps 100% of fares, pays you fixed rent">Subscription + rent</H>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Subscription / mo / car"><NumIn value={subFee} step={250} onChange={setSubFee} /></Field>
            <label className="block text-xs font-medium text-zinc-600">
              <span className="mb-1 block uppercase tracking-wide">Subscription paid by</span>
              <div className="flex overflow-hidden rounded-lg border border-zinc-300">
                {["LLP", "Driver"].map((k) => (
                  <button key={k} onClick={() => setSubPayer(k)}
                    className={`flex-1 px-2 py-1.5 text-xs font-semibold focus:outline-none ${subPayer === k ? "bg-zinc-900 text-amber-300" : "bg-white text-zinc-600"}`}>{k}</button>
                ))}
              </div>
            </label>
            <Field label="Driver gross fare / day"><NumIn value={grossFare} step={100} onChange={setGrossFare} /></Field>
            <Field label="Driver fuel / day"><NumIn value={driverFuel} step={50} onChange={setDriverFuel} /></Field>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-emerald-50 p-3 text-sm">
              <div className="mb-1 font-bold text-emerald-800">LLP / car / mo</div>
              <div className="flex justify-between"><span className="text-zinc-600">Rent ({days}d)</span><span style={MONO}>{inr(rentDay * days)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">− EMI + upkeep</span><span style={MONO} className="text-rose-700">{inr(base)}</span></div>
              {subLLP > 0 && <div className="flex justify-between"><span className="text-zinc-600">− Subscription</span><span style={MONO} className="text-rose-700">{inr(subLLP)}</span></div>}
              <div className="flex justify-between"><span className="text-zinc-600">− Net GST</span><span style={MONO} className="text-rose-700">{inr(gstOnRent)}</span></div>
              <div className="mt-1 flex justify-between border-t border-emerald-100 pt-1 font-semibold"><span>Net</span><span style={MONO} className={subRentNet >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(subRentNet)}</span></div>
            </div>
            <div className="rounded-lg bg-sky-50 p-3 text-sm">
              <div className="mb-1 font-bold text-sky-800">Driver / mo</div>
              <div className="flex justify-between"><span className="text-zinc-600">Gross fares</span><span style={MONO}>{inr(grossFare * days)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">− Rent</span><span style={MONO} className="text-rose-700">{inr(rentDay * days)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-600">− Fuel</span><span style={MONO} className="text-rose-700">{inr(driverFuel * days)}</span></div>
              {subDriver > 0 && <div className="flex justify-between"><span className="text-zinc-600">− Subscription</span><span style={MONO} className="text-rose-700">{inr(subDriver)}</span></div>}
              <div className="mt-1 flex justify-between border-t border-sky-100 pt-1 font-semibold"><span>Take-home</span><span style={MONO} className={driverTakeHome >= 12000 ? "text-emerald-700" : "text-amber-600"}>{inr(driverTakeHome)}</span></div>
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">If the LLP pays the subscription, margin is thin — either price rent ~₹1,100+, or set the payer to Driver (his fare-keeping easily covers a ₹{Math.round(subFee / days)}/day pass). Flip the toggle to see the swing.</p>
        </Card>

        <Card>
          <H sub="Corporate / outstation / dry-lease inputs">Other models</H>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Corporate bill / mo"><NumIn value={corpBill} step={1000} onChange={setCorpBill} /></Field>
            <Field label="Corp driver salary"><NumIn value={corpSalary} step={1000} onChange={setCorpSalary} /></Field>
            <Field label="Corp fuel / mo"><NumIn value={corpFuel} step={1000} onChange={setCorpFuel} /></Field>
            <Field label="Dry lease / mo"><NumIn value={dryFlat} step={1000} onChange={setDryFlat} /></Field>
            <Field label="Outstation margin/trip"><NumIn value={outMargin} step={250} onChange={setOutMargin} /></Field>
            <Field label="Outstation trips/mo"><NumIn value={outTrips} step={1} onChange={setOutTrips} /></Field>
          </div>
          <div className="mt-2 rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">Corporate turns a loss until the bill covers driver + fuel + EMI + upkeep (≈{inr(corpSalary + corpFuel + base)}). Push billing above that before signing.</div>
        </Card>
      </div>

      <Card>
        <H sub="Default model · 60/40 with a company floor · driver pays own CNG">Revenue share (60 / 40)</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Driver share %"><NumIn value={driverPct} step={1} onChange={setDriverPct} /></Field>
          <Field label="Company floor / mo"><NumIn value={floor} step={500} onChange={setFloor} /></Field>
          <Field label="Gross fare / day"><NumIn value={grossFare} step={100} onChange={setGrossFare} /></Field>
          <Field label="Driver fuel / day"><NumIn value={driverFuel} step={50} onChange={setDriverFuel} /></Field>
        </div>
        <div className={`mt-2 flex items-center gap-2 rounded-lg p-2 text-xs ${floorCoversCost ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          <span className="font-semibold">Floor {inr(floor)}</span>
          <span>{floorCoversCost ? "covers your fixed cost of " : "is BELOW your fixed cost of "}{inr(base)}{floorCoversCost ? " — a slow car can't lose you money." : " — raise it to at least this, or a slow car still loses."}</span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-emerald-50 p-3 text-sm">
            <div className="mb-1 flex items-center justify-between font-bold text-emerald-800"><span>Company / car / month</span>{floorBinds && <Chip tone="amber">floor applied</Chip>}</div>
            <div className="flex justify-between"><span className="text-zinc-600">{floorBinds ? "Floor take" : `${100 - driverPct}% of ${inr(rsGrossMo)}`}</span><span style={MONO}>{inr(rsCompanyShare)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-600">− EMI + upkeep + sub</span><span style={MONO} className="text-rose-700">{inr(base)}</span></div>
            <div className="mt-1 flex justify-between border-t border-emerald-100 pt-1 font-semibold"><span>Net</span><span style={MONO} className={rsCompany >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(rsCompany)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-zinc-500">× 3 cars</span><span style={MONO} className={rsCompany >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(rsCompany * 3)}</span></div>
          </div>
          <div className="rounded-lg bg-sky-50 p-3 text-sm">
            <div className="mb-1 font-bold text-sky-800">Driver / month</div>
            <div className="flex justify-between"><span className="text-zinc-600">{floorBinds ? "Gross − floor" : `${driverPct}% of ${inr(rsGrossMo)}`}</span><span style={MONO}>{inr(rsGrossMo - rsCompanyShare)}</span></div>
            <div className="flex justify-between"><span className="text-zinc-600">− His CNG</span><span style={MONO} className="text-rose-700">{inr(rsCngMo)}</span></div>
            <div className="mt-1 flex justify-between border-t border-sky-100 pt-1 font-semibold"><span>Take-home</span><span style={MONO} className={rsDriver >= 18000 ? "text-emerald-700" : rsDriver >= 14000 ? "text-amber-600" : "text-rose-700"}>{inr(rsDriver)}</span></div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-amber-50 p-2 text-xs">
          <span className="text-amber-800">Slow month (−25% gross): driver {inr(rsDriverSlow)}, company / car</span>
          <span style={MONO} className={rsCompanySlow >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{inr(rsCompanySlow)}</span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">The floor means the driver must cover your car's fixed cost before he keeps his 60% — so a weak car never bleeds you (set the floor = your true fixed cost). A good driver never hits it. To split gross you must see it: route money through the LLP account + GPS.</p>
      </Card>

      <Card>
        <H sub="What you offer a driver · same car, three ways">The 3 driver options</H>
        <Table
          head={["Option", "Driver pays / keeps", "Company gets / car", "Best for"]}
          rows={[
            ["60 / 40 split", `keeps 60%, min floor ${inrS(floor)} to you`, <span key="a" className="text-emerald-700">{inr(rsCompany)} net</span>, "most drivers — upside shared"],
            ["Fixed rent ₹1,000/day", "keeps 100% of fares", <span key="b" className="text-emerald-700">{inr(1000 * days - base)} net</span>, "driver who won't share earnings"],
            ["Fixed ₹26k/mo (3-mo+)", "keeps 100%, locked term", <span key="c" className="text-emerald-700">{inr(26000 - base)} net</span>, "committed / serious drivers"],
          ]}
        />
        <p className="mt-2 text-xs text-zinc-400">Company net shown after EMI + upkeep + subscription ({inr(base)}). The 60/40 earns you most on a busy car; the fixed options give you a guaranteed floor with zero earnings-tracking. Offer all three — it's how you sign every kind of driver and grow fastest.</p>
      </Card>

      <Card>
        <H sub="Your Phase-1 plan · all 3 cars on subscription + fixed rent">3-car fleet total</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Net / car / mo" value={inr(subRentNet)} tone={subRentNet >= 0 ? "green" : "red"} />
          <Stat label="3-car LLP net / mo" value={inrS(fleet3)} tone={fleet3 >= 0 ? "green" : "red"} hint="before income tax" />
          <Stat label="Driver take-home" value={inr(driverTakeHome)} tone={driverTakeHome >= 12000 ? "green" : "amber"} hint="per car / month" />
          <Stat label="Annual LLP net" value={inrS(fleet3 * 12)} tone={fleet3 >= 0 ? "green" : "red"} hint="reinvest into car 4, 5..." />
        </div>
        <p className="mt-2 text-xs text-zinc-500">Subscription (no commission) is far cheaper than the old ~22% cut — that's what makes this model work. Keep a maintenance reserve; at 3 cars one big repair can wipe a month's profit. Confirm the exact per-car subscription fee and money-flow (fare to driver vs LLP) at the local Ola/Uber partner office. Output GST/ITC and LLP tax are in the Financial simulator (company mode).</p>
      </Card>
    </div>
  );
}

/* real-world commercial CNG mileage (km/kg) — loaded, editable via presets */
const CNG_VEHICLES = {
  "Dzire Tour S CNG": { cityAC: 18, cityNon: 21, hwyAC: 24, hwyNon: 27, tankKg: 9.2, seats: 4 },
  "Ertiga CNG": { cityAC: 14, cityNon: 16, hwyAC: 18, hwyNon: 20, tankKg: 9.5, seats: 6 },
  "Aura CNG": { cityAC: 17, cityNon: 20, hwyAC: 23, hwyNon: 26, tankKg: 8.9, seats: 4 },
};

function CngTab() {
  const [veh, setVeh] = useState("Dzire Tour S CNG");
  const [ac, setAc] = useState(true);
  const [cityPct, setCityPct] = useState(80);
  const [city, setCity] = useState("Ludhiana");
  const [km, setKm] = useState(180);
  const [days, setDays] = useState(26);
  const price = CITY_CNG[city];
  const mil = (vv) => {
    const c = ac ? vv.cityAC : vv.cityNon, h = ac ? vv.hwyAC : vv.hwyNon;
    return (c * cityPct + h * (100 - cityPct)) / 100;
  };
  const v = CNG_VEHICLES[veh];
  const mileage = mil(v);
  const costPerKm = price / mileage;
  const perDay = costPerKm * km;
  const perMonth = perDay * days;
  const rangePerTank = v.tankKg * mileage;
  const tankCost = v.tankKg * price;

  return (
    <div className="space-y-4">
      <Card>
        <H sub="Real-world CNG mileage for Maruti commercial cars · AC & city/highway aware">CNG cost calculator</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Vehicle"><Sel value={veh} onChange={setVeh} options={Object.keys(CNG_VEHICLES)} /></Field>
          <Field label="City (CNG price)"><Sel value={city} onChange={setCity} options={Object.keys(CITY_CNG)} /></Field>
          <label className="block text-xs font-medium text-zinc-600">
            <span className="mb-1 block uppercase tracking-wide">Air-con</span>
            <div className="flex overflow-hidden rounded-lg border border-zinc-300">
              {[["on", "AC on"], ["off", "AC off"]].map(([k, l]) => (
                <button key={k} onClick={() => setAc(k === "on")} className={`flex-1 px-2 py-1.5 text-xs font-semibold focus:outline-none ${(ac ? "on" : "off") === k ? "bg-zinc-900 text-amber-300" : "bg-white text-zinc-600"}`}>{l}</button>
              ))}
            </div>
          </label>
          <div className="sm:col-span-2">
            <Field label={`Driving mix · ${cityPct}% city / ${100 - cityPct}% highway`}>
              <input type="range" min="0" max="100" step="10" value={cityPct} onChange={(e) => setCityPct(+e.target.value)} className="mt-1 w-full accent-amber-500" />
            </Field>
          </div>
          <Field label="Distance / day (km)"><NumIn value={km} step={10} onChange={setKm} /></Field>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Mileage" value={`${mileage.toFixed(1)} km/kg`} tone="amber" hint={`CNG ₹${price}/kg`} />
        <Stat label="Cost / km" value={`₹${costPerKm.toFixed(1)}`} />
        <Stat label="Cost / day" value={inr(perDay)} tone="red" hint={`${km} km`} />
        <Stat label="Cost / month" value={inrS(perMonth)} tone="red" hint={`${days} days`} />
        <Stat label="Range / tank" value={`${Math.round(rangePerTank)} km`} hint={`${v.tankKg} kg`} />
        <Stat label="Full tank" value={inr(tankCost)} />
      </div>

      <Card>
        <H sub={`${ac ? "AC on" : "AC off"} · ${cityPct}% city / ${100 - cityPct}% highway · ${city}`}>Compare vehicles</H>
        <Table
          head={["Vehicle", "Seats", "Mileage", "₹/km", `₹/day`, "₹/month"]}
          rows={Object.entries(CNG_VEHICLES).map(([name, vv]) => {
            const m = mil(vv), cpk = price / m;
            return [
              name === veh ? <span key="n" className="font-bold text-zinc-900">{name}</span> : name,
              vv.seats,
              `${m.toFixed(1)} km/kg`,
              `₹${cpk.toFixed(1)}`,
              inr(cpk * km),
              inrS(cpk * km * days),
            ];
          })}
        />
        <p className="mt-2 text-xs text-zinc-400">Real-world commercial estimates (loaded, city stop-go) — ARAI lab figures are higher. AC cuts mileage ~12–18%; highway improves it. The Ertiga costs ~₹3–4/km more than the Dzire but seats 6 — better for airport, outstation and larger corporate groups; the Dzire is your city-duty workhorse.</p>
      </Card>
    </div>
  );
}

function Money({ sim, setSim }) {
  const [tab, setTab] = useState("emi");
  const tabs = [["emi", "EMI"], ["rent", "Rent guide"], ["cng", "CNG"], ["models", "Revenue models"], ["sim", "Financial simulator"], ["dep", "Depreciation"], ["scale", "Profit at scale"]];
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-400 ${tab === k ? "bg-zinc-900 text-amber-300 shadow-sm" : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "emi" && <EmiTab />}
      {tab === "rent" && <RentGuideTab sim={sim} />}
      {tab === "cng" && <CngTab />}
      {tab === "models" && <RevenueModelsTab sim={sim} />}
      {tab === "sim" && <SimulatorTab sim={sim} setSim={setSim} />}
      {tab === "dep" && <DepTab />}
      {tab === "scale" && <ScaleTab sim={sim} />}
    </div>
  );
}

/* ================= EXPENSES ================= */
function Expenses({ expenses, setExpenses, cars }) {
  const [add, setAdd] = useState(false);
  const blank = { date: NOW.toISOString().slice(0, 10), category: "Scheduled Service", amount: 0, carId: "", note: "" };
  const [f, setF] = useState(blank);
  const byCat = useMemo(() => {
    const m = {};
    expenses.forEach((e) => { m[e.category] = (m[e.category] || 0) + e.amount; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);
  const thisMonth = expenses.filter((e) => new Date(e.date).getMonth() === NOW.getMonth() && new Date(e.date).getFullYear() === NOW.getFullYear()).reduce((s, e) => s + e.amount, 0);
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const regOf = (id) => cars.find((c) => c.id === id)?.reg;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <H sub="Owner-side spend only — CNG, cleaning and challans are on the driver">Expense ledger</H>
        <Btn kind="accent" onClick={() => setAdd(true)}>+ Add expense</Btn>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="This month" value={inr(thisMonth)} tone="red" />
        <Stat label="Logged total" value={inrS(total)} />
        <Stat label="Entries" value={expenses.length} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <H>By category</H>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCat} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                  {byCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={tooltipFmt} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <H>Recent entries</H>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 p-2 text-sm">
                <div>
                  <div className="font-medium text-zinc-800">{e.category}{e.note ? <span className="text-zinc-500"> · {e.note}</span> : null}</div>
                  <div className="text-xs text-zinc-500">{fmtD(e.date)}{regOf(e.carId) ? ` · ${regOf(e.carId)}` : " · fleet-level"}</div>
                </div>
                <span style={MONO} className="font-semibold text-rose-700">{inr(e.amount)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      {add && (
        <Modal title="Add expense" onClose={() => setAdd(false)}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date"><DateIn value={f.date} onChange={(v) => setF({ ...f, date: v })} /></Field>
            <Field label="Amount"><NumIn value={f.amount} step={100} onChange={(v) => setF({ ...f, amount: v })} /></Field>
            <div className="col-span-2"><Field label="Category"><Sel value={f.category} onChange={(v) => setF({ ...f, category: v })} options={EXP_CATEGORIES} /></Field></div>
            <div className="col-span-2">
              <Field label="Car (optional)">
                <select className={inputCls} value={f.carId} onChange={(e) => setF({ ...f, carId: e.target.value })}>
                  <option value="">Fleet-level</option>
                  {cars.map((c) => <option key={c.id} value={c.id}>{c.reg}</option>)}
                </select>
              </Field>
            </div>
            <div className="col-span-2"><Field label="Note"><TextIn value={f.note} onChange={(v) => setF({ ...f, note: v })} /></Field></div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => setAdd(false)}>Cancel</Btn>
            <Btn kind="accent" onClick={() => { if (f.amount > 0) { setExpenses([{ ...f, id: "e" + Date.now(), carId: f.carId || null }, ...expenses]); setF(blank); setAdd(false); } }}>Save</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= CLIENTS & LEADS ================= */
function Clients({ clients, setClients, leads, setLeads }) {
  const [addLead, setAddLead] = useState(false);
  const [lf, setLf] = useState({ name: "", type: "IT Company", value: 50000, note: "" });
  const statusTone = (s) => (s === "Won" ? "green" : s === "Lost" ? "red" : s === "Negotiation" || s === "Quotation" ? "amber" : "blue");

  return (
    <div className="space-y-4">
      <H sub="Corporate contracts · employee pickup-drop, airport & hotel duty">Client contracts</H>
      {clients.map((k) => {
        const renew = daysUntil(k.end);
        const invoice = k.billing * (1 + k.gst / 100);
        const profit = k.billing - k.cost - k.penalties;
        return (
          <Card key={k.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div style={DISP} className="font-bold text-zinc-900">{k.name}</div>
                <div className="text-xs text-zinc-500">{k.type} · {k.cars} car{k.cars > 1 ? "s" : ""} · {k.timings}</div>
              </div>
              <div className="flex gap-2">
                {renew <= 90 && <Chip tone={renew <= 30 ? "red" : "amber"}>Renewal in {renew} d</Chip>}
                <Chip tone={k.invoicePending ? "red" : "green"}>{k.invoicePending ? "Invoice pending" : "Paid up"}</Chip>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><span className="text-zinc-500">Billing/mo: </span><span style={MONO}>{inr(k.billing)}</span></div>
              <div><span className="text-zinc-500">Invoice (+{k.gst}% GST): </span><span style={MONO}>{inr(invoice)}</span></div>
              <div><span className="text-zinc-500">Cost alloc.: </span><span style={MONO}>{inr(k.cost)}</span></div>
              <div><span className="text-zinc-500">Profit/mo: </span><span style={MONO} className="font-semibold text-emerald-700">{inr(profit)}</span></div>
              <div><span className="text-zinc-500">Term: </span>{fmtD(k.start)} → {fmtD(k.end)}</div>
              <div className="sm:col-span-2"><span className="text-zinc-500">SLA: </span>{k.sla}</div>
              <div><span className="text-zinc-500">Penalties MTD: </span><span style={MONO} className={k.penalties > 0 ? "text-rose-700" : ""}>{inr(k.penalties)}</span></div>
            </div>
            <div className="mt-3 flex gap-2">
              <Btn kind="dark" onClick={() => setClients(clients.map((x) => x.id === k.id ? { ...x, invoicePending: !x.invoicePending } : x))}>
                {k.invoicePending ? "Mark invoice paid" : "Raise next invoice"}
              </Btn>
            </div>
          </Card>
        );
      })}

      <div className="flex items-center justify-between pt-2">
        <H sub="Hotels, IT parks, hospitals, schools, factories, tour operators">Lead pipeline</H>
        <Btn kind="accent" onClick={() => setAddLead(true)}>+ Add lead</Btn>
      </div>
      <Card>
        <div className="space-y-2">
          {leads.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-zinc-50 p-2">
              <div>
                <div className="text-sm font-medium text-zinc-800">{l.name} <span className="text-xs text-zinc-500">· {l.type}</span></div>
                <div className="text-xs text-zinc-500">{l.note}{l.next ? ` · next: ${fmtD(l.next)}` : ""} · est. <span style={MONO}>{inrS(l.value)}/mo</span></div>
              </div>
              <div className="flex items-center gap-2">
                <Chip tone={statusTone(l.status)}>{l.status}</Chip>
                <select className="rounded-lg border border-zinc-300 bg-white px-1.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                  value={l.status} onChange={(e) => setLeads(leads.map((x) => x.id === l.id ? { ...x, status: e.target.value } : x))}>
                  {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {addLead && (
        <Modal title="Add lead" onClose={() => setAddLead(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Organisation"><TextIn value={lf.name} onChange={(v) => setLf({ ...lf, name: v })} /></Field></div>
            <Field label="Type"><Sel value={lf.type} onChange={(v) => setLf({ ...lf, type: v })} options={["IT Company", "Hotel", "Hospital", "Factory", "School", "College", "Travel Agency", "Tour Operator", "BPO", "Corporate Office", "Government"]} /></Field>
            <Field label="Est. monthly value"><NumIn value={lf.value} step={5000} onChange={(v) => setLf({ ...lf, value: v })} /></Field>
            <div className="col-span-2"><Field label="Note"><TextIn value={lf.note} onChange={(v) => setLf({ ...lf, note: v })} /></Field></div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Btn kind="ghost" onClick={() => setAddLead(false)}>Cancel</Btn>
            <Btn kind="accent" onClick={() => { if (lf.name.trim()) { setLeads([{ ...lf, id: "l" + Date.now(), status: "New", next: "" }, ...leads]); setAddLead(false); setLf({ name: "", type: "IT Company", value: 50000, note: "" }); } }}>Save lead</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ================= PLAN & RISK ================= */
function Plan({ sim, stats }) {
  const [addPerYr, setAddPerYr] = useState(4);
  const d = simDerive(sim);
  const perCarNet = d.profitMo1; // per car per month before fleet fixed

  const proj = useMemo(() => {
    const out = []; let cash = 0; let cohorts = [{ age: 1.2, n: stats.total }];
    for (let y = 1; y <= 15; y++) {
      cohorts = cohorts.map((c) => ({ ...c, age: c.age + 1 }));
      cohorts.push({ age: 0.5, n: addPerYr });
      const fleet = cohorts.reduce((s, c) => s + c.n, 0);
      const profit = fleet * perCarNet * 12 * 0.92 - d.fleetFixedMo * 12 * (fleet >= 20 ? 2 : 1);
      cash += profit - addPerYr * (sim.dp + sim.processing);
      let mv = 0, loan = 0;
      cohorts.forEach((c) => {
        mv += c.n * sim.price * resaleFrac(c.age);
        loan += c.n * balanceAt(sim.price - sim.dp, sim.rate, sim.tenure, c.age * 12);
      });
      out.push({ y, fleet, profit: Math.round(profit), cash: Math.round(cash), equity: Math.round(mv - loan), valuation: Math.round(mv - loan + Math.max(0, cash) + 2 * Math.max(0, profit)) });
    }
    return out;
  }, [addPerYr, perCarNet, d, sim, stats.total]);

  const mark = (y) => proj[y - 1];
  const reserve = Math.round(stats.emiMo * 3);
  const scenarios = [
    { name: "Worst case", rent: 950, coll: 0.85, idle: 4, repair: 2500, tone: "red" },
    { name: "Average case", rent: 1150, coll: 0.95, idle: 1.5, repair: 1200, tone: "amber" },
    { name: "Best case", rent: 1200, coll: 0.99, idle: 0.5, repair: 800, tone: "green" },
  ].map((s) => {
    const cf = s.rent * (30 - s.idle) * s.coll - d.e - d.carOpexMo - s.repair;
    return { ...s, cf, fleetCf: cf * stats.active };
  });

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <H sub="Cohort model · uses your simulator assumptions · profits reinvested into new cars">Growth planner</H>
          <div className="w-40"><Field label="Cars added / year"><NumIn value={addPerYr} step={1} min={0} onChange={setAddPerYr} /></Field></div>
        </div>
        <Table
          head={["Horizon", "Fleet size", "Annual profit", "Cash after reinvest", "Fleet equity", "Est. valuation"]}
          rows={[5, 10, 15].map((y) => {
            const r = mark(y);
            return [`${y} years`, <span key="f" style={MONO} className="font-bold">{r.fleet}</span>, inrS(r.profit), <span key="c" className={r.cash >= 0 ? "text-emerald-700" : "text-rose-700"}>{inrS(r.cash)}</span>, inrS(r.equity), <span key="v" className="font-semibold text-emerald-700">{inrS(r.valuation)}</span>];
          })}
        />
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={proj} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
              <XAxis dataKey="y" tick={{ fontSize: 11 }} label={{ value: "year", position: "insideBottomRight", offset: -2, fontSize: 10 }} />
              <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Line type="monotone" dataKey="valuation" name="Business valuation" stroke="#065f46" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="equity" name="Fleet equity" stroke="#b45309" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 space-y-1.5 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
          <p>• Keep a cash reserve of <span style={MONO} className="font-semibold">{inr(reserve)}</span> (3 × monthly EMI) before adding any car.</p>
          <p>• Buy in pairs after festive-season demand (Oct–Nov) when driver supply is strongest; avoid adding during monsoon slack.</p>
          <p>• Prepay the highest-rate loan whenever idle cash exceeds 20% of total outstanding — at ~9.5%, every ₹1L prepaid in year 2 saves roughly ₹30–35k interest.</p>
          <p>• Prefer 5-yr tenure for cash-flow headroom, then prepay to close in ~4 — the EMI cushion protects you in a bad month.</p>
          <p>• Sell cars around year 5–6: resale falls below 35% and maintenance climbs; recycle proceeds into new units.</p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {scenarios.map((s) => (
          <Card key={s.name}>
            <div className="flex items-center justify-between">
              <span style={DISP} className="font-bold text-zinc-900">{s.name}</span>
              <Chip tone={s.tone}>{s.rent}/day</Chip>
            </div>
            <div className="mt-2 space-y-1 text-sm text-zinc-600">
              <div className="flex justify-between"><span>Collection</span><span style={MONO}>{Math.round(s.coll * 100)}%</span></div>
              <div className="flex justify-between"><span>Idle days / mo</span><span style={MONO}>{s.idle}</span></div>
              <div className="flex justify-between"><span>Repairs / mo</span><span style={MONO}>{inr(s.repair)}</span></div>
              <div className="mt-1 flex justify-between border-t border-zinc-100 pt-1 font-semibold"><span>Cash flow / car</span><span style={MONO} className={s.cf >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(s.cf)}</span></div>
              <div className="flex justify-between font-semibold"><span>Fleet / mo</span><span style={MONO} className={s.fleetCf >= 0 ? "text-emerald-700" : "text-rose-700"}>{inrS(s.fleetCf)}</span></div>
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <H>Risk register</H>
        <div className="grid gap-x-6 gap-y-1.5 text-sm text-zinc-700 sm:grid-cols-2">
          <p>• <b>Loan risk</b> — EMI is {Math.round(stats.emiMo / Math.max(1, stats.revenueMo) * 100)}% of revenue; keep it under 60%.</p>
          <p>• <b>Driver default</b> — deposit covers ~{Math.round(25000 / 1150)} days of rent; act on day 3 of non-payment.</p>
          <p>• <b>Accident risk</b> — comprehensive + zero-dep insurance mandatory; budget a replacement-vehicle fund.</p>
          <p>• <b>Market risk</b> — Ola/Uber incentive swings change driver earnings; fixed rent shields you but stresses drivers.</p>
          <p>• <b>Repair risk</b> — CNG kit and clutch wear fast in city duty; the service provision here assumes 5–6k km/month.</p>
          <p>• <b>Seasonality</b> — monsoon (Jun–Sep) dips collections ~5–10%; festive season peaks demand.</p>
        </div>
      </Card>
    </div>
  );
}

/* ================= PLAYBOOK ================= */
const TEMPLATES = [
  {
    k: "email", t: "Cold email · corporate",
    body: `Subject: Fixed-cost employee cab partner — GST invoice, GPS-tracked fleet

Dear [Name],

We run a dedicated fleet of Hyundai Aura CNG sedans with verified, uniformed drivers for employee transport in [city]. Companies like yours use us for shift pickup-drop and airport duty at a fixed monthly rate — no surge, no per-km surprises.

What you get: GPS tracking with live ETA, police-verified drivers, replacement vehicle within 60 minutes, monthly GST invoice, and an SLA with penalty clauses we sign up to.

Could we take 15 minutes this week to map your routes and share a quote? A 30-day pilot with one vehicle is on us to prove reliability.

Regards,
[Your name] · [Company] · [Phone]`,
  },
  {
    k: "wa", t: "WhatsApp pitch · corporate",
    body: `Hello [Name] ji 🙏 This is [Your name] from [Company]. We provide GPS-tracked Aura CNG cabs with verified drivers for employee pickup-drop — fixed monthly billing with GST invoice, replacement car guarantee. Currently serving [reference client]. Can I send a one-page quote for your [shift/airport] requirement?`,
  },
  {
    k: "call", t: "Calling script · corporate",
    body: `1. OPEN: "Am I speaking with the admin/transport manager? I'll take just two minutes."
2. HOOK: "We run fixed-cost employee cabs — companies switch to us because there's no surge and no attendance disputes; everything is GPS-logged."
3. QUALIFY: Ask — how many employees, which shifts, current vendor, current monthly spend, pain points (late pickups? billing disputes?).
4. PITCH: Fixed monthly rate per vehicle, verified drivers, SLA with penalties, GST invoice, 60-min replacement guarantee.
5. CLOSE: "Let me send a quotation today and do a free one-week pilot on your toughest route."
6. FOLLOW-UP: Fix the next call date before hanging up; log it in the lead pipeline.`,
  },
  {
    k: "quote", t: "Quotation format",
    body: `QUOTATION · [Company name] · [Date] · Ref: Q-[no]

To: [Client], [Address]
Service: Employee transportation — [route/shift details]
Vehicle: Hyundai Aura CNG sedan, 4-seater, GPS-tracked
Driver: Police-verified, uniformed, mobile provided

Commercials
• Monthly fixed charge per vehicle: ₹[amount]
• Included: [X] km/month & [Y] hrs/day; extra km @ ₹[rate]
• Fuel, driver, maintenance, insurance: included
• GST @ 5% extra · Payment: within 7 days of invoice
• SLA: pickup within 10 min of slot; ₹200 credit per miss
• Replacement vehicle within 60 minutes of breakdown

Validity: 15 days · Agreement: 12 months, exit with 30-day notice
Authorised signatory: ______________`,
  },
  {
    k: "driver", t: "Driver recruitment message",
    body: `🚗 Drive our Hyundai Aura CNG on fixed daily rent — whatever you earn above it is yours. No commission, no app cut. Company handles insurance, registration & servicing; you handle CNG and daily running. Deposit ₹20,000–25,000 (refundable). Valid DL + police verification required. Call [phone] — cars available this week in Ludhiana / tricity.`,
  },
  {
    k: "driverpb", t: "Driver message · Hindi + Punjabi (WhatsApp)",
    body: `गडी चाहीदी है? 🚕 Hyundai Aura CNG फिकस डेली किराए ते चलाओ — उस तों उते जो कमाओ ओ सारा तुहाडा। ना कोई कमीशन, ना app कटौती।

कंपनी वलों: insurance, registration ते servicing।
ड्राईवर वलों: CNG ते रोज़ाना खरच।
डिपाज़ट: ₹20,000–25,000 (वापसीयोग)।

ज़रूरी: पक्का DL + पुलिस वेरिफिकेशन।
संपरक: [phone] — लुधियाणा / त्रीसिटी विƧ1 गडीआं उपलब्ध।`,
  },
];
const DRIVER_CHANNELS = ["Ludhiana bus stand / Clock Tower taxi stands", "Chandigarh ISBT-17 & ISBT-43 stands", "Local gurdwara notice boards", "Ola/Uber driver WhatsApp groups", "Village referrals (Khanna, Doraha, Kharar)", "Existing driver referral (₹1,000 bonus)", "Punjabi Facebook / OLX auto groups", "Ajit / Jagbani classifieds", "Focal Point & Mandi labour chowks"];
const CORP_CHANNELS = ["Ludhiana Focal Point factories", "Hosiery & textile units (night shift)", "Mohali IT City / Quark City parks", "Chandigarh airport (Mohali) transfers", "PGIMER & private hospitals", "Tricity universities & colleges", "Auto-parts & machine-tool units", "Hotels (Chandigarh / Ludhiana)", "Amritsar tour & travel agencies", "Govt offices (GeM contracts)"];

/* driver GROSS fare estimates before CNG — tier-1 Punjab, Ola+Uber+Rapido combined */
const EARN_REF = [
  { city: "Ludhiana", h8: "1,300–1,700", h10: "1,700–2,300", h12: "2,100–2,900" },
  { city: "Chandigarh / tricity", h8: "1,400–1,900", h10: "1,900–2,500", h12: "2,400–3,200" },
];
const DRIVER_STEPS = [
  "Post the Hindi/Punjabi WhatsApp message (below) in local Ola/Uber & taxi-union groups and forward to existing drivers.",
  "Put a printed notice at Ludhiana bus stand, Clock Tower, ISBT-17/43 and nearby gurdwaras — include ₹1,000 referral bonus.",
  "List on OLX and in Ajit/Jagbani classifieds; these still pull serious local drivers in Punjab.",
  "Screen: valid commercial DL, 2+ yrs experience, local address proof, police verification, and a guarantor from the village.",
  "Take a ₹20,000–25,000 refundable deposit before handover — this is your default cushion and filters out non-serious drivers.",
];
const CLIENT_STEPS = [
  "Target night-shift factories in Focal Point and hosiery/auto-parts units — they need reliable worker pickup and hate attendance disputes.",
  "Walk into Mohali IT City / Quark City admin desks and tricity hospitals (PGIMER area) with a one-page quote and offer a free 1-week pilot.",
  "Register on GeM for government office contracts and approach hotels for airport-transfer tie-ups.",
  "Lead with fixed monthly billing + GST invoice + SLA penalties + 60-min replacement — that combination wins over per-trip vendors.",
  "Log every conversation in the Leads pipeline and fix the next follow-up date before you leave.",
];

function Playbook() {
  const [copied, setCopied] = useState("");
  const copy = async (k, t) => { try { await navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(""), 1500); } catch (e) { /* noop */ } };
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <H sub="Where to find drivers in Ludhiana & the tricity">Driver channels</H>
          <div className="flex flex-wrap gap-1.5">{DRIVER_CHANNELS.map((c) => <Chip key={c} tone="amber">{c}</Chip>)}</div>
        </Card>
        <Card>
          <H sub="Who buys monthly employee-transport in your zone">Corporate channels</H>
          <div className="flex flex-wrap gap-1.5">{CORP_CHANNELS.map((c) => <Chip key={c} tone="blue">{c}</Chip>)}</div>
        </Card>
      </div>

      <Card>
        <H sub="Ola + Uber + Rapido combined GROSS fare, before CNG · tier-1 Punjab estimates">Driver earning potential / day</H>
        <Table
          head={["City", "8 hours", "10 hours", "12 hours"]}
          rows={EARN_REF.map((r) => [r.city, `₹${r.h8}`, `₹${r.h10}`, `₹${r.h12}`])}
        />
        <p className="mt-2 text-xs text-zinc-500">These are gross takings. After your ₹1,000 fixed rent and ~₹750 CNG (one tank ≈ 150 km), a 10–12 hr day still leaves the driver a healthy margin — that's why the model works. Short Rapido/Ola city rides pay well (~₹110–120 for 6 km); longer trips average lower per km. Chandigarh runs higher than Ludhiana thanks to airport, tourism and corporate demand. Estimates from local ground rates, not published tariffs.</p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <H sub="A repeatable hiring routine">How to arrange drivers</H>
          <ol className="ml-4 list-decimal space-y-1.5 text-sm text-zinc-700">{DRIVER_STEPS.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </Card>
        <Card>
          <H sub="Landing monthly corporate contracts">How to land fixed clients</H>
          <ol className="ml-4 list-decimal space-y-1.5 text-sm text-zinc-700">{CLIENT_STEPS.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </Card>
      </div>

      {TEMPLATES.map((tp) => (
        <Card key={tp.k}>
          <div className="flex items-center justify-between">
            <H>{tp.t}</H>
            <Btn kind={copied === tp.k ? "accent" : "ghost"} onClick={() => copy(tp.k, tp.body)}>{copied === tp.k ? "Copied ✓" : "Copy"}</Btn>
          </div>
          <pre style={MONO} className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-800">{tp.body}</pre>
        </Card>
      ))}
    </div>
  );
}

/* ================= APP ================= */
export default function App() {
  const [tab, setTab] = useState("overview");
  const [cars, setCars] = useState(SEED_CARS);
  const [drivers, setDrivers] = useState(SEED_DRIVERS);
  const [expenses, setExpenses] = useState(SEED_EXPENSES);
  const [clients, setClients] = useState(SEED_CLIENTS);
  const [leads, setLeads] = useState(SEED_LEADS);
  const [sim, setSim] = useState({ cars: 5, price: 715000, dp: 100000, rate: 9.5, tenure: 5, rent: 1150, days: 30, insurance: 28000, service: 15000, tyres: 16000, battery: 6500, annualMaint: 6000, misc: 500, parking: 0, accountant: 2000, office: 0, processing: 5000, mode: "company", outputGstPct: 18, itcPerCar: 92000, inputItcPct: 18, corpTaxPct: 25.17, wdvRate: 30, claimItc: true });

  const stats = useMemo(() => {
    const total = cars.length;
    const activeCars = cars.filter((c) => c.status === "Active" && c.driverId);
    const active = activeCars.length;
    const service = cars.filter((c) => c.status === "Service").length;
    const idle = total - active - service;
    const revenueMo = activeCars.reduce((s, c) => s + c.dailyRent * 30, 0) + clients.reduce((s, k) => s + (k.billing - k.cost), 0) * 0; // client profit shown separately
    const loans = cars.map(carLoan);
    const emiMo = loans.reduce((s, l) => s + l.emi, 0);
    const loanOut = loans.reduce((s, l) => s + l.remaining, 0);
    const opexMo = total * perCarOpexMo() + 2000;
    const profitMo = revenueMo - emiMo - opexMo;
    const pending = drivers.filter((d) => d.active).reduce((s, d) => s + d.pending, 0);
    const fleetValue = cars.reduce((s, c) => s + carValue(c), 0);
    const invested = cars.reduce((s, c) => s + c.onRoad, 0);
    const capital = cars.reduce((s, c) => s + c.downPayment, 0);
    const itcFleet = cars.reduce((s, c) => s + c.onRoad * 0.86 * 18 / 118, 0); // ~18% GST on ex-showroom share
    const perCarProfit = active > 0 ? (revenueMo - emiMo - opexMo) / active : 0;
    return {
      total, active, service, idle, revenueMo, emiMo, opexMo, profitMo, pending, loanOut,
      fleetValue, depreciation: invested - fleetValue, capital, itcFleet,
      utilization: total ? active / total : 0,
      avgRevCar: active ? revenueMo / active : 0,
      avgProfitCar: Math.max(0, perCarProfit),
      defaultRate: revenueMo ? pending / revenueMo : 0,
      maintPct: revenueMo ? opexMo / revenueMo : 0,
      roi: capital ? (profitMo * 12) / capital : 0,
      breakEvenMo: perCarProfit > 0 ? Math.ceil(100000 / perCarProfit) : 0,
    };
  }, [cars, drivers, clients]);

  const NAV = [
    ["overview", "Overview", LayoutDashboard], ["fleet", "Fleet", Car], ["drivers", "Drivers", Users], ["money", "Calculators", Calculator],
    ["expenses", "Expenses", Wallet], ["clients", "Clients & Leads", Building2], ["plan", "Plan & Risk", TrendingUp], ["playbook", "Playbook", BookOpen],
  ];

  return (
    <div className="min-h-screen bg-zinc-100 pb-10" style={DISP}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=IBM+Plex+Mono:wght@400;500;600;700&display=swap'); @media (prefers-reduced-motion: reduce){*{transition:none!important}}`}</style>
      <header className="sticky top-0 z-40 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white shadow-lg ring-1 ring-white/5">
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-zinc-900 shadow-sm ring-2 ring-amber-300/40">
                <Car size={20} strokeWidth={2.5} />
              </span>
              <div>
                <div style={DISP} className="text-base font-extrabold uppercase tracking-widest leading-none">Aura Fleet</div>
                <div className="text-[11px] text-zinc-400">Commercial CNG fleet · Ludhiana / Chandigarh · {fmtD(NOW.toISOString())}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <div className="text-[11px] uppercase tracking-wider text-zinc-400">Cars · active</div>
                <div style={MONO} className="text-sm font-bold text-zinc-100">{stats.total} · {stats.active}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-[11px] uppercase tracking-wider text-zinc-400"><IndianRupee size={11} /> Net / month</div>
                <div style={MONO} className={`text-sm font-bold ${stats.profitMo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{inrS(stats.profitMo)}</div>
              </div>
            </div>
          </div>
          <nav className="-mx-4 mt-2 flex gap-1 overflow-x-auto px-4 pb-2">
            {NAV.map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-amber-400 ${tab === k ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-white/10 hover:text-white"}`}>
                <Icon size={15} strokeWidth={2.2} /> {l}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-4">
        {tab === "overview" && <Overview cars={cars} drivers={drivers} stats={stats} />}
        {tab === "fleet" && <Fleet cars={cars} setCars={setCars} drivers={drivers} />}
        {tab === "drivers" && <Drivers drivers={drivers} setDrivers={setDrivers} cars={cars} />}
        {tab === "money" && <Money sim={sim} setSim={setSim} />}
        {tab === "expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} cars={cars} />}
        {tab === "clients" && <Clients clients={clients} setClients={setClients} leads={leads} setLeads={setLeads} />}
        {tab === "plan" && <Plan sim={sim} stats={stats} />}
        {tab === "playbook" && <Playbook />}
        <p className="mt-6 text-center text-xs text-zinc-400">Prototype with sample data · figures are estimates, not accounting or tax advice · session data resets on reload</p>
      </main>
    </div>
  );
}
