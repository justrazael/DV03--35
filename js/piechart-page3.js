/* global d3 */

/**
 * Draws a D3 pie chart for Locations with the Most Fines, including a legend.
 * @param {Array<object>} data - The dataset for the pie chart.
 * @param {string} selector - The ID of the container element.
 */
function drawPieChart(data, selector) {
    // 1. Clear SVG
    d3.select(selector).select('svg').remove();
    
    // 2. Remove old tooltip
    d3.select('#tooltip-piechart').remove();

    // 3. Create new Tooltip attached to body
    const tooltip = d3.select('body').append('div')
        .attr('id', 'tooltip-piechart')
        .attr('class', 'chart-tooltip')
        .style('opacity', 0);
    
    // Setup dimensions
    const container = d3.select(selector);
    const containerRect = container.node().getBoundingClientRect();
    const width = containerRect.width;
    const height = containerRect.height;

    // Layout configuration
    // Reserve space for the legend on the right side
    // We reserve 35% of the width for the legend, but cap it at 250px max, and ensure at least 150px if possible.
    const legendWidth = Math.min(Math.max(width * 0.35, 150), 250);
    const chartWidth = width - legendWidth;
    
    // Calculate radius based on the space available for the chart
    const radius = Math.min(chartWidth, height) / 2 - 20;

    const svg = container.append('svg')
        .attr('width', width)
        .attr('height', height);
        
    // Group for the Pie Chart (centered in the chart area)
    const g = svg.append('g')
        .attr('transform', `translate(${chartWidth / 2},${height / 2})`);

    // Define Color Scale
    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.LOCATION))
        .range(d3.schemeSpectral[data.length] || d3.schemeCategory10);

    const pie = d3.pie().value(d => d['Mean(FINES)']).sort(null);
    const arc = d3.arc().innerRadius(0).outerRadius(radius);
    const outerArc = d3.arc().innerRadius(radius * 1.05).outerRadius(radius * 1.05);

    // --- Draw Pie Slices ---
    const arcs = g.selectAll('arc')
        .data(pie(data))
        .enter().append('g')
        .attr('class', 'arc');
        
    arcs.append('path')
        .attr('d', arc)
        .attr('fill', d => color(d.data.LOCATION))
        .attr('stroke', 'white')
        .style('stroke-width', '2px')
        .style('opacity', 0.8)
        .style('cursor', 'pointer')
        .transition()
        .duration(1000)
        .attrTween('d', function(d) {
            const i = d3.interpolate(d.startAngle + 0.1, d.endAngle);
            return function(t) {
                d.endAngle = i(t);
                return arc(d);
            };
        })
        .on('end', function(d) {
            // Re-select to attach events after transition
            d3.select(this)
                .on('mouseover', function(event, d) {
                    d3.select(this).style('opacity', 1).attr('stroke-width', '4px');
                    tooltip.style('opacity', 0.9);
                })
                .on('mousemove', function(event, d) {
                     const pieData = d.data; 
                     tooltip.html(`<b>Location:</b> ${pieData.LOCATION}<br><b>Avg Fines:</b> ${d3.format(',.0f')(pieData['Mean(FINES)'])}`)
                        .style('left', (event.pageX) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                })
                .on('mouseout', function() {
                    d3.select(this).style('opacity', 0.8).attr('stroke-width', '2px');
                    tooltip.style('opacity', 0);
                });
        });

    // --- Labels (Inside) ---
    arcs.append('text')
        .attr('transform', function(d) { 
            const midAngle = d.startAngle + (d.endAngle - d.startAngle) / 2;
            const x = Math.sin(midAngle) * (radius * 0.7);
            const y = -Math.cos(midAngle) * (radius * 0.7);
            return 'translate(' + x + ',' + y + ')';
        })
        .attr('dy', '0.35em')
        .text(d => d.data.LOCATION.split(' ')[0]) // Short name
        .style('text-anchor', 'middle')
        .style('font-size', '10px')
        .style('fill', 'white')
        .style('pointer-events', 'none') // Don't block mouse events
        .filter(d => (d.endAngle - d.startAngle) > 0.2); // Only show if slice is big enough
        
    // --- Percentages (Outside) ---
    arcs.append('text')
        .attr('transform', function(d) {
            return 'translate(' + outerArc.centroid(d) + ')';
        })
        .attr('dy', '0.35em')
        .text(function(d) {
            const total = d3.sum(data, d => d['Mean(FINES)']);
            const percentage = (d.data['Mean(FINES)'] / total) * 100;
            return d3.format('.1f')(percentage) + '%';
        })
        .style('text-anchor', d => (d.startAngle + d.endAngle) / 2 > Math.PI ? 'end' : 'start')
        .style('font-size', '10px')
        .style('fill', '#666')
        .style('pointer-events', 'none');

    // --- Legend ---
    const totalFines = d3.sum(data, d => d['Mean(FINES)']);

    const legendGroup = svg.append('g')
        .attr('class', 'legend')
        .attr('transform', `translate(${chartWidth}, 20)`); // Position to the right of the chart

    const legendItems = legendGroup.selectAll('.legend-item')
        .data(data)
        .enter().append('g')
        .attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(10, ${i * 20})`); // Vertical list

    // Color Box
    legendItems.append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', d => color(d.LOCATION));

    // Text Label
    legendItems.append('text')
        .attr('x', 20)
        .attr('y', 11)
        .text(d => {
            const percentage = (d['Mean(FINES)'] / totalFines) * 100;
            const avgFines = d3.format(',.0f')(d['Mean(FINES)']);
            return `${d.LOCATION.split(' ')[0]} ${d3.format('.1f')(percentage)}% (${avgFines})`;
        })
        .style('font-size', '12px')
        .style('alignment-baseline', 'middle')
        .attr('fill', '#333');

}