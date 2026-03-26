const DATA_PATHS = {
  cdf: "data/cdf_budget_2026_2027.json",
  dhs: "data/dhs2024_district_wash_summary.json",
  joined: "data/budget_dhs_joined_districts_2026_2027.json",
  patterns: "data/budget_dhs_patterns_2026_2027.json",
  geo: "data/malawi_districts_city_geo.json",
  childImpacts: "data/child_health_impacts_malawi_gbd2023.json",
  doc5CentralTables: "data/extracted/doc-5-2026-27-program-based-budget---central-ministries-and-departments/tables.json",
  doc5CentralDoc: "data/extracted/doc-5-2026-27-program-based-budget---central-ministries-and-departments/document.json",
  doc5SubventedTables: "data/extracted/doc-5-2026-27-program-based-budget---subvented-organisations/tables.json",
  doc5SubventedDoc: "data/extracted/doc-5-2026-27-program-based-budget---subvented-organisations/document.json",
  doc6PsipDoc: "data/extracted/doc-6-2026-27-public-sector-investment-program/document.json"
};

const state = {
  cdfRows: [],
  dhsRows: [],
  joinedRows: [],
  patterns: null,
  features: [],
  budgetByCanonical: new Map(),
  budgetByDistrict: new Map(),
  dhsByCanonical: new Map(),
  joinedByCanonical: new Map(),
  selectedCanonical: null,
  activeTab: "overview",
  cdfMetric: "total_budget_mwk",
  indicatorMetric: "need_index",
  search: "",
  tableSort: "need_index_desc",
  currency: "MWK",
  usdRate: null,
  extractedProjects: [],
  extractedCostCategories: [],
  extractedPrograms: [],
  childImpactBundle: null,
  childImpactRows: [],
  childImpactFilters: {
    measure: "DALYs (Disability-Adjusted Life Years)",
    metric: "Number",
    mode: "absolute",
    topN: 10,
    causeFilter: "",
    ages: []
  },
  childImpactSector: "wash",
  childImpactCharts: {},
  washWeights: {
    water_gap: 1,
    sanitation_gap: 1,
    handwashing_gap: 1,
    safe_water_gap: 1,
    open_defecation_risk: 1,
    e_coli_risk: 1
  },
  nutritionWeights: {
    stunting_pct: 1,
    wasting_pct: 1,
    underweight_pct: 1
  },
  joinedRowsBase: null
};

const WASH_WEIGHT_CONFIG = [
  { key: "water_gap", label: "Basic water gap", inputId: "washWeightWater", valueId: "washWeightWaterValue" },
  { key: "sanitation_gap", label: "Basic sanitation gap", inputId: "washWeightSanitation", valueId: "washWeightSanitationValue" },
  { key: "handwashing_gap", label: "Handwashing gap", inputId: "washWeightHandwashing", valueId: "washWeightHandwashingValue" },
  { key: "safe_water_gap", label: "Safely managed water gap", inputId: "washWeightSafeWater", valueId: "washWeightSafeWaterValue" },
  { key: "open_defecation_risk", label: "Open defecation risk", inputId: "washWeightOpenDefecation", valueId: "washWeightOpenDefecationValue" },
  { key: "e_coli_risk", label: "E. coli risk", inputId: "washWeightEcoli", valueId: "washWeightEcoliValue" }
];

const NUTRITION_WEIGHT_CONFIG = [
  { key: "stunting_pct", label: "Stunting", inputId: "nutritionWeightStunting", valueId: "nutritionWeightStuntingValue" },
  { key: "wasting_pct", label: "Wasting", inputId: "nutritionWeightWasting", valueId: "nutritionWeightWastingValue" },
  { key: "underweight_pct", label: "Underweight", inputId: "nutritionWeightUnderweight", valueId: "nutritionWeightUnderweightValue" }
];

const metricCatalog = {
  total_budget_mwk: {
    label: "CDF Total Allocation",
    value: (ctx) => ctx.budgetRow ? Number(ctx.budgetRow.total) : null,
    format: formatMoney,
    palette: ["#edf6f8", "#b9e1e8", "#7fc9d5", "#45aeba", "#0b6e80", "#084d5a"],
    legendNote: "Higher = larger visible CDF budget allocation."
  },
  construction_budget_mwk: {
    label: "CDF Construction/Rehab Allocation",
    value: (ctx) => ctx.budgetRow ? Number(ctx.budgetRow.construction) : null,
    format: formatMoney,
    palette: ["#f2f8fb", "#c6e2ee", "#92c8de", "#5da9ca", "#2d87b6", "#13689b"],
    legendNote: "Higher = larger construction-oriented district envelope."
  },
  cdf_potential_10pct: {
    label: "Potential 10% WASH Share",
    value: (ctx) => ctx.budgetRow ? Number(ctx.budgetRow.cdf_potential_10pct || (ctx.budgetRow.total * 0.10)) : null,
    format: formatMoney,
    palette: ["#f4f8ee", "#d9e8bd", "#bed991", "#93bf67", "#679e3f", "#4a7b26"],
    legendNote: "Scenario view using 10% of district CDF as potential WASH envelope."
  },
  cdf_construction_share_pct: {
    label: "Construction Share Of CDF (%)",
    value: (ctx) => {
      if (!ctx.budgetRow || !ctx.budgetRow.total) return null;
      return (Number(ctx.budgetRow.construction) / Number(ctx.budgetRow.total)) * 100;
    },
    format: formatPct,
    palette: ["#fff6e8", "#f7d7a8", "#efbb6e", "#e79f3f", "#cc7f24", "#9f5f10"],
    legendNote: "Higher = larger share going to construction and rehabilitation."
  },
  need_index: {
    label: "WASH Risk Index (0-100)",
    value: (ctx) => ctx.joinedRow ? Number(ctx.joinedRow.need_index) : null,
    format: formatNum,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Higher = higher WASH risk (service-pressure/deprivation)."
  },
  basic_water_service_pct: {
    label: "Basic Water Service (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.basic_water_service_pct) : null,
    format: formatPct,
    palette: ["#edf9f3", "#ccecd8", "#9ed8b5", "#6fc190", "#3d9f69", "#247b4d"],
    legendNote: "Higher = better access to basic water service."
  },
  basic_sanitation_service_pct: {
    label: "Basic Sanitation Service (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.basic_sanitation_service_pct) : null,
    format: formatPct,
    palette: ["#edf9f3", "#ccecd8", "#9ed8b5", "#6fc190", "#3d9f69", "#247b4d"],
    legendNote: "Higher = better sanitation service access."
  },
  basic_handwashing_facility_pct: {
    label: "Basic Handwashing Facility (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.basic_handwashing_facility_pct) : null,
    format: formatPct,
    palette: ["#edf9f3", "#ccecd8", "#9ed8b5", "#6fc190", "#3d9f69", "#247b4d"],
    legendNote: "Higher = better handwashing access."
  },
  safely_managed_drinking_water_pct: {
    label: "Safely Managed Drinking Water (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.safely_managed_drinking_water_pct) : null,
    format: formatPct,
    palette: ["#edf9f3", "#ccecd8", "#9ed8b5", "#6fc190", "#3d9f69", "#247b4d"],
    legendNote: "Higher = better safe water outcome."
  },
  open_defecation_pct: {
    label: "Open Defecation (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.open_defecation_pct) : null,
    format: formatPct,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Higher = higher sanitation risk."
  },
  e_coli_in_household_water_pct: {
    label: "E. coli In Household Water (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.e_coli_in_household_water_pct) : null,
    format: formatPct,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Higher = higher contamination signal."
  },
  without_water_on_premises_pct: {
    label: "Without Water On Premises (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.without_water_on_premises_pct) : null,
    format: formatPct,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Higher = households more likely to collect water off-premises."
  },
  clean_cooking_pct: {
    label: "Clean Cooking (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.clean_cooking_pct) : null,
    format: formatPct,
    palette: ["#edf9f3", "#ccecdc", "#a0dcca", "#74cdb8", "#48c0a6", "#1c9c86"],
    legendNote: "Higher = more households use clean cooking fuel."
  },
  clean_lighting_pct: {
    label: "Clean Lighting (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.clean_lighting_pct) : null,
    format: formatPct,
    palette: ["#f3f7ff", "#d4ddff", "#b4c1ff", "#94a4ff", "#7084ff", "#4a62f4"],
    legendNote: "Higher = more households rely on clean lighting."
  },
  clean_cooking_heating_lighting_pct: {
    label: "Clean Cooking, Heating & Lighting (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.clean_cooking_heating_lighting_pct) : null,
    format: formatPct,
    palette: ["#f5f9f7", "#d4e4e2", "#b2cfcf", "#90bab9", "#6a9d9a", "#3c7d7b"],
    legendNote: "Higher = households using modern cooking, heating, and lighting services."
  },
  stunting_pct: {
    label: "Stunting (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.stunting_pct) : null,
    format: formatPct,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Higher = higher child stunting prevalence."
  },
  wasting_pct: {
    label: "Wasting (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.wasting_pct) : null,
    format: formatPct,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Higher = higher child wasting prevalence."
  },
  underweight_pct: {
    label: "Underweight (%)",
    value: (ctx) => ctx.dhsRow ? Number(ctx.dhsRow.underweight_pct) : null,
    format: formatPct,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Higher = higher child underweight prevalence."
  },
  nutrition_risk_index: {
    label: "Nutrition Risk Index (0-100)",
    value: (ctx) => ctx.joinedRow ? Number(ctx.joinedRow.nutrition_risk_index) : null,
    format: formatNum,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Higher = higher undernutrition burden (mean of stunting, wasting, underweight)."
  },
  need_nutrition_blend_index: {
    label: "WASH + Nutrition Blend Index",
    value: (ctx) => ctx.joinedRow ? Number(ctx.joinedRow.need_nutrition_blend_index) : null,
    format: formatNum,
    palette: ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"],
    legendNote: "Composite score: 70% WASH risk + 30% nutrition risk."
  },
  budget_per_need_unit: {
    label: "Budget / WASH Risk Unit",
    value: (ctx) => ctx.joinedRow ? Number(ctx.joinedRow.budget_per_need_unit) : null,
    format: formatMoney,
    palette: ["#eef4fb", "#cadcf2", "#9dbde7", "#6e9ad7", "#4f77bf", "#365b96"],
    legendNote: "Higher = larger allocation relative to local WASH risk score."
  },
  rank_gap_budget_minus_need: {
    label: "Rank Gap (Budget Rank - WASH Risk Rank)",
    value: (ctx) => ctx.joinedRow ? Number(ctx.joinedRow.rank_gap_budget_minus_need) : null,
    format: formatSigned,
    diverging: true,
    legendNote: "Positive values indicate stronger underfunding signal; negative values indicate stronger overfunding signal."
  },
  rank_gap_budget_minus_need_nutrition: {
    label: "Rank Gap (Budget Rank - WASH+Nutrition Rank)",
    value: (ctx) => ctx.joinedRow ? Number(ctx.joinedRow.rank_gap_budget_minus_need_nutrition) : null,
    format: formatSigned,
    diverging: true,
    legendNote: "Positive values indicate underfunding when nutrition is included in district pressure ranking."
  }
};

const SECTOR_BUDGETS = {
  wash: {
    label: "WASH Budget",
    description: "Water and sanitation votes, water board performance, and WASH delivery readiness.",
    metrics: [
      { label: "MOAIWD vote total", value: 971361.86, unit: "MK m", type: "money", note: "MOAIWD vote 210 total from the programme-based budget." },
      { label: "Water boards served population", value: "4.40m", note: "Population served by water boards in 2025/26." },
      { label: "Urban access within 30 minutes", value: 97.4, unit: "%", type: "pct", note: "Average population within 30 minutes of a water source in water board areas." },
      { label: "Average non-revenue water", value: 33.4, unit: "%", type: "pct", note: "Average NRW across water boards (2025/26)." }
    ],
    cards: [
      { title: "Water board operations", text: "Debtor days remain high across boards, signalling the need for operating cash to keep systems functional." },
      { title: "Urban service gains", text: "Population served grew by 4.7% nationally, with Lilongwe and Southern Region boards expanding fastest." },
      { title: "Large regional works", text: "Shire Valley Irrigation, NRWB regional projects, and Lilongwe resource-efficiency efforts keep the central, northern, and southern systems busy." },
      { title: "System resilience", text: "Dams, rehabilitation of schemes, and rural piped upgrades dominate the medium-term water security agenda." }
    ],
    categories: [
      { label: "Urban water board investments", value: 98194.76, note: "Blantyre, NRWB, Lilongwe, and Salima-Lilongwe pipelines.", unit: "MK m" },
      { label: "Rural piped water upgrades", value: 12200.00, note: "Rural piped schemes, boreholes, and rehabilitation lines.", unit: "MK m" },
      { label: "Multipurpose dams & catchments", value: 9000.00, note: "Dams and catchment protection (e.g., Kholongo).", unit: "MK m" }
    ],
    projects: [
      { label: "Shire Valley Irrigation Project", value: 236111.97, note: "Large irrigation scale-up line (MK m)." },
      { label: "National Water & Sanitation Project (BWB)", value: 65194.76, note: "Blantyre Water Board national project line." },
      { label: "NRWB Water Supply & Sanitation Improvement", value: 26000.00, note: "Northern regional waterboard counterpart line." },
      { label: "Salima-Lilongwe Water Project", value: 5000.00, note: "Strategic inter-urban transfer pipeline." },
      { label: "Kholongo Multi-Purpose Dam", value: 9000.00, note: "Mponela town water supply dam." },
      { label: "Groundwater extraction for rural piped systems", value: 4000.00, note: "Rural piped water development." }
    ],
    tableRows: [
      { item: "Population served by water boards", value: "4.4m", unit: "people", note: "Water boards served ~4.4m people in 2025/26." },
      { item: "Average NRW (2025/26)", value: 33.4, unit: "%", note: "Average non-revenue water across boards." },
      { item: "Average debtor days", value: 163.6, unit: "days", note: "Average billing collection time across boards." }
    ]
  },
  health: {
    label: "Health Budget",
    description: "MOHS vote 212 focuses on core health service delivery, medicines, workforce, infrastructure, and hygiene readiness.",
    metrics: [
      { label: "Health vote total", value: 558075.06, unit: "MK m", type: "money", note: "2026/27 MOHS total vote." },
      { label: "Health Service Delivery", value: 479035.61, unit: "MK m", type: "money", note: "Programme 144, visible service line." },
      { label: "Personnel envelope", value: 110886.14, unit: "MK m", type: "money", note: "Visible payroll pressure inside the vote." },
      { label: "Health workers recruited", value: 5992, unit: "workers", type: "int", note: "Reported achievement FY2025/26." }
    ],
    cards: [
      { title: "Service delivery focus", text: "Programme 144 takes most of the vote, with medicines, equipment, and outreach absorbing the bulk of execution." },
      { title: "Medications and supplies", text: "Technical services, medical supplies, and maintenance dominate the non-personnel budget, showing readiness sensitivity." },
      { title: "Large projects", text: "COVID-19 emergency response, Health Joint Fund, and cancer centre construction keep national referral services in focus." },
      { title: "Subnational staffing", text: "Staffing and hygiene readiness (44% facility sanitation, 27% facility hygiene) remain critical gaps affecting health spending efficiency." }
    ],
    categories: [
      { label: "Service Delivery programme", value: 479035.61, note: "Programme 144 service delivery, medicines, consumables.", unit: "MK m" },
      { label: "Infrastructure & equipment", value: 13154.05, note: "Programme 145 with capital support lines.", unit: "MK m" },
      { label: "Management & support", value: 44137.96, note: "Programme 020 admin, HR, logistics.", unit: "MK m" }
    ],
    projects: [
      { label: "COVID-19 Emergency Response & Health Systems Preparedness", value: 43775.00, note: "Major externally financed response programme." },
      { label: "Health Joint Fund", value: 21742.63, note: "National pooled funding for delivery." },
      { label: "Cancer Centre construction", value: 3000.00, note: "Visible capital project." },
      { label: "Construction of 55 Health Posts", value: 2500.00, note: "District health infrastructure." }
    ],
    tableRows: [
      { item: "Personnel envelope", value: 110886.14, unit: "MK m", note: "PE at the centre of health wage pressure." },
      { item: "Facility sanitation readiness", value: 44, unit: "%", note: "Health facilities with adequate sanitation." },
      { item: "Facility functional hygiene", value: 27, unit: "%", note: "Functional hygiene services remain scarce." },
      { item: "Districts with DFF scaled-up", value: "29 (all districts)", unit: "districts", note: "Delivery-dependence on DFF financing." }
    ]
  },
  nutrition: {
    label: "Nutrition Budget",
    description: "Nutrition lines are nested inside MOHS (Department of Nutrition) and social policy programmes; this view pulls child nutrition, HIV/nutrition, and nutrition-sensitive social protection.",
    metrics: [
      { label: "Nutrition department vote", value: 1563.93, unit: "MK m", type: "money", note: "Department of Nutrition, HIV & AIDS line in MOHS." },
      { label: "UNICEF-facing projects", value: 1200.00, unit: "MK m", type: "money", note: "Nutrition-sensitive donor and government partnerships (approximate)." },
      { label: "Mean stunting (DHS)", value: ({ averages }) => averages.stunting, unit: "%", type: "pct", note: "Average across districts." },
      { label: "Nutrition risk index (DHS)", value: ({ averages }) => averages.nutrition, type: "number", note: "Mean of stunting, wasting, underweight." }
    ],
    cards: [
      { title: "Child growth still lagging", text: "Stunting + wasting mean scores show persistent early-childhood pressure; nutrition budgets reinforce facility readiness." },
      { title: "Micronutrient & HIV link", text: "Nutrition funding overlaps HIV services, food assistance, and nutrition-sensitive social protection, especially via social cash transfers." },
      { title: "Large-scope programs", text: "Nutrition roll-out includes commodity support, community health worker incentives, and fortification monitoring." },
      { title: "Subnational targeting", text: "High-risk districts align with high undernutrition (e.g., Nkhata Bay, Nsanje, Dowa), and the DHS map gallery spotlights them.)" }
    ],
    categories: [
      { label: "Department of Nutrition, HIV & AIDS", value: 1563.93, note: "MOHS nutrition-specific vote line.", unit: "MK m" },
      { label: "Nutrition-sensitive HIV & social grants", value: 1200.00, note: "Estimate of cross-sector adaptive transfers.", unit: "MK m" },
      { label: "Community-based nutrition & training", value: 450.00, note: "Training/community outreach line estimate.", unit: "MK m" }
    ],
    projects: [
      { label: "Nutrition & HIV technical services", value: 1563.93, note: "Visible nutrition department technical service." },
      { label: "Social Cash Transfer nutrition top-ups", value: 2000.00, note: "Nutrition-sensitive transfer top-ups for children." },
      { label: "School feeding coverage expansion", value: 2771.59, note: "School feeding national coverage (MK m)."}
    ],
    tableRows: [
      { item: "Average stunting (28 districts)", value: ({ averages }) => `${formatNum(averages.stunting)}%`, unit: "%", note: "DHS 2024 aggregated." },
      { item: "Average wasting", value: ({ averages }) => `${formatNum(averages.wasting)}%`, unit: "%", note: "DHS 2024 aggregated." },
      { item: "Average underweight", value: ({ averages }) => `${formatNum(averages.underweight)}%`, unit: "%", note: "DHS 2024 aggregated." },
      { item: "Nutrition risk index", value: ({ averages }) => formatNum(averages.nutrition), unit: "index", note: "Mean of stunting, wasting, underweight percentages." }
    ]
  }
};

const WATERBOARD_TABLE = [
  { board: "Lilongwe Water Board", population_served: 1300000, increase_pct: 7.1, access_30min_pct: 94, nrw_pct: null, debtor_days: 60, note: "Highest population growth in 2025/26." },
  { board: "Blantyre Water Board", population_served: 1313650, increase_pct: 2.1, access_30min_pct: 95, nrw_pct: null, debtor_days: 137, note: "Lowest growth rate but improving debtor days." },
  { board: "Northern Region Water Board", population_served: 610930, increase_pct: 4.7, access_30min_pct: 100, nrw_pct: 36.0, debtor_days: 65, note: "NRW rose slightly; access remains at 100%." },
  { board: "Southern Region Water Board", population_served: 737100, increase_pct: 5.3, access_30min_pct: 100, nrw_pct: 27.0, debtor_days: 110, note: "Lowest NRW and improving debtor days." },
  { board: "Central Region Water Board", population_served: 441951, increase_pct: 5.3, access_30min_pct: 98, nrw_pct: null, debtor_days: 446, note: "Debtor days remain well above the 60-day standard." },
  { board: "National average", population_served: 4403631, increase_pct: 4.74, access_30min_pct: 97.4, nrw_pct: 33.4, debtor_days: 163.6, note: "Average across water boards (2025/26)." }
];

const STAFFING_TABLE = [
  { sectorKey: "health", ministry: "Health and Sanitation (Vote 310)", total_vote_mk_m: 558075.06, personnel_mk_m: 110886.14, ort_mk_m: 157941.97, development_mk_m: 289246.95, note: "Largest staffing envelope across social sectors." },
  { sectorKey: "nutrition", ministry: "Gender, Children & Social Welfare (Vote 320)", total_vote_mk_m: 48907.18, personnel_mk_m: 3467.92, ort_mk_m: 16745.42, development_mk_m: 28233.84, note: "Includes social cash transfers and nutrition-sensitive programs." },
  { sectorKey: "nutrition", ministry: "National Planning Commission (Vote 277)", total_vote_mk_m: 2213.66, personnel_mk_m: 1309.96, ort_mk_m: 903.7, development_mk_m: 0, note: "Planning support vote with high PE share." }
].map((row) => ({
  ...row,
  pe_share_pct: row.total_vote_mk_m ? (row.personnel_mk_m / row.total_vote_mk_m) * 100 : null
}));

const PROJECT_TABLE = Object.entries(SECTOR_BUDGETS).flatMap(([key, sector]) => (
  (sector.projects || []).map((project) => ({
    sectorKey: key,
    sector: sector.label,
    project: project.label,
    value_mk_m: Number(project.value),
    note: project.note || ""
  }))
));

function getSectorProjects(sectorKey) {
  const fallback = PROJECT_TABLE.filter((row) => row.sectorKey === sectorKey);
  if (!state.extractedProjects || !state.extractedProjects.length) return fallback;

  const extracted = state.extractedProjects.filter((row) => row.sectorKey === sectorKey);
  if (!extracted.length) return fallback;

  const normalizeLabel = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const fallbackMap = new Map(fallback.map((row) => [normalizeLabel(row.project), row]));

  const merged = extracted.map((row) => {
    if (Number.isFinite(Number(row.value_mk_m))) return row;
    const match = fallbackMap.get(normalizeLabel(row.project));
    if (!match) return row;
    return {
      ...row,
      value_mk_m: match.value_mk_m,
      note: row.note || match.note || ""
    };
  });

  const hasNumeric = merged.some((row) => Number.isFinite(Number(row.value_mk_m)));
  if (!hasNumeric) return fallback;

  const seen = new Set(merged.map((row) => normalizeLabel(row.project)));
  fallback.forEach((row) => {
    const key = normalizeLabel(row.project);
    if (!seen.has(key)) merged.push(row);
  });
  return merged;
}

const PROGRAM_TABLE = Object.entries(SECTOR_BUDGETS).flatMap(([key, sector]) => (
  (sector.programs || []).map((program) => ({
    sectorKey: key,
    sector: sector.label,
    programme: program.label,
    value_mk_m: Number(program.value),
    note: program.note || ""
  }))
));

function getSectorPrograms(sectorKey) {
  const fallback = PROGRAM_TABLE.filter((row) => row.sectorKey === sectorKey);
  if (!state.extractedPrograms || !state.extractedPrograms.length) return fallback;
  const extracted = state.extractedPrograms.filter((row) => row.sectorKey === sectorKey);
  const hasNumeric = extracted.some((row) => Number.isFinite(Number(row.value_mk_m)) && Number(row.value_mk_m) > 0);
  return extracted.length >= 3 && hasNumeric ? extracted : fallback;
}

function buildCostCategoryTable(context) {
  return Object.entries(SECTOR_BUDGETS).flatMap(([key, sector]) => (
    (sector.categories || []).map((category) => ({
      sectorKey: key,
      sector: sector.label,
      category: category.label,
      value_mk_m: Number(typeof category.value === "function" ? category.value(context) : category.value),
      note: category.note || ""
    }))
  ));
}

function getSectorCostCategories(sectorKey, context) {
  const fallback = buildCostCategoryTable(context).filter((row) => row.sectorKey === sectorKey);
  if (!state.extractedCostCategories || !state.extractedCostCategories.length) return fallback;
  const extracted = state.extractedCostCategories.filter((row) => row.sectorKey === sectorKey);
  const hasNumeric = extracted.some((row) => Number.isFinite(Number(row.value_mk_m)) && Number(row.value_mk_m) > 0);
  return extracted.length >= 3 && hasNumeric ? extracted : fallback;
}

const INTERACTIVE_TABLES = [
  {
    id: "washWaterboardsTable",
    searchId: "washWaterboardsSearch",
    downloadId: "washWaterboardsDownload",
    defaultSort: "population_served",
    columns: [
      { key: "board", label: "Water board", type: "text" },
      { key: "population_served", label: "Population served (2025/26)", type: "number", format: formatInt },
      { key: "increase_pct", label: "Increase %", type: "number", format: formatPct },
      { key: "access_30min_pct", label: "Access within 30 min (%)", type: "number", format: formatPct },
      { key: "nrw_pct", label: "NRW (%)", type: "number", format: formatPct },
      { key: "debtor_days", label: "Debtor days", type: "number", format: formatNumLocale },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: WATERBOARD_TABLE
  },
  {
    id: "washProgramsTable",
    searchId: "washProgramsSearch",
    downloadId: "washProgramsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "programme", label: "Programme", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Source", type: "text" }
    ],
    rows: () => getSectorPrograms("wash")
  },
  {
    id: "healthStaffingTable",
    searchId: "healthStaffingSearch",
    downloadId: "healthStaffingDownload",
    defaultSort: "total_vote_mk_m",
    columns: [
      { key: "ministry", label: "Ministry / Vote", type: "text" },
      { key: "total_vote_mk_m", label: "Total vote (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "personnel_mk_m", label: "Personnel emoluments (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "ort_mk_m", label: "ORT (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "pe_share_pct", label: "PE share (%)", type: "number", format: formatPct },
      { key: "development_mk_m", label: "Development (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: STAFFING_TABLE.filter((row) => row.sectorKey === "health")
  },
  {
    id: "healthProgramsTable",
    searchId: "healthProgramsSearch",
    downloadId: "healthProgramsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "programme", label: "Programme", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Source", type: "text" }
    ],
    rows: () => getSectorPrograms("health")
  },
  {
    id: "healthProjectsTable",
    searchId: "healthProjectsSearch",
    downloadId: "healthProjectsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "project", label: "Project", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: () => getSectorProjects("health")
  },
  {
    id: "healthCostsTable",
    searchId: "healthCostsSearch",
    downloadId: "healthCostsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "category", label: "Cost category", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: (context) => getSectorCostCategories("health", context)
  },
  {
    id: "nutritionStaffingTable",
    searchId: "nutritionStaffingSearch",
    downloadId: "nutritionStaffingDownload",
    defaultSort: "total_vote_mk_m",
    columns: [
      { key: "ministry", label: "Ministry / Vote", type: "text" },
      { key: "total_vote_mk_m", label: "Total vote (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "personnel_mk_m", label: "Personnel emoluments (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "ort_mk_m", label: "ORT (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "pe_share_pct", label: "PE share (%)", type: "number", format: formatPct },
      { key: "development_mk_m", label: "Development (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: STAFFING_TABLE.filter((row) => row.sectorKey === "nutrition")
  },
  {
    id: "nutritionProgramsTable",
    searchId: "nutritionProgramsSearch",
    downloadId: "nutritionProgramsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "programme", label: "Programme", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Source", type: "text" }
    ],
    rows: () => getSectorPrograms("nutrition")
  },
  {
    id: "nutritionProjectsTable",
    searchId: "nutritionProjectsSearch",
    downloadId: "nutritionProjectsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "project", label: "Project", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: () => getSectorProjects("nutrition")
  },
  {
    id: "nutritionCostsTable",
    searchId: "nutritionCostsSearch",
    downloadId: "nutritionCostsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "category", label: "Cost category", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: (context) => getSectorCostCategories("nutrition", context)
  },
  {
    id: "washProjectsTable",
    searchId: "washProjectsSearch",
    downloadId: "washProjectsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "project", label: "Project", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: () => getSectorProjects("wash")
  },
  {
    id: "washCostsTable",
    searchId: "washCostsSearch",
    downloadId: "washCostsDownload",
    defaultSort: "value_mk_m",
    columns: [
      { key: "category", label: "Cost category", type: "text" },
      { key: "value_mk_m", label: "Value (m, selected currency)", type: "number", format: formatBudgetMillions },
      { key: "note", label: "Note", type: "text" }
    ],
    rows: (context) => getSectorCostCategories("wash", context)
  }
];

const tableState = {};

const budgetMetricOptions = ["total_budget_mwk", "construction_budget_mwk", "cdf_potential_10pct", "cdf_construction_share_pct"];
let indicatorMetricOptions = [
  "need_index", "basic_water_service_pct", "basic_sanitation_service_pct", "basic_handwashing_facility_pct",
  "safely_managed_drinking_water_pct", "open_defecation_pct", "e_coli_in_household_water_pct", "without_water_on_premises_pct",
  "clean_cooking_pct", "clean_lighting_pct", "clean_cooking_heating_lighting_pct",
  "stunting_pct", "wasting_pct", "underweight_pct", "nutrition_risk_index", "need_nutrition_blend_index"
];
const alignmentMetricOptions = [
  "rank_gap_budget_minus_need",
  "rank_gap_budget_minus_need_nutrition",
  "budget_per_need_unit",
  "need_index",
  "need_nutrition_blend_index"
];
const cdfMetricOptions = Array.from(new Set([...budgetMetricOptions, ...alignmentMetricOptions]));

window.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    let cdfRows;
    let dhsRows;
    let joinedRows;
    let patterns;
    let geo;
    let childImpacts;

    if (window.DASHBOARD_DATA) {
      cdfRows = window.DASHBOARD_DATA.cdf || [];
      dhsRows = window.DASHBOARD_DATA.dhs || [];
      joinedRows = window.DASHBOARD_DATA.joined || [];
      patterns = window.DASHBOARD_DATA.patterns || { correlations: [] };
      geo = window.DASHBOARD_DATA.geo || { type: "FeatureCollection", features: [] };
      childImpacts = window.DASHBOARD_DATA.childImpacts || await fetchJson(DATA_PATHS.childImpacts);
    } else {
      [cdfRows, dhsRows, joinedRows, patterns, geo, childImpacts] = await Promise.all([
        fetchJson(DATA_PATHS.cdf),
        fetchJson(DATA_PATHS.dhs),
        fetchJson(DATA_PATHS.joined),
        fetchJson(DATA_PATHS.patterns),
        fetchJson(DATA_PATHS.geo),
        fetchJson(DATA_PATHS.childImpacts)
      ]);
    }

    state.cdfRows = cdfRows;
    state.dhsRows = dhsRows;
    state.joinedRows = joinedRows;
    state.patterns = patterns;
    state.childImpactBundle = childImpacts || null;
    state.childImpactRows = Array.isArray(childImpacts?.rows) ? childImpacts.rows : [];
    state.childImpactFilters.ages = Array.isArray(childImpacts?.ages) ? childImpacts.ages.slice() : [];

    indexData();
    state.joinedRowsBase = state.joinedRows.map((row) => ({ ...row }));
    recomputeDerivedIndices();
    prepareFeatures(geo);
    extendIndicatorMetrics();
    await loadExtractedBudgets();
    setupTabs();
    setupSectorTabs();
    setupChildImpactControls();
    setupChildImpactSectorTabs();
    setupControls();
    setupWeightControls();
    setupInteractiveTables();
    renderTopCards();
    renderAll();
  } catch (error) {
    const shell = document.querySelector(".shell");
    shell.innerHTML = `<section class="panel"><h2>Failed to load dashboard data</h2><p class="muted">${escapeHtml(String(error))}</p><p class="muted">Open this folder through a local web server so fetch requests can resolve local JSON files.</p></section>`;
  }
}

function fetchJson(path) {
  return fetch(path).then((response) => {
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
    return response.json();
  });
}

function indexData() {
  state.budgetByCanonical = new Map();
  state.budgetByDistrict = new Map();
  state.dhsByCanonical = new Map();
  state.joinedByCanonical = new Map();

  state.cdfRows.forEach((row) => {
    const canonical = row.canonical_name || normalizeName(row.district);
    const districtCanonical = row.district_level_name || toDistrictLevel(canonical);
    const enriched = {
      ...row,
      canonical_name: canonical,
      district_level_name: districtCanonical,
      cdf_potential_10pct: row.cdf_potential_10pct || (Number(row.total) * 0.10),
      source_rows: [row.district]
    };
    state.budgetByCanonical.set(canonical, enriched);

    if (!state.budgetByDistrict.has(districtCanonical)) {
      state.budgetByDistrict.set(districtCanonical, {
        district_level_name: districtCanonical,
        total: 0,
        construction: 0,
        districtWide: 0,
        bursaries: 0,
        projectMgmt: 0,
        disaster: 0,
        women: 0,
        youth: 0,
        source_rows: []
      });
    }

    const agg = state.budgetByDistrict.get(districtCanonical);
    agg.total += Number(row.total || 0);
    agg.construction += Number(row.construction || 0);
    agg.districtWide += Number(row.districtWide || 0);
    agg.bursaries += Number(row.bursaries || 0);
    agg.projectMgmt += Number(row.projectMgmt || 0);
    agg.disaster += Number(row.disaster || 0);
    agg.women += Number(row.women || 0);
    agg.youth += Number(row.youth || 0);
    agg.source_rows.push(row.district);
  });

  state.dhsRows.forEach((row) => state.dhsByCanonical.set(normalizeName(row.district), row));
  state.joinedRows.forEach((row) => state.joinedByCanonical.set(row.canonical_name || normalizeName(row.district), row));
}
function prepareFeatures(geo) {
  const rawFeatures = (geo.features || []).filter((feature) => feature.properties && feature.properties.DistrictNa);
  const project = projectFactory(rawFeatures, 940, 760, 2);

  state.features = rawFeatures.map((feature) => {
    const name = feature.properties.DistrictNa;
    const canonical = normalizeName(name);
    return {
      name,
      canonical,
      districtCanonical: toDistrictLevel(canonical),
      path: pathFromGeometry(feature.geometry, project)
    };
  });
}

function extendIndicatorMetrics() {
  const baseKeys = new Set(indicatorMetricOptions);
  const dhsKeys = getNumericKeys(state.dhsRows, ["district"]);
  const joinedKeys = ["need_index", "nutrition_risk_index", "need_nutrition_blend_index"];

  dhsKeys.forEach((key) => {
    if (!baseKeys.has(key)) baseKeys.add(key);
    ensureMetricCatalog(key, "dhs");
  });

  joinedKeys.forEach((key) => {
    if (!baseKeys.has(key)) baseKeys.add(key);
    ensureMetricCatalog(key, "joined");
  });

  const extras = Array.from(baseKeys).filter((key) => !indicatorMetricOptions.includes(key));
  extras.sort((a, b) => labelFromKey(a).localeCompare(labelFromKey(b)));
  indicatorMetricOptions = [...indicatorMetricOptions, ...extras];
}

function setupWeightControls() {
  const resetBtn = document.getElementById("resetWeightsBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      WASH_WEIGHT_CONFIG.forEach((config) => {
        state.washWeights[config.key] = 1;
        const input = document.getElementById(config.inputId);
        if (input) input.value = "1";
      });
      NUTRITION_WEIGHT_CONFIG.forEach((config) => {
        state.nutritionWeights[config.key] = 1;
        const input = document.getElementById(config.inputId);
        if (input) input.value = "1";
      });
      updateWeightDisplays();
      recomputeDerivedIndices();
      renderAll();
    });
  }

  const attach = (config, target) => {
    const input = document.getElementById(config.inputId);
    if (!input) return;
    input.addEventListener("input", (event) => {
      const value = Number(event.target.value);
      target[config.key] = Number.isFinite(value) ? value : 0;
      updateWeightDisplays();
      recomputeDerivedIndices();
      renderAll();
    });
  };

  WASH_WEIGHT_CONFIG.forEach((config) => attach(config, state.washWeights));
  NUTRITION_WEIGHT_CONFIG.forEach((config) => attach(config, state.nutritionWeights));
  updateWeightDisplays();
}

function updateWeightDisplays() {
  WASH_WEIGHT_CONFIG.forEach((config) => {
    const node = document.getElementById(config.valueId);
    if (node) node.textContent = Number(state.washWeights[config.key] || 0).toFixed(1);
  });
  NUTRITION_WEIGHT_CONFIG.forEach((config) => {
    const node = document.getElementById(config.valueId);
    if (node) node.textContent = Number(state.nutritionWeights[config.key] || 0).toFixed(1);
  });

  const washNote = document.getElementById("washWeightsNote");
  if (washNote) washNote.textContent = `Active weights: ${summarizeWeights(state.washWeights, WASH_WEIGHT_CONFIG)}`;
  const nutritionNote = document.getElementById("nutritionWeightsNote");
  if (nutritionNote) nutritionNote.textContent = `Active weights: ${summarizeWeights(state.nutritionWeights, NUTRITION_WEIGHT_CONFIG)}`;
}

function summarizeWeights(weights, config) {
  return config.map((item) => `${item.label} ${Number(weights[item.key] || 0).toFixed(1)}`).join(", ");
}

function computeWeightedMean(items) {
  let weightedSum = 0;
  let weightTotal = 0;
  items.forEach((item) => {
    const value = Number(item.value);
    const weight = Number(item.weight);
    if (!Number.isFinite(value) || !Number.isFinite(weight) || weight <= 0) return;
    weightedSum += value * weight;
    weightTotal += weight;
  });
  if (!weightTotal) return null;
  return weightedSum / weightTotal;
}

function computeWashRiskIndex(row) {
  const components = [
    { key: "water_gap", value: 100 - Number(row.basic_water_service_pct || 0) },
    { key: "sanitation_gap", value: 100 - Number(row.basic_sanitation_service_pct || 0) },
    { key: "handwashing_gap", value: 100 - Number(row.basic_handwashing_facility_pct || 0) },
    { key: "safe_water_gap", value: 100 - Number(row.safely_managed_drinking_water_pct || 0) },
    { key: "open_defecation_risk", value: Number(row.open_defecation_pct || 0) },
    { key: "e_coli_risk", value: Number(row.e_coli_in_household_water_pct || 0) }
  ];
  return computeWeightedMean(components.map((item) => ({
    value: item.value,
    weight: state.washWeights[item.key]
  })));
}

function computeNutritionRiskIndex(row) {
  const components = [
    { key: "stunting_pct", value: Number(row.stunting_pct || 0) },
    { key: "wasting_pct", value: Number(row.wasting_pct || 0) },
    { key: "underweight_pct", value: Number(row.underweight_pct || 0) }
  ];
  return computeWeightedMean(components.map((item) => ({
    value: item.value,
    weight: state.nutritionWeights[item.key]
  })));
}

function buildRankMap(rows, accessor) {
  const ranking = rows
    .map((row) => ({ canonical: row.canonical_name, value: accessor(row) }))
    .filter((row) => Number.isFinite(row.value))
    .sort((a, b) => b.value - a.value);
  const map = new Map();
  ranking.forEach((row, index) => {
    map.set(row.canonical, index + 1);
  });
  return map;
}

function recomputeDerivedIndices() {
  if (!state.joinedRowsBase) return;
  const rows = state.joinedRowsBase.map((row) => {
    const canonical = row.canonical_name || normalizeName(row.district);
    const dhs = state.dhsByCanonical.get(canonical) || row;
    const budget = state.budgetByCanonical.get(canonical);
    const washRisk = computeWashRiskIndex(dhs);
    const nutritionRisk = computeNutritionRiskIndex(dhs);
    const fallbackNeed = Number(row.need_index);
    const fallbackNutrition = Number(row.nutrition_risk_index);
    const needIndex = Number.isFinite(washRisk) ? washRisk : (Number.isFinite(fallbackNeed) ? fallbackNeed : null);
    const nutritionIndex = Number.isFinite(nutritionRisk) ? nutritionRisk : (Number.isFinite(fallbackNutrition) ? fallbackNutrition : null);
    const blendIndex = (Number.isFinite(needIndex) && Number.isFinite(nutritionIndex))
      ? (0.7 * needIndex) + (0.3 * nutritionIndex)
      : Number.isFinite(Number(row.need_nutrition_blend_index)) ? Number(row.need_nutrition_blend_index) : null;

    const totalBudget = Number.isFinite(Number(row.total_budget_mwk))
      ? Number(row.total_budget_mwk)
      : (budget ? Number(budget.total) : null);

    return {
      ...row,
      canonical_name: canonical,
      total_budget_mwk: Number.isFinite(totalBudget) ? totalBudget : row.total_budget_mwk,
      need_index: needIndex,
      nutrition_risk_index: nutritionIndex,
      need_nutrition_blend_index: blendIndex
    };
  });

  const budgetRank = buildRankMap(rows, (row) => Number(row.total_budget_mwk));
  const needRank = buildRankMap(rows, (row) => Number(row.need_index));
  const blendRank = buildRankMap(rows, (row) => Number(row.need_nutrition_blend_index));

  rows.forEach((row) => {
    const budget = Number(row.total_budget_mwk);
    const need = Number(row.need_index);
    const budgetRankValue = budgetRank.get(row.canonical_name);
    const needRankValue = needRank.get(row.canonical_name);
    const blendRankValue = blendRank.get(row.canonical_name);
    row.budget_per_need_unit = (Number.isFinite(budget) && Number.isFinite(need) && need > 0)
      ? budget / need
      : null;
    row.rank_gap_budget_minus_need = (budgetRankValue && needRankValue) ? (budgetRankValue - needRankValue) : null;
    row.rank_gap_budget_minus_need_nutrition = (budgetRankValue && blendRankValue)
      ? (budgetRankValue - blendRankValue)
      : null;
  });

  state.joinedRows = rows;
  state.joinedByCanonical = new Map();
  state.joinedRows.forEach((row) => {
    const canonical = row.canonical_name || normalizeName(row.district);
    state.joinedByCanonical.set(canonical, row);
  });
}

async function loadExtractedBudgets() {
  if (window.DASHBOARD_DATA) {
    const extractedProjects = window.DASHBOARD_DATA.extractedProjects || [];
    const extractedCostCategories = window.DASHBOARD_DATA.extractedCostCategories || [];
    const extractedPrograms = window.DASHBOARD_DATA.extractedPrograms || [];
    if (extractedProjects.length || extractedCostCategories.length || extractedPrograms.length) {
      state.extractedProjects = extractedProjects;
      state.extractedCostCategories = extractedCostCategories;
      state.extractedPrograms = extractedPrograms;
      return;
    }
  }
  try {
    const [doc5CentralTables, doc5CentralDoc, doc5SubventedTables, doc5SubventedDoc, doc6PsipDoc] = await Promise.all([
      fetchJson(DATA_PATHS.doc5CentralTables),
      fetchJson(DATA_PATHS.doc5CentralDoc),
      fetchJson(DATA_PATHS.doc5SubventedTables),
      fetchJson(DATA_PATHS.doc5SubventedDoc),
      fetchJson(DATA_PATHS.doc6PsipDoc)
    ]);

    const projectRows = extractProjectsFromPsip(doc6PsipDoc);
    const costRows = extractCostCategories([
      { tables: doc5CentralTables, doc: doc5CentralDoc, source: "PBB Central" },
      { tables: doc5SubventedTables, doc: doc5SubventedDoc, source: "PBB Subvented" }
    ]);
    const programRows = extractProgramsFromTables([
      { tables: doc5CentralTables, doc: doc5CentralDoc, source: "PBB Central" },
      { tables: doc5SubventedTables, doc: doc5SubventedDoc, source: "PBB Subvented" }
    ]);

    state.extractedProjects = projectRows;
    state.extractedCostCategories = costRows;
    state.extractedPrograms = programRows;
  } catch (error) {
    state.extractedProjects = [];
    state.extractedCostCategories = [];
    state.extractedPrograms = [];
  }
}

function extractProjectsFromPsip(doc) {
  const projects = [];
  if (!doc || !Array.isArray(doc.pages)) return projects;
  let currentVote = "";

  doc.pages.forEach((page) => {
    const text = page.selected_text || "";
    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (/^VOTE\s+/i.test(line)) {
        currentVote = line;
        i += 1;
        continue;
      }

      const hasProjectLine = /PROJECT/i.test(line);
      const nextLine = lines[i + 1] || "";
      const hasNameNext = /NAME/i.test(nextLine);
      const hasProjectNameInline = /PROJECT\s+NAME/i.test(line);

      if (hasProjectNameInline || (hasProjectLine && hasNameNext)) {
        const nameLine = hasProjectNameInline ? line.replace(/.*PROJECT\s+NAME/i, "").trim() : (lines[i + 2] || "");
        const projectName = nameLine || lines[i + 2] || "";
        i = hasProjectNameInline ? i + 1 : i + 3;

        const blockLines = [];
        while (i < lines.length && !/^VOTE\s+/i.test(lines[i]) && !/PROJECT/i.test(lines[i])) {
          blockLines.push(lines[i]);
          i += 1;
        }
        const blockText = blockLines.join(" ");
        const location = extractAfterLabel(blockLines, "LOCATION");
        const funding = extractFundingValue(blockText);
        const sectorKey = classifySector(`${currentVote} ${projectName} ${blockText}`);

        if (projectName && sectorKey) {
          projects.push({
            sectorKey,
            sector: SECTOR_BUDGETS[sectorKey]?.label || sectorKey,
            project: projectName,
            value_mk_m: funding,
            note: [currentVote, location].filter(Boolean).join(" | ")
          });
        }
        continue;
      }
      i += 1;
    }
  });

  return projects;
}

function extractAfterLabel(lines, label) {
  const matchLine = lines.find((line) => new RegExp(`^${label}\\b`, "i").test(line));
  if (!matchLine) return "";
  return matchLine.replace(new RegExp(`^${label}\\b`, "i"), "").trim();
}

function extractFundingValue(text) {
  if (!text) return null;
  const fundingMatch = text.match(/FUNDING[^0-9]*([0-9][0-9,\\.]*)/i);
  if (!fundingMatch) return null;
  return parseNumeric(fundingMatch[1]);
}

function extractCostCategories(sources) {
  const results = [];
  sources.forEach((source) => {
    const tables = source.tables || [];
    const pageText = buildPageTextIndex(source.doc);
    tables.forEach((table) => {
      if (!table || !Array.isArray(table.data)) return;
      const headerIndex = table.data.findIndex((row) => row && row.some((cell) => String(cell || "").trim().length));
      if (headerIndex < 0) return;
      const header = table.data[headerIndex].map((cell) => String(cell || "").trim());
      const headerText = header.join(" ").toLowerCase();
      const isCategoryTable = headerText.includes("category") || headerText.includes("economic") || headerText.includes("classification");
      if (!isCategoryTable) return;

      const valueIndex = header.findIndex((cell) => /2026.?27|estimate/i.test(cell));
      const valueCol = valueIndex >= 0 ? valueIndex : header.length - 1;
      const contextText = pageText.get(table.page) || "";

      table.data.slice(headerIndex + 1).forEach((row) => {
        if (!row) return;
        const cells = row.map((cell) => String(cell || "").trim());
        const category = cells.find((cell) => cell) || "";
        const valueRaw = cells[valueCol] || "";
        const value = parseNumeric(valueRaw);
        if (!category || !Number.isFinite(value)) return;

        const sectorKey = classifySector(`${contextText} ${category}`);
        if (!sectorKey) return;

        results.push({
          sectorKey,
          sector: SECTOR_BUDGETS[sectorKey]?.label || sectorKey,
          category,
          value_mk_m: value,
          note: source.source
        });
      });
    });
  });
  return results;
}

function extractProgramsFromTables(sources) {
  const results = [];
  sources.forEach((source) => {
    const tables = source.tables || [];
    const pageText = buildPageTextIndex(source.doc);
    tables.forEach((table) => {
      if (!table || !Array.isArray(table.data)) return;
      const headerIndex = table.data.findIndex((row) => row && row.some((cell) => String(cell || "").trim().length));
      if (headerIndex < 0) return;
      const headerRows = table.data.slice(headerIndex, headerIndex + 2);
      const headerText = headerRows
        .map((row) => row.map((cell) => String(cell || "").trim()).join(" "))
        .join(" ")
        .toLowerCase();
      const isProgramTable = /program\s*(\/|\s)\s*subprogram|programme\s*(\/|\s)\s*subprogramme/.test(headerText);
      if (!isProgramTable) return;

      const maxCols = Math.max(...headerRows.map((row) => row.length));
      const columnLabels = Array.from({ length: maxCols }, (_, idx) => (
        headerRows.map((row) => String(row[idx] || "")).join(" ").toLowerCase()
      ));
      let estimateCol = columnLabels.findIndex((label) => label.includes("2026-27") && label.includes("estimate"));
      if (estimateCol < 0) estimateCol = columnLabels.findIndex((label) => label.includes("2026-27"));
      if (estimateCol < 0) estimateCol = maxCols - 1;

      const contextText = pageText.get(table.page) || "";
      const entries = [];

      table.data.slice(headerIndex + 1).forEach((row) => {
        if (!row) return;
        const cells = row.map((cell) => String(cell || "").replace(/\s+/g, " ").trim());
        let label = cells[0] || cells.find((cell) => cell);
        if (!label) return;
        label = label.replace(/\s+/g, " ").trim();
        label = label.replace(/\u2013/g, "-");
        if (!/\d/.test(label) || !/-/.test(label)) return;
        entries.push({ label, cells });
      });

      const hasThreeDigit = entries.some((entry) => /^\d{3}\s*[-]/.test(entry.label));
      entries.forEach((entry) => {
        if (hasThreeDigit && !/^\d{3}\s*[-]/.test(entry.label)) return;
        let value = parseNumeric(entry.cells[estimateCol]);
        if (!Number.isFinite(value)) {
          const fallback = entry.cells.slice().reverse().map(parseNumeric).find((v) => Number.isFinite(v));
          value = Number.isFinite(fallback) ? fallback : null;
        }
        if (!Number.isFinite(value)) return;
        const sectorKey = classifySector(`${contextText} ${entry.label}`);
        if (!sectorKey) return;

        results.push({
          sectorKey,
          sector: SECTOR_BUDGETS[sectorKey]?.label || sectorKey,
          programme: entry.label,
          value_mk_m: value,
          note: `${source.source} | p${table.page}`
        });
      });
    });
  });
  return results;
}

function buildPageTextIndex(doc) {
  const map = new Map();
  if (!doc || !Array.isArray(doc.pages)) return map;
  doc.pages.forEach((page) => {
    map.set(page.page, page.selected_text || "");
  });
  return map;
}

function parseNumeric(value) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function classifySector(text) {
  const haystack = String(text || "").toLowerCase();
  const scores = {
    wash: scoreKeywords(haystack, [
      "water", "sanitation", "borehole", "irrigation", "wash", "water board", "nrwb", "srwb", "crwb", "lilongwe water",
      "blantyre water", "rural water", "water supply", "pipeline", "dam", "catchment", "sewer"
    ]),
    health: scoreKeywords(haystack, [
      "health", "hospital", "clinic", "medical", "kuhes", "hiv", "aids", "malaria", "maternal", "nursing", "midwifery",
      "laboratory", "pharmacy", "drug", "vaccine", "disease"
    ]),
    nutrition: scoreKeywords(haystack, [
      "nutrition", "stunting", "wasting", "underweight", "food", "feeding", "school feeding", "supplement",
      "social cash transfer", "sct", "livelihood", "diet", "micronutrient"
    ])
  };

  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  if (!entries.length || entries[0][1] === 0) return "";
  return entries[0][0];
}

function scoreKeywords(text, keywords) {
  return keywords.reduce((sum, keyword) => (text.includes(keyword) ? sum + 1 : sum), 0);
}

function getNumericKeys(rows, skipKeys) {
  const skip = new Set(skipKeys || []);
  const keys = new Set();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (skip.has(key)) return;
      const value = row[key];
      if (Number.isFinite(Number(value))) keys.add(key);
    });
  });
  return Array.from(keys);
}

function ensureMetricCatalog(key, source) {
  if (metricCatalog[key]) return;
  const palette = inferPalette(key);
  const format = key.endsWith("_pct") ? formatPct : formatNum;
  metricCatalog[key] = {
    label: labelFromKey(key),
    value: (ctx) => {
      const row = source === "dhs" ? ctx.dhsRow : ctx.joinedRow;
      return row ? Number(row[key]) : null;
    },
    format,
    palette,
    legendNote: inferLegendNote(key)
  };
}

function inferPalette(key) {
  if (isRiskKey(key)) {
    return ["#fff2ef", "#fac8bc", "#f39d8a", "#e7745d", "#cf4f37", "#a63521"];
  }
  if (isPositiveKey(key)) {
    return ["#edf9f3", "#ccecd8", "#9ed8b5", "#6fc190", "#3d9f69", "#247b4d"];
  }
  return ["#edf6f8", "#b9e1e8", "#7fc9d5", "#45aeba", "#0b6e80", "#084d5a"];
}

function inferLegendNote(key) {
  if (isRiskKey(key)) return "Higher = higher risk/pressure.";
  if (isPositiveKey(key)) return "Higher = better access/outcome.";
  return "Higher = higher value.";
}

function isRiskKey(key) {
  return /(risk|open_defecation|e_coli|unimproved|without|no_treatment|limited|surface|wasting|stunting|underweight|contamination)/i.test(key);
}

function isPositiveKey(key) {
  return /(basic|safely|clean|appropriate|sufficient|privacy|access|schooling|nar|improved|managed)/i.test(key);
}

function labelFromKey(key) {
  return key
    .replace(/_pct$/i, " %")
    .split("_")
    .map((part) => {
      if (part.toLowerCase() === "pct") return "%";
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function setupTabs() {
  const tabButtons = document.querySelectorAll("#mainTabs .tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.tab;
      tabButtons.forEach((item) => item.classList.remove("active"));
      panels.forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      const panel = document.querySelector(`.tab-panel[data-tab="${target}"]`);
      if (panel) panel.classList.add("active");
      state.activeTab = target;
      renderAll();
    });
  });
}

function setupControls() {
  populateSelect("cdfMetricSelect", cdfMetricOptions, state.cdfMetric);
  populateSelect("indicatorMetricSelect", indicatorMetricOptions, state.indicatorMetric);
  const cdfSelect = document.getElementById("cdfMetricSelect");
  if (cdfSelect) {
    cdfSelect.addEventListener("change", (event) => {
      state.cdfMetric = event.target.value;
      renderMap("cdf");
      renderDetailCard();
    });
  }

  document.getElementById("indicatorMetricSelect").addEventListener("change", (event) => {
    state.indicatorMetric = event.target.value;
    renderMap("indicator");
    updateIndicatorLayerNote();
    renderDetailCard();
    renderWashDetailCard();
  });
  const currencySelect = document.getElementById("currencySelect");
  if (currencySelect) {
    currencySelect.value = state.currency;
    currencySelect.addEventListener("change", (event) => {
      state.currency = event.target.value;
      renderAll();
    });
  }
  const usdInput = document.getElementById("usdRateInput");
  if (usdInput) {
    if (state.usdRate) usdInput.value = state.usdRate;
    usdInput.addEventListener("input", (event) => {
      const rate = Number(event.target.value);
      state.usdRate = Number.isFinite(rate) && rate > 0 ? rate : null;
      renderAll();
    });
  }

  const sortOptions = [
    ["need_index_desc", "WASH Risk Index (highest first)"],
    ["budget_desc", "Budget (highest first)"],
    ["budget_need_desc", "Budget/WASH Risk ratio (highest first)"],
    ["rank_gap_desc", "Underfunding signal (highest first)"],
    ["district_asc", "District name (A-Z)"]
  ];

  const sortSelect = document.getElementById("sortSelect");
  sortSelect.innerHTML = sortOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
  sortSelect.value = state.tableSort;
  sortSelect.addEventListener("change", (event) => {
    state.tableSort = event.target.value;
    renderTable();
  });

  document.getElementById("searchInput").addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderTable();
  });

  const printActiveBtn = document.getElementById("printActiveBtn");
  if (printActiveBtn) {
    printActiveBtn.addEventListener("click", () => triggerPrint("active"));
  }
  const printAllBtn = document.getElementById("printAllBtn");
  if (printAllBtn) {
    printAllBtn.addEventListener("click", () => triggerPrint("all"));
  }
}

function populateSelect(id, keys, current) {
  const node = document.getElementById(id);
  if (!node) return;
  node.innerHTML = keys.map((key) => `<option value="${key}">${metricCatalog[key].label}</option>`).join("");
  node.value = current;
}

function setupInteractiveTables() {
  INTERACTIVE_TABLES.forEach((config) => {
    tableState[config.id] = {
      sortKey: config.defaultSort,
      sortDir: "desc",
      query: ""
    };
    const search = document.getElementById(config.searchId);
    if (search) {
      search.addEventListener("input", (event) => {
        tableState[config.id].query = event.target.value.trim().toLowerCase();
        renderInteractiveTable(config, buildSectorContext());
      });
    }
    if (config.downloadId) {
      const button = document.getElementById(config.downloadId);
      if (button) {
        button.addEventListener("click", () => {
          downloadTableCsv(config, buildSectorContext());
        });
      }
    }
  });
}

function renderInteractiveTables() {
  const context = buildSectorContext();
  INTERACTIVE_TABLES.forEach((config) => renderInteractiveTable(config, context));
}

function getInteractiveRows(config, context) {
  const stateEntry = tableState[config.id] || { sortKey: config.defaultSort, sortDir: "desc", query: "" };
  const rows = typeof config.rows === "function" ? config.rows(context) : config.rows;
  const query = stateEntry.query;
  let filtered = rows.slice();

  if (query) {
    filtered = filtered.filter((row) => (
      config.columns.some((col) => String(row[col.key] || "").toLowerCase().includes(query))
    ));
  }

  const sortCol = config.columns.find((col) => col.key === stateEntry.sortKey);
  if (sortCol) {
    filtered.sort((a, b) => {
      const left = a[sortCol.key];
      const right = b[sortCol.key];
      if (sortCol.type === "number") {
        const leftNum = Number(left);
        const rightNum = Number(right);
        if (!Number.isFinite(leftNum) && !Number.isFinite(rightNum)) return 0;
        if (!Number.isFinite(leftNum)) return 1;
        if (!Number.isFinite(rightNum)) return -1;
        return stateEntry.sortDir === "asc" ? leftNum - rightNum : rightNum - leftNum;
      }
      return stateEntry.sortDir === "asc"
        ? String(left || "").localeCompare(String(right || ""))
        : String(right || "").localeCompare(String(left || ""));
    });
  }
  return { rows: filtered, stateEntry };
}

function renderInteractiveTable(config, context) {
  const root = document.getElementById(config.id);
  if (!root) return;
  const { rows: filtered, stateEntry } = getInteractiveRows(config, context);

  root.innerHTML = `
    <table>
      <thead>
        <tr>
          ${config.columns.map((col) => {
            const active = col.key === stateEntry.sortKey;
            const marker = active ? (stateEntry.sortDir === "asc" ? "^" : "v") : "";
            return `<th data-key="${col.key}">${escapeHtml(col.label)} ${marker}</th>`;
          }).join("")}
        </tr>
      </thead>
      <tbody>
        ${filtered.map((row) => `
          <tr>
            ${config.columns.map((col) => {
              const raw = row[col.key];
              const display = col.format ? col.format(raw) : (raw || "n/a");
              return `<td>${escapeHtml(String(display))}</td>`;
            }).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  root.querySelectorAll("th[data-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      if (stateEntry.sortKey === key) {
        stateEntry.sortDir = stateEntry.sortDir === "asc" ? "desc" : "asc";
      } else {
        stateEntry.sortKey = key;
        stateEntry.sortDir = "desc";
      }
      renderInteractiveTable(config, context);
    });
  });
}

function downloadTableCsv(config, context) {
  const { rows: filtered } = getInteractiveRows(config, context);
  const headers = config.columns.map((col) => col.label);
  const lines = [headers];
  filtered.forEach((row) => {
    const line = config.columns.map((col) => {
      const raw = row[col.key];
      const display = col.format ? col.format(raw) : (raw || "");
      return String(display).replace(/"/g, "\"\"");
    });
    lines.push(line);
  });
  const csv = lines.map((line) => line.map((cell) => `"${cell}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${config.id}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function renderAll() {
  renderMap("cdf");
  renderMap("indicator");
  updateIndicatorLayerNote();
  renderDetailCard();
  renderWashDetailCard();
  renderMethodExample();
  renderScatter();
  renderCorrelationBars();
  renderPatternLists();
  renderNutritionLists();
  renderNutritionProfileChart();
  renderGalleryMaps();
  renderBudgetDeepDive();
  if (state.activeTab === "child-impacts") {
    renderChildImpactExplorer();
  }
  renderInteractiveTables();
  renderTable();
}

function renderTopCards() {
  const joined = state.joinedRows.slice().sort((a, b) => Number(b.need_index || 0) - Number(a.need_index || 0));
  const topNeed = joined[0];
  const avgNeed = joined.length ? joined.reduce((sum, row) => sum + Number(row.need_index || 0), 0) / joined.length : 0;
  const avgWater = joined.length ? joined.reduce((sum, row) => sum + Number(row.basic_water_service_pct || 0), 0) / joined.length : 0;
  const nutritionSorted = state.joinedRows
    .filter((row) => Number.isFinite(Number(row.nutrition_risk_index)))
    .slice()
    .sort((a, b) => Number(b.nutrition_risk_index) - Number(a.nutrition_risk_index));
  const topNutrition = nutritionSorted[0] || null;

  const cards = [
    { value: formatNum(avgNeed), note: "Average WASH Risk Index across districts." },
    { value: formatPct(avgWater), note: "Average basic water service access across districts." },
    { value: topNeed ? topNeed.district : "n/a", note: topNeed ? `Highest WASH Risk Index: ${formatNum(topNeed.need_index)}.` : "Highest risk district not available." },
    { value: topNutrition ? topNutrition.district : "n/a", note: topNutrition ? `Highest nutrition risk: ${formatNum(topNutrition.nutrition_risk_index)}.` : "Highest nutrition risk district not available." }
  ];

  document.getElementById("topCards").innerHTML = cards
    .map((card) => `<article class="top-card"><strong>${card.value}</strong><span class="muted">${card.note}</span></article>`)
    .join("");
}

function renderMap(type) {
  const mapConfig = {
    cdf: { metric: state.cdfMetric, svgId: "cdfMap", tooltipId: "cdfMapTooltip", legendId: "cdfMapLegend" },
    indicator: { metric: state.indicatorMetric, svgId: "indicatorMap", tooltipId: "indicatorMapTooltip", legendId: "indicatorMapLegend" },
  }[type];

  if (!mapConfig) return;
  const metric = metricCatalog[mapConfig.metric];
  const svg = document.getElementById(mapConfig.svgId);
  const tooltip = document.getElementById(mapConfig.tooltipId);
  if (!metric || !svg || !tooltip) return;

  const entries = state.features.map((feature) => {
    const ctx = dataContext(feature.canonical);
    return { ...feature, value: metric.value(ctx) };
  });

  const numericValues = entries.map((entry) => entry.value).filter((value) => Number.isFinite(value));
  const min = numericValues.length ? Math.min(...numericValues) : 0;
  const max = numericValues.length ? Math.max(...numericValues) : 0;
  const maxAbs = numericValues.length ? Math.max(Math.abs(min), Math.abs(max)) : 1;

  svg.innerHTML = entries.map((entry) => {
    const selected = state.selectedCanonical === entry.canonical;
    const fill = metric.diverging ? colorDiverging(entry.value, maxAbs) : colorSequential(entry.value, min, max, metric.palette);
    return `<path class="map-feature${selected ? " active" : ""}" data-canonical="${entry.canonical}" d="${entry.path}" fill="${fill}"></path>`;
  }).join("");

  svg.querySelectorAll(".map-feature").forEach((path) => {
    path.addEventListener("mousemove", (event) => {
      const canonical = path.dataset.canonical;
      const feature = state.features.find((item) => item.canonical === canonical);
      const value = metric.value(dataContext(canonical));
      tooltip.innerHTML = `<strong>${escapeHtml(feature ? feature.name : canonical)}</strong><br>${metric.label}: ${metric.format(value)}`;
      tooltip.style.opacity = "1";
      positionTooltip(tooltip, event);
    });

    path.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
    path.addEventListener("click", () => {
      state.selectedCanonical = path.dataset.canonical;
      renderAll();
    });
  });

  if (document.getElementById(mapConfig.legendId)) {
    renderLegend(mapConfig.legendId, metric, min, max, maxAbs);
  }
}

function drawMetricMap(svgId, tooltipId, legendId, metricKey) {
  const metric = metricCatalog[metricKey];
  if (!metric) return;
  const svg = document.getElementById(svgId);
  const tooltip = document.getElementById(tooltipId);
  if (!svg || !tooltip) return;

  const entries = state.features.map((feature) => {
    const ctx = dataContext(feature.canonical);
    return { ...feature, value: metric.value(ctx) };
  });

  const numericValues = entries.map((entry) => entry.value).filter((value) => Number.isFinite(value));
  const min = numericValues.length ? Math.min(...numericValues) : 0;
  const max = numericValues.length ? Math.max(...numericValues) : 0;
  const maxAbs = numericValues.length ? Math.max(Math.abs(min), Math.abs(max)) : 1;

  svg.innerHTML = entries.map((entry) => {
    const selected = state.selectedCanonical === entry.canonical;
    const fill = metric.diverging ? colorDiverging(entry.value, maxAbs) : colorSequential(entry.value, min, max, metric.palette);
    return `<path class="map-feature${selected ? " active" : ""}" data-canonical="${entry.canonical}" d="${entry.path}" fill="${fill}"></path>`;
  }).join("");

  svg.querySelectorAll(".map-feature").forEach((path) => {
    path.addEventListener("mousemove", (event) => {
      const canonical = path.dataset.canonical;
      const feature = state.features.find((item) => item.canonical === canonical);
      const value = metric.value(dataContext(canonical));
      tooltip.innerHTML = `<strong>${escapeHtml(feature ? feature.name : canonical)}</strong><br>${metric.label}: ${metric.format(value)}`;
      tooltip.style.opacity = "1";
      positionTooltip(tooltip, event);
    });

    path.addEventListener("mouseleave", () => { tooltip.style.opacity = "0"; });
    path.addEventListener("click", () => {
      state.selectedCanonical = path.dataset.canonical;
      renderAll();
    });
  });

  renderLegend(legendId, metric, min, max, maxAbs);
}

function renderGalleryMaps() {
  const root = document.getElementById("dhsGalleryGrid");
  if (!root) return;

  const galleryMetrics = indicatorMetricOptions;

  root.innerHTML = galleryMetrics.map((metricKey) => `
    <article class="gallery-card">
      <h3>${metricCatalog[metricKey].label}</h3>
      <div class="map-shell">
        <svg id="galleryMap_${metricKey}" viewBox="0 0 940 760" aria-label="${metricCatalog[metricKey].label}"></svg>
        <div id="galleryTip_${metricKey}" class="tooltip"></div>
      </div>
      <div id="galleryLegend_${metricKey}" class="legend"></div>
    </article>
  `).join("");

  galleryMetrics.forEach((metricKey) => {
    drawMetricMap(`galleryMap_${metricKey}`, `galleryTip_${metricKey}`, `galleryLegend_${metricKey}`, metricKey);
  });
}
function updateIndicatorLayerNote() {
  const node = document.getElementById("indicatorLayerNote");
  if (!node) return;
  const metric = metricCatalog[state.indicatorMetric];
  node.textContent = metric ? metric.legendNote : "";
}

function setupSectorTabs() {
  const buttons = document.querySelectorAll("#sectorTabs .tab-btn");
  const panels = document.querySelectorAll(".sector-panel");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetSector = button.dataset.sector;
      buttons.forEach((btn) => btn.classList.remove("active"));
      panels.forEach((panel) => panel.classList.remove("active"));
      button.classList.add("active");
      const targetPanel = document.querySelector(`.sector-panel[data-sector="${targetSector}"]`);
      if (targetPanel) targetPanel.classList.add("active");
    });
  });
}

const CHILD_IMPACT_UNDER5_AGES = ["<28 days", "1-5 months", "6-11 months", "12-23 months", "2-4 years"];
const CHILD_IMPACT_AGE_COLORS = ["#0b6e80", "#2f8fa1", "#56aebd", "#7fc7d2", "#a7dce3", "#d5ebe9", "#e6d7c4", "#d89e55"];
const CHILD_IMPACT_WASH_COLORS = {
  "WASH Core": "#0b6e80",
  "WASH Extended": "#56aebd",
  "Non-WASH": "#c3ced6"
};
const CHILD_IMPACT_NUTRITION_COLORS = {
  "Direct undernutrition": "#b9781f",
  "WASH-linked infections": "#0b6e80",
  Other: "#c3ced6"
};
const CHILD_IMPACT_NUTRITION_PALETTES = {
  "Direct undernutrition": ["#8c5b13", "#a56b18", "#b9781f", "#cc943f", "#ddb673", "#ead1a6"],
  "WASH-linked infections": ["#084d5a", "#0b6e80", "#2f8fa1", "#56aebd", "#89cad3", "#c1e2e6"],
  Other: ["#4b5965", "#667785", "#8394a1", "#a4b2bc", "#c3ced6", "#dde4ea"]
};

function setupChildImpactControls() {
  const bundle = state.childImpactBundle;
  const status = document.getElementById("childImpactStatus");
  if (!bundle || !state.childImpactRows.length) {
    if (status) status.textContent = "Child burden data could not be loaded.";
    return;
  }

  const measureSelect = document.getElementById("childMeasureSelect");
  const metricSelect = document.getElementById("childMetricSelect");
  const modeSelect = document.getElementById("childModeSelect");
  const topNRange = document.getElementById("childTopNRange");
  const topNValue = document.getElementById("childTopNValue");
  const causeFilter = document.getElementById("childCauseFilter");
  const allAgesBtn = document.getElementById("childAllAgesBtn");
  const under5Btn = document.getElementById("childUnder5Btn");

  if (measureSelect) {
    measureSelect.innerHTML = (bundle.measures || [])
      .map((measure) => `<option value="${escapeHtml(measure)}">${escapeHtml(measure)}</option>`)
      .join("");
    if (!bundle.measures?.includes(state.childImpactFilters.measure)) {
      state.childImpactFilters.measure = bundle.measures?.[0] || state.childImpactFilters.measure;
    }
    measureSelect.value = state.childImpactFilters.measure;
    measureSelect.addEventListener("change", (event) => {
      state.childImpactFilters.measure = event.target.value;
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  }

  if (metricSelect) {
    metricSelect.innerHTML = (bundle.metrics || [])
      .map((metric) => `<option value="${escapeHtml(metric)}">${escapeHtml(metric)}</option>`)
      .join("");
    if (!bundle.metrics?.includes(state.childImpactFilters.metric)) {
      state.childImpactFilters.metric = bundle.metrics?.[0] || state.childImpactFilters.metric;
    }
    metricSelect.value = state.childImpactFilters.metric;
    metricSelect.addEventListener("change", (event) => {
      state.childImpactFilters.metric = event.target.value;
      updateChildImpactMetricNote();
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  }

  if (modeSelect) {
    modeSelect.value = state.childImpactFilters.mode;
    modeSelect.addEventListener("change", (event) => {
      state.childImpactFilters.mode = event.target.value;
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  }

  if (topNRange) {
    topNRange.value = String(state.childImpactFilters.topN);
    topNValue.textContent = `${state.childImpactFilters.topN} causes`;
    topNRange.addEventListener("input", (event) => {
      state.childImpactFilters.topN = Number(event.target.value);
      topNValue.textContent = `${state.childImpactFilters.topN} causes`;
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  }

  if (causeFilter) {
    causeFilter.value = state.childImpactFilters.causeFilter;
    causeFilter.addEventListener("input", (event) => {
      state.childImpactFilters.causeFilter = event.target.value.trim().toLowerCase();
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  }

  if (allAgesBtn) {
    allAgesBtn.addEventListener("click", () => {
      state.childImpactFilters.ages = (bundle.ages || []).slice();
      renderChildImpactAgePills();
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  }

  if (under5Btn) {
    under5Btn.addEventListener("click", () => {
      state.childImpactFilters.ages = (bundle.ages || []).filter((age) => CHILD_IMPACT_UNDER5_AGES.includes(age));
      renderChildImpactAgePills();
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  }

  updateChildImpactMetricNote();
  renderChildImpactAgePills();
  updateChildImpactStatus(state.childImpactRows.length);
}

function renderChildImpactAgePills() {
  const container = document.getElementById("childAgePills");
  const bundle = state.childImpactBundle;
  if (!container || !bundle) return;
  const selected = new Set(state.childImpactFilters.ages);
  container.innerHTML = (bundle.ages || [])
    .map((age) => `<button class="child-age-pill ${selected.has(age) ? "active" : ""}" data-age="${escapeHtml(age)}" type="button">${escapeHtml(age)}</button>`)
    .join("");

  container.querySelectorAll(".child-age-pill").forEach((button) => {
    button.addEventListener("click", () => {
      const age = button.dataset.age;
      const current = new Set(state.childImpactFilters.ages);
      if (current.has(age) && current.size === 1) return;
      if (current.has(age)) current.delete(age);
      else current.add(age);
      state.childImpactFilters.ages = (bundle.ages || []).filter((entry) => current.has(entry));
      renderChildImpactAgePills();
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  });
}

function updateChildImpactMetricNote() {
  const node = document.getElementById("childImpactMetricNote");
  if (!node) return;
  node.textContent = state.childImpactFilters.metric === "Percent"
    ? "Percent uses the GBD percentage metric from the source extract and is shown here as percentage points."
    : "Number uses the GBD count metric from the source extract for Malawi in 2023.";
}

function updateChildImpactStatus(rowCount) {
  const node = document.getElementById("childImpactStatus");
  const bundle = state.childImpactBundle;
  if (!node || !bundle) return;
  const ages = state.childImpactFilters.ages || [];
  node.textContent = `${bundle.country || "Malawi"} | GBD ${bundle.year || "2023"} | ${rowCount.toLocaleString()} filtered rows across ${ages.length} age bands`;
}

function setupChildImpactSectorTabs() {
  const buttons = document.querySelectorAll("#impactSectorTabs .tab-btn");
  const panels = document.querySelectorAll(".impact-sector-panel");
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const sector = button.dataset.sector;
      state.childImpactSector = sector;
      buttons.forEach((item) => item.classList.toggle("active", item === button));
      panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.sector === sector));
      if (state.activeTab === "child-impacts") renderChildImpactExplorer();
    });
  });
}

function renderChildImpactExplorer() {
  if (!state.childImpactBundle || !state.childImpactRows.length) {
    updateChildImpactStatus(0);
    return;
  }
  if (typeof Chart === "undefined") {
    const node = document.getElementById("childImpactStatus");
    if (node) node.textContent = "Chart library failed to load for the child impact explorer.";
    return;
  }

  const filteredRows = getChildImpactFilteredRows();
  updateChildImpactStatus(filteredRows.length);

  switch (state.childImpactSector) {
    case "wash":
      renderChildImpactWashSector(filteredRows);
      break;
    case "nutrition":
      renderChildImpactNutritionSector(filteredRows);
      break;
    case "health":
    default:
      renderChildImpactHealthSector(filteredRows);
      break;
  }
}

function getChildImpactFilteredRows() {
  const ages = new Set(state.childImpactFilters.ages || []);
  return state.childImpactRows
    .filter((row) => row.measure_name === state.childImpactFilters.measure)
    .filter((row) => row.metric_name === state.childImpactFilters.metric)
    .filter((row) => ages.has(row.age_name))
    .filter((row) => !state.childImpactFilters.causeFilter || String(row.cause_name).toLowerCase().includes(state.childImpactFilters.causeFilter))
    .map((row) => ({
      ...row,
      displayValue: normalizeChildImpactValue(row.val, state.childImpactFilters.metric)
    }));
}

function renderChildImpactWashSector(allRows) {
  const rows = allRows.filter((row) => row.wash_bucket !== "Non-WASH");
  renderChildImpactSummary("wash", buildChildImpactWashSummary(allRows, rows));
  if (!rows.length) {
    destroyChildImpactCharts(["impactWashCauseAgeChart", "impactWashAgeBucketChart", "impactWashCauseBucketChart"]);
    return;
  }

  const topN = state.childImpactFilters.topN;
  const ageRows = buildCauseAgeRows(rows, topN);
  const ageOrder = state.childImpactFilters.ages.slice();
  renderCauseAgeChart("impactWashCauseAgeChart", ageRows, ageOrder, `Top ${topN} WASH-linked causes by age band`);

  renderAgeCategoryChart(
    "impactWashAgeBucketChart",
    rows,
    ageOrder,
    ["WASH Core", "WASH Extended"],
    "wash_bucket",
    CHILD_IMPACT_WASH_COLORS,
    state.childImpactFilters.mode,
    state.childImpactFilters.mode === "share" ? "WASH share by age" : "Age-wise WASH burden split"
  );

  const causeBucketRows = buildCauseCategoryRows(rows, topN, ["WASH Core", "WASH Extended"], "wash_bucket");
  renderCauseCategoryChart(
    "impactWashCauseBucketChart",
    causeBucketRows,
    ["WASH Core", "WASH Extended"],
    CHILD_IMPACT_WASH_COLORS,
    `Top ${topN} WASH-linked causes by WASH bucket`
  );
}

function renderChildImpactHealthSector(rows) {
  renderChildImpactSummary("health", buildChildImpactHealthSummary(rows));
  if (!rows.length) {
    destroyChildImpactCharts(["impactHealthCauseAgeChart", "impactHealthAgeBucketChart", "impactHealthCauseBucketChart"]);
    return;
  }

  const topN = state.childImpactFilters.topN;
  const ageRows = buildCauseAgeRows(rows, topN);
  const ageOrder = state.childImpactFilters.ages.slice();
  renderCauseAgeChart("impactHealthCauseAgeChart", ageRows, ageOrder, `Top ${topN} child causes by age band`);

  renderAgeCategoryChart(
    "impactHealthAgeBucketChart",
    rows,
    ageOrder,
    ["WASH Core", "WASH Extended", "Non-WASH"],
    "wash_bucket",
    CHILD_IMPACT_WASH_COLORS,
    state.childImpactFilters.mode,
    state.childImpactFilters.mode === "share" ? "WASH bucket share by age" : "Age-wise burden by WASH bucket"
  );

  const causeBucketRows = buildCauseCategoryRows(rows, topN, ["WASH Core", "WASH Extended", "Non-WASH"], "wash_bucket");
  renderCauseCategoryChart(
    "impactHealthCauseBucketChart",
    causeBucketRows,
    ["WASH Core", "WASH Extended", "Non-WASH"],
    CHILD_IMPACT_WASH_COLORS,
    `Top ${topN} child causes by WASH bucket`
  );
}

function renderChildImpactNutritionSector(allRows) {
  const rows = allRows.filter((row) => row.nutrition_category !== "Other");
  renderChildImpactSummary("nutrition", buildChildImpactNutritionSummary(allRows, rows));
  if (!rows.length) {
    destroyChildImpactCharts(["impactNutritionCauseAgeChart", "impactNutritionAgeCategoryChart", "impactNutritionAgeCauseChart"]);
    return;
  }

  const topN = state.childImpactFilters.topN;
  const ageRows = buildCauseAgeRows(rows, topN);
  const ageOrder = state.childImpactFilters.ages.slice();
  renderCauseAgeChart("impactNutritionCauseAgeChart", ageRows, ageOrder, `Top ${topN} nutrition-relevant causes by age band`);

  renderAgeCategoryChart(
    "impactNutritionAgeCategoryChart",
    allRows,
    ageOrder,
    ["Direct undernutrition", "WASH-linked infections", "Other"],
    "nutrition_category",
    CHILD_IMPACT_NUTRITION_COLORS,
    state.childImpactFilters.mode,
    state.childImpactFilters.mode === "share" ? "Nutrition burden share by age" : "Age-wise nutrition burden split"
  );

  const ageCauseRows = buildAgeCauseRows(rows, topN);
  renderAgeCauseChart("impactNutritionAgeCauseChart", ageCauseRows, ageOrder, `Age profile of top ${topN} nutrition-relevant causes`);
}

function renderChildImpactSummary(sectorKey, cards) {
  const container = document.getElementById(`impactSummary-${sectorKey}`);
  if (!container) return;
  container.innerHTML = cards
    .map((card) => `
      <article class="impact-summary-card">
        <strong>${escapeHtml(card.value)}</strong>
        <span>${escapeHtml(card.label)}</span>
        <p class="muted small-note">${escapeHtml(card.note)}</p>
      </article>
    `)
    .join("");
}

function buildChildImpactWashSummary(allRows, washRows) {
  const allTotal = sumChildImpactValues(allRows);
  const washTotal = sumChildImpactValues(washRows);
  const washCore = sumChildImpactValues(washRows.filter((row) => row.wash_bucket === "WASH Core"));
  const leadCause = topChildImpactEntry(washRows, "cause_name");
  const leadAge = topChildImpactEntry(washRows, "age_name");
  return [
    {
      value: formatChildImpactMetric(washTotal),
      label: "Selected WASH-attributable burden",
      note: `Malawi child ${state.childImpactFilters.measure.toLowerCase()} in ${state.childImpactBundle.year}.`
    },
    {
      value: formatPct(allTotal ? (washTotal / allTotal) * 100 : 0),
      label: "Share of selected child burden",
      note: `WASH Core + Extended causes as a share of the selected child ${state.childImpactFilters.measure.toLowerCase()}.`
    },
    {
      value: leadCause?.key || "n/a",
      label: "Leading WASH-linked cause",
      note: leadCause ? formatChildImpactMetric(leadCause.value) : "No cause matched the current filter."
    },
    {
      value: leadAge?.key || "n/a",
      label: "Peak child age band",
      note: `WASH Core alone contributes ${formatPct(washTotal ? (washCore / washTotal) * 100 : 0)} of the selected WASH burden.`
    }
  ];
}

function buildChildImpactHealthSummary(rows) {
  const total = sumChildImpactValues(rows);
  const washShare = sumChildImpactValues(rows.filter((row) => row.wash_bucket !== "Non-WASH"));
  const leadCause = topChildImpactEntry(rows, "cause_name");
  const leadAge = topChildImpactEntry(rows, "age_name");
  return [
    {
      value: formatChildImpactMetric(total),
      label: "Selected child burden",
      note: `Filtered Malawi child ${state.childImpactFilters.measure.toLowerCase()} for the selected age bands.`
    },
    {
      value: formatPct(total ? (washShare / total) * 100 : 0),
      label: "WASH-attributable share",
      note: "WASH Core + Extended causes as a share of the selected child burden."
    },
    {
      value: leadCause?.key || "n/a",
      label: "Leading child cause",
      note: leadCause ? formatChildImpactMetric(leadCause.value) : "No cause matched the current filter."
    },
    {
      value: leadAge?.key || "n/a",
      label: "Most affected age band",
      note: leadAge ? formatChildImpactMetric(leadAge.value) : "No age band matched the current filter."
    }
  ];
}

function buildChildImpactNutritionSummary(allRows, nutritionRows) {
  const total = sumChildImpactValues(allRows);
  const nutritionTotal = sumChildImpactValues(nutritionRows);
  const directTotal = sumChildImpactValues(nutritionRows.filter((row) => row.nutrition_category === "Direct undernutrition"));
  const infectionTotal = sumChildImpactValues(nutritionRows.filter((row) => row.nutrition_category === "WASH-linked infections"));
  const leadCause = topChildImpactEntry(nutritionRows, "cause_name");
  const leadAge = topChildImpactEntry(nutritionRows, "age_name");
  return [
    {
      value: formatPct(total ? (nutritionTotal / total) * 100 : 0),
      label: "Nutrition-relevant share",
      note: "Direct undernutrition + WASH-linked infections as a share of the selected child burden."
    },
    {
      value: formatPct(nutritionTotal ? (directTotal / nutritionTotal) * 100 : 0),
      label: "Direct undernutrition share",
      note: `WASH-linked infections contribute ${formatPct(nutritionTotal ? (infectionTotal / nutritionTotal) * 100 : 0)} of nutrition-relevant burden.`
    },
    {
      value: leadCause?.key || "n/a",
      label: "Leading nutrition-relevant cause",
      note: leadCause ? formatChildImpactMetric(leadCause.value) : "No cause matched the current filter."
    },
    {
      value: leadAge?.key || "n/a",
      label: "Peak age band",
      note: leadAge ? formatChildImpactMetric(leadAge.value) : "No age band matched the current filter."
    }
  ];
}

function buildCauseAgeRows(rows, topN) {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.cause_name)) {
      grouped.set(row.cause_name, { total: 0, byAge: {} });
    }
    const entry = grouped.get(row.cause_name);
    entry.total += row.displayValue;
    entry.byAge[row.age_name] = (entry.byAge[row.age_name] || 0) + row.displayValue;
  });
  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, ...value }))
    .sort((left, right) => right.total - left.total)
    .slice(0, topN);
}

function buildCauseCategoryRows(rows, topN, categories, field) {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.cause_name)) {
      grouped.set(row.cause_name, { total: 0, byCategory: Object.fromEntries(categories.map((category) => [category, 0])) });
    }
    const entry = grouped.get(row.cause_name);
    entry.total += row.displayValue;
    entry.byCategory[row[field]] = (entry.byCategory[row[field]] || 0) + row.displayValue;
  });
  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, ...value }))
    .sort((left, right) => right.total - left.total)
    .slice(0, topN);
}

function buildAgeCauseRows(rows, topN) {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.cause_name)) {
      grouped.set(row.cause_name, { total: 0, category: row.nutrition_category, byAge: {} });
    }
    const entry = grouped.get(row.cause_name);
    entry.total += row.displayValue;
    entry.byAge[row.age_name] = (entry.byAge[row.age_name] || 0) + row.displayValue;
  });
  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, ...value }))
    .sort((left, right) => right.total - left.total)
    .slice(0, topN);
}

function renderCauseAgeChart(canvasId, rows, ageOrder, title) {
  const datasets = ageOrder.map((age, index) => ({
    label: age,
    data: rows.map((row) => row.byAge[age] || 0),
    backgroundColor: CHILD_IMPACT_AGE_COLORS[index % CHILD_IMPACT_AGE_COLORS.length],
    stack: "impact-age"
  }));

  setChildImpactChart(canvasId, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets
    },
    options: buildChildImpactChartOptions(title, {
      axisLabel: childImpactAxisLabel(),
      tooltipLabel(context) {
        const row = rows[context.dataIndex];
        const value = Number(context.parsed.x || 0);
        const pct = row?.total ? (value / row.total) * 100 : 0;
        return `${context.dataset.label}: ${formatChildImpactMetric(value)} (${pct.toFixed(1)}% of ${row?.label || "cause"})`;
      }
    })
  });
}

function renderAgeCategoryChart(canvasId, rows, ageOrder, categories, field, colors, mode, title) {
  const grouped = new Map();
  rows.forEach((row) => {
    if (!grouped.has(row.age_name)) {
      grouped.set(row.age_name, { total: 0, byCategory: Object.fromEntries(categories.map((category) => [category, 0])) });
    }
    const entry = grouped.get(row.age_name);
    entry.total += row.displayValue;
    entry.byCategory[row[field]] = (entry.byCategory[row[field]] || 0) + row.displayValue;
  });

  const datasets = categories.map((category) => ({
    label: category,
    data: ageOrder.map((age) => {
      const entry = grouped.get(age);
      const raw = entry?.byCategory?.[category] || 0;
      return mode === "share" ? (entry?.total ? (raw / entry.total) * 100 : 0) : raw;
    }),
    backgroundColor: colors[category],
    stack: "impact-category"
  }));

  setChildImpactChart(canvasId, {
    type: "bar",
    data: {
      labels: ageOrder,
      datasets
    },
    options: buildChildImpactChartOptions(title, {
      axisLabel: mode === "share" ? "Share of age-specific total (%)" : childImpactAxisLabel(),
      max: mode === "share" ? 100 : undefined,
      tooltipLabel(context) {
        const age = context.label;
        const entry = grouped.get(age);
        const raw = entry?.byCategory?.[context.dataset.label] || 0;
        const displayValue = mode === "share" ? Number(context.parsed.x || 0) : raw;
        const pct = mode === "share" ? displayValue : (entry?.total ? (raw / entry.total) * 100 : 0);
        const valueText = mode === "share" ? `${displayValue.toFixed(1)}%` : formatChildImpactMetric(displayValue);
        return `${context.dataset.label}: ${valueText} (${pct.toFixed(1)}% of ${age})`;
      }
    })
  });
}

function renderCauseCategoryChart(canvasId, rows, categories, colors, title) {
  const datasets = categories.map((category) => ({
    label: category,
    data: rows.map((row) => row.byCategory[category] || 0),
    backgroundColor: colors[category],
    stack: "impact-cause-category"
  }));

  setChildImpactChart(canvasId, {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets
    },
    options: buildChildImpactChartOptions(title, {
      axisLabel: childImpactAxisLabel(),
      tooltipLabel(context) {
        const row = rows[context.dataIndex];
        const value = Number(context.parsed.x || 0);
        const pct = row?.total ? (value / row.total) * 100 : 0;
        return `${context.dataset.label}: ${formatChildImpactMetric(value)} (${pct.toFixed(1)}% of ${row?.label || "cause"})`;
      }
    })
  });
}

function renderAgeCauseChart(canvasId, rows, ageOrder, title) {
  const paletteIndex = { "Direct undernutrition": 0, "WASH-linked infections": 0, Other: 0 };
  const datasets = rows.map((row) => {
    const paletteKey = row.category || "Other";
    const palette = CHILD_IMPACT_NUTRITION_PALETTES[paletteKey] || CHILD_IMPACT_NUTRITION_PALETTES.Other;
    const color = palette[paletteIndex[paletteKey] % palette.length];
    paletteIndex[paletteKey] += 1;
    return {
      label: row.label,
      data: ageOrder.map((age) => row.byAge[age] || 0),
      backgroundColor: color,
      borderColor: color,
      borderWidth: 1,
      stack: "impact-age-cause"
    };
  });

  setChildImpactChart(canvasId, {
    type: "bar",
    data: {
      labels: ageOrder,
      datasets
    },
    options: buildChildImpactChartOptions(title, {
      axisLabel: childImpactAxisLabel(),
      tooltipLabel(context) {
        const row = rows[context.datasetIndex];
        const value = Number(context.parsed.x || 0);
        return `${context.dataset.label}: ${formatChildImpactMetric(value)}${row?.category ? ` (${row.category})` : ""}`;
      }
    })
  });
}

function buildChildImpactChartOptions(title, options) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: title },
      tooltip: {
        callbacks: {
          label: options.tooltipLabel
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: options.axisLabel
        },
        min: 0,
        max: options.max
      },
      y: {
        ticks: {
          autoSkip: false
        }
      }
    }
  };
}

function setChildImpactChart(id, config) {
  if (state.childImpactCharts[id]) {
    state.childImpactCharts[id].destroy();
  }
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const context = canvas.getContext("2d");
  if (!context) return;
  state.childImpactCharts[id] = new Chart(context, config);
}

function destroyChildImpactCharts(ids) {
  ids.forEach((id) => {
    if (state.childImpactCharts[id]) {
      state.childImpactCharts[id].destroy();
      delete state.childImpactCharts[id];
    }
  });
}

function topChildImpactEntry(rows, key) {
  const grouped = new Map();
  rows.forEach((row) => {
    grouped.set(row[key], (grouped.get(row[key]) || 0) + row.displayValue);
  });
  const entries = Array.from(grouped.entries()).sort((left, right) => right[1] - left[1]);
  return entries.length ? { key: entries[0][0], value: entries[0][1] } : null;
}

function sumChildImpactValues(rows) {
  return rows.reduce((sum, row) => sum + Number(row.displayValue || 0), 0);
}

function normalizeChildImpactValue(value, metric) {
  const numeric = Number(value || 0);
  return metric === "Percent" ? numeric * 100 : numeric;
}

function formatChildImpactMetric(value) {
  if (!Number.isFinite(Number(value))) return "n/a";
  const numeric = Number(value);
  if (state.childImpactFilters.metric === "Percent") {
    return `${numeric.toFixed(numeric >= 10 ? 1 : 2)}%`;
  }
  if (Math.abs(numeric) >= 1000) {
    return numeric.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return numeric.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function childImpactAxisLabel() {
  return state.childImpactFilters.metric === "Percent"
    ? "GBD percent metric (%)"
    : `${state.childImpactFilters.measure} (Number)`;
}

function renderBudgetDeepDive() {
  const context = buildSectorContext();
  Object.entries(SECTOR_BUDGETS).forEach(([sectorKey, config]) => {
    renderSectorMetrics(sectorKey, config, context);
    renderSectorCards(sectorKey, config);
    renderSectorCharts(sectorKey, config, context);
    renderSectorTable(sectorKey, config, context);
  });
}

function buildSectorContext() {
  const totals = {
    total: 0,
    construction: 0,
    districtWide: 0,
    bursaries: 0,
    projectMgmt: 0,
    disaster: 0,
    women: 0,
    youth: 0
  };

  state.budgetByDistrict.forEach((row) => {
    totals.total += Number(row.total || 0);
    totals.construction += Number(row.construction || 0);
    totals.districtWide += Number(row.districtWide || 0);
    totals.bursaries += Number(row.bursaries || 0);
    totals.projectMgmt += Number(row.projectMgmt || 0);
    totals.disaster += Number(row.disaster || 0);
    totals.women += Number(row.women || 0);
    totals.youth += Number(row.youth || 0);
  });

  return {
    totals,
    averages: computeIndicatorAverages()
  };
}

function computeIndicatorAverages() {
  const keys = ["stunting_pct", "wasting_pct", "underweight_pct"];
  const sums = { stunting: 0, wasting: 0, underweight: 0 };
  const validRows = state.joinedRows.filter((row) => keys.every((key) => Number.isFinite(Number(row[key]))));
  if (!validRows.length) return { stunting: 0, wasting: 0, underweight: 0, nutrition: 0 };
  validRows.forEach((row) => {
    sums.stunting += Number(row.stunting_pct);
    sums.wasting += Number(row.wasting_pct);
    sums.underweight += Number(row.underweight_pct);
  });

  const stuntingAvg = sums.stunting / validRows.length;
  const wastingAvg = sums.wasting / validRows.length;
  const underweightAvg = sums.underweight / validRows.length;
  const nutritionAvg = (stuntingAvg + wastingAvg + underweightAvg) / 3;
  return { stunting: stuntingAvg, wasting: wastingAvg, underweight: underweightAvg, nutrition: nutritionAvg };
}

function renderSectorMetrics(sectorKey, config, context) {
  const container = document.getElementById(`sectorMetrics-${sectorKey}`);
  if (!container) return;
  container.innerHTML = (config.metrics || [])
    .map((metric) => {
      const raw = typeof metric.value === "function" ? metric.value(context) : metric.value;
      const display = formatMetricDisplay(raw, metric);
      return `
        <article class="sector-metric">
          <strong>${escapeHtml(String(display))}</strong>
          <span class="muted">${escapeHtml(metric.label)}</span>
          <p class="muted small-note">${escapeHtml(metric.note)}</p>
        </article>
      `;
    })
    .join("");
}

function renderSectorCards(sectorKey, config) {
  const container = document.getElementById(`sectorCards-${sectorKey}`);
  if (!container) return;
  container.innerHTML = (config.cards || [])
    .map((card) => `
      <article class="sector-card">
        <h4>${escapeHtml(card.title)}</h4>
        <p class="muted">${escapeHtml(card.text)}</p>
      </article>
    `)
    .join("");
}

function renderSectorCharts(sectorKey, config, context) {
  const container = document.getElementById(`sectorCharts-${sectorKey}`);
  if (!container) return;

  const categoryRows = getSectorCostCategories(sectorKey, context)
    .map((row) => ({
      label: row.category,
      value: Number(row.value_mk_m),
      note: row.note || ""
    }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0)
    .sort((a, b) => b.value - a.value);
  const projectRows = getSectorProjects(sectorKey)
    .map((row) => ({
      label: row.project,
      value: Number(row.value_mk_m),
      note: row.note || ""
    }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0)
    .sort((a, b) => b.value - a.value);
  const programRows = getSectorPrograms(sectorKey)
    .map((row) => ({
      label: row.programme,
      value: Number(row.value_mk_m),
      note: row.note || ""
    }))
    .filter((row) => Number.isFinite(row.value) && row.value > 0)
    .sort((a, b) => b.value - a.value);

  const colorSets = {
    wash: ["#0b6e80", "#3aa4ba", "#8fd3df", "#cdecef"],
    health: ["#9b3d2b", "#c65b42", "#e2a193", "#f4d1c9"],
    nutrition: ["#b9781f", "#d79a3a", "#e9c07a", "#f4e0b4"]
  };
  const palette = colorSets[sectorKey] || colorSets.wash;
  const totalCategories = categoryRows.reduce((sum, row) => sum + row.value, 0);
  const categoryHtml = categoryRows.length
    ? `
      <div class="sector-chart-grid">
        ${categoryRows.map((row, idx) => {
          const pct = totalCategories ? (row.value / totalCategories) * 100 : 0;
          return `
            <div class="sector-chart-row" title="${escapeHtml(row.note)}">
              <div class="sector-chart-label">
                <strong>${escapeHtml(row.label)}</strong>
                <span>${formatBudgetMillions(row.value)} | ${formatPct(pct)}</span>
              </div>
              <div class="sector-chart-bar">
                <div style="width:${pct.toFixed(1)}%; background: linear-gradient(90deg, ${palette[0]}, ${palette[1] || palette[0]});"></div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `
    : `<p class="muted">No category data available.</p>`;

  const topProjects = projectRows.slice(0, 10);
  const maxProject = topProjects.length ? Math.max(...topProjects.map((row) => row.value)) : 1;
  const lineStart = palette[0];
  const lineEnd = palette[1] || palette[0];
  const projectHtml = topProjects
    .map((row) => {
      const width = maxProject ? (row.value / maxProject) * 100 : 0;
      return `
        <div class="lollipop-row" title="${escapeHtml(row.note)}">
          <span class="lollipop-label">${escapeHtml(row.label)}</span>
          <div class="lollipop-track">
            <div class="lollipop-line" style="width:${width}%; background: linear-gradient(90deg, ${lineStart}, ${lineEnd});">
              <span class="lollipop-dot"></span>
            </div>
          </div>
          <span class="lollipop-value">${formatBudgetMillions(row.value)}</span>
        </div>
      `;
    })
    .join("");

  const topPrograms = programRows.slice(0, 10);
  const maxProgram = topPrograms.length ? Math.max(...topPrograms.map((row) => row.value)) : 1;
  const programHtml = topPrograms.length
    ? topPrograms.map((row) => {
      const width = maxProgram ? (row.value / maxProgram) * 100 : 0;
      return `
        <div class="lollipop-row" title="${escapeHtml(row.note)}">
          <span class="lollipop-label">${escapeHtml(row.label)}</span>
          <div class="lollipop-track">
            <div class="lollipop-line" style="width:${width}%; background: linear-gradient(90deg, ${lineStart}, ${lineEnd});">
              <span class="lollipop-dot"></span>
            </div>
          </div>
          <span class="lollipop-value">${formatBudgetMillions(row.value)}</span>
        </div>
      `;
    }).join("")
    : `<p class="muted">No programme data available.</p>`;

  container.innerHTML = `
    <article class="sector-chart-card">
      <h4>Major cost categories</h4>
      ${categoryHtml}
    </article>
    <article class="sector-chart-card">
      <h4>Programme allocations</h4>
      <div class="lollipop-grid">
        ${programHtml}
      </div>
    </article>
    <article class="sector-chart-card">
      <h4>Named investments / projects</h4>
      <div class="lollipop-grid">
        ${projectHtml}
      </div>
    </article>
  `;
}

function renderSectorTable(sectorKey, config, context) {
  const container = document.getElementById(`sectorTable-${sectorKey}`);
  if (!container) return;
  const rows = (config.tableRows || [])
    .map((row) => {
      const raw = typeof row.value === "function" ? row.value(context) : row.value;
      const display = formatSectorValue(raw, row.unit);
      const unitDisplay = row.unit
        ? (isMoneyUnit(row.unit) || row.unit === "%" ? "" : row.unit)
        : "";
      return `
        <tr>
          <th>${escapeHtml(row.item)}</th>
          <td>${escapeHtml(display)}</td>
          <td>${escapeHtml(unitDisplay)}</td>
          <td>${escapeHtml(row.note || "")}</td>
        </tr>
      `;
    })
    .join("");
  container.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Indicator</th>
          <th>Value</th>
          <th>Unit</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function isMoneyUnit(unit) {
  if (!unit) return false;
  const normalized = unit.toLowerCase();
  return normalized.includes("mk") || normalized.includes("mwk");
}

function formatMetricDisplay(raw, metric) {
  if (raw === null || raw === undefined || raw === "") return "n/a";
  const unit = metric.unit || "";
  if (metric.type === "money" || isMoneyUnit(unit)) return formatBudgetMillions(Number(raw));
  if (metric.type === "pct") return formatPct(raw);
  if (metric.type === "int") {
    const display = formatInt(raw);
    return unit ? `${display} ${unit}` : display;
  }
  if (metric.type === "number") {
    const display = formatNumLocale(raw);
    return unit ? `${display} ${unit}` : display;
  }
  const display = typeof raw === "number" ? formatNumLocale(raw) : String(raw);
  if (!unit || unit === "%" || String(display).includes(unit)) return display;
  return `${display} ${unit}`;
}

function formatSectorValue(value, unit) {
  if (value === null || value === undefined || value === "") return "n/a";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (isMoneyUnit(unit)) return formatBudgetMillions(value);
    if (unit === "%") return formatPct(value);
    const cleaned = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (!unit || unit === "%") return cleaned;
    return `${cleaned} ${unit}`;
  }
  return String(value);
}

function renderNutritionProfileChart() {
  const svg = document.getElementById("nutritionIndicatorChart");
  if (!svg) return;
  const indicators = ["stunting_pct", "wasting_pct", "underweight_pct"];
  const rows = indicators.map((key) => {
    const label = friendlyIndicator(key);
    const values = state.joinedRows.map((row) => Number(row[key] || 0)).filter((v) => Number.isFinite(v));
    const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
    return { key, label, value: avg };
  });

  const width = 700;
  const height = 320;
  const margin = { top: 28, right: 18, bottom: 36, left: 160 };
  const barSpace = (height - margin.top - margin.bottom) / rows.length;
  const maxValue = Math.max(50, ...rows.map((row) => row.value));
  const target = 15;

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"></rect>
    ${rows
      .map((row, index) => {
        const y = margin.top + index * barSpace + 8;
        const barWidth = ((width - margin.left - margin.right) * Math.min(row.value, maxValue)) / maxValue;
        return `
          <text x="${margin.left - 12}" y="${y + 12}" text-anchor="end" font-size="12" fill="#2e3e4d">${escapeHtml(row.label)}</text>
          <rect x="${margin.left}" y="${y}" width="${barWidth}" height="20" fill="${index % 2 === 0 ? "#2f7ab7" : "#cc5039"}" rx="4"></rect>
          <text x="${margin.left + barWidth + 10}" y="${y + 14}" font-size="12" fill="#526372">${formatNum(row.value)}%</text>
        `;
      })
      .join("")}
    <line x1="${margin.left + ((width - margin.left - margin.right) * target) / maxValue}" y1="${margin.top - 6}" x2="${margin.left + ((width - margin.left - margin.right) * target) / maxValue}" y2="${height - margin.bottom + 8}" stroke="#1b7f5d" stroke-dasharray="4 3"></line>
    <text x="${margin.left + ((width - margin.left - margin.right) * target) / maxValue + 4}" y="${margin.top - 12}" font-size="11" fill="#1b7f5d">15% target</text>
  `;
}

function renderLegend(id, metric, min, max, maxAbs) {
  const node = document.getElementById(id);
  if (!node) return;
  if (metric.diverging) {
    const colors = [-1, -0.6, -0.2, 0.2, 0.6, 1].map((v) => colorDiverging(v * maxAbs, maxAbs));
    node.innerHTML = `
      <div class="legend-ramp">${colors.map((color) => `<span style="background:${color}"></span>`).join("")}</div>
      <div class="legend-row"><span>${metric.format(-maxAbs)}</span><span>${metric.format(0)}</span><span>${metric.format(maxAbs)}</span></div>
      <p class="muted">${metric.legendNote}</p>
    `;
    return;
  }

  const colors = [0, 0.2, 0.4, 0.6, 0.8, 1].map((ratio) => colorSequential(min + ((max - min) * ratio), min, max, metric.palette));
  node.innerHTML = `
    <div class="legend-ramp">${colors.map((color) => `<span style="background:${color}"></span>`).join("")}</div>
    <div class="legend-row"><span>${metric.format(min)}</span><span>${metric.format(max)}</span></div>
    <p class="muted">${metric.legendNote}</p>
  `;
}

function computeNationalAverages(keys) {
  const results = {};
  keys.forEach((key) => {
    const values = state.joinedRows
      .map((row) => Number(row[key]))
      .filter((value) => Number.isFinite(value));
    results[key] = values.length ? (values.reduce((sum, value) => sum + value, 0) / values.length) : null;
  });
  return results;
}

function computeNationalMetric(metricKey) {
  const metric = metricCatalog[metricKey];
  if (!metric) return null;
  const sampleJoined = state.joinedRows[0] || {};
  const sampleDhs = state.dhsRows[0] || {};
  let values = [];
  if (metricKey in sampleJoined) {
    values = state.joinedRows.map((row) => Number(row[metricKey]));
  } else if (metricKey in sampleDhs) {
    values = state.dhsRows.map((row) => Number(row[metricKey]));
  } else {
    values = state.features.map((feature) => metric.value(dataContext(feature.canonical)));
  }
  values = values.filter((value) => Number.isFinite(Number(value))).map((value) => Number(value));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function summarizeNationalBudgets() {
  let total = 0;
  let potentialWash = 0;
  state.budgetByDistrict.forEach((row) => {
    total += Number(row.total || 0);
    potentialWash += Number(row.total || 0) * 0.1;
  });
  return { total, potentialWash };
}

function renderDetailCard() {
  const card = document.getElementById("districtDetail");
  if (!card) return;
  if (!state.selectedCanonical) {
    const totals = summarizeNationalBudgets();
    const avg = computeNationalAverages(["need_index", "nutrition_risk_index", "budget_per_need_unit"]);
    card.innerHTML = `
      <h3>National summary</h3>
      <p class="muted">Totals and averages across all districts.</p>
      <div class="detail-grid">
        <div class="detail-item"><span class="muted">CDF total allocation</span><b>${formatMoney(totals.total)}</b></div>
        <div class="detail-item"><span class="muted">Potential WASH (10%)</span><b>${formatMoney(totals.potentialWash)}</b></div>
        <div class="detail-item"><span class="muted">Average WASH Risk Index</span><b>${formatNum(avg.need_index)}</b></div>
        <div class="detail-item"><span class="muted">Average Nutrition Risk Index</span><b>${formatNum(avg.nutrition_risk_index)}</b></div>
        <div class="detail-item"><span class="muted">Average budget/WASH risk ratio</span><b>${formatMoney(avg.budget_per_need_unit)}</b></div>
      </div>
    `;
    return;
  }

  const feature = state.features.find((item) => item.canonical === state.selectedCanonical);
  const ctx = dataContext(state.selectedCanonical);
  const rankGap = ctx.joinedRow ? Number(ctx.joinedRow.rank_gap_budget_minus_need) : null;
  const rankGapNutrition = ctx.joinedRow ? Number(ctx.joinedRow.rank_gap_budget_minus_need_nutrition) : null;

  let rankTag = "";
  if (rankGap !== null) {
    rankTag = rankGap > 0
      ? `<span class="tag bad">Underfunding signal ${formatSigned(rankGap)}</span>`
      : `<span class="tag good">Overfunding signal ${formatSigned(rankGap)}</span>`;
  }

  const rankTagNutrition = rankGapNutrition === null
    ? ""
    : rankGapNutrition > 0
      ? `<span class="tag bad">Underfunding (WASH+nutrition) ${formatSigned(rankGapNutrition)}</span>`
      : `<span class="tag good">Overfunding (WASH+nutrition) ${formatSigned(rankGapNutrition)}</span>`;

  const washWeightSummary = summarizeWeights(state.washWeights, WASH_WEIGHT_CONFIG);
  const nutritionWeightSummary = summarizeWeights(state.nutritionWeights, NUTRITION_WEIGHT_CONFIG);

  card.innerHTML = `
    <h3>${escapeHtml(feature ? feature.name : state.selectedCanonical)}</h3>
    <p class="muted">District-level canonical join: <b>${escapeHtml(ctx.districtCanonical)}</b></p>
    <p>${rankTag}</p>
    <p>${rankTagNutrition}</p>
    <p class="muted small-note">Active WASH weights: ${escapeHtml(washWeightSummary)}</p>
    <p class="muted small-note">Active nutrition weights: ${escapeHtml(nutritionWeightSummary)}</p>
    <div class="detail-grid">
      <div class="detail-item"><span class="muted">CDF total allocation</span><b>${formatMoney(metricValueFor("total_budget_mwk", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Potential WASH (10%)</span><b>${formatMoney(metricValueFor("cdf_potential_10pct", ctx))}</b></div>
      <div class="detail-item"><span class="muted">WASH Risk Index</span><b>${formatNum(metricValueFor("need_index", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Nutrition Risk Index</span><b>${formatNum(metricValueFor("nutrition_risk_index", ctx))}</b></div>
      <div class="detail-item"><span class="muted">WASH + nutrition blend</span><b>${formatNum(metricValueFor("need_nutrition_blend_index", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Budget/WASH risk ratio</span><b>${formatMoney(metricValueFor("budget_per_need_unit", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Basic water service</span><b>${formatPct(metricValueFor("basic_water_service_pct", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Basic sanitation service</span><b>${formatPct(metricValueFor("basic_sanitation_service_pct", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Basic handwashing facility</span><b>${formatPct(metricValueFor("basic_handwashing_facility_pct", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Open defecation</span><b>${formatPct(metricValueFor("open_defecation_pct", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Stunting</span><b>${formatPct(metricValueFor("stunting_pct", ctx))}</b></div>
      <div class="detail-item"><span class="muted">Underweight</span><b>${formatPct(metricValueFor("underweight_pct", ctx))}</b></div>
    </div>
    <p class="muted">Budget source row(s): ${ctx.budgetRow && ctx.budgetRow.source_rows ? escapeHtml(ctx.budgetRow.source_rows.join(", ")) : "n/a"}</p>
  `;
}

function renderWashDetailCard() {
  const card = document.getElementById("washDetail");
  if (!card) return;
  const selected = state.selectedCanonical;
  const feature = selected ? state.features.find((item) => item.canonical === selected) : null;
  const ctx = selected ? dataContext(selected) : null;
  const title = selected ? (feature ? feature.name : selected) : "National overview";
  const subtitle = selected
    ? "District indicators across all map layers."
    : "National averages across all indicators.";

  const items = indicatorMetricOptions
    .map((key) => {
      const metric = metricCatalog[key];
      if (!metric) return null;
      const value = selected ? metric.value(ctx) : computeNationalMetric(key);
      const display = metric.format ? metric.format(value) : formatNum(value);
      return {
        key,
        label: metric.label,
        display,
        active: key === state.indicatorMetric
      };
    })
    .filter(Boolean);

  card.innerHTML = `
    <h3 class="detail-title">${escapeHtml(title)}</h3>
    <p class="muted small-note">${subtitle}</p>
    <div class="indicator-list">
      ${items.map((item) => `
        <div class="indicator-item${item.active ? " active" : ""}">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.display)}</strong>
        </div>
      `).join("")}
    </div>
  `;
}
function renderScatter() {
  const svg = document.getElementById("scatterPlot");
  if (!svg) return;
  const tooltip = document.getElementById("scatterTooltip");
  const usdRate = getUsdRate();
  if (state.currency === "USD" && !usdRate) {
    if (tooltip) tooltip.style.opacity = "0";
    svg.innerHTML = `
      <rect x="0" y="0" width="700" height="420" fill="#fff"></rect>
      <text x="350" y="210" text-anchor="middle" font-size="13" fill="#526372">Enter an FX rate to view USD budget scatter.</text>
    `;
    return;
  }
  const rows = state.joinedRows.filter((row) => Number.isFinite(Number(row.need_index)) && Number.isFinite(Number(row.total_budget_mwk)));
  const width = 700;
  const height = 420;
  const margin = { top: 24, right: 24, bottom: 54, left: 68 };
  const useUsd = state.currency === "USD" && usdRate;
  const currencyLabel = useUsd ? "USD" : "MWK";

  const xVals = rows.map((row) => Number(row.need_index));
  const yVals = rows.map((row) => {
    const base = Number(row.total_budget_mwk);
    const converted = useUsd ? base / usdRate : base;
    return converted / 1e9;
  });
  const xMin = Math.min(...xVals);
  const xMax = Math.max(...xVals);
  const yMin = 0;
  const yMax = Math.max(...yVals) * 1.05;

  const xAt = (x) => margin.left + ((x - xMin) / (xMax - xMin || 1)) * (width - margin.left - margin.right);
  const yAt = (y) => height - margin.bottom - ((y - yMin) / (yMax - yMin || 1)) * (height - margin.top - margin.bottom);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + ((yMax - yMin) * t));

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="#fff"></rect>
    ${yTicks.map((tick) => `<line x1="${margin.left}" y1="${yAt(tick).toFixed(2)}" x2="${width - margin.right}" y2="${yAt(tick).toFixed(2)}" stroke="#e5ebf1"></line><text x="${margin.left - 10}" y="${(yAt(tick) + 4).toFixed(2)}" text-anchor="end" font-size="11" fill="#607486">${tick.toFixed(1)}bn</text>`).join("")}
    <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#9bb0c3"></line>
    <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#9bb0c3"></line>
    <text x="${(width / 2).toFixed(2)}" y="${(height - 14).toFixed(2)}" text-anchor="middle" font-size="12" fill="#526372">WASH Risk Index</text>
    <text x="18" y="${(height / 2).toFixed(2)}" transform="rotate(-90 18 ${height / 2})" text-anchor="middle" font-size="12" fill="#526372">CDF budget (${currencyLabel} bn)</text>
    ${rows.map((row) => {
      const canonical = row.canonical_name || normalizeName(row.district);
      const active = state.selectedCanonical === canonical;
      const gap = Number(row.rank_gap_budget_minus_need || 0);
      const color = gap > 0 ? "#cc5039" : "#2f7ab7";
      const yValue = useUsd ? Number(row.total_budget_mwk) / usdRate : Number(row.total_budget_mwk);
      const districtLabel = escapeHtml(row.district || canonical);
      const needLabel = escapeHtml(formatNum(row.need_index));
      const budgetLabel = escapeHtml(formatMoney(row.total_budget_mwk));
      return `<circle class="scatter-dot${active ? " active" : ""}" data-canonical="${canonical}" data-district="${districtLabel}" data-need="${needLabel}" data-budget="${budgetLabel}" cx="${xAt(Number(row.need_index)).toFixed(2)}" cy="${yAt(yValue / 1e9).toFixed(2)}" r="${active ? 6 : 4.5}" fill="${color}" opacity="0.85"></circle>`;
    }).join("")}
  `;

  svg.querySelectorAll(".scatter-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      state.selectedCanonical = dot.dataset.canonical;
      renderAll();
    });
    dot.addEventListener("mousemove", (event) => {
      if (!tooltip) return;
      tooltip.innerHTML = `<strong>${dot.dataset.district}</strong><br>WASH Risk Index: ${dot.dataset.need}<br>CDF budget: ${dot.dataset.budget}`;
      tooltip.style.opacity = "1";
      positionTooltip(tooltip, event);
    });
    dot.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.style.opacity = "0";
    });
  });
}

function renderCorrelationBars() {
  const container = document.getElementById("correlationBars");
  if (!container) return;
  const rows = (state.patterns && state.patterns.correlations) || [];
  const filtered = rows.filter((row) => typeof row.pearson_with_budget === "number");
  const maxAbs = filtered.length ? Math.max(...filtered.map((row) => Math.abs(row.pearson_with_budget))) : 1;

  container.innerHTML = filtered
    .sort((a, b) => Math.abs(b.pearson_with_budget) - Math.abs(a.pearson_with_budget))
    .map((row) => {
      const corr = row.pearson_with_budget;
      const width = (Math.abs(corr) / maxAbs) * 100;
      const color = corr >= 0 ? "#2f7ab7" : "#cc5039";
      return `
        <div class="bar-row">
          <div class="bar-head"><strong>${friendlyIndicator(row.indicator)}</strong><span>${formatSigned(corr)}</span></div>
          <div class="track"><div class="fill" style="width:${width.toFixed(1)}%; background:${color};"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderPatternLists() {
  const rows = state.joinedRows
    .filter((row) => Number.isFinite(Number(row.rank_gap_budget_minus_need)))
    .map((row) => ({ district: row.district || row.canonical_name, rank_gap: Number(row.rank_gap_budget_minus_need) }));
  const under = rows.slice().sort((a, b) => b.rank_gap - a.rank_gap).slice(0, 10);
  const over = rows.slice().sort((a, b) => a.rank_gap - b.rank_gap).slice(0, 10);

  const underNode = document.getElementById("underfundedList");
  const overNode = document.getElementById("overfundedList");
  if (!underNode || !overNode) return;

  underNode.innerHTML = under
    .map((row) => `<div class="mini-row"><span>${escapeHtml(row.district)}</span><strong>${formatSigned(row.rank_gap)}</strong></div>`)
    .join("");

  overNode.innerHTML = over
    .map((row) => `<div class="mini-row"><span>${escapeHtml(row.district)}</span><strong>${formatSigned(row.rank_gap)}</strong></div>`)
    .join("");
}

function renderNutritionLists() {
  const nutritionListNode = document.getElementById("nutritionRiskList");
  const combinedListNode = document.getElementById("combinedNeedNutritionList");
  if (!nutritionListNode || !combinedListNode) return;

  const nutritionTop = state.joinedRows
    .filter((row) => Number.isFinite(Number(row.nutrition_risk_index)))
    .slice()
    .sort((a, b) => Number(b.nutrition_risk_index) - Number(a.nutrition_risk_index))
    .slice(0, 10);
  const combinedTop = state.joinedRows
    .filter((row) => Number.isFinite(Number(row.need_nutrition_blend_index)))
    .slice()
    .sort((a, b) => Number(b.need_nutrition_blend_index) - Number(a.need_nutrition_blend_index))
    .slice(0, 10);

  nutritionListNode.innerHTML = nutritionTop
    .map((row) => `<div class="mini-row"><span>${escapeHtml(row.district)}</span><strong>${formatNum(row.nutrition_risk_index)}</strong></div>`)
    .join("");

  combinedListNode.innerHTML = combinedTop
    .map((row) => `<div class="mini-row"><span>${escapeHtml(row.district)}</span><strong>${formatNum(row.need_nutrition_blend_index)}</strong></div>`)
    .join("");
}

function renderMethodExample() {
  const node = document.getElementById("methodExample");
  if (!node) return;
  const row = state.selectedCanonical
    ? (state.joinedByCanonical.get(state.selectedCanonical) || state.joinedByCanonical.get(toDistrictLevel(state.selectedCanonical)))
    : null;

  if (!row) {
    node.innerHTML = "<p class='muted'>Select a district to see a worked formula breakdown.</p>";
    return;
  }

  const waterGap = 100 - Number(row.basic_water_service_pct || 0);
  const sanitationGap = 100 - Number(row.basic_sanitation_service_pct || 0);
  const handGap = 100 - Number(row.basic_handwashing_facility_pct || 0);
  const safeWaterGap = 100 - Number(row.safely_managed_drinking_water_pct || 0);
  const odRisk = Number(row.open_defecation_pct || 0);
  const ecoliRisk = Number(row.e_coli_in_household_water_pct || 0);
  const needIndex = Number(row.need_index || 0);
  const stunting = Number(row.stunting_pct || 0);
  const wasting = Number(row.wasting_pct || 0);
  const underweight = Number(row.underweight_pct || 0);
  const nutritionIndex = Number(row.nutrition_risk_index || 0);
  const blendIndex = Number(row.need_nutrition_blend_index || 0);
  const budgetRank = Number(row.budget_rank || 0);
  const riskRank = Number(row.need_rank || 0);
  const underfundSignal = Number(row.rank_gap_budget_minus_need || 0);
  node.innerHTML = `
    <h3>${escapeHtml(row.district)} Worked Example</h3>
    <pre class="formula">water_gap = 100 - ${formatNum(row.basic_water_service_pct)} = ${formatNum(waterGap)}
sanitation_gap = 100 - ${formatNum(row.basic_sanitation_service_pct)} = ${formatNum(sanitationGap)}
handwashing_gap = 100 - ${formatNum(row.basic_handwashing_facility_pct)} = ${formatNum(handGap)}
safe_water_gap = 100 - ${formatNum(row.safely_managed_drinking_water_pct)} = ${formatNum(safeWaterGap)}
open_defecation_risk = ${formatNum(odRisk)}
e_coli_risk = ${formatNum(ecoliRisk)}

wash_risk_index = mean(all six components) = ${formatNum(needIndex)}

nutrition_risk_index = mean(${formatNum(stunting)}, ${formatNum(wasting)}, ${formatNum(underweight)}) = ${formatNum(nutritionIndex)}
wash_nutrition_blend_index = (0.7 * ${formatNum(needIndex)}) + (0.3 * ${formatNum(nutritionIndex)}) = ${formatNum(blendIndex)}

  underfunding_signal = budget_rank - wash_risk_rank = ${budgetRank} - ${riskRank} = ${formatSigned(underfundSignal)}</pre>
  `;
}

function renderTable() {
  const body = document.getElementById("districtTableBody");
  if (!body) return;
  let rows = state.joinedRows.slice();

  if (state.search) {
    rows = rows.filter((row) => String(row.district || "").toLowerCase().includes(state.search));
  }

  rows.sort((left, right) => {
    switch (state.tableSort) {
      case "budget_desc":
        return Number(right.total_budget_mwk || 0) - Number(left.total_budget_mwk || 0);
      case "budget_need_desc":
        return Number(right.budget_per_need_unit || 0) - Number(left.budget_per_need_unit || 0);
      case "rank_gap_desc":
        return Number(right.rank_gap_budget_minus_need || 0) - Number(left.rank_gap_budget_minus_need || 0);
      case "district_asc":
        return String(left.district || "").localeCompare(String(right.district || ""));
      case "need_index_desc":
      default:
        return Number(right.need_index || 0) - Number(left.need_index || 0);
    }
  });

  body.innerHTML = rows.map((row) => {
    const canonical = row.canonical_name || normalizeName(row.district);
    const active = state.selectedCanonical === canonical;
    const rankGap = Number(row.rank_gap_budget_minus_need || 0);
    const tagClass = rankGap > 0 ? "bad" : "good";
    const tagLabel = rankGap > 0 ? "Under" : "Over";
    return `
      <tr data-canonical="${canonical}" style="${active ? "background:#e9f3fb;" : ""}">
        <td>${escapeHtml(row.district)}</td>
        <td>${formatMoneyBn(row.total_budget_mwk)}</td>
        <td>${formatNum(row.need_index)}</td>
        <td>${formatPct(row.basic_water_service_pct)}</td>
        <td>${formatPct(row.basic_sanitation_service_pct)}</td>
        <td>${formatPct(row.basic_handwashing_facility_pct)}</td>
        <td>${formatPct(row.safely_managed_drinking_water_pct)}</td>
        <td>${formatMoney(row.budget_per_need_unit)}</td>
        <td><span class="tag ${tagClass}">${tagLabel} ${formatSigned(rankGap)}</span></td>
      </tr>
    `;
  }).join("");

  body.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedCanonical = row.dataset.canonical;
      renderAll();
    });
  });
}

function dataContext(canonicalName) {
  const districtCanonical = toDistrictLevel(canonicalName);
  const budgetRow = state.budgetByCanonical.get(canonicalName) || state.budgetByDistrict.get(districtCanonical) || null;
  const dhsRow = state.dhsByCanonical.get(canonicalName) || state.dhsByCanonical.get(districtCanonical) || null;
  const joinedRow = state.joinedByCanonical.get(canonicalName) || state.joinedByCanonical.get(districtCanonical) || null;
  return { canonical: canonicalName, districtCanonical, budgetRow, dhsRow, joinedRow };
}

function metricValueFor(metricKey, ctx) {
  const metric = metricCatalog[metricKey];
  return metric ? metric.value(ctx) : null;
}
function normalizeName(value) {
  const raw = String(value || "")
    .toLowerCase()
    .replace(/[']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = {
    "blantyre city council": "blantyre city",
    "blantyre district council": "blantyre",
    "lilongwe city council": "lilongwe city",
    "lilongwe district council": "lilongwe",
    "mzuzu city council": "mzuzu city",
    "zomba city council": "zomba city",
    "zomba district council": "zomba",
    "kasungu district council": "kasungu",
    "kasungu municipality": "kasungu municipal",
    "luchenza municipal": "luchenza municipal",
    "luchenza minicipal": "luchenza municipal",
    "mangochi municipal": "mangochi municipal",
    "mangochi town": "mangochi municipal",
    "karonga town": "karonga town",
    "karonga district council": "karonga",
    "likoma islands": "likoma",
    "likoma district council": "likoma",
    "nkhata bay district council": "nkhata bay",
    nkhatabay: "nkhata bay",
    nkhotahota: "nkhotakota",
    "nkhotakota district council": "nkhotakota",
    "mmbelwa district council": "mzimba",
    "m belwa district council": "mzimba",
    mmbelwa: "mzimba"
  };

  if (aliases[raw]) return aliases[raw];
  if (raw.endsWith(" district council")) return raw.replace(/ district council$/, "").trim();
  if (raw.endsWith(" city council")) return raw.replace(/ city council$/, " city").trim();
  if (raw.endsWith(" municipality")) return raw.replace(/ municipality$/, " municipal").trim();
  if (raw.endsWith(" district")) return raw.replace(/ district$/, "").trim();
  return raw;
}

function toDistrictLevel(canonical) {
  const map = {
    "blantyre city": "blantyre",
    "lilongwe city": "lilongwe",
    "zomba city": "zomba",
    "mzuzu city": "mzimba",
    "kasungu municipal": "kasungu",
    "luchenza municipal": "thyolo",
    "mangochi municipal": "mangochi",
    "karonga town": "karonga"
  };
  return map[canonical] || canonical;
}

function projectFactory(features, width, height, padding) {
  const points = [];
  features.forEach((feature) => collectCoords(feature.geometry, points));
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
  const xOffset = (width - (maxX - minX) * scale) / 2;
  const yOffset = (height - (maxY - minY) * scale) / 2;
  return (point) => [xOffset + ((point[0] - minX) * scale), yOffset + ((maxY - point[1]) * scale)];
}

function collectCoords(geometry, output) {
  if (!geometry) return;
  if (geometry.type === "Polygon") {
    geometry.coordinates.forEach((ring) => ring.forEach((point) => output.push(point)));
  } else if (geometry.type === "MultiPolygon") {
    geometry.coordinates.forEach((polygon) => polygon.forEach((ring) => ring.forEach((point) => output.push(point))));
  }
}

function pathFromGeometry(geometry, project) {
  const ringPath = (rings) => rings.map((ring) => `${ring.map((point, index) => {
    const xy = project(point);
    return `${index === 0 ? "M" : "L"}${xy[0].toFixed(2)} ${xy[1].toFixed(2)}`;
  }).join(" ")} Z`).join(" ");

  if (!geometry) return "";
  if (geometry.type === "Polygon") return ringPath(geometry.coordinates);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => ringPath(polygon)).join(" ");
  return "";
}

function colorSequential(value, min, max, palette) {
  if (!Number.isFinite(value)) return "#e7edf2";
  if (max === min) return palette[palette.length - 1];
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const scaled = ratio * (palette.length - 1);
  const idx = Math.floor(scaled);
  const t = scaled - idx;
  return interpolateHex(palette[idx], palette[Math.min(idx + 1, palette.length - 1)], t);
}

function colorDiverging(value, maxAbs) {
  if (!Number.isFinite(value)) return "#e7edf2";
  const cap = maxAbs || 1;
  const ratio = Math.max(-1, Math.min(1, value / cap));
  if (ratio < 0) return interpolateHex("#1f6eb2", "#dbe9f6", Math.abs(ratio));
  return interpolateHex("#f8dfda", "#b23a2a", ratio);
}

function interpolateHex(startHex, endHex, t) {
  const start = hexToRgb(startHex);
  const end = hexToRgb(endHex);
  const rgb = [0, 1, 2].map((i) => Math.round(start[i] + ((end[i] - start[i]) * t)));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  return [parseInt(normalized.slice(0, 2), 16), parseInt(normalized.slice(2, 4), 16), parseInt(normalized.slice(4, 6), 16)];
}

function getUsdRate() {
  const rate = Number(state.usdRate);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

function convertCurrencyValue(valueMwk) {
  if (state.currency !== "USD") return valueMwk;
  const rate = getUsdRate();
  if (!rate) return null;
  return valueMwk / rate;
}

function formatLargeCurrency(value, currencyLabel) {
  if (!Number.isFinite(Number(value))) return `${currencyLabel} n/a`;
  const v = Number(value);
  if (Math.abs(v) >= 1e12) return `${currencyLabel} ${(v / 1e12).toFixed(2)}tn`;
  if (Math.abs(v) >= 1e9) return `${currencyLabel} ${(v / 1e9).toFixed(2)}bn`;
  if (Math.abs(v) >= 1e6) return `${currencyLabel} ${(v / 1e6).toFixed(2)}m`;
  return `${currencyLabel} ${v.toLocaleString()}`;
}

function formatBudgetMillions(valueMkm) {
  if (!Number.isFinite(Number(valueMkm))) return "n/a";
  const val = Number(valueMkm);
  if (state.currency === "USD") {
    const rate = getUsdRate();
    if (!rate) return "USD n/a";
    const usd = val / rate;
    return `USD ${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}m`;
  }
  return `MWK ${val.toLocaleString(undefined, { maximumFractionDigits: 2 })}m`;
}

function formatMoney(value) {
  if (!Number.isFinite(Number(value))) return "n/a";
  const converted = convertCurrencyValue(Number(value));
  if (converted === null) return "USD n/a";
  const label = state.currency === "USD" ? "USD" : "MWK";
  return formatLargeCurrency(converted, label);
}

function formatMoneyBn(value) {
  if (!Number.isFinite(Number(value))) return "n/a";
  const converted = convertCurrencyValue(Number(value));
  if (converted === null) return "n/a";
  return (converted / 1e9).toFixed(2);
}

function formatInt(value) {
  if (!Number.isFinite(Number(value))) return "n/a";
  return Math.round(Number(value)).toLocaleString();
}

function formatPct(value) {
  if (!Number.isFinite(Number(value))) return "n/a";
  return `${Number(value).toFixed(1)}%`;
}

function formatNum(value) {
  if (!Number.isFinite(Number(value))) return "n/a";
  return Number(value).toFixed(2);
}

function formatNumLocale(value) {
  if (!Number.isFinite(Number(value))) return "n/a";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatSigned(value) {
  if (!Number.isFinite(Number(value))) return "n/a";
  const v = Number(value);
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}`;
}

function friendlyIndicator(key) {
  const labels = {
    need_index: "WASH Risk Index",
    need_nutrition_blend_index: "WASH + Nutrition Blend",
    nutrition_risk_index: "Nutrition Risk Index",
    basic_water_service_pct: "Basic Water Service",
    basic_sanitation_service_pct: "Basic Sanitation",
    basic_handwashing_facility_pct: "Basic Handwashing",
    safely_managed_drinking_water_pct: "Safely Managed Drinking Water",
    open_defecation_pct: "Open Defecation",
    e_coli_in_household_water_pct: "E. coli In Household Water",
    without_water_on_premises_pct: "Without Water On Premises",
    stunting_pct: "Stunting",
    wasting_pct: "Wasting",
    underweight_pct: "Underweight",
    clean_cooking_pct: "Clean Cooking",
    clean_lighting_pct: "Clean Lighting",
    clean_cooking_heating_lighting_pct: "Clean Cooking & Lighting (%)"
  };
  return labels[key] || labelFromKey(key);
}

function positionTooltip(node, event) {
  const bounds = node.parentElement.getBoundingClientRect();
  node.style.left = `${event.clientX - bounds.left + 12}px`;
  node.style.top = `${event.clientY - bounds.top + 12}px`;
}

function triggerPrint(scope) {
  if (!document.body) return;
  document.body.dataset.printScope = scope;
  window.print();
}

window.addEventListener("afterprint", () => {
  if (document.body) {
    delete document.body.dataset.printScope;
  }
});

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
