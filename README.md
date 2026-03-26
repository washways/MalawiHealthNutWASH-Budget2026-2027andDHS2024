# Malawi WASH Budget vs DHS Dashboard

Pure HTML/CSS/JS dashboard comparing Malawi 2026/27 CDF-linked WASH budget signals against DHS 2024 district indicators.

## Main files

- `index.html` - dashboard layout
- `src/styles.css` - dashboard styling
- `src/app.js` - map and analytics logic
- `scripts/prepare_dashboard_data.py` - data preparation pipeline

## Data included

- `data/extracted/` - full imported extraction set from `2026to27budgetAnalysis/extracted`
- `FR398_wash_district_extract_ranked_fixed.xlsx` - original DHS extract workbook that feeds the district summaries
- `data/cdf_budget_2026_2027.json`
- `data/malawi_districts_city_geo.json`
- `data/dhs2024_district_wash_summary.json`
- `data/dhs2024_mpi_support_summary.json`
- `data/budget_dhs_joined_districts_2026_2027.json`
- `data/budget_dhs_patterns_2026_2027.json`
- `data/dashboard_data_bundle.js` (file-open friendly bundle for `index.html`)

## What this dashboard now includes

- Simplified district-only geometries (reduced slivers/artifacts and removed city/municipal overlays)
- Multi-tab workflow:
  - `Overview` (core budget vs WASH maps, alignment comparisons, and the district comparison table)
  - `DHS & Nutrition Maps` (expanded indicator gallery plus nutrition risk and need overlays)
  - `Methodology` (detailed need and underfunding formulas and narrative context)
  - `Budget Deep Dives` (flat WASH/Health/Nutrition tabs that connect national votes, CDF district envelopes, cost categories, and staffing-sensitive personnel envelopes)

Additional highlights:
- More DHS indicator maps (including clean cooking/lighting, urban water access, and nutrition markers) powered by the joined DHS + FR398 extract.
- Nutrition indicator profile chart showing how stunting, wasting, and underweight averages relate to the 15% stunting target.
- Sector panels that explain major cost categories, large projects, and staffing pressure through accessible cards, charts, and tables.

## Regenerate derived data

```powershell
python scripts/prepare_dashboard_data.py
```

## Run locally

You can open [`index.html`](./index.html) directly now.  
The dashboard includes `data/dashboard_data_bundle.js` so it works even under `file://`.

If you prefer a local server:

Use any static server (example):

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080/`.
