(function () {
  const CONFIG = {
    spreadsheetId: "1L_KTNG2FuY4kphCUgb3nt7MwmoSQtzWMVnlbGGOfuIY",
    booksGid: "2039015008",
    activeYear: 2025,
    cacheKey: "books-of-the-year-sheets-v1",
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
      const table = await loadGoogleTable(CONFIG.booksGid);
      const normalized = normalizeTable(table, requestedYear || CONFIG.activeYear);
      const fetchedAt = Date.now();
      writeCache({ data: normalized.data, warnings: normalized.warnings, fetchedAt });
      return result(normalized.data, "google-sheets", "live", fetchedAt, normalized.warnings);
    } catch (error) {
      console.error("Google Sheets book data could not be loaded.", error);

      if (cached && cached.data) {
        return result(cached.data, "cache", "stale-cache", cached.fetchedAt, [
          ...(cached.warnings || []),
          "The live spreadsheet could not be reached. Showing saved data."
        ], error);
      }

      const empty = emptyData(requestedYear || CONFIG.activeYear);
      return result(empty, "error", "load-error", null, [
        "The spreadsheet could not be loaded and no saved copy is available."
      ], error);
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

  function loadGoogleTable(gid) {
    return new Promise((resolve, reject) => {
      const callbackName = `booklistSheetCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const script = document.createElement("script");
      const timeout = window.setTimeout(() => finish(new Error("The spreadsheet request timed out.")), CONFIG.requestTimeoutMs);
      let settled = false;

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      function finish(error, table) {
        if (settled) return;
        settled = true;
        cleanup();
        error ? reject(error) : resolve(table);
      }

      window[callbackName] = (response) => {
        if (!response || response.status === "error" || !response.table) {
          const message = response && response.errors && response.errors[0]
            ? response.errors[0].detailed_message || response.errors[0].message
            : "Google Sheets returned an invalid response.";
          finish(new Error(message));
          return;
        }
        finish(null, response.table);
      };

      const params = new URLSearchParams({
        gid: String(gid),
        tqx: `responseHandler:${callbackName}`,
        headers: "1"
      });
      script.src = `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?${params}`;
      script.async = true;
      script.onerror = () => finish(new Error("The spreadsheet request was blocked or unavailable."));
      document.head.appendChild(script);
    });
  }

  function normalizeTable(table, activeYear) {
    const warnings = [];
    const headers = (table.cols || []).map((column, index) => normalizeHeader(column.label || column.id || `column-${index + 1}`));
    const rows = (table.rows || []).map((row, rowIndex) => {
      const record = { __rowNumber: rowIndex + 2 };
      headers.forEach((header, columnIndex) => {
        const cell = row.c && row.c[columnIndex];
        record[header] = cell && cell.v !== null && cell.v !== undefined ? String(cell.v).trim() : "";
      });
      return record;
    });

    assertColumns(headers, ["title", "author"]);

    const taxonomy = GENRES.map(([id, name], index) => ({ id, name, displayOrder: index + 1 }));
    const sourcesMap = new Map();
    const listsMap = new Map();
    const books = [];
    const entries = [];
    const awards = [];
    const usedSlugs = new Map();

    rows.forEach((row) => {
      const publishedValue = value(row, "published");
      if (publishedValue && !isTruthy(publishedValue)) return;

      const title = value(row, "title");
      const author = value(row, "author");
      if (!title) {
        if (Object.values(row).some(Boolean)) warnings.push(`Row ${row.__rowNumber} was skipped because it has no title.`);
        return;
      }
      if (!author) warnings.push(`Row ${row.__rowNumber} (${title}) has no author.`);

      const baseSlug = slugify(value(row, "slug") || title);
      let slug = baseSlug || `book-${row.__rowNumber}`;
      if (usedSlugs.has(slug)) {
        const authorSuffix = slugify(author).split("-").slice(0, 2).join("-");
        slug = `${slug}-${authorSuffix || row.__rowNumber}`;
        warnings.push(`Row ${row.__rowNumber} needed a unique generated slug: ${slug}.`);
      }
      usedSlugs.set(slug, true);

      const bookId = value(row, "id") || slug;
      const year = toInteger(value(row, "publication-year", "publication-year-1", "publication_year")) || activeYear;
      const genreName = value(row, "genre", "book-genre", "book_genre");
      const genreId = normalizeGenre(genreName);
      const listNames = unique(splitListCell(value(row, "lists")));
      const coverImage = durableCover(row);

      const book = {
        id: bookId,
        dbId: bookId,
        slug,
        title,
        author,
        year,
        published: value(row, "publication-date", "publication_date") || `${year}-01-01`,
        publisher: value(row, "publisher") || "",
        format: genreName || "Book",
        pages: toInteger(value(row, "page-count", "page_count")),
        genres: [genreId],
        criticScore: toNumber(value(row, "critic-score", "critic_score")),
        userScore: toNumber(value(row, "user-score", "user_score")),
        criticCount: toInteger(value(row, "critic-count", "critic_count")),
        reviewCount: toInteger(value(row, "review-count", "review_count")),
        trendScore: toNumber(value(row, "trend-score", "trend_score")),
        blurb: value(row, "book-summary-ai", "book-summary", "blurb"),
        coverImage,
        amazonReferralUrl: validHttpUrl(value(row, "amazon-url", "amazon_referral_url")),
        goodreadsUrl: validHttpUrl(value(row, "goodreads-url", "goodreads_url")),
        isbn10: value(row, "isbn-10"),
        isbn13: value(row, "isbn-13"),
        cover: palette(title)
      };
      books.push(book);

      listNames.forEach((listName) => {
        const listId = slugify(listName);
        if (!listId) return;
        if (!listsMap.has(listId)) {
          const sourceName = inferSourceName(listName);
          const sourceId = slugify(sourceName);
          if (!sourcesMap.has(sourceId)) {
            sourcesMap.set(sourceId, { id: sourceId, name: sourceName, type: "Editorial List", url: "#", note: "From the Google Sheets editorial database" });
          }
          listsMap.set(listId, {
            id: listId,
            sourceId,
            title: listName,
            kind: "Best Of",
            scope: "All Books",
            ranked: false,
            countsTowardScore: true,
            year,
            followers: 0,
            updatedAt: value(row, "last-modified") || `${year}-01-01`,
            url: "#",
            description: "Editorial best-of list from the Books of the Year spreadsheet."
          });
        }
        entries.push({ id: `${listId}-${bookId}`, listId, bookId, position: null, label: "Listed" });
      });

      addAwards(awards, bookId, row, year, sourcesMap);

      const statedCount = toInteger(value(row, "times-in-best-of-lists", "best-of-count"));
      if (statedCount !== null && statedCount !== listNames.length) {
        warnings.push(`Row ${row.__rowNumber} (${title}) says ${statedCount} list appearances; ${listNames.length} unique list names were parsed.`);
      }
    });

    const availableYears = unique(books.map((book) => book.year)).sort((a, b) => b - a);
    const year = availableYears.includes(activeYear) ? activeYear : (availableYears[0] || activeYear);

    return {
      data: {
        year,
        availableYears: availableYears.length ? availableYears : [year],
        taxonomy,
        sources: Array.from(sourcesMap.values()),
        books,
        lists: Array.from(listsMap.values()),
        entries,
        awards,
        reviews: [],
        importPresets: []
      },
      warnings
    };
  }

  function addAwards(target, bookId, row, year, sourcesMap) {
    const fields = [
      ["book-awards", "Winner"],
      ["longlisted", "Longlist"],
      ["awards", "Recognition"],
      ["shortlisted", "Shortlist"]
    ];

    fields.forEach(([field, recognition]) => {
      unique(splitListCell(value(row, field))).forEach((name) => {
        const awardId = slugify(`${name}-${year}`);
        const sourceId = slugify(name);
        if (!sourcesMap.has(sourceId)) {
          sourcesMap.set(sourceId, { id: sourceId, name, type: "Award", url: "#", note: "From the Google Sheets editorial database" });
        }
        target.push({
          id: `${bookId}-${awardId}-${slugify(recognition)}`,
          bookId,
          awardId,
          recognition,
          position: null,
          citation: "",
          award: { id: awardId, sourceId, name, category: "", year, description: "", url: "#" }
        });
      });
    });
  }

  function emptyData(year) {
    return {
      year,
      availableYears: [year],
      taxonomy: GENRES.map(([id, name], index) => ({ id, name, displayOrder: index + 1 })),
      sources: [], books: [], lists: [], entries: [], awards: [], reviews: [], importPresets: []
    };
  }

  function assertColumns(headers, required) {
    const missing = required.filter((header) => !headers.includes(header));
    if (missing.length) throw new Error(`The Books sheet is missing required columns: ${missing.join(", ")}.`);
  }

  function normalizeHeader(header) {
    return String(header || "")
      .trim()
      .toLowerCase()
      .replace(/[()]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function value(row, ...names) {
    for (const name of names) {
      const normalized = normalizeHeader(name);
      if (row[normalized] !== undefined && row[normalized] !== "") return row[normalized];
    }
    return "";
  }

  function splitListCell(input) {
    const text = String(input || "").trim();
    if (!text) return [];
    if (text.includes("|")) return text.split("|").map(cleanListValue).filter(Boolean);

    const values = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        values.push(cleanListValue(current));
        current = "";
      } else {
        current += character;
      }
    }
    values.push(cleanListValue(current));
    return values.filter(Boolean);
  }

  function cleanListValue(input) {
    return String(input || "").trim().replace(/^['"]+|['"]+$/g, "").trim();
  }

  function normalizeGenre(input) {
    const value = String(input || "").toLowerCase();
    if (!value) return "other";
    if (value.includes("literary")) return "literary-fiction";
    if (value.includes("historical fiction")) return "historical-fiction";
    if (value.includes("mystery") || value.includes("thriller") || value.includes("crime")) return "mystery-thriller";
    if (value.includes("sci-fi") || value.includes("science fiction") || value.includes("fantasy")) return "science-fantasy";
    if (value.includes("memoir")) return "memoir";
    if (value.includes("history") || value.includes("biography")) return "history-biography";
    if (value.includes("essay") || value.includes("culture")) return "essays-culture";
    if (value === "fiction") return "fiction";
    if (value.includes("nonfiction") || value.includes("non-fiction")) return "nonfiction";
    return "other";
  }

  function durableCover(row) {
    const preferred = validHttpUrl(value(row, "book-cover-url", "cover-url", "cover_image_url"));
    if (preferred) return preferred;
    const attachment = value(row, "cover-image");
    const match = attachment.match(/\((https?:\/\/[^)]+)\)/);
    return match ? validHttpUrl(match[1]) : validHttpUrl(attachment);
  }

  function inferSourceName(listName) {
    const name = String(listName || "").trim();
    const colonIndex = name.indexOf(":");
    if (colonIndex > 1 && colonIndex < 40) return name.slice(0, colonIndex).trim();
    return name;
  }

  function slugify(input) {
    return String(input || "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[’']/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function palette(seed) {
    const hue = Array.from(String(seed || "book")).reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;
    return { a: `hsl(${hue} 45% 42%)`, b: `hsl(${(hue + 36) % 360} 40% 24%)` };
  }

  function unique(values) {
    return Array.from(new Set((values || []).filter((value) => value !== null && value !== undefined && value !== "")));
  }

  function toInteger(input) {
    if (input === "" || input === null || input === undefined) return null;
    const number = Number(input);
    return Number.isFinite(number) ? Math.round(number) : null;
  }

  function toNumber(input) {
    if (input === "" || input === null || input === undefined) return null;
    const number = Number(input);
    return Number.isFinite(number) ? number : null;
  }

  function isTruthy(input) {
    return ["true", "yes", "1", "published", "y"].includes(String(input || "").trim().toLowerCase());
  }

  function validHttpUrl(input) {
    try {
      const url = new URL(String(input || "").trim());
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
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
      console.warn("The normalized spreadsheet data could not be cached.", error);
    }
  }
})();
