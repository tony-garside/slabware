// slabware.js — the few things css can't do alone: tabs, menus that close,
// dialogs opened from markup, and toasts. optional; the css works without it.
(() => {
  function select(tab) {
    for (const t of tab.closest("[role=tablist]").querySelectorAll("[role=tab]")) {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute("aria-controls"));
      if (panel) panel.hidden = !on;
    }
  }

  function toast(text, { c = "yellow", ms = 3200 } = {}) {
    let shelf = document.querySelector(".toasts");
    if (!shelf) {
      shelf = Object.assign(document.createElement("div"), { className: "toasts" });
      shelf.setAttribute("role", "status");
      document.body.append(shelf);
    }
    const t = Object.assign(document.createElement("div"), { className: `toast c-${c}`, textContent: text });
    const dismiss = () => {
      t.classList.add("out");
      // with reduced motion there's no animation, so no animationend either
      if (getComputedStyle(t).animationName === "none") t.remove();
      else t.addEventListener("animationend", () => t.remove(), { once: true });
    };
    t.addEventListener("click", dismiss, { once: true });
    setTimeout(dismiss, ms);
    shelf.append(t);
    return t;
  }

  document.addEventListener("click", e => {
    const tab = e.target.closest("[role=tab]");
    if (tab) select(tab);

    // one menu open at a time; clicking elsewhere or picking an item closes it
    for (const m of document.querySelectorAll("details.menu[open]"))
      if (!m.contains(e.target) || e.target.closest(".menu-list > *")) m.open = false;

    // <button data-open="#id"> opens a dialog, data-close inside one shuts it
    const opener = e.target.closest("[data-open]");
    if (opener) document.querySelector(opener.dataset.open)?.showModal();
    if (e.target.closest("[data-close]")) e.target.closest("dialog")?.close();

    // and so does a click on the dithered backdrop
    if (e.target.matches("dialog[open]")) {
      const r = e.target.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close();
    }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") for (const m of document.querySelectorAll("details.menu[open]")) m.open = false;

    const tab = e.target.closest?.("[role=tab]");
    if (!tab || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    const tabs = [...tab.closest("[role=tablist]").querySelectorAll("[role=tab]")];
    const next = tabs[(tabs.indexOf(tab) + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    select(next);
    next.focus();
  });

  // start every tab set on whichever tab is marked selected, or the first
  const init = () => {
    for (const list of document.querySelectorAll("[role=tablist]")) {
      const tab = list.querySelector("[role=tab][aria-selected=true]") || list.querySelector("[role=tab]");
      if (tab) select(tab);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.slabware = { toast, select };
})();
