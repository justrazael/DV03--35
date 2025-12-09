/* global d3, drawBarChart, drawHeatmap, drawPieChart */

// Global storage for the raw data once loaded
let rawAgeFinesData = [];
let rawHeatmapData = [];
let rawLocationFinesData = [];

/*Parses a CSV row, converting the fine mean to a number.*/
function rowParser(d) {
    d['Mean(FINES)'] = +d['Mean(FINES)'];
    d['YEAR'] = +d['YEAR'];
    return d;
}

/*Helper function to aggregate pie chart data by summing fines.*/
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

/*Helper function to aggregate bar chart data by summing fines.*/
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

/*Filters raw data based on selected year, age group, and jurisdiction.*/
function updateCharts(selectedYear, selectedAge = 'All', selectedJurisdiction = 'All') {
    console.log(`Updating charts → Year: ${selectedYear}, Age: ${selectedAge}, Jurisdiction: ${selectedJurisdiction}`);

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

    // JURISDICTION FILTER (heatmap only)
    const jurisdictionFilter =
        selectedJurisdiction === 'All'
            ? () => true
            : d => d.JURISDICTION === selectedJurisdiction;

    // 1️⃣ Filter Data
    let barChartData = rawAgeFinesData.filter(d => yearFilter(d) && ageFilter(d));

    // Heatmap applies all 3 filters
    let heatmapFilteredData = rawHeatmapData.filter(
        d => yearFilter(d) && ageFilter(d) && jurisdictionFilter(d)
    );

    // Pie chart ignores age + jurisdiction
    let pieChartData = rawLocationFinesData.filter(yearFilter);

    // 2️⃣ Aggregate if "All Years"
    if (selectedYear === 'All') {
        barChartData = aggregateBarChartData(barChartData);
        pieChartData = aggregatePieChartData(pieChartData);
    }

    // 3️⃣ Redraw Charts
    if (typeof drawBarChart === 'function') {
        drawBarChart(barChartData, '#barchart-container');
    }

    if (typeof drawHeatmap === 'function') {
        drawHeatmap(heatmapFilteredData, '#heatmap-container');
    }

    if (typeof drawPieChart === 'function') {
        drawPieChart(pieChartData, '#piechart-container');
    }
}

/*Loads all required CSV files and draws charts.*/
function loadAndDrawCharts() {
    const dataPromises = [
        d3.csv('dataset/barchart_page3.csv', rowParser),
        d3.csv('dataset/heatmap_page3.csv', rowParser),
        d3.csv('dataset/piechart_page3.csv', rowParser)
    ];

    Promise.all(dataPromises)
        .then(([ageFinesData, heatmapData, locationFinesData]) => {
            console.log("All data loaded. Storing raw data.");

            rawAgeFinesData = ageFinesData;
            rawHeatmapData = heatmapData;
            rawLocationFinesData = locationFinesData;

            // Initial draw
            updateCharts('All', 'All', 'All');
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
