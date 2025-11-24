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
    // Convert the Mean(FINES) column to a number
    d['Mean(FINES)'] = +d['Mean(FINES)'];
    // Convert YEAR to number
    d['YEAR'] = +d['YEAR'];
    return d;
}

/**
 * Filters the raw data based on the selected year and redraws all charts.
 * This function is exposed globally to be called from interactions.js.
 * @param {string} selectedYear - The year to filter by ('All', '2023', '2024').
 */
function updateCharts(selectedYear) {
    console.log(`Updating charts for year: ${selectedYear}`);

    const yearFilter = selectedYear === 'All' ? () => true : d => d.YEAR === parseInt(selectedYear);

    // 1. Filter Data
    const barChartData = rawAgeFinesData.filter(yearFilter);
    const heatmapFilteredData = rawHeatmapData.filter(yearFilter);
    const pieChartData = rawLocationFinesData.filter(yearFilter);

    // 2. Redraw Charts
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
 * Loads all required CSV files and orchestrates chart drawing.
 */
function loadAndDrawCharts() {
    const dataPromises = [
        d3.csv('dataset/Age groups with the most Fines.csv', rowParser),
        d3.csv('dataset/Jurisdiction, age group and fines.csv', rowParser),
        d3.csv('dataset/Locations with the most Fines.csv', rowParser)
    ];

    Promise.all(dataPromises)
        .then(([ageFinesData, heatmapData, locationFinesData]) => {
            console.log("All data loaded successfully. Storing raw data.");
            
            // Store raw data globally
            rawAgeFinesData = ageFinesData;
            rawHeatmapData = heatmapData;
            rawLocationFinesData = locationFinesData;

            // Initial draw using the default filter (e.g., 'All')
            updateCharts('All');
        })
        .catch(error => {
            console.error('Error loading or processing data:', error);
            d3.select('.dashboard-container')
                .append('div')
                .style('grid-column', '1 / -1')
                .style('text-align', 'center')
                .style('color', 'red')
                .text('Failed to load data. Check console for details.');
        });
}

// Expose the updateCharts function globally
window.updateCharts = updateCharts;

// Start the data loading process
loadAndDrawCharts();