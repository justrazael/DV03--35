// Data storage
let annualFinesData = [];
let mobileOffencesData = [];
let australiaGeoData = null;

// Current state
let currentYear = 2024;
let selectedJurisdiction = 'NSW'; // Default

// MAPPING: Full Names -> Abbreviations
const stateNameMapping = {
    "New South Wales": "NSW",
    "Victoria": "VIC",
    "Queensland": "QLD",
    "South Australia": "SA",
    "Western Australia": "WA",
    "Tasmania": "TAS",
    "Northern Territory": "NT",
    "Australian Capital Territory": "ACT"
};

// Dimensions & Format
const margin = { top: 40, right: 30, bottom: 60, left: 70 };
const formatNumber = d3.format(",");

// --- TAB LOGIC ---
function updateTab(tabId) {
    // Manage active classes for Tabs and Nav
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`.nav-link[data-tab="${tabId}"]`).classList.add('active');

    // Delay slightly to allow layout to settle
    setTimeout(() => {
        if (tabId === 'annualFinesByJurisdiction') {
            // MAIN DASHBOARD: Draw ALL 3 charts
            if (annualFinesData.length > 0 && australiaGeoData) {
                drawAustraliaMap();
                drawLineChart();
                updateTotalFinesDisplay();
            }
            if (mobileOffencesData.length > 0) {
                drawMobileOffencesBarChart(); 
            }
        } 
    }, 50);
}

// --- 1. AUSTRALIA MAP ---
function drawAustraliaMap() {
    const container = d3.select("#australia-map");
    const width = container.node().clientWidth || 400;
    const height = container.node().clientHeight || 400;
    container.html(""); 

    const svg = container.append("svg").attr("width", width).attr("height", height);

    const projection = d3.geoMercator()
        .fitExtent([[10, 10], [width - 10, height - 10]], australiaGeoData);
    const path = d3.geoPath().projection(projection);

    svg.selectAll("path")
        .data(australiaGeoData.features)
        .enter().append("path")
        .attr("class", d => {
            const abbr = stateNameMapping[d.properties.STATE_NAME] || d.properties.STATE_NAME;
            return `country ${abbr} ${abbr === selectedJurisdiction ? 'active' : ''}`;
        })
        .attr("d", path)
        .on("click", function(event, d) {
            const abbr = stateNameMapping[d.properties.STATE_NAME]; 
            if (abbr) {
                selectedJurisdiction = abbr;

                document.getElementById("selectedJurisdiction").textContent = selectedJurisdiction;
                // Sync Dropdown
                const dropdown = document.getElementById("jurisdictionSelect");
                if(dropdown) dropdown.value = selectedJurisdiction;
                
                // Update Visuals
                svg.selectAll(".country").classed("active", false);
                d3.selectAll(`.${selectedJurisdiction}`).classed("active", true);
                
                drawLineChart();
                updateTotalFinesDisplay();
            }
        })
        .append("title").text(d => d.properties.STATE_NAME);
}

// --- 2. LINE CHART (Top Right) ---
// UPDATED: Now filters based on currentYear slider
function drawLineChart() {
    const container = d3.select("#line-chart-fines");
    let w = container.node().clientWidth || 500;
    let h = container.node().clientHeight || 400;
    container.html(""); 

    const width = w - margin.left - margin.right;
    const height = h - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", w).attr("height", h)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Get ALL data for this jurisdiction (to calculate fixed Max Y-Axis)
    const fullHistoryData = annualFinesData.filter(d => d.Jurisdiction === selectedJurisdiction);
    
    // 2. Get data ONLY up to the current year slider (for the line)
    const visibleData = fullHistoryData.filter(d => d.Year <= currentYear);
    visibleData.sort((a, b) => a.Year - b.Year);

    if (visibleData.length === 0) {
        svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor", "middle").attr("fill", "white").text("No Data");
        return;
    }

    // 3. Scales
    // X Axis: FIXED domain from 2008 to 2024 so the chart doesn't stretch when slider moves
    const x = d3.scaleLinear().domain([2008, 2024]).range([0, width]);
    
    // Y Axis: FIXED domain based on the MAX value of the FULL history (so the line doesn't jump up/down)
    const maxY = d3.max(fullHistoryData, d => d.Value) || 100000;
    const y = d3.scaleLinear().domain([0, maxY]).range([height, 0]);

    // Draw Axes
    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    svg.append("g").call(d3.axisLeft(y).tickFormat(d => formatNumber(d)));

    // Draw Line
    const line = d3.line().x(d => x(d.Year)).y(d => y(d.Value));
    svg.append("path").datum(visibleData).attr("fill", "none").attr("stroke", "#00bcd4").attr("stroke-width", 2).attr("d", line);

    // Draw Dots
    svg.selectAll("circle").data(visibleData).enter().append("circle")
        .attr("cx", d => x(d.Year)).attr("cy", d => y(d.Value)).attr("r", 4).attr("fill", "#00bcd4")
        .on("mouseover", (event, d) => showTooltip(event, `Year: ${d.Year}<br>Fines: $${formatNumber(d.Value)}`))
        .on("mouseout", hideTooltip);

    // Titles
    svg.append("text").attr("x", width/2).attr("y", height + 40).attr("text-anchor", "middle").attr("fill", "#e0e0e0").text("Year");
    svg.append("text").attr("transform", "rotate(-90)").attr("y", -55).attr("x", -height/2).attr("text-anchor", "middle").attr("fill", "#e0e0e0").text("Total Fines ($)");
    
    // Chart Title
    svg.append("text").attr("x", width/2).attr("y", -10).attr("text-anchor", "middle").attr("fill", "#e0e0e0")
       .style("font-size", "14px")
       .text(`Annual Fines Trend (2008 - ${currentYear}): ${selectedJurisdiction}`);
}

// --- 3. BAR CHART (Bottom - Mobile Offences) ---
function drawMobileOffencesBarChart() {
    const container = d3.select("#mobile-bar-chart-bottom");
    
    let w = container.node().clientWidth || 800;
    let h = container.node().clientHeight || 400;
    if(w === 0) w = 800; 
    
    container.html(""); 

    const width = w - margin.left - margin.right;
    const height = h - margin.top - margin.bottom;

    const svg = container.append("svg").attr("width", w).attr("height", h)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // Filter for Slider Year
    const filteredData = mobileOffencesData.filter(d => d.Year === currentYear);

    if (filteredData.length === 0) {
        svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor", "middle").attr("fill", "white").text("No mobile offence data for this year");
        return;
    }

    // Prepare Data
    const data = filteredData.sort((a, b) => b.Offences_per_10000_Licence_Holders - a.Offences_per_10000_Licence_Holders);

    // Scales
    const x = d3.scaleBand().domain(data.map(d => d.Jurisdiction)).range([0, width]).padding(0.3);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.Offences_per_10000_Licence_Holders) * 1.1]).range([height, 0]);

    // Axes
    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x)).selectAll("text").style("font-size", "12px");
    svg.append("g").call(d3.axisLeft(y));

    // Bars
    svg.selectAll(".bar").data(data).enter().append("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.Jurisdiction))
        .attr("y", d => y(d.Offences_per_10000_Licence_Holders))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.Offences_per_10000_Licence_Holders))
        .attr("fill", d => d.Jurisdiction === selectedJurisdiction ? "#00bcd4" : "#ff7f0e") 
        .on("mouseover", (event, d) => showTooltip(event, `<strong>${d.Jurisdiction}</strong><br>Rate: ${d.Offences_per_10000_Licence_Holders.toFixed(1)}`))
        .on("mouseout", hideTooltip);

    // Axis Labels
    svg.append("text").attr("x", width/2).attr("y", height + 40).attr("text-anchor", "middle").attr("fill", "#e0e0e0").text("Jurisdiction");
    svg.append("text").attr("transform", "rotate(-90)").attr("y", -50).attr("x", -height/2).attr("text-anchor", "middle").attr("fill", "#e0e0e0").text("Offences per 10k Holders");
}

// --- HELPERS ---
function updateTotalFinesDisplay() {
    const yearData = annualFinesData.find(d => d.Jurisdiction === selectedJurisdiction && d.Year === currentYear);
    d3.select("#totalFines").text(yearData ? formatNumber(yearData.Value) : "N/A");
}

// Tooltip Logic
const tooltip = d3.select("body").append("div").attr("class", "tooltip").style("opacity", 0);
function showTooltip(event, html) {
    tooltip.transition().duration(200).style("opacity", .9);
    tooltip.html(html).style("left", (event.pageX + 10) + "px").style("top", (event.pageY - 28) + "px");
}
function hideTooltip() {
    tooltip.transition().duration(500).style("opacity", 0);
}

// --- LISTENERS ---
document.getElementById('yearSlider').addEventListener('input', function() {
    currentYear = +this.value;
    document.getElementById('currentYear').textContent = currentYear;
    
    // Update Title for new Chart
    const mobileTitle = document.getElementById('mobileYearDisplay');
    if(mobileTitle) mobileTitle.textContent = currentYear;

    if(annualFinesData.length > 0) { 
        updateTotalFinesDisplay(); 
        drawLineChart(); // Redraw line chart with new year filter
    }
    if(mobileOffencesData.length > 0) {
        drawMobileOffencesBarChart();
    }
});

document.getElementById('jurisdictionSelect').addEventListener('change', function() {
    selectedJurisdiction = this.value;
    // Update Map Highlight
    d3.selectAll(".country").classed("active", false);
    d3.selectAll(`.${selectedJurisdiction}`).classed("active", true);
    // Update Charts
    drawLineChart();
    updateTotalFinesDisplay();
    drawMobileOffencesBarChart(); // Redraw to update highlight color
});

document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', function(event) {
        event.preventDefault();
        updateTab(this.dataset.tab);
    });
});

// --- DATA LOADING ---
Promise.all([
    d3.csv("Sum of fine.csv", d => ({ Year: +d.YEAR, Jurisdiction: d.JURISDICTION, Value: +d["Sum(FINES)"] })),
    d3.csv("fines of each year.csv", d => ({ Year: +d["Year=YEAR"], Jurisdiction: d.JURISDICTION, Offences_per_10000_Licence_Holders: +d["Rate_per_10000_Holders"] })),
    d3.json("australia_states.json")
]).then(([fines, mobile, geo]) => {
    annualFinesData = fines;
    mobileOffencesData = mobile;
    australiaGeoData = geo;
    
    const yearSlider = document.getElementById('yearSlider');
    currentYear = +yearSlider.value;
    document.getElementById('currentYear').textContent = currentYear;
    
    // Start on Main Tab
    updateTab('annualFinesByJurisdiction');
}).catch(e => { console.error(e); alert("Error loading data. Check console (F12)."); });

// Resize Handling
const resizeObserver = new ResizeObserver(() => {
    // Redraw whatever is active
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'annualFinesByJurisdiction') {
        if (australiaGeoData) drawAustraliaMap();
        if (annualFinesData.length > 0) drawLineChart();
        if (mobileOffencesData.length > 0) drawMobileOffencesBarChart();
    }
});
resizeObserver.observe(document.body);