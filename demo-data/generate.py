#!/usr/bin/env python3
# Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"""
Generate a realistic, fully synthetic DEALER GROUP dataset for the OhMyDash
framework layer. One group, 12 rooftops, mixed brands and sizes, multi-metric,
month grain. Everything here is invented: no real dealer, no real numbers, no PII.

    python3 demo-data/generate.py                 # the full 36-month scenario (dormancy story)
    python3 demo-data/generate.py --months 13     # the same scenario, last 13 months only
    python3 demo-data/generate.py --out demo-data # output directory

The scenario always ends at END_MONTH (fixed, so the numbers never drift with the calendar) and
is always generated in full before it is sliced, so --months 13 is the tail of the same data.

Why this exists (vs sample-data/leads_monthly.csv):
  sample-data/ is the SIMPLE dataset for the 90-minute class: one file, 3 stores.
  demo-data/ is the RICH dataset for the framework layer: a whole dealer group,
  several metric families, and the messy real-world problems the DB + chat layer
  are meant to solve:
    - dealer group -> dealership hierarchy (dealer_group.json)
    - lead-source names that DIFFER across rooftops for the same source
      (leads_monthly.csv has the raw names; normalization/source_aliases.csv maps
       them to a canonical name -- this is the normalization step the DB teaches)
    - multiple metric families at the same month grain (leads, inventory, spend,
      GA4 traffic) so KPI trend lines, drilldowns and the AI analyst chat have
      real depth to work on.

Deliberately plants the patterns the dashboards are meant to find:
  - dormant sources  (produced well, then stopped entirely ~18 months ago)
  - declining sources (still alive but far below their own peak)
  - steady performers (the control group)
  - a seasonal source (so month-over-month charts are not flat)
  - one rooftop with a CRM cutover mid-window (a real failure mode: a whole
    lead feed goes to zero because an integration was never reconnected).
    The store keeps selling: the sales its internet sources would have made
    show up under Walk In instead, so the store's total does not collapse.
    That is what feed loss looks like, and it is different from lost business.

Fixed seed, so everyone in the room gets the same numbers and the same answers.
"""

import argparse
import csv
import json
import random
from pathlib import Path

SEED = 20260916  # workshop date, memorable and stable
END_MONTH = "2026-09"   # the scenario's last month; fixed on purpose
SCENARIO_MONTHS = 36    # always generate this many, then slice
SCENARIO_VERSION = 3

AGENCY = {"agency_id": "northline-automotive-partners", "agency_name": "Northline Automotive Partners"}

# Two dealer groups under one agency, so the data has the level above the group that a real
# analytics vendor sees. Rooftop: id, display name, brand, size scale (relative volume), region.
# Uneven sizes on purpose, so "All Stores" rollups are not uniform and a GM can tell which stores
# drive the group.
SUMMIT_ROOFTOPS = [
    ("smt-toy-fairview",   "Summit Toyota of Fairview",     "Toyota",     1.00, "West"),
    ("smt-hon-westland",   "Summit Honda Westland",         "Honda",      0.86, "West"),
    ("smt-frd-rivera",     "Summit Ford Rivera",            "Ford",       0.92, "South"),
    ("smt-chv-glenpark",   "Summit Chevrolet Glenpark",     "Chevrolet",  0.78, "South"),
    ("smt-nsn-ridgemont",  "Summit Nissan Ridgemont",       "Nissan",     0.64, "North"),
    ("smt-hyu-oakhurst",   "Summit Hyundai Oakhurst",       "Hyundai",    0.58, "North"),
    ("smt-kia-brookfield", "Summit Kia Brookfield",         "Kia",        0.55, "East"),
    ("smt-maz-lakeside",   "Summit Mazda Lakeside",         "Mazda",      0.44, "East"),
    ("smt-sub-northgate",  "Summit Subaru Northgate",       "Subaru",     0.49, "North"),
    ("smt-jep-clearwater", "Summit Jeep Ram Clearwater",    "Jeep Ram",   0.71, "South"),
    ("smt-vw-eastdale",    "Summit Volkswagen Eastdale",    "Volkswagen", 0.40, "East"),
    ("smt-bmw-summit",     "Summit BMW",                    "BMW",        0.83, "West"),
]
HARBOR_ROOFTOPS = [
    ("hbr-toy-bayview",    "Harbor Toyota Bayview",         "Toyota",     0.95, "Coast"),
    ("hbr-hon-seaside",    "Harbor Honda Seaside",          "Honda",      0.80, "Coast"),
    ("hbr-frd-portside",   "Harbor Ford Portside",          "Ford",       0.88, "Coast"),
    ("hbr-chv-marina",     "Harbor Chevrolet Marina",       "Chevrolet",  0.70, "Inland"),
    ("hbr-kia-lighthouse", "Harbor Kia Lighthouse",         "Kia",        0.52, "Inland"),
    ("hbr-sub-tidewater",  "Harbor Subaru Tidewater",       "Subaru",     0.47, "Coast"),
    ("hbr-jep-anchor",     "Harbor Jeep Ram Anchor",        "Jeep Ram",   0.66, "Inland"),
    ("hbr-bmw-harbor",     "Harbor BMW",                    "BMW",        0.78, "Coast"),
]
GROUPS = [
    {"group_id": "summit-auto-group", "group_name": "Summit Auto Group", "rooftops": SUMMIT_ROOFTOPS},
    {"group_id": "harbor-motor-group", "group_name": "Harbor Motor Group", "rooftops": HARBOR_ROOFTOPS},
]
# flattened: group name, rooftop id, display name, brand, scale, region
ROOFTOPS = [(g["group_name"], rid, name, brand, scale, region)
            for g in GROUPS for (rid, name, brand, scale, region) in g["rooftops"]]
GROUP_ID = {g["group_name"]: g["group_id"] for g in GROUPS}

# canonical source, lead_type, base leads/mo, close rate, avg gross, pattern, monthly budget
# gross is intentionally brand-agnostic here; a luxury rooftop scales it up below.
SOURCES = [
    ("Autotrader",           "internet",  320, 0.070, 2900, "steady",    4200),
    ("Cars.com",             "internet",  190, 0.082, 3050, "steady",    3100),
    ("CarGurus",             "internet",  240, 0.061, 2780, "declining", 3800),
    ("Dealer Website",       "internet",  410, 0.115, 3400, "steady",    None),
    ("Lease Return",         "campaign",   70, 0.298, 1700, "declining", None),
    ("Service Conquest",     "service",    55, 0.210, 2100, "dormant",   None),
    ("Direct Mail Q1",       "campaign",  120, 0.090, 2450, "dormant",   6500),
    ("Walk In",              "showroom",   95, 0.340, 3600, "steady",    None),
    ("Inbound Calls",        "phone",     140, 0.190, 3150, "steady",    None),
    ("Website Chat",         "chat",       88, 0.075, 2600, "steady",     900),
    ("Facebook Marketplace", "internet",  160, 0.045, 2200, "seasonal",  1400),
    ("TrueCar",              "internet",  110, 0.068, 2500, "declining", 2600),
    # a thin one: a few leads a month, a handful of sales in three years, then dead.
    # It exists so the 5-sale floor has something to catch ("insufficient data", not a dollar).
    ("Radio Spot",           "campaign",    3, 0.040, 2300, "dormant",    400),
]

# The normalization problem: each rooftop's CRM writes source names differently.
# The dashboard/DB has to map all of these back to the canonical name above.
# alias -> canonical. A few canonical names also appear verbatim (identity).
SOURCE_ALIASES = {
    "Autotrader":            "Autotrader",
    "AutoTrader.com":        "Autotrader",
    "auto trader":           "Autotrader",
    "ATC":                   "Autotrader",
    "Cars.com":              "Cars.com",
    "Cars .com":             "Cars.com",
    "CARS":                  "Cars.com",
    "CarGurus":              "CarGurus",
    "Car Gurus":             "CarGurus",
    "cargurus.com":          "CarGurus",
    "Dealer Website":        "Dealer Website",
    "Website":               "Dealer Website",
    "OEM Website":           "Dealer Website",
    "Lease Return":          "Lease Return",
    "Lease Retention":       "Lease Return",
    "Service Conquest":      "Service Conquest",
    "Svc Conquest":          "Service Conquest",
    "Direct Mail Q1":        "Direct Mail Q1",
    "Direct Mail":           "Direct Mail Q1",
    "Walk In":               "Walk In",
    "Walk-In":               "Walk In",
    "Showroom":              "Walk In",
    "Inbound Calls":         "Inbound Calls",
    "Phone Up":              "Inbound Calls",
    "Inbound Phone":         "Inbound Calls",
    "Website Chat":          "Website Chat",
    "Chat":                  "Website Chat",
    "Live Chat":             "Website Chat",
    "Facebook Marketplace":  "Facebook Marketplace",
    "FB Marketplace":        "Facebook Marketplace",
    "Facebook":              "Facebook Marketplace",
    "TrueCar":               "TrueCar",
    "True Car":              "TrueCar",
    "Radio Spot":            "Radio Spot",
    "Radio":                 "Radio Spot",
}

# For each canonical source, the set of raw spellings we will actually emit,
# assigned per-rooftop so different stores use different spellings of the same source.
ALIASES_BY_CANON = {}
for alias, canon in SOURCE_ALIASES.items():
    ALIASES_BY_CANON.setdefault(canon, []).append(alias)

# Vehicle catalogue for the unit-level files (no VINs; stock numbers are synthetic)
MODELS = {
    "Toyota": ["Camry","RAV4","Tacoma","Corolla","Highlander","Tundra"],
    "Honda": ["Civic","CR-V","Accord","Pilot","Odyssey","HR-V"],
    "Ford": ["F-150","Escape","Explorer","Bronco","Maverick","Mustang"],
    "Chevrolet": ["Silverado","Equinox","Traverse","Tahoe","Trax","Malibu"],
    "Nissan": ["Rogue","Altima","Sentra","Frontier","Pathfinder","Kicks"],
    "Hyundai": ["Tucson","Elantra","Santa Fe","Palisade","Kona","Sonata"],
    "Kia": ["Sportage","Telluride","Sorento","K5","Forte","Seltos"],
    "Mazda": ["CX-5","CX-50","Mazda3","CX-90","CX-30","MX-5"],
    "Subaru": ["Outback","Forester","Crosstrek","Ascent","Impreza","WRX"],
    "Jeep Ram": ["Wrangler","Grand Cherokee","Ram 1500","Compass","Gladiator","Ram 2500"],
    "Volkswagen": ["Tiguan","Atlas","Jetta","Taos","ID.4","Golf GTI"],
    "BMW": ["X3","X5","3 Series","5 Series","X1","i4"],
}
USED_MAKES = ["Toyota","Honda","Ford","Chevrolet","Nissan","Hyundai","Kia","Subaru","Jeep Ram","BMW"]
SERVICE_OPCODES = [("Maintenance", .46), ("Repair", .27), ("Tires", .09), ("Recall", .06), ("Warranty", .12)]

GA4_CHANNELS = [
    ("Organic Search", 0.34),
    ("Paid Search",    0.21),
    ("Direct",         0.16),
    ("Organic Social", 0.10),
    ("Paid Social",    0.08),
    ("Referral",       0.06),
    ("Email",          0.05),
]


def months_back(n, end=END_MONTH):
    y, m = int(end[:4]), int(end[5:])
    out = []
    for _ in range(n):
        out.append(f"{y:04d}-{m:02d}")
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return list(reversed(out))


def multiplier(pattern, i, total, rng):
    """Activity multiplier for month index i (0 = oldest)."""
    frac = i / max(1, total - 1)
    if pattern == "steady":
        return rng.uniform(0.85, 1.15)
    if pattern == "declining":
        return max(0.0, (1.25 - 1.0 * frac)) * rng.uniform(0.85, 1.15)
    if pattern == "dormant":
        # produced for the first ~55% of the window, then stops dead
        return 0.0 if frac > 0.55 else rng.uniform(0.9, 1.25)
    if pattern == "seasonal":
        month = int(i % 12)
        season = 1.0 + 0.55 * (1 if 2 <= month <= 7 else -1) * rng.uniform(0.6, 1.0)
        return max(0.15, season)
    return 1.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=SCENARIO_MONTHS,
                    help="keep only the last N months of the fixed scenario (1..36)")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    keep = max(1, min(SCENARIO_MONTHS, args.months))

    rng = random.Random(SEED)
    periods = months_back(SCENARIO_MONTHS)
    out_dir = Path(args.out) if args.out else Path(__file__).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "normalization").mkdir(exist_ok=True)

    # Pick, per rooftop, which raw spelling it uses for each canonical source.
    # Stable per rooftop so a store's naming is internally consistent, like a real CRM.
    rooftop_spelling = {}
    for gname, rid, *_ in ROOFTOPS:
        srng = random.Random(f"{SEED}:{rid}")
        rooftop_spelling[rid] = {
            canon: srng.choice(spellings) for canon, spellings in ALIASES_BY_CANON.items()
        }

    # One rooftop suffers a CRM cutover: its internet feed dies partway through.
    CUTOVER_ROOFTOP = "smt-hyu-oakhurst"
    cutover_idx = int(SCENARIO_MONTHS * 0.62)

    lead_rows = []
    inv_rows = []
    spend_rows = []
    ga_rows = []

    for gname, rid, name, brand, scale, region in ROOFTOPS:
        luxury = 1.6 if brand in ("BMW",) else 1.0
        redirected = {}   # cutover rooftop: sales its dead internet feed would have logged
        walkin_row = {}   # period -> index into lead_rows for this rooftop's Walk In row
        for canon, ltype, base, close, gross, pattern, budget in SOURCES:
            raw_name = rooftop_spelling[rid][canon]
            for i, period in enumerate(periods):
                mult = multiplier(pattern, i, len(periods), rng)
                cut = rid == CUTOVER_ROOFTOP and ltype == "internet" and i >= cutover_idx
                leads = int(base * scale * mult)
                if leads <= 0:
                    continue  # a dead source produces no row, exactly like a real export
                sales = 0
                for _ in range(leads):
                    if rng.random() < close * rng.uniform(0.8, 1.2):
                        sales += 1
                pct_new = 0.55 if ltype in ("internet", "chat") else 0.72
                new_s = int(round(sales * pct_new))
                used_s = sales - new_s
                total_gross = int(sales * gross * luxury * rng.uniform(0.85, 1.15))
                if cut:
                    # CRM cutover: the internet feed stops logging. The customers still
                    # buy; the CRM records them as walk-ins. No row for this source.
                    r = redirected.setdefault(period, {"sales": 0, "new": 0, "used": 0, "gross": 0})
                    r["sales"] += sales; r["new"] += new_s; r["used"] += used_s; r["gross"] += total_gross
                    continue
                if canon == "Walk In":
                    walkin_row[period] = len(lead_rows)
                lead_rows.append({
                    "period": period,
                    "group": gname,
                    "store": name,
                    "source": raw_name,          # raw, un-normalized (the real world)
                    "lead_type": ltype,
                    "leads": leads,
                    "sales": sales,
                    "new_sales": new_s,
                    "used_sales": used_s,
                    "gross": total_gross,
                    "budget": int(budget * scale) if budget else "",
                })
        for period, r in redirected.items():
            row = lead_rows[walkin_row[period]]
            row["leads"] += int(round(r["sales"] / 0.34))   # walk-ins close at ~34%
            row["sales"] += r["sales"]; row["new_sales"] += r["new"]
            row["used_sales"] += r["used"]; row["gross"] += r["gross"]

        # inventory (one row per store per month)
        for i, period in enumerate(periods):
            base_inv = int(240 * scale)
            new_units = int(base_inv * 0.55 * rng.uniform(0.8, 1.2))
            used_units = int(base_inv * 0.45 * rng.uniform(0.8, 1.2))
            inv_rows.append({
                "period": period,
                "group": gname,
                "store": name,
                "new_units": new_units,
                "used_units": used_units,
                "avg_days_on_lot": round(rng.uniform(28, 74), 1),
                "avg_price_to_market": round(rng.uniform(94.0, 104.0), 1),
            })

        # ad spend by channel (pairs with GA4 traffic)
        for i, period in enumerate(periods):
            for ch, share in GA4_CHANNELS:
                if ch in ("Organic Search", "Direct", "Organic Social", "Referral", "Email"):
                    continue  # only paid channels carry spend
                monthly = int(9000 * scale * share * rng.uniform(0.8, 1.2))
                spend_rows.append({
                    "period": period, "group": gname, "store": name, "channel": ch, "spend": monthly,
                })

        # GA4 traffic by channel
        for i, period in enumerate(periods):
            base_sessions = int(22000 * scale * rng.uniform(0.85, 1.15))
            for ch, share in GA4_CHANNELS:
                sessions = int(base_sessions * share)
                users = int(sessions * rng.uniform(0.72, 0.86))
                vdp = int(sessions * rng.uniform(0.45, 0.62))
                conv = int(sessions * rng.uniform(0.010, 0.028))
                ga_rows.append({
                    "period": period, "group": gname, "store": name, "channel": ch,
                    "sessions": sessions, "users": users,
                    "vdp_views": vdp, "conversions": conv,
                })

    # ---- deal-level DMS file, service, unit-level inventory, lead-level CRM ----
    # All synthetic. Deals reconcile to leads_monthly sales per store/month/source (same totals).
    deal_rows = []; ro_rows = []; unit_rows = []; leadlevel_rows = []
    deal_no = 100000; lead_no = 5000000; stock_no = 30000
    brand_of = {name: brand for gname, rid, name, brand, scale, region in ROOFTOPS}
    scale_of = {name: scale for gname, rid, name, brand, scale, region in ROOFTOPS}
    ltype_of = {}
    for r in lead_rows:
        ltype_of[(r["store"], r["source"])] = r["lead_type"]
    for r in lead_rows:
        y, m = int(r["period"][:4]), int(r["period"][5:])
        dim = [31,28,31,30,31,30,31,31,30,31,30,31][m-1] + (1 if (m == 2 and y % 4 == 0) else 0)
        brand = brand_of[r["store"]]
        n = r["sales"]; new_left = r["new_sales"]
        avg_gross = (r["gross"] / n) if n else 0
        for k in range(n):
            deal_no += 1
            is_new = new_left > 0; new_left -= 1 if is_new else 0
            make = brand if is_new or rng.random() < 0.55 else rng.choice(USED_MAKES)
            model = rng.choice(MODELS[make])
            front = max(200, int(avg_gross * rng.uniform(0.55, 1.05)))
            back = max(0, int(avg_gross * rng.uniform(0.15, 0.55)))
            deal_rows.append({
                "deal_id": f"D{deal_no}", "date": f"{r['period']}-{rng.randint(1, dim):02d}",
                "group": r["group"], "store": r["store"], "source": r["source"], "lead_type": r["lead_type"],
                "new_used": "new" if is_new else "used", "make": make, "model": model,
                "model_year": (y if is_new else y - rng.randint(1, 7)),
                "sale_price": int((38000 if is_new else 24000) * (1.6 if brand == "BMW" else 1.0) * rng.uniform(0.75, 1.3)),
                "front_gross": front, "back_gross": back,
                "fi_products": rng.choice([0, 0, 1, 1, 2, 3]),
                "salesperson_id": f"SP{hash((r['store'], rng.randint(1, 14))) % 900 + 100:03d}",
                "days_to_close": rng.randint(0, 45),
            })
    # service: one row per store per month per op-code family
    for gname, rid, name, brand, scale, region in ROOFTOPS:
        for i, period in enumerate(periods):
            ros = int(520 * scale * rng.uniform(0.85, 1.15) * (1.08 if i % 12 in (2, 3, 4, 9, 10) else 1.0))
            for op, share in SERVICE_OPCODES:
                k = int(ros * share)
                if k == 0: continue
                labor = int(k * rng.uniform(140, 260)); parts = int(k * rng.uniform(90, 210))
                ro_rows.append({"period": period, "group": gname, "store": name, "opcode_family": op, "ro_count": k,
                                "labor_revenue": labor, "parts_revenue": parts,
                                "customer_pay": 0 if op in ("Warranty", "Recall") else 1,
                                "avg_hours": round(rng.uniform(0.8, 3.4), 1)})
    # unit-level inventory: a snapshot as of completed_through, one row per vehicle on the lot
    for gname, rid, name, brand, scale, region in ROOFTOPS:
        units = int(240 * scale)
        for k in range(units):
            stock_no += 1
            is_new = rng.random() < 0.55
            make = brand if is_new or rng.random() < 0.5 else rng.choice(USED_MAKES)
            model = rng.choice(MODELS[make]); ey = int(periods[-1][:4])
            days = int(rng.expovariate(1 / 48)) + 1
            price = int((38000 if is_new else 24000) * (1.6 if brand == "BMW" else 1.0) * rng.uniform(0.7, 1.35))
            unit_rows.append({"stock_number": f"S{stock_no}", "group": gname, "store": name, "new_used": "new" if is_new else "used",
                              "make": make, "model": model, "model_year": ey if is_new else ey - rng.randint(1, 8),
                              "days_on_lot": days, "list_price": price,
                              "cost": int(price * rng.uniform(0.86, 0.97)),
                              "price_to_market_pct": round(rng.uniform(93.0, 106.0), 1),
                              "vdp_views_30d": int(rng.expovariate(1 / 180)),
                              "leads_30d": rng.choice([0, 0, 0, 1, 1, 2, 3, 5])})
    # lead-level CRM: the last 13 months, one row per lead, status funnel, no customer fields
    tail13 = set(periods[-13:])
    for r in lead_rows:
        if r["period"] not in tail13: continue
        y, m = int(r["period"][:4]), int(r["period"][5:])
        dim = [31,28,31,30,31,30,31,31,30,31,30,31][m-1] + (1 if (m == 2 and y % 4 == 0) else 0)
        n = r["leads"]; sold = r["sales"]
        for k in range(n):
            lead_no += 1
            is_sold = k < sold
            u = rng.random()
            status = "sold" if is_sold else ("appointment_shown" if u < 0.10 else "appointment_set" if u < 0.22 else "contacted" if u < 0.62 else "new")
            leadlevel_rows.append({"lead_id": f"L{lead_no}", "date": f"{r['period']}-{rng.randint(1, dim):02d}",
                                   "group": r["group"], "store": r["store"], "source": r["source"], "lead_type": r["lead_type"],
                                   "status": status, "new_used_interest": rng.choice(["new", "new", "used"]),
                                   "response_minutes": rng.choice([3, 5, 8, 12, 20, 35, 60, 120, 480, None]),
                                   "sold": 1 if is_sold else 0})

    # ---- slice to the requested tail of the scenario ----
    if keep < len(periods):
        keep_set = set(periods[-keep:])
        lead_rows = [r for r in lead_rows if r["period"] in keep_set]
        inv_rows = [r for r in inv_rows if r["period"] in keep_set]
        spend_rows = [r for r in spend_rows if r["period"] in keep_set]
        ga_rows = [r for r in ga_rows if r["period"] in keep_set]
        deal_rows = [r for r in deal_rows if r["date"][:7] in keep_set]
        ro_rows = [r for r in ro_rows if r["period"] in keep_set]
        leadlevel_rows = [r for r in leadlevel_rows if r["date"][:7] in keep_set]
        cutover_idx -= (SCENARIO_MONTHS - keep)
        periods = periods[-keep:]

    # ---- order: monthly files by month then store, detail files by date, so the top of any
    # file already shows many stores and both groups ----
    for rows in (lead_rows, inv_rows, spend_rows, ga_rows, ro_rows):
        rows.sort(key=lambda r: (r["period"], r["group"], r["store"]))
    deal_rows.sort(key=lambda r: (r["date"], r["store"]))
    leadlevel_rows.sort(key=lambda r: (r["date"], r["store"]))
    unit_rows.sort(key=lambda r: (-r["days_on_lot"], r["store"]))

    # ---- write files ----
    def write_csv(path, rows, cols):
        with open(path, "w", newline="") as fh:
            w = csv.DictWriter(fh, fieldnames=cols)
            w.writeheader()
            w.writerows(rows)

    write_csv(out_dir / "leads_monthly.csv", lead_rows,
              ["period", "group", "store", "source", "lead_type", "leads",
               "sales", "new_sales", "used_sales", "gross", "budget"])
    write_csv(out_dir / "inventory_monthly.csv", inv_rows,
              ["period", "group", "store", "new_units", "used_units",
               "avg_days_on_lot", "avg_price_to_market"])
    write_csv(out_dir / "spend_monthly.csv", spend_rows,
              ["period", "group", "store", "channel", "spend"])
    write_csv(out_dir / "ga4_channels.csv", ga_rows,
              ["period", "group", "store", "channel", "sessions", "users",
               "vdp_views", "conversions"])

    write_csv(out_dir / "dms_deals.csv", deal_rows,
              ["deal_id", "date", "group", "store", "source", "lead_type", "new_used", "make", "model", "model_year",
               "sale_price", "front_gross", "back_gross", "fi_products", "salesperson_id", "days_to_close"])
    write_csv(out_dir / "service_monthly.csv", ro_rows,
              ["period", "group", "store", "opcode_family", "ro_count", "labor_revenue", "parts_revenue", "customer_pay", "avg_hours"])
    write_csv(out_dir / "inventory_units.csv", unit_rows,
              ["stock_number", "group", "store", "new_used", "make", "model", "model_year", "days_on_lot", "list_price", "cost",
               "price_to_market_pct", "vdp_views_30d", "leads_30d"])
    write_csv(out_dir / "crm_leads.csv", leadlevel_rows,
              ["lead_id", "date", "group", "store", "source", "lead_type", "status", "new_used_interest", "response_minutes", "sold"])

    # normalization map: alias -> canonical
    with open(out_dir / "normalization" / "source_aliases.csv", "w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["raw_source", "canonical_source"])
        for alias, canon in sorted(SOURCE_ALIASES.items()):
            w.writerow([alias, canon])

    # dealer group manifest (the hierarchy the DB layer builds on)
    manifest = {
        "agency_id": AGENCY["agency_id"],
        "agency_name": AGENCY["agency_name"],
        "groups": [
            {"group_id": g["group_id"], "group_name": g["group_name"],
             "rooftops": [{"store_id": rid, "store": name, "brand": brand, "region": region}
                          for (rid, name, brand, scale, region) in g["rooftops"]]}
            for g in GROUPS
        ],
        "rooftops": [
            {"store_id": rid, "store": name, "brand": brand, "region": region, "group_id": GROUP_ID[gname]}
            for gname, rid, name, brand, scale, region in ROOFTOPS
        ],
        "period_range": [periods[0], periods[-1]],
        "months": len(periods),
        "metric_files": {
            "leads": "leads_monthly.csv",
            "inventory": "inventory_monthly.csv",
            "spend": "spend_monthly.csv",
            "ga4": "ga4_channels.csv",
            "service": "service_monthly.csv",
        },
        "detail_files": {
            "dms_deals": {"file": "dms_deals.csv", "grain": "one row per sold vehicle, 36 months; front_gross + back_gross per store/month/source sums to leads_monthly.gross, deal count to sales"},
            "crm_leads": {"file": "crm_leads.csv", "grain": "one row per lead, last 13 months; count per store/month/source equals leads_monthly.leads, sold=1 count equals sales"},
            "inventory_units": {"file": "inventory_units.csv", "grain": "one row per vehicle on the lot as of completed_through; no VINs, synthetic stock numbers"},
        },
        "normalization": "normalization/source_aliases.csv",
        "knowledge": "knowledge",
        "scenario_version": SCENARIO_VERSION,
        "seed": SEED,
        "completed_through": periods[-1],
        "currency": "USD",
        "cutover": {"store_id": CUTOVER_ROOFTOP, "lead_type": "internet",
                    "first_missing_month": periods[cutover_idx] if cutover_idx < len(periods) else None},
        "notes": [
            "two dealer groups under one agency; every file carries group and store, and the "
            "flattened rooftops list carries group_id, so a loader can build agency -> group -> "
            "dealership without guessing",
            "source names in leads_monthly.csv are RAW and differ across rooftops; "
            "map them with normalization/source_aliases.csv",
            "every month through completed_through is a complete month; a source with no row "
            "in a month had no activity that month (the export is zero-suppressed)",
            "Summit Hyundai Oakhurst has a CRM cutover: its internet feed drops to zero "
            "partway through the window. The store keeps selling; those sales appear under "
            "Walk In. Feed loss, not lost business: the recovery screen must flag it, not "
            "count it as recoverable revenue",
        ],
    }
    with open(out_dir / "dealer_group.json", "w") as fh:
        json.dump(manifest, fh, indent=2)

    # ---- expected results, so a build can be checked against the fixture ----
    canon_of = SOURCE_ALIASES
    last = periods[-1]
    def tot(rows, key): return sum(r[key] for r in rows)
    by_store = {}; by_group_store = {}
    for r in lead_rows:
        if r["period"] == last:
            d = by_store.setdefault(r["store"], {"leads": 0, "sales": 0, "gross": 0})
            d["leads"] += r["leads"]; d["sales"] += r["sales"]; d["gross"] += r["gross"]
            by_group_store.setdefault(r["group"], {})[r["store"]] = d
    last_rows = [r for r in lead_rows if r["period"] == last]
    def group_block(gname):
        rows = [r for r in last_rows if r["group"] == gname]; stores = by_group_store[gname]
        return {"leads": tot(rows, "leads"), "sales": tot(rows, "sales"), "gross": tot(rows, "gross"),
                "closing_ratio_pct": round(tot(rows, "sales") / tot(rows, "leads") * 100, 4),
                "mean_of_store_ratios_pct_WRONG": round(sum(d["sales"] / d["leads"] for d in stores.values()) / len(stores) * 100, 4),
                "rooftops": len(stores)}
    expected = {
        "scenario_version": SCENARIO_VERSION,
        "period_range": [periods[0], periods[-1]],
        "analysis_month": last,
        "rows": {"leads_monthly": len(lead_rows), "inventory_monthly": len(inv_rows),
                 "spend_monthly": len(spend_rows), "ga4_channels": len(ga_rows),
                 "service_monthly": len(ro_rows), "dms_deals": len(deal_rows),
                 "inventory_units": len(unit_rows), "crm_leads": len(leadlevel_rows)},
        "reconciliation": {
            "dms_deals_count_equals_total_sales": len(deal_rows) == sum(r["sales"] for r in lead_rows),
            "crm_leads_count_last_13_months": len(leadlevel_rows),
            "crm_leads_sold_equals_sales_last_13_months": sum(r["sold"] for r in leadlevel_rows) == sum(r["sales"] for r in lead_rows if r["period"] in set(periods[-13:])),
        },
        "raw_source_spellings": len({r["source"] for r in lead_rows}),
        "canonical_sources": len({canon_of[r["source"]] for r in lead_rows}),
        "agency_latest_month": {
            "leads": tot(last_rows, "leads"), "sales": tot(last_rows, "sales"),
            "gross": tot(last_rows, "gross"),
            "closing_ratio_pct": round(tot(last_rows, "sales") / tot(last_rows, "leads") * 100, 4),
            "rooftops": len(by_store),
        },
        "groups_latest_month": {g["group_name"]: group_block(g["group_name"]) for g in GROUPS},
        "group_latest_month": group_block("Summit Auto Group"),
        "stores_latest_month": {k: {**v, "closing_ratio_pct": round(v["sales"] / v["leads"] * 100, 4)}
                                for k, v in sorted(by_store.items())},
        "planted": {
            "dormant_group_level": sorted(s[0] for s in SOURCES if s[5] == "dormant"),
            "declining_group_level": sorted(s[0] for s in SOURCES if s[5] == "declining"),
            "steady": sorted(s[0] for s in SOURCES if s[5] in ("steady", "seasonal")),
            "feed_loss": {"store": "Summit Hyundai Oakhurst", "lead_type": "internet",
                          "first_missing_month": periods[cutover_idx] if cutover_idx < len(periods) else None,
                          "note": "every internet source at this store goes to zero leads in the same "
                                  "month while Walk In sales jump; flag as feed loss, exclude from the "
                                  "recoverable headline"},
        },
        "thin_source": {"name": "Radio Spot", "note": "at most 3 sales in the whole window at any "
                        "single rooftop, so per rooftop it is dormant with 'insufficient data' and "
                        "in neither headline; pooled for the group it has 18 sales and does get an "
                        "estimate. That difference is the point"},
        "how_to_use": "compare unrounded totals exactly; recovery estimates depend on the window and "
                      "the 5-sale floor, so check statuses and the feed-loss flag rather than dollars",
    }
    with open(out_dir / "expected-results.json", "w") as fh:
        json.dump(expected, fh, indent=2)

    # ---- summary ----
    dormant = {s[0] for s in SOURCES if s[5] == "dormant"}
    declining = {s[0] for s in SOURCES if s[5] == "declining"}
    print(f"wrote demo group data to {out_dir}/")
    print(f"  agency: {AGENCY['agency_name']}  |  {len(GROUPS)} dealer groups  |  {len(ROOFTOPS)} rooftops  |  "
          f"{len(periods)} months ({periods[0]} to {periods[-1]})")
    for g in GROUPS: print(f"    {g['group_name']}: {len(g['rooftops'])} rooftops")
    print(f"  leads_monthly.csv     {len(lead_rows):,} rows")
    print(f"  inventory_monthly.csv {len(inv_rows):,} rows")
    print(f"  spend_monthly.csv     {len(spend_rows):,} rows")
    print(f"  ga4_channels.csv      {len(ga_rows):,} rows")
    print(f"  service_monthly.csv   {len(ro_rows):,} rows")
    print(f"  dms_deals.csv         {len(deal_rows):,} rows (one per sold vehicle)")
    print(f"  inventory_units.csv   {len(unit_rows):,} rows (one per vehicle on the lot)")
    print(f"  crm_leads.csv         {len(leadlevel_rows):,} rows (one per lead, last 13 months)")
    print(f"  source_aliases.csv    {len(SOURCE_ALIASES)} raw spellings -> "
          f"{len(ALIASES_BY_CANON)} canonical sources")
    print(f"  planted dormant:   {', '.join(sorted(dormant))}")
    print(f"  planted declining: {', '.join(sorted(declining))}")
    print(f"  CRM cutover:       Summit Hyundai Oakhurst internet feed dies at "
          f"{periods[cutover_idx] if cutover_idx < len(periods) else 'n/a (sliced away)'}; "
          f"its sales continue under Walk In")
    for g in GROUPS:
        print(f"  expected-results.json: {g['group_name']} {last} closing ratio "
              f"{expected['groups_latest_month'][g['group_name']]['closing_ratio_pct']}% (sum-based)")
    print(f"  total sales {sum(r['sales'] for r in lead_rows):,} | "
          f"total gross ${sum(r['gross'] for r in lead_rows):,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
