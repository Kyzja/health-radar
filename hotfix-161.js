/* Health Radar v1.6.1 HOTFIX
   Fixes quick buttons, modal close, current archive weather card.
*/
(function(){
  const CFG = {
    stress:{title:'😡 Стрес',hint:'Рівень стресу 0–10',unit:'рівень',def:1,btn:[0,1,2,3,4,5,6,7,8,9,10]},
    coffee:{title:'☕ Кава',hint:'Скільки чашок кави сьогодні?',unit:'чашок',def:1,btn:[1,2,3,4,5]},
    alcohol:{title:'🍺 Алкоголь',hint:'Кількість порцій алкоголю',unit:'порцій',def:1,btn:[0,1,2,3,4,5],extra:`<label>Тип алкоголю<select id="quickExtra"><option value="">не вказано</option><option value="пиво">🍺 Пиво</option><option value="вино">🍷 Вино</option><option value="міцний">🥃 Міцний</option></select></label>`},
    activity:{title:'🏃 Навантаження',hint:'Тип і тривалість навантаження',unit:'хв',def:30,btn:[10,20,30,45,60,90,120],extra:`<label>Тип активності<select id="quickExtra"><option value="ходьба">🚶 Ходьба</option><option value="біг">🏃 Біг</option><option value="тренування">💪 Тренування</option><option value="робота">🛠 Робота/навантаження</option></select></label>`},
    sleep:{title:'😴 Сон',hint:'Години сну та якість',unit:'год',def:7,btn:[4,5,6,7,8,9,10],extra:`<label>Якість сну<select id="quickExtra"><option value="1">1 — дуже погано</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5" selected>5 — нормально</option><option value="6">6</option><option value="7">7</option><option value="8">8</option><option value="9">9</option><option value="10">10 — добре</option></select></label>`},
    headache:{title:'🤕 Головний біль',hint:'Оцініть біль 0–10',unit:'рівень',def:1,btn:[0,1,2,3,4,5,6,7,8,9,10]},
    tinnitus:{title:'👂 Шум у вухах',hint:'Оцініть шум 0–10',unit:'рівень',def:1,btn:[0,1,2,3,4,5,6,7,8,9,10]},
    dizziness:{title:'😵 Запаморочення',hint:'Оцініть запаморочення 0–10',unit:'рівень',def:1,btn:[0,1,2,3,4,5,6,7,8,9,10]},
    fatigue:{title:'😴 Втома',hint:'Оцініть втому 0–10',unit:'рівень',def:1,btn:[0,1,2,3,4,5,6,7,8,9,10]}
  };

  function id(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
  function localInput(d=new Date()){
    if(typeof nowLocalInput === 'function') return nowLocalInput(d);
    const z = new Date(d.getTime() - d.getTimezoneOffset()*60000);
    return z.toISOString().slice(0,16);
  }
  function showModal(id){
    const m=document.getElementById(id);
    if(!m) return;
    m.style.display='flex';
    m.classList.add('show');
    m.removeAttribute('aria-hidden');
  }
  function closeQuick(ev){
    if(ev){ ev.preventDefault(); ev.stopPropagation(); }
    const m=document.getElementById('quickModal');
    if(m){ m.classList.remove('show'); m.style.display='none'; m.setAttribute('aria-hidden','true'); }
    const f=document.getElementById('quickForm');
    if(f) f.classList.add('hidden');
    return false;
  }

  function ensureQuickForm(){
    let form=document.getElementById('quickForm');
    if(!form) return null;

    // If old form lacks dynamic container, rebuild it safely.
    if(!document.getElementById('quickDynamicFields')){
      form.innerHTML = `
        <input type="hidden" id="quickId"/>
        <input type="hidden" id="quickType"/>
        <div class="quick-form-head">
          <div>
            <div id="quickFormTitle" class="card-title">Швидка подія</div>
            <div id="quickFormHint" class="muted">Оберіть значення і збережіть.</div>
          </div>
        </div>
        <label>Дата і час <input type="datetime-local" id="quickDateTime"/></label>
        <div id="quickDynamicFields"></div>
        <label>Примітка <textarea id="quickNote" rows="2" placeholder="необов’язково"></textarea></label>
        <div class="row"><button class="primary">Зберегти</button><button type="button" onclick="HR_CLOSE_QUICK(event)">Скасувати</button></div>
      `;
    }
    form.onsubmit = HR_SAVE_QUICK;
    return form;
  }

  function renderFields(type,value,extraValue=''){
    const cfg=CFG[type]||CFG.stress;
    const box=document.getElementById('quickDynamicFields');
    if(!box) return;
    const buttons=(cfg.btn||[]).map(v=>`<button type="button" class="${Number(v)===Number(value)?'active':''}" onclick="HR_SET_QUICK_VALUE(${v})">${v}</button>`).join('');
    box.innerHTML = `
      <label>Значення (${cfg.unit})
        <input type="number" step="0.1" id="quickValue" value="${value}">
      </label>
      <div class="quick-options">${buttons}</div>
      <div class="quick-fields-grid">${cfg.extra||''}</div>
    `;
    const extra=document.getElementById('quickExtra');
    if(extra && extraValue) extra.value=extraValue;
  }

  window.HR_SET_QUICK_VALUE=function(v){
    const input=document.getElementById('quickValue');
    if(input) input.value=v;
    document.querySelectorAll('.quick-options button').forEach(b=>{
      b.classList.toggle('active', String(b.textContent).trim()===String(v));
    });
  };

  window.HR_CLOSE_QUICK=closeQuick;

  window.HR_FORCE_QUICK=function(type, existingId){
    if(type==='bp' || type==='pressure'){
      closeQuick();
      if(typeof openBPModal==='function') openBPModal();
      return;
    }
    const form=ensureQuickForm();
    if(!form){ alert('Не знайдено форму швидкого запису.'); return; }
    const rec = existingId && window.state?.events ? window.state.events.find(x=>x.id===existingId) : null;
    const cfg=CFG[type]||CFG.stress;
    showModal('quickModal');
    form.classList.remove('hidden');

    document.getElementById('quickId').value = rec?.id || '';
    document.getElementById('quickType').value = type;
    document.getElementById('quickDateTime').value = rec?.time ? localInput(new Date(rec.time)) : localInput();
    document.getElementById('quickNote').value = rec?.note || '';

    const title=document.getElementById('quickFormTitle');
    const hint=document.getElementById('quickFormHint');
    if(title) title.textContent=cfg.title;
    if(hint) hint.textContent=cfg.hint;

    renderFields(type, rec?.value ?? cfg.def, rec?.extra || '');
  };

  window.HR_SAVE_QUICK=function(e){
    if(e) e.preventDefault();
    if(!window.state) window.state={};
    if(!Array.isArray(window.state.events)) window.state.events=[];

    const rec={
      id: document.getElementById('quickId')?.value || (typeof uid==='function' ? uid() : id()),
      type: document.getElementById('quickType')?.value || 'stress',
      time: new Date(document.getElementById('quickDateTime')?.value || localInput()).toISOString(),
      value: +(document.getElementById('quickValue')?.value || 0),
      extra: document.getElementById('quickExtra')?.value || '',
      note: document.getElementById('quickNote')?.value?.trim() || ''
    };
    const i=window.state.events.findIndex(x=>x.id===rec.id);
    if(i>=0) window.state.events[i]=rec; else window.state.events.push(rec);
    closeQuick();
    if(typeof renderAll==='function') renderAll();
    if(typeof scheduleCloudSave==='function') scheduleCloudSave();
    return false;
  };

  window.quickEvent=function(type){ HR_FORCE_QUICK(type); };
  window.editEvent=function(eventId){
    const rec=window.state?.events?.find(x=>x.id===eventId);
    if(rec) HR_FORCE_QUICK(rec.type, eventId);
  };

  function bindButtons(){
    // Top quick button
    document.querySelectorAll('button').forEach(btn=>{
      const txt=(btn.textContent||'').trim().toLowerCase();
      if(txt.includes('швидкий запис')){
        btn.onclick=function(e){ e.preventDefault(); showModal('quickModal'); ensureQuickForm(); return false; };
      }
    });

    // Quick modal close button
    const closeBtn=document.querySelector('#quickModal .modal-head button:last-child');
    if(closeBtn){ closeBtn.type='button'; closeBtn.onclick=closeQuick; }

    // Backdrop close
    const quickModal=document.getElementById('quickModal');
    if(quickModal && !quickModal.__hrHotfixBound){
      quickModal.__hrHotfixBound=true;
      quickModal.addEventListener('click', e=>{ if(e.target===quickModal) closeQuick(e); });
    }
  }

  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeQuick(e); });
  window.addEventListener('load', bindButtons);
  setTimeout(bindButtons,300);
  setTimeout(bindButtons,1000);

  /* Weather card: use nearest archive record <= current time */
  function fmtDate(d){
    try{ return (typeof fmt!=='undefined' && fmt.format) ? fmt.format(d) : d.toLocaleString('uk-UA'); }
    catch(e){ return d.toLocaleString('uk-UA'); }
  }
  function currentArchiveWeather(){
    const now=new Date();
    const past=[...(window.state?.weather||[])]
      .filter(w=>w && w.time && new Date(w.time)<=now)
      .sort((a,b)=>new Date(b.time)-new Date(a.time));
    return past[0] || null;
  }
  const oldRenderDashboard=window.renderDashboard;
  window.renderDashboard=function(){
    if(typeof oldRenderDashboard==='function') oldRenderDashboard();
    const w=currentArchiveWeather();
    if(!w) return;
    const weatherNow=document.getElementById('weatherNow');
    const weatherMeta=document.getElementById('weatherMeta');
    const atmPressure=document.getElementById('atmPressure');
    if(weatherNow) weatherNow.textContent=`${Math.round(+w.temp)}°C`;
    if(weatherMeta) weatherMeta.innerHTML=`${window.state?.city?.name||''} · вологість ${w.humidity}% · вітер ${w.wind} м/с <span class="hotfix-note">архів на поточний час: ${fmtDate(new Date(w.time))}</span>`;
    if(atmPressure) atmPressure.textContent=`${Number(w.pressure).toFixed(1)} гПа`;
  };

  const oldRenderWeather=window.renderWeather;
  window.renderWeather=function(){
    if(typeof oldRenderWeather==='function') oldRenderWeather();
    // Leave original table, dashboard fix is enough and avoids breaking layout.
  };

  setTimeout(()=>{ if(typeof renderDashboard==='function') renderDashboard(); },500);
})();
