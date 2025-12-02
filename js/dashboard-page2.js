// Minimal demo charts to mimic the example dashboard using D3
/* Dashboard: read workbook and render charts from data if possible. */

(async function(){
  // Use the CSV dataset by default
  const dataPath = 'dataset/final_output.csv';

  async function loadWorkbook(path){
    try{
      // If CSV, fetch as text and parse with d3.csvParse (keeps rest of logic intact)
      if(/\.csv$/i.test(path)){
        const resp = await fetch(path);
        if(!resp.ok) throw new Error('fetch failed');
        const txt = await resp.text();
        const rows = d3.csvParse(txt);
        return {rows, sheetName: 'CSV'};
      }
      // Otherwise attempt to load as an Excel workbook (existing behavior)
      const resp = await fetch(path);
      if(!resp.ok) throw new Error('fetch failed');
      const ab = await resp.arrayBuffer();
      const data = new Uint8Array(ab);
      const wb = XLSX.read(data, {type:'array'});
      const first = wb.SheetNames[0];
      const sheet = wb.Sheets[first];
      const rows = XLSX.utils.sheet_to_json(sheet, {defval:null});
      return {rows, sheetName:first};
    }catch(err){
      console.warn('Could not load workbook/datafile', err);
      return null;
    }
  }

  function detectKeys(rows){
    const keys = rows && rows.length? Object.keys(rows[0]) : [];
    const yearKey = keys.find(k=>/year/i.test(k)) || keys.find(k=>/yr\b/i.test(k));
    const numericKeys = keys.filter(k=>{
      const nums = rows.map(r=>{const v=r[k]; return (v===null||v==='')?NaN:+v});
      const numericCount = nums.filter(v=>!isNaN(v)).length;
      return numericCount >= Math.max(1, Math.floor(rows.length*0.25));
    });
    const catKeys = keys.filter(k=>!numericKeys.includes(k));
    const catKey = catKeys.find(k=>/method|detection|type|issued|offence|offense|category|jurisdiction|region/i.test(k)) || catKeys[0];
    // Detect if this dataset is aggregated columns for Police/Camera/Other (e.g., final_output.csv)
    const detectionCols = {};
    numericKeys.forEach(k=>{
      if(/police/i.test(k)) detectionCols['Police issued'] = k;
      if(/camera/i.test(k)) detectionCols['Camera fined'] = k;
    });
    const isAggregatedDetection = Object.keys(detectionCols).length > 0;
    return {keys, yearKey, numericKeys, catKey, detectionCols, isAggregatedDetection};
  }

  // Shared state for filtering and redraws
  let wbRows = null;
  let detectedKeys = null;
  
  let currentFilter = 'All';
  
  // Left Panel Filters (Pie & Stats)
  let currentYearFilter = 'All'; 
  let currentPieDetection = null;

  // Right Panel Filters (Scatter)
  let currentScatterYear = 'All'; // New independent state for scatter chart
  let currentScatterDetection = 'All';

  // Global Detection (Top Bar) - mirrored to currentFilter
  let currentDetectionFilter = 'All';


  // Map raw detection values to friendly labels
  function mapDetectionLabel(v){
    if(!v) return 'Unknown';
    const s = String(v).toLowerCase();
    if(/camera|photo|speed camera|red light|fixed camera|mobile camera/.test(s)) return 'Camera fined';
    if(/police|officer|constable/.test(s)) return 'Police issued';
    return v;
  }

  function populateSelects(catKey){
    if(!catKey || !wbRows) return;
    const sel = document.getElementById('detection-select');
    const sel2 = document.getElementById('m2');
    let mapped = [];
    // If dataset uses aggregated numeric columns for detection (Police/Camera/Other),
    // use those column names as detection categories instead of deriving from text.
    if(detectedKeys && detectedKeys.isAggregatedDetection && detectedKeys.detectionCols){
      mapped = Object.keys(detectedKeys.detectionCols).filter(v=>v);
    } else {
      // Ensure every row has a derived detection value (search all text fields)
      deriveDetectionForRows();
      // Build the mapped detection categories (Camera/Police/Unknown) from derived values
      mapped = Array.from(new Set(wbRows.map(r=>r.__detection || 'Unknown'))).filter(v=>v!=='' && v!==null);
    }
    // desired ordering
    const order = ['Camera fined','Police issued','Unknown'];
    const ordered = order.filter(o=>mapped.includes(o)).concat(mapped.filter(m=>!order.includes(m)));
    function fill(s){
      if(!s) return;
      s.innerHTML = '';
      ordered.forEach(v=>{ const o = document.createElement('option'); o.value = v; o.textContent = v; s.appendChild(o); });
    }
    const pieSel = document.getElementById('pie-detection-select');
    fill(sel); fill(pieSel); fill(sel2);
    // ensure the scatter selector (`sel2`) has an 'All' option at the front
    if(sel2){
      const hasAll = Array.from(sel2.options).some(o=>o.value === 'All');
      if(!hasAll){
        const optAll = document.createElement('option'); optAll.value = 'All'; optAll.textContent = 'All';
        sel2.insertBefore(optAll, sel2.firstChild);
      }
    }
    // default to first option for main detection (no 'All')
    if(sel && sel.options && sel.options.length>0) sel.selectedIndex = 0;
    // default pie detection to first option (no 'All')
    if(pieSel && pieSel.options && pieSel.options.length>0){ pieSel.selectedIndex = 0; currentPieDetection = pieSel.value; }
    // default scatter selector to 'All' if present (so bubble chart shows all detections by default)
    if(sel2 && sel2.options && sel2.options.length>0){
      const idxAll = Array.from(sel2.options).findIndex(o=>o.value === 'All');
      sel2.selectedIndex = idxAll >= 0 ? idxAll : 0;
      currentScatterDetection = sel2.value;
    }
    // populate year-select too (if available)
    const yearKey = detectedKeys && detectedKeys.yearKey;
    if(yearKey) populateYearSelect(yearKey);
  }

  // Derive a simple detection method value for each row by scanning values
  function deriveDetectionForRows(){
    if(!wbRows) return;
    wbRows.forEach(r=>{
      // if already derived, skip
      if(r.__detection) return;
      let found = 'Unknown';
      for(const k of Object.keys(r)){
        const v = r[k];
        if(!v) continue;
        const s = String(v).toLowerCase();
        if(/camera|photo|speed camera|red light|fixed camera|mobile camera/.test(s)) { found = 'Camera fined'; break; }
        if(/police|officer|constable/.test(s)) { found = 'Police issued'; break; }
      }
      r.__detection = found;
    });
  }

  function populateYearSelect(yearKey){
    const valueKey = detectedKeys && detectedKeys.numericKeys && detectedKeys.numericKeys[0];
    const ys = d3.rollup(wbRows, v=> valueKey ? d3.sum(v,d=> +d[valueKey] || 0) : v.length, d=>+d[yearKey]);
    const arr = Array.from(ys).map(([y,sum])=>({year:+y,sum})).filter(a=>!isNaN(a.year)).sort((a,b)=>a.year-b.year);
    
    // --- 1. Populate Left Panel Year (Pies/Stats) ---
    const sel = document.getElementById('year-select');
    if(sel) {
        sel.innerHTML = '';
        // add 'All' option back for the pie year selection
        const optAll = document.createElement('option'); optAll.value = 'All'; optAll.textContent = 'All'; sel.appendChild(optAll);
        // only include years with positive totals
        arr.filter(a=>a.sum>0).forEach(a=>{ const o=document.createElement('option'); o.value = a.year; o.textContent = a.year; sel.appendChild(o); });
        
        // default to 'All' for the pie year selection
        if(sel.options && sel.options.length>0){ sel.selectedIndex = 0; currentYearFilter = sel.value; }
        
        sel.addEventListener('change', ()=>{ currentYearFilter = sel.value; applyFilterAndRender(currentDetectionFilter); });
    }

    // --- 2. Populate Right Panel Year (Scatter) ---
    const scatterSel = document.getElementById('scatter-year-select');
    if(scatterSel) {
        scatterSel.innerHTML = '';
        const optAllScatter = document.createElement('option'); optAllScatter.value = 'All'; optAllScatter.textContent = 'All'; scatterSel.appendChild(optAllScatter);
        arr.filter(a=>a.sum>0).forEach(a=>{ const o=document.createElement('option'); o.value = a.year; o.textContent = a.year; scatterSel.appendChild(o); });
        
        if(scatterSel.options && scatterSel.options.length>0){ scatterSel.selectedIndex = 0; currentScatterYear = scatterSel.value; }
        
        scatterSel.addEventListener('change', ()=>{ currentScatterYear = scatterSel.value; applyFilterAndRender(currentDetectionFilter); });
    }
  }

  function applyFilterAndRender(selected){
    // selected may come from either detection-select or other select handlers
    currentFilter = selected || 'All';
    // if the caller passed a detection-select element value, mirror it to currentDetectionFilter
    currentDetectionFilter = currentFilter;
    const rows = wbRows || [];
    if(!detectedKeys && rows.length) detectedKeys = detectKeys(rows);
    const {yearKey, numericKeys, catKey} = detectedKeys || {};
    // If we don't have a detected categorical key but the user selected a specific value,
    // try to find which column contains that value and use it as the catKey.
    if(!catKey && currentFilter !== 'All' && rows.length){
      for(const k of (detectedKeys && detectedKeys.keys || [])){
        if(rows.some(r=>String(r[k]) === String(currentFilter))){
          detectedKeys.catKey = k;
          // populate selects now that we guessed the column
          populateSelects(k);
          break;
        }
      }
    }
  const usedCatKey = (detectedKeys && detectedKeys.catKey) || catKey;
  
  // apply detection filter first — support both per-row detection or aggregated detection columns
  let filtered = rows;
  let valueKeyForLine = numericKeys && numericKeys[0];
  let lineRows = rows;
  
  if(detectedKeys && detectedKeys.isAggregatedDetection && detectedKeys.detectionCols){
    // When dataset contains aggregated detection numeric columns (e.g., Police/Camera),
    // selecting a detection category should filter rows where that column has a positive value
    if(currentDetectionFilter && currentDetectionFilter !== 'All'){
      const col = detectedKeys.detectionCols[currentDetectionFilter];
      if(col){
        filtered = rows.filter(r=> (+r[col] || 0) > 0 );
        lineRows = rows.filter(r=> (+r[col] || 0) > 0 );
        valueKeyForLine = col;
      }
    }
  } else {
    // original per-row detection logic
    if(currentDetectionFilter && currentDetectionFilter !== 'All'){
      filtered = rows.filter(r=>String(r.__detection || 'Unknown') === String(currentDetectionFilter));
      lineRows = rows.filter(r=>String(r.__detection || 'Unknown') === String(currentDetectionFilter));
      valueKeyForLine = numericKeys && numericKeys[0];
    }
  }

  // --- FILTERING FOR LEFT PANEL (STATS & PIE) ---
  // apply year filter if selected (affects pie and stats)
  if(currentYearFilter && currentYearFilter !== 'All' && yearKey){
    filtered = filtered.filter(r=>String(r[yearKey]) === String(currentYearFilter));
  }
  
  if(yearKey && valueKeyForLine) renderLineFromRows(lineRows, yearKey, valueKeyForLine);
  
  // Prepare pie rows based on pie-specific year selection (pie detection should NOT affect the detection-split pie)
  let pieRowsYearOnly = rows;
  // apply pie year filter (year-select is for pie area and includes 'All')
  if(currentYearFilter && currentYearFilter !== 'All' && yearKey){
    pieRowsYearOnly = pieRowsYearOnly.filter(r=>String(r[yearKey]) === String(currentYearFilter));
  }
  
  // Now build the rows used for the main pie (which does respect the pie detection selector)
  let pieRows = pieRowsYearOnly;
  // apply pie detection selection if present (affects the jurisdiction pie)
  if(currentPieDetection){
    if(detectedKeys && detectedKeys.isAggregatedDetection && detectedKeys.detectionCols){
      const col = detectedKeys.detectionCols[currentPieDetection];
      if(col) pieRows = pieRows.filter(r=> (+r[col] || 0) > 0 );
    } else {
      pieRows = pieRows.filter(r=> String(r.__detection || 'Unknown') === String(currentPieDetection));
    }
  }
  if(usedCatKey) {
    // When aggregated detection columns exist and a specific detection was chosen, use that numeric column as value key
    let pieValueKey = numericKeys && numericKeys[0];
    if(detectedKeys && detectedKeys.isAggregatedDetection && detectedKeys.detectionCols && currentPieDetection){
      pieValueKey = detectedKeys.detectionCols[currentPieDetection] || pieValueKey;
    }
    // render main jurisdiction pie (respecting pie detection)
    renderPieFromRows(pieRows, usedCatKey, pieValueKey);
    // render the Police vs Camera split pie using ONLY the Year filter (ignore pie detection)
    renderDetectionSplit(pieRowsYearOnly, usedCatKey);
  }

  // --- FILTERING FOR RIGHT PANEL (SCATTER) ---
  // Prepare scatter rows separately. 
  // It should follow currentScatterYear and currentScatterDetection.
  let scatterRows = rows;
  
  // 1. Apply Scatter Year Filter (New Logic)
  if(currentScatterYear && currentScatterYear !== 'All' && yearKey){
    scatterRows = scatterRows.filter(r=>String(r[yearKey]) === String(currentScatterYear));
  }

  // 2. Apply Scatter Detection Filter (skip filtering when 'All' is selected)
  if(currentScatterDetection && currentScatterDetection !== 'All'){
    if(detectedKeys && detectedKeys.isAggregatedDetection && detectedKeys.detectionCols){
      const col = detectedKeys.detectionCols[currentScatterDetection];
      if(col) scatterRows = scatterRows.filter(r=> (+r[col] || 0) > 0 );
    } else {
      scatterRows = scatterRows.filter(r=> String(r.__detection || 'Unknown') === String(currentScatterDetection));
    }
  }

  if(numericKeys && numericKeys.length>=2){
    if(detectedKeys && detectedKeys.isAggregatedDetection && detectedKeys.detectionCols){
      // For aggregated detection datasets, compute x as the selected detection column and y as total detections
      const cols = Object.values(detectedKeys.detectionCols);
      const selectedCol = detectedKeys.detectionCols[currentScatterDetection] || cols[0];
      const parsed = scatterRows.map(r=>{
        const total = cols.reduce((s,c)=> s + (+r[c] || 0), 0);
        return { x: +r[selectedCol] || 0, y: total, c: r[usedCatKey] || 'Unknown' };
      }).filter(d=> !isNaN(d.x) && !isNaN(d.y));
      renderScatterFromParsed(parsed);
    } else {
      renderScatterFromRows(scatterRows, numericKeys[0], numericKeys[1], usedCatKey);
    }
  }

  // update stat values (Police vs Camera) - use sums if numeric key exists, otherwise counts
  try{
    const policeLabel = 'Police issued';
    const cameraLabel = 'Camera fined';
    const valueKey = numericKeys && numericKeys[0];
    let policeVal = 0, cameraVal = 0;
    if(detectedKeys && detectedKeys.isAggregatedDetection && detectedKeys.detectionCols){
      const policeCol = detectedKeys.detectionCols[policeLabel];
      const cameraCol = detectedKeys.detectionCols[cameraLabel];
      policeVal = d3.sum(filtered || [], r => +r[policeCol] || 0);
      cameraVal = d3.sum(filtered || [], r => +r[cameraCol] || 0);
    } else {
      (filtered || []).forEach(r=>{
        const mapped = r.__detection || mapDetectionLabel(r[usedCatKey]);
        if(valueKey){
          const n = +r[valueKey] || 0;
          if(mapped === policeLabel) policeVal += n;
          else if(mapped === cameraLabel) cameraVal += n;
        } else {
          if(mapped === policeLabel) policeVal += 1;
          else if(mapped === cameraLabel) cameraVal += 1;
        }
      });
    }
    const statEls = document.querySelectorAll('.stat .stat-value');
    if(statEls && statEls.length>=2){
      statEls[0].textContent = (valueKey ? Math.round(policeVal).toLocaleString() : policeVal.toLocaleString());
      statEls[1].textContent = (valueKey ? Math.round(cameraVal).toLocaleString() : cameraVal.toLocaleString());
    }
  }catch(e){ /* ignore */ }
  }

  function renderLineFromRows(rows, yearKey, valueKey){
    // Aggregate sums by year
    const aggMap = new Map(Array.from(d3.rollup(rows, v=>d3.sum(v, d=>+d[valueKey] || 0), d=>+d[yearKey])));
    // construct full year range from min to max, include zeros
    const years = Array.from(aggMap.keys()).map(n=>+n).filter(n=>!isNaN(n));
    if(years.length===0){
      const container = d3.select('#line-canvas'); container.selectAll('*').remove(); container.append('div').attr('class','small-muted').text('No data for selected filters'); return;
    }
    const minY = d3.min(years); const maxY = d3.max(years);
    const full = d3.range(minY, maxY+1).map(y=>({year:y, value: +(aggMap.get(y) || 0)}));
    const container = d3.select('#line-canvas'); container.selectAll('*').remove();
    const w = container.node().clientWidth || 800; const h = container.node().clientHeight || 260;
    const margin = {t:10,r:10,b:30,l:50}; const width = w-margin.l-margin.r; const height = h-margin.t-margin.b;
    const svg = container.append('svg').attr('width',w).attr('height',h); const g = svg.append('g').attr('transform',`translate(${margin.l},${margin.t})`);
    // We'll set the x domain to the non-zero year extent so zero years disappear entirely
    const nonZero = full.filter(d=>d.value>0);
    if(nonZero.length === 0){
      const container = d3.select('#line-canvas'); container.selectAll('*').remove(); container.append('div').attr('class','small-muted').text('No non-zero data for selected filters'); return;
    }
    const nzYears = nonZero.map(d=>d.year).sort((a,b)=>a-b);
    const minNZ = d3.min(nzYears); const maxNZ = d3.max(nzYears);
    const x = d3.scaleLinear().domain([minNZ,maxNZ]).range([0,width]);
    const y = d3.scaleLinear().domain([0,d3.max(full,d=>d.value)]).nice().range([height,0]);
    // draw axes with ticks only on non-zero years
    g.append('g').attr('transform',`translate(0,${height})`).call(d3.axisBottom(x).tickValues(nzYears).tickFormat(d3.format('d')));
    g.append('g').call(d3.axisLeft(y));
    const line = d3.line().x(d=>x(d.year)).y(d=>y(d.value));
    g.append('path').datum(nonZero).attr('d',line).attr('fill','none').attr('stroke','#ffffff').attr('stroke-width',2.5);
    // tooltip for points
    let tooltip = d3.select('body').select('.d3-tooltip'); if(tooltip.empty()) tooltip = d3.select('body').append('div').attr('class','d3-tooltip').style('display','none');
    g.selectAll('circle').data(nonZero).enter().append('circle').attr('cx',d=>x(d.year)).attr('cy',d=>y(d.value)).attr('r',4).attr('fill','#ffd966')
      .on('mouseover',(event,d)=>{ tooltip.style('display','block').html(`<strong>${d.year}</strong><br/>${d.value.toLocaleString()} fines`); })
      .on('mousemove',(event)=>{ tooltip.style('left',(event.pageX+10)+'px').style('top',(event.pageY+10)+'px'); })
      .on('mouseout',()=>{ tooltip.style('display','none'); });
  }

  function renderPieFromRows(rows, catKey, valueKey){
    const agg = Array.from(d3.rollup(rows, v=> valueKey? d3.sum(v,d=>+d[valueKey]) : v.length, d=>d[catKey])).map(([k,v])=>({k:k||'Unknown',v}));
    const container = d3.select('#pie-canvas'); container.selectAll('*').remove();
    const w = container.node().clientWidth || 300; const h = container.node().clientHeight || 220; const radius = Math.min(w,h)/2 -8;
    const svg = container.append('svg').attr('width',w).attr('height',h); const g=svg.append('g').attr('transform',`translate(${w/2},${h/2})`);
    const pie = d3.pie().value(d=>d.v)(agg);
    const arc = d3.arc().outerRadius(radius).innerRadius(0);
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(agg.map(d=>d.k));
    // tooltip for pie slices
    let tooltip = d3.select('body').select('.d3-tooltip'); if(tooltip.empty()) tooltip = d3.select('body').append('div').attr('class','d3-tooltip').style('display','none');
    const slices = g.selectAll('path').data(pie).enter().append('path').attr('d',arc).attr('fill',d=>color(d.data.k)).attr('stroke','#fff');
    slices.on('mouseover',(event,d)=>{ tooltip.style('display','block').html(`<strong>${d.data.k}</strong><br/>${(d.data.v||0).toLocaleString()}`); })
      .on('mousemove',(event)=>{ tooltip.style('left',(event.pageX+10)+'px').style('top',(event.pageY+10)+'px'); })
      .on('mouseout',()=>{ tooltip.style('display','none'); });
    g.selectAll('text').data(pie).enter().append('text').attr('transform',d=>`translate(${arc.centroid(d)})`).attr('text-anchor','middle').attr('font-size',10).attr('fill','#fff').text(d=>d.data.k);
  }

  // Render a small two-slice pie showing Police vs Camera totals for the provided rows
  function renderDetectionSplit(rows, usedCatKey){
    const container = d3.select('#pie2-canvas'); container.selectAll('*').remove();
    if(!rows || rows.length===0){ container.append('div').attr('class','small-muted').text('No data'); return; }
    let police = 0, camera = 0;
    if(detectedKeys && detectedKeys.isAggregatedDetection && detectedKeys.detectionCols){
      const pcol = detectedKeys.detectionCols['Police issued'];
      const ccol = detectedKeys.detectionCols['Camera fined'];
      police = d3.sum(rows, r=> +r[pcol] || 0);
      camera = d3.sum(rows, r=> +r[ccol] || 0);
    } else {
      rows.forEach(r=>{
        const mapped = r.__detection || mapDetectionLabel(r[usedCatKey]);
        if(mapped === 'Police issued') police += 1;
        else if(mapped === 'Camera fined') camera += 1;
      });
    }
    const data = [{k:'Police', v: police}, {k:'Camera', v: camera}].filter(d=>d.v>0);
    if(data.length===0){ container.append('div').attr('class','small-muted').text('No police/camera data for selection'); return; }
    const w = container.node().clientWidth || 220; const h = container.node().clientHeight || 180; const radius = Math.min(w,h)/2 - 8;
    const svg = container.append('svg').attr('width',w).attr('height',h); const g = svg.append('g').attr('transform',`translate(${w/2},${h/2})`);
    const pie = d3.pie().value(d=>d.v)(data);
    const arc = d3.arc().outerRadius(radius).innerRadius(radius*0.35);
    const color = d3.scaleOrdinal(['#4e79a7','#f28e2b']).domain(data.map(d=>d.k));
    g.selectAll('path').data(pie).enter().append('path').attr('d',arc).attr('fill',d=>color(d.data.k)).attr('stroke','#fff');
    g.selectAll('text').data(pie).enter().append('text').attr('transform',d=>`translate(${arc.centroid(d)})`).attr('text-anchor','middle').attr('font-size',10).attr('fill','#fff').text(d=>`${d.data.k} (${d.data.v.toLocaleString()})`);
  }

  function renderScatterFromRows(rows, xKey, yKey, colorKey){
    // render as a bubble chart (circles with variable radius) and hover tooltips
    const parsed = rows.map(r=>({x:+r[xKey], y:+r[yKey], c: mapDetectionLabel(r[colorKey]||'Unknown')})).filter(d=>!isNaN(d.x) && !isNaN(d.y));
    const container = d3.select('#scatter-canvas'); container.selectAll('*').remove();
    const w = container.node().clientWidth || 480; const h = container.node().clientHeight || 260; const margin={t:10,r:10,b:30,l:36}; const width=w-margin.l-margin.r; const height=h-margin.t-margin.b;
    const svg = container.append('svg').attr('width',w).attr('height',h); const g=svg.append('g').attr('transform',`translate(${margin.l},${margin.t})`);
    const x = d3.scaleLinear().domain(d3.extent(parsed,d=>d.x)).nice().range([0,width]);
    const y = d3.scaleLinear().domain(d3.extent(parsed,d=>d.y)).nice().range([height,0]);
    g.append('g').attr('transform',`translate(0,${height})`).call(d3.axisBottom(x)); g.append('g').call(d3.axisLeft(y));
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    // scale radius by y magnitude (or use constant if small)
    const rScale = d3.scaleSqrt().domain(d3.extent(parsed,d=>d.y)).range([3,12]);
    let tooltip = d3.select('body').select('.d3-tooltip'); if(tooltip.empty()) tooltip = d3.select('body').append('div').attr('class','d3-tooltip').style('display','none');
    g.selectAll('circle').data(parsed).enter().append('circle').attr('cx',d=>x(d.x)).attr('cy',d=>y(d.y)).attr('r',d=>rScale(d.y)).attr('fill',d=>color(d.c)).attr('opacity',0.9)
      .on('mouseover', (event,d)=>{ tooltip.style('display','block').html(`<strong>${d.c}</strong><br/>x: ${d.x}<br/>y: ${d.y}`); })
      .on('mousemove', (event)=>{ tooltip.style('left',(event.pageX+10)+'px').style('top',(event.pageY+10)+'px'); })
      .on('mouseout', ()=>{ tooltip.style('display','none'); });
  }

  // Render when we already have parsed {x,y,c} points (used for aggregated-detection datasets)
  function renderScatterFromParsed(parsed){
    const container = d3.select('#scatter-canvas'); container.selectAll('*').remove();
    const w = container.node().clientWidth || 480; const h = container.node().clientHeight || 260; const margin={t:10,r:10,b:30,l:36}; const width=w-margin.l-margin.r; const height=h-margin.t-margin.b;
    const svg = container.append('svg').attr('width',w).attr('height',h); const g=svg.append('g').attr('transform',`translate(${margin.l},${margin.t})`);
    const x = d3.scaleLinear().domain(d3.extent(parsed,d=>d.x)).nice().range([0,width]);
    const y = d3.scaleLinear().domain(d3.extent(parsed,d=>d.y)).nice().range([height,0]);
    g.append('g').attr('transform',`translate(0,${height})`).call(d3.axisBottom(x)); g.append('g').call(d3.axisLeft(y));
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    const rScale = d3.scaleSqrt().domain(d3.extent(parsed,d=>d.y)).range([3,12]);
    let tooltip = d3.select('body').select('.d3-tooltip'); if(tooltip.empty()) tooltip = d3.select('body').append('div').attr('class','d3-tooltip').style('display','none');
    g.selectAll('circle').data(parsed).enter().append('circle').attr('cx',d=>x(d.x)).attr('cy',d=>y(d.y)).attr('r',d=>rScale(d.y)).attr('fill',d=>color(d.c)).attr('opacity',0.9)
      .on('mouseover', (event,d)=>{ tooltip.style('display','block').html(`<strong>${d.c}</strong><br/>x: ${d.x}<br/>y: ${d.y}`); })
      .on('mousemove', (event)=>{ tooltip.style('left',(event.pageX+10)+'px').style('top',(event.pageY+10)+'px'); })
      .on('mouseout', ()=>{ tooltip.style('display','none'); });
  }

  // Main: attempt to load workbook/csv, otherwise fallback to demo
  const wb = await loadWorkbook(dataPath);
  if(wb && wb.rows && wb.rows.length){
    wbRows = wb.rows;
    detectedKeys = detectKeys(wbRows);
    // derive detection values and populate selects (use derived values regardless of detected catKey)
    deriveDetectionForRows();
    populateSelects(detectedKeys && (detectedKeys.catKey || detectedKeys.keys && detectedKeys.keys[0]));

    // wire selects to filter and redraw
    const sel = document.getElementById('detection-select');
    const pieSel = document.getElementById('pie-detection-select');
    const sel2 = document.getElementById('m2');
      // ensure main detection selection is set as current detection filter
      if(sel && sel.options && sel.options.length>0){ sel.selectedIndex = 0; currentDetectionFilter = sel.value; }
      // sel2 default was set in populateSelects (likely to 'All') and stored in currentScatterDetection
      // ensure change handlers update filters correctly: sel => global filter, pieSel => pie-only filter, sel2 => scatter-only filter
      if(sel) sel.addEventListener('change', (e)=>{ currentDetectionFilter = e.target.value; applyFilterAndRender(e.target.value); });
      if(pieSel) pieSel.addEventListener('change', (e)=>{ currentPieDetection = e.target.value; applyFilterAndRender(currentDetectionFilter); });
      if(sel2) sel2.addEventListener('change', (e)=>{ currentScatterDetection = e.target.value; applyFilterAndRender(currentDetectionFilter); });

    // initial draw (use default selected detection/year)
    applyFilterAndRender(currentDetectionFilter || 'All');
  } else {
    // fallback to previous demo visuals if no workbook
    console.warn('Workbook not found or empty; drawing demo charts');
    // reuse old demo draws
    // Line demo
    const years = d3.range(2008,2025);
    const seriesA = years.map((y,i)=>({year:y,value: Math.round(20000 + 4000*Math.sin(i/2) + i*200)}));
    const seriesB = years.map((y,i)=>({year:y,value: Math.round(12000 + 2000*Math.cos(i/3) + i*50)}));
    // drawLine demo
    (function drawLine(){
      const container = d3.select('#line-canvas'); container.selectAll('*').remove();
      const w = container.node().clientWidth; const h = container.node().clientHeight; const margin = {t:10,r:10,b:30,l:40}; const width = w-margin.l-margin.r; const height = h-margin.t-margin.b;
      const svg = container.append('svg').attr('width',w).attr('height',h); const g = svg.append('g').attr('transform',`translate(${margin.l},${margin.t})`);
      const x = d3.scaleLinear().domain(d3.extent(years)).range([0,width]); const y = d3.scaleLinear().domain([0,d3.max(seriesA.concat(seriesB),d=>d.value)]).nice().range([height,0]);
      g.append('g').attr('transform',`translate(0,${height})`).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d'))); g.append('g').call(d3.axisLeft(y).ticks(4));
      const line = d3.line().x(d=>x(d.year)).y(d=>y(d.value)); g.append('path').datum(seriesB).attr('d',line).attr('stroke','#0fb6a6').attr('fill','none').attr('stroke-width',3);
      g.append('path').datum(seriesA.slice(-6)).attr('d',line).attr('stroke','#13294b').attr('fill','none').attr('stroke-width',3);
    })();
    // pie demo
    (function drawPie(){ const data=[{k:'A',v:45},{k:'B',v:30},{k:'C',v:15},{k:'D',v:10}]; const container=d3.select('#pie-canvas'); container.selectAll('*').remove(); const w=container.node().clientWidth; const h=container.node().clientHeight; const radius=Math.min(w,h)/2-6; const svg=container.append('svg').attr('width',w).attr('height',h); const g=svg.append('g').attr('transform',`translate(${w/2},${h/2})`); const pie=d3.pie().value(d=>d.v)(data); const arc=d3.arc().outerRadius(radius).innerRadius(0); const color=d3.scaleOrdinal(['#f28b82','#f9a89b','#ff6f61','#6b5b95']); g.selectAll('path').data(pie).enter().append('path').attr('d',arc).attr('fill',d=>color(d.data.k)).attr('stroke','#fff'); })();
    // scatter demo
    (function drawScatter(){ const points=d3.range(60).map(i=>({x: Math.random()*10+Math.random()*i/6, y: Math.random()*100 + i*2, c: Math.floor(Math.random()*6)})); const container=d3.select('#scatter-canvas'); container.selectAll('*').remove(); const w=container.node().clientWidth; const h=container.node().clientHeight; const margin={t:10,r:10,b:30,l:30}; const width=w-margin.l-margin.r; const height=h-margin.t-margin.b; const svg=container.append('svg').attr('width',w).attr('height',h); const g=svg.append('g').attr('transform',`translate(${margin.l},${margin.t})`); const x=d3.scaleLinear().domain([0,d3.max(points,d=>d.x)]).range([0,width]); const y=d3.scaleLinear().domain([0,d3.max(points,d=>d.y)]).range([height,0]); g.append('g').attr('transform',`translate(0,${height})`).call(d3.axisBottom(x)); g.append('g').call(d3.axisLeft(y)); const color=d3.scaleOrdinal(d3.schemeCategory10); let tooltip = d3.select('body').select('.d3-tooltip'); if(tooltip.empty()) tooltip = d3.select('body').append('div').attr('class','d3-tooltip').style('display','none'); g.selectAll('circle').data(points).enter().append('circle').attr('cx',d=>x(d.x)).attr('cy',d=>y(d.y)).attr('r',4).attr('fill',d=>color(d.c)).attr('opacity',0.9)
      .on('mouseover',(event,d)=>{ tooltip.style('display','block').html(`<strong>${d.c}</strong><br/>x:${d.x.toFixed(2)}<br/>y:${d.y.toFixed(1)}`); })
      .on('mousemove',(event)=>{ tooltip.style('left',(event.pageX+10)+'px').style('top',(event.pageY+10)+'px'); })
      .on('mouseout',()=>{ tooltip.style('display','none'); }); })();
  }

  // redraw on resize
  window.addEventListener('resize', ()=>{
    if(!document.querySelector('#line-canvas')) return;
    if(wbRows && wbRows.length && detectedKeys){
      applyFilterAndRender(currentFilter);
    } else {
      // demo fallback: reload to redraw simple demos
      window.location.reload();
    }
  });

})();