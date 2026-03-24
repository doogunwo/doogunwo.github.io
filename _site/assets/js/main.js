document.addEventListener("DOMContentLoaded", () => {
  const cards = Array.from(document.querySelectorAll(".post-card[data-tags]"));
  const links = document.querySelectorAll("[data-tag-link]");

  if (!cards.length || !links.length) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const activeTag = (params.get("tag") || "").trim();

  const setActiveLink = (tag) => {
    links.forEach((link) => {
      const isActive = (tag || "all") === (link.dataset.tagLink || "");
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  const applyFilter = (tag) => {
    const normalized = (tag || "").trim();

    cards.forEach((card) => {
      const cardTags = (card.dataset.tags || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      const showAll = !normalized;
      const shouldShow = showAll || cardTags.includes(normalized);
      card.classList.toggle("is-hidden", !shouldShow);
    });

    setActiveLink(normalized);
  };

  applyFilter(activeTag);
});
