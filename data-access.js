(function () {
  const CONFIG = {
    endpoint: "/api/books",
    activeYear: 2025,
    cacheKey: "books-of-the-year-airtable-v1",
    cacheTtlMs: 15 * 60 * 1000,
    requestTimeoutMs: 15000
  };

  const GENRES = [
    ["fiction", "Fiction"],
    ["literary-fiction", "Literary Fiction"],
    ["historical-fiction", "Historical Fiction"],
    ["mystery-thriller", "Mystery & Thriller"],
    ["science-fantasy", "Sci-Fi & Fantasy"],
    ["memoir", "Memoir"],
    ["history-biography", "History & Biography"],
    ["nonfiction", "Nonfiction"],
    ["essays-culture", "Essays & Culture"],
    ["other", "Other"]
  ];

  window.BOOKLIST_DATA_ACCESS = { loadAppData };

  async function loadAppData(options) {
    const requestedYear = Number(options && options.requestedYear);
    const cached = readCache();

    if (cached && Date.now() - cached.fetchedAt < CONFIG.cacheTtlMs) {
      return result(cached.data, "cache", "fresh-cache", cached.fetchedAt, cached.warnings || []);
    }

    try {
      const normalized = await loadAirtableData();
      const fetchedAt = Date.now();
      writeCache({ data: normalized.data, warnings: normalized.warnings, fetchedAt });
      return result(normalized.data, "airtable", "live", fetchedAt, normalized.warnings);
    } catch (error) {
      console.error("Airtable book data could not be loaded.", error);

      if (cached && cached.data) {
        return result(cached.data, "cache", "stale-cache", cached.fetchedAt, [
          ...(cached.warnings || []),
          "The live Airtable database could not be reached. Showing saved data."
        ], error);
      }

      const empty = emptyData(requestedYear || CONFIG.activeYear);
      return result(empty, "error", "load-error", null, [
        "The Airtable database could not be loaded and no saved copy is available."
      ], error);
    }
  }

  async function loadAirtableData() {
    if (window.location.protocol === "file:") {
      throw new Error("Airtable data requires an HTTP server. Run `npx vercel dev` and open the localhost URL instead of opening index.html directly.");
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), CONFIG.requestTimeoutMs);
    try {
      const response = await fetch(CONFIG.endpoint, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || !payload.data) {
        throw new Error(payload && payload.error ? payload.error : `The Airtable endpoint returned ${response.status}.`);
      }
      return { data: payload.data, warnings: Array.isArray(payload.warnings) ? payload.warnings : [] };
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function result(data, source, reason, fetchedAt, warnings, error) {
    window.BOOKLIST_RUNTIME_DETAILS = {
      dataSource: source,
      reason,
      fetchedAt: fetchedAt ? new Date(fetchedAt).toISOString() : null,
      activeYear: data.year,
      bookCount: data.books.length,
      listCount: data.lists.length,
      warningCount: warnings.length,
      warnings: warnings.slice(),
      error: error ? String(error.message || error) : null
    };

    warnings.forEach((warning) => console.warn(`[Books data] ${warning}`));
    return { data, source, reason, error: error || null };
  }

  function emptyData(year) {
    return {
      year,
      availableYears: [year],
      taxonomy: GENRES.map(([id, name], index) => ({ id, name, displayOrder: index + 1 })),
      sources: [],
      books: [],
      lists: [],
      entries: [],
      awards: [],
      reviews: [],
      importPresets: []
    };
  }

  function readCache() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(CONFIG.cacheKey) || "null");
      return parsed && parsed.data && Number(parsed.fetchedAt) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache(payload) {
    try {
      window.localStorage.setItem(CONFIG.cacheKey, JSON.stringify(payload));
    } catch (error) {
      console.warn("The normalized Airtable data could not be cached.", error);
    }
  }
})();
