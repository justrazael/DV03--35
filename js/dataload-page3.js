/* global d3, drawBarChart, drawHeatmap, drawPieChart */

// Global storage for the raw data once loaded
let rawAgeFinesData = [];
let rawHeatmapData = [];
let rawLocationFinesData = [];

/**
 * Parses a CSV row, converting the fine mean to a number.
 * @param {object} d The data row from the CSV.
 * @returns {object} The parsed data row.
 */
function rowParser(d) {
    d['Mean(FINES)'] = +d['Mean(FINES)'];
    d['YEAR'] = +d['YEAR'];
    return d;
}

/**
 * Helper function to aggregate pie chart data by summing fines.
 */
function aggregatePieChartData(data) {
    const aggregatedMap = d3.rollup(
        data,
        v => d3.sum(v, d => d['Mean(FINES)']),
        d => d.LOCATION
    );

    return Array.from(aggregatedMap, ([location, totalFines]) => ({
        LOCATION: location,
        'Mean(FINES)': totalFines
    }));
}

/**
 * Helper function to aggregate bar chart data by summing fines.
 */
function aggregateBarChartData(data) {
    const aggregatedMap = d3.rollup(
        data,
        v => d3.sum(v, d => d['Mean(FINES)']),
        d => d.AGE_GROUP
    );

    return Array.from(aggregatedMap, ([ageGroup, totalFines]) => ({
        AGE_GROUP: ageGroup,
        'Mean(FINES)': totalFines
    }));
}

/**
 * Filters the raw data based on the selected year AND selected age group
 * This function is exposed globally to be called from interactions.js.
 * @param {string} selectedYear - 'All', '2023', '2024'
 * @param {string} selectedAge - 'All', '0-16', '17-25', etc.
 */
function updateCharts(selectedYear, selectedAge = 'All') {
    console.log(`Updating charts → Year: ${selectedYear}, Age: ${selectedAge}`);

    // YEAR FILTER
    const yearFilter =
        selectedYear === 'All'
            ? () => true
            : d => d.YEAR === parseInt(selectedYear);

    // AGE FILTER
    const ageFilter =
        selectedAge === 'All'
            ? () => true
            : d => d.AGE_GROUP === selectedAge;

    // 1️⃣ Filter Data
    let barChartData = rawAgeFinesData.filter(d => yearFilter(d) && ageFilter(d));
    let heatmapFilteredData = rawHeatmapData.filter(d => yearFilter(d) && ageFilter(d));

    // Pie chart ignores age filter (correct)
    let pieChartData = rawLocationFinesData.filter(yearFilter);

    // 2️⃣ Aggregate if "All Years"
    if (selectedYear === 'All') {
        barChartData = aggregateBarChartData(barChartData);
        pieChartData = aggregatePieChartData(pieChartData);
    }

    // 3️⃣ Redraw Charts
    if (typeof drawBarChart === 'function') {
        drawBarChart(barChartData, '#barchart-container');
    } else {
        console.error("drawBarChart function not found.");
    }

    if (typeof drawHeatmap === 'function') {
        drawHeatmap(heatmapFilteredData, '#heatmap-container');
    } else {
        console.error("drawHeatmap function not found.");
    }

    if (typeof drawPieChart === 'function') {
        drawPieChart(pieChartData, '#piechart-container');
    } else {
        console.error("drawPieChart function not found.");
    }
}

/**
 * Loads all required CSV files and draws charts.
 */
function loadAndDrawCharts() {
    const dataPromises = [
        d3.csv('dataset/Age groups with the most Fines 2.csv', rowParser),
        d3.csv('dataset/Jurisdiction, age group and fines 2.csv', rowParser),
        d3.csv('dataset/Location and Fines 2.csv', rowParser)
    ];

    Promise.all(dataPromises)
        .then(([ageFinesData, heatmapData, locationFinesData]) => {
            console.log("All data loaded. Storing raw data.");

            rawAgeFinesData = ageFinesData;
            rawHeatmapData = heatmapData;
            rawLocationFinesData = locationFinesData;

            // Initial draw
            updateCharts('All', 'All');
        })
        .catch(error => {
            console.error('Error loading data:', error);
            d3.select('.dashboard-container')
                .append('div')
                .style('grid-column', '1 / -1')
                .style('text-align', 'center')
                .style('color', 'red')
                .text('Failed to load data. Check console for details.');
        });
}

window.updateCharts = updateCharts;
loadAndDrawCharts();
