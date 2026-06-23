/* Health Radar v1.6.7 Mobile Adaptive JS */
(function(){
  function isMobile(){
    return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  }

  function tab(tabName){
    if(typeof switchTab === 'function'){
      switchTab(tabName);
    }else{
      document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tabName));
      document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
      document.getElementById('tab-'+tabName)?.classList.add('active');
    }
    updateBottomActive(tabName);
    setTimeout(()=>window.scrollTo({top:0,behavior:'smooth'}), 30);
  }

  function updateBottomActive(tabName){
    document.querySelectorAll('#mobileBottomNav [data-tab-jump]').forEach(b=>{
      b.classList.toggle('active', b.dataset.tabJump === tabName);
    });
  }

  window.HR_MOBILE_TAB = function(tabName){
    HR_MOBILE_CLOSE_MORE();
    tab(tabName);
  };

  window.HR_MOBILE_OPEN = function(modalId){
    HR_MOBILE_CLOSE_MORE();
    if(typeof openModal === 'function') openModal(modalId);
    else document.getElementById(modalId)?.classList.add('show');
  };

  window.HR_MOBILE_OPEN_CLOUD = function(){
    HR_MOBILE_CLOSE_MORE();
    if(typeof openCloudPanel === 'function') openCloudPanel();
    else if(typeof openModal === 'function') openModal('cloudModal');
  };

  window.HR_MOBILE_CLOSE_MORE = function(){
    document.getElementById('mobileMoreSheet')?.classList.remove('show');
  };

  window.HR_MOBILE_OPEN_MORE = function(){
    document.getElementById('mobileMoreSheet')?.classList.add('show');
  };

  function bindMobile(){
    document.querySelectorAll('#mobileBottomNav [data-tab-jump]').forEach(btn=>{
      btn.onclick = () => tab(btn.dataset.tabJump);
    });

    const more = document.querySelector('#mobileBottomNav [data-open-more]');
    if(more) more.onclick = HR_MOBILE_OPEN_MORE;

    const sheet = document.getElementById('mobileMoreSheet');
    if(sheet && !sheet.__bound){
      sheet.__bound = true;
      sheet.addEventListener('click', e=>{
        if(e.target === sheet) HR_MOBILE_CLOSE_MORE();
      });
    }

    // Keep bottom nav state synced with normal tabs
    document.querySelectorAll('.tab').forEach(b=>{
      if(!b.__mobileBound){
        b.__mobileBound = true;
        b.addEventListener('click', ()=>updateBottomActive(b.dataset.tab));
      }
    });

    const active = document.querySelector('.tab.active')?.dataset?.tab || 'main';
    updateBottomActive(active);
  }

  // Improve mobile quick modal: when opened by top button, show choices and keep form hidden until item picked
  const oldOpenModal = window.openModal;
  window.openModal = function(id){
    if(typeof oldOpenModal === 'function') oldOpenModal(id);
    else document.getElementById(id)?.classList.add('show');

    if(id === 'quickModal' && isMobile()){
      const form = document.getElementById('quickForm');
      if(form && !document.getElementById('quickType')?.value) form.classList.add('hidden');
    }

    if(isMobile()){
      setTimeout(()=>document.getElementById(id)?.querySelector('input,textarea,select,button')?.focus?.(), 80);
    }
  };

  // Make ESC / Android hardware-like close useful
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape'){
      HR_MOBILE_CLOSE_MORE();
    }
  });

  window.addEventListener('load', bindMobile);
  window.addEventListener('resize', bindMobile);
  setTimeout(bindMobile, 300);
  setTimeout(bindMobile, 1200);
})();
