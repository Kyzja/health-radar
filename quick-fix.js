/* Health Radar v1.5.4 DIRECT QUICK FIX */
(function(){
  const CFG = {
    stress: {title:'😡 Стрес', hint:'Рівень стресу 0–10', unit:'рівень', def:1, btn:[0,1,2,3,4,5,6,7,8,9,10]},
    coffee: {title:'☕ Кава', hint:'Скільки чашок кави сьогодні?', unit:'чашок', def:1, btn:[1,2,3,4,5]},
    alcohol: {title:'🍺 Алкоголь', hint:'Кількість порцій алкоголю', unit:'порцій', def:1, btn:[0,1,2,3,4,5], extra:`<label>Тип алкоголю<select id="quickExtra"><option value="">не вказано</option><option value="пиво">🍺 Пиво</option><option value="вино">🍷 Вино</option><option value="міцний">🥃 Міцний</option></select></label>`},
    activity: {title:'🏃 Навантаження', hint:'Тип і тривалість навантаження', unit:'хв', def:30, btn:[10,20,30,45,60,90,120], extra:`<label>Тип активності<select id="quickExtra"><option value="ходьба">🚶 Ходьба</option><option value="біг">🏃 Біг</option><option value="тренування">💪 Тренування</option><option value="робота">🛠 Робота/навантаження</option></select></label>`},
    sleep: {title:'😴 Сон', hint:'Години сну та якість', unit:'год', def:7, btn:[4,5,6,7,8,9,10], extra:`<label>Якість сну<select id="quickExtra"><option value="1">1 — дуже погано</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5" selected>5 — нормально</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10 — добре</option></select></label>`},
    headache: {title:'🤕 Головний біль', hint:'Оцініть біль 0–10', unit:'рівень', def:1, btn:[0,1,2,3,4,5,6,7,8,9,10]},
    tinnitus: {title:'👂 Шум у вухах', hint:'Оцініть шум 0–10', unit:'рівень', def:1, btn:[0,1,2,3,4,5,6,7,8,9,10]},
    dizziness: {title:'😵 Запаморочення', hint:'Оцініть запаморочення 0–10', unit:'рівень', def:1, btn:[0,1,2,3,4,5,6,7,8,9,10]},
    fatigue: {title:'😴 Втома', hint:'Оцініть втому 0–10', unit:'рівень', def:1, btn:[0,1,2,3,4,5,6,7,8,9,10]}
  };

  function showModal(id){
    const m = document.getElementById(id);
    if(!m) return false;
    m.classList.add('show');
    m.style.display = 'flex';
    return true;
  }

  function hideModal(id){
    const m = document.getElementById(id);
    if(!m) return;
    m.classList.remove('show');
    m.style.display = '';
  }

  function localInput(d=new Date()){
    if (typeof nowLocalInput === 'function') return nowLocalInput(d);
    const z = new Date(d.getTime() - d.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,16);
  }

  function makeId(){
    if (typeof uid === 'function') return uid();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function esc(s=''){
    if (typeof escapeHtml === 'function') return escapeHtml(s);
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function renderFields(type, value, extraValue=''){
    const cfg = CFG[type] || CFG.stress;
    const box = document.getElementById('quickDynamicFields');
    if(!box) return;

    const buttons = (cfg.btn || []).map(v =>
      `<button type="button" class="${Number(v)===Number(value)?'active':''}" onclick="HR_SET_QUICK_VALUE(${v})">${v}</button>`
    ).join('');

    box.innerHTML = `
      <label>Значення (${cfg.unit})
        <input type="number" step="0.1" id="quickValue" value="${value}">
      </label>
      <div class="quick-options">${buttons}</div>
      <div class="quick-fields-grid">${cfg.extra || ''}</div>
    `;

    const extra = document.getElementById('quickExtra');
    if(extra && extraValue) extra.value = extraValue;
  }

  window.HR_SET_QUICK_VALUE = function(v){
    const input = document.getElementById('quickValue');
    if(input) input.value = v;
    document.querySelectorAll('.quick-options button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.quick-options button').forEach(b => {
      if(String(b.textContent).trim() === String(v)) b.classList.add('active');
    });
  };

  window.HR_HIDE_QUICK_FORM = function(){
    const f = document.getElementById('quickForm');
    if(f) f.classList.add('hidden');
  };

  window.HR_FORCE_QUICK = function(type, existingId){
    if(type === 'bp' || type === 'pressure'){
      hideModal('quickModal');
      if(typeof openBPModal === 'function') openBPModal();
      return;
    }

    const cfg = CFG[type] || CFG.stress;
    const existing = existingId && window.state?.events ? window.state.events.find(x=>x.id===existingId) : null;

    showModal('quickModal');

    const form = document.getElementById('quickForm');
    if(!form){
      alert('Помилка: не знайдено форму quickForm.');
      return;
    }
    form.classList.remove('hidden');

    document.getElementById('quickId').value = existing?.id || '';
    document.getElementById('quickType').value = type;
    document.getElementById('quickDateTime').value = existing?.time ? localInput(new Date(existing.time)) : localInput();
    document.getElementById('quickNote').value = existing?.note || '';

    const title = document.getElementById('quickFormTitle');
    const hint = document.getElementById('quickFormHint');
    if(title) title.textContent = cfg.title;
    if(hint) hint.textContent = cfg.hint;

    renderFields(type, existing?.value ?? cfg.def, existing?.extra || '');
  };

  window.HR_SAVE_QUICK = function(e){
    if(e) e.preventDefault();

    if(!window.state) {
      alert('Помилка: state не знайдено.');
      return;
    }
    if(!Array.isArray(window.state.events)) window.state.events = [];

    const id = document.getElementById('quickId')?.value || makeId();
    const type = document.getElementById('quickType')?.value || 'stress';
    const dt = document.getElementById('quickDateTime')?.value || localInput();
    const value = +(document.getElementById('quickValue')?.value || 0);
    const extra = document.getElementById('quickExtra')?.value || '';
    const note = document.getElementById('quickNote')?.value?.trim() || '';

    const rec = { id, type, time:new Date(dt).toISOString(), value, extra, note };

    const i = window.state.events.findIndex(x => x.id === id);
    if(i >= 0) window.state.events[i] = rec;
    else window.state.events.push(rec);

    HR_HIDE_QUICK_FORM();

    if(typeof renderAll === 'function') renderAll();
    if(typeof scheduleCloudSave === 'function') scheduleCloudSave();
  };

  window.editEvent = function(id){
    const r = window.state?.events?.find(x=>x.id===id);
    if(!r) return;
    HR_FORCE_QUICK(r.type, id);
  };

  // Final fallback: any button with old quickEvent still opens direct form.
  window.quickEvent = function(type){
    HR_FORCE_QUICK(type);
  };
})();


/* ===== Health Radar 1.5.8: FINAL quick modal close fix ===== */
window.HR_FORCE_CLOSE_QUICK_MODAL = function(ev){
  if(ev){
    ev.preventDefault();
    ev.stopPropagation();
    if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
  }

  const modal = document.getElementById('quickModal');
  if(modal){
    modal.classList.remove('show');
    modal.classList.remove('active');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
  }

  const form = document.getElementById('quickForm');
  if(form) form.classList.add('hidden');

  document.body.classList.remove('modal-open');
  return false;
};

(function(){
  function bindClose(){
    const btn = document.getElementById('quickModalCloseBtn') ||
      document.querySelector('#quickModal .modal-head button:last-child');

    if(btn){
      btn.onclick = HR_FORCE_CLOSE_QUICK_MODAL;
      btn.type = 'button';
    }

    const modal = document.getElementById('quickModal');
    if(modal && !modal.__hrCloseBound){
      modal.__hrCloseBound = true;
      modal.addEventListener('click', function(e){
        if(e.target === modal) HR_FORCE_CLOSE_QUICK_MODAL(e);
      });
    }
  }

  bindClose();
  window.addEventListener('load', bindClose);
  setTimeout(bindClose, 300);
  setTimeout(bindClose, 1000);

  const oldCloseModal = window.closeModal;
  window.closeModal = function(id){
    if(id === 'quickModal') return HR_FORCE_CLOSE_QUICK_MODAL();
    if(typeof oldCloseModal === 'function') return oldCloseModal(id);
    const m = document.getElementById(id);
    if(m){
      m.classList.remove('show');
      m.style.display = 'none';
    }
  };

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      const modal = document.getElementById('quickModal');
      if(modal && (modal.classList.contains('show') || modal.style.display === 'flex')){
        HR_FORCE_CLOSE_QUICK_MODAL(e);
      }
    }
  });
})();
