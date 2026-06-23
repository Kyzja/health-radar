/* Health Radar v1.7.1 — FORCE mobile chart, no old labels */
(function(){
  let mobileChart = null;

  function isMobile(){
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function getS(){
    return window.state || {};
  }

  function avg(arr){
    const nums = arr.map(Number).filter(Number.isFinite);
    return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null;
  }

  function daysAgo(n){
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  function fmtShort(t){
    const d = new Date(t);
    if(isNaN(d)) return '';
    return new Intl.DateTimeFormat('uk-UA',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d).replace(', ','\n');
  }

  function fmtFull(t){
    const d = new Date(t);
    if(isNaN(d)) return String(t||'');
    return new Intl.DateTimeFormat('uk-UA',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}).format(d);
  }

  function nearestWeather(t, weather){
    let best=null, diff=Infinity;
    const target = new Date(t);
    (weather||[]).forEach(w=>{
      if(!w?.time) return;
      const d = Math.abs(new Date(w.time)-target);
      if(d < diff && d < 2.5*3600000){ diff=d; best=w; }
    });
    return best;
  }

  function summary(canvas, bps, wf){
    let box = document.getElementById('hrChartSummary');
    if(!box){
      box = document.createElement('div');
      box.id='hrChartSummary';
      box.className='hr-chart-summary';
      canvas.insertAdjacentElement('afterend', box);
    }

    const sys=avg(bps.map(x=>x.sys));
    const dia=avg(bps.map(x=>x.dia));
    const pulse=avg(bps.map(x=>x.pulse));
    const atm=avg(wf.map(x=>x?.pressure).filter(v=>v!=null));

    box.innerHTML = `
      <div class="hr-chart-mini"><div class="label">🔵 Верхній АТ</div><div class="value">${sys?Math.round(sys):'—'}</div><div class="unit">мм рт.ст.</div></div>
      <div class="hr-chart-mini"><div class="label">🔴 Нижній АТ</div><div class="value">${dia?Math.round(dia):'—'}</div><div class="unit">мм рт.ст.</div></div>
      <div class="hr-chart-mini"><div class="label">🟠 Пульс</div><div class="value">${pulse?Math.round(pulse):'—'}</div><div class="unit">уд/хв</div></div>
      <div class="hr-chart-mini"><div class="label">🟡 Атм. тиск</div><div class="value">${atm?atm.toFixed(1):'—'}</div><div class="unit">гПа</div></div>
    `;
  }

  function forceMobileChart(){
    if(!isMobile() || !window.Chart) return false;

    const canvas = document.getElementById('mainChart');
    if(!canvas) return false;

    const s = getS();
    const range = +(document.getElementById('chartRange')?.value || 7);
    const from = range > 1000 ? new Date(0) : daysAgo(range);

    const bp = (Array.isArray(s.bp) ? s.bp : [])
      .filter(x=>x?.time && new Date(x.time) >= from)
      .sort((a,b)=>new Date(a.time)-new Date(b.time));

    const weather = Array.isArray(s.weather) ? s.weather : [];
    const wf = bp.map(b=>nearestWeather(b.time, weather));

    if(window.chart && window.chart !== mobileChart){
      try{ window.chart.destroy(); }catch(e){}
      window.chart = null;
    }

    if(mobileChart){
      try{ mobileChart.destroy(); }catch(e){}
      mobileChart = null;
    }

    const labels = bp.map(x=>x.time);

    if(!bp.length){
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      summary(canvas, [], []);
      return true;
    }

    const values = [
      ...bp.map(x=>+x.sys),
      ...bp.map(x=>+x.dia),
      ...bp.map(x=>+x.pulse),
      ...wf.map(w=>w ? +w.pressure/10 : null).filter(Number.isFinite)
    ].filter(Number.isFinite);

    let min = Math.floor((Math.min(...values)-8)/10)*10;
    let max = Math.ceil((Math.max(...values)+8)/10)*10;
    min = Math.max(50, min);
    max = Math.min(210, max);
    if(max-min < 60){ min-=15; max+=15; }

    const step = Math.max(1, Math.ceil(labels.length / 4));

    mobileChart = new Chart(canvas, {
      type:'line',
      data:{
        labels,
        datasets:[
          {label:'Верхній', data:bp.map(x=>+x.sys), borderColor:'#38a8ff', backgroundColor:'rgba(56,168,255,.18)', pointBackgroundColor:'#38a8ff', pointBorderColor:'#bfe8ff', borderWidth:4, radius:4, hoverRadius:8, hitRadius:22, tension:.35},
          {label:'Нижній', data:bp.map(x=>+x.dia), borderColor:'#ff5f91', backgroundColor:'rgba(255,95,145,.16)', pointBackgroundColor:'#ff5f91', pointBorderColor:'#ffd0dd', borderWidth:3, radius:4, hoverRadius:8, hitRadius:22, tension:.35},
          {label:'Пульс', data:bp.map(x=>+x.pulse), borderColor:'#ff9a34', backgroundColor:'rgba(255,154,52,.15)', pointBackgroundColor:'#ff9a34', pointBorderColor:'#ffd6ad', borderWidth:3, radius:4, hoverRadius:8, hitRadius:22, tension:.35},
          {label:'Атм. тиск /10', data:wf.map(w=>w?+w.pressure/10:null), borderColor:'#ffd84d', backgroundColor:'rgba(255,216,77,.15)', pointBackgroundColor:'#ffd84d', pointBorderColor:'#fff0a6', borderWidth:3, radius:3, hoverRadius:8, hitRadius:22, tension:.2}
        ]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        animation:false,
        interaction:{mode:'index', intersect:false},
        layout:{padding:{top:2,right:6,bottom:0,left:0}},
        plugins:{
          legend:{
            position:'top',
            labels:{
              color:'#dbe9ff',
              usePointStyle:true,
              pointStyle:'circle',
              boxWidth:10,
              boxHeight:10,
              padding:10,
              font:{size:11, weight:'600'}
            }
          },
          tooltip:{
            enabled:true,
            mode:'index',
            intersect:false,
            backgroundColor:'rgba(17,28,49,.98)',
            borderColor:'rgba(255,255,255,.18)',
            borderWidth:1,
            titleColor:'#fff',
            bodyColor:'#eef5ff',
            titleFont:{size:13, weight:'bold'},
            bodyFont:{size:13},
            padding:12,
            callbacks:{
              title(items){ return items?.[0] ? fmtFull(labels[items[0].dataIndex]) : ''; },
              label(ctx){
                const n = ctx.dataset.label || '';
                const v = ctx.parsed.y;
                if(v == null) return '';
                if(n.includes('Атм')) return `Атм. тиск: ${(v*10).toFixed(1)} гПа`;
                if(n.includes('Пульс')) return `Пульс: ${Math.round(v)} уд/хв`;
                return `${n} АТ: ${Math.round(v)} мм рт.ст.`;
              }
            }
          }
        },
        scales:{
          x:{
            grid:{color:'rgba(255,255,255,.055)', drawTicks:false},
            ticks:{
              color:'#9fb1c9',
              maxRotation:0,
              minRotation:0,
              font:{size:10},
              autoSkip:false,
              callback(value, idx){
                if(idx===0 || idx===labels.length-1 || idx%step===0){
                  return fmtShort(labels[idx]).split('\n');
                }
                return '';
              }
            }
          },
          y:{
            min:min,
            max:max,
            grid:{color:'rgba(255,255,255,.08)'},
            ticks:{color:'#9fb1c9', maxTicksLimit:5, font:{size:11}}
          }
        }
      }
    });

    window.chart = mobileChart;
    summary(canvas, bp, wf);

    let hint = document.getElementById('hrChartHint');
    if(!hint){
      hint = document.createElement('div');
      hint.id='hrChartHint';
      hint.className='hr-chart-hint';
      hint.textContent='Натисніть на точку — покажу дату, час і всі значення.';
      canvas.insertAdjacentElement('beforebegin', hint);
    }

    return true;
  }

  // Override old renderer after all old scripts
  window.renderChart = function(){
    if(isMobile()) return forceMobileChart();
    if(window.HR_ORIGINAL_DESKTOP_RENDER_CHART) return window.HR_ORIGINAL_DESKTOP_RENDER_CHART();
  };

  // save original desktop if available from previous closure not accessible, so fallback reload original from old app impossible;
  // on desktop old chart usually was already rendered before this file. Mobile is priority.

  const oldRenderAll = window.renderAll;
  if(typeof oldRenderAll === 'function'){
    window.renderAll = function(){
      oldRenderAll.apply(this, arguments);
      if(isMobile()) setTimeout(forceMobileChart, 50);
    };
  }

  window.HR_FORCE_MOBILE_CHART = forceMobileChart;

  window.addEventListener('load', ()=>{
    setTimeout(forceMobileChart, 100);
    setTimeout(forceMobileChart, 500);
    setTimeout(forceMobileChart, 1500);
  });

  window.addEventListener('resize', ()=>setTimeout(forceMobileChart, 150));
})();
