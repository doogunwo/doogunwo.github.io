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

  if (feed && cards.length && links.length && pagination) {
    const pageSize = Number(feed.dataset.pageSize || 5);

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

    const getState = () => {
      const params = new URLSearchParams(window.location.search);

      return {
        activeTag: (params.get("tag") || "").trim(),
        activePage: Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1),
      };
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
      const { activeTag, activePage } = getState();
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

    document.addEventListener("click", (event) => {
      const link = event.target.closest("[data-tag-link], .pagination__page[href], .pagination__arrow[href], .tag-pill[href]");
      if (!link) {
        return;
      }

      const url = new URL(link.href, window.location.origin);
      if (url.origin !== window.location.origin || url.pathname !== "/") {
        return;
      }

      event.preventDefault();
      window.history.pushState({}, "", `${url.pathname}${url.search}`);
      applyView();
    });

    window.addEventListener("popstate", applyView);
    window.addEventListener("pageshow", applyView);
    applyView();
  }

  const postContent = document.querySelector(".post-content--editor");
  const outline = document.querySelector("[data-post-outline]");
  const outlineNav = document.querySelector("[data-post-outline-nav]");

  if (postContent && outline && outlineNav) {
    const headings = Array.from(postContent.querySelectorAll("h3"));
    const slugCounts = new Map();

    const slugifyHeading = (text) => {
      const base = text
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "section";

      const count = slugCounts.get(base) || 0;
      slugCounts.set(base, count + 1);
      return count ? `${base}-${count + 1}` : base;
    };

    const validHeadings = headings.filter((heading) => heading.textContent.trim().length > 0);

    if (validHeadings.length) {
      const linksById = new Map();

      validHeadings.forEach((heading) => {
        if (!heading.id) {
          heading.id = slugifyHeading(heading.textContent);
        }

        const link = document.createElement("a");
        link.className = "post-outline__link";
        link.href = `#${heading.id}`;
        link.textContent = heading.textContent.trim();
        outlineNav.appendChild(link);
        linksById.set(heading.id, link);
      });

      outline.hidden = false;

      const setActiveOutlineLink = (id) => {
        linksById.forEach((link, key) => {
          const isActive = key === id;
          link.classList.toggle("is-active", isActive);
          if (isActive) {
            link.setAttribute("aria-current", "true");
          } else {
            link.removeAttribute("aria-current");
          }
        });
      };

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

          if (visible.length) {
            setActiveOutlineLink(visible[0].target.id);
          }
        },
        {
          rootMargin: "-20% 0px -65% 0px",
          threshold: [0, 1],
        }
      );

      validHeadings.forEach((heading) => observer.observe(heading));
      setActiveOutlineLink(validHeadings[0].id);
    }
  }
});
