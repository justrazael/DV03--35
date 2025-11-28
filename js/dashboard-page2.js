// Minimal demo charts to mimic the example dashboard using D3
/* Dashboard: read workbook and render charts from data if possible. */

(async function(){
  const excelPath = 'dataset/police_enforcement_2024_fines.xlsx';

  async function loadWorkbook(path){
    try{
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
      console.warn('Could not load workbook', err);
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
    return {keys, yearKey, numericKeys, catKey};
  }

  // Shared state for filtering and redraws
  let wbRows = null;
  let detectedKeys = null;
  let currentFilter = 'All';

  function populateSelects(catKey){
    if(!catKey || !wbRows) return;
    const sel = document.getElementById('detection-select');
    const sel2 = document.getElementById('m2');
    const values = Array.from(new Set(wbRows.map(r=>r[catKey]===null? 'Unknown': String(r[catKey])))).filter(v=>v!=='' && v!==null).sort();
    function fill(s){
      if(!s) return;
      // preserve 'All' as first option
      s.innerHTML = '';
      const optAll = document.createElement('option'); optAll.value = 'All'; optAll.textContent = 'All'; s.appendChild(optAll);
      values.forEach(v=>{ const o = document.createElement('option'); o.value = v; o.textContent = v; s.appendChild(o); });
    }
    fill(sel); fill(sel2);
  }

  function applyFilterAndRender(selected){
    currentFilter = selected || 'All';
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
  const filtered = (currentFilter === 'All' || !usedCatKey) ? rows : rows.filter(r=>String(r[usedCatKey]) === String(currentFilter));
    if(yearKey && numericKeys && numericKeys[0]) renderLineFromRows(filtered, yearKey, numericKeys[0]);
    if(usedCatKey) renderPieFromRows(filtered, usedCatKey, numericKeys && numericKeys[0]);
    if(numericKeys && numericKeys.length>=2) renderScatterFromRows(filtered, numericKeys[0], numericKeys[1], usedCatKey);
  }

  function renderLineFromRows(rows, yearKey, valueKey){
    const aggregated = Array.from(d3.rollup(rows, v=>d3.sum(v, d=>+d[valueKey]), d=>+d[yearKey])).map(([year, val])=>({year:+year, value: val})).sort((a,b)=>a.year-b.year);
    const container = d3.select('#line-canvas'); container.selectAll('*').remove();
    const w = container.node().clientWidth || 800; const h = container.node().clientHeight || 260;
    const margin = {t:10,r:10,b:30,l:50}; const width = w-margin.l-margin.r; const height = h-margin.t-margin.b;
    const svg = container.append('svg').attr('width',w).attr('height',h); const g = svg.append('g').attr('transform',`translate(${margin.l},${margin.t})`);
    const x = d3.scaleLinear().domain(d3.extent(aggregated,d=>d.year)).range([0,width]);
    const y = d3.scaleLinear().domain([0,d3.max(aggregated,d=>d.value)]).nice().range([height,0]);
    g.append('g').attr('transform',`translate(0,${height})`).call(d3.axisBottom(x).ticks(8).tickFormat(d3.format('d')));
    g.append('g').call(d3.axisLeft(y));
    const line = d3.line().x(d=>x(d.year)).y(d=>y(d.value));
    g.append('path').datum(aggregated).attr('d',line).attr('fill','none').attr('stroke','#ffffff').attr('stroke-width',2.5);
    g.selectAll('circle').data(aggregated).enter().append('circle').attr('cx',d=>x(d.year)).attr('cy',d=>y(d.value)).attr('r',3).attr('fill','#ffd966');
  }

  function renderPieFromRows(rows, catKey, valueKey){
    const agg = Array.from(d3.rollup(rows, v=> valueKey? d3.sum(v,d=>+d[valueKey]) : v.length, d=>d[catKey])).map(([k,v])=>({k:k||'Unknown',v}));
    const container = d3.select('#pie-canvas'); container.selectAll('*').remove();
    const w = container.node().clientWidth || 300; const h = container.node().clientHeight || 220; const radius = Math.min(w,h)/2 -8;
    const svg = container.append('svg').attr('width',w).attr('height',h); const g=svg.append('g').attr('transform',`translate(${w/2},${h/2})`);
    const pie = d3.pie().value(d=>d.v)(agg);
    const arc = d3.arc().outerRadius(radius).innerRadius(0);
    const color = d3.scaleOrdinal(d3.schemeCategory10).domain(agg.map(d=>d.k));
    g.selectAll('path').data(pie).enter().append('path').attr('d',arc).attr('fill',d=>color(d.data.k)).attr('stroke','#fff');
    g.selectAll('text').data(pie).enter().append('text').attr('transform',d=>`translate(${arc.centroid(d)})`).attr('text-anchor','middle').attr('font-size',10).attr('fill','#fff').text(d=>d.data.k);
  }

  function renderScatterFromRows(rows, xKey, yKey, colorKey){
    const parsed = rows.map(r=>({x:+r[xKey], y:+r[yKey], c: r[colorKey]||'x'})).filter(d=>!isNaN(d.x) && !isNaN(d.y));
    const container = d3.select('#scatter-canvas'); container.selectAll('*').remove();
    const w = container.node().clientWidth || 480; const h = container.node().clientHeight || 260; const margin={t:10,r:10,b:30,l:36}; const width=w-margin.l-margin.r; const height=h-margin.t-margin.b;
    const svg = container.append('svg').attr('width',w).attr('height',h); const g=svg.append('g').attr('transform',`translate(${margin.l},${margin.t})`);
    const x = d3.scaleLinear().domain(d3.extent(parsed,d=>d.x)).nice().range([0,width]);
    const y = d3.scaleLinear().domain(d3.extent(parsed,d=>d.y)).nice().range([height,0]);
    g.append('g').attr('transform',`translate(0,${height})`).call(d3.axisBottom(x)); g.append('g').call(d3.axisLeft(y));
    const color = d3.scaleOrdinal(d3.schemeCategory10);
    g.selectAll('circle').data(parsed).enter().append('circle').attr('cx',d=>x(d.x)).attr('cy',d=>y(d.y)).attr('r',3.5).attr('fill',d=>color(d.c)).attr('opacity',0.9);
  }

  // Main: attempt to load workbook, otherwise fallback to demo
  const wb = await loadWorkbook(excelPath);
  if(wb && wb.rows && wb.rows.length){
    wbRows = wb.rows;
    detectedKeys = detectKeys(wbRows);
    // populate selects with category values (if found)
    if(detectedKeys.catKey) populateSelects(detectedKeys.catKey);

    // wire selects to filter and redraw
    const sel = document.getElementById('detection-select');
    const sel2 = document.getElementById('m2');
    [sel, sel2].forEach(s=>{ if(s){ s.addEventListener('change', ()=> applyFilterAndRender(s.value)); }});

    // initial draw (All)
    applyFilterAndRender('All');
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
    (function drawScatter(){ const points=d3.range(60).map(i=>({x: Math.random()*10+Math.random()*i/6, y: Math.random()*100 + i*2, c: Math.floor(Math.random()*6)})); const container=d3.select('#scatter-canvas'); container.selectAll('*').remove(); const w=container.node().clientWidth; const h=container.node().clientHeight; const margin={t:10,r:10,b:30,l:30}; const width=w-margin.l-margin.r; const height=h-margin.t-margin.b; const svg=container.append('svg').attr('width',w).attr('height',h); const g=svg.append('g').attr('transform',`translate(${margin.l},${margin.t})`); const x=d3.scaleLinear().domain([0,d3.max(points,d=>d.x)]).range([0,width]); const y=d3.scaleLinear().domain([0,d3.max(points,d=>d.y)]).range([height,0]); g.append('g').attr('transform',`translate(0,${height})`).call(d3.axisBottom(x)); g.append('g').call(d3.axisLeft(y)); const color=d3.scaleOrdinal(d3.schemeCategory10); g.selectAll('circle').data(points).enter().append('circle').attr('cx',d=>x(d.x)).attr('cy',d=>y(d.y)).attr('r',4).attr('fill',d=>color(d.c)).attr('opacity',0.9); })();
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
