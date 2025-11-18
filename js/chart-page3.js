// js/chart-page3.js
// Functions for drawing a grouped bar chart and running a 2x2 chi-square.
// Exposes: drawGroupedBar(data, options), chiSquareTest(obs)

/**
 * Draw grouped bar chart
 * data: [{ year: 2023, "Major Cities": 10, "Inner Regional": 5, ... }, ...]
 * options: { container: "#grouped-bar-chart-page3", width, height, groups, colors, title, showValues }
 */
function drawGroupedBar(data, options = {}) {
  const containerSelector = options.container || "#grouped-bar-chart-page3";
  const container = d3.select(containerSelector);
  if (container.empty()) {
    console.error("Container not found:", containerSelector);
    return;
  }

  // Defaults
  const width = options.width || 900;
  const height = options.height || 420;
  const margin = options.margin || { top: 40, right: 20, bottom: 80, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const groups = options.groups || ["Major Cities", "Inner Regional", "Outer Regional", "Remote", "Very Remote"];
  const defaultColors = {
    "Major Cities": "#4E3AA2",
    "Inner Regional": "#6b8bd6",
    "Outer Regional": "#7fb3ff",
    "Remote": "#a08be6",
    "Very Remote": "#c6a7ff"
  };
  const colors = Object.assign({}, defaultColors, options.colors || {});

  // clear previous chart
  container.selectAll("*").remove();

  // create svg with viewBox for responsiveness
  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto");

  const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // x0 for years, x1 for groups inside each year
  const years = data.map(d => d.year);
  const x0 = d3.scaleBand().domain(years).range([0, innerWidth]).padding(0.2);
  const x1 = d3.scaleBand().domain(groups).range([0, x0.bandwidth()]).padding(0.12);

  // y scale based on max fines across groups
  const yMax = d3.max(data, d => d3.max(groups, g => +d[g] || 0)) || 0;
  const y = d3.scaleLinear().domain([0, yMax * 1.08 || 10]).nice().range([innerHeight, 0]);

  // axes
  const xAxis = d3.axisBottom(x0).tickFormat(d3.format("d")); // integer years
  const yAxis = d3.axisLeft(y).ticks(6).tickFormat(d3.format("~s"));

  // draw group bars
  const yearGroups = chart.selectAll(".year")
    .data(data)
    .join("g")
      .attr("class", "year")
      .attr("transform", d => `translate(${x0(d.year)},0)`);

  yearGroups.selectAll("rect")
    .data(d => groups.map(g => ({ key: g, value: +d[g] || 0, year: d.year })))
    .join("rect")
      .attr("x", d => x1(d.key))
      .attr("y", d => y(d.value))
      .attr("width", x1.bandwidth())
      .attr("height", d => innerHeight - y(d.value))
      .attr("fill", d => colors[d.key] || "#777")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .append("title")
        .text(d => `${d.key} (${d.year}): ${d.value}`);

  // axes render
  chart.append("g")
    .attr("transform", `translate(0, ${innerHeight})`)
    .call(xAxis)
    .selectAll("text")
      .attr("transform", "translate(0,6)");

  chart.append("g").call(yAxis);

  // axis labels
  svg.append("text")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .attr("fill", "#222")
    .text(options.xLabel || "Year");

  svg.append("text")
    .attr("transform", `translate(18, ${margin.top + innerHeight / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .attr("fill", "#222")
    .text(options.yLabel || "Sum of fines");

  // title
  svg.append("text")
    .attr("x", margin.left + 6)
    .attr("y", 18)
    .attr("font-weight", 700)
    .text(options.title || "Grouped bar chart");

  // legend
  const legend = svg.append("g").attr("transform", `translate(${width - margin.right - 220}, ${margin.top - 8})`);
  groups.forEach((g, i) => {
    const gEl = legend.append("g").attr("transform", `translate(0, ${i*18})`);
    gEl.append("rect").attr("width", 12).attr("height", 12).attr("fill", colors[g] || "#888");
    gEl.append("text").attr("x", 18).attr("y", 10).text(g).style("font-size", "12px");
  });

  // optionally, display values above bars
  if (options.showValues) {
    yearGroups.selectAll(".val")
      .data(d => groups.map(g => ({ key: g, value: +d[g] || 0, year: d.year })))
      .join("text")
        .attr("class", "val")
        .attr("x", d => x1(d.key) + x1.bandwidth() / 2)
        .attr("y", d => y(d.value) - 4)
        .attr("text-anchor", "middle")
        .attr("fill", "#222")
        .attr("font-size", "11px")
        .text(d => d.value > 0 ? d.value : "");
  }
}

/* Chi-square test for 2x2 contingency table
   obs: [[a,b],[c,d]] rows = Major/Regional, cols = mobile/other
   returns {chi2, p, expected}
*/
function chiSquareTest(obs) {
  const a = obs[0][0], b = obs[0][1], c = obs[1][0], d = obs[1][1];
  const rowTotals = [a + b, c + d];
  const colTotals = [a + c, b + d];
  const N = a + b + c + d;
  if (N === 0) return { chi2: 0, p: 1, expected: [[0,0],[0,0]] };

  const expected = [
    [ (rowTotals[0] * colTotals[0]) / N, (rowTotals[0] * colTotals[1]) / N ],
    [ (rowTotals[1] * colTotals[0]) / N, (rowTotals[1] * colTotals[1]) / N ]
  ];

  let chi2 = 0;
  const obsFlat = [a,b,c,d];
  const expFlat = [expected[0][0], expected[0][1], expected[1][0], expected[1][1]];
  for (let i=0;i<4;i++){
    if (expFlat[i] > 0) chi2 += Math.pow(obsFlat[i] - expFlat[i], 2) / expFlat[i];
  }

  const p = 1 - erf(Math.sqrt(chi2) / Math.SQRT2);
  return { chi2, p, expected };
}

// erf approximation
function erf(x) {
  const sign = x >= 0 ? 1 : -1;
  x = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}