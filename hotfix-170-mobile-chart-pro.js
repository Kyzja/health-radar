/* Health Radar v1.7.0 — Mobile Chart Pro */
(function(){
  let mobileChart = null;

  function isMobile(){
    return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  }

  function getState(){
    return window.state || {};
  }

  function avg(arr){
    const nums = arr.map(Number).filter(Number.isFinite);
    return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null;
  }

  function daysAgoLocal(n){
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
  }

  function formatTick(v){
    const d = new Date(v);
    if(isNaN(d)) return '';
    return new Intl.DateTimeFormat('uk-UA', {
      day:'2-digit',
      month:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    }).format(d).replace(', ', '\n');
  }

  function formatTooltip(v){
    const d = new Date(v);
    if(isNaN(d)) return String(v || '');
    return new Intl.DateTimeFormat('uk-UA', {
      day:'2-digit',
      month:'2-digit',
      year:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    }).format(d);
  }

  function nearestWeatherFor(t, weather){
    let best = null, diff = Infinity;
    const target = new Date(t);
    (weather || []).forEach(w=>{
      if(!w || !w.time) return;
      const d = Math.abs(new Date(w.time) - target);
      if(d < diff && d < 2.5 * 3600000){
        diff = d;
        best = w;
      }
    });
    return best;
  }

  function ensureSummaryBox(canvas){
    let box = document.getElementById('chartSummaryGrid');
    if(!box){
      box = document.createElement('div');
      box.id = 'chartSummaryGrid';
      box.className = 'chart-summary-grid';
      canvas.insertAdjacentElement('afterend', box);
    }
    return box;
  }

  function setChartCardClass(){
    const canvas = document.getElementById('mainChart');
    const card = canvas?.closest('.card');
    if(card) card.classList.add('mobile-chart-pro-card');
  }

  function renderSummary(bps, weatherForPoints){
    const canvas = document.getElementById('mainChart');
    if(!canvas) return;
    const box = ensureSummaryBox(canvas);

    const avgSys = avg(bps.map(x=>x.sys));
    const avgDia = avg(bps.map(x=>x.dia));
    const avgPulse = avg(bps.map(x=>x.pulse));
    const avgAtm = avg(weatherForPoints.map(x=>x?.pressure).filter(v=>v != null));

    const cards = [
      {label:'Верхній АТ', value:avgSys ? Math.round(avgSys) : '—', unit:'мм рт. ст. · середнє', color:'#3b9cff'},
      {label:'Нижній АТ', value:avgDia ? Math.round(avgDia) : '—', unit:'мм рт. ст. · середнє', color:'#ff5c93'},
      {label:'Пульс', value:avgPulse ? Math.round(avgPulse) : '—', unit:'уд/хв · середнє', color:'#ff9633'},
      {label:'Атм. тиск', value:avgAtm ? avgAtm.toFixed(1) : '—', unit:'гПа · середнє', color:'#ffd84d'}
    ];

    box.innerHTML = cards.map(c=>`
      <div class="chart-summary-card">
        <div class="chart-summary-label"><span class="chart-dot" style="background:${c.color}"></span>${c.label}</div>
        <div class="chart-summary-value">${c.value}</div>
        <div class="chart-summary-unit">${c.unit}</div>
      </div>
    `).join('');
  }

  function renderMobileChart(){
    const canvas = document.getElementById('mainChart');
    if(!canvas || !window.Chart) return false;

    const s = getState();
    const days = +(document.getElementById('chartRange')?.value || 7);
    const from = days > 1000 ? new Date(0) : daysAgoLocal(days);
    const bp = Array.isArray(s.bp) ? s.bp : [];
    const weather = Array.isArray(s.weather) ? s.weather : [];

    const bps = bp
      .filter(b => b && b.time && new Date(b.time) >= from)
      .sort((a,b)=>new Date(a.time)-new Date(b.time));

    if(!bps.length){
      if(mobileChart){ mobileChart.destroy(); mobileChart = null; }
      renderSummary([], []);
      return true;
    }

    setChartCardClass();

    const labels = bps.map(b => b.time);
    const weatherForPoints = bps.map(b => nearestWeatherFor(b.time, weather));

    const allValues = [
      ...bps.map(b=>+b.sys),
      ...bps.map(b=>+b.dia),
      ...bps.map(b=>+b.pulse),
      ...weatherForPoints.map(w=>w ? +w.pressure/10 : null).filter(Number.isFinite)
    ].filter(Number.isFinite);

    let yMin = Math.floor((Math.min(...allValues) - 8) / 10) * 10;
    let yMax = Math.ceil((Math.max(...allValues) + 8) / 10) * 10;
    yMin = Math.max(40, yMin);
    yMax = Math.min(220, yMax);
    if(yMax - yMin < 60){
      yMin -= 15;
      yMax += 15;
    }

    const data = {
      labels,
      datasets:[
        {
          label:'Верхній АТ',
          data:bps.map(b=>+b.sys),
          borderColor:'#3b9cff',
          backgroundColor:'rgba(59,156,255,.18)',
          pointBackgroundColor:'#3b9cff',
          pointBorderColor:'#9bd3ff',
          pointBorderWidth:2,
          borderWidth:4,
          tension:.38,
          radius:4,
          hoverRadius:8,
          hitRadius:20
        },
        {
          label:'Нижній АТ',
          data:bps.map(b=>+b.dia),
          borderColor:'#ff5c93',
          backgroundColor:'rgba(255,92,147,.16)',
          pointBackgroundColor:'#ff5c93',
          pointBorderColor:'#ffc0d5',
          pointBorderWidth:2,
          borderWidth:3,
          tension:.38,
          radius:4,
          hoverRadius:8,
          hitRadius:20
        },
        {
          label:'Пульс',
          data:bps.map(b=>+b.pulse),
          borderColor:'#ff9633',
          backgroundColor:'rgba(255,150,51,.15)',
          pointBackgroundColor:'#ff9633',
          pointBorderColor:'#ffd1a3',
          pointBorderWidth:2,
          borderWidth:3,
          tension:.38,
          radius:4,
          hoverRadius:8,
          hitRadius:20
        },
        {
          label:'Атм. тиск /10',
          data:weatherForPoints.map(w=>w ? +w.pressure/10 : null),
          borderColor:'#ffd84d',
          backgroundColor:'rgba(255,216,77,.16)',
          pointBackgroundColor:'#ffd84d',
          pointBorderColor:'#fff0a6',
          pointBorderWidth:2,
          borderWidth:3,
          tension:.25,
          radius:3,
          hoverRadius:8,
          hitRadius:20
        }
      ]
    };

    const tickStep = Math.max(1, Math.ceil(labels.length / 4));

    if(mobileChart) mobileChart.destroy();

    mobileChart = new Chart(canvas, {
      type:'line',
      data,
      options:{
        responsive:true,
        maintainAspectRatio:false,
        animation:false,
        layout:{padding:{top:4,right:6,bottom:0,left:2}},
        interaction:{mode:'index', intersect:false},
        elements:{
          line:{capBezierPoints:true},
          point:{radius:4, hoverRadius:8, hitRadius:20}
        },
        plugins:{
          legend:{
            position:'top',
            align:'center',
            labels:{
              color:'#dbe9ff',
              boxWidth:18,
              boxHeight:8,
              padding:10,
              usePointStyle:true,
              pointStyle:'circle',
              font:{size:11, weight:'600'}
            }
          },
          tooltip:{
            enabled:true,
            mode:'index',
            intersect:false,
            backgroundColor:'rgba(17,28,49,.96)',
            borderColor:'rgba(255,255,255,.18)',
            borderWidth:1,
            titleColor:'#fff',
            bodyColor:'#eef5ff',
            titleFont:{size:13, weight:'bold'},
            bodyFont:{size:13},
            padding:12,
            displayColors:true,
            callbacks:{
              title(items){
                const item = items && items[0];
                return item ? formatTooltip(labels[item.dataIndex]) : '';
              },
              label(ctx){
                const name = ctx.dataset.label || '';
                const v = ctx.parsed.y;
                if(v == null) return '';
                if(name.includes('Атм')) return `Атм. тиск: ${(v*10).toFixed(1)} гПа`;
                if(name.includes('Пульс')) return `Пульс: ${Math.round(v)} уд/хв`;
                return `${name}: ${Math.round(v)} мм рт. ст.`;
              }
            }
          }
        },
        scales:{
          x:{
            grid:{color:'rgba(255,255,255,.055)', drawTicks:false},
            ticks:{
              color:'#9fb1c9',
              autoSkip:false,
              maxRotation:0,
              minRotation:0,
              font:{size:10},
              callback:function(value, index){
                if(index === 0 || index === labels.length-1 || index % tickStep === 0){
                  return formatTick(labels[index]).split('\n');
                }
                return '';
              }
            }
          },
          y:{
            min:yMin,
            max:yMax,
            grid:{color:'rgba(255,255,255,.08)'},
            ticks:{
              color:'#9fb1c9',
              maxTicksLimit:5,
              font:{size:11}
            }
          }
        }
      }
    });

    window.HR_MOBILE_CHART = mobileChart;
    renderSummary(bps, weatherForPoints);
    return true;
  }

  const oldRenderChart = window.renderChart;
  window.renderChart = function(){
    if(isMobile()){
      return renderMobileChart();
    }
    if(typeof oldRenderChart === 'function') return oldRenderChart.apply(this, arguments);
  };

  window.addEventListener('load', ()=>{
    setTimeout(()=>{ if(isMobile()) renderMobileChart(); }, 300);
    setTimeout(()=>{ if(isMobile()) renderMobileChart(); }, 1200);
  });

  window.addEventListener('resize', ()=>{
    setTimeout(()=>{ if(isMobile()) renderMobileChart(); }, 150);
  });
})();
