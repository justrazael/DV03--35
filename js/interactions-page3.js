/* interactions.js */

document.addEventListener('DOMContentLoaded', () => {
    const yearFilter = document.getElementById('year-filter');

    if (yearFilter) {
        yearFilter.addEventListener('change', (e) => {
            const selectedYear = e.target.value;
            console.log(`Year selected: ${selectedYear}`);
            
            // Call the global update function exposed by D3 Data Loader.js
            if (window.updateCharts) {
                window.updateCharts(selectedYear);
            } else {
                console.error("updateCharts function not found. Ensure D3 Data Loader.js is loaded correctly.");
            }
        });
    }
});