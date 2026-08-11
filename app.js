(async function () {
  const STORAGE_KEY = "books-of-the-year-admin-v1";
  const fallbackSeedData = window.BOOKLIST_DATA || { year: new Date().getFullYear() };
  const root = document.getElementById("page-root");
  const params = new URLSearchParams(window.location.search);
  const cleanBookRoute = window.location.pathname.match(/^\/(\d{4})\/([^/]+)\/?$/);
  if (cleanBookRoute) {
    params.set("year", cleanBookRoute[1]);
    params.set("slug", decodeURIComponent(cleanBookRoute[2]));
  }
  const page = document.body.dataset.page || "home";

  if (!root) {
    return;
  }

  const initialDataResult = await loadInitialData(fallbackSeedData);
  const data = initialDataResult.data;

  window.BOOKLIST_RUNTIME = {
    dataSource: initialDataResult.source,
    fallbackReason: initialDataResult.reason || null,
    year: data.year
  };
  document.body.dataset.dataSource = initialDataResult.source;

  const taxonomyById = Object.fromEntries(data.taxonomy.map((genre) => [genre.id, genre]));
  const booksById = Object.fromEntries(data.books.map((book) => [book.id, book]));
  const listsById = Object.fromEntries(data.lists.map((list) => [list.id, list]));
  const sourcesById = Object.fromEntries(data.sources.map((source) => [source.id, source]));
  const derived = buildDerivedData();

  setupGlobalChrome();
  syncNavigationYear();
  bindInteractiveCards();
  bindHeaderScrollState();

  if (page === "home") {
    renderHome();
  } else if (page === "books") {
    renderBooksIndex();
  } else if (page === "awards") {
    renderAwardsIndex();
  } else if (page === "lists") {
    renderListsIndex();
  } else if (page === "genres") {
    renderGenresIndex();
  } else if (page === "book") {
    renderBook();
  } else if (page === "list") {
    renderList();
  } else if (page === "search") {
    renderSearch();
  } else if (page === "admin") {
    renderAdmin();
  }

  async function loadInitialData(seedData) {
    if (!window.BOOKLIST_DATA_ACCESS || typeof window.BOOKLIST_DATA_ACCESS.loadAppData !== "function") {
      return {
        data: seedData,
        source: "local"
      };
    }

    return window.BOOKLIST_DATA_ACCESS.loadAppData({
      seedData,
      requestedYear: Number(params.get("year")) || null
    });
  }

  function buildDerivedData() {
    const entriesByBook = new Map();
    const entriesByList = new Map();
    const awardsByBook = new Map();

    data.entries.forEach((entry) => {
      const list = listsById[entry.listId];
      const book = booksById[entry.bookId];
      if (!list || !book) {
        return;
      }

      const score = list.ranked && entry.position ? Math.max(1, 26 - entry.position) : 10;
      const enriched = {
        ...entry,
        score,
        list,
        source: sourcesById[list.sourceId] || { id: list.sourceId, name: "Unknown source", type: "", note: "", url: "#" },
        book
      };

      if (!entriesByBook.has(book.id)) {
        entriesByBook.set(book.id, []);
      }
      entriesByBook.get(book.id).push(enriched);

      if (!entriesByList.has(list.id)) {
        entriesByList.set(list.id, []);
      }
      entriesByList.get(list.id).push(enriched);
    });

    (data.awards || []).forEach((recognition) => {
      const book = booksById[recognition.bookId];
      if (!book) {
        return;
      }

      const enriched = {
        ...recognition,
        source: sourcesById[recognition.award?.sourceId] || null,
        book
      };

      if (!awardsByBook.has(book.id)) {
        awardsByBook.set(book.id, []);
      }

      awardsByBook.get(book.id).push(enriched);
    });

    const bookRanks = data.books
      .map((book) => {
        const appearances = (entriesByBook.get(book.id) || []).slice();
        const scoringAppearances = appearances.filter((item) => item.list.countsTowardScore);
        const aggregateScore = scoringAppearances.reduce((sum, item) => sum + item.score, 0);
        const listCount = scoringAppearances.length;
        return {
          book,
          appearances,
          scoringAppearances,
          aggregateScore,
          listCount
        };
      })
      .sort((left, right) => {
        if (right.aggregateScore !== left.aggregateScore) {
          return right.aggregateScore - left.aggregateScore;
        }
        return right.listCount - left.listCount;
      })
      .map((item, index) => ({ ...item, rank: index + 1 }));

    const bookRanksById = Object.fromEntries(bookRanks.map((item) => [item.book.id, item]));

    const listStats = data.lists
      .map((list) => {
        const entries = (entriesByList.get(list.id) || []).slice();
        return {
          list,
          source: sourcesById[list.sourceId] || { id: list.sourceId, name: "Unknown source", type: "", note: "", url: "#" },
          entries,
          entryCount: entries.length
        };
      })
      .sort((left, right) => right.list.followers - left.list.followers);

    const genreStats = data.taxonomy
      .map((genre) => {
        const books = bookRanks.filter((item) => item.book.genres.includes(genre.id));
        return {
          genre,
          count: books.length
        };
      })
      .sort((left, right) => right.count - left.count);

    return {
      entriesByBook,
      entriesByList,
      awardsByBook,
      bookRanks,
      bookRanksById,
      listStats,
      genreStats
    };
  }

  function setupGlobalChrome() {
    const header = document.querySelector(".site-header");
    const footer = document.querySelector(".site-footer");
    const navItems = [
      ["index.html", "Home", "home"],
      ["genres.html", "Genres", "genres"],
      ["lists.html", "Lists", "lists"],
      ["awards.html", "Awards", "awards"]
    ];

    if (header) {
      header.innerHTML = `
        <div class="topbar">
          <a class="brand" href="${buildPageHref("index.html")}" aria-label="Books of the Year home">
            <span class="brand-copy"><span class="brand-name">Best Books of the Year</span></span>
          </a>
          <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">Menu</button>
          <nav class="site-nav" id="primary-navigation" aria-label="Primary">
            ${navItems.map(([href, label, key]) => `<a href="${buildPageHref(href)}" ${page === key ? 'aria-current="page"' : ""}>${label}</a>`).join("")}
          </nav>
          <div class="utility-nav">
            <button class="search-toggle" type="button" aria-label="Search" aria-expanded="false" aria-controls="header-search">
              <span class="search-label">Search</span>
              <svg class="search-icon" aria-hidden="true" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.4-3.4"></path></svg>
            </button>
          </div>
        </div>
        <div class="header-search" id="header-search" hidden>
          <form action="${buildPageHref("search.html", { q: null })}" method="get">
            <label class="sr-only" for="header-search-input">Search books, authors, lists, and genres</label>
            <input id="header-search-input" name="q" type="search" placeholder="Search books, authors, lists, and genres…" autocomplete="off" />
            <button type="submit">Search</button>
            <button class="search-close" type="button" aria-label="Close search">Close</button>
          </form>
        </div>`;

      const menuButton = header.querySelector(".menu-toggle");
      const searchButton = header.querySelector(".search-toggle");
      const searchPanel = header.querySelector(".header-search");
      const searchInput = header.querySelector("#header-search-input");
      const closeSearch = () => {
        searchPanel.hidden = true;
        searchButton.setAttribute("aria-expanded", "false");
      };

      menuButton.addEventListener("click", () => {
        const isOpen = menuButton.getAttribute("aria-expanded") === "true";
        menuButton.setAttribute("aria-expanded", String(!isOpen));
      });
      searchButton.addEventListener("click", () => {
        const isOpen = !searchPanel.hidden;
        searchPanel.hidden = isOpen;
        searchButton.setAttribute("aria-expanded", String(!isOpen));
        if (!isOpen) searchInput.focus();
      });
      header.querySelector(".search-close").addEventListener("click", closeSearch);
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !searchPanel.hidden) {
          closeSearch();
          searchButton.focus();
        }
      });
    }

    if (footer) {
      const genreLinks = derived.genreStats.slice(0, 5);
      const listLinks = derived.listStats.filter((item) => item.list.kind !== "Award").slice(0, 4);
      const awardLinks = getSortedAwardLists("latest").slice(0, 4);
      footer.innerHTML = `
        <div class="footer-grid">
          <section><p class="footer-label">Genres</p>${genreLinks.map((item) => `<a href="${buildGenresHref(item.genre.id)}">${item.genre.name}</a>`).join("")}</section>
          <section><p class="footer-label">Lists</p>${listLinks.map((item) => `<a href="${buildListHref(item.list.id)}">${item.source.name}</a>`).join("")}</section>
          <section><p class="footer-label">Awards</p>${awardLinks.map((item) => `<a href="${buildListHref(item.list.id)}">${item.list.title}</a>`).join("")}</section>
          <section><p class="footer-label">About</p><a href="${buildPageHref("books.html")}">The ${data.year} index</a><a href="${buildPageHref("search.html")}">Search the index</a><span>Equal-weight aggregation</span></section>
        </div>
        <div class="footer-brand"><span class="footer-mark">B</span><div><strong>Best Books of the Year</strong><p>An annual index of the books that appear across the lists, prizes, and publications that shape the year in reading.</p></div></div>`;
    }
  }

  function renderHome() {
    const activeGenre = params.get("genre") || "all";
    const books = getFilteredBooks(activeGenre);

    root.innerHTML = `
      <section class="masthead masthead--single editorial-masthead" id="best-of">
        <div class="masthead-main">
          <p class="eyebrow">Annual edition · ${data.year} · The aggregate index</p>
          <h1 class="display-title">The Year<br>in Books</h1>
          <p class="lead">
            Critical consensus drawn from ${data.lists.length} of the year's most authoritative reading lists,
            award longlists, and literary sources.
          </p>
        </div>
      </section>

      <section class="section panel section--full editorial-ranking" id="books">
        <div class="section-heading">
          <h2 class="eyebrow">Most-listed books of ${data.year}</h2>
          <a class="text-link" href="${buildBooksHref(activeGenre === "all" ? "" : activeGenre)}">View all →</a>
        </div>
        <ol class="editorial-book-rail">${books.slice(0, 10).map((item) => renderRankingRow(item)).join("")}</ol>
      </section>

      <section class="editor-note-section" aria-labelledby="editor-note-title">
        <div class="editor-note-heading">
          <p class="eyebrow">A note from the editor</p>
          <h2 id="editor-note-title">Why we read<br>the lists</h2>
        </div>
        <div class="editor-note-body">
          <p class="editor-note-lead">Every December, the same thing happens. The Times publishes its ten best. NPR releases its hundred. The Guardian gathers its critics. Each list is a genuine act of discernment, and each one, taken alone, tells an incomplete story.</p>
          <p>The aggregated view surfaces a different kind of signal: one that emerges from the overlap, the consensus, and the places where careful readers arrive at the same title from different directions.</p>
          <p>We track ${data.lists.length} lists, award bodies, and literary sources. We weight nothing. We hide nothing. We simply count, and let the count speak.</p>
          <div class="editor-note-signature">
            <strong>Best Books of the Year</strong>
            <span>Editorial team</span>
          </div>
        </div>
      </section>
    `;
  }

  function renderBooksIndex() {
    const activeGenre = params.get("genre") || "all";
    const books = getFilteredBooks(activeGenre);
    const activeGenreLabel = activeGenre === "all" ? "All genres" : taxonomyById[activeGenre]?.name || "Genre";

    root.innerHTML = `
      <section class="page-header panel">
        <div class="page-header-main">
          <p class="eyebrow">Books</p>
          <h1 class="detail-title">${data.year} aggregate book index</h1>
          <p class="summary">
            Browse the full ranking of books that show up across editorial lists, awards, and longlists, with every source
            carrying the same weight.
          </p>
          <div class="meta-strip meta-strip--dense">
            <span>${books.length} books shown</span>
            <span>${activeGenreLabel}</span>
            <span>${data.lists.length} tracked sources</span>
          </div>
        </div>
        <div class="page-header-side">
          <div class="score-panel">
            <span class="score-label">View</span>
            <strong>${books.length}</strong>
            <span>books in this slice</span>
          </div>
        </div>
      </section>

      <section class="section panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Browse</p>
            <h2 class="section-title">Books</h2>
          </div>
        </div>
        <div class="filter-block">
          <div class="pill-row">${renderGenrePills(activeGenre)}</div>
        </div>
        ${
          books.length
            ? `<ol class="ranking-list">${books.map((item) => renderRankingRow(item)).join("")}</ol>`
            : `<div class="empty-state panel-subtle"><p>No books match this filter yet.</p></div>`
        }
      </section>
    `;
  }

  function renderListsIndex() {
    const sortKey = params.get("sort") || "latest";
    const lists = getSortedLists(sortKey);

    root.innerHTML = `
      <section class="page-header panel">
        <div class="page-header-main">
          <p class="eyebrow">Lists</p>
          <h1 class="detail-title">Source lists and award sets</h1>
          <p class="summary">
            Move through the complete source index, from magazine year-end roundups to awards and longlists, with direct
            paths into every title on each list.
          </p>
          <div class="meta-strip meta-strip--dense">
            <span>${lists.length} tracked lists</span>
            <span>Best Of, awards, and longlists</span>
            <span>Updated through ${data.year}</span>
          </div>
        </div>
        <div class="page-header-side">
          <div class="score-panel">
            <span class="score-label">Coverage</span>
            <strong>${lists.length}</strong>
            <span>source lists tracked</span>
          </div>
        </div>
      </section>

      <section class="section panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Browse</p>
            <h2 class="section-title">All lists</h2>
          </div>
          <div class="toolbar">
            ${renderListsIndexSortTabs(sortKey)}
          </div>
        </div>
        <div class="stack-list">
          ${lists.map((item) => renderPopularListRow(item)).join("")}
        </div>
      </section>
    `;
  }

  function renderAwardsIndex() {
    const sortKey = params.get("sort") || "latest";
    const awards = getSortedAwardLists(sortKey);

    root.innerHTML = `
      <section class="page-header panel">
        <div class="page-header-main">
          <p class="eyebrow">Awards</p>
          <h1 class="detail-title">Award lists and longlists</h1>
          <p class="summary">
            Browse the prizes, shortlists, winners, and longlists that feed the yearly book index, separated from the broader editorial list archive.
          </p>
          <div class="meta-strip meta-strip--dense">
            <span>${awards.length} award-related lists</span>
            <span>Longlists, winners, and prize sets</span>
            <span>Updated through ${data.year}</span>
          </div>
        </div>
        <div class="page-header-side">
          <div class="score-panel">
            <span class="score-label">Coverage</span>
            <strong>${awards.length}</strong>
            <span>award lists tracked</span>
          </div>
        </div>
      </section>

      <section class="section panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Browse</p>
            <h2 class="section-title">All awards</h2>
          </div>
          <div class="toolbar">
            ${renderAwardsIndexSortTabs(sortKey)}
          </div>
        </div>
        <div class="stack-list">
          ${awards.map((item) => renderPopularListRow(item)).join("")}
        </div>
      </section>
    `;
  }

  function renderGenresIndex() {
    const fallbackGenre = derived.genreStats[0]?.genre.id || "all";
    const activeGenre = params.get("genre") || fallbackGenre;
    const selectedGenre = derived.genreStats.find((item) => item.genre.id === activeGenre) || derived.genreStats[0];
    const books = selectedGenre ? getFilteredBooks(selectedGenre.genre.id) : getFilteredBooks("all");

    root.innerHTML = `
      <section class="page-header panel">
        <div class="page-header-main">
          <p class="eyebrow">Genres</p>
          <h1 class="detail-title">Browse the taxonomy</h1>
          <p class="summary">
            Use the normalized genre set to jump into fiction, nonfiction, essays, memoir, and the rest of the ${data.year} field.
          </p>
          <div class="meta-strip meta-strip--dense">
            <span>${derived.genreStats.length} tracked genres</span>
            <span>${selectedGenre ? selectedGenre.genre.name : "All books"}</span>
            <span>${books.length} books in view</span>
          </div>
        </div>
        <div class="page-header-side">
          <div class="score-panel">
            <span class="score-label">Selected</span>
            <strong>${selectedGenre ? selectedGenre.count : books.length}</strong>
            <span>${selectedGenre ? `${selectedGenre.genre.name.toLowerCase()} titles` : "books in view"}</span>
          </div>
        </div>
      </section>

      <section class="section panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Browse</p>
            <h2 class="section-title">Genres</h2>
          </div>
        </div>
        <div class="genre-grid">
          ${derived.genreStats.map((item) => renderGenreCard(item, activeGenre)).join("")}
        </div>
      </section>

      <section class="section panel">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Selection</p>
            <h2 class="section-title">${selectedGenre ? selectedGenre.genre.name : "Books"}</h2>
          </div>
        </div>
        ${
          books.length
            ? `<ol class="ranking-list">${books.map((item) => renderRankingRow(item)).join("")}</ol>`
            : `<div class="empty-state panel-subtle"><p>No books are assigned to this genre yet.</p></div>`
        }
      </section>
    `;
  }

  function renderBook() {
    const slug = params.get("slug");
    const ranking = derived.bookRanks.find((item) => item.book.slug === slug) || derived.bookRanks[0];
    if (!ranking) {
      root.innerHTML = `<section class="panel"><p class="summary">No book data is available for this view yet.</p></section>`;
      return;
    }

    const book = ranking.book;
    const appearances = ranking.appearances.slice().sort((left, right) => left.list.title.localeCompare(right.list.title));
    const awardRecognitions = (derived.awardsByBook.get(book.id) || [])
      .slice()
      .sort((left, right) => left.award.name.localeCompare(right.award.name));
    const genreRankings = getGenreRankings(book);
    const related = derived.bookRanks
      .filter((item) => item.book.id !== book.id && item.book.genres.some((genre) => book.genres.includes(genre)))
      .slice(0, 4);

    root.innerHTML = `
      <section class="book-hero panel">
        <div class="book-hero-grid">
          <div class="book-hero-cover">
            ${renderCover(book, "cover-xl")}
          </div>
          <div class="book-hero-main">
            <p class="eyebrow">Book page</p>
            <h1 class="detail-title">${book.title}</h1>
            <p class="byline byline-lg">by ${book.author}</p>
            <div class="pill-row">
              ${book.genres.map((genreId) => renderTag(taxonomyById[genreId].name)).join("")}
            </div>
            <p class="summary">${book.blurb}</p>
            <div class="button-row">
              <a class="button" href="${buildBuyLink(book)}" target="_blank" rel="noreferrer">Buy this book</a>
            </div>
            <div class="meta-strip meta-strip--dense">
              <span>${formatMonth(book.published)}</span>
              <span>${book.publisher}</span>
              <span>${book.format}</span>
              <span>${book.pages ? `${book.pages} pages` : "Page count TBD"}</span>
            </div>
          </div>
          <aside class="book-hero-side">
            <div class="score-stack">
              <div class="score-panel">
                <span class="score-label">List appearances</span>
                <strong>${ranking.listCount}</strong>
                <span>${ranking.listCount === 1 ? "Included on 1 list" : `Included on ${ranking.listCount} lists`}</span>
              </div>
              <div class="score-panel">
                <span class="score-label">Aggregate rank</span>
                <strong>#${ranking.rank}</strong>
                <span>Across the full ${data.year} index</span>
              </div>
              <div class="score-panel">
                <span class="score-label">Genre rank</span>
                <strong>${genreRankings[0] ? `#${genreRankings[0].rank} in ${genreRankings[0].name}` : "Unranked"}</strong>
                <div class="score-detail-list">
                  ${genreRankings
                    .slice(1)
                    .map((genreRanking) => `<span>#${genreRanking.rank} in ${escapeHtml(genreRanking.name)}</span>`)
                    .join("")}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="detail-grid">
        <div class="detail-main">
          <section class="section panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Recognition</p>
                <h2 class="section-title">Lists and awards</h2>
              </div>
            </div>
            <div class="appearance-list">
              ${appearances.map((appearance) => renderAppearanceCard(appearance)).join("")}
              ${awardRecognitions.map((recognition) => renderAwardCard(recognition)).join("")}
            </div>
          </section>
        </div>

        <aside class="detail-side">
          <section class="section panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">At a glance</p>
                <h2 class="section-title">Key data</h2>
              </div>
            </div>
            <dl class="data-list">
              <div><dt>Aggregate rank</dt><dd>#${ranking.rank}</dd></div>
              <div><dt>List appearances</dt><dd>${ranking.listCount}</dd></div>
              <div><dt>Published</dt><dd>${formatDate(book.published)}</dd></div>
              <div><dt>Publisher</dt><dd>${book.publisher}</dd></div>
              <div><dt>Format</dt><dd>${book.format}</dd></div>
              <div><dt>Pages</dt><dd>${book.pages || "TBD"}</dd></div>
            </dl>
          </section>

          <section class="section panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Next clicks</p>
                <h2 class="section-title">Related books</h2>
              </div>
            </div>
            <div class="stack-list">
              ${related.map((item, index) => renderSidebarBookRow(item, index + 1, "related")).join("")}
            </div>
          </section>
        </aside>
      </section>
    `;
  }

  function renderList() {
    const id = params.get("id");
    const sortKey = params.get("sort") || "original";
    const stat = derived.listStats.find((item) => item.list.id === id) || derived.listStats[0];
    if (!stat) {
      root.innerHTML = `<section class="panel"><p class="summary">No list data is available for this view yet.</p></section>`;
      return;
    }

    const entries = getSortedListEntries(stat.entries, sortKey);
    const similarLists = derived.listStats
      .filter((item) => item.list.id !== stat.list.id && item.list.scope === stat.list.scope)
      .slice(0, 3);

    root.innerHTML = `
      <section class="page-header panel">
        <div class="page-header-main">
          <p class="eyebrow">${stat.source.name}</p>
          <h1 class="detail-title">${stat.list.title}</h1>
          <p class="summary">${stat.list.description}</p>
          <div class="meta-strip meta-strip--dense">
            <span>${stat.list.kind}</span>
            <span>${stat.list.scope}</span>
            <span>${stat.entryCount} books</span>
            <span>Updated ${formatDate(stat.list.updatedAt)}</span>
          </div>
        </div>
        <div class="page-header-side">
          <div class="score-panel">
            <span class="score-label">Followers</span>
            <strong>${formatNumber(stat.list.followers)}</strong>
            <span>Equal source weight</span>
          </div>
        </div>
      </section>

      <section class="detail-grid">
        <div class="detail-main">
          <section class="section panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">List view</p>
                <h2 class="section-title">Entries</h2>
              </div>
              <div class="toolbar">
                ${renderListSortTabs(stat.list.id, sortKey)}
              </div>
            </div>
            <div class="list-stream">
              ${entries.map((entry, index) => renderListEntry(entry, index + 1)).join("")}
            </div>
          </section>
        </div>

        <aside class="detail-side">
          <section class="section panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Source</p>
                <h2 class="section-title">Context</h2>
              </div>
            </div>
            <p class="summary summary--small">${stat.source.note}</p>
            <div class="pill-row">
              ${renderTag(stat.list.ranked ? "Ranked" : "Unranked")}
              ${renderTag(stat.list.kind)}
              ${renderTag(stat.list.scope)}
            </div>
            <a class="text-link" href="${stat.list.url === "#" ? buildPageHref("lists.html") : stat.list.url}">Open source link</a>
          </section>

          <section class="section panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">More lists</p>
                <h2 class="section-title">Keep browsing</h2>
              </div>
            </div>
            <div class="stack-list">
              ${similarLists.map((item) => renderPopularListRow(item, true)).join("")}
            </div>
          </section>
        </aside>
      </section>
    `;
  }

  function renderSearch() {
    const query = (params.get("q") || "").trim();
    const results = query ? searchEverything(query) : [];
    const suggestions = derived.bookRanks.slice(0, 3);
    const genres = derived.genreStats.slice(0, 4);
    const lists = derived.listStats.slice(0, 3);

    root.innerHTML = `
      <section class="search-grid">
        <section class="panel">
          <p class="eyebrow">Search</p>
          <h1 class="search-title">Find titles, authors, lists, genres, and sources.</h1>
          <form class="search-form search-form--inline" action="${buildPageHref("search.html", { q: null })}" method="get">
            <label class="field search-field">
              <span class="sr-only">Query</span>
              <input class="input" name="q" type="search" value="${escapeHtml(query)}" placeholder="Northlight, Booker, memoir, Mira Dane..." />
            </label>
            <button class="button" type="submit">Search the index</button>
          </form>
          <div class="helper-box">
            <p class="helper-text">Quick starts</p>
            <div class="pill-row">
              <a class="pill" href="${buildSearchHref("fiction")}">Fiction</a>
              <a class="pill" href="${buildSearchHref("Booker")}">Booker</a>
              <a class="pill" href="${buildSearchHref("New Yorker")}">New Yorker</a>
              <a class="pill" href="${buildSearchHref("essays")}">Essays</a>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Results</p>
              <h2 class="section-title">${query ? `Results for “${escapeHtml(query)}”` : "Discovery suggestions"}</h2>
              <p class="section-note">${query ? `${results.length} matches across books, lists, genres, and sources.` : "Search is empty, so the page is surfacing a few useful entry points."}</p>
            </div>
          </div>
          ${
            query
              ? results.length
                ? `<div class="card-grid">${results.map((result) => renderSearchResult(result)).join("")}</div>`
                : `<div class="empty-state panel-subtle"><p>No matches yet. Try a title, source, award, or genre term.</p></div>`
              : `
                <div class="search-discovery">
                  <section class="section">
                    <h3 class="subsection-title">Top books</h3>
                    <div class="stack-list">
                      ${suggestions.map((item, index) => renderSidebarBookRow(item, index + 1)).join("")}
                    </div>
                  </section>
                  <section class="section">
                    <h3 class="subsection-title">Genres</h3>
                    <div class="genre-grid genre-grid--compact">
                      ${genres.map((item) => renderGenreCard(item)).join("")}
                    </div>
                  </section>
                  <section class="section">
                    <h3 class="subsection-title">Latest lists</h3>
                    <div class="stack-list">
                      ${lists.map((item) => renderPopularListRow(item, true)).join("")}
                    </div>
                  </section>
                </div>
              `
          }
        </section>
      </section>
    `;
  }

  function renderAdmin() {
    const localLists = adminStore.lists
      .slice()
      .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
    const localBookCount = adminStore.books.length + Object.keys(adminStore.bookPatches || {}).length;
    const defaultMode = params.get("mode") === "award" ? "award" : "list";

    root.innerHTML = `
      <section class="page-header panel">
        <div class="page-header-main">
          <p class="eyebrow">Admin</p>
          <h1 class="detail-title">Import lists and awards into the local dataset.</h1>
          <p class="summary">
            The importer parses pasted source text into candidate books, lets you review every row, and saves accepted
            entries into the browser-backed prototype dataset.
          </p>
        </div>
        <div class="page-header-side">
          <div class="score-panel">
            <span class="score-label">Local library</span>
            <strong>${localLists.length}</strong>
            <span>${localBookCount} locally managed books</span>
          </div>
        </div>
      </section>

      <section class="admin-grid">
        <div class="panel">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Importer</p>
              <h2 class="section-title">Build review draft</h2>
            </div>
          </div>
          <form id="admin-import-form" class="admin-form">
            <input name="year" type="hidden" value="${data.year}" />
            <input name="importMode" type="hidden" value="${defaultMode}" />
            <div class="admin-mode-tabs" role="tablist" aria-label="Import type">
              <button class="chip ${defaultMode === "list" ? "is-active" : ""}" type="button" data-action="mode-tab" data-mode="list">Lists</button>
              <button class="chip ${defaultMode === "award" ? "is-active" : ""}" type="button" data-action="mode-tab" data-mode="award">Awards</button>
            </div>
            <section class="admin-mode-panel ${defaultMode === "list" ? "" : "is-hidden"}" data-import-panel="list">
              <label class="field">
                <span>URL</span>
                <input class="input" name="listUrl" type="url" placeholder="https://brooklinebooksmith.com/list/new-yorker-best-books-2025" />
              </label>
              <label class="field">
                <span>Name of the list</span>
                <input class="input" name="listName" type="text" placeholder="The New Yorker Best Books of ${data.year}" />
              </label>
              <label class="field">
                <span>List text</span>
                <textarea class="textarea" name="listText" placeholder="Northlight — Mira Dane — Literary Fiction&#10;Salt Atlas by Priya Narang (Essays & Culture)"></textarea>
              </label>
            </section>
            <section class="admin-mode-panel ${defaultMode === "award" ? "" : "is-hidden"}" data-import-panel="award">
              <label class="field">
                <span>URL</span>
                <input class="input" name="awardUrl" type="url" placeholder="https://example.com/booker-prize-2025" />
              </label>
              <label class="field">
                <span>Award name</span>
                <input class="input" name="awardName" type="text" placeholder="Booker Prize ${data.year}" />
              </label>
              <label class="field">
                <span>Longlist</span>
                <textarea class="textarea textarea--compact" name="awardLonglist" placeholder="Northlight — Mira Dane&#10;Lanterns in Winter — Owen Mercer"></textarea>
              </label>
              <label class="field">
                <span>Shortlist</span>
                <textarea class="textarea textarea--compact" name="awardShortlist" placeholder="Northlight — Mira Dane"></textarea>
              </label>
              <label class="field">
                <span>Winner</span>
                <textarea class="textarea textarea--compact" name="awardWinner" placeholder="Northlight — Mira Dane"></textarea>
              </label>
            </section>
            <div class="button-row">
              <button class="button" type="submit">Generate review rows</button>
              <button class="ghost-button" type="button" id="load-example-import">Load example URL</button>
            </div>
          </form>
          <div class="section admin-review-section">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Review</p>
                <h2 class="section-title">Accepted and rejected rows</h2>
              </div>
            </div>
            <div id="admin-preview" class="preview-box">
              <p class="helper-text">Paste a list or award set, then review the parsed rows before saving accepted books into the local dataset.</p>
            </div>
          </div>
        </div>

        <aside class="admin-side">
          <section class="panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Local library</p>
                <h2 class="section-title">Saved imports</h2>
              </div>
            </div>
            ${renderAdminLibrary(localLists)}
          </section>

          <section class="panel">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Parsing</p>
                <h2 class="section-title">How the importer reads text</h2>
              </div>
            </div>
            <div class="stack-list">
              <div class="mini-step"><strong>1.</strong><span>It reads one-line entries with separators like em dashes and “by,” and it can also pair multi-line review blurbs where a title is followed by an author/publisher line.</span></div>
              <div class="mini-step"><strong>2.</strong><span>It tries to infer genre from the text itself or from a matched canonical book already in the dataset.</span></div>
              <div class="mini-step"><strong>3.</strong><span>You can still edit, accept, or reject every row before anything is saved.</span></div>
            </div>
          </section>
        </aside>
      </section>
    `;

    const form = document.getElementById("admin-import-form");
    const preview = document.getElementById("admin-preview");
    const exampleButton = document.getElementById("load-example-import");
    const modeInput = form.elements.importMode;
    const modePanels = Array.from(form.querySelectorAll("[data-import-panel]"));
    const modeTabs = Array.from(form.querySelectorAll('[data-action="mode-tab"]'));
    let currentDraft = null;

    const paintPreview = () => {
      preview.innerHTML = currentDraft
        ? renderImportPreview(currentDraft)
        : `<p class="helper-text">Paste a list or award set, then review the parsed rows before saving accepted books into the local dataset.</p>`;
    };

    const syncMode = (mode) => {
      modeInput.value = mode;
      modePanels.forEach((panel) => {
        panel.classList.toggle("is-hidden", panel.dataset.importPanel !== mode);
      });
      modeTabs.forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.mode === mode);
      });
    };

    syncMode(defaultMode);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      currentDraft = buildImportDraft(formData);
      paintPreview();
    });

    exampleButton.addEventListener("click", () => {
      const mode = modeInput.value;
      if (mode === "award") {
        form.elements.awardUrl.value = `https://example.com/booker-prize-${data.year}`;
        form.elements.awardName.value = `Booker Prize ${data.year}`;
        form.elements.awardLonglist.value = "Northlight — Mira Dane\nLanterns in Winter — Owen Mercer\nHouse of Small Reckonings — Claire Raines";
        form.elements.awardShortlist.value = "Northlight — Mira Dane\nHouse of Small Reckonings — Claire Raines";
        form.elements.awardWinner.value = "Northlight — Mira Dane";
      } else {
        form.elements.listUrl.value = `https://brooklinebooksmith.com/list/new-yorker-best-books-${data.year}`;
        form.elements.listName.value = `The New Yorker Best Books of ${data.year}`;
        form.elements.listText.value = "Northlight — Mira Dane — Literary Fiction\nSalt Atlas by Priya Narang (Essays & Culture)\nLanterns in Winter — Owen Mercer — Historical Fiction";
      }
      currentDraft = buildImportDraft(new FormData(form));
      paintPreview();
    });

    form.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) {
        return;
      }

      if (action.dataset.action === "mode-tab") {
        if (modeInput.value !== action.dataset.mode) {
          syncMode(action.dataset.mode);
          currentDraft = null;
          paintPreview();
        }
      }
    });

    preview.addEventListener("input", (event) => {
      if (!currentDraft) {
        return;
      }

      const target = event.target;
      const metaField = target.dataset.metaField;
      const entryIndex = target.dataset.entryIndex;
      const field = target.dataset.field;

      if (metaField) {
        currentDraft[metaField] = target.value;
        return;
      }

      if (entryIndex !== undefined && field) {
        const entry = currentDraft.entries[Number(entryIndex)];
        if (!entry) {
          return;
        }
        entry[field] = coerceDraftValue(field, target.value);
        if (field === "stageKey") {
          entry.label = getStageLabel(entry.stageKey);
        }
        if (field === "title" || field === "author") {
          const matched = findDraftMatch(entry.title, entry.author);
          if (matched) {
            entry.matchedId = matched.id;
            if (!entry.genreId) {
              entry.genreId = matched.genres?.[0] || "";
            }
          } else {
            entry.matchedId = "";
          }
        }
      }
    });

    preview.addEventListener("change", async (event) => {
      if (!currentDraft) {
        return;
      }

      const target = event.target;
      const entryIndex = target.dataset.entryIndex;
      const field = target.dataset.field;
      const fileField = target.dataset.fileField;

      if (entryIndex !== undefined && field) {
        const entry = currentDraft.entries[Number(entryIndex)];
        if (entry) {
          entry[field] = coerceDraftValue(field, target.value);
          if (field === "stageKey") {
            entry.label = getStageLabel(entry.stageKey);
          }
          if (field === "title" || field === "author") {
            const matched = findDraftMatch(entry.title, entry.author);
            entry.matchedId = matched?.id || "";
            if (matched && !entry.genreId) {
              entry.genreId = matched.genres?.[0] || "";
            }
          }
          if (["status", "stageKey", "genreId", "title", "author"].includes(field)) {
            paintPreview();
            return;
          }
        }
      }

      if (fileField === "coverImage" && target.files && target.files[0]) {
        const entry = currentDraft.entries[Number(entryIndex)];
        if (!entry) {
          return;
        }
        entry.coverImage = await readFileAsDataUrl(target.files[0]);
        paintPreview();
      }
    });

    preview.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) {
        return;
      }

      const type = action.dataset.action;

      if (type === "discard-draft") {
        currentDraft = null;
        paintPreview();
        return;
      }

      if (type === "save-draft") {
        if (!currentDraft) {
          return;
        }
        const result = saveImportDraft(currentDraft);
        if (result.bookCount) {
          window.alert(`Saved ${result.bookCount} book${result.bookCount === 1 ? "" : "s"} across ${result.listCount} ${result.listCount === 1 ? "entry set" : "entry sets"} into the local database.`);
        }
        window.location.reload();
        return;
      }

      if (type === "add-draft-row") {
        currentDraft.entries.push(
          seedDraftEntry({ title: "", author: "", stageKey: currentDraft.importMode === "award" ? "longlist" : "list" })
        );
        paintPreview();
        return;
      }

    });

    root.addEventListener("click", (event) => {
      const action = event.target.closest("[data-action]");
      if (!action) {
        return;
      }

      const type = action.dataset.action;

      if (type === "remove-local-list") {
        if (!window.confirm("Remove this locally saved list and its entries?")) {
          return;
        }
        removeLocalList(action.dataset.listId);
        window.location.reload();
        return;
      }

      if (type === "clear-local-library") {
        if (!window.confirm("Clear all locally saved lists, books, patches, and entries?")) {
          return;
        }
        clearLocalLibrary();
        window.location.reload();
      }
    });
  }

  function renderAdminLibrary(localLists) {
    if (!localLists.length) {
      return `
        <div class="helper-box">
          <p class="helper-text">No locally saved imports yet. Once you save a draft here, it becomes part of the site data on this browser.</p>
        </div>
      `;
    }

    return `
      <div class="stack-list">
        ${localLists
          .map((list) => {
            const source = data.sources.find((item) => item.id === list.sourceId) || { name: "Local source" };
            const entryCount = adminStore.entries.filter((entry) => entry.listId === list.id).length;
            return `
              <article class="preview-item preview-item--saved">
                <div class="preview-item-head">
                  <div>
                    <span class="eyebrow">${source.name}</span>
                    <strong>${list.title}</strong>
                  </div>
                  <button class="ghost-button ghost-button--small" type="button" data-action="remove-local-list" data-list-id="${list.id}">
                    Remove
                  </button>
                </div>
                <span class="meta-line">${list.kind} · ${list.scope} · ${entryCount} books · Saved ${formatDate(list.updatedAt)}</span>
              </article>
            `;
          })
          .join("")}
        <button class="ghost-button" type="button" data-action="clear-local-library">Clear local library</button>
      </div>
    `;
  }

  function buildImportDraft(formData) {
    const mode = String(formData.get("importMode") || "list");
    return mode === "award" ? buildAwardDraft(formData) : buildListDraft(formData);
  }

  function buildListDraft(formData) {
    const title = String(formData.get("listName") || "").trim() || "Untitled list";
    const sourceUrl = String(formData.get("listUrl") || "").trim();
    const entries = parseImportedText(String(formData.get("listText") || "").trim(), { stageKey: "list" });

    return {
      importMode: "list",
      year: Number(formData.get("year") || data.year),
      sourceUrl,
      sourceName: deriveSourceNameFromUrl(sourceUrl),
      title,
      notes: entries.length
        ? "Review each parsed row, reject any noise, and save the accepted books into the local dataset."
        : "Paste one book per line and the importer will try to extract title, author, and genre.",
      entries
    };
  }

  function buildAwardDraft(formData) {
    const title = String(formData.get("awardName") || "").trim() || "Untitled award";
    const sourceUrl = String(formData.get("awardUrl") || "").trim();
    const entries = [
      ...parseImportedText(String(formData.get("awardLonglist") || "").trim(), { stageKey: "longlist" }),
      ...parseImportedText(String(formData.get("awardShortlist") || "").trim(), { stageKey: "shortlist" }),
      ...parseImportedText(String(formData.get("awardWinner") || "").trim(), { stageKey: "winner" })
    ];

    return {
      importMode: "award",
      year: Number(formData.get("year") || data.year),
      sourceUrl,
      sourceName: title,
      title,
      notes: entries.length
        ? "Rows are grouped into longlist, shortlist, and winner buckets. Only accepted rows will be saved."
        : "Paste any combination of longlist, shortlist, or winner text to generate review rows.",
      entries
    };
  }

  function seedDraftEntry(rawEntry) {
    const matched = findDraftMatch(rawEntry.title, rawEntry.author);
    const stageKey = rawEntry.stageKey || "list";

    return {
      rank: rawEntry.rank || null,
      status: rawEntry.status || "accepted",
      stageKey,
      title: rawEntry.title || matched?.title || "",
      author: rawEntry.author || matched?.author || "",
      label: rawEntry.label || getStageLabel(stageKey),
      genreId: rawEntry.genreId || inferGenreId(rawEntry.rawLine || `${rawEntry.title} ${rawEntry.author}`, matched),
      published: matched?.published || "",
      publisher: matched?.publisher || "",
      format: matched?.format || "",
      pages: matched?.pages || "",
      blurb: matched?.blurb || "",
      coverImage: rawEntry.coverImage || matched?.coverImage || "",
      matchedId: matched?.id || "",
      rawLine: rawEntry.rawLine || ""
    };
  }

  function renderImportPreview(payload) {
    const foundCount = payload.entries.length;
    const acceptedCount = payload.entries.filter((entry) => entry.status !== "rejected").length;
    const matchedCount = payload.entries.filter((entry) => entry.matchedId).length;
    const bucketSummary = summarizeDraftEntries(payload.entries, payload.importMode);

    return `
      <div class="admin-preview-shell">
        <div class="preview-item preview-item--meta">
          <div class="preview-item-head">
            <div>
              <span class="eyebrow">${payload.importMode === "award" ? "Award draft" : "List draft"}</span>
              <strong>${escapeHtml(payload.title)}</strong>
            </div>
            <div class="button-row">
              <button class="ghost-button ghost-button--small" type="button" data-action="add-draft-row">Add row</button>
              <button class="button button--small" type="button" data-action="save-draft" ${acceptedCount ? "" : "disabled"}>Save accepted rows</button>
              <button class="ghost-button ghost-button--small" type="button" data-action="discard-draft">Discard</button>
            </div>
          </div>
          <span class="summary summary--small">${escapeHtml(payload.notes)}</span>
          <div class="field-grid">
            <label class="field">
              <span>${payload.importMode === "award" ? "Award name" : "List name"}</span>
              <input class="input" data-meta-field="title" type="text" value="${escapeHtml(payload.title)}" />
            </label>
            <label class="field">
              <span>Source</span>
              <input class="input" data-meta-field="sourceName" type="text" value="${escapeHtml(payload.sourceName)}" />
            </label>
          </div>
          <span class="meta-line">${foundCount} books found · ${acceptedCount} accepted · ${foundCount - acceptedCount} rejected · ${matchedCount} matched existing books</span>
          ${bucketSummary.length ? `<div class="pill-row">${bucketSummary.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
        </div>
        ${
          foundCount
            ? `
              <div class="admin-review-table">
                <div class="admin-review-head ${payload.importMode === "award" ? "is-award" : ""}">
                  <span>Status</span>
                  ${payload.importMode === "award" ? "<span>Bucket</span>" : ""}
                  <span>Title</span>
                  <span>Author</span>
                  <span>Genre</span>
                  <span>Match</span>
                </div>
                <div class="admin-draft-list">${payload.entries.map((entry, index) => renderDraftEntryRow(entry, index, payload.importMode)).join("")}</div>
              </div>
              <div class="admin-review-footer">
                <button class="button" type="button" data-action="save-draft" ${acceptedCount ? "" : "disabled"}>Save accepted rows to local database</button>
              </div>
            `
            : `<div class="preview-item"><span class="summary summary--small">No books were found yet. Try formats like “Title — Author” or “Title by Author”.</span></div>`
        }
      </div>
    `;
  }

  function renderDraftEntryRow(entry, index, importMode) {
    const matchedBook = entry.matchedId ? booksById[entry.matchedId] : findDraftMatch(entry.title, entry.author);
    const matchLabel = matchedBook ? `Matched canonical book: ${matchedBook.title}` : "New canonical book";

    return `
      <article class="preview-item preview-item--entry ${entry.status === "rejected" ? "is-rejected" : ""}">
        <div class="admin-draft-row">
          <div class="admin-draft-fields">
            <div class="admin-review-fields ${importMode === "award" ? "is-award" : ""}">
              <label class="field">
                <span>Status</span>
                <select class="select" data-entry-index="${index}" data-field="status">
                  <option value="accepted" ${entry.status === "accepted" ? "selected" : ""}>Accept</option>
                  <option value="rejected" ${entry.status === "rejected" ? "selected" : ""}>Reject</option>
                </select>
              </label>
              ${
                importMode === "award"
                  ? `
                    <label class="field">
                      <span>Bucket</span>
                      <select class="select" data-entry-index="${index}" data-field="stageKey">
                        <option value="longlist" ${entry.stageKey === "longlist" ? "selected" : ""}>Longlist</option>
                        <option value="shortlist" ${entry.stageKey === "shortlist" ? "selected" : ""}>Shortlist</option>
                        <option value="winner" ${entry.stageKey === "winner" ? "selected" : ""}>Winner</option>
                      </select>
                    </label>
                  `
                  : ""
              }
              <label class="field">
                <span>Title</span>
                <input class="input" data-entry-index="${index}" data-field="title" type="text" value="${escapeHtml(entry.title)}" />
              </label>
              <label class="field">
                <span>Author</span>
                <input class="input" data-entry-index="${index}" data-field="author" type="text" value="${escapeHtml(entry.author)}" />
              </label>
              <label class="field">
                <span>Genre</span>
                <select class="select" data-entry-index="${index}" data-field="genreId">
                  <option value="">Choose genre</option>
                  ${data.taxonomy.map((genre) => `<option value="${genre.id}" ${entry.genreId === genre.id ? "selected" : ""}>${genre.name}</option>`).join("")}
                </select>
              </label>
            </div>
            <div class="admin-review-meta">
              <span class="meta-line">${entry.rawLine ? `Parsed from: ${escapeHtml(entry.rawLine)}` : "Parsed row"}</span>
              <span class="status-chip">${escapeHtml(matchLabel)}</span>
            </div>
          </div>
          <div class="admin-draft-cover">
            ${renderCover(
              {
                title: entry.title || "Untitled",
                author: entry.author || "Unknown author",
                cover: createCoverPalette(entry.title || "Untitled"),
                coverImage: entry.coverImage || ""
              },
              "cover-lg"
            )}
            <label class="field">
              <span>Cover image URL</span>
              <input class="input" data-entry-index="${index}" data-field="coverImage" type="url" value="${escapeHtml(entry.coverImage || "")}" placeholder="https://example.com/cover.jpg" />
            </label>
            <label class="field">
              <span>Upload cover image</span>
              <input class="input input--file" data-entry-index="${index}" data-file-field="coverImage" type="file" accept="image/*" />
            </label>
          </div>
        </div>
      </article>
    `;
  }

  function saveImportDraft(draft) {
    const acceptedEntries = draft.entries.filter((entry) => entry.status !== "rejected" && String(entry.title || "").trim());
    if (!acceptedEntries.length) {
      return { bookCount: 0, listCount: 0 };
    }

    const store = loadAdminStore();
    const sourceRecord = buildSourceRecord(draft, store);
    store.sources = upsertRecord(store.sources, sourceRecord);
    const listCount = saveDraftLists(store, draft, sourceRecord, acceptedEntries);
    writeAdminStore(store);
    return { bookCount: acceptedEntries.length, listCount };
  }

  function saveDraftLists(store, draft, sourceRecord, acceptedEntries) {
    const sections = draft.importMode === "award"
      ? [
          { stageKey: "longlist", title: `${draft.title} Longlist`, kind: "Longlist" },
          { stageKey: "shortlist", title: `${draft.title} Shortlist`, kind: "Award" },
          { stageKey: "winner", title: `${draft.title} Winner`, kind: "Award" }
        ]
      : [{ stageKey: "list", title: draft.title, kind: "Best Of" }];

    let savedLists = 0;

    sections.forEach((section) => {
      const rows = acceptedEntries.filter((entry) => entry.stageKey === section.stageKey);
      if (!rows.length) {
        return;
      }

      const listId = `local-${slugify(sourceRecord.name)}-${slugify(section.title)}-${draft.year}`;
      const listRecord = {
        id: listId,
        sourceId: sourceRecord.id,
        title: section.title,
        kind: section.kind,
        scope: inferDraftScope(rows),
        ranked: rows.some((entry) => entry.rank),
        year: draft.year,
        followers: 0,
        updatedAt: new Date().toISOString().slice(0, 10),
        url: draft.sourceUrl || "#",
        description: draft.notes
      };

      store.lists = upsertRecord(store.lists, listRecord);
      store.entries = store.entries.filter((entry) => entry.listId !== listId);
      savedLists += 1;

      rows.forEach((entry, index) => {
        const bookId = saveDraftBook(store, draft, entry);
        store.entries.push({
          listId,
          bookId,
          position: entry.rank || null,
          label: entry.label || getStageLabel(section.stageKey),
          sortOrder: index + 1
        });
      });
    });

    return savedLists;
  }

  function saveDraftBook(store, draft, entry) {
    const latestStoreData = buildMergedData(seedData, store);
    const latestBooksById = Object.fromEntries(latestStoreData.books.map((book) => [book.id, book]));
    const matched =
      latestBooksById[entry.matchedId] ||
      latestStoreData.books.find((book) => isSameBook(book, entry.title, entry.author));

    if (matched) {
      const patch = buildBookPatch(matched, draft, entry);
      if (matched.id.startsWith("local-")) {
        store.books = store.books.map((book) => (book.id === matched.id ? normalizeBook({ ...book, ...patch }, draft.year) : book));
      } else if (Object.keys(patch).length) {
        store.bookPatches = {
          ...store.bookPatches,
          [matched.id]: {
            ...(store.bookPatches[matched.id] || {}),
            ...patch
          }
        };
      }
      return matched.id;
    }

    let candidateId = `local-${slugify(entry.title)}-${slugify(entry.author || "author")}`;
    let collision = 2;
    while (latestBooksById[candidateId] || store.books.some((book) => book.id === candidateId)) {
      candidateId = `local-${slugify(entry.title)}-${slugify(entry.author || "author")}-${collision}`;
      collision += 1;
    }

    const newBook = normalizeBook(
      {
        id: candidateId,
        slug: slugify(entry.title),
        title: entry.title,
        author: entry.author || "Unknown author",
        year: draft.year,
        published: entry.published || `${draft.year}-01-01`,
        publisher: entry.publisher || "Publisher TBD",
        format: entry.format || inferFormatFromGenre(entry.genreId),
        pages: Number(entry.pages) || null,
        genres: entry.genreId ? [entry.genreId] : [],
        blurb: entry.blurb || "Locally imported book awaiting fuller editorial copy.",
        coverImage: entry.coverImage || "",
        cover: createCoverPalette(entry.title)
      },
      draft.year
    );

    store.books = upsertRecord(store.books, newBook);
    return newBook.id;
  }

  function buildBookPatch(existingBook, draft, entry) {
    const patch = {};
    if (entry.author && entry.author !== existingBook.author) {
      patch.author = entry.author;
    }
    if (entry.coverImage) {
      patch.coverImage = entry.coverImage;
    }
    if (entry.genreId) {
      patch.genres = Array.from(new Set([...(existingBook.genres || []), entry.genreId]));
    }
    if (!existingBook.year) {
      patch.year = draft.year;
    }
    return patch;
  }

  function buildSourceRecord(draft, store) {
    const sourceName = draft.sourceName || "Local source";
    const matchedSource = data.sources.find((source) => source.name.toLowerCase() === sourceName.toLowerCase());
    if (matchedSource) {
      return {
        ...matchedSource,
        type: draft.importMode === "award" ? "Award" : matchedSource.type,
        url: draft.sourceUrl || matchedSource.url,
        note: matchedSource.note
      };
    }

    const localId = `local-${slugify(sourceName)}`;
    const existingLocal = store.sources.find((source) => source.id === localId);
    return {
      id: existingLocal?.id || localId,
      name: sourceName,
      type: draft.importMode === "award" ? "Award" : "Critic List",
      url: draft.sourceUrl || "#",
      note: draft.importMode === "award" ? "Locally imported award source" : "Locally imported source list"
    };
  }

  function parseImportedText(text, options) {
    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const structuredEntries = parseStructuredBestOfLines(lines, options);
    return (structuredEntries.length ? structuredEntries : lines.map((line) => parseImportedLine(line, options)))
      .filter((entry) => entry && entry.title)
      .map((entry) => seedDraftEntry(entry));
  }

  function parseStructuredBestOfLines(lines, options) {
    const entries = [];
    const stageKey = options.stageKey || "list";

    lines.forEach((line, index) => {
      if (!looksLikeContributorLine(line)) {
        return;
      }

      const titleLine = findNearestTitleLine(lines, index);
      if (!titleLine) {
        return;
      }

      const author = cleanImportedFragment(line.replace(/\s*\([^)]*\)\s*$/, ""));
      const parsedTitle = parseImportedLine(titleLine, options);
      if (!parsedTitle?.title || entries.some((entry) => normalizeText(entry.title) === normalizeText(parsedTitle.title))) {
        return;
      }

      entries.push({
        ...parsedTitle,
        status: "accepted",
        stageKey,
        author,
        rawLine: `${titleLine} — ${line}`
      });
    });

    return entries;
  }

  function findNearestTitleLine(lines, authorIndex) {
    for (let index = authorIndex - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (isImportNoiseLine(line)) {
        continue;
      }
      return line;
    }
    return "";
  }

  function isImportNoiseLine(line) {
    const normalized = normalizeText(line);
    return (
      /^(read|buy|shop|purchase|order)\b/.test(normalized) ||
      normalized.includes("full review") ||
      normalized.includes("pw talks with") ||
      normalized.length > 120
    );
  }

  function looksLikeContributorLine(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed || isImportNoiseLine(trimmed)) {
      return false;
    }
    if (!/\([^)]{2,80}\)\s*$/.test(trimmed)) {
      return false;
    }

    const contributorText = trimmed.replace(/\s*\([^)]*\)\s*$/, "").replace(/,?\s*\btrans\..*$/i, "").trim();
    return looksLikeAuthor(contributorText);
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function parseImportedLine(line, options) {
    const stageKey = options.stageKey || "list";
    const rankMatch = line.match(/^\s*(\d+)[\.\)]?\s+/);
    const withoutRank = line.replace(/^\s*(\d+|[-*•])[\.\)]?\s+/, "").trim();
    const explicitGenreId = inferGenreId(withoutRank, null);
    const cleaned = stripGenreMarkers(withoutRank, explicitGenreId).trim();
    let title = cleaned;
    let author = "";

    const byMatch = cleaned.match(/^(.+?)\s+\bby\b\s+(.+)$/i);
    if (byMatch) {
      title = byMatch[1];
      author = byMatch[2];
    } else {
      const dashParts = cleaned.split(/\s+[—–-]\s+/).map((part) => part.trim()).filter(Boolean);
      if (dashParts.length >= 2) {
        title = dashParts[0];
        author = dashParts[1];
      } else {
        const commaParts = cleaned.split(/\s*,\s*/).map((part) => part.trim()).filter(Boolean);
        if (commaParts.length === 2 && looksLikeAuthor(commaParts[1])) {
          title = commaParts[0];
          author = commaParts[1];
        }
      }
    }

    title = cleanImportedFragment(title);
    author = cleanImportedFragment(author);
    if (!title) {
      return null;
    }

    const matched = findDraftMatch(title, author);
    return {
      status: "accepted",
      rank: rankMatch ? Number(rankMatch[1]) : null,
      stageKey,
      title,
      author,
      genreId: explicitGenreId || matched?.genres?.[0] || "",
      label: getStageLabel(stageKey),
      rawLine: line
    };
  }

  function inferGenreId(text, matched) {
    const lower = String(text || "").toLowerCase();
    const genreMatchers = [
      { id: "literary-fiction", terms: ["literary fiction"] },
      { id: "historical-fiction", terms: ["historical fiction", "historical novel"] },
      { id: "mystery-thriller", terms: ["mystery", "thriller", "crime"] },
      { id: "science-fantasy", terms: ["science fiction", "sci-fi", "fantasy", "speculative"] },
      { id: "memoir-biography", terms: ["memoir", "biography"] },
      { id: "history-politics", terms: ["history", "politics", "nonfiction"] },
      { id: "essays-culture", terms: ["essays", "essay collection", "culture"] },
      { id: "fiction", terms: ["fiction", "novel"] }
    ];

    const explicit = genreMatchers.find((genre) => genre.terms.some((term) => lower.includes(term)));
    return explicit?.id || matched?.genres?.[0] || "";
  }

  function stripGenreMarkers(text, genreId) {
    if (!genreId || !taxonomyById[genreId]) {
      return text;
    }

    const name = taxonomyById[genreId].name;
    return text
      .replace(new RegExp(`\\(${escapeRegExp(name)}\\)`, "ig"), "")
      .replace(new RegExp(`\\[${escapeRegExp(name)}\\]`, "ig"), "")
      .replace(new RegExp(`\\s+[—–-]\\s+${escapeRegExp(name)}$`, "ig"), "")
      .trim();
  }

  function cleanImportedFragment(value) {
    return String(value || "")
      .replace(/^["'“”]+|["'“”]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function looksLikeAuthor(value) {
    const normalized = String(value || "").replace(/\s+(?:and|&)\s+/gi, " ").trim();
    return /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){0,5}$/.test(normalized);
  }

  function inferDraftScope(entries) {
    const genreIds = entries.map((entry) => entry.genreId).filter(Boolean);
    if (!genreIds.length) {
      return "All Books";
    }

    const fictionGenres = new Set(["fiction", "literary-fiction", "historical-fiction", "mystery-thriller", "science-fantasy"]);
    const nonfictionGenres = new Set(["memoir-biography", "history-politics", "essays-culture"]);

    if (genreIds.every((genreId) => fictionGenres.has(genreId))) {
      return "Fiction";
    }
    if (genreIds.every((genreId) => nonfictionGenres.has(genreId))) {
      return "Nonfiction";
    }
    return "All Books";
  }

  function getAwardRecognition(item) {
    const directAwards = derived.awardsByBook.get(item.book.id) || [];
    if (directAwards.length) {
      return {
        total: directAwards.length,
        shortLabel: `On ${directAwards.length} award ${directAwards.length === 1 ? "list" : "lists"}`
      };
    }

    const awardEntries = item.appearances.filter((appearance) => appearance.list.kind === "Award" || appearance.list.kind === "Longlist");
    if (!awardEntries.length) {
      return null;
    }

    return {
      total: awardEntries.length,
      shortLabel: `On ${awardEntries.length} award ${awardEntries.length === 1 ? "list" : "lists"}`
    };
  }

  function summarizeDraftEntries(entries, importMode) {
    if (!entries.length) {
      return [];
    }

    if (importMode === "award") {
      const longlistCount = entries.filter((entry) => entry.stageKey === "longlist" && entry.status !== "rejected").length;
      const shortlistCount = entries.filter((entry) => entry.stageKey === "shortlist" && entry.status !== "rejected").length;
      const winnerCount = entries.filter((entry) => entry.stageKey === "winner" && entry.status !== "rejected").length;
      return [
        longlistCount ? `${longlistCount} longlist` : "",
        shortlistCount ? `${shortlistCount} shortlist` : "",
        winnerCount ? `${winnerCount} winner` : ""
      ].filter(Boolean);
    }

    const rankedCount = entries.filter((entry) => entry.rank).length;
    return [rankedCount ? `${rankedCount} ranked rows` : "Unranked import"];
  }

  function removeLocalList(listId) {
    const store = loadAdminStore();
    store.lists = store.lists.filter((list) => list.id !== listId);
    store.entries = store.entries.filter((entry) => entry.listId !== listId);
    writeAdminStore(store);
  }

  function clearLocalLibrary() {
    writeAdminStore(getEmptyAdminStore());
  }

  function getGenreRankings(book) {
    return book.genres
      .map((genreId) => {
        const genreBooks = getFilteredBooks(genreId);
        const index = genreBooks.findIndex((item) => item.book.id === book.id);
        if (index === -1 || !taxonomyById[genreId]) {
          return null;
        }

        return {
          id: genreId,
          name: taxonomyById[genreId].name,
          rank: index + 1
        };
      })
      .filter(Boolean);
  }

  function getFilteredBooks(activeGenre) {
    const filtered = activeGenre === "all"
      ? derived.bookRanks.slice()
      : derived.bookRanks.filter((item) => item.book.genres.includes(activeGenre));

    return filtered.sort(compareBooks);
  }

  function compareBooks(left, right) {
    if (right.aggregateScore !== left.aggregateScore) {
      return right.aggregateScore - left.aggregateScore;
    }
    return right.listCount - left.listCount;
  }

  function getSortedListEntries(entries, sortKey) {
    return entries.slice().sort((left, right) => {
      if (sortKey === "title") {
        return left.book.title.localeCompare(right.book.title);
      }
      if (sortKey === "aggregate") {
        return derived.bookRanksById[right.book.id].aggregateScore - derived.bookRanksById[left.book.id].aggregateScore;
      }
      return 0;
    });
  }

  function getSortedLists(sortKey) {
    return derived.listStats.slice().sort((left, right) => {
      if (sortKey === "followers") {
        return right.list.followers - left.list.followers;
      }
      if (sortKey === "title") {
        return left.list.title.localeCompare(right.list.title);
      }
      return new Date(right.list.updatedAt) - new Date(left.list.updatedAt);
    });
  }

  function getSortedAwardLists(sortKey) {
    return derived.listStats
      .filter((item) => item.source.type === "Award" || item.list.kind === "Award" || item.list.kind === "Longlist")
      .sort((left, right) => {
        if (sortKey === "title") {
          return left.list.title.localeCompare(right.list.title);
        }
        return new Date(right.list.updatedAt) - new Date(left.list.updatedAt);
      });
  }

  function renderGenrePills(activeGenre) {
    const items = [
      `<a class="pill ${activeGenre === "all" ? "is-active" : ""}" href="${buildBooksHref("all")}">All genres</a>`
    ];

    data.taxonomy.forEach((genre) => {
      items.push(
        `<a class="pill ${activeGenre === genre.id ? "is-active" : ""}" href="${buildBooksHref(genre.id)}">${genre.name}</a>`
      );
    });

    return items.join("");
  }

  function renderRankingRow(item) {
    const awardNote = getAwardRecognition(item);

    return `
      <li class="ranking-row is-clickable" data-href="${buildBookHref(item.book.slug)}" tabindex="0">
        <div class="ranking-index">${String(item.rank).padStart(2, "0")}</div>
        ${renderCover(item.book, "cover-sm")}
        <div class="ranking-main">
          <div class="title-row">
            <h3 class="item-title">${item.book.title}</h3>
          </div>
          <p class="byline">${item.book.author}</p>
          <div class="pill-row">
            ${awardNote ? `<span class="status-chip">${escapeHtml(awardNote.shortLabel)}</span>` : ""}
            ${item.book.genres.slice(0, 2).map((genreId) => renderTag(taxonomyById[genreId].name)).join("")}
          </div>
        </div>
        <div class="ranking-side">
          <div class="ranking-tail">
            <strong>${item.listCount}</strong>
            <span>${item.listCount === 1 ? "list" : "lists"}</span>
          </div>
        </div>
      </li>
    `;
  }

  function renderSidebarBookRow(item, index) {
    const subtitle = `${item.listCount} lists · #${item.rank} aggregate`;

    return `
      <article class="mini-book-row is-clickable" data-href="${buildBookHref(item.book.slug)}" tabindex="0">
        <span class="mini-rank">${index}</span>
        ${renderCover(item.book, "cover-xs")}
        <div class="mini-book-copy">
          <h3 class="mini-book-title">${item.book.title}</h3>
          <p class="byline">${item.book.author}</p>
          <p class="meta-line">${subtitle}</p>
        </div>
      </article>
    `;
  }

  function renderPopularListRow(item, compact) {
    return `
      <article class="list-row is-clickable ${compact ? "list-row--compact" : ""}" data-href="${buildListHref(item.list.id)}" tabindex="0">
        <div class="list-row-main">
          <p class="eyebrow">${item.source.name}</p>
          <h3 class="item-title">${item.list.title}</h3>
          <p class="meta-line">${item.list.kind} · ${item.list.scope} · ${item.entryCount} books · Updated ${formatMonth(item.list.updatedAt)}</p>
        </div>
        <div class="list-row-tail">
          <strong>${formatNumber(item.list.followers)}</strong>
          <span>followers</span>
        </div>
      </article>
    `;
  }

  function renderLatestListCard(item) {
    const externalUrl = item.list.url && item.list.url !== "#" ? item.list.url : "";

    return `
      <article class="latest-list-card is-clickable" data-href="${buildListHref(item.list.id)}" tabindex="0">
        <div class="latest-list-card-head">
          <strong class="latest-list-source">${item.source.name}</strong>
          ${externalUrl ? `<a class="text-link latest-list-link" href="${escapeHtml(externalUrl)}" target="_blank" rel="noreferrer">Source link</a>` : ""}
        </div>
        <h3 class="item-title">${item.list.title}</h3>
        <p class="summary summary--small">${item.list.description}</p>
        <div class="meta-strip meta-strip--dense">
          <span>${item.entryCount} books</span>
          <span>Added ${formatDate(item.list.updatedAt)}</span>
        </div>
      </article>
    `;
  }

  function renderGenreCard(item, activeGenre) {
    return `
      <a
        class="genre-card ${activeGenre === item.genre.id ? "is-active" : ""}"
        href="${buildGenresHref(item.genre.id)}"
        style="${getGenreToneStyle(item.genre.id)}"
      >
        <strong>${item.genre.name}</strong>
        <span>${item.count} books</span>
      </a>
    `;
  }

  function renderListsIndexSortTabs(sortKey) {
    const tabs = [
      { key: "latest", label: "Latest" },
      { key: "followers", label: "Followers" },
      { key: "title", label: "Title" }
    ];

    return tabs
      .map((tab) => {
        const href = buildPageHref("lists.html", { sort: tab.key });
        return `<a class="chip ${sortKey === tab.key ? "is-active" : ""}" href="${href}">${tab.label}</a>`;
      })
      .join("");
  }

  function renderAwardsIndexSortTabs(sortKey) {
    const tabs = [
      { key: "latest", label: "Latest" },
      { key: "title", label: "Title" }
    ];

    return tabs
      .map((tab) => {
        const href = buildPageHref("awards.html", { sort: tab.key });
        return `<a class="chip ${sortKey === tab.key ? "is-active" : ""}" href="${href}">${tab.label}</a>`;
      })
      .join("");
  }

  function renderAppearanceCard(appearance) {
    return `
      <article class="appearance-card is-clickable" data-href="${buildListHref(appearance.list.id)}" tabindex="0">
        <div class="appearance-head">
          <span class="eyebrow">${appearance.source.name}</span>
          <span class="status-chip">${appearance.label || "Listed"}</span>
        </div>
        <h3 class="item-title">${appearance.list.title}</h3>
        <p class="meta-line">${appearance.list.kind} · ${appearance.list.scope} · ${formatMonth(appearance.list.updatedAt)}</p>
      </article>
    `;
  }

  function renderAwardCard(recognition) {
    const href = recognition.award.url && recognition.award.url !== "#" ? recognition.award.url : buildPageHref("awards.html");
    const detail = [recognition.award.category, recognition.award.year].filter(Boolean).join(" · ");

    return `
      <article class="appearance-card is-clickable" data-href="${href}" tabindex="0">
        <div class="appearance-head">
          <span class="eyebrow">${recognition.source?.name || "Award"}</span>
          <span class="status-chip">${escapeHtml(recognition.recognition)}</span>
        </div>
        <h3 class="item-title">${recognition.award.name}</h3>
        <p class="meta-line">${detail || "Award recognition"}</p>
      </article>
    `;
  }

  function renderListSortTabs(listId, sortKey) {
    const tabs = [
      { key: "original", label: "Original order" },
      { key: "aggregate", label: "Aggregate" },
      { key: "title", label: "Title" }
    ];

    return tabs
      .map((tab) => {
        const href = buildListHref(listId, { sort: tab.key });
        return `<a class="chip ${sortKey === tab.key ? "is-active" : ""}" href="${href}">${tab.label}</a>`;
      })
      .join("");
  }

  function renderListEntry(entry, index) {
    const ranking = derived.bookRanksById[entry.book.id];
    return `
      <article class="list-entry is-clickable" data-href="${buildBookHref(entry.book.slug)}" tabindex="0">
        <div class="list-entry-order">${entry.position || index}</div>
        ${renderCover(entry.book, "cover-sm")}
        <div class="list-entry-main">
          <h3 class="item-title">${entry.book.title}</h3>
          <p class="byline">${entry.book.author}</p>
          <p class="meta-line">${entry.book.format} · ${formatMonth(entry.book.published)} · ${entry.book.publisher}</p>
          <div class="pill-row">
            ${entry.book.genres.slice(0, 2).map((genreId) => renderTag(taxonomyById[genreId].name)).join("")}
          </div>
        </div>
        <div class="list-entry-side">
          <div class="list-entry-tail">
            <strong>#${ranking.rank}</strong>
            <span>${ranking.aggregateScore} pts</span>
          </div>
        </div>
      </article>
    `;
  }

  function searchEverything(query) {
    const needle = query.toLowerCase();
    const results = [];

    data.books.forEach((book) => {
      const haystack = [
        book.title,
        book.author,
        book.blurb,
        book.publisher,
        book.format,
        ...book.genres.map((genreId) => taxonomyById[genreId].name)
      ]
        .join(" ")
        .toLowerCase();

      if (haystack.includes(needle)) {
        const ranking = derived.bookRanksById[book.id];
        results.push({
          type: "Book",
          title: book.title,
          subtitle: `by ${book.author}`,
          href: buildBookHref(book.slug),
          detail: `#${ranking.rank} aggregate · ${ranking.listCount} list appearances`
        });
      }
    });

    data.lists.forEach((list) => {
      const source = sourcesById[list.sourceId];
      const haystack = [list.title, list.description, list.kind, list.scope, source.name].join(" ").toLowerCase();
      if (haystack.includes(needle)) {
        results.push({
          type: "List",
          title: list.title,
          subtitle: source.name,
          href: buildListHref(list.id),
          detail: `${list.kind} · ${list.scope} · ${formatNumber(list.followers)} followers`
        });
      }
    });

    data.sources.forEach((source) => {
      const haystack = [source.name, source.type, source.note].join(" ").toLowerCase();
      if (haystack.includes(needle)) {
        results.push({
          type: "Source",
          title: source.name,
          subtitle: source.type,
          href: source.url && source.url !== "#" ? source.url : buildPageHref("lists.html"),
          detail: source.note
        });
      }
    });

    data.taxonomy.forEach((genre) => {
      if (genre.name.toLowerCase().includes(needle)) {
        const count = data.books.filter((book) => book.genres.includes(genre.id)).length;
        results.push({
          type: "Genre",
          title: genre.name,
          subtitle: "Normalized taxonomy",
          href: buildGenresHref(genre.id),
          detail: `${count} books in the ${data.year} set`
        });
      }
    });

    return results;
  }

  function renderSearchResult(result) {
    return `
      <article class="search-result is-clickable" data-href="${result.href === "#" ? "index.html" : result.href}" tabindex="0">
        <span class="result-type">${result.type}</span>
        <h3 class="item-title">${result.title}</h3>
        <p class="byline">${result.subtitle}</p>
        <p class="meta-line">${result.detail}</p>
      </article>
    `;
  }

  function bindInteractiveCards() {
    root.addEventListener("click", (event) => {
      const interactive = event.target.closest("a, button, input, select, textarea, label");
      if (interactive) {
        return;
      }

      const card = event.target.closest("[data-href]");
      if (card) {
        window.location.href = card.dataset.href;
      }
    });

    root.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      const card = event.target.closest("[data-href]");
      if (card) {
        event.preventDefault();
        window.location.href = card.dataset.href;
      }
    });
  }

  function bindHeaderScrollState() {
    const header = document.querySelector(".site-header");
    if (!header) {
      return;
    }

    const syncState = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };

    syncState();
    window.addEventListener("scroll", syncState, { passive: true });
  }

  function getEmptyAdminStore() {
    return {
      version: 1,
      sources: [],
      lists: [],
      entries: [],
      books: [],
      bookPatches: {}
    };
  }

  function loadAdminStore() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return getEmptyAdminStore();
      }

      const parsed = JSON.parse(raw);
      return {
        version: 1,
        sources: Array.isArray(parsed.sources) ? parsed.sources : [],
        lists: Array.isArray(parsed.lists) ? parsed.lists : [],
        entries: Array.isArray(parsed.entries) ? parsed.entries : [],
        books: Array.isArray(parsed.books) ? parsed.books : [],
        bookPatches: parsed.bookPatches && typeof parsed.bookPatches === "object" ? parsed.bookPatches : {}
      };
    } catch (error) {
      return getEmptyAdminStore();
    }
  }

  function writeAdminStore(store) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (error) {
      window.alert("The browser could not save this local admin change. Check storage settings and try again.");
    }
  }

  function buildMergedData(seed, store) {
    const patchedSeedBooks = seed.books.map((book) => normalizeBook({ ...book, ...(store.bookPatches[book.id] || {}) }, seed.year));
    const localBooks = store.books.map((book) => normalizeBook(book, seed.year));

    return {
      ...seed,
      sources: mergeRecords(seed.sources, store.sources),
      books: [...patchedSeedBooks, ...localBooks],
      lists: mergeRecords(seed.lists, store.lists),
      entries: [...seed.entries, ...store.entries],
      awards: Array.isArray(seed.awards) ? seed.awards : []
    };
  }

  function mergeRecords(seedRecords, localRecords) {
    const map = new Map(seedRecords.map((item) => [item.id, item]));
    localRecords.forEach((item) => {
      map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    });
    return Array.from(map.values());
  }

  function normalizeBook(book, fallbackYear) {
    const cover = book.cover && book.cover.a && book.cover.b ? book.cover : createCoverPalette(book.title || book.id);
    return {
      ...book,
      year: Number(book.year) || fallbackYear,
      pages: book.pages ? Number(book.pages) : null,
      genres: Array.isArray(book.genres) ? book.genres.filter(Boolean) : [],
      cover,
      coverImage: book.coverImage || book.cover_image_url || "",
      amazonReferralUrl: book.amazonReferralUrl || book.amazon_referral_url || "",
      goodreadsUrl: book.goodreadsUrl || book.goodreads_url || ""
    };
  }

  function renderCover(book, extraClass) {
    return `
      <div class="cover ${extraClass || ""} ${book.coverImage ? "cover--image" : ""}" style="--cover-a:${book.cover.a};--cover-b:${book.cover.b};">
        ${book.coverImage ? `<img class="cover-media" src="${escapeHtml(book.coverImage)}" alt="${escapeHtml(book.title)} cover" loading="lazy" />` : ""}
        ${book.coverImage ? "" : `
          <div class="cover-label">
            <span class="cover-title">${book.title}</span>
            <span class="cover-author">${book.author}</span>
          </div>
        `}
      </div>
    `;
  }

  function renderTag(label) {
    return `<span class="tag">${label}</span>`;
  }

  function upsertRecord(collection, record) {
    return [...collection.filter((item) => item.id !== record.id), record];
  }

  function findDraftMatch(title, author) {
    if (!title) {
      return null;
    }

    const normalizedTitle = normalizeSearchString(title);
    const normalizedAuthor = normalizeSearchString(author || "");

    return data.books.find((book) => {
      const sameTitle = normalizeSearchString(book.title) === normalizedTitle;
      const sameAuthor = !normalizedAuthor || normalizeSearchString(book.author) === normalizedAuthor;
      return sameTitle && sameAuthor;
    }) || null;
  }

  function isSameBook(book, title, author) {
    return normalizeSearchString(book.title) === normalizeSearchString(title) &&
      (!author || normalizeSearchString(book.author) === normalizeSearchString(author));
  }

  function normalizeSearchString(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function getStageLabel(stageKey) {
    if (stageKey === "longlist") {
      return "Longlist";
    }
    if (stageKey === "shortlist") {
      return "Shortlist";
    }
    if (stageKey === "winner") {
      return "Winner";
    }
    return "Selected";
  }

  function inferFormatFromGenre(genreId) {
    if (genreId === "essays-culture") {
      return "Essays";
    }
    if (genreId === "memoir-biography") {
      return "Memoir";
    }
    if (genreId === "history-politics") {
      return "Reported Nonfiction";
    }
    if (genreId === "science-fantasy") {
      return "Speculative Novel";
    }
    return "Book";
  }

  function coerceDraftValue(field, value) {
    if (field === "pages" || field === "rank") {
      return value ? Number(value) : "";
    }
    return value;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  function createCoverPalette(seed) {
    const text = String(seed || "book");
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
    }

    const hueA = hash % 360;
    const hueB = (hash * 7) % 360;
    return {
      a: `hsl(${hueA} 38% 42%)`,
      b: `hsl(${hueB} 42% 18%)`
    };
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "item";
  }

  function deriveSourceNameFromUrl(url) {
    const host = getHost(url);
    if (!host) {
      return "Imported source";
    }

    return host
      .replace(/^www\./, "")
      .split(".")
      .slice(0, -1)
      .join(" ")
      .split(/[-\s]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }

  function getGenreToneStyle(genreId) {
    const tones = {
      fiction: { tint: "rgba(240, 236, 229, 0.96)", line: "rgba(112, 94, 71, 0.2)" },
      "literary-fiction": { tint: "rgba(243, 231, 223, 0.96)", line: "rgba(145, 96, 63, 0.2)" },
      "historical-fiction": { tint: "rgba(239, 233, 217, 0.96)", line: "rgba(147, 118, 71, 0.2)" },
      "mystery-thriller": { tint: "rgba(229, 235, 230, 0.96)", line: "rgba(70, 109, 84, 0.18)" },
      "science-fantasy": { tint: "rgba(229, 235, 245, 0.96)", line: "rgba(63, 87, 145, 0.18)" },
      "memoir-biography": { tint: "rgba(242, 232, 235, 0.96)", line: "rgba(132, 84, 98, 0.18)" },
      "history-politics": { tint: "rgba(237, 234, 226, 0.96)", line: "rgba(106, 99, 76, 0.18)" },
      "essays-culture": { tint: "rgba(241, 235, 226, 0.96)", line: "rgba(150, 114, 79, 0.18)" }
    };
    const tone = tones[genreId] || { tint: "rgba(241, 244, 248, 0.94)", line: "rgba(16, 20, 45, 0.12)" };
    return `--genre-tint:${tone.tint};--genre-line:${tone.line};`;
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildBuyLink(book) {
    if (book.amazonReferralUrl) {
      return book.amazonReferralUrl;
    }
    return `https://www.google.com/search?q=${encodeURIComponent(`buy ${book.title} ${book.author}`)}`;
  }

  function buildBooksHref(genre) {
    return buildPageHref("books.html", {
      genre: genre && genre !== "all" ? genre : null
    });
  }

  function buildGenresHref(genre) {
    return buildPageHref("genres.html", {
      genre: genre || null
    });
  }

  function buildBookHref(slug) {
    const year = Number(params.get("year")) || data.year;
    return `/${encodeURIComponent(year)}/${encodeURIComponent(slug)}`;
  }

  function buildListHref(id, extraParams) {
    return buildPageHref("list.html", { id, ...(extraParams || {}) });
  }

  function buildSearchHref(query) {
    return buildPageHref("search.html", { q: query || null });
  }

  function renderYearPills(pagePath) {
    const years = Array.isArray(data.availableYears) && data.availableYears.length ? data.availableYears : [data.year];
    return years
      .map((year) => {
        const href = buildPageHref(pagePath, { year });
        const className = year === data.year ? "pill is-active" : "pill";
        return `<a class="${className}" href="${href}">${year}</a>`;
      })
      .join("");
  }

  function syncNavigationYear() {
    const links = document.querySelectorAll(".site-header a[href]");
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (!href || /^https?:/i.test(href) || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      link.setAttribute("href", buildPageHref(href));
    });
  }

  function buildPageHref(path, overrides) {
    const [rawPathname, hash = ""] = String(path || "").split("#");
    const pathname = rawPathname.replace(/^\/+/, "");
    const isInternalHtml = pathname === "" || pathname.endsWith(".html");
    if (!isInternalHtml) {
      return path;
    }

    const query = new URLSearchParams(params.toString());
    const entries = Object.entries(overrides || {});
    entries.forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        query.delete(key);
      } else {
        query.set(key, String(value));
      }
    });

    if (!entries.some(([key]) => key === "year")) {
      if (data.year) {
        query.set("year", String(data.year));
      } else {
        query.delete("year");
      }
    }

    const allowedParamsByPath = {
      "index.html": new Set(["year", "genre"]),
      "books.html": new Set(["year", "genre"]),
      "genres.html": new Set(["year", "genre"]),
      "lists.html": new Set(["year", "sort"]),
      "awards.html": new Set(["year", "sort"]),
      "list.html": new Set(["year", "id", "sort"]),
      "book.html": new Set(["year", "slug"]),
      "search.html": new Set(["year", "q"]),
      "admin.html": new Set(["year", "mode"])
    };

    const allowedParams = allowedParamsByPath[pathname] || new Set(["year"]);
    Array.from(query.keys()).forEach((key) => {
      if (!allowedParams.has(key)) {
        query.delete(key);
      }
    });

    const queryString = query.toString();
    return `/${pathname}${queryString ? `?${queryString}` : ""}${hash ? `#${hash}` : ""}`;
  }

  function getHost(url) {
    try {
      return new URL(url).host;
    } catch (error) {
      return "";
    }
  }

  function formatMonth(value) {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "Recently updated";
    }
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
