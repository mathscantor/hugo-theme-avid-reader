(function () {
  var SCALE_CAP = 1.85;
  var LEAN_ANGLE = (12 * Math.PI) / 180;
  var KISS_GAP = 1;

  function positionOf(slot) {
    if (slot.classList.contains("shelf__slot--lean-left")) {
      return "lean-left";
    }
    if (slot.classList.contains("shelf__slot--lean-right")) {
      return "lean-right";
    }
    if (slot.classList.contains("shelf__slot--horizontal")) {
      return "horizontal";
    }
    return "vertical";
  }

  function bookOf(slot) {
    return slot.querySelector(".book-spine");
  }

  function overhangPx(slot) {
    var book = bookOf(slot);
    if (!book) {
      return 0;
    }
    var standing =
      positionOf(slot) === "horizontal" ? book.offsetWidth : book.offsetHeight;
    return standing * Math.sin(LEAN_ANGLE);
  }

  function takeRun(slots, start) {
    var pos = positionOf(slots[start]);
    var run = [slots[start]];
    for (var i = start + 1; i < slots.length; i += 1) {
      if (positionOf(slots[i]) !== pos) {
        break;
      }
      run.push(slots[i]);
    }
    return run;
  }

  function shouldKiss(leftPos, rightPos) {
    return !(leftPos === "horizontal" && rightPos === "horizontal");
  }

  function setup(shelf) {
    var camera = shelf.querySelector(".shelf__camera");
    var viewport = shelf.querySelector(".shelf__viewport");
    var pages = shelf.querySelectorAll(".shelf__books");
    var prev = shelf.querySelector("[data-shelf-dir='-1']");
    var next = shelf.querySelector("[data-shelf-dir='1']");
    var status = shelf.querySelector(".shelf__pager-status");
    if (!camera || !viewport || !pages.length) {
      return;
    }

    var index = 0;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var paged = pages.length > 1;

    function applyScale(value) {
      shelf.style.setProperty("--shelf-scale", String(value));
      void shelf.offsetWidth;
    }

    function slotList(page) {
      return Array.prototype.slice.call(page.querySelectorAll(".shelf__slot"));
    }

    function columnGap(page) {
      var gap = parseFloat(window.getComputedStyle(page).columnGap);
      return isFinite(gap) ? gap : 0;
    }

    function slotBottom(slot) {
      return slot.offsetTop + slot.offsetHeight;
    }

    function pageWraps(page) {
      var slots = slotList(page);
      if (slots.length < 2) {
        return false;
      }
      return Math.abs(slotBottom(slots[0]) - slotBottom(slots[slots.length - 1])) >= 2;
    }

    function anyPageWraps() {
      for (var i = 0; i < pages.length; i += 1) {
        if (pageWraps(pages[i])) {
          return true;
        }
      }
      return false;
    }

    function logicalWidth(slots, gap) {
      var width = 0;
      var i = 0;
      var first = true;
      while (i < slots.length) {
        var pos = positionOf(slots[i]);
        var run = takeRun(slots, i);
        var unit = 0;
        if (
          pos === "lean-right" &&
          i + 1 < slots.length &&
          positionOf(slots[i + 1]) === "horizontal"
        ) {
          run = takeRun(slots, i + 1);
          for (var rh = 0; rh < run.length; rh += 1) {
            unit = Math.max(unit, run[rh].offsetWidth);
          }
          i += 1 + run.length;
        } else if (pos === "horizontal") {
          for (var hh = 0; hh < run.length; hh += 1) {
            unit = Math.max(unit, run[hh].offsetWidth);
          }
          i += run.length;
          if (i < slots.length && positionOf(slots[i]) === "lean-left") {
            i += 1;
          }
        } else if (
          (pos === "lean-left" || pos === "lean-right") &&
          run.length >= 2
        ) {
          for (var l = 0; l < run.length; l += 1) {
            unit += run[l].offsetWidth;
          }
          if (pos === "lean-left") {
            unit += overhangPx(run[0]);
          }
          if (pos === "lean-right") {
            unit += overhangPx(run[run.length - 1]);
          }
          i += run.length;
        } else {
          unit = slots[i].offsetWidth;
          if (pos === "lean-left" || pos === "lean-right") {
            unit += overhangPx(slots[i]);
          }
          i += 1;
        }
        if (!first) {
          width += gap;
        }
        width += unit;
        first = false;
      }
      return width;
    }

    function pageContentWidth(page) {
      var slots = slotList(page);
      if (!slots.length) {
        return 0;
      }
      return logicalWidth(slots, columnGap(page));
    }

    function spineQuad(slot) {
      var book = bookOf(slot);
      if (!book) {
        return null;
      }
      var w = book.offsetWidth;
      var h = book.offsetHeight;
      var cs = window.getComputedStyle(book);
      var parts = (cs.transformOrigin || "0 0").split(" ");
      var ox = parseFloat(parts[0]) || 0;
      var oy = parseFloat(parts[1]) || 0;
      var raw = cs.transform;
      var matrix;
      try {
        matrix = new DOMMatrix(!raw || raw === "none" ? "matrix(1, 0, 0, 1, 0, 0)" : raw);
      } catch (err) {
        matrix = new DOMMatrix();
      }
      var local = [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
      ];
      var xform = [];
      var minX = Infinity;
      var minY = Infinity;
      var i;
      for (i = 0; i < 4; i += 1) {
        var pt = matrix.transformPoint(
          new DOMPoint(local[i][0] - ox, local[i][1] - oy)
        );
        xform.push([pt.x, pt.y]);
        if (pt.x < minX) {
          minX = pt.x;
        }
        if (pt.y < minY) {
          minY = pt.y;
        }
      }
      var box = book.getBoundingClientRect();
      var dx = box.left - minX;
      var dy = box.top - minY;
      for (i = 0; i < 4; i += 1) {
        xform[i][0] += dx;
        xform[i][1] += dy;
      }
      return xform;
    }

    function xsAtY(quad, y) {
      var xs = [];
      var i;
      for (i = 0; i < 4; i += 1) {
        var a = quad[i];
        var b = quad[(i + 1) % 4];
        var y0 = a[1];
        var y1 = b[1];
        if (Math.abs(y1 - y0) < 1e-6) {
          if (Math.abs(y - y0) < 1e-6) {
            xs.push(a[0], b[0]);
          }
          continue;
        }
        var t = (y - y0) / (y1 - y0);
        if (t >= -1e-6 && t <= 1 + 1e-6) {
          xs.push(a[0] + t * (b[0] - a[0]));
        }
      }
      return xs;
    }

    function quadBounds(quad) {
      var minY = Infinity;
      var maxY = -Infinity;
      var i;
      for (i = 0; i < quad.length; i += 1) {
        if (quad[i][1] < minY) {
          minY = quad[i][1];
        }
        if (quad[i][1] > maxY) {
          maxY = quad[i][1];
        }
      }
      return { minY: minY, maxY: maxY };
    }

    function horizontalRunOf(slot) {
      var page = slot.parentNode;
      if (!page) {
        return [slot];
      }
      var slots = slotList(page);
      var i = slots.indexOf(slot);
      if (i < 0 || positionOf(slot) !== "horizontal") {
        return [slot];
      }
      var start = i;
      while (start > 0 && positionOf(slots[start - 1]) === "horizontal") {
        start -= 1;
      }
      return takeRun(slots, start);
    }

    function quadsOf(slot) {
      var group =
        positionOf(slot) === "horizontal" ? horizontalRunOf(slot) : [slot];
      var quads = [];
      var i;
      for (i = 0; i < group.length; i += 1) {
        var quad = spineQuad(group[i]);
        if (quad) {
          quads.push(quad);
        }
      }
      return quads;
    }

    function pairGap(left, right) {
      var lefts = quadsOf(left);
      var rights = quadsOf(right);
      if (!lefts.length || !rights.length) {
        return 0;
      }
      var y0 = Infinity;
      var y1 = -Infinity;
      var i;
      var bounds;
      for (i = 0; i < lefts.length; i += 1) {
        bounds = quadBounds(lefts[i]);
        if (bounds.minY < y0) {
          y0 = bounds.minY;
        }
        if (bounds.maxY > y1) {
          y1 = bounds.maxY;
        }
      }
      var rightMinY = Infinity;
      var rightMaxY = -Infinity;
      for (i = 0; i < rights.length; i += 1) {
        bounds = quadBounds(rights[i]);
        if (bounds.minY < rightMinY) {
          rightMinY = bounds.minY;
        }
        if (bounds.maxY > rightMaxY) {
          rightMaxY = bounds.maxY;
        }
      }
      y0 = Math.max(y0, rightMinY);
      y1 = Math.min(y1, rightMaxY);
      if (y1 <= y0) {
        return 0;
      }
      var worst = Infinity;
      var s;
      for (s = 0; s <= 8; s += 1) {
        var y = y0 + ((y1 - y0) * s) / 8;
        var leftMax = -Infinity;
        var rightMin = Infinity;
        var q;
        var xs;
        for (q = 0; q < lefts.length; q += 1) {
          xs = xsAtY(lefts[q], y);
          if (xs.length) {
            leftMax = Math.max(leftMax, Math.max.apply(null, xs));
          }
        }
        for (q = 0; q < rights.length; q += 1) {
          xs = xsAtY(rights[q], y);
          if (xs.length) {
            rightMin = Math.min(rightMin, Math.min.apply(null, xs));
          }
        }
        if (leftMax === -Infinity || rightMin === Infinity) {
          continue;
        }
        var g = rightMin - leftMax;
        if (g < worst) {
          worst = g;
        }
      }
      return worst === Infinity ? 0 : worst;
    }

    function setPackLeft(slot, value) {
      slot.style.marginLeft = value + "px";
      slot.style.setProperty("--pack-left", Math.max(0, value) + "px");
    }

    function clearPackStyle(slot) {
      slot.style.marginLeft = "";
      slot.style.marginRight = "";
      slot.style.paddingTop = "";
      slot.style.width = "";
      slot.style.alignItems = "";
      slot.style.zIndex = "";
      slot.style.removeProperty("--pack-left");
      slot.style.removeProperty("--pack-right");
      slot.style.removeProperty("--plank-height");
      var book = bookOf(slot);
      if (book) {
        book.style.position = "";
        book.style.bottom = "";
      }
    }

    function resetPack(page) {
      var slots = slotList(page);
      for (var i = 0; i < slots.length; i += 1) {
        clearPackStyle(slots[i]);
      }
      page.style.justifyContent = "";
    }

    function groupRows(slots) {
      var rows = [];
      var current = [];
      var bottom = 0;
      for (var i = 0; i < slots.length; i += 1) {
        var nextBottom = slotBottom(slots[i]);
        if (current.length && Math.abs(nextBottom - bottom) >= 2) {
          rows.push(current);
          current = [];
        }
        current.push(slots[i]);
        bottom = nextBottom;
      }
      if (current.length) {
        rows.push(current);
      }
      return rows;
    }

    function stackHorizontals(slots, gap) {
      var i = 0;
      while (i < slots.length) {
        if (positionOf(slots[i]) !== "horizontal") {
          i += 1;
          continue;
        }
        var run = takeRun(slots, i);
        if (run.length < 2) {
          i += 1;
          continue;
        }
        var heights = [];
        var maxW = 0;
        var r;
        for (r = 0; r < run.length; r += 1) {
          var book = bookOf(run[r]);
          heights.push(book ? book.offsetHeight : 0);
          maxW = Math.max(maxW, book ? book.offsetWidth : run[r].offsetWidth);
        }
        var stackH = 0;
        for (r = 0; r < heights.length; r += 1) {
          stackH += heights[r];
        }
        var standing = bookOf(run[0]) ? bookOf(run[0]).offsetWidth : stackH;
        var plankH = 0;
        var lastSpine = bookOf(run[run.length - 1]);
        if (lastSpine) {
          plankH = Math.max(
            0,
            run[run.length - 1].offsetHeight - lastSpine.offsetHeight
          );
        }
        for (r = 0; r < run.length; r += 1) {
          var slot = run[r];
          var spine = bookOf(slot);
          var below = r < run.length - 1 ? plankH : 0;
          for (var k = r + 1; k < heights.length; k += 1) {
            below += heights[k];
          }
          if (spine) {
            spine.style.position = "relative";
            spine.style.bottom = below + "px";
          }
          slot.style.zIndex = String(run.length - r);
          slot.style.setProperty("--plank-height", "0px");
          if (r === 0 && stackH > standing) {
            slot.style.paddingTop = stackH - standing + "px";
          }
          if (r > 0) {
            slot.style.marginLeft = -(run[r].offsetWidth + gap) + "px";
          }
        }
        var last = run[run.length - 1];
        last.style.removeProperty("--plank-height");
        var extra = Math.max(0, maxW - last.offsetWidth);
        if (extra > 0) {
          last.style.setProperty("--pack-left", extra / 2 + "px");
          last.style.setProperty("--pack-right", extra / 2 + "px");
        }
        i += run.length;
      }
    }

    function kissPair(left, right) {
      var base = parseFloat(right.style.marginLeft) || 0;
      var lo = base - 240;
      var hi = base + 240;
      var sameRow = function () {
        return Math.abs(slotBottom(left) - slotBottom(right)) < 2;
      };
      for (var step = 0; step < 16; step += 1) {
        var mid = (lo + hi) / 2;
        setPackLeft(right, mid);
        if (!sameRow() || pairGap(left, right) > KISS_GAP) {
          hi = mid;
        } else {
          lo = mid;
        }
      }
      setPackLeft(right, hi);
      if (!sameRow()) {
        setPackLeft(right, base);
      }
    }

    function flushLeanRuns(slots, gap, dir) {
      var i = 0;
      while (i < slots.length) {
        if (positionOf(slots[i]) !== dir) {
          i += 1;
          continue;
        }
        var run = takeRun(slots, i);
        if (run.length < 2) {
          i += 1;
          continue;
        }
        for (var r = 1; r < run.length; r += 1) {
          setPackLeft(run[r], -gap);
        }
        i += run.length;
      }
    }

    function pack(page) {
      var slots = slotList(page);
      var i;
      for (i = 0; i < slots.length; i += 1) {
        clearPackStyle(slots[i]);
      }

      var gap = columnGap(page);
      stackHorizontals(slots, gap);
      flushLeanRuns(slots, gap, "lean-left");
      flushLeanRuns(slots, gap, "lean-right");

      var rows = groupRows(slots);
      for (var r = 0; r < rows.length; r += 1) {
        var row = rows[r];
        if (!row.length) {
          continue;
        }
        if (positionOf(row[0]) === "lean-left") {
          setPackLeft(row[0], overhangPx(row[0]));
        }
        if (positionOf(row[row.length - 1]) === "lean-right") {
          var end = overhangPx(row[row.length - 1]);
          row[row.length - 1].style.marginRight = end + "px";
          row[row.length - 1].style.setProperty("--pack-right", end + "px");
        }
        for (var k = 0; k < row.length - 1; k += 1) {
          if (positionOf(row[k]) === "lean-right") {
            var over = overhangPx(row[k]);
            row[k].style.marginRight = over + "px";
            row[k].style.setProperty("--pack-right", over + "px");
          }
        }
        for (var j = 0; j < row.length - 1; j += 1) {
          if (shouldKiss(positionOf(row[j]), positionOf(row[j + 1]))) {
            kissPair(row[j], row[j + 1]);
          }
        }
      }

      page.style.justifyContent = pageWraps(page) ? "flex-start" : "center";
    }

    function packAll() {
      for (var i = 0; i < pages.length; i += 1) {
        pack(pages[i]);
        pack(pages[i]);
      }
    }

    function resetAll() {
      for (var i = 0; i < pages.length; i += 1) {
        resetPack(pages[i]);
      }
    }

    function fit() {
      applyScale(1);

      var widest = 0;
      for (var i = 0; i < pages.length; i += 1) {
        widest = Math.max(widest, pageContentWidth(pages[i]));
      }

      var scale = 1;
      if (widest > 0) {
        var styles = window.getComputedStyle(pages[0]);
        var pad =
          parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
        var available = Math.max(0, viewport.clientWidth - 2);
        var natural = widest + pad;
        if (natural > 0) {
          scale = available / natural;
          if (scale < 1) {
            scale = 1;
          }
          if (scale > SCALE_CAP) {
            scale = SCALE_CAP;
          }
        }
      }

      applyScale(scale);
    }

    function offsets() {
      var values = [0];
      var total = 0;
      for (var i = 0; i < pages.length - 1; i += 1) {
        total += pages[i].offsetHeight;
        values.push(total);
      }
      return values;
    }

    function render() {
      if (paged) {
        var tops = offsets();
        camera.style.transform = "translateY(-" + tops[index] + "px)";
        viewport.style.height = pages[index].offsetHeight + "px";
        if (prev) {
          prev.disabled = index === 0;
        }
        if (next) {
          next.disabled = index === pages.length - 1;
        }
        if (status) {
          status.textContent = index + 1 + " of " + pages.length;
        }
      }
    }

    function layout() {
      resetAll();
      fit();
      packAll();
      if (anyPageWraps()) {
        var current = parseFloat(shelf.style.getPropertyValue("--shelf-scale"));
        if (!isFinite(current) || current < 1) {
          current = 1;
        }
        if (current > 1) {
          var lo = 1;
          var hi = current;
          for (var step = 0; step < 14; step += 1) {
            var mid = (lo + hi) / 2;
            resetAll();
            applyScale(mid);
            packAll();
            if (anyPageWraps()) {
              hi = mid;
            } else {
              lo = mid;
            }
          }
          resetAll();
          applyScale(lo);
          packAll();
        }
      }
      render();
    }

    function go(delta) {
      var nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= pages.length) {
        return;
      }
      index = nextIndex;
      render();
    }

    if (reduce) {
      camera.style.transition = "none";
      viewport.style.transition = "none";
    }

    if (paged) {
      shelf.querySelectorAll("[data-shelf-dir]").forEach(function (button) {
        button.addEventListener("click", function () {
          go(parseInt(button.getAttribute("data-shelf-dir"), 10));
        });
      });
    }

    window.addEventListener("resize", layout);
    layout();
  }

  document.querySelectorAll(".shelf[data-shelf-pages]").forEach(setup);
})();
