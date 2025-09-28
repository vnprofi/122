(function () {
  const SELLER_INFO_BUTTON_CLASS = 'avito-seller-info-button';
  const SELLER_INFO_MODAL_CLASS = 'avito-seller-info-modal';
  const sellerCache = {};
  
  // Вспомогательные утилиты для очистки текста и сборки характеристик
  function cleanTextString(str) {
    if (!str) return '';
    // Удаляем CSS-правила вида .class{...}
    let out = str.replace(/\.[a-zA-Z0-9_-]+\{[^}]*\}/g, '');
    // Удаляем повторные пробелы и пробелы перед знаками пунктуации
    out = out.replace(/\s+/g, ' ').replace(/\s([,.;:!?)])/g, '$1').trim();
    return out;
  }

  function safeText(el) {
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('style, script, svg, button, a').forEach(n => n.remove());
    const text = clone.textContent.replace(/\s+/g, ' ').trim();
    return cleanTextString(text);
  }

  function computeFlatParams(container) {
    try {
      const clone = container.cloneNode(true);
      clone.querySelectorAll('svg, style, script').forEach(n => n.remove());
      const liNodes = Array.from(clone.querySelectorAll('li'));
      const flat = liNodes.map(li => {
        const labelEl = li.querySelector('.Lg7Ax');
        const labelRaw = labelEl ? labelEl.textContent : '';
        const label = labelRaw.replace(/\s*[:：]\s*$/, '').trim();
        if (labelEl && labelEl.parentNode) labelEl.parentNode.removeChild(labelEl);
        const value = safeText(li).replace(/^[:：\-–]\s*/, '');
        if (!label && !value) return '';
        return label ? `${label}: ${value}` : value;
      }).filter(Boolean).join(' | ');
      return flat;
    } catch (_) {
      return '';
    }
  }

  // Извлекает базовые данные с главной
  function extractBasicData(sellerLinkEl) {
    const itemCard = sellerLinkEl.closest('[data-marker="item"]');
    if (!itemCard) return null;

    // Имя продавца берём из ссылки продавца внутри карточки; href — ссылка на товар
    const sellerLink = itemCard.querySelector('a[href*="/brands/"], a[href*="/user/"]');
    const name = sellerLink ? sellerLink.textContent.trim().split(/[0-9],?[0-9]*·/)[0].trim() : '';
    const titleLink = itemCard.querySelector('a[data-marker="item-title"]');
    const href = titleLink ? titleLink.href : sellerLinkEl.href;
    const sellerHref = sellerLink ? sellerLink.href : null;

    // Рейтинг
    const ratingEl = itemCard.querySelector('[data-marker="seller-rating/score"]');
    const rating = ratingEl ? ratingEl.textContent.trim() : '—';

    // Отзывы
    const reviewsEl = itemCard.querySelector('[data-marker="seller-info/summary"]');
    const reviews = reviewsEl ? reviewsEl.textContent.trim() : '0 отзывов';

    // Бейджи продавца
    const badgeEls = itemCard.querySelectorAll('.SnippetBadge-title-NCaUc');
    const sellerBadges = Array.from(badgeEls).map(el => el.textContent.trim());

    // Бейджи товара (скидка, новое с биркой и т.д.)
    const itemBadgeEls = itemCard.querySelectorAll('.SnippetLayout-item-_JoCY .styles-module-content-M8Kp5');
    const itemBadges = Array.from(itemBadgeEls).map(el => el.textContent.trim());

    // Все бейджи вместе
    const badges = [...sellerBadges, ...itemBadges];

    // Тип продавца
    const isBrand = sellerLink ? sellerLink.href.includes('/brands/') : false;
    const sellerType = isBrand ? 'Компания' : 'Частное лицо';

    // Название товара
    const titleEl = itemCard.querySelector('[data-marker="item-title"]');
    const title = titleEl ? titleEl.textContent.trim() : '';

    // Цена товара
    const priceEl = itemCard.querySelector('[data-marker="item-price"] .styles-module-root-Yaf_d');
    const price = priceEl ? priceEl.textContent.trim() : '';

    // Старая цена и скидка
    const oldPriceEl = itemCard.querySelector('.discount-redesignDiscountWrapper-_WZl7 .styles-module-size_m-w6vzl');
    const discountEl = itemCard.querySelector('.styles-module-size_m-w6vzl[style*="color:#f71b47"], .styles-module-size_m-w6vzl[style*="color: rgb(247, 27, 71)"]');
    const oldPrice = oldPriceEl ? oldPriceEl.textContent.trim() : '';
    const discount = discountEl ? discountEl.textContent.trim() : '';

    // Состояние товара (новое с биркой и т.д.)
    const conditionEl = itemCard.querySelector('.iva-item-text-PvwMY .styles-module-size_m-w6vzl');
    const condition = conditionEl ? conditionEl.textContent.trim() : '';

    // Продвинутое размещение
    const promotedEl = itemCard.querySelector('.iva-item-dateInfoStep-AoWrh .styles-module-noAccent-nSgNq');
    const isPromoted = promotedEl && promotedEl.textContent.includes('Продвинуто');

    // Описание товара
    const descriptionEl = itemCard.querySelector('.styles-module-root_bottom-hgeJ2');
    const description = descriptionEl ? descriptionEl.textContent.trim() : '';

    // Логотип продавца
    const logoEl = itemCard.querySelector('.style-sellerLogoImageRedesign-_6pK5');
    const logoSrc = logoEl ? logoEl.src : '';

    // Фото товара
    const photoEls = itemCard.querySelectorAll('.photo-slider-image-cD891');
    const photos = Array.from(photoEls).map(el => el.src);

    return { 
      name, 
      rating, 
      reviews, 
      badges, 
      sellerType, 
      href, 
      sellerHref,
      title, 
      price, 
      oldPrice, 
      discount, 
      condition,
      isPromoted,
      description, 
      logoSrc, 
      photos 
    };
  }

  // Извлекает ID объявления из URL карточки товара (после "_"), с резервным вариантом
  function extractItemId(url) {
    const byUnderscore = url.match(/_(\d{6,})/);
    if (byUnderscore) return byUnderscore[1];
    const bySlash = url.match(/\/(\d{6,})(?:[?&#]|$)/);
    if (bySlash) return bySlash[1];
    return url; // используем весь URL как ключ, если ID не нашли
  }

  // Парсит расширенные данные из HTML карточки
  function parseExtendedData(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const extra = {};

    try {
      // Имя продавца
      const nameEl = doc.querySelector('[data-marker="seller-link/link"]') || 
                     doc.querySelector('.js-seller-info-name') ||
                     doc.querySelector('h3[itemprop="publisher"] [itemprop="name"]');
      if (nameEl) {
        extra.name = nameEl.textContent.trim();
      }

      // Рейтинг продавца
      const ratingEl = doc.querySelector('[data-marker="sellerRate"]') || 
                      doc.querySelector('.seller-info-rating .Tdsqf') ||
                      doc.querySelector('[data-marker="seller-rating/score"]');
      if (ratingEl) {
        extra.rating = ratingEl.textContent.trim();
      }

      // Количество отзывов
      const reviewElements = doc.querySelectorAll('a[href*="#reviews"], [data-marker="rating-caption/rating"]');
      for (let el of reviewElements) {
        if (el.textContent && el.textContent.match(/\d+\s*отзыв/)) {
          extra.reviews = el.textContent.trim();
          break;
        }
      }

      // Тип продавца
      const sellerTypeElements = doc.querySelectorAll('[data-marker="seller-info/label"]');
      for (let el of sellerTypeElements) {
        if (el.textContent) {
          if (el.textContent.includes('Компания')) {
            extra.sellerType = 'Компания';
            break;
          } else if (el.textContent.includes('Частное лицо')) {
            extra.sellerType = 'Частное лицо';
            break;
          }
        }
      }

      // Дата регистрации
      const sinceElements = doc.querySelectorAll('[data-marker="seller-info/label"]');
      for (let el of sinceElements) {
        if (el.textContent && el.textContent.includes('На Авито')) {
          extra.since = el.parentElement.textContent.trim();
          break;
        }
      }

      // Активность продавца
      const activityEl = doc.querySelector('.Xn_Zr');
      if (activityEl) {
        extra.activity = safeText(activityEl);
      }

      // Количество объявлений
      const adsElements = doc.querySelectorAll('a');
      for (let el of adsElements) {
        if (el.textContent && el.textContent.match(/\d+\s*объявл/)) {
          extra.adsCount = el.textContent.trim();
          break;
        }
      }

      // Бейджи продавца
      const badgeEls = doc.querySelectorAll('[data-marker^="badge-title"], .SnippetBadge-title-NCaUc, [class*="badge"] [class*="title"]');
      if (badgeEls.length > 0) {
        extra.badges = Array.from(badgeEls).map(el => el.textContent.trim())
          .filter(text => text && text.length > 0);
      }

      // Подписка на продавца
      const subscribeBtn = doc.querySelector('[data-marker="favorite-seller-subscription-button"]');
      if (subscribeBtn) {
        extra.canSubscribe = true;
      }

      // Номер телефона (если виден)
      const phoneBtn = doc.querySelector('[data-marker="item-phone-button/card"]');
      if (phoneBtn) {
        extra.hasPhone = true;
      }

      // Кнопка "Написать"
      const writeBtn = doc.querySelector('[data-marker="messenger-button/link"]');
      if (writeBtn) {
        extra.canMessage = true;
      }

      // Аватар продавца
      const avatarEl = doc.querySelector('[data-marker="seller-info/avatar"] .seller-info-avatar-image');
      if (avatarEl && avatarEl.style.backgroundImage) {
        const bgImage = avatarEl.style.backgroundImage;
        const urlMatch = bgImage.match(/url\(["']?(.*?)["']?\)/);
        if (urlMatch && urlMatch[1]) {
          extra.avatarUrl = urlMatch[1];
        }
      }

      // Описание продавца (если есть)
      const descriptionEl = doc.querySelector('[data-marker="seller-description"]') || 
                           doc.querySelector('.seller-info-description');
      if (descriptionEl) {
        extra.description = descriptionEl.textContent.trim();
      }

      // Дополнительная информация о продавце
      const additionalInfo = [];
      const infoElements = doc.querySelectorAll('.styles-module-root_bottom-hgeJ2 p');
      for (let el of infoElements) {
        const text = el.textContent.trim();
        if (text && !additionalInfo.includes(text)) {
          additionalInfo.push(text);
        }
      }
      if (additionalInfo.length > 0) {
        extra.additionalInfo = additionalInfo;
      }

      // Контактное лицо
      const contactPersonEl = doc.querySelector('[data-marker="seller-info/contact-person"] .EEPdn');
      if (contactPersonEl) {
        extra.contactPerson = contactPersonEl.textContent.trim();
      }

      // Цена из карточки товара
      const cardPriceEl = doc.querySelector('[data-marker="item-view/item-price"]');
      if (cardPriceEl) {
        extra.cardPrice = cardPriceEl.textContent.trim();
      }

      // Статус товара
      const statusBtn = doc.querySelector('button[aria-disabled="true"]');
      if (statusBtn) {
        extra.productStatus = statusBtn.textContent.trim();
      }

      // Характеристики товара как единый блок
      const paramsContainer = doc.querySelector('#bx_item-params');
      if (paramsContainer) {
        // Получаем весь HTML содержимого блока характеристик
        extra.productParamsHtml = paramsContainer.innerHTML;
        // Также сохраняем текстовое содержимое для резервного варианта
        extra.productParamsText = safeText(paramsContainer);
        // Плоский список характеристик с явным разделителем (очищаем SVG/CSS)
        const flat = computeFlatParams(paramsContainer);
        if (flat) extra.productParamsFlat = flat;
        console.log('Характеристики найдены:', extra.productParamsHtml.substring(0, 100) + '...');
      } else {
        console.log('Блок характеристик не найден в HTML карточки');
        // Попробуем альтернативные селекторы
        const altParamsContainer = doc.querySelector('[data-marker="item-view/params"]') || 
                                  doc.querySelector('.item-params');
        if (altParamsContainer) {
          extra.productParamsHtml = altParamsContainer.innerHTML;
          extra.productParamsText = safeText(altParamsContainer);
          const flat = computeFlatParams(altParamsContainer);
          if (flat) extra.productParamsFlat = flat;
          console.log('Альтернативные характеристики найдены:', extra.productParamsHtml.substring(0, 100) + '...');
        }
      }

      // Описание товара из карточки
      const fullDescriptionEl = doc.querySelector('[data-marker="item-view/item-description"], #bx_item-description .kSoFX');
      if (fullDescriptionEl) {
        extra.fullDescription = safeText(fullDescriptionEl);
      }

      // Название товара из карточки
      const cardTitleEl = doc.querySelector('h1[itemprop="name"]');
      if (cardTitleEl) {
        extra.cardTitle = cardTitleEl.textContent.trim();
      }

      // Акция (кампания)
      const campaignEl = doc.querySelector('[data-marker="item-view/campaign"]');
      if (campaignEl) {
        extra.campaignText = safeText(campaignEl);
      }

      // Наличие
      const stockEl = doc.querySelector('[data-marker="stocks-info"]');
      if (stockEl) {
        extra.stockInfo = safeText(stockEl);
      }

      // Метаданные объявления: №, дата, просмотры
      const itemNoEl = doc.querySelector('[data-marker="item-view/item-id"]');
      if (itemNoEl) {
        extra.itemNoText = safeText(itemNoEl);
        const digits = extra.itemNoText.replace(/\D/g, '');
        if (digits) extra.itemNo = digits;
      }
      const itemDateEl = doc.querySelector('[data-marker="item-view/item-date"]');
      if (itemDateEl) extra.itemDate = safeText(itemDateEl);
      const totalViewsEl = doc.querySelector('[data-marker="item-view/total-views"]');
      if (totalViewsEl) {
        extra.totalViewsText = safeText(totalViewsEl);
        const d = extra.totalViewsText.replace(/\D/g, '');
        if (d) extra.totalViews = d;
      }
      const todayViewsEl = doc.querySelector('[data-marker="item-view/today-views"]');
      if (todayViewsEl) {
        extra.todayViewsText = safeText(todayViewsEl);
        const d = extra.todayViewsText.replace(/\D/g, '');
        if (d) extra.todayViews = d;
      }

      // Юр. имя продавца (b2c)
      const legalNameEl = doc.querySelector('[data-marker="item-view/item-b2c-title"]');
      if (legalNameEl) extra.legalSellerName = safeText(legalNameEl);

      // Расположение: адрес, метро, координаты
      const placeEl = doc.querySelector('[itemscope][itemtype="http://schema.org/Place"]');
      if (placeEl) {
        const addressEl = placeEl.querySelector('[itemprop="address"], .xLPJ6');
        if (addressEl) extra.address = safeText(addressEl);
        const metroItems = Array.from(placeEl.querySelectorAll('.tAdYM'));
        if (metroItems.length) {
          const metros = metroItems.map(mi => {
            const nameEl = mi.querySelector(':scope > span:not(.KIhHC):not(.LHPFZ)');
            const timeEl = mi.querySelector('.LHPFZ');
            const name = safeText(nameEl);
            const time = safeText(timeEl);
            return name ? (time ? `${name} (${time})` : name) : safeText(mi);
          }).filter(Boolean);
          if (metros.length) extra.metro = metros;
        }
      }
      const mapWrapper = doc.querySelector('[data-marker="item-map-wrapper"]');
      if (mapWrapper) {
        const lat = mapWrapper.getAttribute('data-map-lat');
        const lon = mapWrapper.getAttribute('data-map-lon');
        const zoom = mapWrapper.getAttribute('data-map-zoom');
        if (lat && lon) extra.map = { lat, lon, zoom };
      }

      // Дополнительные опции
      const advParamsRoot = doc.querySelector('[data-marker="item-view/item-advanced-params"]');
      if (advParamsRoot) {
        const groups = Array.from(advParamsRoot.querySelectorAll('[data-marker="item-view/item-advanced-params-group"]')).map(g => {
          const title = safeText(g.querySelector('[data-marker="item-view/item-advanced-params-group-title"]'));
          const items = Array.from(g.querySelectorAll('[data-marker="item-view/item-advanced-params-group-list"] li, .gGQeQ li')).map(li => safeText(li)).filter(Boolean);
          return { title, items };
        }).filter(gr => gr.title || (gr.items && gr.items.length));
        if (groups.length) extra.advancedOptions = groups;
        const allBtn = advParamsRoot.querySelector('button');
        if (allBtn) {
          extra.advancedOptionsAllText = safeText(allBtn);
          // Также сохраняем семантическую ссылку, если доступен href у вложенной ссылки
          const anchor = allBtn.closest('a');
          if (anchor && anchor.href) extra.advancedOptionsAllHref = anchor.href;
        }
      }


      // Блок «Подробнее об оценке»
      (function parseImvDetails() {
        const wrap = doc.querySelector('[data-marker="imv-details/wrapper"]');
        if (!wrap) return;
        const title = safeText(wrap.querySelector('[data-marker="imv-details/title"]'));
        const subtitle = safeText(wrap.querySelector('[data-marker="imv-details/subtitle"]'));
        const details = {};
        const priceRows = Array.from(wrap.querySelectorAll('h3, p')).map(el => safeText(el)).filter(Boolean);
        if (priceRows.length) details.rows = priceRows;
        const btn = wrap.querySelector('[data-marker="imv-details/details-button"]');
        if (btn) details.moreText = safeText(btn);
        // Пытаемся найти прямую ссылку на интерпретацию
        const urlMatch = html.match(/https?:\/\/[^"']*\/evaluation\/interpretation\/item\/[0-9a-fA-F-]{36}/i);
        if (urlMatch) details.url = urlMatch[0];
        if (title || subtitle || details.rows || details.moreText || details.url) {
          extra.imvDetails = { title, subtitle, ...details };
        }
      })();

      // Стоимость владения (со страницы товара)
      (function parseOwnershipCostFromItemPage() {
        try {
          const header = Array.from(doc.querySelectorAll('h2')).find(h => /Стоимость владения/i.test(h.textContent || ''));
          if (!header) return;

          const outerContainer = header.closest('div.zvIlg') || header.closest('section') || header.closest('div');
          if (!outerContainer) return;

          // Ищем dl со списком
          const dl = outerContainer.querySelector('dl.KuPdj.UTb3i') || outerContainer.querySelector('dl');
          if (!dl) return;

          const items = [];

          // Предпочитаем блочную разметку div.WQrI5.rPK0d (если есть)
          const blocks = Array.from(dl.querySelectorAll('div.WQrI5.rPK0d'));
          if (blocks.length) {
            blocks.forEach(div => {
              const dtEl = div.querySelector('dt') || div.querySelector('dt.ANieu.VtHX8._i_Gl');
              const ddEl = div.querySelector('dd') || div.querySelector('dd.VtHX8.FQm9P');
              const name = dtEl ? safeText(dtEl) : '';
              const value = ddEl ? safeText(ddEl) : '';
              if (name && value) items.push({ name, value });
            });
          } else {
            // Резервный вариант: пары dt/dd внутри dl
            const dts = Array.from(dl.querySelectorAll('dt'));
            dts.forEach(dt => {
              const parent = dt.parentElement;
              let dd = null;
              if (parent) dd = parent.querySelector('dd');
              if (!dd && dt.nextElementSibling && dt.nextElementSibling.tagName === 'DD') {
                dd = dt.nextElementSibling;
              }
              const name = safeText(dt);
              const value = safeText(dd);
              if (name && value) items.push({ name, value });
            });
          }

          if (!items.length) return;

          const period = safeText(outerContainer.querySelector('[role="tab"][aria-selected="true"]'));

          let explanation = safeText(outerContainer.querySelector('p.T7ujv.XXczS.DdkRY.cujIu.kVdGi'));
          if (!explanation) {
            const pTexts = Array.from(outerContainer.querySelectorAll('p')).map(p => safeText(p)).filter(Boolean);
            const found = pTexts.find(t => /Примерные расходы|содержан/i.test(t));
            if (found) explanation = found;
          }

          const links = Array.from(outerContainer.querySelectorAll('a')).map(a => ({ text: safeText(a), href: a.href || '' })).filter(l => l.text);

          extra.ownershipCost = { period, items, explanation, links };
        } catch (_) {}
      })();

    } catch (e) {
      console.warn('Ошибка при парсинге данных продавца:', e);
    }

    return extra;
  }

  // Парсит данные со страницы продавца
  function parseSellerPageData(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const sellerData = {};

    try {
      // Стоимость владения со страницы продавца
      (function parseOwnershipCostFromSeller() {
        // Ищем заголовок "Стоимость владения" во всем документе
        const header = Array.from(doc.querySelectorAll('h2')).find(h => /Стоимость владения/i.test(h.textContent || ''));
        if (!header) {
          console.log('Заголовок "Стоимость владения" не найден');
          return;
        }
        
        console.log('Заголовок "Стоимость владения" найден:', header.textContent);

        // Ищем родительский контейнер zvIlg (внешний контейнер)
        const outerContainer = header.closest('div.zvIlg');
        if (!outerContainer) {
          console.log('Внешний контейнер zvIlg не найден');
          return;
        }

        // Ищем dl с классом KuPdj UTb3i внутри внешнего контейнера
        const dl = outerContainer.querySelector('dl.KuPdj.UTb3i');
        if (!dl) {
          console.log('Список dl.KuPdj.UTb3i не найден');
          return;
        }

        console.log('Список стоимости найден, парсим элементы...');

        // Ищем все элементы стоимости, включая те, что могут быть в подблоках
        const items = [];
        
        // Прямые элементы в dl
        const directItems = Array.from(dl.querySelectorAll(':scope > div.WQrI5.rPK0d'));
        directItems.forEach(div => {
          const dtEl = div.querySelector('dt.ANieu.VtHX8._i_Gl');
          const ddEl = div.querySelector('dd.VtHX8.FQm9P');
          const name = dtEl ? safeText(dtEl) : '';
          const value = ddEl ? safeText(ddEl) : '';
          if (name && value) {
            console.log('Найден прямой элемент:', name, '=', value);
            items.push({ name, value });
          }
        });
        
        // Элементы в подблоках (например, в div.TABma)
        const subBlocks = Array.from(dl.querySelectorAll('div.TABma, div[class*="TAB"]'));
        subBlocks.forEach(block => {
          const subItems = Array.from(block.querySelectorAll('div.WQrI5.rPK0d'));
          subItems.forEach(div => {
            const dtEl = div.querySelector('dt.ANieu.VtHX8._i_Gl');
            const ddEl = div.querySelector('dd.VtHX8.FQm9P');
            const name = dtEl ? safeText(dtEl) : '';
            const value = ddEl ? safeText(ddEl) : '';
            if (name && value) {
              console.log('Найден элемент в подблоке:', name, '=', value);
              items.push({ name, value });
            }
          });
        });
          
        if (!items.length) {
          console.log('Элементы стоимости не найдены');
          return;
        }

        // Ищем активную вкладку для определения периода
        const period = safeText(outerContainer.querySelector('[role="tab"][aria-selected="true"]'));
        
        // Ищем объяснение
        const explanation = safeText(outerContainer.querySelector('p.T7ujv.XXczS.DdkRY.cujIu.kVdGi'));
        
        // Ищем ссылки
        const links = Array.from(outerContainer.querySelectorAll('a')).map(a => ({ text: safeText(a), href: a.href || '' })).filter(l => l.text);
        
        sellerData.ownershipCost = { period, items, explanation, links };
        console.log('Стоимость владения найдена на странице продавца:', sellerData.ownershipCost);
      })();

    } catch (e) {
      console.warn('Ошибка при парсинге страницы продавца:', e);
    }

    return sellerData;
  }

  // Получает полные данные (с кэшированием)
  async function getFullSellerData(sellerLinkEl) {
    const basic = extractBasicData(sellerLinkEl);
    if (!basic) return null;

    const itemId = extractItemId(basic.href);
    if (!itemId) return { ...basic, extra: {} };

    // Проверяем кэш в памяти
    if (sellerCache[itemId]) {
      console.log('Данные из кэша:', itemId);
      return { ...basic, extra: sellerCache[itemId] };
    }

    // Проверяем кэш в storage
    const stored = await chrome.storage.local.get(`item_${itemId}`);
    if (stored[`item_${itemId}`]) {
      sellerCache[itemId] = stored[`item_${itemId}`];
      console.log('Данные из storage кэша:', itemId);
      return { ...basic, extra: sellerCache[itemId] };
    }

    // Загружаем через background
    try {
      console.log('Загрузка данных через background для:', itemId);
      const result = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "fetchPage", url: basic.href }, resolve);
      });

      if (!result.success) throw new Error(result.error);

      const extra = parseExtendedData(result.html);
      
      // Дополнительно загружаем страницу продавца для получения стоимости владения
      if (basic.sellerHref) {
        try {
          console.log('Загрузка страницы продавца:', basic.sellerHref);
          const sellerResult = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: "fetchPage", url: basic.sellerHref }, resolve);
          });
          
          if (sellerResult.success) {
            const sellerData = parseSellerPageData(sellerResult.html);
            // Объединяем данные со страницы продавца с основными данными
            Object.assign(extra, sellerData);
            console.log('Данные со страницы продавца получены:', sellerData);
          }
        } catch (sellerError) {
          console.warn('Не удалось загрузить страницу продавца:', sellerError);
        }
      }
      
      console.log('Расширенные данные получены:', extra);
      sellerCache[itemId] = extra;
      chrome.storage.local.set({ [`item_${itemId}`]: extra });

      return { ...basic, extra };
    } catch (e) {
      console.warn('Не удалось загрузить данные продавца:', e);
      return { ...basic, extra: {} };
    }
  }

  // Создаёт кнопку для отображения информации
  function createInfoButton(basicData) {
    const button = document.createElement('button');
    button.className = SELLER_INFO_BUTTON_CLASS;
    button.textContent = 'ℹ️ Подробнее';
    button.title = 'Показать подробную информацию о продавце и товаре';
    button.style.cssText = `
      background: #f0f0f0;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 4px 8px;
      margin-left: 8px;
      cursor: pointer;
      font-size: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // При клике создаем модальное окно и загружаем дополнительные данные
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Показываем загрузку
      const loadingModal = createLoadingModal();
      document.body.appendChild(loadingModal);
      
      try {
        // Получаем полные данные при клике
        const fullData = await getFullSellerDataOnDemand(basicData);
        
        // Удаляем модалку загрузки
        if (document.body.contains(loadingModal)) {
          document.body.removeChild(loadingModal);
        }
        
        // Создаем модальное окно с полными данными
        const modal = createModal(fullData);
        document.body.appendChild(modal);
        
        // Добавляем обработчик закрытия
        modal.addEventListener('click', (event) => {
          if (event.target === modal) {
            document.body.removeChild(modal);
          }
        });
      } catch (error) {
        console.error('Ошибка при загрузке данных:', error);
        // Удаляем модалку загрузки
        if (document.body.contains(loadingModal)) {
          document.body.removeChild(loadingModal);
        }
        
        // Показываем сообщение об ошибке
        const errorModal = createErrorModal(error.message);
        document.body.appendChild(errorModal);
        
        // Добавляем обработчик закрытия
        errorModal.addEventListener('click', (event) => {
          if (event.target === errorModal) {
            document.body.removeChild(errorModal);
          }
        });
      }
    });
    
    return button;
  }

  // Создаёт модальное окно с информацией
  function createModal(data) {
    console.log('Создание модального окна с данными:', data);
    const modal = document.createElement('div');
    modal.className = SELLER_INFO_MODAL_CLASS;
    
    // Формируем содержимое модального окна
    let badgesHtml = '';
    const allBadges = [...(data.badges || []), ...(data.extra?.badges || [])];
    if (allBadges.length > 0) {
      // Удаляем дубликаты
      const uniqueBadges = [...new Set(allBadges)];
      badgesHtml = `
        <div class="badges">
          ${uniqueBadges.map(b => `<span class="badge">${b}</span>`).join('')}
        </div>
      `;
    }
    
    // Дополнительная информация о товаре
    let additionalInfoHtml = '';
    if (data.extra?.additionalInfo && data.extra.additionalInfo.length > 0) {
      additionalInfoHtml = `
        <div class="additional-info">
          <h3>Дополнительная информация:</h3>
          <ul>
            ${data.extra.additionalInfo.map(info => `<li>${info}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    // Характеристики товара как единый блок
    let productParamsHtml = '';
    console.log('Наличие данных характеристик:', {
      hasHtml: !!data.extra?.productParamsHtml,
      hasText: !!data.extra?.productParamsText,
      htmlLength: data.extra?.productParamsHtml?.length || 0,
      textLength: data.extra?.productParamsText?.length || 0
    });
    
    if (data.extra?.productParamsHtml) {
      // Если есть HTML блока характеристик, отображаем его как есть
      productParamsHtml = `
        <div class="product-params">
          <h3>Характеристики товара:</h3>
          <div class="params-content">
            ${data.extra.productParamsHtml}
          </div>
          ${data.extra.productParamsFlat ? `<p style="margin-top:10px;font-size:12px;color:#666"><strong>Список:</strong> ${data.extra.productParamsFlat}</p>` : ''}
        </div>
      `;
    } else if (data.extra?.productParamsText) {
      // Резервный вариант - отображаем текст
      productParamsHtml = `
        <div class="product-params">
          <h3>Характеристики товара:</h3>
          <pre class="params-text">${data.extra.productParamsText}</pre>
          ${data.extra.productParamsFlat ? `<p style="margin-top:10px;font-size:12px;color:#666"><strong>Список:</strong> ${data.extra.productParamsFlat}</p>` : ''}
        </div>
      `;
    }
    
    // Фото товара
    let photosHtml = '';
    if (data.photos && data.photos.length > 0) {
      photosHtml = `
        <div class="photos">
          <h3>Фотографии товара:</h3>
          <div class="photos-grid">
            ${data.photos.map(photo => `<img src="${photo}" alt="Фото товара" class="photo-thumb">`).join('')}
          </div>
        </div>
      `;
    }
    
    // Формируем HTML для модального окна
    modal.innerHTML = `
      <div class="avito-seller-info-modal-content">
        <div class="modal-header">
          <h2>Информация о продавце и товаре</h2>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="product-info">
            <h3>О товаре</h3>
            ${data.extra?.cardTitle ? `<p><strong>Название:</strong> ${data.extra.cardTitle}</p>` : ''}
            ${data.title && data.title !== data.extra?.cardTitle ? `<p><strong>Название (из списка):</strong> ${data.title}</p>` : ''}
            ${data.price ? `<p><strong>Цена:</strong> ${data.price}</p>` : ''}
            ${data.extra?.cardPrice && data.extra.cardPrice !== data.price ? `<p><strong>Цена в карточке:</strong> ${data.extra.cardPrice}</p>` : ''}
            ${data.extra?.campaignText ? `<p><strong>Акция:</strong> ${data.extra.campaignText}</p>` : ''}
            ${data.extra?.stockInfo ? `<p><strong>Наличие:</strong> ${data.extra.stockInfo}</p>` : ''}
            ${data.oldPrice ? `<p><strong>Старая цена:</strong> ${data.oldPrice}</p>` : ''}
            ${data.discount ? `<p><strong>Скидка:</strong> ${data.discount}</p>` : ''}
            ${data.condition ? `<p><strong>Состояние:</strong> ${data.condition}</p>` : ''}
            ${data.isPromoted ? `<p><strong>Размещение:</strong> Продвинутое</p>` : ''}
            ${data.extra?.productStatus ? `<p><strong>Статус:</strong> ${data.extra.productStatus}</p>` : ''}
            ${(data.extra?.itemNoText || data.extra?.itemDate || data.extra?.totalViewsText || data.extra?.todayViewsText) ? `
              <p><strong>Объявление:</strong> ${[data.extra?.itemNoText, data.extra?.itemDate, [data.extra?.totalViewsText, data.extra?.todayViewsText].filter(Boolean).join(' ')].filter(Boolean).join(' · ')}</p>
            ` : ''}
            ${data.description ? `<div><strong>Описание:</strong><p class="description-text">${data.description}</p></div>` : ''}
            ${data.extra?.fullDescription && data.extra.fullDescription !== data.description ? `<div><strong>Полное описание:</strong><p class="description-text">${data.extra.fullDescription}</p></div>` : ''}
          </div>
          
          ${productParamsHtml}
          
          ${(data.extra?.address || (data.extra?.metro && data.extra.metro.length) || data.extra?.map) ? `
            <div class="product-info">
              <h3>Расположение</h3>
              ${data.extra?.address ? `<p><strong>Адрес:</strong> ${data.extra.address}</p>` : ''}
              ${data.extra?.metro && data.extra.metro.length ? `<p><strong>Метро:</strong> ${data.extra.metro.join(', ')}</p>` : ''}
              ${data.extra?.map ? `<p><strong>Координаты:</strong> ${data.extra.map.lat}, ${data.extra.map.lon}${data.extra.map.zoom ? ` (z=${data.extra.map.zoom})` : ''}</p>` : ''}
            </div>
          ` : ''}

          ${data.extra?.advancedOptions && data.extra.advancedOptions.length ? `
            <div class="product-params">
              <h3>Дополнительные опции</h3>
              ${data.extra.advancedOptions.map(gr => `
                <div style="margin-bottom:10px">
                  ${gr.title ? `<p><strong>${gr.title}:</strong></p>` : ''}
                  ${gr.items && gr.items.length ? `<ul>${gr.items.map(it => `<li>${it}</li>`).join('')}</ul>` : ''}
                </div>
              `).join('')}
              ${data.extra?.advancedOptionsAllText ? `<p><a href="#" class="js-open-adv-options"><em>${data.extra.advancedOptionsAllText}</em></a>${data.extra?.advancedOptionsAllHref ? ` — ${data.extra.advancedOptionsAllHref}` : ''}</p>` : ''}
            </div>
          ` : ''}
          ${data.extra?.imvDetails ? `
            <div class="product-params">
              <h3>Оценка стоимости</h3>
              ${data.extra.imvDetails.title ? `<p><strong>${data.extra.imvDetails.title}</strong></p>` : ''}
              ${data.extra.imvDetails.subtitle ? `<p>${data.extra.imvDetails.subtitle}</p>` : ''}
              ${data.extra.imvDetails.rows && data.extra.imvDetails.rows.length ? `<ul>${data.extra.imvDetails.rows.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
              ${data.extra.imvDetails.url ? `<p><a href="${data.extra.imvDetails.url}" target="_blank" rel="noopener"><em>${data.extra.imvDetails.moreText || 'Подробнее об оценке'}</em></a></p>` : (data.extra.imvDetails.moreText ? `<p><a href="#" class="js-open-imv-details"><em>${data.extra.imvDetails.moreText}</em></a></p>` : '')}
            </div>
          ` : ''}

          ${data.extra?.ownershipCost && data.extra.ownershipCost.items && data.extra.ownershipCost.items.length ? `
            <div class="product-params">
              <h3>Стоимость владения ${data.extra.ownershipCost.period ? `(${data.extra.ownershipCost.period})` : ''}</h3>
              <ul>
                ${data.extra.ownershipCost.items.map(r => `<li><strong>${r.name}:</strong> ${r.value}</li>`).join('')}
              </ul>
              ${data.extra.ownershipCost.explanation ? `<p class="description-text">${data.extra.ownershipCost.explanation}</p>` : ''}
          ${data.extra.ownershipCost.links && data.extra.ownershipCost.links.length ? `<p><strong>Ссылки:</strong> ${data.extra.ownershipCost.links.map(l => l.text).join(' · ')}</p>` : ''}
            </div>
          ` : ''}

          <div class="seller-info">
            <h3>О продавце</h3>
            <p><strong>Имя:</strong> ${data.extra?.name || data.name}</p>
            ${data.extra?.legalSellerName ? `<p><strong>Юр. имя:</strong> ${data.extra.legalSellerName}</p>` : ''}
            <p><strong>Тип:</strong> ${data.extra?.sellerType || data.sellerType || '—'}</p>
            <p><strong>Рейтинг:</strong> ${data.extra?.rating || data.rating || '—'}</p>
            <p><strong>Отзывы:</strong> ${data.extra?.reviews || data.reviews || '—'}</p>
            ${data.extra?.contactPerson ? `<p><strong>Контактное лицо:</strong> ${data.extra.contactPerson}</p>` : ''}
            ${data.extra?.adsCount ? `<p><strong>Объявлений:</strong> ${data.extra.adsCount}</p>` : ''}
            ${data.extra?.since ? `<p><strong>На Авито:</strong> ${data.extra.since.replace('На Авито', '').trim()}</p>` : ''}
            ${data.extra?.activity ? `<p><strong>Активность:</strong> ${data.extra.activity}</p>` : ''}
            ${data.extra?.canMessage ? `<p><strong>Связь:</strong> Можно написать</p>` : ''}
            ${data.extra?.hasPhone ? `<p><strong>Телефон:</strong> Доступен</p>` : ''}
            ${data.extra?.description ? `<div><strong>О продавце:</strong><p class="description-text">${data.extra.description}</p></div>` : ''}
            ${badgesHtml}
          </div>
          
          ${photosHtml}
          ${additionalInfoHtml}
        </div>
      </div>
    `;
    
    // Добавляем обработчик закрытия
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    // Линки-"проклики" на странице
    const advOpen = modal.querySelector('.js-open-adv-options');
    if (advOpen) {
      advOpen.addEventListener('click', (e) => {
        e.preventDefault();
        const btn = document.querySelector('[data-marker="item-view/item-advanced-params"] button');
        if (btn) btn.click();
      });
    }
    const imvOpen = modal.querySelector('.js-open-imv-details');
    if (imvOpen) {
      imvOpen.addEventListener('click', (e) => {
        e.preventDefault();
        const btn = document.querySelector('[data-marker="imv-details/details-button"]');
        if (btn) btn.click();
      });
    }
    
    return modal;
  }

  // Создаёт модальное окно загрузки
  function createLoadingModal() {
    const modal = document.createElement('div');
    modal.className = SELLER_INFO_MODAL_CLASS;
    modal.innerHTML = `
      <div class="avito-seller-info-modal-content">
        <div class="modal-header">
          <h2>Загрузка информации...</h2>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p>Идет загрузка данных продавца и товара...</p>
        </div>
      </div>
    `;
    
    // Добавляем обработчик закрытия
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    return modal;
  }

  // Создаёт модальное окно ошибки
  function createErrorModal(errorMessage) {
    const modal = document.createElement('div');
    modal.className = SELLER_INFO_MODAL_CLASS;
    modal.innerHTML = `
      <div class="avito-seller-info-modal-content">
        <div class="modal-header">
          <h2>Ошибка загрузки</h2>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <p>Не удалось загрузить данные продавца: ${errorMessage}</p>
        </div>
      </div>
    `;
    
    // Добавляем обработчик закрытия
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    return modal;
  }

  // Получает полные данные при клике на кнопку
  async function getFullSellerDataOnDemand(basicData) {
    const itemId = extractItemId(basicData.href);
    if (!itemId) return { ...basicData, extra: {} };

    // Проверяем кэш в памяти
    if (sellerCache[itemId]) {
      console.log('Данные из кэша:', itemId);
      return { ...basicData, extra: sellerCache[itemId] };
    }

    // Проверяем кэш в storage
    const stored = await chrome.storage.local.get(`item_${itemId}`);
    if (stored[`item_${itemId}`]) {
      sellerCache[itemId] = stored[`item_${itemId}`];
      console.log('Данные из storage кэша:', itemId);
      return { ...basicData, extra: sellerCache[itemId] };
    }

    // Загружаем через background
    try {
      console.log('Загрузка данных через background для:', itemId);
      const result = await new Promise(resolve => {
        chrome.runtime.sendMessage({ action: "fetchPage", url: basicData.href }, resolve);
      });

      if (!result.success) throw new Error(result.error);

      const extra = parseExtendedData(result.html);
      
      // Дополнительно загружаем страницу продавца для получения стоимости владения
      if (basicData.sellerHref) {
        try {
          console.log('Загрузка страницы продавца:', basicData.sellerHref);
          const sellerResult = await new Promise(resolve => {
            chrome.runtime.sendMessage({ action: "fetchPage", url: basicData.sellerHref }, resolve);
          });
          
          if (sellerResult.success) {
            const sellerData = parseSellerPageData(sellerResult.html);
            // Объединяем данные со страницы продавца с основными данными
            Object.assign(extra, sellerData);
            console.log('Данные со страницы продавца получены:', sellerData);
          }
        } catch (sellerError) {
          console.warn('Не удалось загрузить страницу продавца:', sellerError);
        }
      }
      
      console.log('Расширенные данные получены:', extra);
      sellerCache[itemId] = extra;
      chrome.storage.local.set({ [`item_${itemId}`]: extra });

      return { ...basicData, extra };
    } catch (e) {
      console.warn('Не удалось загрузить данные продавца:', e);
      throw e;
    }
  }

  // Добавляет кнопку информации рядом с заголовком товара
  async function addSellerInfoButton(sellerLinkEl) {
    // Проверяем, есть ли уже кнопка для этого продавца
    if (sellerLinkEl.nextElementSibling && sellerLinkEl.nextElementSibling.classList.contains(SELLER_INFO_BUTTON_CLASS)) {
      return;
    }

    const basicData = extractBasicData(sellerLinkEl);
    if (basicData) {
      const button = createInfoButton(basicData);
      sellerLinkEl.parentNode.insertBefore(button, sellerLinkEl.nextSibling);
    }
  }

  // Инициализация - добавляем кнопки для всех объявлений на странице
  async function init() {
    const itemLinks = document.querySelectorAll('a[data-marker="item-title"]');
    for (const link of itemLinks) {
      if (link.closest('[data-marker="item"]')) {
        await addSellerInfoButton(link);
      }
    }
  }

  // Поддержка динамической подгрузки (SPA)
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Проверяем, добавлены ли новые элементы с объявлениями
            if (node.hasAttribute && node.hasAttribute('data-marker') && node.getAttribute('data-marker') === 'item') {
              const itemLinks = node.querySelectorAll('a[data-marker="item-title"]');
              itemLinks.forEach(link => {
                if (link.closest('[data-marker="item"]')) {
                  addSellerInfoButton(link);
                }
              });
            }
            // Также проверяем дочерние элементы
            const itemElements = node.querySelectorAll && node.querySelectorAll('[data-marker="item"]');
            if (itemElements.length > 0) {
              itemElements.forEach(item => {
                const itemLinksInner = item.querySelectorAll('a[data-marker="item-title"]');
                itemLinksInner.forEach(link => {
                  if (link.closest('[data-marker="item"]')) {
                    addSellerInfoButton(link);
                  }
                });
              });
            }
          }
        });
      }
    });
  });
  
  observer.observe(document.body, { childList: true, subtree: true });

  // Запускаем инициализацию после загрузки страницы
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();