document.addEventListener('DOMContentLoaded', () => {
    const yearFilter = document.getElementById('year-filter');
    const ageFilter = document.getElementById('age-filter');
    const jurisdictionFilter = document.getElementById('jurisdiction-filter');

    function triggerUpdate() {
        const selectedYear = yearFilter.value;
        const selectedAge = ageFilter.value;
        const selectedJurisdiction = jurisdictionFilter.value;

        if (window.updateCharts) {
            window.updateCharts(selectedYear, selectedAge, selectedJurisdiction);
        }
    }

    if (yearFilter) yearFilter.addEventListener('change', triggerUpdate);
    if (ageFilter) ageFilter.addEventListener('change', triggerUpdate);
    if (jurisdictionFilter) jurisdictionFilter.addEventListener('change', triggerUpdate);
});
