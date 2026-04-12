(function () {
  "use strict";

  /** Процент наценки от суммы (цена − первый взнос) по сроку, мес. */
  var RATES = {
    3: 16, 4: 19, 5: 23, 6: 26, 7: 30, 8: 34, 9: 38, 10: 42, 11: 46, 12: 49
  };

  var priceEl = document.getElementById("price");
  var downEl = document.getElementById("down");
  var monthsEl = document.getElementById("months");
  var downHint = document.getElementById("down-hint");
  var outDown = document.getElementById("out-down");
  var outMarkup = document.getElementById("out-markup");
  var outTotal = document.getElementById("out-total");
  var outMonthly = document.getElementById("out-monthly");
  var waLink = document.getElementById("wa-link");

  function formatMoney(n) {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: "RUB",
      maximumFractionDigits: 0
    }).format(Math.round(n));
  }

  /** Округление до 50 ₽: остаток > 25 — вверх, иначе вниз. */
  function roundTo50(n) {
    if (!isFinite(n)) return n;
    var sign = n < 0 ? -1 : 1;
    var x = Math.abs(n);
    var low = Math.floor(x / 50) * 50;
    var r = x - low;
    if (r > 25) return sign * (low + 50);
    return sign * low;
  }

  /**
   * Итог кратен (месяцы + (есть первый взнос > 0 ? 1 : 0)) * 50 ₽;
   * (итог − взнос) кратен месяцы * 50 ₽ — ежемесячный платёж целый и кратен 50 ₽.
   * Итог не ниже price.
   */
  function roundTotalPayForSchedule(rawTotal, price, months, down) {
    if (!isFinite(rawTotal) || months <= 0) return rawTotal;
    var hasFirst = down > 0;
    var stepGrid = (months + (hasFirst ? 1 : 0)) * 50;
    var modM = months * 50;
    var d = Math.round(down);
    var minTotal = isFinite(price) ? price : 0;
    var base = Math.round(rawTotal / stepGrid) * stepGrid;
    var best = null;
    var bestAbs = Infinity;
    var k;
    for (k = -200; k <= 200; k++) {
      var t = base + k * stepGrid;
      if (t < minTotal) continue;
      if ((t - d) % modM !== 0) continue;
      var dist = Math.abs(t - rawTotal);
      if (dist < bestAbs - 1e-9) {
        bestAbs = dist;
        best = t;
      }
    }
    if (best === null) {
      var tScan = Math.max(minTotal, Math.ceil(rawTotal / stepGrid) * stepGrid);
      for (k = 0; k < 400; k++) {
        var t2 = tScan + k * stepGrid;
        if ((t2 - d) % modM === 0) {
          best = t2;
          break;
        }
      }
    }
    return best !== null ? best : Math.max(minTotal, rawTotal);
  }

  function getRateForMonths(m) {
    return RATES[m] != null ? RATES[m] : 0;
  }

  function getPrice() {
    var v = parseFloat(String(priceEl.value).replace(",", "."));
    return isFinite(v) && v > 0 ? v : NaN;
  }

  function getMonths() {
    return parseInt(monthsEl.value, 10) || 3;
  }

  function getMaxDown(price) {
    return Math.floor(price / 50) * 50;
  }

  function isMultipleOf50Rub(n) {
    if (!isFinite(n) || n < 0) return false;
    var x = Math.round(n);
    if (Math.abs(n - x) > 1e-6) return false;
    return x % 50 === 0;
  }

  function fillMonths() {
    var html = "";
    for (var i = 3; i <= 12; i++) {
      html += '<option value="' + i + '">' + i + " мес.</option>";
    }
    monthsEl.innerHTML = html;
    monthsEl.value = "6";
  }

  function syncDownFromPrice() {
    var p = getPrice();
    if (!isFinite(p)) return;
    var max50 = getMaxDown(p);
    downEl.max = String(max50);
    var cur = parseFloat(String(downEl.value).replace(",", "."));
    if (!isFinite(cur) || downEl.dataset.userEdited !== "1") {
      downEl.value = "0";
    } else if (cur > max50) {
      downEl.value = String(max50);
    }
  }

  function refreshDownHint() {
    var p = getPrice();
    var max50 = isFinite(p) ? getMaxDown(p) : 0;
    var cur = parseFloat(String(downEl.value).replace(",", "."));
    if (isFinite(p)) {
      downEl.min = "0";
      downEl.max = String(max50);
    }
    if (!isFinite(p)) {
      downHint.textContent = "";
      downHint.classList.remove("is-error");
      return;
    }
    if (isFinite(cur) && cur > p) {
      downHint.textContent = "Взнос не может быть больше стоимости товара";
      downHint.classList.add("is-error");
    } else if (isFinite(cur) && !isMultipleOf50Rub(cur)) {
      downHint.textContent = "Взнос должен быть кратен 50 ₽";
      downHint.classList.add("is-error");
    } else {
      downHint.textContent = "Кратно 50 ₽, не больше цены товара";
      downHint.classList.remove("is-error");
    }
  }

  function onPriceInput() {
    syncDownFromPrice();
    refreshDownHint();
    recalc();
  }

  function onDownInput() {
    downEl.dataset.userEdited = "1";
    refreshDownHint();
    recalc();
  }

  function recalc() {
    var price = getPrice();
    var months = getMonths();
    var rate = getRateForMonths(months);

    if (!isFinite(price)) {
      outDown.textContent = "—";
      outMarkup.textContent = "—";
      outTotal.textContent = "—";
      outMonthly.textContent = "—";
      updateWhatsApp(null);
      return;
    }

    var down = parseFloat(String(downEl.value).replace(",", "."));
    if (!isFinite(down)) down = 0;
    var maxDown = getMaxDown(price);

    if (down > price) {
      outDown.textContent = "—";
      outMarkup.textContent = "—";
      outTotal.textContent = "—";
      outMonthly.textContent = "Взнос не может превышать стоимость";
      updateWhatsApp(null);
      return;
    }
    if (!isMultipleOf50Rub(down)) {
      outDown.textContent = "—";
      outMarkup.textContent = "—";
      outTotal.textContent = "—";
      outMonthly.textContent = "Взнос должен быть кратен 50 ₽";
      updateWhatsApp(null);
      return;
    }
    if (down > maxDown) {
      outDown.textContent = "—";
      outMarkup.textContent = "—";
      outTotal.textContent = "—";
      outMonthly.textContent =
        "Макс. взнос — " + formatMoney(maxDown) + " (кратно 50 ₽)";
      updateWhatsApp(null);
      return;
    }

    var principal = price - down;
    var markupAmount = roundTo50(principal * (rate / 100));
    var rawTotal = price + markupAmount;
    var totalPay = roundTotalPayForSchedule(rawTotal, price, months, down);
    markupAmount = totalPay - price;

    var monthly = months > 0 ? (totalPay - down) / months : 0;

    outDown.textContent = formatMoney(down);
    outMarkup.textContent = formatMoney(markupAmount);
    outTotal.textContent = formatMoney(totalPay);
    outMonthly.textContent = formatMoney(monthly);

    updateWhatsApp({
      price: price,
      down: down,
      months: months,
      rate: rate,
      markupAmount: markupAmount,
      totalPay: totalPay,
      monthly: monthly
    });
  }

  function updateWhatsApp(data) {
    if (!data) {
      waLink.href =
        "https://wa.me/?text=" +
        encodeURIComponent(
          "Finance — рассрочка\n\n(заполните форму для расчёта)"
        );
      return;
    }

    var lines = [
      "Стоимость товара: " + formatMoney(data.price),
      "Первый взнос: " + formatMoney(data.down),
      "Срок: " + data.months + " мес.",
      "Ежемесячный платёж: " + formatMoney(data.monthly),
      "Итоговая стоимость: " + formatMoney(data.totalPay)
    ];

    waLink.href =
      "https://wa.me/?text=" + encodeURIComponent(lines.join("\n"));
  }

  fillMonths();

  priceEl.addEventListener("input", onPriceInput);
  priceEl.addEventListener("change", onPriceInput);
  downEl.addEventListener("input", onDownInput);
  downEl.addEventListener("change", onDownInput);
  monthsEl.addEventListener("change", function () {
    syncDownFromPrice();
    refreshDownHint();
    recalc();
  });

  syncDownFromPrice();
  refreshDownHint();
  recalc();
})();
