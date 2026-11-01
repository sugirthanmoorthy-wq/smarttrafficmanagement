// Network UI is populated by app.js using live junction and road data.
window.NetworkView = window.NetworkView || {
  clearHighlight() {
    document.querySelectorAll(".route-highlight").forEach(el => el.classList.remove("route-highlight"));
  }
};
