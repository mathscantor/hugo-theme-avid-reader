(function () {
  var mount = document.querySelector("#search");
  if (!mount || typeof document === "undefined") {
    return;
  }

  var base = mount.getAttribute("data-pagefind-base") || "/";
  if (base.charAt(base.length - 1) !== "/") {
    base += "/";
  }

  var script = document.createElement("script");
  script.src = base + "pagefind/pagefind-ui.js";
  script.async = true;
  script.onload = function () {
    if (typeof PagefindUI !== "function") {
      return;
    }
    new PagefindUI({
      element: "#search",
      baseUrl: base,
      bundlePath: base + "pagefind/",
      showImages: false,
      showSubResults: false,
      resetStyles: true,
    });
  };
  script.onerror = function () {};
  document.head.appendChild(script);
})();
