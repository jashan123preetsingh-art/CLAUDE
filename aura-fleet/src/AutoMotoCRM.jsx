import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import {
  LayoutDashboard, Car, Users, Calculator, Wallet, Building2, TrendingUp, BookOpen, Bell, IndianRupee,
} from "lucide-react";

/* ================= formatting & finance math ================= */
const MONO = { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontFeatureSettings: "'tnum' 1" };
const DISP = { fontFamily: "'Inter', system-ui, sans-serif", letterSpacing: "-0.01em" };
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

/* ================= business model constants ================= */
const COMPANY = "Auto Moto Mobility Solutions";
const COMPANY_LEGAL = "Auto Moto Mobility Solutions LLP";
/* fill these in once the LLP registration and bank account are live */
const COMPANY_ADDRESS = "[Registered office] · Ludhiana, Punjab";
const COMPANY_GSTIN = "[GSTIN]";
const COMPANY_CONTACT = "[Phone] · [Email]";
const COMPANY_BANK = "[Bank · A/c no · IFSC] · UPI: [UPI ID]";

/* persist app state in the browser so the CRM survives reloads */
const usePersist = (key, seed) => {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem("amms." + key); return s ? JSON.parse(s) : seed; } catch { return seed; }
  });
  useEffect(() => {
    try { localStorage.setItem("amms." + key, JSON.stringify(v)); } catch { /* storage unavailable */ }
  }, [key, v]);
  return [v, setV];
};
const resetData = () => {
  try { Object.keys(localStorage).filter((k) => k.startsWith("amms.")).forEach((k) => localStorage.removeItem(k)); } catch { /* noop */ }
  window.location.reload();
};
const VEHICLE = "Maruti Suzuki Dzire Tour S CNG";
const DRIVER_PCT = 60;                 // driver keeps 60% of gross fares
const COMPANY_PCT = 100 - DRIVER_PCT;  // company takes 40%
const AVG_GROSS_MO = 68000;            // planning estimate · gross fares / car / month
const DEF_RATE = 8;                    // default commercial-loan interest % p.a.
const DEF_TENURE = 7;                  // default loan tenure, years

/* per-car owner-side running cost assumptions (editable in Calculators) */
const OPEX = { insurance: 28000, service: 15000, tyres: 16000, tyreLife: 3, battery: 6500, batteryLife: 3, subscription: 3500 };
const perCarOpexMo = (o = OPEX) =>
  o.insurance / 12 + o.service / 12 + o.tyres / (o.tyreLife * 12) + o.battery / (o.batteryLife * 12) + o.subscription;

/* settlement helpers · driver ledger runs on trailing-30-day settlements */
const last30 = (h) => h.filter((e) => (NOW - new Date(e.d)) / 86400000 <= 30);
const sumG = (h) => h.reduce((s, e) => s + (e.gross || 0), 0);
const sumF = (h) => h.reduce((s, e) => s + (e.fuel || 0), 0);

const carLoan = (c) => {
  const P = c.onRoad - c.downPayment;
  const e = emiCalc(P, c.rate, c.tenure);
  const m = monthsSince(c.purchaseDate);
  const remaining = balanceAt(P, c.rate, c.tenure, m);
  return { principal: P, emi: m >= c.tenure * 12 ? 0 : e, remaining, monthsLeft: Math.max(0, Math.round(c.tenure * 12 - m)) };
};
const carValue = (c) => c.onRoad * resaleFrac(yearsSince(c.purchaseDate));

/* ================= seed data ================= */
/* fleet is 100% Maruti Suzuki Dzire Tour S CNG · financed at 8% p.a. over 7 years */
const SEED_CARS = [
  { id: "c1", reg: "PB 10 XY 4821", model: VEHICLE, city: "Ludhiana", chassis: "MA3EYD32SPM104821", engine: "K12MN104821", purchaseDate: "2024-03-10", onRoad: 798000, downPayment: 100000, rate: 8, tenure: 7, driverId: "d1", status: "Active", insuranceExpiry: "2026-07-20", pucExpiry: "2026-09-15", fitnessExpiry: "2027-03-09", permitExpiry: "2029-03-09", serviceDue: "2026-08-22", tyreDate: "2024-03-10", batteryDate: "2024-03-10", accidents: [], gps: true, rcCopy: true, insCopy: true },
  { id: "c2", reg: "PB 10 AB 7734", model: VEHICLE, city: "Ludhiana", chassis: "MA3EYD32SRM207734", engine: "K12MN207734", purchaseDate: "2024-08-02", onRoad: 805000, downPayment: 120000, rate: 8, tenure: 7, driverId: "d2", status: "Active", insuranceExpiry: "2026-08-01", pucExpiry: "2026-10-05", fitnessExpiry: "2026-08-01", permitExpiry: "2029-08-01", serviceDue: "2026-09-10", tyreDate: "2026-06-14", batteryDate: "2024-08-02", accidents: [{ d: "2025-11-02", cost: 18500, note: "Rear bumper + tailgate · insurance claim settled, no injury" }], gps: true, rcCopy: true, insCopy: true },
  { id: "c3", reg: "CH 01 CD 2210", model: VEHICLE, city: "Chandigarh", chassis: "MA3EYD32SSM302210", engine: "K12MN302210", purchaseDate: "2025-01-15", onRoad: 812000, downPayment: 100000, rate: 8, tenure: 7, driverId: "d3", status: "Active", insuranceExpiry: "2027-01-14", pucExpiry: "2026-07-28", fitnessExpiry: "2027-01-14", permitExpiry: "2030-01-14", serviceDue: "2026-07-08", tyreDate: "2025-01-15", batteryDate: "2025-01-15", accidents: [], gps: true, rcCopy: true, insCopy: true },
  { id: "c4", reg: "PB 65 EF 9902", model: VEHICLE, city: "Mohali", chassis: "MA3EYD32SSM409902", engine: "K12MN409902", purchaseDate: "2025-06-20", onRoad: 815000, downPayment: 150000, rate: 8, tenure: 7, driverId: "d4", status: "Active", insuranceExpiry: "2027-06-19", pucExpiry: "2026-12-18", fitnessExpiry: "2027-06-19", permitExpiry: "2030-06-19", serviceDue: "2026-10-02", tyreDate: "2025-06-20", batteryDate: "2025-06-20", accidents: [], gps: true, rcCopy: true, insCopy: true },
  { id: "c5", reg: "PB 10 GH 5566", model: VEHICLE, city: "Ludhiana", chassis: "MA3EYD32STM505566", engine: "K12MN505566", purchaseDate: "2025-11-05", onRoad: 818000, downPayment: 100000, rate: 8, tenure: 7, driverId: "d5", status: "Service", insuranceExpiry: "2027-11-04", pucExpiry: "2026-11-01", fitnessExpiry: "2027-11-04", permitExpiry: "2030-11-04", serviceDue: "2026-07-03", tyreDate: "2025-11-05", batteryDate: "2026-06-28", accidents: [], gps: true, rcCopy: true, insCopy: false },
  { id: "c6", reg: "CH 01 JK 3141", model: VEHICLE, city: "Chandigarh", chassis: "MA3EYD32STM603141", engine: "K12MN603141", purchaseDate: "2026-02-18", onRoad: 822000, downPayment: 100000, rate: 8, tenure: 7, driverId: null, status: "Idle", insuranceExpiry: "2028-02-17", pucExpiry: "2027-02-17", fitnessExpiry: "2028-02-17", permitExpiry: "2031-02-17", serviceDue: "2026-08-18", tyreDate: "2026-02-18", batteryDate: "2026-02-18", accidents: [], gps: true, rcCopy: true, insCopy: true },
];

/* drivers work the 60/40 revenue share: driver keeps 60% of gross fares and pays his own CNG;
   history = weekly settlements { d, gross, fuel } — the ledger computes the split automatically */
const SEED_DRIVERS = [
  { id: "d1", name: "Gurpreet Singh", mobile: "98140 22xx7", aadhaar: "XXXX XXXX 4821", pan: "AXBPP1234K", dl: "PB10 20190004821", dlExpiry: "2029-04-18", badge: "LDH/B/2019/4821", badgeExpiry: "2027-04-18", address: "Model Town, Ludhiana", emergency: "Harleen Kaur · 98550 22xx1", policeVerified: true, deposit: 25000, joined: "2024-03-12", share: DRIVER_PCT, companyEarned: 612000, pending: 0, lateDays: 3, rating: 4.6, complaints: 0, attendance: 26, active: true, clientId: "k1", history: [{ d: "2026-07-06", gross: 16800, fuel: 5300 }, { d: "2026-06-29", gross: 17400, fuel: 5450 }, { d: "2026-06-22", gross: 16200, fuel: 5100 }, { d: "2026-06-15", gross: 15900, fuel: 5200 }] },
  { id: "d2", name: "Harjinder Singh", mobile: "97790 88xx2", aadhaar: "XXXX XXXX 7734", pan: "BYCPJ5678L", dl: "PB10 20170007734", dlExpiry: "2027-09-02", badge: "LDH/B/2017/7734", badgeExpiry: "2026-08-10", address: "Focal Point, Ludhiana", emergency: "Manpreet Singh · 90410 45xx8", policeVerified: true, deposit: 25000, joined: "2024-08-05", share: DRIVER_PCT, companyEarned: 508400, pending: 6400, lateDays: 9, rating: 4.1, complaints: 1, attendance: 24, active: true, clientId: "k1", history: [{ d: "2026-06-29", gross: 14800, fuel: 5050 }, { d: "2026-06-21", gross: 16600, fuel: 5350 }, { d: "2026-06-14", gross: 16100, fuel: 5300 }] },
  { id: "d3", name: "Manjinder Singh", mobile: "99880 31xx4", aadhaar: "XXXX XXXX 2210", pan: "CZDPS9012M", dl: "CH01 20200002210", dlExpiry: "2030-01-22", badge: "CHD/B/2020/2210", badgeExpiry: "2028-01-22", address: "Sector 22, Chandigarh", emergency: "Rajwinder Kaur · 98153 77xx0", policeVerified: true, deposit: 30000, joined: "2025-01-18", share: DRIVER_PCT, companyEarned: 421600, pending: 0, lateDays: 1, rating: 4.8, complaints: 0, attendance: 27, active: true, clientId: "k2", history: [{ d: "2026-07-06", gross: 19200, fuel: 5900 }, { d: "2026-06-29", gross: 18700, fuel: 5750 }, { d: "2026-06-22", gross: 18900, fuel: 5800 }, { d: "2026-06-15", gross: 18300, fuel: 5700 }] },
  { id: "d4", name: "Balwinder Singh", mobile: "80540 55xx9", aadhaar: "XXXX XXXX 9902", pan: "DAEPM3456N", dl: "PB65 20180009902", dlExpiry: "2028-06-30", badge: "MOH/B/2018/9902", badgeExpiry: "2027-06-30", address: "Phase 7, Mohali", emergency: "Simran Kaur · 98140 90xx3", policeVerified: true, deposit: 25000, joined: "2025-06-22", share: DRIVER_PCT, companyEarned: 301800, pending: 6900, lateDays: 5, rating: 4.3, complaints: 0, attendance: 25, active: true, clientId: null, history: [{ d: "2026-06-30", gross: 17300, fuel: 5600 }, { d: "2026-06-23", gross: 16900, fuel: 5500 }] },
  { id: "d5", name: "Sukhwinder Singh", mobile: "91530 12xx6", aadhaar: "XXXX XXXX 5566", pan: "EBFPK7890P", dl: "PB10 20160005566", dlExpiry: "2026-07-30", badge: "LDH/B/2016/5566", badgeExpiry: "2026-07-30", address: "Dugri, Ludhiana", emergency: "Gagandeep Singh · 95610 34xx2", policeVerified: true, deposit: 20000, joined: "2025-11-08", share: DRIVER_PCT, companyEarned: 158200, pending: 5200, lateDays: 12, rating: 3.7, complaints: 2, attendance: 19, active: true, clientId: null, history: [{ d: "2026-06-26", gross: 11800, fuel: 4300 }, { d: "2026-06-15", gross: 13600, fuel: 4700 }] },
  { id: "d6", name: "Jaspreet Singh", mobile: "98550 67xx1", aadhaar: "XXXX XXXX 3141", pan: "FCGPG2345Q", dl: "PB10 20150003141", dlExpiry: "2027-05-14", badge: "LDH/B/2015/3141", badgeExpiry: "2026-05-14", address: "Kharar, Mohali", emergency: "Navjot Kaur · 90280 11xx5", policeVerified: true, deposit: 0, joined: "2024-05-01", share: DRIVER_PCT, companyEarned: 336000, pending: 0, lateDays: 14, rating: 3.9, complaints: 1, attendance: 0, active: false, clientId: null, history: [{ d: "2026-01-31", gross: 15400, fuel: 5100 }] },
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

/* corporate contracts are an additional, best-effort benefit — never guaranteed to drivers.
   billed at 12% GST with ITC (unlocks the car purchase credit) */
const SEED_CLIENTS = [
  { id: "k1", name: "Focal Point Knitwear Pvt Ltd", type: "Ludhiana factory · night-shift worker drop", billing: 56000, gst: 12, includedKm: 2400, extraKmRate: 14, start: "2025-10-01", end: "2026-09-30", carIds: ["c1", "c2"], driverIds: ["d1", "d2"], timings: "9 PM – 5 AM · Mon–Sat", cost: 39000, invoicePending: true, sla: "Pickup within 10 min of slot · ₹200/miss penalty", penalties: 400 },
  { id: "k2", name: "Silverline Hotel, Chandigarh", type: "Airport transfers · Mohali", billing: 44000, gst: 12, includedKm: 1800, extraKmRate: 16, start: "2026-01-15", end: "2027-01-14", carIds: ["c3"], driverIds: ["d3"], timings: "On-call · 24×7 roster", cost: 29000, invoicePending: false, sla: "Sedan, uniformed driver · 30-min standby", penalties: 0 },
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

/* ================= tiny UI atoms · premium design system ================= */
const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-zinc-900/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 ease-out hover:shadow-[0_16px_40px_-16px_rgba(16,24,40,0.14)] ${className}`}>{children}</div>
);
const H = ({ children, sub }) => (
  <div className="mb-4">
    <h2 style={DISP} className="text-[15px] font-semibold tracking-tight text-zinc-900">{children}</h2>
    {sub && <p className="mt-0.5 text-[12.5px] leading-snug text-zinc-400">{sub}</p>}
  </div>
);
const Stat = ({ label, value, tone = "zinc", hint }) => {
  const tones = { zinc: "text-zinc-900", green: "text-emerald-600", red: "text-rose-600", amber: "text-amber-600" };
  const dots = { zinc: "bg-zinc-300", green: "bg-emerald-500", red: "bg-rose-500", amber: "bg-amber-400" };
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-900/[0.06] bg-white p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(16,24,40,0.16)]">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dots[tone]} transition-transform duration-300 group-hover:scale-125`} />
        <span className="truncate">{label}</span>
      </div>
      <div style={MONO} className={`mt-1.5 text-xl font-semibold tracking-tight ${tones[tone]}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11.5px] text-zinc-400">{hint}</div>}
    </div>
  );
};
const Plate = ({ reg }) => (
  <span style={MONO} className="inline-block whitespace-nowrap rounded-md border-2 border-zinc-900 bg-gradient-to-b from-amber-300 to-amber-400 px-1.5 py-0.5 text-xs font-bold tracking-wider text-zinc-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_1px_2px_rgba(16,24,40,0.15)]">
    {reg}
  </span>
);
const Chip = ({ children, tone = "zinc" }) => {
  const m = {
    zinc: "bg-zinc-50 text-zinc-600 ring-zinc-900/10", green: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
    red: "bg-rose-50 text-rose-700 ring-rose-600/15", amber: "bg-amber-50 text-amber-700 ring-amber-600/20", blue: "bg-sky-50 text-sky-700 ring-sky-600/15",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5 ring-1 ring-inset ${m[tone]}`}>{children}</span>;
};
const Btn = ({ children, onClick, kind = "dark", className = "", disabled }) => {
  const m = {
    dark: "bg-zinc-900 text-white shadow-[0_1px_2px_rgba(16,24,40,0.25),inset_0_1px_0_rgba(255,255,255,0.08)] hover:bg-zinc-800",
    accent: "bg-gradient-to-b from-amber-300 to-amber-400 text-zinc-900 shadow-[0_1px_2px_rgba(146,90,0,0.25),inset_0_1px_0_rgba(255,255,255,0.5)] hover:brightness-105",
    ghost: "border border-zinc-200 bg-white text-zinc-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900",
  };
  return (
    <button disabled={disabled} onClick={onClick}
      className={`rounded-xl px-3.5 py-2 text-[13px] font-semibold transition-all duration-200 ease-out active:scale-[0.97] focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 disabled:opacity-40 ${m[kind]} ${className}`}>
      {children}
    </button>
  );
};
const Field = ({ label, children }) => (
  <label className="block text-xs font-medium text-zinc-500">
    <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-400">{label}</span>
    {children}
  </label>
);
const inputCls = "w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-sm text-zinc-900 shadow-[inset_0_1px_2px_rgba(16,24,40,0.03)] transition-all duration-200 placeholder:text-zinc-300 hover:border-zinc-300 focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-amber-400/20";
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
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/40 p-3 backdrop-blur-[6px] sm:items-center" style={{ animation: "fadeIn .2s ease-out both" }}>
    <div className={`max-h-[88vh] w-full overflow-y-auto rounded-3xl border border-white/60 bg-white/95 p-5 shadow-[0_32px_80px_-16px_rgba(16,24,40,0.35)] backdrop-blur-xl ${wide ? "max-w-2xl" : "max-w-md"}`}
      style={{ animation: "modalIn .3s cubic-bezier(0.16,1,0.3,1) both" }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 style={DISP} className="text-[15px] font-semibold tracking-tight text-zinc-900">{title}</h3>
        <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-zinc-400 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30">✕</button>
      </div>
      {children}
    </div>
  </div>
);
const Table = ({ head, rows }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-max text-left text-sm">
      <thead>
        <tr className="border-b border-zinc-100 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          {head.map((h, i) => <th key={i} className={`py-2.5 pr-4 ${i > 0 ? "text-right" : ""}`}>{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-zinc-50 transition-colors duration-150 last:border-0 hover:bg-zinc-50/70">
            {r.map((c, j) => (
              <td key={j} style={j > 0 ? MONO : undefined} className={`py-2.5 pr-4 ${j > 0 ? "text-right" : "font-medium text-zinc-800"}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
const PIE_COLORS = ["#18181b", "#d97706", "#059669", "#e11d48", "#0284c7", "#7c3aed", "#65a30d", "#db2777", "#0891b2", "#a16207"];
const tooltipFmt = (v) => inr(v);

/* ================= OVERVIEW ================= */
function Overview({ cars, drivers, stats, expenses }) {
  const [period, setPeriod] = useState("Monthly");
  const PERIODS = { Daily: 1 / 30, Weekly: 7 / 30, Monthly: 1, Yearly: 12 };
  const pf = PERIODS[period];

  const trend = useMemo(() => {
    const out = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 15);
      const label = d.toLocaleDateString("en-IN", { month: "short" });
      let gross = 0, emi = 0, n = 0;
      cars.forEach((c) => {
        if (new Date(c.purchaseDate) <= d) {
          n++;
          gross += AVG_GROSS_MO;
          const L = carLoan(c);
          emi += emiCalc(L.principal, c.rate, c.tenure);
        }
      });
      gross *= 0.955;
      const company = gross * COMPANY_PCT / 100;
      out.push({ m: label, "Fleet gross": Math.round(gross), "Company 40%": Math.round(company), EMI: Math.round(emi), Net: Math.round(company - emi - n * perCarOpexMo()) });
    }
    return out;
  }, [cars]);

  const maintMo = useMemo(() => {
    const cats = ["Tyres", "Battery", "Engine Repair", "AC Repair", "Scheduled Service", "Oil & Consumables", "Unexpected Repair", "Accident Repair"];
    return expenses.filter((e) => cats.includes(e.category) && (NOW - new Date(e.date)) / 86400000 <= 30).reduce((s, e) => s + e.amount, 0);
  }, [expenses]);

  const alerts = [];
  cars.forEach((c) => {
    const ins = daysUntil(c.insuranceExpiry);
    if (ins <= 45) alerts.push({ tone: ins <= 10 ? "red" : "amber", text: `Insurance expires in ${ins} d`, car: c.reg });
    const puc = daysUntil(c.pucExpiry);
    if (puc <= 45) alerts.push({ tone: puc <= 10 ? "red" : "amber", text: `PUC expires in ${puc} d`, car: c.reg });
    const fit = daysUntil(c.fitnessExpiry);
    if (fit <= 45) alerts.push({ tone: fit <= 10 ? "red" : "amber", text: `Fitness expires in ${fit} d`, car: c.reg });
    const sv = daysUntil(c.serviceDue);
    if (sv <= 21) alerts.push({ tone: sv <= 3 ? "red" : "amber", text: sv < 0 ? `Service overdue by ${-sv} d` : `Service due in ${sv} d`, car: c.reg });
  });
  drivers.filter((d) => d.active).forEach((d) => {
    if (d.pending > 0) alerts.push({ tone: d.pending > 5000 ? "red" : "amber", text: `${inr(d.pending)} company share pending · ${d.name}`, car: null });
    const dl = daysUntil(d.dlExpiry);
    if (dl <= 45) alerts.push({ tone: dl <= 10 ? "red" : "amber", text: `DL expires in ${dl} d · ${d.name}`, car: null });
    const bd = daysUntil(d.badgeExpiry);
    if (bd <= 45) alerts.push({ tone: bd <= 10 ? "red" : "amber", text: `Badge expires in ${bd} d · ${d.name}`, car: null });
  });
  if (NOW.getDate() <= 5) alerts.push({ tone: "blue", text: `EMI of ${inr(stats.emiMo)} due by 5th`, car: null });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total cars" value={stats.total} hint={VEHICLE} />
        <Stat label="Active with driver" value={stats.active} tone="green" />
        <Stat label="In service / idle" value={`${stats.service} / ${stats.idle}`} tone="amber" />
        <Stat label="Fleet gross (30d)" value={inrS(stats.grossMo)} tone="green" hint="driver fares, all apps" />
        <Stat label="Company revenue" value={inrS(stats.companyRevMo)} tone="green" hint={`${COMPANY_PCT}% share + corporate`} />
        <Stat label="Driver payouts" value={inrS(stats.driverPayoutMo)} hint={`${DRIVER_PCT}% of gross`} />
        <Stat label="Monthly EMI" value={inrS(stats.emiMo)} hint={`${stats.total} loans @ 8% · 7 yr`} />
        <Stat label="Maintenance (30d)" value={inr(maintMo)} tone="amber" hint="repairs, tyres, service" />
        <Stat label="Company net" value={inrS(stats.profitMo)} tone={stats.profitMo >= 0 ? "green" : "red"} hint="after EMI + provisions" />
        <Stat label="Pending from drivers" value={inr(stats.pending)} tone={stats.pending > 0 ? "red" : "green"} />
        <Stat label="Loan outstanding" value={inrS(stats.loanOut)} />
        <Stat label="Fleet market value" value={inrS(stats.fleetValue)} />
        <Stat label="Total depreciation" value={inrS(stats.depreciation)} tone="red" hint="vs on-road price" />
        <Stat label="Utilization" value={`${Math.round(stats.utilization * 100)}%`} tone={stats.utilization >= 0.8 ? "green" : "amber"} />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <H sub="Fleet performance normalised from the trailing-30-day ledger">Reports · {period.toLowerCase()}</H>
          <div className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {Object.keys(PERIODS).map((k) => (
              <button key={k} onClick={() => setPeriod(k)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 ${period === k ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600"}`}>
                {k}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Fleet gross" value={inrS(stats.grossMo * pf)} tone="green" />
          <Stat label={`Company ${COMPANY_PCT}% + corp`} value={inrS(stats.companyRevMo * pf)} tone="green" />
          <Stat label={`Driver ${DRIVER_PCT}%`} value={inrS(stats.driverPayoutMo * pf)} />
          <Stat label="EMI" value={inrS(stats.emiMo * pf)} />
          <Stat label="Company net" value={inrS(stats.profitMo * pf)} tone={stats.profitMo >= 0 ? "green" : "red"} />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <H sub="Last 12 months · gross fares vs company share vs EMI vs net">Revenue & profit trend</H>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ left: 4, right: 8, top: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={52} />
                <Tooltip formatter={tooltipFmt} />
                <Legend />
                <Line type="monotone" dataKey="Fleet gross" stroke="#a1a1aa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Company 40%" stroke="#059669" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="EMI" stroke="#e11d48" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Net" stroke="#d97706" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <H sub={`${alerts.length} item${alerts.length === 1 ? "" : "s"} need attention`}>Notifications</H>
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
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
          <Stat label="Avg gross / car" value={inr(stats.avgRevCar)} hint="trailing 30 days, active cars" />
          <Stat label="Company net / car" value={inr(stats.avgProfitCar)} tone="green" />
          <Stat label="Utilization" value={`${Math.round(stats.utilization * 100)}%`} tone={stats.utilization >= 0.8 ? "green" : "amber"} />
          <Stat label="Collection default" value={`${(stats.defaultRate * 100).toFixed(1)}%`} tone={stats.defaultRate > 0.03 ? "red" : "green"} hint="pending vs company share" />
          <Stat label="Maintenance %" value={`${(stats.maintPct * 100).toFixed(1)}%`} hint="provisions vs company revenue" />
          <Stat label="ROI on capital" value={`${(stats.roi * 100).toFixed(1)}%`} tone="green" hint="annual net / down payments" />
          <Stat label="Break-even / car" value={`${stats.breakEvenMo} mo`} hint="down payment recovery" />
          <Stat label="ITC claimed on fleet" value={inrS(stats.itcFleet)} tone="green" hint="~18% GST credit on cars" />
        </div>
      </Card>
    </div>
  );
}

/* ================= FLEET ================= */
function Fleet({ cars, setCars, drivers, expenses }) {
  const [open, setOpen] = useState(null);
  const [add, setAdd] = useState(false);
  const blank = { reg: "", onRoad: 820000, downPayment: 100000, rate: DEF_RATE, tenure: DEF_TENURE, purchaseDate: NOW.toISOString().slice(0, 10) };
  const [f, setF] = useState(blank);
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "—";
  const SERVICE_CATS = ["Tyres", "Battery", "Engine Repair", "AC Repair", "Scheduled Service", "Oil & Consumables", "Unexpected Repair", "Accident Repair"];
  const serviceHistory = (carId) => expenses.filter((e) => e.carId === carId && SERVICE_CATS.includes(e.category));

  const saveCar = () => {
    if (!f.reg.trim()) return;
    const y = new Date(f.purchaseDate); const plus = (n) => { const d = new Date(y); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10); };
    setCars([{ ...f, id: "c" + Date.now(), model: VEHICLE, chassis: "—", engine: "—", driverId: null, status: "Idle", insuranceExpiry: plus(1), pucExpiry: plus(1), fitnessExpiry: plus(2), permitExpiry: plus(5), serviceDue: plus(1), tyreDate: f.purchaseDate, batteryDate: f.purchaseDate, accidents: [], gps: true, rcCopy: false, insCopy: false }, ...cars]);
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
        const hist = serviceHistory(c.id);
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
                  <div className="text-xs text-zinc-500">{c.model || VEHICLE}</div>
                  <div style={MONO} className="text-sm font-semibold text-emerald-700">EMI {inr(L.emi)}</div>
                </div>
                <Btn kind="ghost" onClick={() => setOpen(expanded ? null : c.id)}>{expanded ? "Hide" : "Details"}</Btn>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><span className="text-zinc-500">Driver: </span>{driverName(c.driverId)}</div>
              <div><span className="text-zinc-500">EMI: </span><span style={MONO}>{inr(L.emi)} · {L.monthsLeft} mo left</span></div>
              <div><span className="text-zinc-500">Loan left: </span><span style={MONO}>{inrS(L.remaining)}</span></div>
              <div><span className="text-zinc-500">Value now: </span><span style={MONO}>{inrS(mv)}</span></div>
            </div>
            {expanded && (
              <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3 text-sm">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                  <div className="col-span-2 sm:col-span-3"><span className="text-zinc-500">Model:</span> <span className="font-medium">{c.model || VEHICLE}</span></div>
                  <div><span className="text-zinc-500">Chassis:</span> <span style={MONO} className="text-xs">{c.chassis}</span></div>
                  <div><span className="text-zinc-500">Engine:</span> <span style={MONO} className="text-xs">{c.engine}</span></div>
                  <div><span className="text-zinc-500">Purchased:</span> {fmtD(c.purchaseDate)}</div>
                  <div><span className="text-zinc-500">On-road:</span> <span style={MONO}>{inr(c.onRoad)}</span></div>
                  <div><span className="text-zinc-500">Down payment:</span> <span style={MONO}>{inr(c.downPayment)}</span></div>
                  <div><span className="text-zinc-500">Loan:</span> <span style={MONO}>{inr(L.principal)} @ {c.rate}% · {c.tenure} yr</span></div>
                  <div><span className="text-zinc-500">EMI schedule:</span> <span style={MONO}>{inr(L.emi)} × {L.monthsLeft} mo</span></div>
                  <div><span className="text-zinc-500">Insurance:</span> {fmtD(c.insuranceExpiry)}</div>
                  <div><span className="text-zinc-500">PUC:</span> {fmtD(c.pucExpiry)}</div>
                  <div><span className="text-zinc-500">Fitness cert.:</span> {fmtD(c.fitnessExpiry)}</div>
                  <div><span className="text-zinc-500">Permit:</span> {fmtD(c.permitExpiry)}</div>
                  <div><span className="text-zinc-500">Service due:</span> {fmtD(c.serviceDue)}</div>
                  <div><span className="text-zinc-500">Tyres:</span> {fmtD(c.tyreDate)}</div>
                  <div><span className="text-zinc-500">Battery:</span> {fmtD(c.batteryDate)}</div>
                  <div><span className="text-zinc-500">RC copy:</span> {c.rcCopy ? "on file" : <span className="text-rose-700">missing</span>}</div>
                  <div><span className="text-zinc-500">Insurance copy:</span> {c.insCopy ? "on file" : <span className="text-rose-700">missing</span>}</div>
                  <div><span className="text-zinc-500">Depreciation:</span> <span style={MONO} className="text-rose-700">{inrS(c.onRoad - mv)}</span></div>
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Accident history</div>
                  {(c.accidents || []).length === 0 && <p className="text-xs text-zinc-400">No accidents on record.</p>}
                  {(c.accidents || []).map((a, i) => (
                    <div key={i} className="mb-1 flex items-center justify-between rounded-lg bg-rose-50 p-2 text-xs">
                      <span className="text-zinc-700">{fmtD(a.d)} · {a.note}</span>
                      <span style={MONO} className="font-semibold text-rose-700">{inr(a.cost)}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Service history (from expense ledger)</div>
                  {hist.length === 0 && <p className="text-xs text-zinc-400">No service entries logged for this car yet.</p>}
                  {hist.slice(0, 5).map((e) => (
                    <div key={e.id} className="mb-1 flex items-center justify-between rounded-lg bg-zinc-50 p-2 text-xs">
                      <span className="text-zinc-700">{fmtD(e.date)} · {e.category}{e.note ? ` · ${e.note}` : ""}</span>
                      <span style={MONO} className="font-semibold">{inr(e.amount)}</span>
                    </div>
                  ))}
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
          <div className="mb-3 rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">Model: <span className="font-semibold text-zinc-900">{VEHICLE}</span> · financing defaults to {DEF_RATE}% p.a. over {DEF_TENURE} years (editable)</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Registration number"><TextIn value={f.reg} onChange={(v) => setF({ ...f, reg: v.toUpperCase() })} placeholder="PB 10 AB 1234" /></Field></div>
            <Field label="On-road price"><NumIn value={f.onRoad} step={1000} onChange={(v) => setF({ ...f, onRoad: v })} /></Field>
            <Field label="Down payment"><NumIn value={f.downPayment} step={5000} onChange={(v) => setF({ ...f, downPayment: v })} /></Field>
            <Field label="Interest % p.a."><NumIn value={f.rate} step={0.1} onChange={(v) => setF({ ...f, rate: v })} /></Field>
            <Field label="Tenure (years)"><Sel value={String(f.tenure)} onChange={(v) => setF({ ...f, tenure: +v })} options={["3", "4", "5", "6", "7"]} /></Field>
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
  return `REVENUE-SHARE DRIVER AGREEMENT
${COMPANY_LEGAL}

This agreement is made on ${fmtD(NOW.toISOString())} between ${COMPANY_LEGAL} ("the Company", First Party) and ${d.name}, holder of DL ${d.dl}, residing at ${d.address} (Second Party / Driver).

1. VEHICLE. The Company provides a ${VEHICLE} bearing registration ${reg} in roadworthy condition, with valid insurance, registration, permit and fitness certificate.
2. REVENUE SHARE. All fares and ride earnings are gross revenue. The Driver keeps ${d.share || DRIVER_PCT}% of gross revenue; the Company receives ${100 - (d.share || DRIVER_PCT)}%. Earnings shall be settled weekly through the Company account, with a full statement of gross fares.
3. FUEL. The Driver bears all CNG/fuel expenses out of his share, and shall record fuel spend at each settlement.
4. COMPANY PROVIDES: the vehicle, insurance, regular servicing and maintenance, fleet management, platform subscription where applicable, and driver support and operational management.
5. DRIVER BEARS: CNG/fuel, daily cleaning, parking, and challans/fines caused by him.
6. CORPORATE DUTY. The Company will make reasonable best efforts to secure corporate contracts and assign them fairly among drivers. Corporate work is an additional benefit and is NOT guaranteed; availability depends on market demand and client acquisition.
7. DEPOSIT. A refundable security deposit of ${inr(d.deposit)} is held by the Company and is adjustable against unpaid company share, challans or damage.
8. GPS. The vehicle carries a GPS device which shall not be tampered with. Removal is grounds for immediate termination and deposit forfeiture.
9. DEFAULT. Company share unpaid for 7 consecutive days, concealment of earnings, or misuse of the vehicle entitles the Company to repossess the vehicle without notice.
10. TERMINATION. Either party may terminate with 15 days written notice. Deposit is refunded within 7 days of vehicle return, after inspection and dues.
11. JURISDICTION. Courts at the Company's registered city shall have exclusive jurisdiction.

For ${COMPANY_LEGAL}: ____________________      Driver: ____________________
Witness 1: _________________                          Witness 2: _________________`;
}
function receiptText(d, car, entry) {
  const gross = entry?.gross || 0, fuel = entry?.fuel || 0;
  const pct = d.share || DRIVER_PCT;
  const driverShare = gross * pct / 100, companyShare = gross - driverShare;
  return `SETTLEMENT RECEIPT · ${COMPANY_LEGAL} · ${fmtD(NOW.toISOString())}

Driver: ${d.name} (DL ${d.dl}) · Vehicle: ${car ? car.reg : "—"} (${VEHICLE})

Gross revenue for the period:        ${inr(gross)}
Driver share (${pct}%):                ${inr(driverShare)}
Company share (${100 - pct}%):               ${inr(companyShare)}
Fuel (CNG) reported by driver:       ${inr(fuel)}
Driver net earnings (share − fuel):  ${inr(driverShare - fuel)}

Company share received with thanks.
Balance pending after this settlement: ${inr(Math.max(0, d.pending))}

Received by: ____________________ (Authorised signatory, ${COMPANY_LEGAL})`;
}

function Drivers({ drivers, setDrivers, cars, clients }) {
  const [add, setAdd] = useState(false);
  const [doc, setDoc] = useState(null);
  const [settle, setSettle] = useState(null);
  const [sGross, setSGross] = useState(16000);
  const [sFuel, setSFuel] = useState(5200);
  const [sReceived, setSReceived] = useState(true);
  const [pay, setPay] = useState(null);
  const [payAmt, setPayAmt] = useState(0);
  const blank = { name: "", mobile: "", deposit: 25000, dl: "", address: "" };
  const [f, setF] = useState(blank);
  const carOf = (d) => cars.find((c) => c.driverId === d.id);
  const clientOf = (d) => clients.find((k) => k.id === d.clientId);

  const save = () => {
    if (!f.name.trim()) return;
    setDrivers([{ ...f, id: "d" + Date.now(), aadhaar: "XXXX XXXX —", pan: "—", dlExpiry: "", badge: "—", badgeExpiry: "", emergency: "—", policeVerified: false, joined: NOW.toISOString().slice(0, 10), share: DRIVER_PCT, companyEarned: 0, pending: 0, lateDays: 0, rating: 5, complaints: 0, attendance: 0, active: true, clientId: null, history: [] }, ...drivers]);
    setF(blank); setAdd(false);
  };
  const recordSettlement = () => {
    const companyShare = sGross * (100 - (settle.share || DRIVER_PCT)) / 100;
    setDrivers(drivers.map((d) => d.id === settle.id ? {
      ...d,
      history: [{ d: NOW.toISOString().slice(0, 10), gross: sGross, fuel: sFuel }, ...d.history],
      companyEarned: d.companyEarned + (sReceived ? companyShare : 0),
      pending: d.pending + (sReceived ? 0 : companyShare),
    } : d));
    setSettle(null);
  };
  const recordPay = () => {
    setDrivers(drivers.map((d) => d.id === pay.id ? { ...d, pending: Math.max(0, d.pending - payAmt), companyEarned: d.companyEarned + payAmt } : d));
    setPay(null);
  };
  const copyDoc = async (t) => { try { await navigator.clipboard.writeText(t); } catch (e) { /* noop */ } };
  const expChip = (label, iso) => {
    if (!iso) return null;
    const dd = daysUntil(iso);
    return <Chip tone={dd <= 10 ? "red" : dd <= 45 ? "amber" : "zinc"}>{label} {dd < 0 ? "expired" : `till ${fmtD(iso)}`}</Chip>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <H sub={`KYC, ${DRIVER_PCT}/${COMPANY_PCT} revenue ledger, settlements and paperwork · driver pays own CNG`}>Drivers</H>
        <Btn kind="accent" onClick={() => setAdd(true)}>+ Add driver</Btn>
      </div>
      {drivers.map((d) => {
        const car = carOf(d);
        const client = clientOf(d);
        const pct = d.share || DRIVER_PCT;
        const h30 = last30(d.history);
        const gross30 = sumG(h30), fuel30 = sumF(h30);
        const driverShare30 = gross30 * pct / 100;
        const companyShare30 = gross30 - driverShare30;
        const driverNet30 = driverShare30 - fuel30;
        return (
          <Card key={d.id} className={d.active ? "" : "opacity-60"}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span style={DISP} className="font-bold text-zinc-900">{d.name}</span>
                  <Chip tone={d.active ? "green" : "zinc"}>{d.active ? "Active" : "Inactive"}</Chip>
                  <Chip tone="blue">{pct}/{100 - pct} share</Chip>
                  {d.policeVerified && <Chip tone="blue">Police verified</Chip>}
                  {client && <Chip tone="green">Corporate · {client.name.split(",")[0]}</Chip>}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">{d.mobile} · DL {d.dl} · badge {d.badge} · joined {fmtD(d.joined)}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">{expChip("DL", d.dlExpiry)}{expChip("Badge", d.badgeExpiry)}</div>
              </div>
              {car ? <Plate reg={car.reg} /> : <Chip tone="amber">No car</Chip>}
            </div>
            <div className="mt-3 rounded-lg bg-zinc-50 p-2.5">
              <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">Revenue ledger · trailing 30 days (app-based earnings)</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                <div><span className="text-zinc-500">Gross revenue: </span><span style={MONO} className="font-semibold">{inr(gross30)}</span></div>
                <div><span className="text-zinc-500">Driver {pct}%: </span><span style={MONO}>{inr(driverShare30)}</span></div>
                <div><span className="text-zinc-500">Company {100 - pct}%: </span><span style={MONO} className="font-semibold text-emerald-700">{inr(companyShare30)}</span></div>
                <div><span className="text-zinc-500">Fuel (driver): </span><span style={MONO} className="text-rose-700">{inr(fuel30)}</span></div>
                <div><span className="text-zinc-500">Driver net: </span><span style={MONO} className={driverNet30 >= 15000 ? "font-semibold text-emerald-700" : "font-semibold text-amber-600"}>{inr(driverNet30)}</span></div>
                <div><span className="text-zinc-500">Company earnings: </span><span style={MONO} className="font-semibold text-emerald-700">{inr(companyShare30)}</span></div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><span className="text-zinc-500">Deposit: </span><span style={MONO}>{inr(d.deposit)}</span></div>
              <div><span className="text-zinc-500">Attendance: </span><span style={MONO}>{d.attendance} d / mo</span></div>
              <div><span className="text-zinc-500">Company earned (life): </span><span style={MONO}>{inrS(d.companyEarned)}</span></div>
              <div><span className="text-zinc-500">Pending: </span><span style={MONO} className={d.pending > 0 ? "font-semibold text-rose-700" : "text-emerald-700"}>{inr(d.pending)}</span></div>
              <div><span className="text-zinc-500">Late settlements: </span><span style={MONO}>{d.lateDays}</span></div>
              <div><span className="text-zinc-500">Rating: </span><span style={MONO}>{d.rating.toFixed(1)} ★</span></div>
              <div><span className="text-zinc-500">Complaints: </span><span style={MONO}>{d.complaints}</span></div>
              <div><span className="text-zinc-500">Corporate: </span>{client ? client.name.split(",")[0] : <span className="text-zinc-400">none · best-effort</span>}</div>
            </div>
            {d.history.length > 0 && (
              <div className="mt-2 text-xs text-zinc-500">
                Last settlements:{" "}
                {d.history.slice(0, 3).map((h, i) => (
                  <span key={i} style={MONO} className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700">{fmtD(h.d)} · gross {inr(h.gross)} · fuel {inr(h.fuel)}</span>
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn kind="dark" onClick={() => { setSettle(d); setSGross(16000); setSFuel(5200); setSReceived(true); }}>Record settlement</Btn>
              {d.pending > 0 && <Btn kind="ghost" onClick={() => { setPay(d); setPayAmt(d.pending); }}>Collect pending</Btn>}
              <Btn kind="ghost" onClick={() => setDoc({ title: "Revenue-share agreement", text: agreementText(d, car) })}>Agreement</Btn>
              <Btn kind="ghost" onClick={() => setDoc({ title: "Settlement receipt", text: receiptText(d, car, d.history[0]) })}>Receipt</Btn>
              <Btn kind="ghost" onClick={() => setDrivers(drivers.map((x) => x.id === d.id ? { ...x, active: !x.active } : x))}>{d.active ? "Mark inactive" : "Reactivate"}</Btn>
            </div>
          </Card>
        );
      })}

      {add && (
        <Modal title="Add driver" onClose={() => setAdd(false)}>
          <div className="mb-3 rounded-lg bg-zinc-50 p-2 text-xs text-zinc-600">Every driver joins on the <span className="font-semibold text-zinc-900">{DRIVER_PCT}% driver / {COMPANY_PCT}% company</span> revenue share and pays his own CNG. The company provides the car, insurance, servicing, fleet management, platform subscription and support.</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Field label="Full name"><TextIn value={f.name} onChange={(v) => setF({ ...f, name: v })} /></Field></div>
            <Field label="Mobile"><TextIn value={f.mobile} onChange={(v) => setF({ ...f, mobile: v })} /></Field>
            <Field label="Driving licence"><TextIn value={f.dl} onChange={(v) => setF({ ...f, dl: v })} /></Field>
            <Field label="Security deposit"><NumIn value={f.deposit} step={1000} onChange={(v) => setF({ ...f, deposit: v })} /></Field>
            <div className="col-span-2"><Field label="Address"><TextIn value={f.address} onChange={(v) => setF({ ...f, address: v })} /></Field></div>
          </div>
          <div className="mt-3 flex justify-end gap-2"><Btn kind="ghost" onClick={() => setAdd(false)}>Cancel</Btn><Btn kind="accent" onClick={save}>Save driver</Btn></div>
        </Modal>
      )}
      {settle && (() => {
        const pct = settle.share || DRIVER_PCT;
        const dShare = sGross * pct / 100, cShare = sGross - dShare;
        return (
          <Modal title={`Record settlement · ${settle.name}`} onClose={() => setSettle(null)}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gross revenue (all apps)"><NumIn value={sGross} step={100} onChange={setSGross} /></Field>
              <Field label="Fuel spent by driver"><NumIn value={sFuel} step={50} onChange={setSFuel} /></Field>
            </div>
            <div className="mt-3 space-y-1.5 rounded-lg bg-zinc-50 p-3 text-sm">
              <div className="flex justify-between"><span className="text-zinc-500">Gross revenue</span><span style={MONO}>{inr(sGross)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Driver share ({pct}%)</span><span style={MONO}>{inr(dShare)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">Company share ({100 - pct}%)</span><span style={MONO} className="font-semibold text-emerald-700">{inr(cShare)}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500">− Fuel (driver's cost)</span><span style={MONO} className="text-rose-700">{inr(sFuel)}</span></div>
              <div className="flex justify-between border-t border-zinc-200 pt-1.5 font-semibold"><span>Driver takes home</span><span style={MONO} className="text-sky-700">{inr(dShare - sFuel)}</span></div>
              <div className="flex justify-between font-semibold"><span>Company earns</span><span style={MONO} className="text-emerald-700">{inr(cShare)}</span></div>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-700">
              <input type="checkbox" checked={sReceived} onChange={(e) => setSReceived(e.target.checked)} className="accent-amber-500" />
              Company share received now (uncheck to add to pending)
            </label>
            <div className="mt-3 flex justify-end gap-2"><Btn kind="ghost" onClick={() => setSettle(null)}>Cancel</Btn><Btn kind="accent" onClick={recordSettlement}>Save settlement</Btn></div>
          </Modal>
        );
      })()}
      {pay && (
        <Modal title={`Collect pending · ${pay.name}`} onClose={() => setPay(null)}>
          <Field label="Amount received"><NumIn value={payAmt} step={50} onChange={setPayAmt} /></Field>
          <p className="mt-2 text-xs text-zinc-500">Company share pending before this payment: <span style={MONO}>{inr(pay.pending)}</span></p>
          <div className="mt-3 flex justify-end gap-2"><Btn kind="ghost" onClick={() => setPay(null)}>Cancel</Btn><Btn kind="accent" onClick={recordPay}>Save</Btn></div>
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
  const [p, setP] = useState(820000), [dp, setDp] = useState(100000), [r, setR] = useState(DEF_RATE), [t, setT] = useState(DEF_TENURE);
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
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
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
  /* company revenue per car = max(company % of gross fares, floor) — driver pays own CNG */
  const revMo = Math.max(s.gross * s.companyPct / 100, s.floor);
  const carOpexMo = s.insurance / 12 + s.service / 12 + s.tyres / (36) + s.battery / (36) + s.misc + s.parking + s.annualMaint / 12 + s.subscription;
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
          <div className="inline-flex rounded-full border border-zinc-200 bg-white p-0.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            {[["company", "Company · GST + ITC + tax"], ["personal", "No GST · pre-tax"]].map(([k, l]) => (
              <button key={k} onClick={() => setSim({ ...sim, mode: k })}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 ${sim.mode === k ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-600"}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <F k="cars" label="Number of cars" step={1} />
          <F k="price" label={`On-road price (${VEHICLE.split(" ").slice(-4).join(" ")})`} step={5000} />
          <F k="dp" label="Down payment / car" step={5000} />
          <Field label="Interest % p.a."><NumIn value={sim.rate} step={0.1} onChange={(v) => setSim({ ...sim, rate: v })} /></Field>
          <Field label="Tenure (yrs)"><Sel value={String(sim.tenure)} onChange={(v) => setSim({ ...sim, tenure: +v })} options={["3", "4", "5", "6", "7"]} /></Field>
          <F k="gross" label="Gross fares / car / mo" step={1000} />
          <F k="companyPct" label="Company share %" step={5} />
          <F k="floor" label="Company floor / mo" step={500} />
          <F k="subscription" label="Platform sub / mo / car" step={250} />
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
              <Field label="Output GST %"><NumIn value={sim.outputGstPct} step={1} onChange={(v) => setSim({ ...sim, outputGstPct: v })} /></Field>
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
          <H sub="Output GST on the company's revenue share — ITC offsets it; confirm structuring with your CA">GST & ITC position</H>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Output GST / mo" value={inrS(g.outputGstYr / 12)} tone="red" hint={`${sim.outputGstPct}% on company share`} />
            <Stat label="Input ITC / mo" value={inrS(g.inputItcYr / 12)} tone="green" hint="on insurance, service, etc." />
            <Stat label="Net GST / mo" value={inrS(g.netGstYr / 12)} tone={g.netGstYr > 0 ? "amber" : "green"} hint="steady state to govt" />
            <Stat label="One-time ITC" value={inrS(g.itcPool)} tone="green" hint={`covers first ~${g.poolMonths} mo of GST`} />
          </div>
          <p className="mt-2 text-xs text-zinc-400">The ₹{Math.round(sim.itcPerCar / 1000)}k/car purchase credit is realised upfront and wipes out your net GST for roughly {g.poolMonths} months. After that, GST costs ~{inrS(g.netGstYr / 12)}/mo.</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Company revenue / mo" value={inrS(monthlyRev)} tone="green" hint={`${sim.companyPct}% of gross, floor ${inrS(sim.floor)}`} />
        <Stat label="Monthly EMI" value={inrS(monthlyEmi)} hint={`${sim.rate}% · ${sim.tenure} yr`} />
        <Stat label="Monthly opex" value={inrS(monthlyOpex)} hint="incl. platform subscription" />
        <Stat label={isCo ? "Post-tax profit / mo" : "Pre-tax profit / mo"} value={inrS(monthlyPostTax)} tone={monthlyPostTax >= 0 ? "green" : "red"} hint={isCo ? "after GST + 25% tax" : "before tax"} />
        <Stat label="Profit / car / mo" value={inr(N ? monthlyPostTax / N : 0)} tone="amber" hint={`at ${inrS(sim.gross)} gross`} />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
              <XAxis dataKey="y" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Line type="monotone" dataKey="Cumulative cash" name="Cumulative cash" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Cash" name={isCo ? "Post-tax cash" : "Net cash"} stroke="#d97706" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Loan remaining" name="Loan remaining" stroke="#e11d48" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-zinc-400">Post-tax cash = revenue − opex − full EMI − net GST − corporate tax. Year 1 includes the one-time purchase ITC as a cash inflow. Depreciation is a non-cash tax shield (30% WDV on ex-ITC cost). Estimates only — confirm structuring with your CA.</p>
      </Card>
    </div>
  );
}

function DepTab() {
  const [price, setPrice] = useState(820000);
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
            const loanLeft = balanceAt(price - 100000, DEF_RATE, DEF_TENURE, r.y * 12);
            const net = r.Market - loanLeft;
            return [`Year ${r.y}`, inrS(r.SLM), inrS(r.WDV), inrS(r.Market), <span key="d" className="text-rose-700">{inrS(price - r.Market)}</span>, <span key="n" className={net >= 0 ? "text-emerald-700" : "text-rose-700"}>{inrS(net)}</span>];
          })}
        />
        <p className="mt-2 text-xs text-zinc-400">*Sale proceeds minus loan outstanding, assuming ₹1L down @ {DEF_RATE}% for {DEF_TENURE} yrs. Revenue-share income earned meanwhile is separate (see Projections).</p>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
              <XAxis dataKey="y" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={52} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Line type="monotone" dataKey="SLM" stroke="#a1a1aa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="WDV" stroke="#0284c7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Market" stroke="#d97706" strokeWidth={2} dot />
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
      <H sub="Fleet expansion planning · company revenue = 40% of gross with floor · tax est. @ 25% · admin doubles beyond 20 cars">Profit at scale</H>
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
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
            <XAxis dataKey="n" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={56} />
            <Tooltip formatter={tooltipFmt} />
            <Bar dataKey="Net profit / mo" fill="#059669" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* city CNG (₹/kg) — Ludhiana & Mohali from mid-2026 market data; others editable */
const CITY_CNG = { Ludhiana: 84.25, "Mohali / tricity": 97.5, Chandigarh: 90, Amritsar: 87.58, "Other Punjab": 88 };

/* ================= REVENUE SHARING (60/40) ================= */
function RevShareTab({ sim }) {
  const [days, setDays] = useState(26);
  const [grossFare, setGrossFare] = useState(2600);
  const [driverFuel, setDriverFuel] = useState(950);
  const [driverPct, setDriverPct] = useState(DRIVER_PCT);
  const [floor, setFloor] = useState(20000);
  const [maintMo, setMaintMo] = useState(5000);
  const [subFee, setSubFee] = useState(3500);
  const [city, setCity] = useState("Ludhiana");

  const emiMo = emiCalc(sim.price - sim.dp, sim.rate, sim.tenure);
  const base = emiMo + maintMo + subFee; // true fixed cost / car / month
  const grossMo = grossFare * days;
  const fuelMo = driverFuel * days;
  const companyPct = 100 - driverPct;
  const companyShare = Math.max(grossMo * companyPct / 100, floor);
  const floorBinds = floor > grossMo * companyPct / 100;
  const driverNet = grossMo - companyShare - fuelMo;
  const companyNet = companyShare - base;
  const floorCoversCost = floor >= base;
  const slowGross = grossMo * 0.75;
  const companyShareSlow = Math.max(slowGross * companyPct / 100, floor);
  const companyNetSlow = companyShareSlow - base;
  const driverNetSlow = slowGross - companyShareSlow - fuelMo * 0.82;
  const cngPerKm = CITY_CNG[city] / 18; // Dzire Tour S CNG · city AC ~18 km/kg

  return (
    <div className="space-y-4">
      <Card>
        <H sub={`The primary model · driver keeps ${driverPct}%, pays his own CNG · company provides the ${VEHICLE}, insurance, servicing, fleet management, platform subscription and support`}>Revenue sharing · {driverPct} / {companyPct}</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Driver share %"><NumIn value={driverPct} step={1} onChange={setDriverPct} /></Field>
          <Field label="Company floor / mo"><NumIn value={floor} step={500} onChange={setFloor} /></Field>
          <Field label="Gross fare / day"><NumIn value={grossFare} step={100} onChange={setGrossFare} /></Field>
          <Field label="Driver fuel / day"><NumIn value={driverFuel} step={50} onChange={setDriverFuel} /></Field>
          <Field label="Working days / mo"><NumIn value={days} step={1} onChange={setDays} /></Field>
          <Field label="Upkeep / mo / car"><NumIn value={maintMo} step={500} onChange={setMaintMo} /></Field>
          <Field label="Platform sub / mo"><NumIn value={subFee} step={250} onChange={setSubFee} /></Field>
          <div className="rounded-lg bg-zinc-50 p-2 text-xs">
            <div className="uppercase tracking-wide text-zinc-500">EMI / car ({sim.rate}% · {sim.tenure} yr)</div>
            <div style={MONO} className="mt-1 text-sm font-semibold">{inr(emiMo)}</div>
          </div>
        </div>
      </Card>

      <div className={`flex items-center gap-2 rounded-lg p-2 text-xs ${floorCoversCost ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
        <span className="font-semibold">Floor {inr(floor)}</span>
        <span>{floorCoversCost ? "covers your fixed cost of " : "is BELOW your fixed cost of "}{inr(base)}{floorCoversCost ? " — a slow car can't lose you money." : " — raise it to at least this, or a slow car still loses."}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between font-bold text-emerald-800"><span>Company / car / month</span>{floorBinds && <Chip tone="amber">floor applied</Chip>}</div>
          <div className="flex justify-between"><span className="text-zinc-600">{floorBinds ? "Floor take" : `${companyPct}% of ${inr(grossMo)}`}</span><span style={MONO}>{inr(companyShare)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-600">− EMI + upkeep + subscription</span><span style={MONO} className="text-rose-700">{inr(base)}</span></div>
          <div className="mt-1 flex justify-between border-t border-emerald-100 pt-1 font-semibold"><span>Net</span><span style={MONO} className={companyNet >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(companyNet)}</span></div>
          <div className="flex justify-between text-xs"><span className="text-zinc-500">× 3 cars</span><span style={MONO} className={companyNet >= 0 ? "text-emerald-700" : "text-rose-700"}>{inr(companyNet * 3)}</span></div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
          <div className="mb-1 font-bold text-sky-800">Driver / month</div>
          <div className="flex justify-between"><span className="text-zinc-600">{floorBinds ? "Gross − floor" : `${driverPct}% of ${inr(grossMo)}`}</span><span style={MONO}>{inr(grossMo - companyShare)}</span></div>
          <div className="flex justify-between"><span className="text-zinc-600">− His CNG</span><span style={MONO} className="text-rose-700">{inr(fuelMo)}</span></div>
          <div className="mt-1 flex justify-between border-t border-sky-100 pt-1 font-semibold"><span>Take-home</span><span style={MONO} className={driverNet >= 18000 ? "text-emerald-700" : driverNet >= 14000 ? "text-amber-600" : "text-rose-700"}>{inr(driverNet)}</span></div>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg bg-amber-50 p-2 text-xs">
        <span className="text-amber-800">Slow month (−25% gross): driver {inr(driverNetSlow)}, company / car</span>
        <span style={MONO} className={companyNetSlow >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{inr(companyNetSlow)}</span>
      </div>

      <Card>
        <H sub={`Gross fares before the split · ${city} CNG ₹${CITY_CNG[city]}/kg · Dzire Tour S ~18 km/kg city AC`}>Driver earning ladder</H>
        <div className="mb-2 w-44"><Field label="City"><Sel value={city} onChange={setCity} options={Object.keys(CITY_CNG)} /></Field></div>
        <Table
          head={["Day length", "Gross / day", "Driver 60%", "CNG", "Take-home / month"]}
          rows={[["8 hr · part-time", 1900, 130], ["10 hr · steady", 2300, 160], ["12 hr · full day", 2700, 200], ["13 hr · busy / peak", 3200, 230]].map(([label, g0, k]) => {
            const cityFactor = /Chandigarh|Mohali|tricity/.test(city) ? 1.12 : 1;
            const g = Math.round(g0 * cityFactor);
            const dShare = g * driverPct / 100;
            const cngD = k * cngPerKm;
            const th = (dShare - cngD) * days;
            return [
              label,
              `₹${g.toLocaleString("en-IN")}`,
              `₹${Math.round(dShare).toLocaleString("en-IN")}`,
              `₹${Math.round(cngD)}`,
              <span key="t" className={th >= 20000 ? "font-semibold text-emerald-700" : th >= 14000 ? "text-amber-600" : "text-zinc-700"}>{inr(th)}</span>,
            ];
          })}
        />
        <p className="mt-2 text-xs text-zinc-500">The floor means the driver must cover the car's fixed cost before he keeps his {driverPct}% — a weak car never bleeds the company, and a strong driver never even feels the floor. To split gross you must see it: route settlements through the company account + GPS. The company lifts a driver at zero cost by feeding corporate rides when contracts exist (best effort, never guaranteed), keeping him on all three apps, and never letting the car sit idle.</p>
      </Card>
    </div>
  );
}

/* ================= CORPORATE PROFITABILITY ================= */
function CorporateTab({ sim }) {
  const [bill, setBill] = useState(62000);
  const [includedKm, setIncludedKm] = useState(2400);
  const [extraRate, setExtraRate] = useState(14);
  const [actualKm, setActualKm] = useState(2700);
  const [driverCost, setDriverCost] = useState(24000);
  const [fuelMo, setFuelMo] = useState(20000);
  const [maintMo, setMaintMo] = useState(6500);

  const emiMo = emiCalc(sim.price - sim.dp, sim.rate, sim.tenure);
  const extraKm = Math.max(0, actualKm - includedKm);
  const extraRev = extraKm * extraRate;
  const revenue = bill + extraRev;
  const cost = driverCost + fuelMo + emiMo + maintMo;
  const profit = revenue - cost;
  const breakEvenBill = cost - extraRev;
  const perKm = actualKm > 0 ? revenue / actualKm : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        Corporate contracts are an <b>additional benefit</b> {COMPANY} provides whenever possible. The company actively markets its services and makes every reasonable effort to win contracts and assign them fairly to drivers — but corporate work is <b>not guaranteed</b>; it depends on market demand and successful client acquisition.
      </div>
      <Card>
        <H sub="Dedicated corporate car · salaried driver, company pays fuel · bill at 12% GST with ITC">Corporate profitability</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Monthly contract value"><NumIn value={bill} step={1000} onChange={setBill} /></Field>
          <Field label="Included km / mo"><NumIn value={includedKm} step={100} onChange={setIncludedKm} /></Field>
          <Field label="Extra km rate ₹"><NumIn value={extraRate} step={1} onChange={setExtraRate} /></Field>
          <Field label="Actual km / mo"><NumIn value={actualKm} step={100} onChange={setActualKm} /></Field>
          <Field label="Driver cost / mo"><NumIn value={driverCost} step={1000} onChange={setDriverCost} /></Field>
          <Field label="Fuel / mo (company)"><NumIn value={fuelMo} step={1000} onChange={setFuelMo} /></Field>
          <Field label="Upkeep / mo"><NumIn value={maintMo} step={500} onChange={setMaintMo} /></Field>
          <div className="rounded-lg bg-zinc-50 p-2 text-xs">
            <div className="uppercase tracking-wide text-zinc-500">EMI / car</div>
            <div style={MONO} className="mt-1 text-sm font-semibold">{inr(emiMo)}</div>
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Revenue / mo" value={inr(revenue)} tone="green" hint={extraKm > 0 ? `incl. ${extraKm} extra km @ ₹${extraRate}` : "no extra km"} />
        <Stat label="All-in cost / mo" value={inr(cost)} tone="red" hint="driver + fuel + EMI + upkeep" />
        <Stat label="Profit / mo" value={inr(profit)} tone={profit >= 0 ? "green" : "red"} />
        <Stat label="Break-even bill" value={inr(breakEvenBill)} tone="amber" hint="sign above this" />
        <Stat label="Realised ₹/km" value={`₹${perKm.toFixed(1)}`} />
      </div>
      <Card>
        <H sub="Same inputs, different contract values">Sensitivity</H>
        <Table
          head={["Contract value", "Profit / mo", "Verdict"]}
          rows={[45000, 52000, 57000, 62000, 68000, 75000].map((b) => {
            const p = b + extraRev - cost;
            return [
              inr(b),
              <span key="p" className={p >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{inr(p)}</span>,
              p < 0 ? "loses money" : p < 5000 ? "barely breaks even" : p < 12000 ? "sign it" : "excellent — lock a 12-month term",
            ];
          })}
        />
        <p className="mt-2 text-xs text-zinc-500">Don't underprice: a dedicated car costs ~{inrS(cost)} all-in, so a ₹55–57k bill barely breaks even. Bill at 12% GST with ITC to unlock the car purchase credit, and keep the contract in {COMPANY}'s name so the client can't walk with the driver.</p>
      </Card>
    </div>
  );
}

/* ================= MAINTENANCE ================= */
function MaintTab() {
  const [kmMo, setKmMo] = useState(5200);
  const [svcCost, setSvcCost] = useState(3800);
  const [svcKm, setSvcKm] = useState(10000);
  const [tyreCost, setTyreCost] = useState(16000);
  const [tyreKm, setTyreKm] = useState(50000);
  const [batCost, setBatCost] = useState(6500);
  const [batYrs, setBatYrs] = useState(3);
  const [insYr, setInsYr] = useState(28000);
  const [miscYr, setMiscYr] = useState(6000);

  const svcMo = kmMo / svcKm * svcCost;
  const tyreMo = kmMo / tyreKm * tyreCost;
  const batMo = batCost / (batYrs * 12);
  const insMo = insYr / 12;
  const miscMo = miscYr / 12;
  const totalMo = svcMo + tyreMo + batMo + insMo + miscMo;

  return (
    <div className="space-y-4">
      <Card>
        <H sub={`Owner-side provisions for a commercial-duty ${VEHICLE} · CNG kit & clutch wear fast in city duty`}>Maintenance calculator</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Km driven / month"><NumIn value={kmMo} step={200} onChange={setKmMo} /></Field>
          <Field label="Service cost ₹"><NumIn value={svcCost} step={100} onChange={setSvcCost} /></Field>
          <Field label="Service interval km"><NumIn value={svcKm} step={1000} onChange={setSvcKm} /></Field>
          <Field label="Tyre set cost ₹"><NumIn value={tyreCost} step={500} onChange={setTyreCost} /></Field>
          <Field label="Tyre life km"><NumIn value={tyreKm} step={5000} onChange={setTyreKm} /></Field>
          <Field label="Battery cost ₹"><NumIn value={batCost} step={500} onChange={setBatCost} /></Field>
          <Field label="Battery life (yrs)"><NumIn value={batYrs} step={1} onChange={setBatYrs} /></Field>
          <Field label="Insurance / yr"><NumIn value={insYr} step={1000} onChange={setInsYr} /></Field>
          <Field label="Other repairs / yr"><NumIn value={miscYr} step={500} onChange={setMiscYr} /></Field>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Servicing / mo" value={inr(svcMo)} />
        <Stat label="Tyres / mo" value={inr(tyreMo)} />
        <Stat label="Battery / mo" value={inr(batMo)} />
        <Stat label="Insurance / mo" value={inr(insMo)} />
        <Stat label="Other / mo" value={inr(miscMo)} />
        <Stat label="Total / car / mo" value={inr(totalMo)} tone="amber" hint="provision this much" />
      </div>
      <Card>
        <H sub="Provision at fleet scale · a reserve is survival, not optional">Fleet provision</H>
        <Table
          head={["Fleet size", "Monthly provision", "Annual provision"]}
          rows={[1, 3, 5, 10, 20].map((n) => [`${n} car${n > 1 ? "s" : ""}`, inr(totalMo * n), inrS(totalMo * n * 12)])}
        />
        <p className="mt-2 text-xs text-zinc-500">At 3 cars, one major repair or two idle weeks wipes a month's profit — keep the reserve funded before taking profit out. The company bears all servicing and maintenance under the {DRIVER_PCT}/{COMPANY_PCT} model; the driver bears only CNG.</p>
      </Card>
    </div>
  );
}

/* ================= BREAK-EVEN ================= */
function BreakEvenTab({ sim }) {
  const d = simDerive(sim);
  const capital = sim.dp + sim.processing;
  const perCarNet = d.profitMo1;
  const months = perCarNet > 0 ? capital / perCarNet : Infinity;
  const fixedCost = d.e + d.carOpexMo;
  const grossBE = fixedCost / (sim.companyPct / 100);
  const grossBEday = grossBE / 26;

  const curve = useMemo(() => {
    const out = [];
    let cum = -capital;
    for (let m = 0; m <= 48; m += 2) {
      out.push({ m, "Cumulative net / car": Math.round(cum) });
      cum += perCarNet * 2;
    }
    return out;
  }, [capital, perCarNet]);

  return (
    <div className="space-y-4">
      <Card>
        <H sub="Uses the simulator assumptions · company revenue = 40% of gross with floor">Break-even analysis</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Capital / car" value={inr(capital)} hint="down payment + processing" />
          <Stat label="Company net / car / mo" value={inr(perCarNet)} tone={perCarNet >= 0 ? "green" : "red"} />
          <Stat label="Break-even" value={months === Infinity ? "never" : `${Math.ceil(months)} mo`} tone="amber" hint="capital recovered" />
          <Stat label="Break-even gross" value={inr(grossBE)} hint={`${inr(grossBEday)}/day — below this the floor must bind`} />
        </div>
        <div className="mt-3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={curve} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} label={{ value: "month", position: "insideBottomRight", offset: -2, fontSize: 10 }} />
              <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={tooltipFmt} />
              <Line type="monotone" dataKey="Cumulative net / car" stroke="#059669" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Break-even gross is the monthly fare level where the company's {sim.companyPct}% exactly covers EMI + provisions + subscription ({inr(fixedCost)}). The floor of {inr(sim.floor)} exists precisely so months below that level don't come out of the company's pocket.</p>
      </Card>
    </div>
  );
}

/* ================= CASH FLOW FORECAST ================= */
function CashFlowTab({ sim }) {
  const [startCars, setStartCars] = useState(3);
  const [addEvery, setAddEvery] = useState(6);
  const [collPct, setCollPct] = useState(96);
  const [openingCash, setOpeningCash] = useState(150000);
  const d = simDerive(sim);

  /* seasonality: monsoon (Jun–Sep) dips ~8%, wedding season (Nov–Feb) lifts ~6% */
  const seasonal = (monthIdx) => {
    const m = (NOW.getMonth() + monthIdx) % 12;
    if (m >= 5 && m <= 8) return 0.92;
    if (m >= 10 || m <= 1) return 1.06;
    return 1;
  };

  const rows = useMemo(() => {
    const out = [];
    let cash = openingCash, cars = startCars;
    for (let m = 1; m <= 24; m++) {
      if (addEvery > 0 && m > 1 && (m - 1) % addEvery === 0) { cars += 1; cash -= sim.dp + sim.processing; }
      const gross = sim.gross * seasonal(m) * cars;
      const companyRev = Math.max(gross * sim.companyPct / 100, sim.floor * cars) * collPct / 100;
      const outgo = (d.e + d.carOpexMo) * cars + d.fleetFixedMo;
      const net = companyRev - outgo;
      cash += net;
      out.push({ m, cars, gross: Math.round(gross), companyRev: Math.round(companyRev), outgo: Math.round(outgo), net: Math.round(net), cash: Math.round(cash) });
    }
    return out;
  }, [startCars, addEvery, collPct, openingCash, sim, d]);

  const minCash = Math.min(...rows.map((r) => r.cash));

  return (
    <div className="space-y-4">
      <Card>
        <H sub="24-month forecast · seasonality: monsoon −8%, wedding season +6% · uses simulator assumptions">Cash-flow forecast</H>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Cars today"><NumIn value={startCars} step={1} min={1} onChange={setStartCars} /></Field>
          <Field label="Add a car every (mo, 0=never)"><NumIn value={addEvery} step={1} min={0} onChange={setAddEvery} /></Field>
          <Field label="Collection %"><NumIn value={collPct} step={1} onChange={setCollPct} /></Field>
          <Field label="Opening cash"><NumIn value={openingCash} step={10000} onChange={setOpeningCash} /></Field>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Cash at month 12" value={inrS(rows[11].cash)} tone={rows[11].cash >= 0 ? "green" : "red"} />
        <Stat label="Cash at month 24" value={inrS(rows[23].cash)} tone={rows[23].cash >= 0 ? "green" : "red"} />
        <Stat label="Lowest cash point" value={inrS(minCash)} tone={minCash >= 0 ? "green" : "red"} hint="keep this above zero" />
        <Stat label="Fleet at month 24" value={rows[23].cars} hint="cars" />
      </div>
      <Card>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} label={{ value: "month", position: "insideBottomRight", offset: -2, fontSize: 10 }} />
              <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Line type="monotone" dataKey="cash" name="Cash balance" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="net" name="Net / month" stroke="#d97706" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <Table
          head={["Month", "Cars", "Fleet gross", "Company revenue", "Outgo (EMI+opex)", "Net", "Cash"]}
          rows={rows.filter((r) => r.m % 3 === 0).map((r) => [
            `M${r.m}`, r.cars, inrS(r.gross), inrS(r.companyRev), inrS(r.outgo),
            <span key="n" className={r.net >= 0 ? "text-emerald-700" : "text-rose-700"}>{inrS(r.net)}</span>,
            <span key="c" className={r.cash >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{inrS(r.cash)}</span>,
          ])}
        />
        <p className="mt-2 text-xs text-zinc-500">Every new car costs {inr(sim.dp + sim.processing)} of cash up front and takes months to pay back — if the lowest cash point goes negative, slow the expansion or raise opening reserves. Corporate contracts (Clients tab) add revenue on top of this forecast when they exist; they are never guaranteed, so this forecast deliberately excludes them.</p>
      </Card>
    </div>
  );
}

/* real-world commercial CNG mileage (km/kg) — loaded, editable via presets */
const CNG_VEHICLES = {
  "Dzire Tour S CNG": { cityAC: 18, cityNon: 21, hwyAC: 24, hwyNon: 27, tankKg: 9.2, seats: 4 },
  "Ertiga CNG": { cityAC: 14, cityNon: 16, hwyAC: 18, hwyNon: 20, tankKg: 9.5, seats: 6 },
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
            <div className="flex overflow-hidden rounded-xl border border-zinc-200 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              {[["on", "AC on"], ["off", "AC off"]].map(([k, l]) => (
                <button key={k} onClick={() => setAc(k === "on")} className={`flex-1 px-2 py-1.5 text-xs font-semibold focus:outline-none ${(ac ? "on" : "off") === k ? "bg-zinc-900 text-white shadow-sm" : "bg-white text-zinc-600"}`}>{l}</button>
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
  const tabs = [["emi", "EMI"], ["share", "Revenue sharing"], ["corp", "Corporate"], ["cng", "CNG"], ["maint", "Maintenance"], ["dep", "Depreciation"], ["be", "Break-even"], ["scale", "Expansion"], ["cash", "Cash flow"], ["sim", "Projections"]];
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 ${tab === k ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/20" : "border border-zinc-200 bg-white text-zinc-500 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:border-zinc-300 hover:text-zinc-900 hover:shadow-md"}`}>
            {l}
          </button>
        ))}
      </div>
      {tab === "emi" && <EmiTab />}
      {tab === "share" && <RevShareTab sim={sim} />}
      {tab === "corp" && <CorporateTab sim={sim} />}
      {tab === "cng" && <CngTab />}
      {tab === "maint" && <MaintTab />}
      {tab === "dep" && <DepTab />}
      {tab === "be" && <BreakEvenTab sim={sim} />}
      {tab === "scale" && <ScaleTab sim={sim} />}
      {tab === "cash" && <CashFlowTab sim={sim} />}
      {tab === "sim" && <SimulatorTab sim={sim} setSim={setSim} />}
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
function invoiceText(k, kCars, kDrivers) {
  const period = NOW.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  const invNo = `INV-${NOW.getFullYear()}${String(NOW.getMonth() + 1).padStart(2, "0")}-${k.id.toUpperCase()}`;
  const taxable = k.billing - k.penalties;
  const gstAmt = taxable * k.gst / 100;
  const total = taxable + gstAmt;
  return `TAX INVOICE
${COMPANY_LEGAL}
${COMPANY_ADDRESS}
GSTIN: ${COMPANY_GSTIN} · SAC 9964 (passenger transport services) · ${COMPANY_CONTACT}

Invoice no: ${invNo} · Date: ${fmtD(NOW.toISOString())} · Period: ${period}

Bill to: ${k.name}
Service: ${k.type} · ${k.timings}
Vehicles: ${kCars.length ? kCars.join(", ") : "—"} (${VEHICLE})
Drivers on duty: ${kDrivers.length ? kDrivers.join(", ") : "—"}
Contract term: ${fmtD(k.start)} to ${fmtD(k.end)}

Monthly contract value                      ${inr(k.billing)}
  (includes ${k.includedKm?.toLocaleString("en-IN")} km/month; additional
   kilometres billed @ ₹${k.extraKmRate}/km as incurred)
Less: SLA penalties this period             −${inr(k.penalties)}
Taxable value                               ${inr(taxable)}
GST @ ${k.gst}% (with ITC)                       ${inr(gstAmt)}
────────────────────────────────────────────────────
TOTAL PAYABLE                               ${inr(total)}

Payment within 7 days of invoice date to:
${COMPANY_BANK}

E&OE · Subject to Ludhiana jurisdiction · This is a system-generated draft;
verify GSTIN, invoice numbering and tax treatment with your CA before issue.

For ${COMPANY_LEGAL}
Authorised signatory: ____________________`;
}

function Clients({ clients, setClients, leads, setLeads, cars, drivers }) {
  const [addLead, setAddLead] = useState(false);
  const [doc, setDoc] = useState(null);
  const [lf, setLf] = useState({ name: "", type: "IT Company", value: 50000, note: "" });
  const statusTone = (s) => (s === "Won" ? "green" : s === "Lost" ? "red" : s === "Negotiation" || s === "Quotation" ? "amber" : "blue");
  const regOf = (id) => cars.find((c) => c.id === id)?.reg;
  const nameOf = (id) => drivers.find((d) => d.id === id)?.name;
  const copyDoc = async (t) => { try { await navigator.clipboard.writeText(t); } catch (e) { /* noop */ } };

  return (
    <div className="space-y-4">
      <H sub="Corporate contracts · employee pickup-drop, airport & hotel duty">Client contracts</H>
      <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
        Corporate work is an <b>additional benefit, not a guarantee</b>. {COMPANY} actively markets its services and makes every reasonable effort to secure contracts and assign them fairly to drivers — availability depends on market demand and successful client acquisition.
      </div>
      {clients.map((k) => {
        const renew = daysUntil(k.end);
        const invoice = k.billing * (1 + k.gst / 100);
        const profit = k.billing - k.cost - k.penalties;
        const kCars = (k.carIds || []).map(regOf).filter(Boolean);
        const kDrivers = (k.driverIds || []).map(nameOf).filter(Boolean);
        return (
          <Card key={k.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div style={DISP} className="font-bold text-zinc-900">{k.name}</div>
                <div className="text-xs text-zinc-500">{k.type} · {kCars.length || (k.carIds || []).length} car{kCars.length > 1 ? "s" : ""} · {k.timings}</div>
              </div>
              <div className="flex gap-2">
                {renew <= 90 && <Chip tone={renew <= 30 ? "red" : "amber"}>Renewal in {renew} d</Chip>}
                <Chip tone={k.invoicePending ? "red" : "green"}>{k.invoicePending ? "Invoice pending" : "Paid up"}</Chip>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
              <div><span className="text-zinc-500">Contract value/mo: </span><span style={MONO}>{inr(k.billing)}</span></div>
              <div><span className="text-zinc-500">Invoice (+{k.gst}% GST): </span><span style={MONO}>{inr(invoice)}</span></div>
              <div><span className="text-zinc-500">Included km: </span><span style={MONO}>{k.includedKm?.toLocaleString("en-IN")} km/mo</span></div>
              <div><span className="text-zinc-500">Extra km: </span><span style={MONO}>₹{k.extraKmRate}/km</span></div>
              <div><span className="text-zinc-500">Cost alloc.: </span><span style={MONO}>{inr(k.cost)}</span></div>
              <div><span className="text-zinc-500">Profit/mo: </span><span style={MONO} className={`font-semibold ${profit >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{inr(profit)}</span></div>
              <div><span className="text-zinc-500">Term: </span>{fmtD(k.start)} → {fmtD(k.end)}</div>
              <div><span className="text-zinc-500">Penalties MTD: </span><span style={MONO} className={k.penalties > 0 ? "text-rose-700" : ""}>{inr(k.penalties)}</span></div>
              <div className="col-span-2"><span className="text-zinc-500">Vehicles: </span>{kCars.length ? kCars.map((r) => <span key={r} className="mr-1.5"><Plate reg={r} /></span>) : "—"}</div>
              <div className="col-span-2"><span className="text-zinc-500">Drivers: </span>{kDrivers.length ? kDrivers.join(", ") : "—"}</div>
              <div className="sm:col-span-4"><span className="text-zinc-500">SLA: </span>{k.sla}</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Btn kind="dark" onClick={() => setClients(clients.map((x) => x.id === k.id ? { ...x, invoicePending: !x.invoicePending } : x))}>
                {k.invoicePending ? "Mark invoice paid" : "Raise next invoice"}
              </Btn>
              <Btn kind="ghost" onClick={() => setDoc({ title: `Tax invoice · ${k.name.split(",")[0]}`, text: invoiceText(k, kCars, kDrivers) })}>Generate invoice</Btn>
            </div>
          </Card>
        );
      })}

      {doc && (
        <Modal title={doc.title} onClose={() => setDoc(null)} wide>
          <pre style={MONO} className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-800">{doc.text}</pre>
          <div className="mt-4 flex justify-end gap-2"><Btn kind="ghost" onClick={() => setDoc(null)}>Close</Btn><Btn kind="accent" onClick={() => copyDoc(doc.text)}>Copy text</Btn></div>
        </Modal>
      )}

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
  /* scenarios on gross fares · company gets max(40%, floor) · driver pays own CNG */
  const scenarios = [
    { name: "Worst case", gross: 50000, coll: 0.88, repair: 2500, tone: "red" },
    { name: "Average case", gross: 68000, coll: 0.96, repair: 1200, tone: "amber" },
    { name: "Best case", gross: 82000, coll: 0.99, repair: 800, tone: "green" },
  ].map((s) => {
    const companyRev = Math.max(s.gross * sim.companyPct / 100, sim.floor) * s.coll;
    const cf = companyRev - d.e - d.carOpexMo - s.repair;
    return { ...s, companyRev, cf, fleetCf: cf * stats.active };
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
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f1f3" vertical={false} />
              <XAxis dataKey="y" tick={{ fontSize: 11 }} label={{ value: "year", position: "insideBottomRight", offset: -2, fontSize: 10 }} />
              <YAxis tickFormatter={inrS} tick={{ fontSize: 11 }} width={56} />
              <Tooltip formatter={tooltipFmt} />
              <Legend />
              <Line type="monotone" dataKey="valuation" name="Business valuation" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="equity" name="Fleet equity" stroke="#d97706" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 space-y-1.5 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700">
          <p>• Keep a cash reserve of <span style={MONO} className="font-semibold">{inr(reserve)}</span> (3 × monthly EMI) before adding any car.</p>
          <p>• Buy in pairs after festive-season demand (Oct–Nov) when driver supply is strongest; avoid adding during monsoon slack.</p>
          <p>• Prepay loans whenever idle cash exceeds 20% of total outstanding — even at 8%, every ₹1L prepaid in year 2 saves roughly ₹25–30k interest over a 7-year tenure.</p>
          <p>• The 7-yr tenure keeps EMI low (~₹11,200 on a ₹7.2L loan) for cash-flow headroom — then prepay to close in ~5 so you're not underwater on a depreciating asset.</p>
          <p>• Sell cars around year 5–6: resale falls below 35% and maintenance climbs; recycle proceeds into new units.</p>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {scenarios.map((s) => (
          <Card key={s.name}>
            <div className="flex items-center justify-between">
              <span style={DISP} className="font-bold text-zinc-900">{s.name}</span>
              <Chip tone={s.tone}>{inrS(s.gross)} gross</Chip>
            </div>
            <div className="mt-2 space-y-1 text-sm text-zinc-600">
              <div className="flex justify-between"><span>Company {sim.companyPct}% (floor {inrS(sim.floor)})</span><span style={MONO}>{inr(s.companyRev)}</span></div>
              <div className="flex justify-between"><span>Collection</span><span style={MONO}>{Math.round(s.coll * 100)}%</span></div>
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
          <p>• <b>Loan risk</b> — EMI is {Math.round(stats.emiMo / Math.max(1, stats.companyRevMo) * 100)}% of company revenue; keep it under 60%.</p>
          <p>• <b>Driver default</b> — the deposit covers roughly 3–4 weeks of company share; act on day 3 of a missed settlement.</p>
          <p>• <b>Accident risk</b> — comprehensive + zero-dep insurance mandatory; budget a replacement-vehicle fund.</p>
          <p>• <b>Market risk</b> — Ola/Uber incentive swings move gross fares; the 60/40 split shares that swing, and the floor protects the company's fixed cost.</p>
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

At ${COMPANY} we run a dedicated fleet of brand-new Maruti Suzuki Dzire Tour S CNG sedans with verified, uniformed drivers for employee transport in [city]. Companies like yours use us for shift pickup-drop and airport duty at a fixed monthly rate — no surge, no per-km surprises.

What you get: GPS tracking with live ETA, police-verified drivers, replacement vehicle within 60 minutes, monthly GST invoice, and an SLA with penalty clauses we sign up to.

Could we take 15 minutes this week to map your routes and share a quote? A 30-day pilot with one vehicle is on us to prove reliability.

Regards,
[Your name] · ${COMPANY} · [Phone]`,
  },
  {
    k: "wa", t: "WhatsApp pitch · corporate",
    body: `Hello [Name] ji 🙏 This is [Your name] from ${COMPANY}. We provide GPS-tracked Maruti Dzire Tour S CNG cabs with verified drivers for employee pickup-drop — fixed monthly billing with GST invoice, replacement car guarantee. Currently serving [reference client]. Can I send a one-page quote for your [shift/airport] requirement?`,
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
    body: `QUOTATION · ${COMPANY_LEGAL} · [Date] · Ref: Q-[no]

To: [Client], [Address]
Service: Employee transportation — [route/shift details]
Vehicle: Maruti Suzuki Dzire Tour S CNG sedan, 4-seater, GPS-tracked
Driver: Police-verified, uniformed, mobile provided

Commercials
• Monthly fixed charge per vehicle: ₹[amount]
• Included: [X] km/month & [Y] hrs/day; extra km @ ₹[rate]
• Fuel, driver, maintenance, insurance: included
• GST @ 12% extra (with ITC) · Payment: within 7 days of invoice
• SLA: pickup within 10 min of slot; ₹200 credit per miss
• Replacement vehicle within 60 minutes of breakdown

Validity: 15 days · Agreement: 12 months, exit with 30-day notice
For ${COMPANY_LEGAL} · Authorised signatory: ______________`,
  },
  {
    k: "driver", t: "Driver recruitment message",
    body: `🚗 Drive a BRAND-NEW Maruti Suzuki Dzire Tour S CNG with ${COMPANY} — keep 60% of everything you earn. The company provides the car, insurance, full servicing & maintenance, platform subscription and support; you pay only CNG. Corporate duty shared with drivers whenever we win contracts (best effort, not guaranteed). Deposit ₹20,000–25,000 (refundable). Commercial DL + badge + police verification required. Call [phone] — cars available this week in Ludhiana / tricity.`,
  },
  {
    k: "driverpb", t: "Driver message · Hindi (WhatsApp)",
    body: `🚕 Auto Moto Mobility Solutions के साथ नई Maruti Suzuki Dzire Tour S CNG चलाओ — जो कमाओगे उसका 60% आपका।

कंपनी देगी: नई गाड़ी, इंश्योरेंस, पूरी सर्विस-मेंटेनेंस, प्लेटफॉर्म सब्सक्रिप्शन और सपोर्ट।
ड्राइवर देगा: सिर्फ़ CNG।
कॉर्पोरेट ड्यूटी: कंपनी दिलाने की पूरी कोशिश करेगी (गारंटी नहीं)।
डिपॉज़िट: ₹20,000–25,000 (वापसी योग्य)।

ज़रूरी: कमर्शियल DL + बैज + पुलिस वेरिफिकेशन।
संपर्क: [phone] — लुधियाना / ट्राईसिटी में गाड़ियां उपलब्ध।`,
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
  "Lead with the offer: a brand-new Dzire Tour S CNG, 60% of gross is yours, company covers everything except CNG — post the WhatsApp message (below) in local Ola/Uber & taxi-union groups and forward to existing drivers.",
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
        <p className="mt-2 text-xs text-zinc-500">These are gross takings before the split. On the 60/40 share, a ₹2,600 day leaves the driver ₹1,560 before ~₹750 CNG (one tank ≈ 150 km) — a 10–12 hr day is a healthy living, and the company's 40% covers the car. Short Rapido/Ola city rides pay well (~₹110–120 for 6 km); longer trips average lower per km. Chandigarh runs higher than Ludhiana thanks to airport, tourism and corporate demand. Estimates from local ground rates, not published tariffs.</p>
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
  const [cars, setCars] = usePersist("cars", SEED_CARS);
  const [drivers, setDrivers] = usePersist("drivers", SEED_DRIVERS);
  const [expenses, setExpenses] = usePersist("expenses", SEED_EXPENSES);
  const [clients, setClients] = usePersist("clients", SEED_CLIENTS);
  const [leads, setLeads] = usePersist("leads", SEED_LEADS);
  const [sim, setSim] = usePersist("sim", { cars: 5, price: 820000, dp: 100000, rate: DEF_RATE, tenure: DEF_TENURE, gross: AVG_GROSS_MO, companyPct: COMPANY_PCT, floor: 20000, subscription: 3500, insurance: 28000, service: 15000, tyres: 16000, battery: 6500, annualMaint: 6000, misc: 500, parking: 0, accountant: 2000, office: 0, processing: 5000, mode: "company", outputGstPct: 18, itcPerCar: 90000, inputItcPct: 18, corpTaxPct: 25.17, wdvRate: 30, claimItc: true });

  const stats = useMemo(() => {
    const total = cars.length;
    const activeCars = cars.filter((c) => c.status === "Active" && c.driverId);
    const active = activeCars.length;
    const service = cars.filter((c) => c.status === "Service").length;
    const idle = total - active - service;
    /* 60/40 revenue engine · trailing-30-day driver settlements */
    const activeDrivers = drivers.filter((d) => d.active && cars.some((c) => c.driverId === d.id));
    const grossMo = activeDrivers.reduce((s, d) => s + sumG(last30(d.history)), 0);
    const driverPayoutMo = activeDrivers.reduce((s, d) => s + sumG(last30(d.history)) * (d.share || DRIVER_PCT) / 100, 0);
    const shareMo = grossMo - driverPayoutMo;                                 // company's 40%
    const corpProfitMo = clients.reduce((s, k) => s + (k.billing - k.cost - k.penalties), 0);
    const corpBillingMo = clients.reduce((s, k) => s + k.billing, 0);
    const companyRevMo = shareMo + corpBillingMo;                             // company revenue incl. corporate billing
    const loans = cars.map(carLoan);
    const emiMo = loans.reduce((s, l) => s + l.emi, 0);
    const loanOut = loans.reduce((s, l) => s + l.remaining, 0);
    const opexMo = total * perCarOpexMo() + 2000;
    const profitMo = shareMo + corpProfitMo - emiMo - opexMo;                 // company net
    const pending = drivers.filter((d) => d.active).reduce((s, d) => s + d.pending, 0);
    const fleetValue = cars.reduce((s, c) => s + carValue(c), 0);
    const invested = cars.reduce((s, c) => s + c.onRoad, 0);
    const capital = cars.reduce((s, c) => s + c.downPayment, 0);
    const itcFleet = cars.reduce((s, c) => s + c.onRoad * 0.86 * 18 / 118, 0); // ~18% GST on ex-showroom share
    const perCarProfit = active > 0 ? profitMo / active : 0;
    return {
      total, active, service, idle, grossMo, driverPayoutMo, shareMo, companyRevMo,
      revenueMo: companyRevMo, emiMo, opexMo, profitMo, pending, loanOut,
      fleetValue, depreciation: invested - fleetValue, capital, itcFleet,
      utilization: total ? active / total : 0,
      avgRevCar: active ? grossMo / active : 0,
      avgProfitCar: Math.max(0, perCarProfit),
      defaultRate: shareMo ? pending / shareMo : 0,
      maintPct: companyRevMo ? opexMo / companyRevMo : 0,
      roi: capital ? (profitMo * 12) / capital : 0,
      breakEvenMo: perCarProfit > 0 ? Math.ceil(100000 / perCarProfit) : 0,
    };
  }, [cars, drivers, clients]);

  const NAV = [
    ["overview", "Overview", LayoutDashboard], ["fleet", "Fleet", Car], ["drivers", "Drivers", Users], ["money", "Calculators", Calculator],
    ["expenses", "Expenses", Wallet], ["clients", "Clients & Leads", Building2], ["plan", "Plan & Risk", TrendingUp], ["playbook", "Playbook", BookOpen],
  ];

  return (
    <div className="min-h-screen bg-zinc-50 pb-12 text-zinc-900" style={DISP}>
      <style>{`
        html{scroll-behavior:smooth}
        body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
        ::selection{background:#fbbf24;color:#18181b}
        *::-webkit-scrollbar{height:8px;width:8px}
        *::-webkit-scrollbar-track{background:transparent}
        *::-webkit-scrollbar-thumb{background:#d4d4d8;border-radius:9999px;border:2px solid transparent;background-clip:content-box}
        *::-webkit-scrollbar-thumb:hover{background:#a1a1aa;border:2px solid transparent;background-clip:content-box}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
        @keyframes modalIn{from{opacity:0;transform:translateY(16px) scale(.97)}to{opacity:1;transform:none}}
        main>div{animation:fadeUp .45s cubic-bezier(.16,1,.3,1) both}
        .recharts-default-tooltip{border-radius:14px!important;border:1px solid rgba(16,24,40,.06)!important;box-shadow:0 16px 40px -12px rgba(16,24,40,.22)!important;padding:10px 14px!important;font-size:12px!important;backdrop-filter:blur(8px);background:rgba(255,255,255,.96)!important}
        .recharts-tooltip-label{font-weight:600;color:#18181b}
        @media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important}}
      `}</style>
      <header className="sticky top-0 z-40 bg-zinc-950/90 text-white backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 pt-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-zinc-900 shadow-[0_0_24px_rgba(251,191,36,0.35),inset_0_1px_0_rgba(255,255,255,0.4)]">
                <Car size={19} strokeWidth={2.5} />
              </span>
              <div>
                <div style={DISP} className="text-sm font-bold leading-none tracking-tight sm:text-[15px]">{COMPANY}</div>
                <div className="mt-1 text-[11px] font-medium text-zinc-500">Fleet CRM · {VEHICLE} · 60/40 revenue share · Ludhiana / Chandigarh · {fmtD(NOW.toISOString())}</div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="hidden text-right sm:block">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Cars · active</div>
                <div style={MONO} className="mt-0.5 text-sm font-semibold text-zinc-100">{stats.total} · {stats.active}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-zinc-500"><IndianRupee size={10} /> Net / month</div>
                <div style={MONO} className={`mt-0.5 text-sm font-semibold ${stats.profitMo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{inrS(stats.profitMo)}</div>
              </div>
            </div>
          </div>
          <nav className="-mx-4 mt-3 flex gap-1 overflow-x-auto px-4 pb-3">
            {NAV.map(([k, l, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200 ease-out focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30 ${tab === k ? "bg-white text-zinc-900 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.4)]" : "text-zinc-400 hover:bg-white/[0.08] hover:text-white"}`}>
                <Icon size={14} strokeWidth={2.2} /> {l}
              </button>
            ))}
          </nav>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-6">
        {tab === "overview" && <Overview cars={cars} drivers={drivers} stats={stats} expenses={expenses} />}
        {tab === "fleet" && <Fleet cars={cars} setCars={setCars} drivers={drivers} expenses={expenses} />}
        {tab === "drivers" && <Drivers drivers={drivers} setDrivers={setDrivers} cars={cars} clients={clients} />}
        {tab === "money" && <Money sim={sim} setSim={setSim} />}
        {tab === "expenses" && <Expenses expenses={expenses} setExpenses={setExpenses} cars={cars} />}
        {tab === "clients" && <Clients clients={clients} setClients={setClients} leads={leads} setLeads={setLeads} cars={cars} drivers={drivers} />}
        {tab === "plan" && <Plan sim={sim} stats={stats} />}
        {tab === "playbook" && <Playbook />}
        <footer className="mt-10 border-t border-zinc-200/70 pt-5 text-center">
          <div style={DISP} className="text-[13px] font-semibold tracking-tight text-zinc-700">{COMPANY_LEGAL}</div>
          <p className="mt-1 text-xs text-zinc-400">Professional fleet management · {VEHICLE} · Ludhiana & Chandigarh tricity, Punjab</p>
          <p className="mt-1 text-xs text-zinc-400">© {NOW.getFullYear()} {COMPANY_LEGAL} · data is stored locally in this browser · figures are estimates, not accounting or tax advice</p>
          <button onClick={resetData} className="mt-2 rounded-full px-3 py-1 text-[11px] font-medium text-zinc-400 transition-colors duration-200 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-400/30">
            Reset to sample data
          </button>
        </footer>
      </main>
    </div>
  );
}
