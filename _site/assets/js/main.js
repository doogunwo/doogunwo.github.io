document.addEventListener("DOMContentLoaded", () => {
  const fallbackSrc = document.body.dataset.thumbnailFallback || "/assets/images/default-thumbnail.svg";

  document.querySelectorAll("img").forEach((img) => {
    img.addEventListener("error", () => {
      if (img.dataset.fallbackApplied === "true" || img.src.endsWith(fallbackSrc)) {
        return;
      }
      img.dataset.fallbackApplied = "true";
      img.src = fallbackSrc;
    });
  });

  const feed = document.querySelector(".feed");
  const cards = Array.from(document.querySelectorAll(".post-card[data-tags]"));
  const links = document.querySelectorAll("[data-tag-link]");
  const pagination = document.querySelector("[data-pagination]");

  if (!feed || !cards.length || !links.length || !pagination) {
    return;
  }

  const pageSize = Number(feed.dataset.pageSize || 5);
  const params = new URLSearchParams(window.location.search);
  const activeTag = (params.get("tag") || "").trim();
  const activePage = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);

  const buildUrl = (tag, page) => {
    const query = new URLSearchParams();

    if (tag) {
      query.set("tag", tag);
    }

    if (page > 1) {
      query.set("page", String(page));
    }

    const queryString = query.toString();
    return queryString ? `/?${queryString}` : "/";
  };

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

  const renderPagination = (tag, currentPage, totalPages) => {
    if (totalPages <= 1) {
      pagination.innerHTML = "";
      pagination.hidden = true;
      return;
    }

    pagination.hidden = false;

    const prevDisabled = currentPage <= 1;
    const nextDisabled = currentPage >= totalPages;
    const buttons = [];

    buttons.push(
      prevDisabled
        ? '<span class="pagination__arrow is-disabled" aria-hidden="true">‹</span>'
        : `<a class="pagination__arrow" href="${buildUrl(tag, currentPage - 1)}" aria-label="이전 페이지">‹</a>`
    );

    for (let page = 1; page <= totalPages; page += 1) {
      buttons.push(
        page === currentPage
          ? `<span class="pagination__page is-active" aria-current="page">${page}</span>`
          : `<a class="pagination__page" href="${buildUrl(tag, page)}">${page}</a>`
      );
    }

    buttons.push(
      nextDisabled
        ? '<span class="pagination__arrow is-disabled" aria-hidden="true">›</span>'
        : `<a class="pagination__arrow" href="${buildUrl(tag, currentPage + 1)}" aria-label="다음 페이지">›</a>`
    );

    pagination.innerHTML = buttons.join("");
  };

  const applyView = () => {
    const normalized = activeTag;
    const filteredCards = cards.filter((card) => {
      const cardTags = (card.dataset.tags || "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      return !normalized || cardTags.includes(normalized);
    });

    const totalPages = Math.max(1, Math.ceil(filteredCards.length / pageSize));
    const currentPage = Math.min(activePage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const visibleCards = new Set(filteredCards.slice(start, end));

    cards.forEach((card) => {
      card.classList.toggle("is-hidden", !visibleCards.has(card));
    });

    setActiveLink(normalized);
    renderPagination(normalized, currentPage, totalPages);
  };

  applyView();
});
