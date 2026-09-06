(function () {
  var KEY = "avid-reader-style";
  var root = document.documentElement;

  function currentStyle() {
    return root.getAttribute("data-style") || "parchment";
  }

  function syncButtons(style) {
    document.querySelectorAll("[data-style-set]").forEach(function (button) {
      button.setAttribute("aria-pressed", button.getAttribute("data-style-set") === style ? "true" : "false");
    });
  }

  function setStyle(style) {
    if (style !== "castle" && style !== "parchment" && style !== "forest" && style !== "dog") {
      return;
    }
    root.setAttribute("data-style", style);
    try {
      localStorage.setItem(KEY, style);
    } catch (e) {}
    syncButtons(style);
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-style-set]");
    if (!button) {
      return;
    }
    setStyle(button.getAttribute("data-style-set"));
    var details = button.closest("details");
    if (details) {
      details.open = false;
    }
  });

  syncButtons(currentStyle());
})();
