(function () {
  var dataEl = document.getElementById("stats-data");
  var filters = document.querySelector("[data-stats-filters]");
  var pieMount = document.querySelector("[data-stats-pie]");
  var rereadMount = document.querySelector("[data-stats-reread]");
  var barsMount = document.querySelector("[data-stats-bars]");
  var lineMount = document.querySelector("[data-stats-line]");
  var ratingsMount = document.querySelector("[data-stats-ratings]");
  var summary = document.querySelector("[data-stats-summary]");
  var customBox = document.querySelector("[data-stats-custom]");
  var fromInput = document.querySelector("[data-stats-from]");
  var toInput = document.querySelector("[data-stats-to]");
  if (
    !dataEl ||
    !filters ||
    !pieMount ||
    !rereadMount ||
    !barsMount ||
    !lineMount ||
    !ratingsMount ||
    !customBox ||
    !fromInput ||
    !toInput
  ) {
    return;
  }

  var reviews = [];
  try {
    reviews = JSON.parse(dataEl.textContent || "[]");
    if (typeof reviews === "string") {
      reviews = JSON.parse(reviews);
    }
    if (!Array.isArray(reviews)) {
      reviews = [];
    }
  } catch (e) {
    reviews = [];
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var SVG_NS = "http://www.w3.org/2000/svg";
  var MS_DAY = 86400000;
  var CHART_SCALE = 1.0;
  var range = "all";

  function parseDay(iso) {
    var parts = String(iso || "").split("-");
    if (parts.length < 3) {
      return null;
    }
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatDay(date) {
    var month = String(date.getMonth() + 1);
    var day = String(date.getDate());
    if (month.length < 2) {
      month = "0" + month;
    }
    if (day.length < 2) {
      day = "0" + day;
    }
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addMonths(date, count) {
    var next = new Date(date.getFullYear(), date.getMonth() + count, 1);
    var last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(date.getDate(), last));
    return next;
  }

  function startOfWeek(date) {
    var day = date.getDay();
    var diff = day === 0 ? 6 : day - 1;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - diff);
  }

  function daysBetween(from, to) {
    return Math.round((startOfDay(to) - startOfDay(from)) / MS_DAY) + 1;
  }

  function clampRating(value) {
    var rating = Number(value);
    if (!isFinite(rating)) {
      rating = 0;
    }
    if (rating < 0) {
      rating = 0;
    }
    if (rating > 5) {
      rating = 5;
    }
    return rating;
  }

  function formatRating(value) {
    return value.toFixed(1);
  }

  function snapRating(value) {
    return Math.round(clampRating(value) * 2) / 2;
  }

  function normalizeReread(value) {
    if (value === true) {
      return "yes";
    }
    if (value === false) {
      return "no";
    }
    var text = String(value || "").toLowerCase();
    if (text === "yes" || text === "no" || text === "maybe") {
      return text;
    }
    return "no";
  }

  function ratingBuckets(list) {
    var buckets = [];
    var index = {};
    for (var s = 0; s <= 10; s += 1) {
      var value = s / 2;
      index[value] = buckets.length;
      buckets.push({
        rating: value,
        label: formatRating(value),
        count: 0,
      });
    }
    for (var i = 0; i < list.length; i += 1) {
      var snapped = snapRating(list[i].rating);
      if (index[snapped] !== undefined) {
        buckets[index[snapped]].count += 1;
      }
    }
    return buckets;
  }

  var parsed = [];
  var earliest = null;
  var latest = null;
  for (var i = 0; i < reviews.length; i += 1) {
    var item = reviews[i];
    var date = parseDay(item && item.date);
    if (!date || isNaN(date.getTime())) {
      continue;
    }
    date = startOfDay(date);
    var tags = [];
    if (item.tags && item.tags.length) {
      for (var t = 0; t < item.tags.length; t += 1) {
        if (item.tags[t]) {
          tags.push(String(item.tags[t]));
        }
      }
    }
    var pages = Number(item.pages);
    if (!isFinite(pages) || pages < 0) {
      pages = 0;
    }
    parsed.push({
      title: item.title ? String(item.title) : "Untitled",
      url: item.url ? String(item.url) : "",
      date: date,
      tags: tags,
      pages: pages,
      rating: clampRating(item.rating),
      reread: normalizeReread(item.reread),
    });
    if (!earliest || date < earliest) {
      earliest = date;
    }
    if (!latest || date > latest) {
      latest = date;
    }
  }

  var today = startOfDay(new Date());
  if (!earliest) {
    earliest = today;
  }
  if (!latest) {
    latest = today;
  }

  fromInput.min = formatDay(earliest);
  fromInput.max = formatDay(latest);
  toInput.min = formatDay(earliest);
  toInput.max = formatDay(latest);
  fromInput.value = formatDay(earliest);
  toInput.value = formatDay(latest);

  function presetWindow(kind) {
    if (kind === "1m") {
      return { from: addMonths(today, -1), to: today };
    }
    if (kind === "3m") {
      return { from: addMonths(today, -3), to: today };
    }
    if (kind === "6m") {
      return { from: addMonths(today, -6), to: today };
    }
    if (kind === "1y") {
      return { from: addMonths(today, -12), to: today };
    }
    return { from: earliest, to: latest };
  }

  function customWindow(edited) {
    var from = parseDay(fromInput.value) || earliest;
    var to = parseDay(toInput.value) || latest;
    if (from > to) {
      if (edited === "from") {
        to = from;
      } else {
        from = to;
      }
      fromInput.value = formatDay(from);
      toInput.value = formatDay(to);
    }
    return { from: startOfDay(from), to: startOfDay(to) };
  }

  function activeWindow(edited) {
    if (range === "custom") {
      return customWindow(edited);
    }
    return presetWindow(range);
  }

  function inWindow(review, window) {
    return review.date >= window.from && review.date <= window.to;
  }

  function svgEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        el.setAttribute(key, attrs[key]);
      });
    }
    return el;
  }

  function emptyMessage() {
    var p = document.createElement("p");
    p.className = "stats__empty";
    p.textContent = "No reviews in this period.";
    return p;
  }

  function hiddenTable(caption, headers, rows) {
    var table = document.createElement("table");
    table.className = "stats__sr";
    var cap = document.createElement("caption");
    cap.textContent = caption;
    table.appendChild(cap);
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    for (var h = 0; h < headers.length; h += 1) {
      var th = document.createElement("th");
      th.scope = "col";
      th.textContent = headers[h];
      headRow.appendChild(th);
    }
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    for (var r = 0; r < rows.length; r += 1) {
      var tr = document.createElement("tr");
      for (var c = 0; c < rows[r].length; c += 1) {
        var td = document.createElement("td");
        td.textContent = rows[r][c];
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    return table;
  }

  function appendScrollableChart(mount, svg) {
    var scroll = document.createElement("div");
    scroll.className = "stats__chart-scroll";
    scroll.appendChild(svg);
    mount.appendChild(scroll);

    var yGroup = svg.querySelector(".stats__sticky-y");
    var xLabel = svg.querySelector(".stats__sticky-x");
    function pin() {
      var x = scroll.scrollLeft;
      if (yGroup) {
        yGroup.setAttribute("transform", "translate(" + x + ",0)");
      }
      if (xLabel) {
        xLabel.setAttribute("x", String(x + scroll.clientWidth / 2));
      }
    }
    scroll.addEventListener("scroll", pin, { passive: true });
    pin();
  }

  function genreSlices(list) {
    var counts = {};
    for (var i = 0; i < list.length; i += 1) {
      var tags = list[i].tags;
      if (!tags.length) {
        counts.Untagged = (counts.Untagged || 0) + 1;
      } else {
        for (var t = 0; t < tags.length; t += 1) {
          counts[tags[t]] = (counts[tags[t]] || 0) + 1;
        }
      }
    }
    var slices = [];
    Object.keys(counts).forEach(function (name) {
      slices.push({ name: name, count: counts[name] });
    });
    slices.sort(function (a, b) {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    });
    var total = 0;
    for (var s = 0; s < slices.length; s += 1) {
      total += slices[s].count;
    }
    return { slices: slices, total: total };
  }

  function rereadSlices(list) {
    var groups = { yes: [], maybe: [], no: [] };
    for (var i = 0; i < list.length; i += 1) {
      groups[list[i].reread].push({
        title: list[i].title,
        url: list[i].url || "",
      });
    }
    var order = [
      { key: "yes", name: "Yes", color: 1 },
      { key: "maybe", name: "Maybe", color: 2 },
      { key: "no", name: "No", color: 3 },
    ];
    var slices = [];
    var total = 0;
    for (var o = 0; o < order.length; o += 1) {
      var item = order[o];
      var books = groups[item.key];
      if (books.length > 0) {
        books.sort(function (a, b) {
          return a.title.localeCompare(b.title);
        });
        slices.push({
          name: item.name,
          key: item.key,
          count: books.length,
          color: item.color,
          books: books,
        });
        total += books.length;
      }
    }
    return { slices: slices, total: total };
  }

  function appendRereadBooks(li, books) {
    var list = document.createElement("ul");
    list.className = "stats__reread-books";
    for (var i = 0; i < books.length; i += 1) {
      var item = document.createElement("li");
      if (books[i].url) {
        var link = document.createElement("a");
        link.href = books[i].url;
        link.textContent = books[i].title;
        item.appendChild(link);
      } else {
        item.textContent = books[i].title;
      }
      list.appendChild(item);
    }
    li.appendChild(list);
  }

  function bindRereadSliceHover(mount) {
    var parts = mount.querySelectorAll(".stats__slice[data-reread-key]");
    for (var i = 0; i < parts.length; i += 1) {
      parts[i].addEventListener("mouseenter", function () {
        var row = mount.querySelector(
          '.stats__legend-item[data-reread-key="' + this.getAttribute("data-reread-key") + '"]'
        );
        if (row) {
          row.classList.add("is-open");
        }
      });
      parts[i].addEventListener("mouseleave", function () {
        var row = mount.querySelector(
          '.stats__legend-item[data-reread-key="' + this.getAttribute("data-reread-key") + '"]'
        );
        if (row) {
          row.classList.remove("is-open");
        }
      });
    }
  }

  function sliceColor(slice, index) {
    if (slice.color) {
      return slice.color;
    }
    return (index % 8) + 1;
  }

  function polar(cx, cy, radius, angle) {
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  }

  function drawPieChart(mount, data, caption, headers) {
    mount.replaceChildren();
    if (!data.total) {
      mount.appendChild(emptyMessage());
      return;
    }

    var size = 220 * CHART_SCALE;
    var cx = size / 2;
    var cy = size / 2;
    var radius = 88 * CHART_SCALE;
    var svg = svgEl("svg", {
      viewBox: "0 0 " + size + " " + size,
      width: String(size),
      height: String(size),
      class: "stats__pie",
      role: "img",
      "aria-hidden": "true",
    });

    if (data.slices.length === 1) {
      var onlyAttrs = {
        cx: String(cx),
        cy: String(cy),
        r: String(radius),
        class: "stats__slice",
        style: "fill: var(--stats-cat-" + sliceColor(data.slices[0], 0) + ")",
      };
      if (data.slices[0].key) {
        onlyAttrs["data-reread-key"] = data.slices[0].key;
      }
      var only = svgEl("circle", onlyAttrs);
      svg.appendChild(only);
    } else {
      var angle = -Math.PI / 2;
      for (var i = 0; i < data.slices.length; i += 1) {
        var sweep = (data.slices[i].count / data.total) * Math.PI * 2;
        var next = angle + sweep;
        var start = polar(cx, cy, radius, angle);
        var end = polar(cx, cy, radius, next);
        var large = sweep > Math.PI ? 1 : 0;
        var pathAttrs = {
          d:
            "M " +
            cx +
            " " +
            cy +
            " L " +
            start.x +
            " " +
            start.y +
            " A " +
            radius +
            " " +
            radius +
            " 0 " +
            large +
            " 1 " +
            end.x +
            " " +
            end.y +
            " Z",
          class: "stats__slice",
          style: "fill: var(--stats-cat-" + sliceColor(data.slices[i], i) + ")",
        };
        if (data.slices[i].key) {
          pathAttrs["data-reread-key"] = data.slices[i].key;
        }
        var path = svgEl("path", pathAttrs);
        svg.appendChild(path);
        angle = next;
      }
    }

    var wrap = document.createElement("div");
    wrap.className = "stats__pie-wrap";
    wrap.appendChild(svg);

    var legend = document.createElement("ul");
    legend.className = "stats__legend";
    var rows = [];
    for (var s = 0; s < data.slices.length; s += 1) {
      var slice = data.slices[s];
      var pct = Math.round((slice.count / data.total) * 100);
      var li = document.createElement("li");
      li.className = "stats__legend-item";
      if (slice.key) {
        li.setAttribute("data-reread-key", slice.key);
      }
      var swatch = document.createElement("span");
      swatch.className = "stats__swatch";
      swatch.style.background = "var(--stats-cat-" + sliceColor(slice, s) + ")";
      var name = document.createElement("span");
      name.className = "stats__legend-name";
      name.textContent = slice.name;
      var meta = document.createElement("span");
      meta.className = "stats__legend-meta";
      meta.textContent = slice.count + " (" + pct + "%)";
      li.appendChild(swatch);
      li.appendChild(name);
      li.appendChild(meta);
      if (slice.books && slice.books.length) {
        li.className += " stats__legend-item--books";
        li.tabIndex = 0;
        appendRereadBooks(li, slice.books);
      }
      legend.appendChild(li);
      rows.push([slice.name, String(slice.count), pct + "%"]);
    }

    wrap.appendChild(legend);
    mount.appendChild(wrap);
    bindRereadSliceHover(mount);
    // mount.appendChild(hiddenTable(caption, headers, rows));
  }

  function drawPie(list) {
    drawPieChart(pieMount, genreSlices(list), "Genres reviewed", ["Genre", "Reviews", "Share"]);
  }

  function drawReread(list) {
    drawPieChart(rereadMount, rereadSlices(list), "Would reread", ["Reread", "Reviews", "Share"]);
  }

  function bucketsFor(list, window) {
    var weekly = daysBetween(window.from, window.to) <= 90;
    var buckets = [];
    var index = {};

    if (weekly) {
      var week = startOfWeek(window.from);
      var lastWeek = startOfWeek(window.to);
      while (week <= lastWeek) {
        var key = formatDay(week);
        var weekLabel = week.getDate() + " " + MONTHS[week.getMonth()];
        var bucket = {
          key: key,
          label: weekLabel,
          fullLabel: weekLabel,
          count: 0,
          pages: 0,
        };
        index[key] = buckets.length;
        buckets.push(bucket);
        week = new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7);
      }
      for (var r = 0; r < list.length; r += 1) {
        var weekKey = formatDay(startOfWeek(list[r].date));
        if (index[weekKey] !== undefined) {
          buckets[index[weekKey]].count += 1;
          buckets[index[weekKey]].pages += list[r].pages;
        }
      }
    } else {
      var month = new Date(window.from.getFullYear(), window.from.getMonth(), 1);
      var lastMonth = new Date(window.to.getFullYear(), window.to.getMonth(), 1);
      var showYear = window.from.getFullYear() !== window.to.getFullYear();
      var labeledYear = null;
      while (month <= lastMonth) {
        var monthKey = month.getFullYear() + "-" + String(month.getMonth() + 1);
        var monthName = MONTHS[month.getMonth()];
        var year = month.getFullYear();
        var tickLabel = monthName;
        if (showYear && year !== labeledYear) {
          tickLabel = monthName + " ’" + String(year).slice(-2);
          labeledYear = year;
        }
        var monthBucket = {
          key: monthKey,
          label: tickLabel,
          fullLabel: showYear ? monthName + " " + year : monthName,
          count: 0,
          pages: 0,
        };
        index[monthKey] = buckets.length;
        buckets.push(monthBucket);
        month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      }
      for (var b = 0; b < list.length; b += 1) {
        var reviewMonth = list[b].date.getFullYear() + "-" + String(list[b].date.getMonth() + 1);
        if (index[reviewMonth] !== undefined) {
          buckets[index[reviewMonth]].count += 1;
          buckets[index[reviewMonth]].pages += list[b].pages;
        }
      }
    }

    return buckets;
  }

  function measureTick(text) {
    var svg = svgEl("svg", {
      class: "stats__bars",
      width: "240",
      height: "40",
      "aria-hidden": "true",
    });
    svg.style.position = "absolute";
    svg.style.left = "-9999px";
    var probe = svgEl("text", { class: "stats__tick", x: "0", y: "16" });
    probe.textContent = text;
    svg.appendChild(probe);
    barsMount.appendChild(svg);
    var width = probe.getBBox().width;
    svg.remove();
    return width;
  }

  function xLabelsNeedRotate(buckets, labelStep, slot) {
    var longest = "";
    for (var i = 0; i < buckets.length; i += 1) {
      if (i % labelStep !== 0) {
        continue;
      }
      if (buckets[i].label.length > longest.length) {
        longest = buckets[i].label;
      }
    }
    return longest ? measureTick(longest) > slot : false;
  }

  function chartBox(mount, minWidth, minHeight) {
    var width = Math.max(minWidth, Math.floor(mount.clientWidth || 0));
    var leftover = Math.floor(window.innerHeight - mount.getBoundingClientRect().top - 24);
    return {
      width: width,
      height: Math.max(minHeight, leftover),
    };
  }

  function appendYAxisLabel(parent, top, plotH, yTitle) {
    var yLabelX = 14;
    var yLabelY = top + plotH / 2;
    var yLabel = svgEl("text", {
      x: String(yLabelX),
      y: String(yLabelY),
      class: "stats__axis-label",
      "text-anchor": "middle",
      transform: "rotate(-90 " + yLabelX + " " + yLabelY + ")",
    });
    yLabel.textContent = yTitle;
    parent.appendChild(yLabel);
  }

  function appendXAxisLabel(parent, left, top, plotW, plotH, xTitle, rotateLabels, extraClass) {
    var xLabel = svgEl("text", {
      x: String(left + plotW / 2),
      y: String(top + plotH + (rotateLabels ? 70 : 36)),
      class: extraClass ? "stats__axis-label " + extraClass : "stats__axis-label",
      "text-anchor": "middle",
    });
    xLabel.textContent = xTitle;
    parent.appendChild(xLabel);
  }

  function appendAxisLabels(svg, left, top, plotW, plotH, xTitle, yTitle, rotateLabels) {
    appendYAxisLabel(svg, top, plotH, yTitle);
    appendXAxisLabel(svg, left, top, plotW, plotH, xTitle, rotateLabels);
  }

  function createStickyYAxis(left, top, plotH, height, max, yTitle) {
    var g = svgEl("g", { class: "stats__sticky-y" });
    g.appendChild(
      svgEl("rect", {
        x: "0",
        y: "0",
        width: String(left),
        height: String(height),
        class: "stats__sticky-y-bg",
      })
    );
    g.appendChild(
      svgEl("line", {
        x1: String(left),
        y1: String(top),
        x2: String(left),
        y2: String(top + plotH),
        class: "stats__axis",
      })
    );
    var ticks = max <= 4 ? max : 4;
    for (var n = 0; n <= ticks; n += 1) {
      var value = Math.round((max * n) / ticks);
      var y = top + plotH - (value / max) * plotH;
      var tick = svgEl("text", {
        x: String(left - 8),
        y: String(y + 4),
        class: "stats__tick",
        "text-anchor": "end",
      });
      tick.textContent = String(value);
      g.appendChild(tick);
    }
    appendYAxisLabel(g, top, plotH, yTitle);
    return g;
  }

  function drawBars(list, window) {
    barsMount.replaceChildren();
    if (!list.length) {
      barsMount.appendChild(emptyMessage());
      return;
    }

    var buckets = bucketsFor(list, window);
    var max = 0;
    var rows = [];
    for (var i = 0; i < buckets.length; i += 1) {
      if (buckets[i].count > max) {
        max = buckets[i].count;
      }
      rows.push([buckets[i].fullLabel || buckets[i].label, String(buckets[i].count)]);
    }
    if (max < 1) {
      max = 1;
    }

    var left = 58;
    var right = 12;
    var top = 12;
    var bottom = 58;
    var width = Math.max(420, buckets.length * 36);
    var height = 254 * CHART_SCALE;
    var plotW = width - left - right;
    var plotH = height - top - bottom;
    var gap = buckets.length > 18 ? 2 : 8;
    var barW = Math.max(4, plotW / buckets.length - gap);
    var slot = barW + gap;
    var labelStep = buckets.length <= 14 ? 1 : Math.ceil(buckets.length / 12);
    var rotateLabels = xLabelsNeedRotate(buckets, labelStep, slot);
    if (rotateLabels) {
      bottom = 92;
      height = 288 * CHART_SCALE;
      plotH = height - top - bottom;
    }

    var svg = svgEl("svg", {
      viewBox: "0 0 " + width + " " + height,
      width: String(width),
      height: String(height),
      class: "stats__bars",
      role: "img",
      "aria-hidden": "true",
      preserveAspectRatio: "xMidYMid meet",
    });

    svg.appendChild(
      svgEl("line", {
        x1: String(left),
        y1: String(top + plotH),
        x2: String(left + plotW),
        y2: String(top + plotH),
        class: "stats__axis",
      })
    );

    for (var b = 0; b < buckets.length; b += 1) {
      var x = left + b * (barW + gap) + gap / 2;
      var barH = (buckets[b].count / max) * plotH;
      var yBar = top + plotH - barH;
      var rect = svgEl("rect", {
        x: String(x),
        y: String(yBar),
        width: String(barW),
        height: String(Math.max(barH, buckets[b].count ? 1 : 0)),
        class: "stats__bar",
      });
      svg.appendChild(rect);
      if (b % labelStep === 0) {
        var tickX = x + barW / 2;
        var tickY = top + plotH + (rotateLabels ? 10 : 16);
        var labelAttrs = {
          x: String(tickX),
          y: String(tickY),
          class: "stats__tick",
          "text-anchor": rotateLabels ? "end" : "middle",
        };
        if (rotateLabels) {
          labelAttrs.transform = "rotate(-45 " + tickX + " " + tickY + ")";
        }
        var label = svgEl("text", labelAttrs);
        label.textContent = buckets[b].label;
        svg.appendChild(label);
      }
    }

    appendXAxisLabel(svg, left, top, plotW, plotH, "Period", rotateLabels, "stats__sticky-x");
    svg.appendChild(createStickyYAxis(left, top, plotH, height, max, "No. of Books"));

    appendScrollableChart(barsMount, svg);
    // barsMount.appendChild(hiddenTable("Books reviewed", ["Period", "Reviews"], rows));
  }

  function drawLine(list, window) {
    lineMount.replaceChildren();
    if (!list.length) {
      lineMount.appendChild(emptyMessage());
      return;
    }

    var buckets = bucketsFor(list, window);
    var max = 0;
    var rows = [];
    for (var i = 0; i < buckets.length; i += 1) {
      if (buckets[i].pages > max) {
        max = buckets[i].pages;
      }
      rows.push([buckets[i].fullLabel || buckets[i].label, String(buckets[i].pages)]);
    }
    if (max < 1) {
      max = 1;
    }

    var left = 58;
    var right = 16;
    var top = 16;
    var bottom = 58;
    var width = Math.max(420, buckets.length * 36);
    var height = 254 * CHART_SCALE;
    var plotW = width - left - right;
    var plotH = height - top - bottom;
    var step = plotW / Math.max(buckets.length - 1, 1);
    var slot = buckets.length > 1 ? step : plotW;
    var labelStep = buckets.length <= 14 ? 1 : Math.ceil(buckets.length / 12);
    var rotateLabels = xLabelsNeedRotate(buckets, labelStep, slot);
    if (rotateLabels) {
      bottom = 92;
      height = 288 * CHART_SCALE;
      plotH = height - top - bottom;
    }

    var svg = svgEl("svg", {
      viewBox: "0 0 " + width + " " + height,
      width: String(width),
      height: String(height),
      class: "stats__lines",
      role: "img",
      "aria-hidden": "true",
      preserveAspectRatio: "xMidYMid meet",
    });

    svg.appendChild(
      svgEl("line", {
        x1: String(left),
        y1: String(top + plotH),
        x2: String(left + plotW),
        y2: String(top + plotH),
        class: "stats__axis",
      })
    );

    var points = [];
    for (var b = 0; b < buckets.length; b += 1) {
      var x = buckets.length === 1 ? left + plotW / 2 : left + b * step;
      var yPoint = top + plotH - (buckets[b].pages / max) * plotH;
      points.push(x + "," + yPoint);
    }

    svg.appendChild(
      svgEl("polyline", {
        points: points.join(" "),
        class: "stats__line",
        fill: "none",
      })
    );

    for (var p = 0; p < buckets.length; p += 1) {
      var px = buckets.length === 1 ? left + plotW / 2 : left + p * step;
      var py = top + plotH - (buckets[p].pages / max) * plotH;
      svg.appendChild(
        svgEl("circle", {
          cx: String(px),
          cy: String(py),
          r: String(3.5 * CHART_SCALE),
          class: "stats__point",
        })
      );
      if (p % labelStep === 0) {
        var tickY = top + plotH + (rotateLabels ? 10 : 16);
        var labelAttrs = {
          x: String(px),
          y: String(tickY),
          class: "stats__tick",
          "text-anchor": rotateLabels ? "end" : "middle",
        };
        if (rotateLabels) {
          labelAttrs.transform = "rotate(-45 " + px + " " + tickY + ")";
        }
        var label = svgEl("text", labelAttrs);
        label.textContent = buckets[p].label;
        svg.appendChild(label);
      }
    }

    appendXAxisLabel(svg, left, top, plotW, plotH, "Period", rotateLabels, "stats__sticky-x");
    svg.appendChild(createStickyYAxis(left, top, plotH, height, max, "No. of Pages"));

    appendScrollableChart(lineMount, svg);
    // lineMount.appendChild(hiddenTable("Pages read", ["Period", "Pages"], rows));
  }

  function drawRatings(list) {
    ratingsMount.replaceChildren();
    if (!list.length) {
      ratingsMount.appendChild(emptyMessage());
      return;
    }

    var buckets = ratingBuckets(list);
    var max = 0;
    var rows = [];
    for (var i = 0; i < buckets.length; i += 1) {
      if (buckets[i].count > max) {
        max = buckets[i].count;
      }
      rows.push([buckets[i].label, String(buckets[i].count)]);
    }
    if (max < 1) {
      max = 1;
    }

    var left = 58;
    var right = 16;
    var top = 16;
    var bottom = 58;
    var box = chartBox(ratingsMount, 420, 254 * CHART_SCALE);
    var width = box.width;
    var height = box.height;
    var plotW = width - left - right;
    var gap = 8;
    var barW = Math.max(4, plotW / buckets.length - gap);
    var slot = barW + gap;
    var labelStep = 1;
    var rotateLabels = xLabelsNeedRotate(buckets, labelStep, slot);
    if (rotateLabels) {
      bottom = 92;
      height = Math.max(height, 288 * CHART_SCALE);
    }
    var plotH = height - top - bottom;

    var svg = svgEl("svg", {
      viewBox: "0 0 " + width + " " + height,
      width: "100%",
      height: String(height),
      class: "stats__bars",
      role: "img",
      "aria-hidden": "true",
      preserveAspectRatio: "none",
    });

    svg.appendChild(
      svgEl("line", {
        x1: String(left),
        y1: String(top),
        x2: String(left),
        y2: String(top + plotH),
        class: "stats__axis",
      })
    );
    svg.appendChild(
      svgEl("line", {
        x1: String(left),
        y1: String(top + plotH),
        x2: String(left + plotW),
        y2: String(top + plotH),
        class: "stats__axis",
      })
    );

    var yTicks = max <= 4 ? max : 4;
    for (var n = 0; n <= yTicks; n += 1) {
      var yValue = Math.round((max * n) / yTicks);
      var y = top + plotH - (yValue / max) * plotH;
      var yTick = svgEl("text", {
        x: String(left - 8),
        y: String(y + 4),
        class: "stats__tick",
        "text-anchor": "end",
      });
      yTick.textContent = String(yValue);
      svg.appendChild(yTick);
    }

    for (var b = 0; b < buckets.length; b += 1) {
      var x = left + b * (barW + gap) + gap / 2;
      var barH = (buckets[b].count / max) * plotH;
      var yBar = top + plotH - barH;
      svg.appendChild(
        svgEl("rect", {
          x: String(x),
          y: String(yBar),
          width: String(barW),
          height: String(Math.max(barH, buckets[b].count ? 1 : 0)),
          class: "stats__bar",
        })
      );
      if (b % labelStep === 0) {
        var tickX = x + barW / 2;
        var tickY = top + plotH + (rotateLabels ? 10 : 16);
        var labelAttrs = {
          x: String(tickX),
          y: String(tickY),
          class: "stats__tick",
          "text-anchor": rotateLabels ? "end" : "middle",
        };
        if (rotateLabels) {
          labelAttrs.transform = "rotate(-45 " + tickX + " " + tickY + ")";
        }
        var label = svgEl("text", labelAttrs);
        label.textContent = buckets[b].label;
        svg.appendChild(label);
      }
    }

    appendAxisLabels(svg, left, top, plotW, plotH, "Rating Score", "No. of Books", rotateLabels);

    ratingsMount.appendChild(svg);
    // ratingsMount.appendChild(hiddenTable("Rating distribution", ["Rating", "Reviews"], rows));
  }

  function formatPages(count) {
    return count.toLocaleString("en-US");
  }

  function updateSummary(bookCount, pageCount) {
    if (!summary) {
      return;
    }
    var books = bookCount === 1 ? "1 book" : bookCount + " books";
    var pages = pageCount === 1 ? "1 page" : formatPages(pageCount) + " pages";
    summary.textContent = books + " · " + pages + " in this period.";
  }

  function setPressed() {
    var buttons = filters.querySelectorAll("[data-range]");
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].setAttribute("aria-pressed", buttons[i].getAttribute("data-range") === range ? "true" : "false");
    }
    customBox.hidden = range !== "custom";
  }

  function render(edited) {
    var window = activeWindow(edited);
    var list = [];
    for (var i = 0; i < parsed.length; i += 1) {
      if (inWindow(parsed[i], window)) {
        list.push(parsed[i]);
      }
    }
    var pageCount = 0;
    for (var p = 0; p < list.length; p += 1) {
      pageCount += list[p].pages;
    }
    updateSummary(list.length, pageCount);
    drawPie(list);
    drawReread(list);
    drawBars(list, window);
    drawLine(list, window);
    drawRatings(list);
  }

  filters.addEventListener("submit", function (event) {
    event.preventDefault();
  });

  filters.addEventListener("click", function (event) {
    var button = event.target.closest("[data-range]");
    if (!button || !filters.contains(button)) {
      return;
    }
    var next = button.getAttribute("data-range") || "all";
    if (next === "custom" && range !== "custom") {
      var current = presetWindow(range);
      fromInput.value = formatDay(current.from);
      toInput.value = formatDay(current.to);
    }
    range = next;
    setPressed();
    render();
  });

  fromInput.addEventListener("change", function () {
    range = "custom";
    setPressed();
    render("from");
  });

  toInput.addEventListener("change", function () {
    range = "custom";
    setPressed();
    render("to");
  });

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    if (resizeTimer) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(function () {
      resizeTimer = 0;
      render();
    }, 100);
  });

  setPressed();
  render();
})();
