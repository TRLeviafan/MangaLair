// Если страница открыта внутри Telegram, слегка адаптируемся
const tg = window.Telegram?.WebApp;
if (tg) {
tg.ready(); // сообщаем Telegram, что контент готов
tg.expand(); // раскрываем webview на всю высоту
// Подстраиваем цвета под тему Telegram
document.documentElement.style.setProperty('--bg', tg.colorScheme === 'dark' ? '#0f1115' : '#f6f7fb');
}


// Заглушка для кнопки "Читать"
document.getElementById('readBtn').addEventListener('click', () => {
alert('Тут позже откроем конкретную главу/ридер. Сейчас это демо.');
});