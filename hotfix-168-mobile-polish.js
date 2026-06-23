/* Health Radar v1.6.8 Mobile Polish JS */
(function(){
  function isMobile(){ return matchMedia('(max-width: 900px)').matches; }

  function tidyMobile(){
    if(!isMobile()) return;

    // active bottom tab follows active normal tab
    const active = document.querySelector('.tab.active')?.dataset?.tab;
    document.querySelectorAll('#mobileBottomNav [data-tab-jump]').forEach(b=>{
      b.classList.toggle('active', b.dataset.tabJump === active);
    });

    // make wide card-head buttons not overflow
    document.querySelectorAll('.card-head button').forEach(b=>{
      b.style.maxWidth = '100%';
    });

    // mark neuro recent cards if current generated HTML doesn't have class
    document.querySelectorAll('#neuroRecentList .list-item, #neuroRecent .list-item').forEach(el=>{
      el.classList.add('neuro-event-card');
    });

    // stop tables from forcing body width
    document.querySelectorAll('table').forEach(t=>{
      const parent = t.parentElement;
      if(parent && !parent.classList.contains('table-wrap') && parent.id !== 'weatherTable'){
        // leave if already in layout; css handles common cases
      }
    });
  }

  // Patch chart options on mobile for readable labels
  const oldRenderChart = window.renderChart;
  if(typeof oldRenderChart === 'function'){
    window.renderChart = function(){
      oldRenderChart.apply(this, arguments);
      try{
        if(window.chart && isMobile()){
          chart.options.maintainAspectRatio = false;
          chart.options.plugins.legend.labels.boxWidth = 28;
          chart.options.plugins.legend.labels.font = {size: 11};
          chart.options.scales.x.ticks.maxRotation = 45;
          chart.options.scales.x.ticks.minRotation = 35;
          chart.options.scales.x.ticks.autoSkip = true;
          chart.options.scales.x.ticks.maxTicksLimit = 5;
          chart.options.scales.y.ticks.maxTicksLimit = 5;
          chart.update();
        }
      }catch(e){}
      setTimeout(tidyMobile, 20);
    };
  }

  const oldSwitchTab = window.switchTab;
  if(typeof oldSwitchTab === 'function'){
    window.switchTab = function(tab){
      oldSwitchTab.apply(this, arguments);
      setTimeout(tidyMobile, 20);
      if(isMobile()) setTimeout(()=>scrollTo({top:0, behavior:'smooth'}), 30);
    };
  }

  window.addEventListener('load', ()=>{ tidyMobile(); setTimeout(tidyMobile,500); setTimeout(tidyMobile,1500); });
  window.addEventListener('resize', tidyMobile);
  document.addEventListener('click', ()=>setTimeout(tidyMobile,50));
})();
