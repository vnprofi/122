// background.js — обходит CORS, загружает страницу объявления
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchPage") {
    console.log('Загрузка страницы продавца:', request.url);
    
    fetch(request.url, {
      credentials: 'include',
      mode: 'cors',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
      .then(res => {
        console.log('Статус ответа:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.text();
      })
      .then(html => {
        console.log('Страница успешно загружена, размер:', html.length);
        // Логируем начало HTML для отладки
        console.log('Начало HTML:', html.substring(0, 500));
        sendResponse({ success: true, html });
      })
      .catch(err => {
        console.error('Ошибка загрузки страницы:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // keep channel open
  }
});