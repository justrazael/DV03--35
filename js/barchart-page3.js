// js/barchart-page3.js
// Draw a bar chart of fines by age group.
// Exposes: drawBarByAge(data, options)
// data: [{ age_group: "25-34", fines: 123, count: 10 }, ...]
// options: { container, width, height, title, xLabel, yLabel, color, showValues, sortBy }
function drawBarByAge(data, options = {}) {
  const containerSelector = options.container || "#age-bar-chart-page3";
  const container = d3.select(containerSelector);
  if (container.empty()) {
    console.error("Container not found:", containerSelector);
    return;
  }

  const width = options.width || 800;
  const height = options.height || 420;
  const margin = options.margin || { top: 40, right: 20, bottom: 120, left: 80 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // If count present and options.useMean true (or data contains count keys), compute mean per entry
  const hasCount = data.some(d => d.hasOwnProperty("count") && +d.count > 0);
  const useMean = options.forceMean || (options.useMean === true) || hasCount;

  // prepare values: either mean = fines/count or total fines
  const prepared = data.map(d => {
    const fines = +d.fines || 0;
    const count = d.hasOwnProperty("count") ? +d.count : null;
    const value = (useMean && count && count > 0) ? (fines / count) : fines;
    return { age_group: d.age_group || "Unknown", fines, count, value };
  });

  // optional sorting
  const sortBy = options.sortBy || "age"; // "age" | "value_desc" | "value_asc"
  if (sortBy === "value_desc") prepared.sort((a,b) => b.value - a.value);
  else if (sortBy === "value_asc") prepared.sort((a,b) => a.value - b.value);
  // else keep original order (useful if you want age order preserved)

  // x domain: age groups
  const xDomain = prepared.map(d => d.age_group);
  const x = d3.scaleBand().domain(xDomain).range([0, innerWidth]).padding(0.12);

  // y domain
  const yMax = d3.max(prepared, d => d.value) || 0;
  const y = d3.scaleLinear().domain([0, yMax * 1.08 || 10]).nice().range([innerHeight, 0]);

  // color
  const barColor = options.color || (options.colorMap && options.colorMap.bar) || "#4E3AA2";
  const valueFormat = options.valueFormat || (useMean ? d3.format(".1f") : d3.format("~s"));

  // clear
  container.selectAll("*").remove();

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("height", "auto");

  const chart = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  // bars
  chart.selectAll(".bar")
    .data(prepared)
    .join("rect")
      .attr("class", "bar")
      .attr("x", d => x(d.age_group))
      .attr("y", d => y(d.value))
      .attr("width", x.bandwidth())
      .attr("height", d => innerHeight - y(d.value))
      .attr("fill", barColor)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .append("title")
        .text(d => {
          if (d.count != null) {
            return `${d.age_group}: ${valueFormat(d.value)} (sum=${d.fines}, n=${d.count})`;
          }
          return `${d.age_group}: ${valueFormat(d.value)}`;
        });

  // axes
  const xAxis = d3.axisBottom(x);
  const yAxis = d3.axisLeft(y).ticks(6).tickFormat(valueFormat);

  chart.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(xAxis)
    .selectAll("text")
      .attr("transform", "rotate(-40)")
      .attr("text-anchor", "end")
      .attr("dx", "-0.4em")
      .attr("dy", "0.6em");

  chart.append("g").call(yAxis);

  // labels
  svg.append("text")
    .attr("x", margin.left + innerWidth / 2)
    .attr("y", height - 12)
    .attr("text-anchor", "middle")
    .attr("fill", "#222")
    .text(options.xLabel || "Age group");

  svg.append("text")
    .attr("transform", `translate(18, ${margin.top + innerHeight / 2}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .attr("fill", "#222")
    .text(options.yLabel || (useMean ? "Mean fines" : "Sum of fines"));

  // title
  svg.append("text")
    .attr("x", margin.left + 6)
    .attr("y", 18)
    .attr("font-weight", 700)
    .text(options.title || (useMean ? "Mean fines by Age Group" : "Fines by Age Group"));

  // show values above bars
  if (options.showValues) {
    chart.selectAll(".val")
      .data(prepared)
      .join("text")
        .attr("class", "val")
        .attr("x", d => x(d.age_group) + x.bandwidth() / 2)
        .attr("y", d => y(d.value) - 6)
        .attr("text-anchor", "middle")
        .attr("fill", "#222")
        .attr("font-size", "11px")
        .text(d => (d.value > 0 ? valueFormat(d.value) : ""));
  }
}