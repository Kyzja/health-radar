Health Radar Cloud 1.0

Що додано:
- Google Login через Firebase Authentication.
- Firestore синхронізація.
- Автозбереження після змін.
- Ручні кнопки: зберегти, завантажити, об’єднати.
- Firebase Hosting config.
- Firestore security rules.

ВАЖЛИВО:
Google Login не працює через file:///.
Потрібно відкрити через https://, найпростіше — Firebase Hosting.

Як залити на Firebase Hosting:
1. Встановити Node.js: https://nodejs.org/
2. Відкрити CMD/PowerShell у папці з сайтом.
3. Виконати:
   npm install -g firebase-tools
   firebase login
   firebase deploy

Після deploy відкрий посилання виду:
https://health-radar-f3c53.web.app

Правила Firestore:
Поки тестуєш, можуть стояти тестові правила.
Після перевірки встав у Firestore → Rules вміст файлу firestore.rules і натисни Publish.

Структура даних:
users/{uid}/healthRadar/state
