from __future__ import annotations

import json
import math
import re
from pathlib import Path

import pandas as pd

ROOT = Path(r"c:\Users\jrobertson\Repositories\WASHBudgetandDHS2024")
DATA_DIR = ROOT / "data"
ASSETS_DIR = ROOT / "assets"

SOURCE_HTML = ASSETS_DIR / "WaterBoards&CDFMapEmbed.html"
XLSX_PATH = ROOT / "FR398_wash_district_extract_ranked_fixed.xlsx"



def extract_bracketed(text: str, start_idx: int, open_ch: str, close_ch: str) -> tuple[str, int]:
    depth = 0
    in_string = False
    quote = ""
    escaped = False
    begin = -1

    for idx in range(start_idx, len(text)):
        ch = text[idx]
        if in_string:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                in_string = False
            continue

        if ch in ('"', "'"):
            in_string = True
            quote = ch
            continue

        if ch == open_ch:
            if depth == 0:
                begin = idx
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0 and begin != -1:
                return text[begin : idx + 1], idx

    raise ValueError(f"Could not find balanced {open_ch}{close_ch} section")


def js_object_array_to_json(js_text: str):
    # Quote object keys so this can be parsed as JSON.
    patched = re.sub(r'([\{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:', r'\1"\2":', js_text)
    return json.loads(patched)


def normalize_name(name: str) -> str:
    key = str(name or "").lower().strip()
    key = key.replace("'", "")
    key = re.sub(r"[^a-z0-9]+", " ", key)
    key = re.sub(r"\s+", " ", key).strip()

    aliases = {
        "blantyre city council": "blantyre city",
        "blantyre district council": "blantyre",
        "lilongwe city council": "lilongwe city",
        "lilongwe district council": "lilongwe",
        "mzuzu city council": "mzuzu city",
        "zomba city council": "zomba city",
        "zomba district council": "zomba",
        "kasungu district council": "kasungu",
        "mangochi district council": "mangochi",
        "karonga district council": "karonga",
        "karonga town council": "karonga town",
        "karonga town": "karonga town",
        "likoma district council": "likoma",
        "nkhata bay district council": "nkhata bay",
        "nkhotakota district council": "nkhotakota",
        "mmbelwa district council": "mzimba",
        "mmbelwa": "mzimba",
        "m belwa district council": "mzimba",
        "m belwa": "mzimba",
        "nkhatabay": "nkhata bay",
        "nkhotahota": "nkhotakota",
        "luchenza minicipal": "luchenza municipal",
        "likoma islands": "likoma",
    }
    if key in aliases:
        return aliases[key]

    for suffix in (
        " district council",
        " city council",
        " district",
        " municipality",
    ):
        if key.endswith(suffix):
            key = key[: -len(suffix)].strip()

    return key


def to_district_level(canonical: str) -> str:
    city_or_town = {
        "blantyre city": "blantyre",
        "lilongwe city": "lilongwe",
        "zomba city": "zomba",
        "mzuzu city": "mzimba",
        "kasungu municipal": "kasungu",
        "luchenza municipal": "thyolo",
        "mangochi municipal": "mangochi",
        "karonga town": "karonga",
    }
    return city_or_town.get(canonical, canonical)


def clean_sheet(sheet_name: str, header_row: int = 3) -> list[dict]:
    df = pd.read_excel(XLSX_PATH, sheet_name=sheet_name, header=header_row)
    cols = [str(c).strip() for c in df.columns]
    df.columns = cols
    if "district" not in [c.lower() for c in cols]:
        return []

    # Use the first district-like column as district.
    district_col = next(c for c in df.columns if c.lower() == "district")
    df = df[df[district_col].notna()].copy()
    df[district_col] = df[district_col].astype(str).str.strip()
    df = df[df[district_col] != ""]

    # Convert numeric columns where possible.
    for col in df.columns:
        if col == district_col:
            continue
        try:
            df[col] = pd.to_numeric(df[col])
        except Exception:
            # Keep non-numeric string columns untouched.
            pass

    records = df.to_dict(orient="records")

    cleaned = []
    for row in records:
        fixed = {}
        for k, v in row.items():
            if isinstance(v, (float, int)) and isinstance(v, float) and math.isnan(v):
                fixed[k] = None
            elif hasattr(v, "item"):
                fixed[k] = v.item()
            else:
                fixed[k] = v
        cleaned.append(fixed)
    return cleaned


def pearson(xs: list[float], ys: list[float]) -> float | None:
    if len(xs) < 3 or len(ys) < 3 or len(xs) != len(ys):
        return None
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    num = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    den_x = math.sqrt(sum((x - mean_x) ** 2 for x in xs))
    den_y = math.sqrt(sum((y - mean_y) ** 2 for y in ys))
    if den_x == 0 or den_y == 0:
        return None
    return num / (den_x * den_y)


def ring_area(ring: list[list[float]]) -> float:
    if len(ring) < 4:
        return 0.0
    area = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i][0], ring[i][1]
        x2, y2 = ring[i + 1][0], ring[i + 1][1]
        area += (x1 * y2) - (x2 * y1)
    return abs(area) / 2.0


def point_line_distance(point, start, end) -> float:
    px, py = point
    sx, sy = start
    ex, ey = end
    dx = ex - sx
    dy = ey - sy
    if dx == 0 and dy == 0:
        return math.sqrt((px - sx) ** 2 + (py - sy) ** 2)
    t = ((px - sx) * dx + (py - sy) * dy) / ((dx * dx) + (dy * dy))
    t = max(0.0, min(1.0, t))
    cx = sx + (t * dx)
    cy = sy + (t * dy)
    return math.sqrt((px - cx) ** 2 + (py - cy) ** 2)


def simplify_line(points: list[list[float]], epsilon: float) -> list[list[float]]:
    if len(points) <= 2:
        return points
    start = points[0]
    end = points[-1]
    max_dist = -1.0
    index = -1
    for i in range(1, len(points) - 1):
        dist = point_line_distance(points[i], start, end)
        if dist > max_dist:
            max_dist = dist
            index = i
    if max_dist > epsilon and index != -1:
        left = simplify_line(points[: index + 1], epsilon)
        right = simplify_line(points[index:], epsilon)
        return left[:-1] + right
    return [start, end]


def simplify_ring(ring: list[list[float]], epsilon: float = 0.008) -> list[list[float]]:
    if not ring:
        return ring
    closed = ring[0] == ring[-1]
    base = ring[:-1] if closed else ring[:]
    if len(base) < 3:
        return ring
    simplified = simplify_line(base, epsilon)
    if len(simplified) < 3:
        simplified = base[:3]
    simplified.append(simplified[0])
    return simplified


def simplify_geometry(geometry: dict) -> dict | None:
    gtype = geometry.get("type")
    coords = geometry.get("coordinates")
    if not coords:
        return None

    if gtype == "Polygon":
        outer = coords[0] if coords else []
        simp = simplify_ring(outer)
        if len(simp) < 4:
            return None
        return {"type": "Polygon", "coordinates": [simp]}

    if gtype == "MultiPolygon":
        best_poly = None
        best_area = -1.0
        for poly in coords:
            if not poly:
                continue
            outer = poly[0]
            area = ring_area(outer)
            if area > best_area:
                best_area = area
                best_poly = outer
        if not best_poly:
            return None
        simp = simplify_ring(best_poly)
        if len(simp) < 4:
            return None
        return {"type": "Polygon", "coordinates": [simp]}

    return None


def simplify_geojson(geojson: dict) -> dict:
    seen_districts: set[str] = set()
    features = []
    for feature in geojson.get("features", []):
        properties = feature.get("properties", {})
        district_name = str(properties.get("DistrictNa") or "").strip()
        if not district_name:
            continue
        # Keep district-level map clean by removing city/municipal/town overlays.
        lowered = district_name.lower()
        if " city" in lowered or "municipal" in lowered or "minicipal" in lowered or " town" in lowered:
            continue
        district_key = to_district_level(normalize_name(district_name))
        if district_key in seen_districts:
            continue

        geometry = feature.get("geometry")
        if not geometry:
            continue
        simplified = simplify_geometry(geometry)
        if not simplified:
            continue
        seen_districts.add(district_key)
        features.append(
            {
                "type": "Feature",
                "id": feature.get("id"),
                "properties": properties,
                "geometry": simplified,
            }
        )
    return {"type": "FeatureCollection", "features": features}


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    html = SOURCE_HTML.read_text(encoding="utf-8")

    cdf_idx = html.index("cdf:")
    cdf_array_text, _ = extract_bracketed(html, html.index("[", cdf_idx), "[", "]")
    cdf_rows = js_object_array_to_json(cdf_array_text)

    geo_idx = html.index("const embeddedGeoJson")
    geo_json_text, _ = extract_bracketed(html, html.index("{", geo_idx), "{", "}")
    geojson_raw = json.loads(geo_json_text)
    geojson = simplify_geojson(geojson_raw)

    district_summary = clean_sheet("District_WASH_Summary", header_row=3)
    mpi_support = clean_sheet("MPI_Support_Summary", header_row=3)

    for row in cdf_rows:
        row["canonical_name"] = normalize_name(row.get("district", ""))
        row["district_level_name"] = to_district_level(row["canonical_name"])
        row["cdf_potential_10pct"] = row["total"] * 0.10

    budget_by_district = {}
    for row in cdf_rows:
        key = row["district_level_name"]
        if key not in budget_by_district:
            budget_by_district[key] = {
                "district_level_name": key,
                "total_budget_mwk": 0,
                "construction_budget_mwk": 0,
                "district_wide_mwk": 0,
                "bursaries_mwk": 0,
                "project_mgmt_mwk": 0,
                "disaster_mwk": 0,
                "women_mwk": 0,
                "youth_mwk": 0,
                "source_rows": [],
            }
        agg = budget_by_district[key]
        agg["total_budget_mwk"] += row.get("total", 0)
        agg["construction_budget_mwk"] += row.get("construction", 0)
        agg["district_wide_mwk"] += row.get("districtWide", 0)
        agg["bursaries_mwk"] += row.get("bursaries", 0)
        agg["project_mgmt_mwk"] += row.get("projectMgmt", 0)
        agg["disaster_mwk"] += row.get("disaster", 0)
        agg["women_mwk"] += row.get("women", 0)
        agg["youth_mwk"] += row.get("youth", 0)
        agg["source_rows"].append(row.get("district"))

    joined = []
    for row in district_summary:
        district_name = row.get("district")
        canonical = normalize_name(district_name)
        budget = budget_by_district.get(canonical)
        if not budget:
            continue

        # Need score: higher means more WASH deprivation pressure.
        need_components = [
            100 - float(row.get("basic_water_service_pct") or 0),
            100 - float(row.get("basic_sanitation_service_pct") or 0),
            100 - float(row.get("basic_handwashing_facility_pct") or 0),
            100 - float(row.get("safely_managed_drinking_water_pct") or 0),
            float(row.get("open_defecation_pct") or 0),
            float(row.get("e_coli_in_household_water_pct") or 0),
        ]
        need_index = sum(need_components) / len(need_components)
        stunting_pct = float(row.get("stunting_pct") or 0)
        wasting_pct = float(row.get("wasting_pct") or 0)
        underweight_pct = float(row.get("underweight_pct") or 0)
        nutrition_risk_index = (stunting_pct + wasting_pct + underweight_pct) / 3.0
        need_nutrition_blend_index = (0.7 * need_index) + (0.3 * nutrition_risk_index)

        total_budget = float(budget["total_budget_mwk"])
        per_need = total_budget / (need_index + 1)

        joined.append(
            {
                "district": district_name,
                "canonical_name": canonical,
                "total_budget_mwk": total_budget,
                "construction_budget_mwk": float(budget["construction_budget_mwk"]),
                "cdf_potential_10pct_mwk": total_budget * 0.10,
                "need_index": round(need_index, 3),
                "nutrition_risk_index": round(nutrition_risk_index, 3),
                "need_nutrition_blend_index": round(need_nutrition_blend_index, 3),
                "budget_per_need_unit": round(per_need, 3),
                "basic_water_service_pct": row.get("basic_water_service_pct"),
                "basic_sanitation_service_pct": row.get("basic_sanitation_service_pct"),
                "basic_handwashing_facility_pct": row.get("basic_handwashing_facility_pct"),
                "safely_managed_drinking_water_pct": row.get("safely_managed_drinking_water_pct"),
                "open_defecation_pct": row.get("open_defecation_pct"),
                "e_coli_in_household_water_pct": row.get("e_coli_in_household_water_pct"),
                "without_water_on_premises_pct": row.get("without_water_on_premises_pct"),
                "stunting_pct": row.get("stunting_pct"),
                "wasting_pct": row.get("wasting_pct"),
                "underweight_pct": row.get("underweight_pct"),
            }
        )

    # Rank gaps for pattern-finding.
    joined_sorted_budget = sorted(joined, key=lambda x: x["total_budget_mwk"], reverse=True)
    joined_sorted_need = sorted(joined, key=lambda x: x["need_index"], reverse=True)
    joined_sorted_need_nutrition = sorted(joined, key=lambda x: x["need_nutrition_blend_index"], reverse=True)
    budget_rank = {row["canonical_name"]: i + 1 for i, row in enumerate(joined_sorted_budget)}
    need_rank = {row["canonical_name"]: i + 1 for i, row in enumerate(joined_sorted_need)}
    need_nutrition_rank = {row["canonical_name"]: i + 1 for i, row in enumerate(joined_sorted_need_nutrition)}

    for row in joined:
        b_rank = budget_rank[row["canonical_name"]]
        n_rank = need_rank[row["canonical_name"]]
        nn_rank = need_nutrition_rank[row["canonical_name"]]
        row["budget_rank"] = b_rank
        row["need_rank"] = n_rank
        row["rank_gap_budget_minus_need"] = b_rank - n_rank
        row["need_nutrition_rank"] = nn_rank
        row["rank_gap_budget_minus_need_nutrition"] = b_rank - nn_rank

    indicators = [
        "basic_water_service_pct",
        "basic_sanitation_service_pct",
        "basic_handwashing_facility_pct",
        "safely_managed_drinking_water_pct",
        "open_defecation_pct",
        "e_coli_in_household_water_pct",
        "without_water_on_premises_pct",
        "stunting_pct",
        "wasting_pct",
        "underweight_pct",
        "need_index",
        "nutrition_risk_index",
        "need_nutrition_blend_index",
    ]
    correlations = []
    for key in indicators:
        xs = [float(row["total_budget_mwk"]) for row in joined if row.get(key) is not None]
        ys = [float(row[key]) for row in joined if row.get(key) is not None]
        corr = pearson(xs, ys)
        correlations.append({"indicator": key, "pearson_with_budget": round(corr, 4) if corr is not None else None})

    patterns = {
        "top_budget_districts": [
            {"district": row["district"], "total_budget_mwk": row["total_budget_mwk"]}
            for row in joined_sorted_budget[:10]
        ],
        "highest_need_districts": [
            {"district": row["district"], "need_index": row["need_index"]}
            for row in joined_sorted_need[:10]
        ],
        "highest_combined_need_nutrition_districts": [
            {"district": row["district"], "need_nutrition_blend_index": row["need_nutrition_blend_index"]}
            for row in joined_sorted_need_nutrition[:10]
        ],
        "highest_nutrition_risk_districts": [
            {"district": row["district"], "nutrition_risk_index": row["nutrition_risk_index"]}
            for row in sorted(joined, key=lambda x: x["nutrition_risk_index"], reverse=True)[:10]
        ],
        "budget_vs_need_rank_gap_most_overfunded_signal": sorted(
            [{"district": row["district"], "rank_gap": row["rank_gap_budget_minus_need"]} for row in joined],
            key=lambda x: x["rank_gap"],
        )[:10],
        "budget_vs_need_rank_gap_most_underfunded_signal": sorted(
            [{"district": row["district"], "rank_gap": row["rank_gap_budget_minus_need"]} for row in joined],
            key=lambda x: x["rank_gap"],
            reverse=True,
        )[:10],
        "budget_vs_need_nutrition_rank_gap_most_overfunded_signal": sorted(
            [{"district": row["district"], "rank_gap": row["rank_gap_budget_minus_need_nutrition"]} for row in joined],
            key=lambda x: x["rank_gap"],
        )[:10],
        "budget_vs_need_nutrition_rank_gap_most_underfunded_signal": sorted(
            [{"district": row["district"], "rank_gap": row["rank_gap_budget_minus_need_nutrition"]} for row in joined],
            key=lambda x: x["rank_gap"],
            reverse=True,
        )[:10],
        "correlations": correlations,
    }

    (DATA_DIR / "cdf_budget_2026_2027.json").write_text(json.dumps(cdf_rows, indent=2), encoding="utf-8")
    (DATA_DIR / "malawi_districts_city_geo.json").write_text(json.dumps(geojson), encoding="utf-8")
    (DATA_DIR / "dhs2024_district_wash_summary.json").write_text(json.dumps(district_summary, indent=2), encoding="utf-8")
    (DATA_DIR / "dhs2024_mpi_support_summary.json").write_text(json.dumps(mpi_support, indent=2), encoding="utf-8")
    (DATA_DIR / "budget_dhs_joined_districts_2026_2027.json").write_text(json.dumps(joined, indent=2), encoding="utf-8")
    (DATA_DIR / "budget_dhs_patterns_2026_2027.json").write_text(json.dumps(patterns, indent=2), encoding="utf-8")

    bundle = {
        "cdf": cdf_rows,
        "dhs": district_summary,
        "joined": joined,
        "patterns": patterns,
        "geo": geojson,
    }
    (DATA_DIR / "dashboard_data_bundle.js").write_text(
        "window.DASHBOARD_DATA = " + json.dumps(bundle) + ";",
        encoding="utf-8",
    )

    print("Wrote datasets:")
    for path in [
        DATA_DIR / "cdf_budget_2026_2027.json",
        DATA_DIR / "malawi_districts_city_geo.json",
        DATA_DIR / "dhs2024_district_wash_summary.json",
        DATA_DIR / "dhs2024_mpi_support_summary.json",
        DATA_DIR / "budget_dhs_joined_districts_2026_2027.json",
        DATA_DIR / "budget_dhs_patterns_2026_2027.json",
        DATA_DIR / "dashboard_data_bundle.js",
    ]:
        print(" -", path.name, path.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
