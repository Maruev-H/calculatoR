(function () {
  "use strict";

  var RATES_WITH = {
    3: 11, 4: 14, 5: 18, 6: 21, 7: 25, 8: 28, 9: 32, 10: 35, 11: 39, 12: 42
  };

  var RATES_WITHOUT = {
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

  function formatPct(p) {
    return new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 0
    }).format(p) + " %";
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
   * Итог кратен (месяцы + (есть первый взнос ? 1 : 0)) * 50 ₽;
   * (итог − взнос) кратен месяцы * 50 ₽ — ежемесячный платёж целый и кратен 50 ₽.
   * Итог не ниже price, чтобы наценка в таблице не уходила в минус.
   */
  function roundTotalPayForSchedule(rawTotal, price, months, hasDown, down) {
    if (!isFinite(rawTotal) || months <= 0) return rawTotal;
    var stepGrid = (months + (hasDown ? 1 : 0)) * 50;
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

  function getPrice() {
    var v = parseFloat(String(priceEl.value).replace(",", "."));
    return isFinite(v) && v > 0 ? v : NaN;
  }

  function getMonths() {
    return parseInt(monthsEl.value, 10) || 3;
  }

  function getRateWithForMonths(m) {
    return RATES_WITH[m] != null ? RATES_WITH[m] : 0;
  }

  function getRateWithoutForMonths(m) {
    return RATES_WITHOUT[m] != null ? RATES_WITHOUT[m] : 0;
  }

  /** Мин. взнос: 20 % от итога к оплате, округление вверх до кратного 50 ₽. */
  function getMinDown(price, ratePercent) {
    var r = ratePercent / 100;
    var exact = (price * (1 + r)) / (5 + r);
    return Math.ceil(exact / 50) * 50;
  }

  /** Макс. взнос кратный 50 ₽, не больше цены товара. */
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
    if (!getHasDown()) return;
    var p = getPrice();
    if (!isFinite(p)) return;
    var min = getMinDown(p, getRateWithForMonths(getMonths()));
    var max50 = getMaxDown(p);
    downEl.min = "0";
    downEl.max = String(max50);
    var cur = parseFloat(String(downEl.value).replace(",", "."));
    if (!isFinite(cur) || downEl.dataset.userEdited !== "1") {
      downEl.value = String(min <= max50 ? min : max50);
    } else if (cur > max50) {
      downEl.value = String(max50);
    }
  }

  function refreshDownHint() {
    if (!getHasDown()) return;
    var p = getPrice();
    var min = isFinite(p) ? getMinDown(p, getRateWithForMonths(getMonths())) : 0;
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
    } else if (isFinite(cur) && cur < min) {
      downHint.textContent =
        "Ниже минимума " +
        formatMoney(min) +
        " — наценка считается по проценту «без взноса»";
      downHint.classList.remove("is-error");
    } else {
      downHint.textContent =
        "Кратно 50 ₽, не больше цены товара; от минимума — ставка «с взносом»";
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
    var hasDown = getHasDown();
    var rateWith = getRateWithForMonths(months);
    var rateWithout = getRateWithoutForMonths(months);

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
      var minDown = getMinDown(price, rateWith);
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
        outMonthly.textContent = "Макс. взнос — " + formatMoney(maxDown) + " (кратно 50 ₽)";
        updateWhatsApp(null);
        return;
      }
    }

    var minDownForCalc = hasDown ? getMinDown(price, rateWith) : NaN;
    var specialDownBoost =
      hasDown &&
      isFinite(minDownForCalc) &&
      down >= minDownForCalc + 5000;
    var subMinDown =
      hasDown && isFinite(minDownForCalc) && down < minDownForCalc;

    var markupAmount;
    var rateForMarkup;

    if (!hasDown) {
      rateForMarkup = rateWithout;
      markupAmount = roundTo50(price * (rateWithout / 100));
    } else if (subMinDown) {
      rateForMarkup = rateWithout;
      markupAmount = roundTo50(price * (rateWithout / 100));
    } else if (specialDownBoost) {
      rateForMarkup = rateWithout + 1;
      markupAmount = roundTo50((price - down) * (rateWithout / 100));
    } else {
      rateForMarkup = rateWith;
      markupAmount = roundTo50(price * (rateWith / 100));
    }

    var rawTotal = price + markupAmount;
    var totalPay = roundTotalPayForSchedule(
      rawTotal,
      price,
      months,
      hasDown,
      down
    );
    markupAmount = totalPay - price;

    var monthly = months > 0 ? (totalPay - down) / months : 0;

    var downPctOfTotal = totalPay > 0 ? (down / totalPay) * 100 : 0;
    var markupPctOfPrice = price > 0 ? (markupAmount / price) * 100 : 0;

    if (hasDown) {
      rowDown.classList.remove("is-hidden");
      outDown.textContent =
        formatMoney(down);
    } else {
      rowDown.classList.add("is-hidden");
    }

    outMarkup.textContent =
      formatMoney(markupAmount);
    outTotal.textContent = formatMoney(totalPay);
    outMonthly.textContent = formatMoney(monthly);

    updateWhatsApp({
      price: price,
      hasDown: hasDown,
      down: down,
      months: months,
      rate: rateForMarkup,
      markupAmount: markupAmount,
      totalPay: totalPay,
      monthly: monthly,
      downPctOfTotal: downPctOfTotal,
      markupPctOfPrice: markupPctOfPrice
    });
  }

  function updateWhatsApp(data) {
    if (!data) {
      waLink.href =
        "https://wa.me/?text=" +
        encodeURIComponent(intro + "\n\n(заполните форму для расчёта)");
      return;
    }

    var lines = [
      "Стоимость товара: " + formatMoney(data.price),
      "Взнос: " + (data.hasDown ? "да" : "нет"),
      "Срок: " + data.months + " мес.",
    ];

    if (data.hasDown) {
      lines.push(
        "Первый взнос: " +
          formatMoney(data.down)
      );
    }

    lines.push(
      "Ежемесячный платёж: " + formatMoney(data.monthly),
      "Итоговая стоимость: " + formatMoney(data.totalPay)
    );

    waLink.href =
      "https://wa.me/?text=" + encodeURIComponent(lines.join("\n"));
  }

  function onHasDownChange() {
    var has = getHasDown();
    if (has) {
      downBlock.classList.remove("is-hidden");
      downEl.dataset.userEdited = "";
      syncDownFromPrice();
      refreshDownHint();
    } else {
      downBlock.classList.add("is-hidden");
      downHint.textContent = "";
      downHint.classList.remove("is-error");
    }
    recalc();
  }

  fillMonths();

  form.querySelectorAll('input[name="hasDown"]').forEach(function (el) {
    el.addEventListener("change", onHasDownChange);
  });

  priceEl.addEventListener("input", onPriceInput);
  priceEl.addEventListener("change", onPriceInput);
  downEl.addEventListener("input", onDownInput);
  downEl.addEventListener("change", onDownInput);
  monthsEl.addEventListener("change", function () {
    syncDownFromPrice();
    refreshDownHint();
    recalc();
  });

  onHasDownChange();
  recalc();
})();
