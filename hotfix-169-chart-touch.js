/* Health Radar v1.6.9 — one chart, labels on tap */
(function(){
  function isMobile(){
    return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  }

  function shortTimeLabel(value){
    const d = new Date(value);
    if(isNaN(d)) return String(value || '');
    return new Intl.DateTimeFormat('uk-UA', {
      day:'2-digit',
      month:'2-digit',
      hour:'2-digit',
      minute:'2-digit'
    }).format(d);
  }

  function applyChartTouchMode(){
    if(!isMobile()) return;
    if(!window.chart) return;

    const c = window.chart;

    c.options.maintainAspectRatio = false;
    c.options.responsive = true;

    c.options.interaction = {
      mode: 'nearest',
      intersect: false,
      axis: 'x'
    };

    c.options.elements = c.options.elements || {};
    c.options.elements.point = {
      radius: 3.5,
      hoverRadius: 8,
      hitRadius: 18
    };
    c.options.elements.line = {
      borderWidth: 3,
      tension: 0.35
    };

    c.options.plugins = c.options.plugins || {};
    c.options.plugins.legend = c.options.plugins.legend || {};
    c.options.plugins.legend.position = 'top';
    c.options.plugins.legend.labels = {
      color:'#dbe9ff',
      boxWidth:22,
      boxHeight:10,
      padding:10,
      font:{size:12}
    };

    c.options.plugins.tooltip = {
      enabled: true,
      mode: 'nearest',
      intersect: false,
      displayColors: true,
      titleFont:{size:14, weight:'bold'},
      bodyFont:{size:14},
      padding:12,
      callbacks:{
        title:function(items){
          const item = items && items[0];
          if(!item) return '';
          const rawLabel = c.data.labels?.[item.dataIndex];
          return shortTimeLabel(rawLabel);
        },
        label:function(ctx){
          const name = ctx.dataset?.label || '';
          const val = ctx.parsed?.y;
          if(val == null) return name;
          if(name.includes('Атм')) return `${name}: ${(val*10).toFixed(1)} гПа`;
          if(name.includes('Пульс')) return `${name}: ${Math.round(val)} уд/хв`;
          return `${name}: ${Math.round(val)} мм рт.ст.`;
        }
      }
    };

    c.options.scales = c.options.scales || {};
    c.options.scales.x = c.options.scales.x || {};
    c.options.scales.x.grid = {
      color:'rgba(255,255,255,.06)',
      drawTicks:false
    };
    c.options.scales.x.ticks = {
      display:false
    };

    c.options.scales.y = c.options.scales.y || {};
    c.options.scales.y.beginAtZero = false;
    c.options.scales.y.grid = {
      color:'rgba(255,255,255,.08)'
    };
    c.options.scales.y.ticks = {
      color:'#9fb1c9',
      maxTicksLimit:5,
      font:{size:11}
    };

    c.update('none');

    const canvas = document.getElementById('mainChart');
    if(canvas && !canvas.__tapHintAdded){
      canvas.__tapHintAdded = true;
      const note = document.createElement('span');
      note.className = 'chart-touch-note';
      note.textContent = 'Натисніть на точку графіка, щоб побачити дату, час і точне значення.';
      canvas.insertAdjacentElement('afterend', note);
    }
  }

  const oldRenderChart = window.renderChart;
  if(typeof oldRenderChart === 'function'){
    window.renderChart = function(){
      oldRenderChart.apply(this, arguments);
      setTimeout(applyChartTouchMode, 20);
      setTimeout(applyChartTouchMode, 200);
    };
  }

  window.addEventListener('load', ()=>{
    setTimeout(applyChartTouchMode, 300);
    setTimeout(applyChartTouchMode, 1200);
  });

  window.addEventListener('resize', ()=>setTimeout(applyChartTouchMode, 100));
})();
