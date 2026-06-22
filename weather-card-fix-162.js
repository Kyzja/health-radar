/* Health Radar v1.6.2 — force weather card from archive table/state */
(function(){
  function fmtUA(d){
    try{
      return new Intl.DateTimeFormat('uk-UA',{
        day:'2-digit',month:'2-digit',year:'2-digit',
        hour:'2-digit',minute:'2-digit'
      }).format(d);
    }catch(e){ return d.toLocaleString('uk-UA'); }
  }

  function getWeatherArr(){
    if(window.state && Array.isArray(window.state.weather)) return window.state.weather;
    return [];
  }

  function nearestPastWeather(){
    const now = new Date();
    const arr = getWeatherArr()
      .filter(w => w && w.time && !isNaN(new Date(w.time)) && new Date(w.time) <= now)
      .sort((a,b)=>new Date(b.time)-new Date(a.time));

    if(arr.length) return arr[0];

    // fallback: nearest by time if everything is future
    let best = null, diff = Infinity;
    getWeatherArr().forEach(w=>{
      if(!w || !w.time) return;
      const d = Math.abs(new Date(w.time) - now);
      if(d < diff){ diff = d; best = w; }
    });
    return best;
  }

  function findWeatherElements(){
    // Current known IDs from project
    const weatherNow = document.getElementById('weatherNow');
    const weatherMeta = document.getElementById('weatherMeta');
    const atmPressure = document.getElementById('atmPressure');
    const atmDelta = document.getElementById('atmDelta');

    // Fallback by card title text
    let weatherCard = null;
    document.querySelectorAll('.card').forEach(card=>{
      const title = card.querySelector('.card-title')?.textContent?.trim().toLowerCase() || '';
      if(title === 'погода' || title.includes('погода')) weatherCard = card;
    });

    return {weatherNow, weatherMeta, atmPressure, atmDelta, weatherCard};
  }

  function forceWeatherCard(){
    const w = nearestPastWeather();
    const els = findWeatherElements();

    if(!w){
      if(els.weatherMeta){
        els.weatherMeta.innerHTML = `Немає архівного запису погоди<span class="weather-card-warning">натисніть “Записати зараз” або “Оновити пропущені дані”</span>`;
      }
      return;
    }

    const temp = w.temp ?? w.temperature ?? w.tempC;
    const pressure = w.pressure ?? w.pressure_hpa ?? w.atmPressure;
    const humidity = w.humidity ?? w.rh;
    const wind = w.wind ?? w.windSpeed ?? w.windspeed;
    const time = new Date(w.time);

    const metaHtml =
      `${window.state?.city?.name || ''} · вологість ${humidity ?? '—'}% · вітер ${wind ?? '—'} м/с` +
      `<span class="weather-card-source">джерело: архів ${fmtUA(time)}</span>`;

    if(els.weatherNow) els.weatherNow.textContent = `${Math.round(Number(temp))}°C`;
    if(els.weatherMeta) els.weatherMeta.innerHTML = metaHtml;
    if(els.atmPressure && pressure != null) els.atmPressure.textContent = `${Number(pressure).toFixed(1)} гПа`;

    // Extra fallback if IDs did not match
    if(els.weatherCard && !els.weatherNow){
      const big = els.weatherCard.querySelector('.big');
      const muted = els.weatherCard.querySelector('.muted');
      if(big) big.textContent = `${Math.round(Number(temp))}°C`;
      if(muted) muted.innerHTML = metaHtml;
    }
  }

  // Patch renderDashboard after all old functions
  const oldRenderDashboard = window.renderDashboard;
  window.renderDashboard = function(){
    if(typeof oldRenderDashboard === 'function') oldRenderDashboard.apply(this, arguments);
    forceWeatherCard();
  };

  const oldRenderAll = window.renderAll;
  if(typeof oldRenderAll === 'function'){
    window.renderAll = function(){
      oldRenderAll.apply(this, arguments);
      forceWeatherCard();
    };
  }

  // Run repeatedly shortly after load because old weather functions update async
  window.addEventListener('load', ()=>{
    forceWeatherCard();
    setTimeout(forceWeatherCard, 300);
    setTimeout(forceWeatherCard, 1000);
    setTimeout(forceWeatherCard, 2500);
  });

  // Keep it corrected if weather is updated async
  setInterval(forceWeatherCard, 15000);

  window.HR_FORCE_WEATHER_CARD = forceWeatherCard;
})();
