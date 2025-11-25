/* global d3 */

/**
 * Draws a D3 bar chart for the Age Groups with the Most Fines.
 * @param {Array<object>} data - The dataset for the bar chart.
 * @param {string} selector - The ID of the container element.
 */
function drawBarChart(data, selector) {
    // 1. Clear existing SVG
    d3.select(selector).select('svg').remove();
    
    // 2. Remove existing tooltip to prevent duplicates
    d3.select('#tooltip-barchart').remove();

    // 3. Create new Tooltip attached to body
    const tooltip = d3.select('body').append('div')
        .attr('id', 'tooltip-barchart')
        .attr('class', 'chart-tooltip')
        .style('opacity', 0);
    
    // Sort data
    data.sort((a, b) => b['Mean(FINES)'] - a['Mean(FINES)']);
    
    // Setup dimensions
    const container = d3.select(selector);
    const containerWidth = container.node().getBoundingClientRect().width;
    const containerHeight = container.node().getBoundingClientRect().height;

    const margin = { top: 30, right: 20, bottom: 80, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = containerHeight - margin.top - margin.bottom;

    // Create SVG
    const svg = container.append('svg')
        .attr('width', containerWidth)
        .attr('height', containerHeight)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Scales
    const x = d3.scaleBand()
        .domain(data.map(d => d.AGE_GROUP))
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d['Mean(FINES)'])])
        .nice()
        .range([height, 0]);

    const color = d3.scaleOrdinal()
        .domain(data.map(d => d.AGE_GROUP))
        .range(d3.schemeCategory10);

    // Draw Bars with updated mouse events
    svg.selectAll('.bar')
        .data(data)
        .enter().append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.AGE_GROUP))
        .attr('y', height)
        .attr('width', x.bandwidth())
        .attr('height', 0)
        .attr('fill', d => color(d.AGE_GROUP))
        .style('cursor', 'pointer')
        .transition()
        .duration(1000)
        .delay((d, i) => i * 100)
        .attr('y', d => y(d['Mean(FINES)']))
        .attr('height', d => height - y(d['Mean(FINES)']))
        .on('end', function() {
            d3.select(this)
                .on('mouseover', function(event, d) {
                    d3.select(this).attr('opacity', 0.8);
                    tooltip.style('opacity', 0.9);
                })
                .on('mousemove', function(event, d) {
                    // Update position dynamically as mouse moves
                    tooltip.html(`Age: <b>${d.AGE_GROUP}</b><br>Avg Fines: <b>${d3.format(',.0f')(d['Mean(FINES)'])}</b>`)
                        .style('left', (event.pageX) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                })
                .on('mouseout', function() {
                    d3.select(this).attr('opacity', 1);
                    tooltip.style('opacity', 0);
                });
        });
    
    // -------------- Add Bar Labels --------------
    svg.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => x(d.AGE_GROUP) + x.bandwidth() / 2)
        .attr('y', height)              // start from bottom
        .attr('text-anchor', 'middle')
        .style('opacity', 0)
        .transition()
        .duration(1000)
        .delay((d, i) => i * 100)
        .attr('y', d => y(d['Mean(FINES)']) - 5) // place above bar
        .style('opacity', 1)
        .text(d => d3.format(',.0f')(d['Mean(FINES)']));


    // Axes
    svg.append('g')
        .attr('transform', `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll('text')
        .attr('transform', 'rotate(-45)')
        .style('text-anchor', 'end');

    svg.append('text')
        .attr('class', 'x-axis-label')
        .attr('x', width / 2)
        .attr('y', height + margin.bottom - 10)
        .style('text-anchor', 'middle')
        .text('Age Group');

    svg.append('g')
        .call(d3.axisLeft(y).tickFormat(d3.format('.2s')));

    svg.append('text')
        .attr('class', 'y-axis-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', 0 - margin.left)
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text('Mean Fines (AUD)');
}