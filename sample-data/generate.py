#!/usr/bin/env python3
# Author: Alex Oleynik, alexanderoleynik2@gmail.com. Find me in the Claude for Dealers Slack (https://claudefordealers.slack.com/team/U0C2J6K79CN) or on LinkedIn (https://www.linkedin.com/in/alexanderoleynik/). Free to use for the Claude for Dealers community. Keep this line when you or your agent change the file, so you know who to ask for help.
"""
Generate the class sample data: a realistic CRM lead-source file and a matching website
traffic file, both at month grain, matching DATA-SPEC.md.

    python3 sample-data/generate.py            # writes leads_monthly.csv + traffic_monthly.csv

Every source has a life of its own, the way real vendors do: launches from zero, ramps to a peak
and fades, campaigns that run in bursts, a feed that died, seasonality, a slow growth trend, and
month-to-month noise. The Revenue Recovery screen is meant to find:

  - dormant sources   (produced well, then stopped entirely)
  - declining sources (still alive but far below their own peak)
  - steady performers (the control group)
  - one launched-then-collapsed paid source, one brand-new source with thin evidence

Fixed seed, so everyone in the room gets the same numbers and the same answers.
"""

import argparse
import csv
import math
import random
from pathlib import Path

SEED = 20260916  # workshop date, memorable and stable
END_MONTH = (2026, 8)  # the last complete month in the file
STORES = [
    # name, size scale, closing-ratio modifier
    ("Nissan Boardman", 1.00, 0.95),
    ("Chevrolet Cranberry", 0.74, 1.10),
    ("Honda Monroeville", 0.58, 1.05),
]
# The showroom sells more in spring, summer and the year-end push.
SEASON = [0.86, 0.90, 1.04, 1.06, 1.10, 1.08, 1.04, 1.10, 1.00, 0.95, 0.90, 1.06]

# name, {lead_type: share of leads}, base leads/mo (all types, biggest store), close, avg gross,
# pattern, monthly budget (biggest store) or None, pattern parameters
SOURCES = [
    ("Dealer Website",   {"internet": 0.86, "chat": 0.14}, 470, 0.112, 3400, "trend",    None, {"growth": 0.12}),
    ("Autotrader",       {"internet": 1.0},                300, 0.070, 2900, "trend",    4200, {"growth": -0.09}),
    ("Cars.com",         {"internet": 1.0},                185, 0.082, 3050, "trend",    3100, {"growth": 0.02}),
    ("CarGurus",         {"internet": 0.8, "phone": 0.2},  250, 0.061, 2780, "rise_cliff", 3800, {"low": 0.18, "rise_from": 12, "peak_at": 22, "cliff_at": 34}),
    ("Google Ads",       {"internet": 0.65, "phone": 0.25, "campaign": 0.10}, 240, 0.200, 2100, "launch_fade", 5200, {"launch_at": 14, "peak_at": 25, "dead_at": 34}),
    ("Lease Return",     {"campaign": 1.0},                 90, 0.298, 1700, "burst_decline", None, {"every": 3, "fade": 0.75}),
    ("Service Conquest", {"service": 1.0},                  60, 0.210, 2100, "dormant",  None, {"dies_at": 20}),
    ("Direct Mail Q1",   {"campaign": 1.0},                140, 0.090, 2450, "q1_bursts", 6500, {"last_year": 2025}),
    ("Walk In",          {"showroom": 1.0},                 95, 0.340, 3600, "trend",    None, {"growth": 0.0}),
    ("Inbound Calls",    {"phone": 1.0},                   140, 0.190, 3150, "recent_dip", None, {"dip_months": 2, "dip": 0.55}),
    ("Website Chat",     {"chat": 1.0},                     70, 0.075, 2600, "trend",     900, {"growth": 0.30}),
    ("Facebook Marketplace", {"internet": 1.0},            150, 0.045, 2200, "seasonal", 1400, {"amp": 0.6}),
    ("TrueCar",          {"internet": 1.0},                115, 0.068, 2500, "trend",    2600, {"growth": -0.74}),
    ("TikTok Ads",       {"internet": 1.0},                 55, 0.030, 2000, "new",      1600, {"starts_at": 31}),
    ("Craigslist",       {"internet": 1.0},                 45, 0.050, 2300, "dormant",  None, {"dies_at": 9}),
]


def months(n):
    y, m = END_MONTH
    out = []
    for _ in range(n):
        out.append((y, m))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return list(reversed(out))


def bell(i, center, width):
    return math.exp(-((i - center) ** 2) / (2 * width ** 2))


def activity(pattern, p, i, total, ym, rng):
    """Activity multiplier for month index i (0 = oldest). 0 means no row that month."""
    frac = i / max(1, total - 1)
    if pattern == "trend":
        return (1.0 + p["growth"]) ** frac
    if pattern == "seasonal":
        return 1.0 + p["amp"] * (bell(ym[1], 5.5, 2.2) - 0.35) * 2
    if pattern == "rise_cliff":
        if i >= p["cliff_at"]:
            return 0.0
        if i < p["rise_from"]:
            return p["low"] * rng.uniform(0.7, 1.3)
        if i <= p["peak_at"]:
            t = (i - p["rise_from"]) / (p["peak_at"] - p["rise_from"])
            return p["low"] + (1.0 - p["low"]) * (t ** 1.4)
        # past the peak: slide down before the cliff
        t = (i - p["peak_at"]) / max(1, p["cliff_at"] - p["peak_at"])
        return 1.0 - 0.75 * t
    if pattern == "launch_fade":
        if i < p["launch_at"] or i >= p["dead_at"]:
            return 0.0
        if i <= p["peak_at"]:
            t = (i - p["launch_at"]) / (p["peak_at"] - p["launch_at"])
            return 0.15 + 0.85 * math.sin(t * math.pi / 2)
        t = (i - p["peak_at"]) / max(1, p["dead_at"] - p["peak_at"])
        return max(0.05, 1.0 - 0.9 * t)
    if pattern == "burst_decline":
        on = (i % p["every"]) == 0
        return (1.0 if on else 0.35) * (1.0 - p["fade"] * frac)
    if pattern == "dormant":
        return 0.0 if i >= p["dies_at"] else 1.0 + 0.15 * math.sin(i / 2.0)
    if pattern == "q1_bursts":
        y, m = ym
        if y > p["last_year"] or m > 3:
            return 0.0
        return [1.0, 1.25, 0.8][m - 1]
    if pattern == "recent_dip":
        return p["dip"] if i >= total - p["dip_months"] else 1.0
    if pattern == "new":
        if i < p["starts_at"]:
            return 0.0
        return 0.3 + 0.7 * ((i - p["starts_at"]) / max(1, total - 1 - p["starts_at"]))
    return 1.0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--months", type=int, default=36)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()
    rng = random.Random(SEED)
    grid = months(args.months)
    total = len(grid)
    out_dir = Path(args.out or Path(__file__).parent)

    # ---- CRM leads ------------------------------------------------------------
    rows = []
    for store, scale, close_mod in STORES:
        # every store leans on different vendors; this is what makes group rollups non-uniform
        store_mix = {name: rng.uniform(0.7, 1.3) for name, *_ in SOURCES}
        for name, types, base, close, gross, pattern, budget, params in SOURCES:
            for i, ym in enumerate(grid):
                act = activity(pattern, params, i, total, ym, rng)
                if act <= 0:
                    continue
                season = SEASON[ym[1] - 1] if pattern not in ("q1_bursts",) else 1.0
                month_leads = base * scale * store_mix[name] * act * season * rng.uniform(0.88, 1.12)
                for ltype, share in types.items():
                    leads = int(round(month_leads * share))
                    if leads <= 0:
                        continue
                    # closing ratio drifts a little month to month and by store
                    cr = close * close_mod * rng.uniform(0.82, 1.18)
                    if pattern == "recent_dip" and i >= total - params["dip_months"]:
                        cr *= 0.6  # the phone team stopped closing, not just fewer calls
                    sales = sum(1 for _ in range(leads) if rng.random() < cr)
                    pct_new = 0.55 if ltype in ("internet", "chat") else 0.72
                    if name == "Google Ads":
                        pct_new = 0.41
                    if name == "CarGurus":
                        pct_new = 0.20
                    new_s = int(round(sales * pct_new))
                    used_s = sales - new_s
                    total_gross = int(sales * gross * rng.uniform(0.85, 1.15))
                    rows.append({
                        "period": f"{ym[0]:04d}-{ym[1]:02d}",
                        "store": store,
                        "source": name,
                        "lead_type": ltype,
                        "leads": leads,
                        "sales": sales,
                        "new_sales": new_s,
                        "used_sales": used_s,
                        "gross": total_gross,
                        "budget": int(budget * scale * share * max(act, 0.3)) if budget else "",
                    })
    rows.sort(key=lambda r: (r["period"], r["store"], r["source"], r["lead_type"]))
    cols = ["period", "store", "source", "lead_type", "leads", "sales",
            "new_sales", "used_sales", "gross", "budget"]
    with open(out_dir / "leads_monthly.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)

    # ---- Website traffic (GA4 style, source / medium) ---------------------------
    # channel, base sessions/mo (biggest store), vdp views per session, form rate, call rate, pattern, params
    CHANNELS = [
        ("google / organic",     14000, 1.9, 0.0075, 0.0110, "trend",       {"growth": 0.10}),
        ("google / cpc",          7200, 1.6, 0.0110, 0.0160, "seasonal",    {"amp": 0.5}),
        ("direct / (none)",       5200, 1.2, 0.0060, 0.0090, "trend",       {"growth": 0.04}),
        ("bing / cpc",            1400, 1.5, 0.0090, 0.0120, "trend",       {"growth": -0.15}),
        ("facebook / paid",       4200, 1.1, 0.0040, 0.0050, "dormant",     {"dies_at": 29}),
        ("iHeartMedia / radio",   6500, 1.7, 0.0045, 0.0100, "rise_cliff",  {"low": 0.15, "rise_from": 4, "peak_at": 9, "cliff_at": 16}),
        ("cars.com / referral",   2300, 2.4, 0.0130, 0.0080, "trend",       {"growth": 0.0}),
        ("autotrader / referral", 2600, 2.6, 0.0120, 0.0070, "trend",       {"growth": -0.66}),
        ("email / newsletter",     900, 1.3, 0.0200, 0.0060, "burst_decline", {"every": 2, "fade": 0.2}),
        ("tiktok / paid",         1800, 0.8, 0.0020, 0.0030, "new",         {"starts_at": 30}),
    ]
    traffic = []
    for store, scale, _ in STORES:
        for ch, base, vdp_per, form_rate, call_rate, pattern, params in CHANNELS:
            for i, ym in enumerate(grid):
                act = activity(pattern, params, i, total, ym, rng)
                if ch == "iHeartMedia / radio" and act <= 0:
                    # the radio campaign came back for a second flight and faded again
                    act = 0.5 * bell(i, 29, 3.0)
                    if act < 0.05:
                        act = 0.0
                if act <= 0:
                    continue
                sessions = int(base * scale * act * SEASON[ym[1] - 1] * rng.uniform(0.9, 1.1))
                if sessions <= 0:
                    continue
                users = int(sessions * rng.uniform(0.7, 0.8))
                # engagement and conversion move on their own clocks: VDP depth
                # drifts with inventory season, lead rates with the offers running,
                # so the three lines on the timeline do not simply trace each other
                vdp_mult = 1.0 + 0.35 * math.sin(i / 2.7 + (sum(map(ord, ch)) % 7)) + rng.uniform(-0.12, 0.12)
                conv_mult = 1.0 + 0.45 * math.sin(i / 4.1 + (sum(map(ord, ch)) % 5) + 1.3) + rng.uniform(-0.15, 0.15)
                vdp = int(sessions * vdp_per * max(0.4, vdp_mult))
                forms = int(sessions * form_rate * max(0.3, conv_mult))
                calls = int(sessions * call_rate * max(0.3, conv_mult * rng.uniform(0.85, 1.15)))
                traffic.append({
                    "period": f"{ym[0]:04d}-{ym[1]:02d}",
                    "store": store,
                    "channel": ch,
                    "sessions": sessions,
                    "users": users,
                    "vdp_views": vdp,
                    "form_submissions": forms,
                    "click_to_call": calls,
                    "conversions": forms + calls,
                })
    traffic.sort(key=lambda r: (r["period"], r["store"], r["channel"]))
    tcols = ["period", "store", "channel", "sessions", "users", "vdp_views",
             "form_submissions", "click_to_call", "conversions"]
    with open(out_dir / "traffic_monthly.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=tcols)
        w.writeheader()
        w.writerows(traffic)

    first, last = grid[0], grid[-1]
    print(f"wrote {out_dir / 'leads_monthly.csv'}: {len(rows):,} rows, {total} months "
          f"({first[0]}-{first[1]:02d} to {last[0]}-{last[1]:02d}), {len(STORES)} stores, {len(SOURCES)} sources")
    print(f"wrote {out_dir / 'traffic_monthly.csv'}: {len(traffic):,} rows, {len(CHANNELS)} channels")
    print(f"  total sales {sum(r['sales'] for r in rows):,} | total gross ${sum(r['gross'] for r in rows):,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
