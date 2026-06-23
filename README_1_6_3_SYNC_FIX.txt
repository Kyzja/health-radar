Health Radar v1.6.3 SYNC FIX

Виправлено:
- app.js запускав init() занадто рано, до оголошення quickLabels. Через це була помилка Cannot access quickLabels before initialization.
- state тепер є глобальним window.state, тому Firebase і інтерфейс бачать одні й ті самі дані.
- після cloudLoadNow/cloudMergeNow оновлюється і window.state, і state.
- додано кнопку “Завантажити” біля синхронізації для ручного підтягування даних на телефоні.

Що замінити в GitHub:
- app.js
- firebase-cloud.js
- index.html
- sw.js
- quick-fix.js
- hotfix-161.js
- weather-card-fix-162.js
- styles.css

Після оновлення:
1. На телефоні очистити дані сайту або відкрити в інкогніто.
2. Увійти тим самим Google.
3. Натиснути “Завантажити” в блоці синхронізації.
