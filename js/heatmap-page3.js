// js/heatmap-page3.js
// Draw a heatmap matrix of fines by jurisdiction (rows) and age_group (columns).
// Exposes: drawHeatmap(items, options)
// items: [{ jurisdiction, age_group, fines }, ...]
function drawHeatmap(items, options = {}) {
  const container = d3.select(options.container || "#heatmap-page3");
  if (container.empty()) { console.error('Container not found for heatmap'); return; }

  const width = options.width || 900;
  const height = options.height || 500;
  const margin = options.margin || { top: 80, right: 20, bottom: 120, left: 160 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // derive unique ordered lists if not provided
  const jurisdictions = options.jurisdictions || Array.from(new Set(items.map(d => d.jurisdiction))).sort();
  const ageGroups = options.ageGroups || Array.from(new Set(items.map(d => d.age_group))).sort();

  // build lookup for fines
  const lookup = new Map();
  items.forEach(d => lookup.set(d.jurisdiction + '||' + d.age_group, +d.fines || 0));

  // prepare matrix array (rows = jurisdictions)
  const matrix = [];
  jurisdictions.forEach(j => {
    ageGroups.forEach(a => {
      matrix.push({ jurisdiction: j, age_group: a, fines: lookup.get(j + '||' + a) || 0 });
    });
  });

  const maxVal = d3.max(matrix, d => d.fines) || 0;

  container.selectAll('*').remove();
  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%')
    .style('height', 'auto');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleBand().domain(ageGroups).range([0, innerWidth]).padding(0.05);
  const y = d3.scaleBand().domain(jurisdictions).range([0, innerHeight]).padding(0.05);

  // continuous color scale by fines (rectangular heatmap cells)
  const color = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, maxVal || 1]);
  const fmt = d3.format(",");

  // draw rect cells
  g.selectAll('rect.cell')
    .data(matrix)
    .join('rect')
      .attr('class', 'cell')
      .attr('x', d => x(d.age_group))
      .attr('y', d => y(d.jurisdiction))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => color(d.fines))
      .attr('stroke', '#fff')
      .append('title')
        .text(d => `${d.jurisdiction} — ${d.age_group}: ${fmt(d.fines)}`);

  // x axis (age groups)
  g.append('g')
    .attr('transform', `translate(0, ${innerHeight})`)
    .call(d3.axisBottom(x))
    .selectAll('text')
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end');

  // y axis (jurisdictions)
  g.append('g').call(d3.axisLeft(y));

  // title
  svg.append('text')
    .attr('x', margin.left)
    .attr('y', margin.top / 3)
    .attr('font-weight', 700)
    .text(options.title || 'Fines by Jurisdiction and Age Group');

  // gradient legend for continuous scale
  const legendW = 220, legendH = 10;
  const legendX = width - margin.right - legendW - 10;
  const legendY = margin.top - 28;

  const defs = svg.append('defs');
  const gradId = 'heatmap-legend-gradient';
  const grad = defs.append('linearGradient').attr('id', gradId).attr('x1', '0%').attr('x2', '100%');
  grad.append('stop').attr('offset', '0%').attr('stop-color', color(0));
  grad.append('stop').attr('offset', '100%').attr('stop-color', color(maxVal || 1));

  const legend = svg.append('g').attr('transform', `translate(${legendX}, ${legendY})`);
  legend.append('rect').attr('width', legendW).attr('height', legendH).attr('fill', `url(#${gradId})`).attr('stroke', '#ccc');
  legend.append('text').attr('x', 0).attr('y', -6).attr('font-size', '12px').text('Fines');
  legend.append('text').attr('x', 0).attr('y', legendH + 16).attr('font-size', '11px').text('0');
  legend.append('text').attr('x', legendW).attr('y', legendH + 16).attr('font-size', '11px').attr('text-anchor', 'end').text(fmt(maxVal));
}

// expose for other scripts
if (typeof window !== 'undefined') window.drawHeatmap = drawHeatmap;
