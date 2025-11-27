/* global d3 */

/**
 * Draws a D3 heatmap for Jurisdiction, Age Group, and Fines.
 * @param {Array<object>} data - The dataset for the heatmap.
 * @param {string} selector - The ID of the container element.
 */
function drawHeatmap(data, selector) {
    // 1. Clear SVG
    d3.select(selector).select('svg').remove();
    
    // 2. Remove old tooltip
    d3.select('#tooltip-heatmap').remove();
    
    // 3. Create new Tooltip attached to body
    const tooltip = d3.select('body').append('div')
        .attr('id', 'tooltip-heatmap')
        .attr('class', 'chart-tooltip')
        .style('opacity', 0);

    // Setup dimensions
    const container = d3.select(selector);
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;

    const margin = { top: 60, right: 20, bottom: 80, left: 65 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    const svg = container.append('svg')
        .attr('width', containerWidth)
        .attr('height', containerHeight)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
        
    const jurisdictions = Array.from(new Set(data.map(d => d.JURISDICTION))).sort();
    const ageGroups = ["0-16", "17-25", "26-39", "40-64", "65 and over"];
    
    const x = d3.scaleBand().range([0, width]).domain(jurisdictions).padding(0.05);
    const y = d3.scaleBand().range([height, 0]).domain(ageGroups).padding(0.05);
        
    const maxFines = d3.max(data, d => d['Mean(FINES)']);
    
    // Using d3.interpolateRgb for custom color gradient (light yellow to dark blue)
    const colorScale = d3.scaleSequential()
        .interpolator(d3.interpolateRgb('lightyellow', 'darkblue'))
        .domain([0, maxFines]);
    
    // Draw Cells
    svg.selectAll('.cell')
        .data(data, d => `${d.JURISDICTION}:${d.AGE_GROUP}`)
        .enter().append('rect')
        .attr('class', 'heatmap-cell')
        .attr('x', d => x(d.JURISDICTION))
        .attr('y', d => y(d.AGE_GROUP))
        .attr('width', x.bandwidth())
        .attr('height', y.bandwidth())
        .style('fill', '#ccc')
        .style('opacity', 0)
        .transition()
        .duration(800)
        .delay((d, i) => i * 20)
        .style('opacity', 1)
        .style('fill', d => colorScale(d['Mean(FINES)']))
        .on('end', function() {
            d3.select(this)
                .on('mouseover', function(event, d) {
                    tooltip.style('opacity', 0.9);
                })
                .on('mousemove', function(event, d) {
                    // Update position dynamically
                    tooltip.html(`<b>Jurisdiction:</b> ${d.JURISDICTION}<br><b>Age Group:</b> ${d.AGE_GROUP}<br><b>Avg Fines:</b> ${d3.format(',.0f')(d['Mean(FINES)'])}`)
                        .style('left', (event.pageX) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                })
                .on('mouseout', function() {
                    tooltip.style('opacity', 0);
                });
        });

    // Axes
    const xAxis = svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x));

    xAxis.selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('fill', '#fff')
        .style('text-anchor', 'end');

    xAxis.selectAll('line').style('stroke', '#fff'); // tick lines
    xAxis.selectAll('path').style('stroke', '#fff'); // axis line

    
    svg.append('text')
        .attr('class', 'x-axis-label')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .style('text-anchor', 'middle')
        .style('fill', 'white')
        .text('Jurisdiction');

    const yAxis = svg.append('g')
        .call(d3.axisLeft(y));

    yAxis.selectAll('text').style('fill', '#fff');   // label text
    yAxis.selectAll('line').style('stroke', '#fff'); // tick lines
    yAxis.selectAll('path').style('stroke', '#fff'); // axis line

        
    svg.append('text')
        .attr('class', 'y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('fill', 'white')
        .text('Age Group');

    // Legend
    const legendHeight = 15;
    const legendWidth = 200;
    const legendSvg = svg.append('g')
        .attr('transform', `translate(${width - legendWidth}, -${margin.top / 1})`);
        
    const linearGradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', 'linear-gradient');
        
    linearGradient.selectAll('stop')
        .data(colorScale.ticks(5).map((t, i, n) => ({ 
            offset: `${100 * i / (n.length - 1)}%`, 
            color: colorScale(t) 
        })))
        .enter().append('stop')
        .attr('offset', d => d.offset)
        .attr('stop-color', d => d.color);

    legendSvg.append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', 'url(#linear-gradient)');
        
    legendSvg.append('text').attr('y', legendHeight + 15).style('fill', 'white').text('Low Fines');
    legendSvg.append('text').attr('x', legendWidth).attr('y', legendHeight + 15).style('text-anchor', 'end').style('fill', 'white').text('High Fines');
}