/* Health Radar v1.7.2 — Clean Mobile Chart: no bottom labels */
(function(){
  let cleanChart = null;

  function isMobile(){
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function state(){
    return window.state || {};
  }

  function avg(a){
    const n = a.map(Number).filter(Number.isFinite);
    return n.length ? n.reduce((x,y)=>x+y,0)/n.length : null;
  }

  function fromDays(days){
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  }

  function fullDate(t){
    const d = new Date(t);
    if(isNaN(d)) return String(t || '');
    return new Intl.DateTimeFormat('uk-UA',{
      day:'2-digit',month:'2-digit',year:'2-digit',
      hour:'2-digit',minute:'2-digit'
    }).format(d);
  }

  function nearestWeather(t, weather){
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

  function stats(canvas, bps, wf){
    let box = document.getElementById('hrCleanChartStats');
    if(!box){
      box = document.createElement('div');
      box.id = 'hrCleanChartStats';
      box.className = 'hr-clean-chart-stats';
      canvas.insertAdjacentElement('afterend', box);
    }

    const sys = avg(bps.map(x=>x.sys));
    const dia = avg(bps.map(x=>x.dia));
    const pulse = avg(bps.map(x=>x.pulse));
    const atm = avg(wf.map(x=>x?.pressure).filter(v=>v != null));

    box.innerHTML = `
      <div class="hr-clean-stat"><b style="color:#38a8ff">${sys ? Math.round(sys) : '—'}</b><span>верхній</span></div>
      <div class="hr-clean-stat"><b style="color:#ff5f91">${dia ? Math.round(dia) : '—'}</b><span>нижній</span></div>
      <div class="hr-clean-stat"><b style="color:#ff9a34">${pulse ? Math.round(pulse) : '—'}</b><span>пульс</span></div>
      <div class="hr-clean-stat"><b style="color:#ffd84d">${atm ? atm.toFixed(0) : '—'}</b><span>атм.</span></div>
    `;
  }

  function renderCleanChart(){
    if(!isMobile() || !window.Chart) return false;

    const canvas = document.getElementById('mainChart');
    if(!canvas) return false;

    if(window.chart && window.chart !== cleanChart){
      try{ window.chart.destroy(); }catch(e){}
      window.chart = null;
    }
    if(cleanChart){
      try{ cleanChart.destroy(); }catch(e){}
      cleanChart = null;
    }

    const s = state();
    const days = +(document.getElementById('chartRange')?.value || 7);
    const from = days > 1000 ? new Date(0) : fromDays(days);

    const bps = (Array.isArray(s.bp) ? s.bp : [])
      .filter(x => x && x.time && new Date(x.time) >= from)
      .sort((a,b)=>new Date(a.time)-new Date(b.time));

    const weather = Array.isArray(s.weather) ? s.weather : [];
    const wf = bps.map(b => nearestWeather(b.time, weather));
    const labels = bps.map(b => b.time);

    if(!bps.length){
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width,canvas.height);
      stats(canvas, [], []);
      return true;
    }

    const vals = [
      ...bps.map(x=>+x.sys),
      ...bps.map(x=>+x.dia),
      ...bps.map(x=>+x.pulse),
      ...wf.map(w=>w ? +w.pressure/10 : null).filter(Number.isFinite)
    ].filter(Number.isFinite);

    let min = Math.floor((Math.min(...vals) - 6) / 10) * 10;
    let max = Math.ceil((Math.max(...vals) + 6) / 10) * 10;
    min = Math.max(50, min);
    max = Math.min(210, max);
    if(max - min < 55){ min -= 10; max += 10; }

    cleanChart = new Chart(canvas, {
      type:'line',
      data:{
        labels,
        datasets:[
          {label:'Верхній', data:bps.map(x=>+x.sys), borderColor:'#38a8ff', backgroundColor:'rgba(56,168,255,.15)', pointBackgroundColor:'#38a8ff', pointBorderColor:'#d6f1ff', borderWidth:4, radius:4, hoverRadius:8, hitRadius:24, tension:.35},
          {label:'Нижній', data:bps.map(x=>+x.dia), borderColor:'#ff5f91', backgroundColor:'rgba(255,95,145,.14)', pointBackgroundColor:'#ff5f91', pointBorderColor:'#ffd5e2', borderWidth:3, radius:3.5, hoverRadius:8, hitRadius:24, tension:.35},
          {label:'Пульс', data:bps.map(x=>+x.pulse), borderColor:'#ff9a34', backgroundColor:'rgba(255,154,52,.13)', pointBackgroundColor:'#ff9a34', pointBorderColor:'#ffdaba', borderWidth:3, radius:3.5, hoverRadius:8, hitRadius:24, tension:.35},
          {label:'Атм. тиск /10', data:wf.map(w=>w ? +w.pressure/10 : null), borderColor:'#ffd84d', backgroundColor:'rgba(255,216,77,.13)', pointBackgroundColor:'#ffd84d', pointBorderColor:'#fff3b6', borderWidth:3, radius:3, hoverRadius:8, hitRadius:24, tension:.2}
        ]
      },
      options:{
        responsive:true,
        maintainAspectRatio:false,
        animation:false,
        interaction:{mode:'index', intersect:false},
        layout:{padding:{top:0,right:4,bottom:0,left:0}},
        plugins:{
          legend:{
            position:'top',
            labels:{
              color:'#dbe9ff',
              usePointStyle:true,
              pointStyle:'circle',
              boxWidth:8,
              boxHeight:8,
              padding:8,
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
              title(items){
                const i = items?.[0]?.dataIndex;
                return i != null ? fullDate(labels[i]) : '';
              },
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
            grid:{display:false},
            ticks:{display:false}
          },
          y:{
            min,
            max,
            grid:{color:'rgba(255,255,255,.08)'},
            ticks:{color:'#9fb1c9', maxTicksLimit:4, font:{size:10}}
          }
        }
      }
    });

    window.chart = cleanChart;
    stats(canvas, bps, wf);

    let hint = document.getElementById('hrCleanChartHint');
    if(!hint){
      hint = document.createElement('div');
      hint.id = 'hrCleanChartHint';
      hint.className = 'hr-clean-chart-hint';
      hint.textContent = 'Натисніть на точку графіка — покажу дату, час і точні значення.';
      canvas.insertAdjacentElement('beforebegin', hint);
    }

    return true;
  }

  window.renderChart = function(){
    if(isMobile()) return renderCleanChart();
  };

  const oldRenderAll = window.renderAll;
  if(typeof oldRenderAll === 'function'){
    window.renderAll = function(){
      oldRenderAll.apply(this, arguments);
      if(isMobile()) setTimeout(renderCleanChart, 30);
    };
  }

  window.HR_CLEAN_MOBILE_CHART = renderCleanChart;

  window.addEventListener('load', ()=>{
    setTimeout(renderCleanChart, 100);
    setTimeout(renderCleanChart, 500);
    setTimeout(renderCleanChart, 1500);
    setTimeout(renderCleanChart, 3000);
  });

  window.addEventListener('resize', ()=>setTimeout(renderCleanChart, 150));
})();
