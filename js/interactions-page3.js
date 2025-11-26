document.addEventListener('DOMContentLoaded', () => {
    const yearFilter = document.getElementById('year-filter');
    const ageFilter = document.getElementById('age-filter');

    function triggerUpdate() {
        const selectedYear = yearFilter.value;
        const selectedAge = ageFilter.value;

        if (window.updateCharts) {
            window.updateCharts(selectedYear, selectedAge);
        }
    }

    if (yearFilter) yearFilter.addEventListener('change', triggerUpdate);
    if (ageFilter) ageFilter.addEventListener('change', triggerUpdate);
});
