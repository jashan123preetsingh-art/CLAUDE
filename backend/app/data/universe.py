"""A curated seed universe of liquid NSE names with sector + F&O flags.

Used directly by the synthetic provider and as a fallback symbol list for the
real providers when an instrument master download is unavailable. This is a
representative slice, not the full ~2000-name universe; real providers fetch
the complete instrument master at runtime.
"""
from __future__ import annotations

from app.models.schemas import Exchange, StockMeta

# (symbol, name, sector, market_cap_cr, is_fno)
_SEED: list[tuple[str, str, str, float, bool]] = [
    ("RELIANCE", "Reliance Industries", "Energy", 1900000, True),
    ("TCS", "Tata Consultancy Services", "IT", 1300000, True),
    ("HDFCBANK", "HDFC Bank", "Banking", 1250000, True),
    ("INFY", "Infosys", "IT", 640000, True),
    ("ICICIBANK", "ICICI Bank", "Banking", 830000, True),
    ("BHARTIARTL", "Bharti Airtel", "Telecom", 900000, True),
    ("SBIN", "State Bank of India", "Banking", 720000, True),
    ("LT", "Larsen & Toubro", "Infrastructure", 490000, True),
    ("ITC", "ITC", "FMCG", 560000, True),
    ("KOTAKBANK", "Kotak Mahindra Bank", "Banking", 350000, True),
    ("HINDUNILVR", "Hindustan Unilever", "FMCG", 570000, True),
    ("AXISBANK", "Axis Bank", "Banking", 360000, True),
    ("MARUTI", "Maruti Suzuki", "Auto", 400000, True),
    ("SUNPHARMA", "Sun Pharmaceutical", "Pharma", 380000, True),
    ("TITAN", "Titan Company", "Consumer", 300000, True),
    ("ASIANPAINT", "Asian Paints", "Consumer", 260000, True),
    ("BAJFINANCE", "Bajaj Finance", "NBFC", 450000, True),
    ("NESTLEIND", "Nestle India", "FMCG", 240000, True),
    ("ULTRACEMCO", "UltraTech Cement", "Cement", 320000, True),
    ("WIPRO", "Wipro", "IT", 260000, True),
    ("ADANIENT", "Adani Enterprises", "Infrastructure", 320000, True),
    ("TATAMOTORS", "Tata Motors", "Auto", 350000, True),
    ("TATASTEEL", "Tata Steel", "Metals", 190000, True),
    ("POWERGRID", "Power Grid Corp", "Utilities", 290000, True),
    ("NTPC", "NTPC", "Utilities", 350000, True),
    ("HCLTECH", "HCL Technologies", "IT", 460000, True),
    ("JSWSTEEL", "JSW Steel", "Metals", 230000, True),
    ("TECHM", "Tech Mahindra", "IT", 160000, True),
    ("PIDILITIND", "Pidilite Industries", "Chemicals", 150000, True),
    ("DIVISLAB", "Divi's Laboratories", "Pharma", 150000, True),
    ("CIPLA", "Cipla", "Pharma", 130000, True),
    ("GRASIM", "Grasim Industries", "Cement", 170000, True),
    ("COALINDIA", "Coal India", "Metals", 280000, True),
    ("HINDALCO", "Hindalco Industries", "Metals", 150000, True),
    ("DRREDDY", "Dr Reddy's Labs", "Pharma", 105000, True),
    ("EICHERMOT", "Eicher Motors", "Auto", 130000, True),
    ("BAJAJ-AUTO", "Bajaj Auto", "Auto", 260000, True),
    ("BRITANNIA", "Britannia Industries", "FMCG", 130000, True),
    ("APOLLOHOSP", "Apollo Hospitals", "Healthcare", 100000, True),
    ("TATACONSUM", "Tata Consumer", "FMCG", 110000, True),
    ("DMART", "Avenue Supermarts", "Retail", 290000, False),
    ("PERSISTENT", "Persistent Systems", "IT", 90000, True),
    ("POLYCAB", "Polycab India", "Capital Goods", 100000, True),
    ("CGPOWER", "CG Power", "Capital Goods", 90000, True),
    ("TRENT", "Trent", "Retail", 220000, True),
    ("BEL", "Bharat Electronics", "Defence", 220000, True),
    ("HAL", "Hindustan Aeronautics", "Defence", 300000, True),
    ("VBL", "Varun Beverages", "FMCG", 180000, True),
    ("ABB", "ABB India", "Capital Goods", 150000, True),
    ("SIEMENS", "Siemens", "Capital Goods", 200000, True),
]


def seed_universe() -> list[StockMeta]:
    metas: list[StockMeta] = []
    for sym, name, sector, mcap, fno in _SEED:
        metas.append(
            StockMeta(
                symbol=sym,
                name=name,
                exchange=Exchange.NSE,
                sector=sector,
                market_cap_cr=float(mcap),
                is_fno=fno,
                listed_days=1500,
            )
        )
    return metas
