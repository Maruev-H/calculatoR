(function () {
  "use strict";

  /** Процент наценки от суммы (цена − первый взнос) по сроку, мес. */
  var RATES = {
    3: 16, 4: 19, 5: 23, 6: 26, 7: 30, 8: 34, 9: 38, 10: 42, 11: 46, 12: 49
  };

  var form = document.getElementById("calc-form");
  var priceEl = document.getElementById("price");
  var downEl = document.getElementById("down");
  var monthsEl = document.getElementById("months");
  var downBlock = document.getElementById("down-block");
  var downHint = document.getElementById("down-hint");
  var rowDown = document.getElementById("row-down");
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

  function getHasDown() {
    var r = form.querySelector('input[name="hasDown"]:checked');
    return r && r.value === "yes";
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

  /**
   * 20 % от (сумма рассрочки + наценка) при наценке от остатка и доле взноса 20 % от итога:
   * price × (1 + r) / (5 + r), r — доля ставки.
   */
  function getRecommendedDown(price) {
    if (!isFinite(price)) return 0;
    var r = getRateForMonths(getMonths()) / 100;
    var exact = (price * (1 + r)) / (5 + r);
    var x = Math.ceil(exact / 50) * 50;
    var max50 = getMaxDown(price);
    return Math.min(x, max50);
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

  function syncDownField() {
    if (!getHasDown()) return;
    var p = getPrice();
    if (!isFinite(p)) return;
    var max50 = getMaxDown(p);
    downEl.max = String(max50);
    var cur = parseFloat(String(downEl.value).replace(",", "."));
    if (downEl.dataset.userEdited !== "1") {
      var rec = getRecommendedDown(p);
      downEl.value = String(Math.min(rec, max50));
    } else if (isFinite(cur) && cur > max50) {
      downEl.value = String(max50);
    }
  }

  function refreshDownHint() {
    if (!getHasDown()) return;
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
    var rec = getRecommendedDown(p);
    if (isFinite(cur) && cur > p) {
      downHint.textContent = "Взнос не может быть больше стоимости товара";
      downHint.classList.add("is-error");
    } else if (isFinite(cur) && !isMultipleOf50Rub(cur)) {
      downHint.textContent = "Взнос должен быть кратен 50 ₽";
      downHint.classList.add("is-error");
    } else {
      downHint.innerHTML =
        "Рекомендованный первый взнос — " +
        '<button type="button" class="hint-rec" aria-label="Подставить рекомендованную сумму в поле">' +
        formatMoney(rec) +
        "</button>. Кратно 50 ₽, не больше цены товара.";
      downHint.classList.remove("is-error");
    }
  }

  function onRecommendedDownClick(e) {
    if (!e.target.classList.contains("hint-rec")) return;
    e.preventDefault();
    if (!getHasDown()) return;
    var p = getPrice();
    if (!isFinite(p)) return;
    downEl.dataset.userEdited = "";
    var rec = getRecommendedDown(p);
    var max50 = getMaxDown(p);
    downEl.value = String(Math.min(rec, max50));
    downEl.focus();
    refreshDownHint();
    recalc();
  }

  function onPriceInput() {
    syncDownField();
    refreshDownHint();
    recalc();
  }

  function onDownInput() {
    downEl.dataset.userEdited = "1";
    refreshDownHint();
    recalc();
  }

  function onHasDownChange() {
    if (getHasDown()) {
      downBlock.classList.remove("is-hidden");
      downEl.dataset.userEdited = "";
      syncDownField();
      refreshDownHint();
    } else {
      downBlock.classList.add("is-hidden");
      downHint.textContent = "";
      downHint.classList.remove("is-error");
      downEl.value = "0";
      downEl.dataset.userEdited = "";
    }
    recalc();
  }

  function recalc() {
    var price = getPrice();
    var months = getMonths();
    var rate = getRateForMonths(months);
    var hasDown = getHasDown();

    if (!isFinite(price)) {
      outDown.textContent = "—";
      outMarkup.textContent = "—";
      outTotal.textContent = "—";
      outMonthly.textContent = "—";
      updateWhatsApp(null);
      return;
    }

    var down = 0;
    if (hasDown) {
      down = parseFloat(String(downEl.value).replace(",", "."));
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
    }

    var principal = price - down;
    var markupAmount = roundTo50(principal * (rate / 100));
    var rawTotal = price + markupAmount;
    var totalPay = roundTotalPayForSchedule(rawTotal, price, months, down);
    markupAmount = totalPay - price;

    var monthly = months > 0 ? (totalPay - down) / months : 0;

    if (hasDown) {
      rowDown.classList.remove("is-hidden");
      outDown.textContent = formatMoney(down);
    } else {
      rowDown.classList.add("is-hidden");
    }

    outMarkup.textContent = formatMoney(markupAmount);
    outTotal.textContent = formatMoney(totalPay);
    outMonthly.textContent = formatMoney(monthly);

    updateWhatsApp({
      price: price,
      hasDown: hasDown,
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
      "Первый взнос: " +
        (data.hasDown ? formatMoney(data.down) : "нет"),
      "Срок: " + data.months + " мес.",
      "Ежемесячный платёж: " + formatMoney(data.monthly),
      "Итоговая стоимость: " + formatMoney(data.totalPay)
    ];

    waLink.href =
      "https://wa.me/?text=" + encodeURIComponent(lines.join("\n"));
  }

  fillMonths();

  form.querySelectorAll('input[name="hasDown"]').forEach(function (el) {
    el.addEventListener("change", onHasDownChange);
  });

  priceEl.addEventListener("input", onPriceInput);
  priceEl.addEventListener("change", onPriceInput);
  downEl.addEventListener("input", onDownInput);
  downEl.addEventListener("change", onDownInput);
  downHint.addEventListener("click", onRecommendedDownClick);
  monthsEl.addEventListener("change", function () {
    syncDownField();
    refreshDownHint();
    recalc();
  });

  onHasDownChange();
})();
