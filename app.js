
const STORE_KEY = 'healthRadarAI_v1';
const fmt = new Intl.DateTimeFormat('uk-UA', {dateStyle:'short', timeStyle:'short'});
let chart;

var state = window.state = loadState();
window.addEventListener('DOMContentLoaded', init);

function defaultState(){
  return {
    settings:{limitSys:140, limitDia:90, limitPulse:100, weatherStart:'2026-06-20', weatherInterval:2, firebaseConfig:''},
    city:{name:'Київ', lat:50.4501, lon:30.5234, country:'UA'},
    bp:[], meds:[], events:[], weather:[]
  };
}
function loadState(){ try{return {...defaultState(), ...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}}catch(e){return defaultState()} }
function saveState(){ window.state = state; localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
function uid(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function nowLocalInput(d=new Date()){ const z=new Date(d.getTime()-d.getTimezoneOffset()*60000); return z.toISOString().slice(0,16); }
function dateOnly(d){ return new Date(d).toISOString().slice(0,10); }
function parseDate(v){ return new Date(v); }
function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); return d; }

function init(){
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  document.getElementById('weatherStart').value = state.settings.weatherStart || '2026-06-20';
  document.getElementById('settingsWeatherStart').value = state.settings.weatherStart || '2026-06-20';
  document.getElementById('weatherInterval').value = state.settings.weatherInterval || 2;
  document.getElementById('limitSys').value = state.settings.limitSys;
  document.getElementById('limitDia').value = state.settings.limitDia;
  document.getElementById('limitPulse').value = state.settings.limitPulse;
  document.getElementById('calendarMonth').value = new Date().toISOString().slice(0,7);
  document.getElementById('cityInput').value = state.city?.name || '';
  const fb=document.getElementById('firebaseConfig'); if(fb) fb.value=state.settings.firebaseConfig||'';
  renderAll();
  setInterval(()=>{ fetchMissingWeather(true); }, 30*60*1000);
  fetchMissingWeather(true);
}
function switchTab(tab){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('tab-'+tab).classList.add('active');
  renderAll();
}
function openModal(id){ document.getElementById(id).classList.add('show'); if(id==='quickModal') renderQuickEvents(); }
function closeModal(id){ document.getElementById(id).classList.remove('show'); }
function escapeHtml(s=''){ return String(s).replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])); }

function renderAll(){
  saveState();
  renderDashboard(); renderChart(); renderEntries(); renderMeds(); renderWeather(); renderCalendar(); renderAI(); renderQuickEvents(); renderCorrelations(); renderNeuro();
}

function renderDashboard(){
  const last = [...state.bp].sort((a,b)=>new Date(b.time)-new Date(a.time))[0];
  document.getElementById('lastBP').textContent = last ? `${last.sys}/${last.dia}` : '—/—';
  document.getElementById('lastBPTime').textContent = last ? fmt.format(new Date(last.time)) + ` · пульс ${last.pulse}` : 'Немає записів';

  const w = [...state.weather].sort((a,b)=>new Date(b.time)-new Date(a.time))[0];
  document.getElementById('weatherNow').textContent = w ? `${Math.round(w.temp)}°C` : '—';
  document.getElementById('weatherMeta').textContent = w ? `${state.city?.name||''} · вологість ${w.humidity}% · вітер ${w.wind} м/с` : 'Місто не вибрано';
  document.getElementById('atmPressure').textContent = w ? `${w.pressure.toFixed(1)} гПа` : '—';
  document.getElementById('atmDelta').textContent = w ? calcPressureDeltasText() : 'Δ 2/6/12/24 год —';

  const score = dayScore(new Date());
  const badge = document.getElementById('dayBadge');
  badge.className='day-badge '+(score>=75?'good':score>=50?'mid':score>0?'bad':'neutral');
  badge.textContent = score ? `${score}/100` : '—';
  document.getElementById('aiShort').textContent = shortAI();
}
function calcPressureDeltasText(){
  const latest = [...state.weather].sort((a,b)=>new Date(b.time)-new Date(a.time))[0];
  if(!latest) return '—';
  const parts=[2,6,12,24].map(h=>{
    const target = new Date(new Date(latest.time).getTime()-h*3600000);
    const prev = nearestWeather(target);
    return prev ? `${h}г: ${(latest.pressure-prev.pressure).toFixed(1)}` : `${h}г: —`;
  });
  return 'Δ ' + parts.join(' · ') + ' гПа';
}
function nearestWeather(t){
  let best=null, diff=Infinity;
  state.weather.forEach(w=>{
    const d=Math.abs(new Date(w.time)-t);
    if(d<diff && d<2.5*3600000){diff=d; best=w;}
  });
  return best;
}

function openBPModal(rec=null){
  document.getElementById('bpId').value = rec?.id || '';
  document.getElementById('bpDateTime').value = rec ? nowLocalInput(new Date(rec.time)) : nowLocalInput();
  document.getElementById('sys').value = rec?.sys || '';
  document.getElementById('dia').value = rec?.dia || '';
  document.getElementById('pulse').value = rec?.pulse || '';
  document.getElementById('wellbeing').value = rec?.wellbeing || 5;
  document.getElementById('bpNote').value = rec?.note || '';
  openModal('bpModal');
}
function saveBP(e){
  e.preventDefault();
  const id = document.getElementById('bpId').value || uid();
  const rec = {
    id, time:new Date(document.getElementById('bpDateTime').value).toISOString(),
    sys:+document.getElementById('sys').value, dia:+document.getElementById('dia').value,
    pulse:+document.getElementById('pulse').value, wellbeing:+document.getElementById('wellbeing').value,
    note:document.getElementById('bpNote').value.trim()
  };
  const i=state.bp.findIndex(x=>x.id===id); if(i>=0) state.bp[i]=rec; else state.bp.push(rec);
  closeModal('bpModal'); renderAll();
}
function editBP(id){ openBPModal(state.bp.find(x=>x.id===id)); }
function delBP(id){ if(confirm('Видалити запис тиску?')){ state.bp=state.bp.filter(x=>x.id!==id); renderAll(); } }
function renderEntries(){
  const rows=[...state.bp].sort((a,b)=>new Date(b.time)-new Date(a.time)).map(r=>`
    <tr><td>${fmt.format(new Date(r.time))}</td><td><b>${r.sys}/${r.dia}</b></td><td>${r.pulse}</td><td>${r.wellbeing}/10</td><td>${escapeHtml(r.note||'')}</td>
    <td class="actions"><button onclick="editBP('${r.id}')">✏️</button><button onclick="delBP('${r.id}')">🗑</button></td></tr>`).join('');
  document.getElementById('entriesTable').innerHTML = `<table><thead><tr><th>Дата</th><th>АТ</th><th>Пульс</th><th>Стан</th><th>Примітка</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan=6>Записів немає</td></tr>'}</tbody></table>`;
}

function openMedModal(rec=null){
  document.getElementById('medId').value=rec?.id||'';
  document.getElementById('medDateTime').value=rec?nowLocalInput(new Date(rec.time)):nowLocalInput();
  document.getElementById('medName').value=rec?.name||'';
  document.getElementById('medDose').value=rec?.dose||'';
  document.getElementById('medNote').value=rec?.note||'';
  openModal('medModal');
}
function saveMed(e){
  e.preventDefault();
  const id=document.getElementById('medId').value||uid();
  const rec={id,time:new Date(document.getElementById('medDateTime').value).toISOString(),name:document.getElementById('medName').value.trim(),dose:document.getElementById('medDose').value.trim(),note:document.getElementById('medNote').value.trim()};
  const i=state.meds.findIndex(x=>x.id===id); if(i>=0) state.meds[i]=rec; else state.meds.push(rec);
  closeModal('medModal'); renderAll();
}
function editMed(id){ openMedModal(state.meds.find(x=>x.id===id)); }
function delMed(id){ if(confirm('Видалити прийом ліків?')){ state.meds=state.meds.filter(x=>x.id!==id); renderAll(); } }
function renderMeds(){
  const rows=[...state.meds].sort((a,b)=>new Date(b.time)-new Date(a.time)).map(m=>{
    const eff = medEffect(m);
    return `<tr><td>${fmt.format(new Date(m.time))}</td><td><b>${escapeHtml(m.name)}</b></td><td>${escapeHtml(m.dose||'')}</td><td>${eff.text}</td><td>${escapeHtml(m.note||'')}</td><td class="actions"><button onclick="editMed('${m.id}')">✏️</button><button onclick="delMed('${m.id}')">🗑</button></td></tr>`
  }).join('');
  document.getElementById('medTable').innerHTML=`<table><thead><tr><th>Дата</th><th>Ліки</th><th>Доза</th><th>Ефект</th><th>Примітка</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan=6>Немає записів</td></tr>'}</tbody></table>`;
  const groups={};
  state.meds.forEach(m=>{
    const e=medEffect(m); if(e.sysDelta===null) return;
    const k=m.name.toLowerCase(); groups[k]=groups[k]||{name:m.name,n:0,sys:0,dia:0}; groups[k].n++; groups[k].sys+=e.sysDelta; groups[k].dia+=e.diaDelta;
  });
  document.getElementById('medAnalysis').innerHTML = Object.values(groups).map(g=>`<div class="list-item"><b>${escapeHtml(g.name)}</b><br>Прийомів з контрольним заміром: ${g.n}<br>Середній ефект: ${(g.sys/g.n).toFixed(1)}/${(g.dia/g.n).toFixed(1)} мм рт.ст.</div>`).join('') || '<div class="muted">Потрібні заміри до/після прийому.</div>';
}
function medEffect(m){
  const t=new Date(m.time);
  const before=state.bp.filter(b=>new Date(b.time)<=t && t-new Date(b.time)<=3*3600000).sort((a,b)=>new Date(b.time)-new Date(a.time))[0];
  const after=state.bp.filter(b=>new Date(b.time)>t && new Date(b.time)-t<=3*3600000).sort((a,b)=>new Date(a.time)-new Date(b.time))[0];
  if(!before || !after) return {text:'потрібен замір до/після', sysDelta:null, diaDelta:null};
  const sd=after.sys-before.sys, dd=after.dia-before.dia;
  return {text:`${sd>0?'+':''}${sd}/${dd>0?'+':''}${dd}`, sysDelta:sd, diaDelta:dd};
}

const quickLabels={stress:'😡 Стрес',coffee:'☕ Кава',alcohol:'🍺 Алкоголь',activity:'🏃 Навантаження',sleep:'😴 Сон',headache:'🤕 Головний біль',tinnitus:'👂 Шум у вухах',dizziness:'😵 Запаморочення',fatigue:'😴 Втома'};
function quickEvent(type){
  document.getElementById('quickForm').classList.remove('hidden');
  document.getElementById('quickId').value='';
  document.getElementById('quickType').value=type;
  document.getElementById('quickDateTime').value=nowLocalInput();
  document.getElementById('quickValue').value= type==='sleep' ? 7 : type==='activity'?30 : 1;
  document.getElementById('quickNote').value='';
}
function hideQuickForm(){ document.getElementById('quickForm').classList.add('hidden'); }
function saveQuickEvent(e){
  e.preventDefault();
  const id=document.getElementById('quickId').value||uid();
  const rec={id,type:document.getElementById('quickType').value,time:new Date(document.getElementById('quickDateTime').value).toISOString(),value:+document.getElementById('quickValue').value,note:document.getElementById('quickNote').value.trim()};
  const i=state.events.findIndex(x=>x.id===id); if(i>=0) state.events[i]=rec; else state.events.push(rec);
  hideQuickForm(); renderAll();
}
function editEvent(id){
  const r=state.events.find(x=>x.id===id); if(!r) return;
  openModal('quickModal'); document.getElementById('quickForm').classList.remove('hidden');
  document.getElementById('quickId').value=r.id; document.getElementById('quickType').value=r.type; document.getElementById('quickDateTime').value=nowLocalInput(new Date(r.time)); document.getElementById('quickValue').value=r.value; document.getElementById('quickNote').value=r.note||'';
}
function delEvent(id){ if(confirm('Видалити подію?')){ state.events=state.events.filter(x=>x.id!==id); renderAll(); } }
function renderQuickEvents(){
  const list=document.getElementById('quickEventsList'); if(!list) return;
  list.innerHTML=[...state.events].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,20).map(e=>`<div class="list-item"><b>${quickLabels[e.type]||e.type}</b> · ${e.value}<br><span class="muted">${fmt.format(new Date(e.time))} ${escapeHtml(e.note||'')}</span><br><button onclick="editEvent('${e.id}')">✏️</button> <button onclick="delEvent('${e.id}')">🗑</button></div>`).join('') || '<div class="muted">Подій немає.</div>';
}

let cityTimer;
function searchCityDebounced(){ clearTimeout(cityTimer); cityTimer=setTimeout(searchCity,500); }
async function searchCity(){
  const q=document.getElementById('cityInput').value.trim(); if(q.length<2) return;
  const url=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=uk&format=json`;
  const res=await fetch(url); const data=await res.json();
  const box=document.getElementById('citySuggestions');
  box.innerHTML=(data.results||[]).map(c=>`<div class="suggestion" onclick='selectCity(${JSON.stringify({name:c.name,lat:c.latitude,lon:c.longitude,country:c.country,admin1:c.admin1}).replace(/'/g,"&#39;")})'><b>${c.name}</b> ${c.admin1||''} ${c.country||''}</div>`).join('') || '<div class="muted">Не знайдено</div>';
}
function selectCity(c){ state.city=c; document.getElementById('cityInput').value=c.name; document.getElementById('citySuggestions').innerHTML=''; renderAll(); fetchMissingWeather(); }
function useMyLocation(){
  navigator.geolocation?.getCurrentPosition(pos=>{ state.city={name:'Моє місце',lat:pos.coords.latitude,lon:pos.coords.longitude}; document.getElementById('cityInput').value='Моє місце'; renderAll(); fetchMissingWeather(); },()=>alert('Не вдалося отримати геолокацію'));
}
async function recordCurrentWeather(){
  if(!state.city?.lat) return alert('Спочатку виберіть місто');
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${state.city.lat}&longitude=${state.city.lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation&timezone=auto`;
  const r=await fetch(url); const d=await r.json(); const c=d.current;
  upsertWeather({time:new Date(c.time).toISOString(),temp:c.temperature_2m,humidity:c.relative_humidity_2m,pressure:c.surface_pressure,wind:c.wind_speed_10m,precip:c.precipitation||0});
  renderAll();
}
async function fetchMissingWeather(silent=false){
  if(!state.city?.lat) return;
  const startStr=document.getElementById('weatherStart')?.value || state.settings.weatherStart || '2026-06-20';
  state.settings.weatherStart=startStr; state.settings.weatherInterval=+(document.getElementById('weatherInterval')?.value || state.settings.weatherInterval || 2);
  const start=new Date(startStr+'T00:00:00'); const end=new Date();
  const startISO=start.toISOString().slice(0,10), endISO=end.toISOString().slice(0,10);
  try{
    const url=`https://archive-api.open-meteo.com/v1/archive?latitude=${state.city.lat}&longitude=${state.city.lon}&start_date=${startISO}&end_date=${endISO}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation&timezone=auto`;
    const r=await fetch(url); const d=await r.json();
    if(!d.hourly) throw new Error('no hourly');
    const step=state.settings.weatherInterval;
    d.hourly.time.forEach((t,i)=>{
      const hour=new Date(t).getHours();
      if(hour % step === 0){
        upsertWeather({time:new Date(t).toISOString(),temp:d.hourly.temperature_2m[i],humidity:d.hourly.relative_humidity_2m[i],pressure:d.hourly.surface_pressure[i],wind:d.hourly.wind_speed_10m[i],precip:d.hourly.precipitation[i]||0});
      }
    });
    renderAll();
  }catch(e){ if(!silent) alert('Не вдалося завантажити історію погоди. Спробуйте пізніше.'); }
}
function upsertWeather(w){
  if(w.pressure==null || w.temp==null) return;
  const key=new Date(w.time).toISOString().slice(0,13);
  const i=state.weather.findIndex(x=>new Date(x.time).toISOString().slice(0,13)===key);
  if(i>=0) state.weather[i]={...state.weather[i],...w}; else state.weather.push({...w,id:uid()});
}
function clearWeatherArchive(){ if(confirm('Очистити архів погоди?')){ state.weather=[]; renderAll(); } }
function renderWeather(){
  const rows=[...state.weather].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,500).map(w=>`<tr><td>${fmt.format(new Date(w.time))}</td><td>${w.temp?.toFixed(1)}°</td><td>${w.pressure?.toFixed(1)}</td><td>${w.humidity}%</td><td>${w.wind}</td><td>${w.precip}</td></tr>`).join('');
  document.getElementById('weatherTable').innerHTML=`<table><thead><tr><th>Дата</th><th>Темп</th><th>Тиск гПа</th><th>Вологість</th><th>Вітер</th><th>Опади</th></tr></thead><tbody>${rows||'<tr><td colspan=6>Архів порожній</td></tr>'}</tbody></table>`;
}

function renderChart(){
  const ctx=document.getElementById('mainChart'); if(!ctx) return;
  const days=+document.getElementById('chartRange')?.value||7; const from=days>1000?new Date(0):daysAgo(days);
  const bps=state.bp.filter(b=>new Date(b.time)>=from).sort((a,b)=>new Date(a.time)-new Date(b.time));
  const labels=bps.map(b=>fmt.format(new Date(b.time)));
  const pressureFor = b => { const w=nearestWeather(new Date(b.time)); return w? w.pressure : null; };
  const data={labels,datasets:[
    {label:'Верхній',data:bps.map(b=>b.sys),tension:.3},
    {label:'Нижній',data:bps.map(b=>b.dia),tension:.3},
    {label:'Пульс',data:bps.map(b=>b.pulse),tension:.3},
    {label:'Атм. тиск /10',data:bps.map(b=>{const p=pressureFor(b); return p? p/10:null}),tension:.3}
  ]};
  if(chart) chart.destroy();
  chart=new Chart(ctx,{type:'line',data,options:{responsive:true,plugins:{legend:{labels:{color:'#dbe9ff'}}},scales:{x:{ticks:{color:'#9fb1c9'}},y:{ticks:{color:'#9fb1c9'}}}}});
}

function renderAI(){
  document.getElementById('aiFull').textContent=fullAI();
  renderTriggers(); renderHeatmap();
}
function avg(arr){ return arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null; }
function dayRecords(day){ const s=dateOnly(day); return state.bp.filter(b=>dateOnly(b.time)===s); }
function dayEvents(day){ const s=dateOnly(day); return state.events.filter(e=>dateOnly(e.time)===s); }
function dayScore(day){
  const b=dayRecords(day); if(!b.length) return 0;
  let score=100;
  const maxSys=Math.max(...b.map(x=>x.sys)), maxDia=Math.max(...b.map(x=>x.dia)), maxPulse=Math.max(...b.map(x=>x.pulse));
  if(maxSys>=state.settings.limitSys) score-=20;
  if(maxDia>=state.settings.limitDia) score-=15;
  if(maxPulse>=state.settings.limitPulse) score-=12;
  const ev=dayEvents(day);
  if(ev.some(e=>e.type==='stress' && e.value>=7)) score-=15;
  if(ev.some(e=>e.type==='sleep' && e.value<6)) score-=15;
  if(ev.some(e=>e.type==='headache' && e.value>=5)) score-=10;
  return Math.max(10, Math.min(100, Math.round(score)));
}
function shortAI(){
  const last=[...state.bp].sort((a,b)=>new Date(b.time)-new Date(a.time))[0];
  if(!last) return 'Додайте перший запис тиску.';
  const risks=[];
  if(last.sys>=state.settings.limitSys) risks.push('верхній АТ підвищений');
  if(last.dia>=state.settings.limitDia) risks.push('нижній АТ підвищений');
  if(last.pulse>=state.settings.limitPulse) risks.push('пульс підвищений');
  const today=dayEvents(new Date());
  if(today.some(e=>e.type==='stress'&&e.value>=7)) risks.push('високий стрес');
  if(today.some(e=>e.type==='sleep'&&e.value<6)) risks.push('мало сну');
  return risks.length ? 'Увага: '+risks.join(', ')+'.' : 'Стан виглядає стабільно за останніми записами.';
}
function fullAI(){
  const n=state.bp.length; if(n<3) return 'Потрібно хоча б 3 записи тиску для базового AI-висновку.';
  const sys=avg(state.bp.map(b=>b.sys)), dia=avg(state.bp.map(b=>b.dia)), pulse=avg(state.bp.map(b=>b.pulse));
  const high=state.bp.filter(b=>b.sys>=state.settings.limitSys || b.dia>=state.settings.limitDia).length;
  const lines=[];
  lines.push(`За весь період записів: ${n}. Середній АТ: ${sys.toFixed(0)}/${dia.toFixed(0)}, середній пульс: ${pulse.toFixed(0)}.`);
  lines.push(`Підвищені значення були у ${Math.round(high/n*100)}% вимірювань.`);
  const tr=calcTriggers();
  if(tr.length){ lines.push('Ймовірні тригери: '+tr.slice(0,3).map(x=>`${x.name} (${x.effect})`).join('; ')+'.'); }
  const medCount=state.meds.length; if(medCount) lines.push(`Зафіксовано прийомів ліків: ${medCount}. Для точності аналізу робіть замір до прийому та через 1–2 години після.`);
  const w=[...state.weather].sort((a,b)=>new Date(b.time)-new Date(a.time))[0]; if(w) lines.push(`Останній атмосферний тиск: ${w.pressure.toFixed(1)} гПа. ${calcPressureDeltasText()}.`);
  lines.push('Важливо: це аналітичний щоденник, а не медичний діагноз. Рішення щодо ліків узгоджуйте з лікарем.');
  return lines.join('\n\n');
}
function calcTriggers(){
  const res=[];
  const base=avg(state.bp.map(b=>b.sys)); if(!base) return [];
  const check=(type,label,cond)=>{
    const dates=new Set(state.events.filter(e=>e.type===type && cond(e.value)).map(e=>dateOnly(e.time)));
    const rec=state.bp.filter(b=>dates.has(dateOnly(b.time)));
    if(rec.length>=2){ const a=avg(rec.map(b=>b.sys)); res.push({name:label,effect:`верхній АТ ${a-base>=0?'+':''}${(a-base).toFixed(1)} мм`,score:Math.abs(a-base)}); }
  };
  check('stress','Стрес',v=>v>=7); check('sleep','Сон <6 год',v=>v<6); check('coffee','Кава',v=>v>=2); check('alcohol','Алкоголь',v=>v>=1); check('headache','Головний біль',v=>v>=5);
  return res.sort((a,b)=>b.score-a.score);
}
function renderTriggers(){
  const tr=calcTriggers();
  document.getElementById('triggerList').innerHTML=tr.map(t=>`<div class="list-item"><b>${t.name}</b><br>${t.effect}</div>`).join('') || '<div class="muted">Поки замало даних для визначення тригерів.</div>';
}
function renderHeatmap(){
  const box=document.getElementById('hourHeatmap'); const items=[];
  for(let h=0;h<24;h+=4){
    const rec=state.bp.filter(b=>new Date(b.time).getHours()>=h && new Date(b.time).getHours()<h+4);
    const a=avg(rec.map(b=>b.sys)); const cls=!a?'':a>=145?'bad':a>=135?'mid':'good';
    items.push(`<div class="heat ${cls}"><b>${String(h).padStart(2,'0')}:00</b><br>${a?a.toFixed(0):'—'}</div>`);
  }
  box.innerHTML=items.join('');
}

function renderCalendar(){
  const month=document.getElementById('calendarMonth')?.value || new Date().toISOString().slice(0,7);
  const [y,m]=month.split('-').map(Number); const first=new Date(y,m-1,1); const last=new Date(y,m,0);
  const box=document.getElementById('calendarGrid'); let html='';
  ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'].forEach(d=>html+=`<div class="muted">${d}</div>`);
  let offset=(first.getDay()+6)%7; for(let i=0;i<offset;i++) html+='<div></div>';
  for(let d=1; d<=last.getDate(); d++){
    const day=new Date(y,m-1,d); const score=dayScore(day); const rec=dayRecords(day); const ev=dayEvents(day);
    const cls=score>=75?'good':score>=50?'mid':score>0?'bad':'';
    html+=`<div class="day ${cls}" onclick="showDayDetails('${day.toISOString()}')"><span class="num">${d}</span><small>${score?score+'/100':'—'}</small><small>АТ: ${rec.length}</small><small>Події: ${ev.length}</small></div>`;
  }
  box.innerHTML=html;
}
function showDayDetails(iso){
  const d=new Date(iso); const rec=dayRecords(d); const ev=dayEvents(d);
  alert(`${d.toLocaleDateString('uk-UA')}\n\nТиск: ${rec.map(r=>r.sys+'/'+r.dia+' пульс '+r.pulse).join('; ')||'немає'}\n\nПодії: ${ev.map(e=>(quickLabels[e.type]||e.type)+' '+e.value).join('; ')||'немає'}`);
}

function saveSettings(){
  state.settings.limitSys=+document.getElementById('limitSys').value;
  state.settings.limitDia=+document.getElementById('limitDia').value;
  state.settings.limitPulse=+document.getElementById('limitPulse').value;
  state.settings.weatherStart=document.getElementById('settingsWeatherStart').value;
  document.getElementById('weatherStart').value=state.settings.weatherStart;
  closeModal('settingsModal'); renderAll();
}
function toggleCustomReportDates(){
  const show=document.getElementById('reportPeriod').value==='custom';
  document.querySelectorAll('.customReport').forEach(x=>x.style.display=show?'flex':'none');
}
function reportRange(){
  const p=document.getElementById('reportPeriod').value; const now=new Date(); let from=new Date(0), to=now;
  if(p==='today'){ from=new Date(); from.setHours(0,0,0,0); }
  else if(p==='7') from=daysAgo(7); else if(p==='30') from=daysAgo(30);
  else if(p==='custom'){ from=new Date(document.getElementById('reportFrom').value+'T00:00:00'); to=new Date(document.getElementById('reportTo').value+'T23:59:59'); }
  return {from,to};
}
function generatePDFReport(){
  const {from,to}=reportRange(); const type=document.getElementById('reportType').value;
  const bp=state.bp.filter(x=>new Date(x.time)>=from&&new Date(x.time)<=to);
  const meds=state.meds.filter(x=>new Date(x.time)>=from&&new Date(x.time)<=to);
  const ev=state.events.filter(x=>new Date(x.time)>=from&&new Date(x.time)<=to);
  const w=state.weather.filter(x=>new Date(x.time)>=from&&new Date(x.time)<=to);
  const win=window.open('', '_blank');
  const title= type==='doctor'?'Короткий звіт для лікаря':type==='full'?'Повний звіт':type==='weather'?'Звіт погоди':'Журнал вимірювань';
  win.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}h1{margin-bottom:0}table{width:100%;border-collapse:collapse;margin:12px 0}td,th{border:1px solid #bbb;padding:6px;font-size:12px;text-align:left}.box{border:1px solid #aaa;padding:12px;margin:12px 0;white-space:pre-wrap}.muted{color:#555}</style></head><body>`);
  win.document.write(`<h1>${title}</h1><p class="muted">Період: ${from.toLocaleDateString('uk-UA')} — ${to.toLocaleDateString('uk-UA')} · Місто: ${escapeHtml(state.city?.name||'')}</p>`);
  if(type!=='weather') win.document.write(`<h2>AI-висновок</h2><div class="box">${escapeHtml(fullAI())}</div>`);
  if(type!=='weather') win.document.write(`<h2>Тиск і пульс</h2>${table(['Дата','АТ','Пульс','Стан','Примітка'], bp.map(r=>[fmt.format(new Date(r.time)), r.sys+'/'+r.dia, r.pulse, (r.wellbeing||'')+'/10', r.note||'']))}`);
  if(type==='full'||type==='doctor') win.document.write(`<h2>Ліки</h2>${table(['Дата','Ліки','Доза','Ефект'], meds.map(m=>[fmt.format(new Date(m.time)), m.name, m.dose||'', medEffect(m).text]))}`);
  if(type==='full'||type==='doctor') win.document.write(`<h2>Тригери/події</h2>${table(['Дата','Подія','Значення','Примітка'], ev.map(e=>[fmt.format(new Date(e.time)), quickLabels[e.type]||e.type, e.value, e.note||'']))}`);
  if(type==='full'||type==='weather') win.document.write(`<h2>Архів погоди</h2>${table(['Дата','Темп','Тиск','Вологість','Вітер','Опади'], w.map(x=>[fmt.format(new Date(x.time)), x.temp, x.pressure, x.humidity, x.wind, x.precip]))}`);
  win.document.write(`<p class="muted">Звіт створено програмою “Мій тиск AI”. Не є медичним діагнозом.</p></body></html>`);
  win.document.close(); win.focus(); setTimeout(()=>win.print(),500);
}
function table(headers, rows){
  return `<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(c??'')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}">Немає даних</td></tr>`}</tbody></table>`;
}
function backupData(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='health-radar-backup.json'; a.click();
}
function importData(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader(); reader.onload=()=>{ try{ state=JSON.parse(reader.result); saveState(); renderAll(); alert('Імпортовано'); }catch(err){ alert('Помилка імпорту'); } }; reader.readAsText(file);
}


function renderCorrelations(){
  const box=document.getElementById('correlationRanking'); if(!box) return;
  const factors=advancedCorrelations();
  box.innerHTML = factors.length ? factors.map((f,i)=>`
    <div class="list-item ${f.riskClass}">
      <b>${i+1}. ${f.label}</b><br>
      ${f.text}<br>
      <span class="muted">Записів для порівняння: ${f.count}</span>
      <div class="scorebar"><span style="width:${Math.min(100,Math.abs(f.delta)*5+10)}%"></span></div>
    </div>`).join('') : '<div class="muted">Потрібно більше записів тиску та подій.</div>';
  const exp=document.getElementById('correlationExplanation');
  if(exp) exp.textContent = correlationNarrative(factors);
}
function advancedCorrelations(){
  const baseSys=avg(state.bp.map(b=>b.sys));
  const basePulse=avg(state.bp.map(b=>b.pulse));
  if(!baseSys || state.bp.length<4) return [];
  const configs=[
    ['sleep','😴 Сон менше 6 год',v=>v<6],
    ['stress','😡 Стрес 7+',v=>v>=7],
    ['coffee','☕ Кава 2+',v=>v>=2],
    ['alcohol','🍺 Алкоголь',v=>v>=1],
    ['activity','🏃 Навантаження',v=>v>=30],
    ['headache','🤕 Головний біль 5+',v=>v>=5],
    ['tinnitus','👂 Шум у вухах 5+',v=>v>=5],
    ['dizziness','😵 Запаморочення 5+',v=>v>=5],
    ['fatigue','😴 Втома 5+',v=>v>=5]
  ];
  const out=[];
  configs.forEach(([type,label,cond])=>{
    const dates=new Set(state.events.filter(e=>e.type===type && cond(e.value)).map(e=>dateOnly(e.time)));
    const rec=state.bp.filter(b=>dates.has(dateOnly(b.time)));
    if(rec.length>=2){
      const s=avg(rec.map(b=>b.sys)), p=avg(rec.map(b=>b.pulse));
      const delta=s-baseSys, pulseDelta=p-basePulse;
      out.push({
        label,count:rec.length,delta,
        text:`Середній верхній АТ ${delta>=0?'+':''}${delta.toFixed(1)} мм від вашої бази; пульс ${pulseDelta>=0?'+':''}${pulseDelta.toFixed(1)}.`,
        riskClass: delta>=8?'risk-high':delta>=3?'risk-mid':'risk-low'
      });
    }
  });
  const pressureDrops = pressureDropDays(5,12);
  if(pressureDrops.size){
    const rec=state.bp.filter(b=>pressureDrops.has(dateOnly(b.time)));
    if(rec.length>=2){
      const s=avg(rec.map(b=>b.sys)); const delta=s-baseSys;
      out.push({label:'🌦 Падіння атм. тиску >5 гПа/12 год', count:rec.length, delta,
        text:`У такі дні верхній АТ ${delta>=0?'+':''}${delta.toFixed(1)} мм від бази.`,
        riskClass:delta>=8?'risk-high':delta>=3?'risk-mid':'risk-low'});
    }
  }
  return out.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
}
function pressureDropDays(threshold=5,hours=12){
  const set=new Set();
  const sorted=[...state.weather].sort((a,b)=>new Date(a.time)-new Date(b.time));
  sorted.forEach(w=>{
    const prev=nearestWeather(new Date(new Date(w.time).getTime()-hours*3600000));
    if(prev && prev.pressure - w.pressure >= threshold) set.add(dateOnly(w.time));
  });
  return set;
}
function correlationNarrative(factors){
  if(!factors.length) return 'Коли буде більше даних, тут з’явиться рейтинг факторів: сон, стрес, кава, алкоголь, погода, симптоми.';
  const top=factors[0];
  return `Найпомітніший фактор зараз: ${top.label}. ${top.text}

Як читати:
• “+10 мм” означає, що в дні з цим фактором верхній тиск у середньому вищий на 10 мм від вашої бази.
• Це не доводить причину, але показує сильну підозру на зв’язок.
• Чим більше записів, тим точніший висновок.`;
}

function renderNeuro(){
  const table=document.getElementById('neuroTable'); if(!table) return;
  const neuroTypes=['tinnitus','headache','dizziness','fatigue'];
  const rows=state.events.filter(e=>neuroTypes.includes(e.type)).sort((a,b)=>new Date(b.time)-new Date(a.time)).map(e=>`
    <tr><td>${fmt.format(new Date(e.time))}</td><td>${quickLabels[e.type]}</td><td>${e.value}/10</td><td>${escapeHtml(e.note||'')}</td><td><button onclick="editEvent('${e.id}')">✏️</button> <button onclick="delEvent('${e.id}')">🗑</button></td></tr>
  `).join('');
  table.innerHTML=`<table><thead><tr><th>Дата</th><th>Симптом</th><th>Оцінка</th><th>Примітка</th><th></th></tr></thead><tbody>${rows||'<tr><td colspan=5>Неврологічних записів немає</td></tr>'}</tbody></table>`;
  const ai=document.getElementById('neuroAI');
  if(ai) ai.textContent=neuroAnalysis();
}
function neuroAnalysis(){
  const neuro=['tinnitus','headache','dizziness','fatigue'];
  const ev=state.events.filter(e=>neuro.includes(e.type));
  if(ev.length<3) return 'Додайте хоча б 3 записи по шуму/болю/запамороченню/втомі, щоб побачити закономірності.';
  const lines=[];
  neuro.forEach(t=>{
    const arr=ev.filter(e=>e.type===t);
    if(arr.length){
      const av=avg(arr.map(e=>e.value));
      const high=arr.filter(e=>e.value>=5).length;
      lines.push(`${quickLabels[t]}: записів ${arr.length}, середнє ${av.toFixed(1)}/10, сильних епізодів ${high}.`);
    }
  });
  const dropDays=pressureDropDays(5,12);
  const neuroOnDrop=ev.filter(e=>dropDays.has(dateOnly(e.time)) && e.value>=5);
  if(neuroOnDrop.length) lines.push(`У дні падіння атмосферного тиску >5 гПа/12 год сильні неврологічні симптоми були ${neuroOnDrop.length} раз(и).`);
  lines.push('Для точності бажано фіксувати симптоми навіть коли вони слабкі або відсутні.');
  return lines.join('\n\n');
}

async function fetchTomorrowForecast(){
  const main=document.getElementById('tomorrowForecast');
  const list=document.getElementById('forecastFactors');
  if(!state.city?.lat){ main.textContent='Спочатку виберіть місто.'; return; }
  main.textContent='Завантажую прогноз...';
  try{
    const url=`https://api.open-meteo.com/v1/forecast?latitude=${state.city.lat}&longitude=${state.city.lon}&hourly=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation_probability&forecast_days=3&timezone=auto`;
    const r=await fetch(url); const d=await r.json();
    const tomorrow=new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    const ds=tomorrow.toISOString().slice(0,10);
    const idx=d.hourly.time.map((t,i)=>[t,i]).filter(x=>x[0].startsWith(ds)).map(x=>x[1]);
    if(!idx.length) throw new Error('no forecast');
    const pressures=idx.map(i=>d.hourly.surface_pressure[i]).filter(x=>x!=null);
    const temps=idx.map(i=>d.hourly.temperature_2m[i]).filter(x=>x!=null);
    const hums=idx.map(i=>d.hourly.relative_humidity_2m[i]).filter(x=>x!=null);
    const rain=idx.map(i=>d.hourly.precipitation_probability[i]||0);
    const pMax=Math.max(...pressures), pMin=Math.min(...pressures), pDelta=pMin-pMax;
    const avgHum=avg(hums), maxRain=Math.max(...rain), tempAvg=avg(temps);
    let risk=25; const factors=[];
    if(Math.abs(pDelta)>=5){ risk+=25; factors.push(`помітна зміна атмосферного тиску ${pDelta.toFixed(1)} гПа`); }
    if(avgHum>=80){ risk+=12; factors.push(`висока вологість ${avgHum.toFixed(0)}%`); }
    if(maxRain>=50){ risk+=10; factors.push(`ймовірність опадів до ${maxRain}%`); }
    const sensitive=advancedCorrelations().some(f=>f.label.includes('атм. тиску') && f.delta>3);
    if(sensitive){ risk+=15; factors.push('у вашій історії є реакція на падіння атмосферного тиску'); }
    risk=Math.min(95,Math.round(risk));
    const level=risk>=70?'🔴 високий':risk>=45?'🟡 середній':'🟢 низький';
    main.textContent=`Прогноз на завтра: ${level} ризик, ${risk}/100.

Середня температура: ${tempAvg.toFixed(1)}°C.
Атмосферний тиск: ${pMin.toFixed(1)}–${pMax.toFixed(1)} гПа.
Середня вологість: ${avgHum.toFixed(0)}%.
Максимальна ймовірність опадів: ${maxRain}%.

Причини: ${factors.length?factors.join('; '):'значних погодних ризиків не видно'}.

Рекомендація: завтра зробіть заміри АТ вранці, вдень і ввечері, особливо якщо буде головний біль, шум у вухах або запаморочення.`;
    list.innerHTML=factors.map(f=>`<div class="list-item">${escapeHtml(f)}</div>`).join('') || '<div class="list-item risk-low">Сильних погодних ризиків не знайдено.</div>';
  }catch(e){
    main.textContent='Не вдалося завантажити прогноз. Перевірте інтернет або місто.';
  }
}

function saveFirebaseConfig(){
  const v=document.getElementById('firebaseConfig')?.value || '';
  try{ if(v.trim()) JSON.parse(v); }catch(e){ alert('Config має бути JSON'); return; }
  state.settings.firebaseConfig=v.trim(); saveState(); alert('Firebase config збережено локально.');
}
function exportForCloud(){
  const blob=new Blob([JSON.stringify({updatedAt:new Date().toISOString(),data:state},null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='health-radar-cloud-export.json'; a.click();
}


/* ===== Health Radar 1.2: edit/delete improvements ===== */
function markDirtyAndRender(){
  if (typeof renderAll === 'function') renderAll();
  if (typeof scheduleCloudSave === 'function') scheduleCloudSave();
}
function confirmDelete(text){ return confirm(text || 'Видалити запис?'); }
function selectedIds(selector){ return Array.from(document.querySelectorAll(selector + ':checked')).map(x=>x.value); }
function toggleAll(prefix, checked){ document.querySelectorAll(`.${prefix}-check`).forEach(x=>x.checked=checked); }

function deleteSelectedBP(){
  const ids = selectedIds('.bp-check');
  if (!ids.length) return alert('Виберіть записи для видалення.');
  if (!confirmDelete(`Видалити вибрані записи тиску: ${ids.length}?`)) return;
  state.bp = state.bp.filter(x => !ids.includes(x.id));
  markDirtyAndRender();
}
function deleteSelectedMeds(){
  const ids = selectedIds('.med-check');
  if (!ids.length) return alert('Виберіть записи ліків для видалення.');
  if (!confirmDelete(`Видалити вибрані записи ліків: ${ids.length}?`)) return;
  state.meds = state.meds.filter(x => !ids.includes(x.id));
  markDirtyAndRender();
}
function deleteSelectedEvents(){
  const ids = selectedIds('.event-check');
  if (!ids.length) return alert('Виберіть події для видалення.');
  if (!confirmDelete(`Видалити вибрані події: ${ids.length}?`)) return;
  state.events = state.events.filter(x => !ids.includes(x.id));
  markDirtyAndRender();
}
function deleteSelectedWeather(){
  const ids = selectedIds('.weather-check');
  if (!ids.length) return alert('Виберіть записи погоди для видалення.');
  if (!confirmDelete(`Видалити вибрані записи погоди: ${ids.length}?`)) return;
  state.weather = state.weather.filter(x => !ids.includes(x.id));
  markDirtyAndRender();
}
function numOrNull(v){ return v === '' || v == null ? null : +v; }

function editWeather(id){
  const w = state.weather.find(x => x.id === id);
  if (!w) return;
  document.getElementById('weatherEditId').value = w.id;
  document.getElementById('weatherEditTime').value = nowLocalInput(new Date(w.time));
  document.getElementById('weatherEditTemp').value = w.temp ?? '';
  document.getElementById('weatherEditPressure').value = w.pressure ?? '';
  document.getElementById('weatherEditHumidity').value = w.humidity ?? '';
  document.getElementById('weatherEditWind').value = w.wind ?? '';
  document.getElementById('weatherEditPrecip').value = w.precip ?? '';
  openModal('weatherEditModal');
}
function saveWeatherEdit(e){
  e.preventDefault();
  const id = document.getElementById('weatherEditId').value || uid();
  const rec = {
    id,
    time: new Date(document.getElementById('weatherEditTime').value).toISOString(),
    temp: numOrNull(document.getElementById('weatherEditTemp').value),
    pressure: numOrNull(document.getElementById('weatherEditPressure').value),
    humidity: numOrNull(document.getElementById('weatherEditHumidity').value),
    wind: numOrNull(document.getElementById('weatherEditWind').value),
    precip: numOrNull(document.getElementById('weatherEditPrecip').value)
  };
  const i = state.weather.findIndex(x=>x.id===id);
  if (i>=0) state.weather[i] = rec; else state.weather.push(rec);
  closeModal('weatherEditModal');
  markDirtyAndRender();
}
function delWeather(id){
  if (!confirmDelete('Видалити запис погоди?')) return;
  state.weather = state.weather.filter(x => x.id !== id);
  markDirtyAndRender();
}

renderEntries = function(){
  const rows=[...state.bp].sort((a,b)=>new Date(b.time)-new Date(a.time)).map(r=>`
    <tr>
      <td class="select-col"><input class="bp-check" type="checkbox" value="${r.id}"></td>
      <td>${fmt.format(new Date(r.time))}</td>
      <td><b>${r.sys}/${r.dia}</b></td>
      <td>${r.pulse}</td>
      <td>${r.wellbeing}/10</td>
      <td>${escapeHtml(r.note||'')}</td>
      <td class="actions"><button onclick="editBP('${r.id}')">✏️</button><button class="danger" onclick="delBP('${r.id}')">🗑</button></td>
    </tr>`).join('');
  document.getElementById('entriesTable').innerHTML =
    `<div class="row wrap" style="margin-bottom:10px">
      <label class="mini-check"><input type="checkbox" onchange="toggleAll('bp', this.checked)"> вибрати всі</label>
      <span class="badge-mini">Записів: ${state.bp.length}</span>
    </div>
    <table><thead><tr><th></th><th>Дата</th><th>АТ</th><th>Пульс</th><th>Стан</th><th>Примітка</th><th>Дії</th></tr></thead>
    <tbody>${rows||'<tr><td colspan=7>Записів немає</td></tr>'}</tbody></table>`;
};

renderMeds = function(){
  const rows=[...state.meds].sort((a,b)=>new Date(b.time)-new Date(a.time)).map(m=>{
    const eff = medEffect(m);
    return `<tr>
      <td class="select-col"><input class="med-check" type="checkbox" value="${m.id}"></td>
      <td>${fmt.format(new Date(m.time))}</td>
      <td><b>${escapeHtml(m.name)}</b></td>
      <td>${escapeHtml(m.dose||'')}</td>
      <td>${eff.text}</td>
      <td>${escapeHtml(m.note||'')}</td>
      <td class="actions"><button onclick="editMed('${m.id}')">✏️</button><button class="danger" onclick="delMed('${m.id}')">🗑</button></td>
    </tr>`;
  }).join('');
  document.getElementById('medTable').innerHTML =
    `<div class="row wrap" style="margin-bottom:10px">
      <label class="mini-check"><input type="checkbox" onchange="toggleAll('med', this.checked)"> вибрати всі</label>
      <span class="badge-mini">Записів: ${state.meds.length}</span>
    </div>
    <table><thead><tr><th></th><th>Дата</th><th>Ліки</th><th>Доза</th><th>Ефект</th><th>Примітка</th><th>Дії</th></tr></thead>
    <tbody>${rows||'<tr><td colspan=7>Немає записів</td></tr>'}</tbody></table>`;
  const groups={};
  state.meds.forEach(m=>{
    const e=medEffect(m); if(e.sysDelta===null) return;
    const k=m.name.toLowerCase(); groups[k]=groups[k]||{name:m.name,n:0,sys:0,dia:0}; groups[k].n++; groups[k].sys+=e.sysDelta; groups[k].dia+=e.diaDelta;
  });
  document.getElementById('medAnalysis').innerHTML = Object.values(groups).map(g=>`<div class="list-item"><b>${escapeHtml(g.name)}</b><br>Прийомів з контрольним заміром: ${g.n}<br>Середній ефект: ${(g.sys/g.n).toFixed(1)}/${(g.dia/g.n).toFixed(1)} мм рт.ст.</div>`).join('') || '<div class="muted">Потрібні заміри до/після прийому.</div>';
};

renderWeather = function(){
  const rows=[...state.weather].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,1000).map(w=>`
    <tr>
      <td class="select-col"><input class="weather-check" type="checkbox" value="${w.id}"></td>
      <td>${fmt.format(new Date(w.time))}</td>
      <td>${w.temp==null?'—':Number(w.temp).toFixed(1)+'°'}</td>
      <td>${w.pressure==null?'—':Number(w.pressure).toFixed(1)}</td>
      <td>${w.humidity??'—'}%</td>
      <td>${w.wind??'—'}</td>
      <td>${w.precip??'—'}</td>
      <td class="actions"><button onclick="editWeather('${w.id}')">✏️</button><button class="danger" onclick="delWeather('${w.id}')">🗑</button></td>
    </tr>`).join('');
  document.getElementById('weatherTable').innerHTML =
    `<div class="row wrap" style="margin-bottom:10px">
      <button onclick="deleteSelectedWeather()">🗑 Видалити вибрані</button>
      <label class="mini-check"><input type="checkbox" onchange="toggleAll('weather', this.checked)"> вибрати всі</label>
      <span class="badge-mini">Погода: ${state.weather.length}</span>
    </div>
    <table><thead><tr><th></th><th>Дата</th><th>Темп</th><th>Тиск гПа</th><th>Вологість</th><th>Вітер</th><th>Опади</th><th>Дії</th></tr></thead>
    <tbody>${rows||'<tr><td colspan=8>Архів порожній</td></tr>'}</tbody></table>`;
};

renderQuickEvents = function(){
  const list=document.getElementById('quickEventsList'); if(!list) return;
  const items=[...state.events].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,50).map(e=>`
    <div class="list-item">
      <label class="mini-check"><input class="event-check" type="checkbox" value="${e.id}"> <b>${quickLabels[e.type]||e.type}</b> · ${e.value}</label>
      <span class="muted">${fmt.format(new Date(e.time))} ${escapeHtml(e.note||'')}</span><br>
      <button onclick="editEvent('${e.id}')">✏️</button>
      <button class="danger" onclick="delEvent('${e.id}')">🗑</button>
    </div>`).join('');
  list.innerHTML =
    `<div class="row wrap" style="margin-bottom:10px"><button onclick="deleteSelectedEvents()">🗑 Видалити вибрані</button><span class="badge-mini">Подій: ${state.events.length}</span></div>` + (items || '<div class="muted">Подій немає.</div>');
};

delBP = function(id){
  if(confirmDelete('Видалити запис тиску?')){
    state.bp=state.bp.filter(x=>x.id!==id);
    markDirtyAndRender();
  }
};
delMed = function(id){
  if(confirmDelete('Видалити прийом ліків?')){
    state.meds=state.meds.filter(x=>x.id!==id);
    markDirtyAndRender();
  }
};
delEvent = function(id){
  if(confirmDelete('Видалити подію?')){
    state.events=state.events.filter(x=>x.id!==id);
    markDirtyAndRender();
  }
};

const __oldSaveBP = saveBP;
saveBP = function(e){ __oldSaveBP(e); if (typeof scheduleCloudSave === 'function') scheduleCloudSave(); };
const __oldSaveMed = saveMed;
saveMed = function(e){ __oldSaveMed(e); if (typeof scheduleCloudSave === 'function') scheduleCloudSave(); };
const __oldSaveQuickEvent = saveQuickEvent;
saveQuickEvent = function(e){ __oldSaveQuickEvent(e); if (typeof scheduleCloudSave === 'function') scheduleCloudSave(); };

function initEditDeleteStage(){
  try{
    const el=document.getElementById('autoSyncToggle');
    if(el){
      const stored=localStorage.getItem('healthRadarAutoSync');
      el.checked = stored === null ? true : stored === 'true';
    }
  }catch(e){}
}
window.addEventListener('load', initEditDeleteStage);


/* ===== Health Radar 1.3: weather autofix/status ===== */

function weatherIntervalHours(){
  return +(document.getElementById('weatherInterval')?.value || state.settings?.weatherInterval || 2);
}

function latestArchiveWeather(){
  return [...(state.weather||[])].sort((a,b)=>new Date(b.time)-new Date(a.time))[0] || null;
}

function nextWeatherSlot(fromDate=new Date()){
  const step = weatherIntervalHours();
  const d = new Date(fromDate);
  d.setMinutes(0,0,0);
  const h = d.getHours();
  const nextH = Math.ceil((h + 0.001) / step) * step;
  if(nextH >= 24){
    d.setDate(d.getDate()+1);
    d.setHours(0,0,0,0);
  } else {
    d.setHours(nextH,0,0,0);
  }
  return d;
}

function weatherAutoStatusText(){
  const latest = latestArchiveWeather();
  const step = weatherIntervalHours();
  const next = nextWeatherSlot();
  if(!latest){
    return `Автопогода: архів ще порожній. Інтервал: кожні ${step} год. Натисніть “Оновити пропущені дані”.`;
  }
  const ageH = (new Date() - new Date(latest.time)) / 3600000;
  const status = ageH <= step + 0.5 ? '✅ актуально' : '⚠️ є пропущені записи';
  return `Автопогода: ${status}. Останній архівний запис: ${fmt.format(new Date(latest.time))}. Наступний слот: ${fmt.format(next)}. Якщо сайт був закритий — пропуски дозаписуються при відкритті.`;
}

function renderWeatherAutoStatus(){
  const el = document.getElementById('weatherAutoStatus');
  if(el) el.textContent = weatherAutoStatusText();
}

/* Override dashboard weather card to show source clearly */
const __oldRenderDashboardWeatherFix = renderDashboard;
renderDashboard = function(){
  __oldRenderDashboardWeatherFix();

  const latest = latestArchiveWeather();
  if(latest){
    const weatherNow = document.getElementById('weatherNow');
    const weatherMeta = document.getElementById('weatherMeta');
    const atmPressure = document.getElementById('atmPressure');
    if(weatherNow) weatherNow.textContent = `${Math.round(latest.temp)}°C`;
    if(weatherMeta) {
      weatherMeta.innerHTML = `${state.city?.name||''} · вологість ${latest.humidity}% · вітер ${latest.wind} м/с <span class="weather-source-note">з архіву: ${fmt.format(new Date(latest.time))}</span>`;
    }
    if(atmPressure) atmPressure.textContent = `${Number(latest.pressure).toFixed(1)} гПа`;
  }
  renderWeatherAutoStatus();
};

/* Make fetchMissingWeather update status and cloud */
const __oldFetchMissingWeather = fetchMissingWeather;
fetchMissingWeather = async function(silent=false){
  const r = await __oldFetchMissingWeather(silent);
  renderWeatherAutoStatus();
  if(typeof scheduleCloudSave === 'function') scheduleCloudSave();
  return r;
};

const __oldRecordCurrentWeather = recordCurrentWeather;
recordCurrentWeather = async function(){
  const r = await __oldRecordCurrentWeather();
  renderWeatherAutoStatus();
  if(typeof scheduleCloudSave === 'function') scheduleCloudSave();
  return r;
};

/* On opening site: refresh missed weather once, then repeat every 30 minutes */
function startWeatherAutoRecorder(){
  setTimeout(()=>fetchMissingWeather(true), 2500);
  setInterval(()=>fetchMissingWeather(true), 30*60*1000);
}
window.addEventListener('load', startWeatherAutoRecorder);


/* ===== Health Radar 1.4: current-time weather fix ===== */

/* Беремо не останній запис дня, а найближчий до поточного часу без майбутнього */
function currentArchiveWeather(){
  const now = new Date();
  const items = [...(state.weather || [])]
    .filter(w => w && w.time && new Date(w.time) <= now)
    .sort((a,b) => new Date(b.time) - new Date(a.time));
  return items[0] || null;
}

/* Найближчий запис взагалі, якщо треба для fallback */
function nearestArchiveWeatherToNow(){
  const now = new Date();
  let best = null;
  let bestDiff = Infinity;
  (state.weather || []).forEach(w => {
    if(!w || !w.time) return;
    const diff = Math.abs(new Date(w.time) - now);
    if(diff < bestDiff){
      best = w;
      bestDiff = diff;
    }
  });
  return best;
}

/* Переписуємо dashboard: картка Погода показує актуальний час, а не вечірній прогноз */
const __oldRenderDashboardCurrentWeatherFix = renderDashboard;
renderDashboard = function(){
  __oldRenderDashboardCurrentWeatherFix();

  const current = currentArchiveWeather() || nearestArchiveWeatherToNow();
  if(current){
    const weatherNow = document.getElementById('weatherNow');
    const weatherMeta = document.getElementById('weatherMeta');
    const atmPressure = document.getElementById('atmPressure');

    if(weatherNow) weatherNow.textContent = `${Math.round(current.temp)}°C`;

    if(weatherMeta) {
      weatherMeta.innerHTML =
        `${state.city?.name || ''} · вологість ${current.humidity}% · вітер ${current.wind} м/с` +
        `<span class="weather-source-note">поточний архівний запис: ${fmt.format(new Date(current.time))}</span>`;
    }

    if(atmPressure) atmPressure.textContent = `${Number(current.pressure).toFixed(1)} гПа`;
  }

  if(typeof renderWeatherAutoStatus === 'function') renderWeatherAutoStatus();
};

/* Таблиця архіву: майбутні години показуємо окремо як прогноз, але зверху поточний/минулий час */
const __oldRenderWeatherCurrentFix = renderWeather;
renderWeather = function(){
  const now = new Date();

  const past = [...(state.weather || [])]
    .filter(w => new Date(w.time) <= now)
    .sort((a,b)=>new Date(b.time)-new Date(a.time));

  const future = [...(state.weather || [])]
    .filter(w => new Date(w.time) > now)
    .sort((a,b)=>new Date(a.time)-new Date(b.time));

  const ordered = [...past, ...future];

  const rows = ordered.slice(0,1000).map(w=>{
    const isFuture = new Date(w.time) > now;
    return `
    <tr ${isFuture ? 'class="future-weather"' : ''}>
      <td class="select-col"><input class="weather-check" type="checkbox" value="${w.id}"></td>
      <td>${fmt.format(new Date(w.time))} ${isFuture ? '<span class="badge-mini">прогноз</span>' : ''}</td>
      <td>${w.temp==null?'—':Number(w.temp).toFixed(1)+'°'}</td>
      <td>${w.pressure==null?'—':Number(w.pressure).toFixed(1)}</td>
      <td>${w.humidity??'—'}%</td>
      <td>${w.wind??'—'}</td>
      <td>${w.precip??'—'}</td>
      <td class="actions"><button onclick="editWeather('${w.id}')">✏️</button><button class="danger" onclick="delWeather('${w.id}')">🗑</button></td>
    </tr>`;
  }).join('');

  document.getElementById('weatherTable').innerHTML =
    `<div class="row wrap" style="margin-bottom:10px">
      <button onclick="deleteSelectedWeather()">🗑 Видалити вибрані</button>
      <label class="mini-check"><input type="checkbox" onchange="toggleAll('weather', this.checked)"> вибрати всі</label>
      <span class="badge-mini">Архів: ${past.length}</span>
      <span class="badge-mini">Прогноз: ${future.length}</span>
    </div>
    <table>
      <thead><tr><th></th><th>Дата</th><th>Темп</th><th>Тиск гПа</th><th>Вологість</th><th>Вітер</th><th>Опади</th><th>Дії</th></tr></thead>
      <tbody>${rows || '<tr><td colspan=8>Архів порожній</td></tr>'}</tbody>
    </table>`;
};


/* ===== Health Radar 1.5: contextual quick dropdowns/forms ===== */

const quickPresets = {
  stress: {
    title:'😡 Стрес',
    hint:'Оцініть рівень стресу від 0 до 10.',
    unit:'рівень',
    defaultValue:1,
    buttons:[0,1,2,3,4,5,6,7,8,9,10],
    extra:''
  },
  coffee: {
    title:'☕ Кава',
    hint:'Скільки чашок кави сьогодні?',
    unit:'чашок',
    defaultValue:1,
    buttons:[1,2,3,4,5],
    extra:''
  },
  alcohol: {
    title:'🍺 Алкоголь',
    hint:'Вкажіть кількість порцій алкоголю.',
    unit:'порцій',
    defaultValue:1,
    buttons:[0,1,2,3,4,5],
    extra:`<label>Тип алкоголю
      <select id="quickExtra">
        <option value="">не вказано</option>
        <option value="пиво">🍺 Пиво</option>
        <option value="вино">🍷 Вино</option>
        <option value="міцний">🥃 Міцний</option>
      </select>
    </label>`
  },
  activity: {
    title:'🏃 Навантаження',
    hint:'Оберіть тип активності та тривалість у хвилинах.',
    unit:'хв',
    defaultValue:30,
    buttons:[10,20,30,45,60,90,120],
    extra:`<label>Тип активності
      <select id="quickExtra">
        <option value="ходьба">🚶 Ходьба</option>
        <option value="біг">🏃 Біг</option>
        <option value="тренування">💪 Тренування</option>
        <option value="робота">🛠 Робота/навантаження</option>
      </select>
    </label>`
  },
  sleep: {
    title:'😴 Сон',
    hint:'Вкажіть години сну та якість.',
    unit:'год',
    defaultValue:7,
    buttons:[4,5,6,7,8,9,10],
    extra:`<label>Якість сну
      <select id="quickExtra">
        <option value="1">1 — дуже погано</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5" selected>5 — нормально</option>
        <option value="6">6</option>
        <option value="7">7</option>
        <option value="8">8</option>
        <option value="9">9</option>
        <option value="10">10 — добре</option>
      </select>
    </label>`
  },
  headache: {
    title:'🤕 Головний біль',
    hint:'Оцініть біль від 0 до 10.',
    unit:'рівень',
    defaultValue:1,
    buttons:[0,1,2,3,4,5,6,7,8,9,10],
    extra:''
  },
  tinnitus: {
    title:'👂 Шум у вухах',
    hint:'Оцініть шум у вухах від 0 до 10.',
    unit:'рівень',
    defaultValue:1,
    buttons:[0,1,2,3,4,5,6,7,8,9,10],
    extra:''
  },
  dizziness: {
    title:'😵 Запаморочення',
    hint:'Оцініть запаморочення від 0 до 10.',
    unit:'рівень',
    defaultValue:1,
    buttons:[0,1,2,3,4,5,6,7,8,9,10],
    extra:''
  },
  fatigue: {
    title:'😴 Втома',
    hint:'Оцініть втому від 0 до 10.',
    unit:'рівень',
    defaultValue:1,
    buttons:[0,1,2,3,4,5,6,7,8,9,10],
    extra:''
  }
};

function quickEvent(type){
  if(type === 'bp' || type === 'pressure'){
    closeModal('quickModal');
    openBPModal();
    return;
  }

  const cfg = quickPresets[type] || {
    title: quickLabels[type] || 'Швидка подія',
    hint: 'Вкажіть значення.',
    unit: 'значення',
    defaultValue: 1,
    buttons: [0,1,2,3,4,5,6,7,8,9,10],
    extra:''
  };

  document.getElementById('quickForm').classList.remove('hidden');
  document.getElementById('quickId').value='';
  document.getElementById('quickType').value=type;
  document.getElementById('quickDateTime').value=nowLocalInput();
  document.getElementById('quickNote').value='';

  const title = document.getElementById('quickFormTitle');
  const hint = document.getElementById('quickFormHint');
  if(title) title.textContent = cfg.title;
  if(hint) hint.textContent = cfg.hint;

  renderQuickDynamicFields(type, cfg.defaultValue);
}

function renderQuickDynamicFields(type, value){
  const cfg = quickPresets[type] || {};
  const box = document.getElementById('quickDynamicFields');
  if(!box) return;

  const buttons = (cfg.buttons || []).map(v =>
    `<button type="button" class="${Number(v)===Number(value)?'active':''}" onclick="setQuickValue(${v})">${v}</button>`
  ).join('');

  box.innerHTML = `
    <label>Значення (${cfg.unit || 'значення'})
      <input type="number" step="0.1" id="quickValue" value="${value}">
    </label>
    <div class="quick-options">${buttons}</div>
    <div class="quick-fields-grid">${cfg.extra || ''}</div>
  `;
}

function setQuickValue(v){
  const input = document.getElementById('quickValue');
  if(input) input.value = v;
  const type = document.getElementById('quickType')?.value;
  const cfg = quickPresets[type] || {};
  const box = document.getElementById('quickDynamicFields');
  if(box){
    const extraValue = document.getElementById('quickExtra')?.value;
    renderQuickDynamicFields(type, v);
    if(extraValue !== undefined && document.getElementById('quickExtra')) {
      document.getElementById('quickExtra').value = extraValue;
    }
  }
}

/* Edit existing event now opens the correct contextual form */
function editEvent(id){
  const r=state.events.find(x=>x.id===id); if(!r) return;
  openModal('quickModal');

  const type = r.type;
  const cfg = quickPresets[type] || {
    title: quickLabels[type] || 'Швидка подія',
    hint: 'Вкажіть значення.',
    unit: 'значення',
    defaultValue: r.value || 1,
    buttons: [0,1,2,3,4,5,6,7,8,9,10],
    extra:''
  };

  document.getElementById('quickForm').classList.remove('hidden');
  document.getElementById('quickId').value=r.id;
  document.getElementById('quickType').value=type;
  document.getElementById('quickDateTime').value=nowLocalInput(new Date(r.time));
  document.getElementById('quickNote').value=r.note||'';

  const title = document.getElementById('quickFormTitle');
  const hint = document.getElementById('quickFormHint');
  if(title) title.textContent = cfg.title;
  if(hint) hint.textContent = cfg.hint;

  renderQuickDynamicFields(type, r.value ?? cfg.defaultValue ?? 1);

  if(r.extra && document.getElementById('quickExtra')){
    document.getElementById('quickExtra').value = r.extra;
  }
}

/* Save extra field too */
function saveQuickEvent(e){
  e.preventDefault();
  const id=document.getElementById('quickId').value||uid();
  const extraEl = document.getElementById('quickExtra');
  const rec={
    id,
    type:document.getElementById('quickType').value,
    time:new Date(document.getElementById('quickDateTime').value).toISOString(),
    value:+document.getElementById('quickValue').value,
    extra: extraEl ? extraEl.value : '',
    note:document.getElementById('quickNote').value.trim()
  };
  const i=state.events.findIndex(x=>x.id===id);
  if(i>=0) state.events[i]=rec; else state.events.push(rec);
  hideQuickForm();
  renderAll();
  if(typeof scheduleCloudSave === 'function') scheduleCloudSave();
}

/* Better event list displays extra value */
renderQuickEvents = function(){
  const list=document.getElementById('quickEventsList'); if(!list) return;
  const items=[...state.events].sort((a,b)=>new Date(b.time)-new Date(a.time)).slice(0,50).map(e=>`
    <div class="list-item">
      <label class="mini-check"><input class="event-check" type="checkbox" value="${e.id}"> <b>${quickLabels[e.type]||e.type}</b> · ${e.value}${e.extra ? ' · ' + escapeHtml(e.extra) : ''}</label>
      <span class="muted">${fmt.format(new Date(e.time))} ${escapeHtml(e.note||'')}</span><br>
      <button onclick="editEvent('${e.id}')">✏️</button>
      <button class="danger" onclick="delEvent('${e.id}')">🗑</button>
    </div>`).join('');
  list.innerHTML =
    `<div class="row wrap" style="margin-bottom:10px"><button onclick="deleteSelectedEvents()">🗑 Видалити вибрані</button><span class="badge-mini">Подій: ${state.events.length}</span></div>` + (items || '<div class="muted">Подій немає.</div>');
};


/* ===== Health Radar 1.5.2: quick buttons open modal fix ===== */

/*
  Проблема: кнопки у вкладці “Неврологія” викликали quickEvent(),
  але форма знаходиться всередині модального вікна quickModal.
  Тому форма створювалась, але користувач її не бачив.
*/

const __quickEventBefore152 = quickEvent;
quickEvent = function(type){
  // Тиск відкриває окрему форму АТ
  if(type === 'bp' || type === 'pressure'){
    closeModal('quickModal');
    openBPModal();
    return;
  }

  // Завжди відкриваємо модальне вікно швидкого запису,
  // незалежно від того, звідки натиснута кнопка.
  const modal = document.getElementById('quickModal');
  if(modal && !modal.classList.contains('show')){
    openModal('quickModal');
  }

  return __quickEventBefore152(type);
};

/* Додаємо окремі прямі кнопки у неврології, щоб вони теж відкривали форму */
function openNeuroQuick(type){
  openModal('quickModal');
  quickEvent(type);
}

/* Якщо на сторінці є кнопки неврології, переприв'язуємо їх безпечніше */
function patchNeuroButtons(){
  document.querySelectorAll('#tab-neuro button').forEach(btn => {
    const text = btn.textContent || '';
    if(text.includes('Шум')) btn.onclick = () => openNeuroQuick('tinnitus');
    if(text.includes('Головний')) btn.onclick = () => openNeuroQuick('headache');
    if(text.includes('Запамороч')) btn.onclick = () => openNeuroQuick('dizziness');
    if(text.includes('Втом')) btn.onclick = () => openNeuroQuick('fatigue');
  });
}

window.addEventListener('load', patchNeuroButtons);
setTimeout(patchNeuroButtons, 800);


/* ===== Health Radar 1.5.3 HARD FIX: quick buttons ===== */
/* This block does not depend on old quickEvent handlers. It captures clicks directly. */

const HR_QUICK_CONFIG = {
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

function hrQuickTypeFromText(txt){
  txt = (txt || '').toLowerCase();
  if(txt.includes('стрес')) return 'stress';
  if(txt.includes('кава')) return 'coffee';
  if(txt.includes('алког')) return 'alcohol';
  if(txt.includes('навантаж')) return 'activity';
  if(txt.includes('сон')) return 'sleep';
  if(txt.includes('голов') || txt.includes('біль')) return 'headache';
  if(txt.includes('шум')) return 'tinnitus';
  if(txt.includes('запамор')) return 'dizziness';
  if(txt.includes('втом')) return 'fatigue';
  if(txt.includes('тиск')) return 'bp';
  return null;
}

function hrShowModal(id){
  const m = document.getElementById(id);
  if(!m) return;
  m.classList.add('show');
  m.style.display = 'flex';
}

function hrHideModal(id){
  const m = document.getElementById(id);
  if(!m) return;
  m.classList.remove('show');
  m.style.display = '';
}

function hrOpenQuick(type, existing=null){
  if(type === 'bp'){
    hrHideModal('quickModal');
    if(typeof openBPModal === 'function') openBPModal();
    return;
  }

  const cfg = HR_QUICK_CONFIG[type] || HR_QUICK_CONFIG.stress;
  hrShowModal('quickModal');

  const form = document.getElementById('quickForm');
  if(!form) {
    alert('Не знайдено quickForm у index.html');
    return;
  }

  form.classList.remove('hidden');

  const idEl = document.getElementById('quickId');
  const typeEl = document.getElementById('quickType');
  const dtEl = document.getElementById('quickDateTime');
  const noteEl = document.getElementById('quickNote');
  const titleEl = document.getElementById('quickFormTitle');
  const hintEl = document.getElementById('quickFormHint');

  if(idEl) idEl.value = existing?.id || '';
  if(typeEl) typeEl.value = type;
  if(dtEl) dtEl.value = existing?.time ? nowLocalInput(new Date(existing.time)) : nowLocalInput();
  if(noteEl) noteEl.value = existing?.note || '';
  if(titleEl) titleEl.textContent = cfg.title;
  if(hintEl) hintEl.textContent = cfg.hint;

  hrRenderQuickFields(type, existing?.value ?? cfg.def, existing?.extra || '');
}

function hrRenderQuickFields(type, value, extraValue=''){
  const cfg = HR_QUICK_CONFIG[type] || HR_QUICK_CONFIG.stress;
  const box = document.getElementById('quickDynamicFields');
  if(!box) return;

  const buttons = (cfg.btn || []).map(v =>
    `<button type="button" class="${Number(v)===Number(value)?'active':''}" data-hr-set-value="${v}">${v}</button>`
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

/* Capture clicks before old inline onclick can break anything */
document.addEventListener('click', function(e){
  const btn = e.target.closest('button');
  if(!btn) return;

  const onclick = btn.getAttribute('onclick') || '';
  const txt = btn.textContent || '';
  const isQuick = onclick.includes('quickEvent') || btn.closest('#tab-neuro') || btn.closest('#quickModal .quick-grid');

  if(!isQuick) return;

  const type = hrQuickTypeFromText(txt) || (onclick.match(/quickEvent\('([^']+)'\)/)?.[1]);
  if(!type) return;

  e.preventDefault();
  e.stopImmediatePropagation();
  hrOpenQuick(type);
}, true);

/* Value buttons inside dynamic quick form */
document.addEventListener('click', function(e){
  const b = e.target.closest('[data-hr-set-value]');
  if(!b) return;
  e.preventDefault();
  const v = b.getAttribute('data-hr-set-value');
  const input = document.getElementById('quickValue');
  if(input) input.value = v;
  document.querySelectorAll('.quick-options button').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
}, true);

/* Save quick form reliably */
document.addEventListener('submit', function(e){
  if(e.target?.id !== 'quickForm') return;
  e.preventDefault();

  const id = document.getElementById('quickId')?.value || uid();
  const type = document.getElementById('quickType')?.value || 'stress';
  const dt = document.getElementById('quickDateTime')?.value || nowLocalInput();
  const val = +(document.getElementById('quickValue')?.value || 0);
  const extra = document.getElementById('quickExtra')?.value || '';
  const note = document.getElementById('quickNote')?.value?.trim() || '';

  const rec = { id, type, time:new Date(dt).toISOString(), value:val, extra, note };
  const i = state.events.findIndex(x=>x.id===id);
  if(i>=0) state.events[i]=rec; else state.events.push(rec);

  const form = document.getElementById('quickForm');
  if(form) form.classList.add('hidden');

  if(typeof renderAll === 'function') renderAll();
  if(typeof scheduleCloudSave === 'function') scheduleCloudSave();
}, true);

/* Override edit event too */
editEvent = function(id){
  const r = state.events.find(x=>x.id===id);
  if(!r) return;
  hrOpenQuick(r.type, r);
};

/* Make close button reset display */
const __oldCloseModal153 = closeModal;
closeModal = function(id){
  __oldCloseModal153(id);
  const m = document.getElementById(id);
  if(m) m.style.display = '';
};


/* ===== Health Radar 1.5.7: simple close fix, no click interception ===== */
window.HR_CLOSE_QUICK = function(){
  const m = document.getElementById('quickModal');
  if(m){
    m.classList.remove('show');
    m.style.display = 'none';
  }
  const f = document.getElementById('quickForm');
  if(f) f.classList.add('hidden');
};

/* Override closeModal only for quickModal, leave all buttons intact */
const __oldCloseModal157 = window.closeModal;
window.closeModal = function(id){
  if(id === 'quickModal'){
    HR_CLOSE_QUICK();
    return;
  }
  if(typeof __oldCloseModal157 === 'function') return __oldCloseModal157(id);
  const m = document.getElementById(id);
  if(m) m.classList.remove('show');
};

/* Esc closes quick modal */
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape') HR_CLOSE_QUICK();
});

/* Clicking backdrop closes only if the click is exactly on the backdrop */
document.addEventListener('click', function(e){
  if(e.target && e.target.id === 'quickModal') HR_CLOSE_QUICK();
});


/* ===== Health Radar 1.6.0: Hybrid AI Assistant ===== */

function aiStateSummary(){
  const bp = [...(state.bp||[])].sort((a,b)=>new Date(a.time)-new Date(b.time));
  const meds = [...(state.meds||[])].sort((a,b)=>new Date(a.time)-new Date(b.time));
  const events = [...(state.events||[])].sort((a,b)=>new Date(a.time)-new Date(b.time));
  const weather = [...(state.weather||[])].sort((a,b)=>new Date(a.time)-new Date(b.time));

  const lastBP = bp.at(-1);
  const lastWeather = weather.filter(w=>new Date(w.time)<=new Date()).at(-1) || weather.at(-1);
  const recentBP = bp.slice(-10);
  const recentEvents = events.slice(-20);
  const recentMeds = meds.slice(-10);

  const avg = arr => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : null;
  const avgSys = avg(recentBP.map(x=>+x.sys).filter(Boolean));
  const avgDia = avg(recentBP.map(x=>+x.dia).filter(Boolean));
  const avgPulse = avg(recentBP.map(x=>+x.pulse).filter(Boolean));

  const highCount = recentBP.filter(x=>x.sys>=140 || x.dia>=90).length;
  const crisis = recentBP.filter(x=>x.sys>=180 || x.dia>=120).length;

  return {
    counts:{bp:bp.length, meds:meds.length, events:events.length, weather:weather.length},
    lastBP,
    lastWeather,
    averages:{sys:avgSys, dia:avgDia, pulse:avgPulse},
    highCount,
    crisis,
    recentBP,
    recentMeds,
    recentEvents,
    recentWeather: weather.slice(-12),
    city: state.city || null,
    settings: state.settings || {}
  };
}

function buildLocalAIAnswer(question){
  const s = aiStateSummary();
  const lines = [];
  const q = (question||'').toLowerCase();

  lines.push('Локальний AI-висновок по ваших записах:');

  if(!s.counts.bp){
    return 'Поки що немає записів тиску. Додайте хоча б 3–6 замірів АТ, пульс, сон/стрес/каву та ліки — тоді аналіз буде кориснішим.';
  }

  if(s.lastBP){
    const risk = (s.lastBP.sys>=180 || s.lastBP.dia>=120) ? 'критично високий' :
                 (s.lastBP.sys>=140 || s.lastBP.dia>=90) ? 'підвищений' : 'відносно стабільний';
    lines.push(`\nОстанній АТ: ${s.lastBP.sys}/${s.lastBP.dia}, пульс ${s.lastBP.pulse || '—'} — стан: ${risk}.`);
  }

  if(s.averages.sys){
    lines.push(`Середнє за останні ${s.recentBP.length} записів: ${s.averages.sys.toFixed(1)}/${s.averages.dia.toFixed(1)}, пульс ${s.averages.pulse ? s.averages.pulse.toFixed(1) : '—'}.`);
  }

  if(s.highCount){
    lines.push(`Підвищені значення серед останніх записів: ${s.highCount} з ${s.recentBP.length}.`);
  }

  if(s.crisis){
    lines.push(`\n⚠️ Увага: є записи рівня 180/120 або вище. Якщо це реальний замір або є біль у грудях, слабкість, порушення мовлення, сильний головний біль — потрібна невідкладна допомога.`);
  }

  const triggerText = localTriggerAnalysis(s);
  if(triggerText) lines.push('\nЙмовірні тригери:\n' + triggerText);

  if(q.includes('ліки') || q.includes('допом') || q.includes('ефект')){
    lines.push('\nЛіки:\n' + localMedAnalysisText(s));
  }

  if(q.includes('погода') || q.includes('атмос') || q.includes('голов') || q.includes('шум')){
    lines.push('\nПогода/неврологія:\n' + localWeatherNeuroText(s));
  }

  lines.push('\nЩо варто зробити далі:');
  lines.push('• фіксувати АТ до ліків і через 30/60/120 хв після прийому;');
  lines.push('• записувати сон, стрес, каву, шум у вухах/головний біль навіть коли симптом слабкий;');
  lines.push('• для лікаря корисно мати 7–14 днів регулярних замірів.');

  return lines.join('\n');
}

function localTriggerAnalysis(s){
  const ev = s.recentEvents || [];
  if(!ev.length) return 'Поки мало подій/тригерів. Додавайте сон, стрес, каву, алкоголь, симптоми.';

  const byType = {};
  ev.forEach(e=>{
    byType[e.type] = byType[e.type] || [];
    byType[e.type].push(+e.value || 0);
  });

  const labels = {
    stress:'😡 Стрес',
    coffee:'☕ Кава',
    alcohol:'🍺 Алкоголь',
    activity:'🏃 Навантаження',
    sleep:'😴 Сон',
    headache:'🤕 Головний біль',
    tinnitus:'👂 Шум у вухах',
    dizziness:'😵 Запаморочення',
    fatigue:'😴 Втома'
  };

  const rows = Object.entries(byType).map(([k,arr])=>{
    const avg = arr.reduce((a,b)=>a+b,0)/arr.length;
    let note = '';
    if(k==='stress' && avg>=6) note='високий середній стрес';
    if(k==='sleep' && avg<6) note='мало сну';
    if(k==='coffee' && avg>=2) note='багато кави';
    if(['headache','tinnitus','dizziness','fatigue'].includes(k) && avg>=5) note='виражений симптом';
    return `• ${labels[k]||k}: записів ${arr.length}, середнє ${avg.toFixed(1)}${note ? ' — ' + note : ''}`;
  });

  return rows.join('\n');
}

function localMedAnalysisText(s){
  if(!s.recentMeds.length) return 'Записів ліків поки немає. Для аналізу потрібні: час прийому, доза і контрольний АТ після прийому.';
  const lines = s.recentMeds.map(m=>{
    let eff = null;
    if(typeof medEffect === 'function'){
      try{ eff = medEffect(m); }catch(e){}
    }
    return `• ${m.name || 'ліки'} ${m.dose || ''} — ${m.time ? new Date(m.time).toLocaleString('uk-UA') : ''}${eff?.text ? '; ' + eff.text : ''}`;
  });
  return lines.join('\n');
}

function localWeatherNeuroText(s){
  const lines = [];
  if(s.lastWeather){
    lines.push(`Остання погода: ${s.lastWeather.temp ?? '—'}°C, атм. тиск ${s.lastWeather.pressure ?? '—'} гПа, вологість ${s.lastWeather.humidity ?? '—'}%, вітер ${s.lastWeather.wind ?? '—'}.`);
  } else {
    lines.push('Погодних записів поки немає.');
  }

  const neuro = (s.recentEvents||[]).filter(e=>['headache','tinnitus','dizziness','fatigue'].includes(e.type));
  if(neuro.length){
    const high = neuro.filter(e=>+e.value>=5);
    lines.push(`Неврологічних симптомів серед останніх подій: ${neuro.length}, сильних 5/10 і вище: ${high.length}.`);
  } else {
    lines.push('Неврологічних симптомів поки мало для висновку.');
  }

  return lines.join('\n');
}

function addAIMessage(role, text, cls=''){
  const log = document.getElementById('aiChatLog');
  if(!log) return;
  const div = document.createElement('div');
  div.className = `ai-msg ${role==='user'?'ai-user':'ai-bot'} ${cls}`;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function getAIMode(){
  return document.querySelector('input[name="aiMode"]:checked')?.value || 'local';
}

function toggleAISettings(){
  document.getElementById('aiSettingsBox')?.classList.toggle('hidden');
}

function saveAISettings(){
  const key = document.getElementById('openaiApiKey')?.value || '';
  const model = document.getElementById('openaiModel')?.value || 'gpt-4o-mini';
  localStorage.setItem('healthRadarOpenAIKey', key.trim());
  localStorage.setItem('healthRadarOpenAIModel', model.trim());
  alert('AI налаштування збережено локально.');
}

function clearAISettings(){
  localStorage.removeItem('healthRadarOpenAIKey');
  localStorage.removeItem('healthRadarOpenAIModel');
  const k=document.getElementById('openaiApiKey'); if(k) k.value='';
  alert('AI ключ очищено.');
}

function loadAISettings(){
  const k=document.getElementById('openaiApiKey');
  const m=document.getElementById('openaiModel');
  if(k) k.value = localStorage.getItem('healthRadarOpenAIKey') || '';
  if(m) m.value = localStorage.getItem('healthRadarOpenAIModel') || 'gpt-4o-mini';
}

function askPresetAI(text){
  openModal('aiAssistantModal');
  const q = document.getElementById('aiQuestion');
  if(q) q.value = text;
  setTimeout(()=>sendAIQuestion(null, text), 50);
}

async function sendAIQuestion(e, presetText=null){
  if(e) e.preventDefault();
  const qEl = document.getElementById('aiQuestion');
  const question = (presetText || qEl?.value || '').trim();
  if(!question) return;

  addAIMessage('user', question);
  if(qEl) qEl.value = '';

  if(getAIMode()==='gpt'){
    await askOpenAI(question);
  } else {
    const answer = buildLocalAIAnswer(question);
    addAIMessage('bot', answer);
    const prev=document.getElementById('aiAssistantPreview');
    if(prev) prev.textContent = answer.slice(0,800);
  }
}

async function askOpenAI(question){
  const key = localStorage.getItem('healthRadarOpenAIKey') || document.getElementById('openaiApiKey')?.value || '';
  const model = localStorage.getItem('healthRadarOpenAIModel') || document.getElementById('openaiModel')?.value || 'gpt-4o-mini';
  if(!key){
    addAIMessage('bot', 'Для режиму ChatGPT API потрібно вставити OpenAI API key у ⚙️ API. Поки можу відповісти локально:\n\n' + buildLocalAIAnswer(question), 'ai-warn');
    return;
  }

  addAIMessage('bot', 'Думаю через ChatGPT API...');

  const summary = aiStateSummary();
  const system = `Ти медичний аналітичний асистент для особистого щоденника тиску. Відповідай українською. Не став діагноз. Не призначай лікування. Пояснюй закономірності в даних і радь, що обговорити з лікарем. При небезпечних симптомах радь невідкладну допомогу.`;
  const user = `Питання користувача: ${question}\n\nДані щоденника JSON:\n${JSON.stringify(summary, null, 2)}`;

  try{
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer ' + key
      },
      body: JSON.stringify({
        model,
        messages:[
          {role:'system', content:system},
          {role:'user', content:user}
        ],
        temperature:0.2
      })
    });
    if(!r.ok){
      const t = await r.text();
      throw new Error(t.slice(0,500));
    }
    const data = await r.json();
    const txt = data.choices?.[0]?.message?.content || 'AI не повернув відповідь.';
    addAIMessage('bot', txt);
    const prev=document.getElementById('aiAssistantPreview');
    if(prev) prev.textContent = txt.slice(0,800);
  }catch(err){
    addAIMessage('bot', 'Помилка ChatGPT API: ' + err.message + '\n\nЛокальний аналіз:\n' + buildLocalAIAnswer(question), 'ai-warn');
  }
}

function initAIAssistant(){
  loadAISettings();
  const log=document.getElementById('aiChatLog');
  if(log && !log.dataset.ready){
    log.dataset.ready='1';
    addAIMessage('bot', 'Привіт. Я можу локально аналізувати ваш тиск, пульс, ліки, погоду і симптоми. Для глибшого аналізу можна увімкнути режим ChatGPT API.');
  }
  document.querySelectorAll('input[name="aiMode"]').forEach(r=>{
    r.addEventListener('change', ()=>{
      const s=document.getElementById('aiModeStatus');
      if(s) s.textContent = getAIMode()==='gpt' ? 'ChatGPT API режим' : 'Локальний режим';
    });
  });
}

window.addEventListener('load', initAIAssistant);
