// js/load-data-page3.js
// Load CSV, keep only years 2023 & 2024, aggregate mobile_phone_use fines by YEAR and location categories,
// draw grouped bar chart (per year, grouped by location categories) and run chi-square comparing Major vs Regional.

// Row conversion and load
d3.csv("dataset/police_enforcement_2024_fines.csv", d => ({
  year: +d.YEAR,
  start: d.START_DATE,
  end: d.END_DATE,
  jurisdiction: d.JURISDICTION,
  location: d.LOCATION,
  metric: d.METRIC,
  detection: d.DETECTION_METHOD,
  fines: +d.FINES,
  arrests: +d.ARRESTS,
  charges: +d.CHARGES,
  age_group: d.AGE_GROUP // include AGE_GROUP if present
})).then(rows => {
  console.log("rows loaded:", rows.length);

  // Only keep 2023 and 2024
  const filtered = rows.filter(r => r.year === 2023 || r.year === 2024);

  // Normalize location string to one of the five categories
  function locationCategory(loc) {
    if (!loc) return "Other";
    if (loc.includes("Major Cities")) return "Major Cities";
    if (loc.includes("Inner Regional")) return "Inner Regional";
    if (loc.includes("Outer Regional")) return "Outer Regional";
    if (loc.includes("Remote Australia") && loc.includes("Very")) return "Very Remote";
    if (loc.includes("Very Remote")) return "Very Remote";
    if (loc.includes("Remote Australia") || loc.includes("Remote")) return "Remote";
    // fallback: try exact matches
    if (loc === "Very Remote Australia") return "Very Remote";
    if (loc === "Remote Australia") return "Remote";
    return "Other";
  }

  // Prepare map: year -> category sums (mobile only)
  const categories = (window.SHARED_CONSTS && window.SHARED_CONSTS.CATEGORIES) || ["Major Cities", "Inner Regional", "Outer Regional", "Remote", "Very Remote"];
  const colors = (window.SHARED_CONSTS && window.SHARED_CONSTS.COLORS) || {
    "Major Cities": "#4E3AA2",
    "Inner Regional": "#6b8bd6",
    "Outer Regional": "#7fb3ff",
    "Remote": "#a08be6",
    "Very Remote": "#c6a7ff"
  };
  const byYear = new Map();

  // Totals for chi-square: Major vs Regional (Regional=Inner+Outer+Remote+VeryRemote)
  const totals = { major_mobile:0, major_other:0, regional_mobile:0, regional_other:0 };

  filtered.forEach(r => {
    const y = r.year;
    if (!byYear.has(y)) {
      const base = { year: y };
      categories.forEach(c => {
        base[c] = 0;
        base[`${c}_count`] = 0;
      });
      base["Other"] = 0;
      base["Other_count"] = 0;
      byYear.set(y, base);
    }
    const cat = locationCategory(r.location);

    if (r.metric === "mobile_phone_use") {
      if (categories.includes(cat)) {
        byYear.get(y)[cat] += (r.fines || 0);
        byYear.get(y)[`${cat}_count`] += 1;
      } else {
        byYear.get(y)["Other"] += (r.fines || 0);
        byYear.get(y)["Other_count"] += 1;
      }

      // add to Major vs Regional totals for chi-square
      if (cat === "Major Cities") totals.major_mobile += (r.fines || 0);
      else if (["Inner Regional","Outer Regional","Remote","Very Remote"].includes(cat))
        totals.regional_mobile += (r.fines || 0);
      else {
        // treat Other as neither major nor regional (ignored for chi-square)
      }
    } else {
      // other metrics -> add to "other" totals for chi-square
      if (cat === "Major Cities") totals.major_other += (r.fines || 0);
      else if (["Inner Regional","Outer Regional","Remote","Very Remote"].includes(cat))
        totals.regional_other += (r.fines || 0);
      else {
        // ignore Other category for chi-square
      }
    }
  });

  // Convert byYear map to sorted array
  const yearData = Array.from(byYear.values()).sort((a,b) => a.year - b.year);

  console.log("Yearly category data:", yearData);
  console.log("Chi-square totals (Major vs Regional):", totals);

  // draw grouped bar (uses drawGroupedBar from js/chart-page3.js)
  drawGroupedBar(yearData, {
    container: "#grouped-bar-chart-page3",
    groups: categories,
    colors: colors,
    title: "Mobile phone use fines by Year and Location Category (mobile_phone_use only)",
    showValues: true
  });

  // Build contingency table 2x2: [ [major_mobile, major_other], [regional_mobile, regional_other] ]
  const obs = [
    [ totals.major_mobile, totals.major_other ],
    [ totals.regional_mobile, totals.regional_other ]
  ];

  const chi = chiSquareTest(obs);
  console.log("Contingency table (rows Major/Regional, cols mobile/other):", obs);
  console.log("Chi-square statistic:", chi.chi2.toFixed(4), "p-value:", chi.p.toFixed(6));

    // --- AGE GROUP BAR CHART ---
  // Aggregate by AGE_GROUP (mobile_phone_use only), across filtered rows (2023 & 2024)
  const ageMap = new Map();
  filtered.forEach(r => {
    // prefer the converted field; fallback to raw AGE_GROUP; if neither, treat as Unknown
    const agRaw = r.age_group || r.AGE_GROUP || "";
    const agTrim = (typeof agRaw === "string") ? agRaw.trim() : String(agRaw);
    const agKey = agTrim || "Unknown";

    // skip Unknown age groups entirely
    if (agKey === "Unknown") return;

    if (!ageMap.has(agKey)) ageMap.set(agKey, { age_group: agKey, fines: 0, count: 0 });
    if (r.metric === "mobile_phone_use") {
      const entry = ageMap.get(agKey);
      entry.fines += (r.fines || 0);
      entry.count += 1;
    }
  });

  // remove Unknown (already skipped) and sort
  const ageData = Array.from(ageMap.values()).sort((a,b) => b.fines - a.fines);

  // draw the age-group bar chart (uses drawBarByAge from js/barchart-page3.js)
  if (typeof drawBarByAge === "function") {
    drawBarByAge(ageData, {
      container: "#age-bar-chart-page3",
      title: "Mobile phone use fines by Age Group (2023–2024)",
      showValues: true,
      forceMean: false,
      sortBy: "value_desc"
    });
  } else {
    console.warn("drawBarByAge function not found. Did you include js/barchart-page3.js?");
  }

  // --- HEATMAP: fines by jurisdiction (rows) x age_group (columns) ---
  // Build aggregation of fines per jurisdiction × age_group
  const heatMapMap = new Map();
  const jSet = new Set();
  const ageSet = new Set();
  filtered.forEach(r => {
    if (r.metric !== 'mobile_phone_use') return;
    const juris = (r.jurisdiction || 'Unknown');
    const agRaw = r.age_group || r.AGE_GROUP || '';
    const ag = (typeof agRaw === 'string' ? agRaw.trim() : String(agRaw)) || 'Unknown';
    if (ag === 'Unknown') return; // skip unknown age groups
    jSet.add(juris);
    ageSet.add(ag);
    const key = juris + '||' + ag;
    heatMapMap.set(key, (heatMapMap.get(key) || 0) + (r.fines || 0));
  });

  const jurisdictions = Array.from(jSet).sort();
  const ageGroups = Array.from(ageSet).sort();
  const heatItems = [];
  jurisdictions.forEach(j => {
    ageGroups.forEach(a => {
      heatItems.push({ jurisdiction: j, age_group: a, fines: heatMapMap.get(j + '||' + a) || 0 });
    });
  });

  if (typeof drawHeatmap === 'function') {
    drawHeatmap(heatItems, {
      container: '#heatmap-page3',
      jurisdictions,
      ageGroups,
      title: 'Mobile-phone-use fines by Jurisdiction and Age Group (2023–2024)'
    });
  } else {
    console.warn('drawHeatmap not found — did you include js/heatmap-page3.js?');
  }

}).catch(err => {
  console.error("CSV load error:", err);
});