/* Health Radar v1.6.6 — Neuro AI + strict event dedup */
(function(){
  const LABELS = {
    stress:'😡 Стрес', coffee:'☕ Кава', alcohol:'🍺 Алкоголь', activity:'🏃 Навантаження', sleep:'😴 Сон',
    headache:'🤕 Головний біль', tinnitus:'👂 Шум у вухах', dizziness:'😵 Запаморочення', fatigue:'😴 Втома'
  };
  const NEURO = ['tinnitus','headache','dizziness','fatigue'];

  function n(v){ return Number(v || 0); }
  function avg(arr){ return arr.length ? arr.reduce((a,b)=>a+n(b),0)/arr.length : null; }
  function fmtDate(t){
    try { return (window.fmt && fmt.format) ? fmt.format(new Date(t)) : new Date(t).toLocaleString('uk-UA'); }
    catch(e){ return String(t || ''); }
  }
  function minuteKey(t){
    const d = new Date(t);
    if(isNaN(d)) return String(t || '');
    d.setSeconds(0,0);
    return d.toISOString();
  }
  function cleanNote(v){ return String(v || '').trim().replace(/\s+/g,' '); }
  function eventKey(e){
    return [minuteKey(e.time), e.type || '', String(n(e.value)), cleanNote(e.note), String(e.extra || '')].join('|');
  }
  function dedupeEventsStrict(list){
    const map = new Map();
    (list || []).forEach(e => {
      if(!e || !e.time || !e.type) return;
      const key = eventKey(e);
      const prev = map.get(key);
      if(!prev) map.set(key, e);
      else {
        // keep richer/older existing id, merge fields
        map.set(key, {...e, ...prev, id: prev.id || e.id});
      }
    });
    return Array.from(map.values()).sort((a,b)=>new Date(b.time)-new Date(a.time));
  }
  function syncDedupe(save=false){
    if(!window.state) return false;
    if(!Array.isArray(window.state.events)) window.state.events = [];
    const before = window.state.events.length;
    const after = dedupeEventsStrict(window.state.events);
    if(after.length !== before){
      window.state.events = after;
      try { state.events = after; } catch(e) {}
      if(save && typeof saveState === 'function') saveState();
      if(save && typeof scheduleCloudSave === 'function') scheduleCloudSave();
      return true;
    }
    return false;
  }
  function findDuplicate(rec){
    const key = eventKey(rec);
    return (window.state?.events || []).find(e => eventKey(e) === key);
  }

  window.HR_CLEAN_DUPLICATE_EVENTS = function(){
    const changed = syncDedupe(true);
    if(typeof renderAll === 'function') renderAll();
    alert(changed ? 'Дублі подій очищено.' : 'Дублів подій не знайдено.');
  };

  // Final override: prevents double save from rapid clicks / old form handler / mobile lag.
  window.HR_SAVE_QUICK = window.saveQuickEvent = function(e){
    if(e){ e.preventDefault(); e.stopPropagation(); if(e.stopImmediatePropagation) e.stopImmediatePropagation(); }
    if(!window.state) window.state = {};
    if(!Array.isArray(window.state.events)) window.state.events = [];
    const id = document.getElementById('quickId')?.value || '';
    const dt = document.getElementById('quickDateTime')?.value || new Date();
    const rec = {
      id: id || (typeof uid === 'function' ? uid() : Math.random().toString(36).slice(2) + Date.now().toString(36)),
      type: document.getElementById('quickType')?.value || 'stress',
      time: new Date(dt).toISOString(),
      value: +(document.getElementById('quickValue')?.value || 0),
      extra: document.getElementById('quickExtra')?.value || '',
      note: cleanNote(document.getElementById('quickNote')?.value || '')
    };

    const byId = id ? window.state.events.findIndex(x => x.id === id) : -1;
    if(byId >= 0) window.state.events[byId] = rec;
    else {
      const dup = findDuplicate(rec);
      if(dup) Object.assign(dup, rec, {id: dup.id || rec.id});
      else window.state.events.push(rec);
    }
    syncDedupe(false);

    const form = document.getElementById('quickForm');
    if(form) form.classList.add('hidden');
    if(typeof HR_CLOSE_QUICK === 'function') HR_CLOSE_QUICK();
    else if(typeof closeModal === 'function') closeModal('quickModal');
    if(typeof renderAll === 'function') renderAll();
    if(typeof scheduleCloudSave === 'function') scheduleCloudSave();
    return false;
  };

  function pressureAt(t){
    const arr = window.state?.weather || [];
    let best = null, diff = Infinity;
    arr.forEach(w => {
      if(!w || !w.time || w.pressure == null) return;
      const d = Math.abs(new Date(w.time) - new Date(t));
      if(d < diff && d <= 3 * 3600000){ diff = d; best = w; }
    });
    return best;
  }

  function buildNeuroAI(){
    try{
      syncDedupe(false);
      const all = dedupeEventsStrict(window.state?.events || []);
      const ev = all.filter(e => NEURO.includes(e.type));
      if(!ev.length) return 'Неврологічних записів поки немає. Додайте шум у вухах, головний біль, запаморочення або втому з оцінкою 0–10.';
      if(ev.length < 3) return `Поки є ${ev.length} неврологічний запис. Для аналізу потрібно хоча б 3 записи. Фіксуйте симптом навіть якщо він слабкий.`;

      const lines = [];
      lines.push(`Зафіксовано неврологічних подій: ${ev.length}.`);
      NEURO.forEach(type => {
        const arr = ev.filter(e => e.type === type);
        if(!arr.length) return;
        const values = arr.map(e => n(e.value));
        const av = avg(values);
        const max = Math.max(...values);
        const high = arr.filter(e => n(e.value) >= 5).length;
        const last = arr[0];
        lines.push(`${LABELS[type]}: ${arr.length} запис(ів), середнє ${av.toFixed(1)}/10, максимум ${max}/10, сильних ≥5/10: ${high}. Останній: ${fmtDate(last.time)} — ${last.value}/10.`);
      });

      const recent = ev.slice(0,5).map(e => n(e.value));
      const older = ev.slice(5,10).map(e => n(e.value));
      if(recent.length >= 3 && older.length >= 3){
        const r = avg(recent), o = avg(older);
        const delta = r - o;
        if(Math.abs(delta) >= 1) lines.push(delta > 0 ? `Останні симптоми в середньому посилились приблизно на ${delta.toFixed(1)} бала.` : `Останні симптоми в середньому зменшились приблизно на ${Math.abs(delta).toFixed(1)} бала.`);
        else lines.push('За останніми записами різкої зміни симптомів не видно.');
      }

      const withWeather = ev.map(e => ({e, w: pressureAt(e.time)})).filter(x => x.w);
      if(withWeather.length >= 2){
        const strong = withWeather.filter(x => n(x.e.value) >= 5);
        if(strong.length){
          const avgP = avg(strong.map(x => x.w.pressure));
          lines.push(`При сильних симптомах середній атмосферний тиск був близько ${avgP.toFixed(1)} гПа. Це не доказ причини, але корисний орієнтир для спостереження.`);
        }
      }

      lines.push('Що робити для точнішого аналізу: фіксуйте симптоми 2–3 рази на день, додавайте тиск, сон, каву, стрес і ліки. Якщо раптово з’явилась слабкість руки/ноги, порушення мовлення, різкий головний біль або АТ близько 180/120 — звертайтесь по невідкладну допомогу.');
      return lines.join('\n\n');
    }catch(err){
      console.error('Neuro AI error', err);
      return 'AI по неврології тимчасово не зміг виконати аналіз. Записи збережені, спробуйте оновити сторінку.';
    }
  }

  function renderNeuroFixed(){
    syncDedupe(false);
    const events = dedupeEventsStrict(window.state?.events || []);
    const neuroEvents = events.filter(e => NEURO.includes(e.type));

    const recent = document.getElementById('neuroRecentEvents');
    if(recent){
      recent.innerHTML = neuroEvents.slice(0,8).map(e => `
        <div class="list-item event-pill">
          <div><b>${LABELS[e.type] || e.type}</b> · ${e.value}/10<br><span class="muted">${fmtDate(e.time)} ${cleanNote(e.note)}</span></div>
          <div class="actions"><button onclick="editEvent('${e.id}')">✏️</button> <button onclick="delEvent('${e.id}')">🗑</button></div>
        </div>`).join('') || '<div class="muted">Останніх неврологічних подій немає.</div>';
    }

    const table = document.getElementById('neuroTable');
    if(table){
      const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s => String(s||''));
      const rows = neuroEvents.map(e => `<tr><td>${fmtDate(e.time)}</td><td>${LABELS[e.type] || e.type}</td><td>${e.value}/10</td><td>${esc(e.note || '')}</td><td class="actions"><button onclick="editEvent('${e.id}')">✏️</button> <button onclick="delEvent('${e.id}')">🗑</button></td></tr>`).join('');
      table.innerHTML = `<table><thead><tr><th>Дата</th><th>Симптом</th><th>Оцінка</th><th>Примітка</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="5">Неврологічних записів немає</td></tr>'}</tbody></table>`;
    }

    const ai = document.getElementById('neuroAI');
    if(ai) ai.textContent = buildNeuroAI();
  }

  window.renderNeuro = renderNeuroFixed;
  window.HR_RENDER_NEURO_AI = renderNeuroFixed;

  const oldRenderAll = window.renderAll;
  window.renderAll = function(){
    const changed = syncDedupe(false);
    if(typeof oldRenderAll === 'function') oldRenderAll.apply(this, arguments);
    renderNeuroFixed();
    if(changed && typeof scheduleCloudSave === 'function') scheduleCloudSave();
  };

  window.addEventListener('load', () => {
    setTimeout(renderNeuroFixed, 100);
    setTimeout(renderNeuroFixed, 500);
    setTimeout(renderNeuroFixed, 1500);
  });
})();
