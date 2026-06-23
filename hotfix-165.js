/* Health Radar v1.6.5 — Events dedup + Neuro recent events */
(function(){
  const TYPES = {
    stress:'😡 Стрес', coffee:'☕ Кава', alcohol:'🍺 Алкоголь', activity:'🏃 Навантаження', sleep:'😴 Сон',
    headache:'🤕 Головний біль', tinnitus:'👂 Шум у вухах', dizziness:'😵 Запаморочення', fatigue:'😴 Втома'
  };
  const NEURO = ['tinnitus','headache','dizziness','fatigue'];

  function esc(s=''){
    if(typeof escapeHtml === 'function') return escapeHtml(s);
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }
  function fdate(t){
    try{ return (typeof fmt !== 'undefined' && fmt.format) ? fmt.format(new Date(t)) : new Date(t).toLocaleString('uk-UA'); }
    catch(e){ return String(t||''); }
  }
  function minuteKey(t){
    const d = new Date(t);
    if(isNaN(d)) return String(t||'');
    d.setSeconds(0,0);
    return d.toISOString();
  }
  function eventKey(e){
    return [minuteKey(e.time), e.type||'', String(Number(e.value ?? 0)), (e.note||'').trim(), e.extra||''].join('|');
  }
  function dedupeEvents(events){
    const map = new Map();
    (events||[]).forEach(e=>{
      if(!e) return;
      const key = eventKey(e);
      const prev = map.get(key);
      // keep one record, prefer record that has id and fuller fields
      if(!prev || String(e.id||'').length > String(prev.id||'').length) map.set(key, e);
    });
    return Array.from(map.values()).sort((a,b)=>new Date(b.time)-new Date(a.time));
  }
  function syncDedupeState(){
    if(!window.state) return;
    if(!Array.isArray(window.state.events)) window.state.events = [];
    const before = window.state.events.length;
    const after = dedupeEvents(window.state.events);
    if(after.length !== before){
      window.state.events = after;
      try{ state.events = after; }catch(e){}
    }
  }

  window.HR_DEDUPE_EVENTS = function(){
    syncDedupeState();
    if(typeof saveState === 'function') saveState();
    if(typeof renderAll === 'function') renderAll();
  };

  function findDuplicateEvent(rec){
    const key = eventKey(rec);
    return (window.state?.events||[]).find(e => eventKey(e) === key);
  }

  // Override quick save to prevent double records from double click / two handlers / phone lag
  window.HR_SAVE_QUICK = function(e){
    if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    if(!window.state) window.state = {};
    if(!Array.isArray(window.state.events)) window.state.events = [];
    const id = document.getElementById('quickId')?.value || '';
    const dt = document.getElementById('quickDateTime')?.value;
    const rec = {
      id: id || (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2)+Date.now().toString(36)),
      type: document.getElementById('quickType')?.value || 'stress',
      time: new Date(dt || new Date()).toISOString(),
      value: +(document.getElementById('quickValue')?.value || 0),
      extra: document.getElementById('quickExtra')?.value || '',
      note: document.getElementById('quickNote')?.value?.trim() || ''
    };

    const byId = id ? window.state.events.findIndex(x=>x.id===id) : -1;
    if(byId >= 0){
      window.state.events[byId] = rec;
    } else {
      const dup = findDuplicateEvent(rec);
      if(dup){
        Object.assign(dup, rec, {id: dup.id || rec.id});
      } else {
        window.state.events.push(rec);
      }
    }

    syncDedupeState();
    const form = document.getElementById('quickForm');
    if(form) form.classList.add('hidden');
    if(typeof HR_CLOSE_QUICK === 'function') HR_CLOSE_QUICK();
    if(typeof renderAll === 'function') renderAll();
    if(typeof scheduleCloudSave === 'function') scheduleCloudSave();
    return false;
  };

  // Override old inline form function too
  window.saveQuickEvent = window.HR_SAVE_QUICK;

  window.renderQuickEvents = function(){
    syncDedupeState();
    const list = document.getElementById('quickEventsList');
    if(!list) return;
    const rows = dedupeEvents(window.state?.events||[]).slice(0,20).map(e=>`
      <div class="list-item event-pill">
        <div><b>${TYPES[e.type]||e.type}</b> · ${e.value}<br><span class="muted">${fdate(e.time)} ${esc(e.note||'')}</span></div>
        <div class="actions"><button onclick="editEvent('${e.id}')">✏️</button> <button onclick="delEvent('${e.id}')">🗑</button></div>
      </div>`).join('');
    list.innerHTML = rows || '<div class="muted">Подій немає.</div>';
  };

  window.renderNeuro = function(){
    syncDedupeState();
    const events = dedupeEvents(window.state?.events||[]);
    const neuroEvents = events.filter(e=>NEURO.includes(e.type));

    const recent = document.getElementById('neuroRecentEvents');
    if(recent){
      recent.innerHTML = neuroEvents.slice(0,8).map(e=>`
        <div class="list-item event-pill">
          <div><b>${TYPES[e.type]||e.type}</b> · ${e.value}/10<br><span class="muted">${fdate(e.time)} ${esc(e.note||'')}</span></div>
          <div class="actions"><button onclick="editEvent('${e.id}')">✏️</button> <button onclick="delEvent('${e.id}')">🗑</button></div>
        </div>`).join('') || '<div class="muted">Останніх неврологічних подій немає.</div>';
    }

    const table = document.getElementById('neuroTable');
    if(table){
      const rows = neuroEvents.map(e=>`
        <tr>
          <td>${fdate(e.time)}</td>
          <td>${TYPES[e.type]||e.type}</td>
          <td>${e.value}/10</td>
          <td>${esc(e.note||'')}</td>
          <td class="actions"><button onclick="editEvent('${e.id}')">✏️</button> <button onclick="delEvent('${e.id}')">🗑</button></td>
        </tr>`).join('');
      table.innerHTML = `<table><thead><tr><th>Дата</th><th>Симптом</th><th>Оцінка</th><th>Примітка</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan="5">Неврологічних записів немає</td></tr>'}</tbody></table>`;
    }

    const ai = document.getElementById('neuroAI');
    if(ai && typeof neuroAnalysis === 'function') ai.textContent = neuroAnalysis();
  };

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    syncDedupeState();
    if(typeof oldRenderAll === 'function') oldRenderAll.apply(this, arguments);
    if(typeof window.renderQuickEvents === 'function') window.renderQuickEvents();
    if(typeof window.renderNeuro === 'function') window.renderNeuro();
  };

  window.addEventListener('load', ()=>{
    syncDedupeState();
    setTimeout(()=>{ if(typeof renderAll === 'function') renderAll(); }, 300);
  });
})();
