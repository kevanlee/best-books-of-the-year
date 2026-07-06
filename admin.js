(function () {
  const TAB_EDIT = "edit-books";
  const TAB_IMPORT = "add-books-from-list";
  const IMPORT_STAGES = ["parsed", "matched", "reviewed", "finalized"];
  const ROW_ACTIONS = {
    USE_EXISTING: "use_existing",
    CREATE_NEW: "create_new",
    SKIP: "skip"
  };
  const MATCH_STATUSES = {
    MATCHED: "matched_existing",
    DUPLICATE: "possible_duplicate",
    NEW: "new_book",
    REVIEW: "needs_review",
    SKIPPED: "skipped"
  };

  const state = {
    root: null,
    activeTab: TAB_EDIT,
    loading: true,
    error: "",
    books: [],
    booksById: {},
    genres: [],
    genreById: {},
    sources: [],
    sourceById: {},
    bookGenreIdsByBookId: {},
    selectedBookId: "",
    selectedBook: null,
    selectedBookLoading: false,
    bookReferences: {
      appearances: [],
      awards: []
    },
    bookFilters: {
      query: "",
      year: "all",
      genreId: "all"
    },
    bookMessage: null,
    importer: {
      message: null,
      rows: [],
      existingListMatch: null,
      summary: null,
      currentStage: "parsed",
      validationErrors: [],
      form: {
        source_name: "",
        source_website_url: "",
        list_name: "",
        list_year: String(new Date().getFullYear()),
        list_url: "",
        list_type: "Best Of",
        counts_toward_score: "true",
        pasted_books: ""
      }
    }
  };

  window.BOOKLIST_ADMIN_APP = {
    init
  };

  async function init(options) {
    state.root = options.root;
    state.activeTab = sanitizeTab(options.searchParams?.get("tab"));
    bindRootEvents();
    render();

    if (!getClient()) {
      state.loading = false;
      state.error = window.BOOKLIST_SUPABASE_BOOT_ERROR ||
        "Supabase is not configured. Add your project URL and public anon key in supabase-config.js before using admin.html.";
      render();
      return;
    }

    await loadBootstrapData();
  }

  function sanitizeTab(tab) {
    return tab === TAB_IMPORT ? TAB_IMPORT : TAB_EDIT;
  }

  function bindRootEvents() {
    if (!state.root || state.root.dataset.adminBound === "true") {
      return;
    }

    state.root.dataset.adminBound = "true";

    state.root.addEventListener("click", handleClick);
    state.root.addEventListener("input", handleInput);
    state.root.addEventListener("change", handleChange);
    state.root.addEventListener("submit", handleSubmit);
  }

  function handleClick(event) {
    const action = event.target.closest("[data-action]");
    if (!action) {
      return;
    }

    const type = action.dataset.action;

    if (type === "switch-tab") {
      state.activeTab = sanitizeTab(action.dataset.tab);
      clearTabMessage(state.activeTab);
      render();
      return;
    }

    if (type === "select-book") {
      const bookId = action.dataset.bookId;
      if (bookId && bookId !== state.selectedBookId) {
        loadSelectedBook(bookId);
      }
      return;
    }

    if (type === "close-book-editor") {
      if (action.classList.contains("admin-modal-backdrop") && event.target !== action) {
        return;
      }
      closeBookEditor();
      render();
      return;
    }

    if (type === "cancel-book-edit") {
      closeBookEditor();
      render();
      return;
    }

    if (type === "run-match") {
      runImporterMatching();
      return;
    }

    if (type === "validate-import") {
      validateImportDraft();
      return;
    }

    if (type === "finalize-import") {
      finalizeImport();
      return;
    }

    if (type === "reset-import") {
      resetImporter();
      render();
    }
  }

  function handleInput(event) {
    const target = event.target;

    if (target.matches("[data-book-filter]")) {
      const filterKey = target.dataset.bookFilter;
      state.bookFilters[filterKey] = target.value;
      render();
      return;
    }

    if (target.form?.id === "book-edit-form" && target.name === "cover_image_url") {
      updateBookCoverPreview(target.value);
      return;
    }

    if (target.matches("[data-import-field]")) {
      syncImporterListDetail(target);
      return;
    }

    if (target.matches("[data-import-paste]")) {
      state.importer.form.pasted_books = target.value;
      return;
    }

    if (target.matches("[data-row-field]")) {
      syncImportRowField(target);
      if (target.dataset.rowField === "cover_image_url") {
        updateImportRowCoverPreview(target.dataset.rowId, target.value);
      }
      return;
    }
  }

  function handleChange(event) {
    const target = event.target;

    if (target.matches("[data-row-field]")) {
      syncImportRowField(target);
      if (["action", "existing_book_id"].includes(target.dataset.rowField)) {
        render();
      }
      return;
    }

    if (target.matches("[data-row-genre]")) {
      syncImportRowGenres(target.dataset.rowId);
      return;
    }
  }

  function handleSubmit(event) {
    if (event.target.id === "book-edit-form") {
      event.preventDefault();
      saveBookEdits(new FormData(event.target));
      return;
    }

    if (event.target.id === "import-details-form") {
      event.preventDefault();
      parseImportDraft();
    }
  }

  function clearTabMessage(activeTab) {
    if (activeTab === TAB_EDIT) {
      state.bookMessage = null;
      return;
    }

    state.importer.message = null;
  }

  function getClient() {
    return window.supabaseClient && typeof window.supabaseClient.from === "function"
      ? window.supabaseClient
      : null;
  }

  // Bootstrap the admin page with the minimum shared data both tabs need.
  async function loadBootstrapData(options) {
    const preserveBookId = options?.selectedBookId || state.selectedBookId;
    state.loading = true;
    state.error = "";
    render();

    try {
      const client = getClient();
      const [books, genres, sources, bookGenres] = await Promise.all([
        fetchAllRows("books", "id,title,author_name,publication_year,cover_image_url,slug"),
        fetchAllRows("genres", "id,slug,name,display_order", { order: { column: "display_order", ascending: true } }),
        fetchAllRows("sources", "id,slug,name,homepage_url,source_type", { order: { column: "name", ascending: true } }),
        fetchAllRows("book_genres", "book_id,genre_id")
      ]);

      state.books = books
        .map(normalizeBookSummary)
        .sort((left, right) => left.title.localeCompare(right.title));
      state.booksById = Object.fromEntries(state.books.map((book) => [book.id, book]));
      state.genres = genres.slice();
      state.genreById = Object.fromEntries(state.genres.map((genre) => [genre.id, genre]));
      state.sources = sources.slice();
      state.sourceById = Object.fromEntries(state.sources.map((source) => [source.id, source]));
      state.bookGenreIdsByBookId = groupBookGenres(bookGenres);
      state.loading = false;

      const nextBookId = preserveBookId && state.booksById[preserveBookId]
        ? preserveBookId
        : "";

      state.selectedBookId = nextBookId;
      if (!nextBookId) {
        state.selectedBook = null;
        state.bookReferences = {
          appearances: [],
          awards: []
        };
      }
      render();

      if (nextBookId) {
        await loadSelectedBook(nextBookId, { silent: true });
      }
    } catch (error) {
      state.loading = false;
      state.error = formatSupabaseError(error, "load admin data");
      render();
    }
  }

  function normalizeBookSummary(row) {
    return {
      id: row.id,
      title: row.title || "",
      author: row.author_name || "",
      publicationYear: row.publication_year || "",
      coverImageUrl: row.cover_image_url || "",
      slug: row.slug || ""
    };
  }

  function groupBookGenres(rows) {
    return (rows || []).reduce((accumulator, row) => {
      if (!row.book_id || !row.genre_id) {
        return accumulator;
      }

      if (!accumulator[row.book_id]) {
        accumulator[row.book_id] = [];
      }

      if (!accumulator[row.book_id].includes(row.genre_id)) {
        accumulator[row.book_id].push(row.genre_id);
      }

      return accumulator;
    }, {});
  }

  async function fetchAllRows(table, select, options) {
    const client = getClient();
    const pageSize = options?.pageSize || 1000;
    const rows = [];
    let offset = 0;

    while (true) {
      let query = client
        .from(table)
        .select(select)
        .range(offset, offset + pageSize - 1);

      if (options?.order?.column) {
        query = query.order(options.order.column, { ascending: options.order.ascending !== false });
      }

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const chunk = data || [];
      rows.push(...chunk);

      if (chunk.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    return rows;
  }

  async function loadSelectedBook(bookId, options) {
    state.selectedBookId = bookId;
    state.selectedBookLoading = true;
    state.selectedBook = null;
    state.bookReferences = {
      appearances: [],
      awards: []
    };

    if (!options?.silent) {
      state.bookMessage = null;
    }

    render();

    try {
      const client = getClient();
      const { data, error } = await client
        .from("books")
        .select("id,title,author_name,publication_year,blurb,cover_image_url,amazon_referral_url,goodreads_url,slug")
        .eq("id", bookId)
        .single();

      if (error) {
        throw error;
      }

      const [appearances, awards] = await Promise.all([
        fetchBookAppearances(bookId),
        fetchBookAwards(bookId)
      ]);

      state.selectedBook = {
        id: data.id,
        title: data.title || "",
        author: data.author_name || "",
        publicationYear: data.publication_year || "",
        description: data.blurb || "",
        coverImageUrl: data.cover_image_url || "",
        amazonReferralUrl: data.amazon_referral_url || "",
        goodreadsUrl: data.goodreads_url || "",
        slug: data.slug || "",
        genreIds: (state.bookGenreIdsByBookId[bookId] || []).slice()
      };
      state.bookReferences = {
        appearances,
        awards
      };
      state.selectedBookLoading = false;
      render();
    } catch (error) {
      state.selectedBookLoading = false;
      state.bookMessage = {
        type: "error",
        text: formatSupabaseError(error, "load this book")
      };
      render();
    }
  }

  async function fetchBookAppearances(bookId) {
    const client = getClient();
    const { data, error } = await client
      .from("book_list_appearances")
      .select("id,list_id,position,appearance_label")
      .eq("book_id", bookId)
      .order("position", { ascending: true, nullsFirst: false });

    if (error) {
      throw error;
    }

    const appearances = data || [];
    if (!appearances.length) {
      return [];
    }

    const listIds = appearances.map((row) => row.list_id).filter(Boolean);
    const { data: lists, error: listError } = await client
      .from("lists")
      .select("id,source_id,title,list_year,url,counts_toward_score")
      .in("id", listIds);

    if (listError) {
      throw listError;
    }

    const listMap = Object.fromEntries((lists || []).map((list) => [list.id, list]));
    const sourceIds = (lists || []).map((list) => list.source_id).filter(Boolean);
    const sourceMap = await fetchSourceMap(sourceIds);

    return appearances
      .map((appearance) => {
        const list = listMap[appearance.list_id];
        return {
          id: appearance.id,
          position: appearance.position,
          note: appearance.appearance_label || "",
          listTitle: list?.title || "Unknown list",
          listYear: list?.list_year || "",
          listUrl: list?.url || "",
          countsTowardScore: Boolean(list?.counts_toward_score),
          sourceName: sourceMap[list?.source_id]?.name || "Unknown source"
        };
      })
      .sort((left, right) => {
        if (Number(right.listYear) !== Number(left.listYear)) {
          return Number(right.listYear) - Number(left.listYear);
        }
        return left.listTitle.localeCompare(right.listTitle);
      });
  }

  async function fetchBookAwards(bookId) {
    const client = getClient();
    const { data, error } = await client
      .from("book_awards")
      .select("id,award_id,recognition,recognition_position,citation")
      .eq("book_id", bookId)
      .order("recognition_position", { ascending: true, nullsFirst: false });

    if (error) {
      throw error;
    }

    const rows = data || [];
    if (!rows.length) {
      return [];
    }

    const awardIds = rows.map((row) => row.award_id).filter(Boolean);
    const { data: awards, error: awardError } = await client
      .from("awards")
      .select("id,source_id,name,category,award_year,url")
      .in("id", awardIds);

    if (awardError) {
      throw awardError;
    }

    const awardMap = Object.fromEntries((awards || []).map((award) => [award.id, award]));
    const sourceIds = (awards || []).map((award) => award.source_id).filter(Boolean);
    const sourceMap = await fetchSourceMap(sourceIds);

    return rows
      .map((row) => {
        const award = awardMap[row.award_id];
        return {
          id: row.id,
          recognition: row.recognition || "",
          position: row.recognition_position || "",
          citation: row.citation || "",
          awardName: award?.name || "Unknown award",
          awardYear: award?.award_year || "",
          category: award?.category || "",
          awardUrl: award?.url || "",
          sourceName: sourceMap[award?.source_id]?.name || "Unknown source"
        };
      })
      .sort((left, right) => Number(right.awardYear) - Number(left.awardYear));
  }

  async function fetchSourceMap(sourceIds) {
    const uniqueIds = Array.from(new Set((sourceIds || []).filter(Boolean)));
    if (!uniqueIds.length) {
      return {};
    }

    const client = getClient();
    const { data, error } = await client
      .from("sources")
      .select("id,name")
      .in("id", uniqueIds);

    if (error) {
      throw error;
    }

    return Object.fromEntries((data || []).map((source) => [source.id, source]));
  }

  async function saveBookEdits(formData) {
    if (!state.selectedBookId) {
      return;
    }

    const values = {
      title: String(formData.get("title") || "").trim(),
      author: String(formData.get("author") || "").trim(),
      publicationYear: String(formData.get("publication_year") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      coverImageUrl: String(formData.get("cover_image_url") || "").trim(),
      amazonReferralUrl: String(formData.get("amazon_referral_url") || "").trim(),
      goodreadsUrl: String(formData.get("goodreads_url") || "").trim(),
      slug: String(formData.get("slug") || "").trim(),
      genreIds: getSelectedFormCheckboxValues(formData, "genre_ids")
    };

    const errors = validateBookForm(values);
    if (errors.length) {
      state.bookMessage = {
        type: "error",
        text: errors.join(" ")
      };
      render();
      return;
    }

    try {
      const client = getClient();
      const { error } = await client
        .from("books")
        .update({
          title: values.title,
          author_name: values.author,
          publication_year: values.publicationYear ? Number(values.publicationYear) : null,
          blurb: values.description || null,
          cover_image_url: values.coverImageUrl || null,
          amazon_referral_url: values.amazonReferralUrl || null,
          goodreads_url: values.goodreadsUrl || null,
          slug: values.slug
        })
        .eq("id", state.selectedBookId);

      if (error) {
        throw error;
      }

      await syncBookGenres(state.selectedBookId, values.genreIds);
      state.bookMessage = {
        type: "success",
        text: "Book saved successfully."
      };
      await loadBootstrapData({ selectedBookId: state.selectedBookId });
    } catch (error) {
      state.bookMessage = {
        type: "error",
        text: formatSupabaseError(error, "save this book")
      };
      render();
    }
  }

  function validateBookForm(values) {
    const errors = [];

    if (!values.title) {
      errors.push("Title is required.");
    }

    if (!values.author) {
      errors.push("Author is required.");
    }

    if (!values.slug) {
      errors.push("Slug is required.");
    }

    if (values.amazonReferralUrl && !isValidUrl(values.amazonReferralUrl)) {
      errors.push("Amazon referral URL must be a valid URL.");
    }

    if (values.goodreadsUrl && !isValidUrl(values.goodreadsUrl)) {
      errors.push("Goodreads URL must be a valid URL.");
    }

    if (values.coverImageUrl && !isValidUrl(values.coverImageUrl)) {
      errors.push("Cover image URL must be a valid URL.");
    }

    if (values.publicationYear && !/^\d{4}$/.test(values.publicationYear)) {
      errors.push("Publication year must be a four-digit year.");
    }

    return errors;
  }

  async function syncBookGenres(bookId, nextGenreIds) {
    const currentGenreIds = new Set(state.bookGenreIdsByBookId[bookId] || []);
    const desiredGenreIds = Array.from(new Set((nextGenreIds || []).filter(Boolean)));
    const idsToAdd = desiredGenreIds.filter((genreId) => !currentGenreIds.has(genreId));
    const idsToRemove = Array.from(currentGenreIds).filter((genreId) => !desiredGenreIds.includes(genreId));
    const client = getClient();

    if (idsToRemove.length) {
      const { error } = await client
        .from("book_genres")
        .delete()
        .eq("book_id", bookId)
        .in("genre_id", idsToRemove);

      if (error) {
        throw error;
      }
    }

    if (idsToAdd.length) {
      const { error } = await client
        .from("book_genres")
        .upsert(
          idsToAdd.map((genreId) => ({
            book_id: bookId,
            genre_id: genreId
          })),
          { onConflict: "book_id,genre_id" }
        );

      if (error) {
        throw error;
      }
    }
  }

  function closeBookEditor() {
    state.selectedBookId = "";
    state.selectedBook = null;
    state.selectedBookLoading = false;
    state.bookReferences = {
      appearances: [],
      awards: []
    };
    state.bookMessage = null;
  }

  function syncImporterListDetail(target) {
    const key = target.dataset.importField;
    const form = target.form;

    if (!form || !key) {
      return;
    }

    if (key === "counts_toward_score") {
      form.elements.counts_toward_score.value = target.checked ? "true" : "false";
      state.importer.form.counts_toward_score = form.elements.counts_toward_score.value;
      return;
    }

    state.importer.form[key] = target.value;
  }

  // Parse pasted text into staged rows without writing anything to Supabase yet.
  async function parseImportDraft() {
    const form = document.getElementById("import-details-form");
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    const details = {
      sourceName: String(formData.get("source_name") || "").trim(),
      sourceWebsiteUrl: String(formData.get("source_website_url") || "").trim(),
      listName: String(formData.get("list_name") || "").trim(),
      listYear: String(formData.get("list_year") || "").trim(),
      listUrl: String(formData.get("list_url") || "").trim(),
      listType: String(formData.get("list_type") || "").trim(),
      countsTowardScore: String(formData.get("counts_toward_score") || "true") === "true"
    };
    const pastedBooks = String(formData.get("pasted_books") || "").trim();
    state.importer.form = {
      source_name: details.sourceName,
      source_website_url: details.sourceWebsiteUrl,
      list_name: details.listName,
      list_year: String(details.listYear),
      list_url: details.listUrl,
      list_type: details.listType,
      counts_toward_score: details.countsTowardScore ? "true" : "false",
      pasted_books: pastedBooks
    };
    const detailErrors = validateImportDetails(details, pastedBooks);

    if (detailErrors.length) {
      state.importer.message = {
        type: "error",
        text: detailErrors.join(" ")
      };
      render();
      return;
    }

    try {
      const rows = parseBooksFromText(pastedBooks);
      state.importer.rows = rows;
      state.importer.summary = null;
      state.importer.validationErrors = [];
      state.importer.currentStage = "parsed";
      state.importer.existingListMatch = await findExistingListMatch(details);
      state.importer.message = {
        type: "success",
        text: rows.length
          ? `Parsed ${rows.length} row${rows.length === 1 ? "" : "s"}. Review the staged table before matching or importing.`
          : "No book rows were parsed yet. Try one book per line in formats like “Title — Author” or “Title by Author”."
      };
      render();
    } catch (error) {
      state.importer.message = {
        type: "error",
        text: formatSupabaseError(error, "stage this list")
      };
      render();
    }
  }

  function validateImportDetails(details, pastedBooks) {
    const errors = [];

    if (!details.sourceName) {
      errors.push("Source name is required.");
    }

    if (details.sourceWebsiteUrl && !isValidUrl(details.sourceWebsiteUrl)) {
      errors.push("Source website URL must be valid.");
    }

    if (!details.listName) {
      errors.push("List name is required.");
    }

    if (!details.listYear || !/^\d{4}$/.test(details.listYear)) {
      errors.push("List year must be a four-digit year.");
    }

    if (!details.listType) {
      errors.push("List type is required.");
    }

    if (details.listUrl && !isValidUrl(details.listUrl)) {
      errors.push("List URL must be valid.");
    }

    if (!pastedBooks) {
      errors.push("Paste at least one line of book text.");
    }

    return errors;
  }

  async function findExistingListMatch(details) {
    const client = getClient();
    const listYear = Number(details.listYear);
    const { data, error } = await client
      .from("lists")
      .select("id,source_id,title,list_year,list_kind,url,counts_toward_score,slug")
      .eq("list_year", listYear);

    if (error) {
      throw error;
    }

    const slug = slugify(details.listName);
    const rows = (data || []).filter((row) => {
      return row.slug === slug || normalizeMatchText(row.title) === normalizeMatchText(details.listName);
    });
    if (!rows.length) {
      return null;
    }

    const bestMatch = rows.find((row) => normalizeMatchText(row.title) === normalizeMatchText(details.listName)) || rows[0];
    return {
      id: bestMatch.id,
      title: bestMatch.title,
      listYear: bestMatch.list_year,
      listType: bestMatch.list_kind,
      url: bestMatch.url || "",
      countsTowardScore: Boolean(bestMatch.counts_toward_score),
      sourceName: state.sourceById[bestMatch.source_id]?.name || "Existing source"
    };
  }

  function parseBooksFromText(text) {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => createDraftRow(line, index))
      .filter(Boolean);
  }

  function createDraftRow(line, index) {
    const rankMatch = line.match(/^\s*(\d+)[\.\)\-:]\s+/);
    const rank = rankMatch ? Number(rankMatch[1]) : null;
    const stripped = line.replace(/^\s*(\d+|[-*•])[\.\)\-:]?\s+/, "").trim();
    const yearMatch = stripped.match(/\b(19|20)\d{2}\b/);
    let title = stripped;
    let author = "";

    if (/\s+[—–-]\s+/.test(stripped)) {
      const parts = stripped.split(/\s+[—–-]\s+/);
      title = parts.shift() || "";
      author = parts.join(" — ").trim();
    } else {
      const byMatch = stripped.match(/^(.+?)\s+by\s+(.+)$/i);
      if (byMatch) {
        title = byMatch[1];
        author = byMatch[2];
      } else {
        const commaMatch = stripped.match(/^(.+?),\s*([^,]+)$/);
        if (commaMatch) {
          title = commaMatch[1];
          author = commaMatch[2];
        }
      }
    }

    title = cleanImportedValue(title);
    author = cleanImportedValue(author);

    if (!title) {
      return null;
    }

    if (yearMatch && !author.includes(yearMatch[0])) {
      author = author.replace(new RegExp(`\\b${yearMatch[0]}\\b`), "").trim();
    }

    return {
      id: `draft-${index + 1}-${slugify(title || line) || "row"}`,
      importedTitle: title,
      importedAuthor: author,
      title,
      author,
      publicationYear: yearMatch ? yearMatch[0] : "",
      slug: slugify(title),
      coverImageUrl: "",
      amazonReferralUrl: "",
      goodreadsUrl: "",
      selectedGenreIds: [],
      rank,
      note: "",
      action: ROW_ACTIONS.CREATE_NEW,
      existingBookId: "",
      matchCandidates: [],
      rawLine: line
    };
  }

  function cleanImportedValue(value) {
    return String(value || "")
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  // Match staged rows against the current Supabase books so duplicates can be reviewed before import.
  function runImporterMatching() {
    if (!state.importer.rows.length) {
      state.importer.message = {
        type: "error",
        text: "Parse a list first before running match detection."
      };
      render();
      return;
    }

    state.importer.rows = state.importer.rows.map((row) => {
      const matchCandidates = findMatchCandidates(row);
      const bestMatch = matchCandidates[0] || null;
      return {
        ...row,
        matchCandidates,
        existingBookId: bestMatch && bestMatch.score >= 90 ? bestMatch.id : "",
        action: bestMatch && bestMatch.score >= 90 ? ROW_ACTIONS.USE_EXISTING : ROW_ACTIONS.CREATE_NEW
      };
    });

    state.importer.currentStage = "matched";
    state.importer.validationErrors = [];
    state.importer.message = {
      type: "success",
      text: "Matching complete. Review each row, adjust actions if needed, then validate before final import."
    };
    render();
  }

  function findMatchCandidates(row) {
    const targetTitle = normalizeMatchText(row.title || row.importedTitle);
    const targetAuthor = normalizeMatchText(row.author || row.importedAuthor);

    return state.books
      .map((book) => ({
        ...book,
        score: scoreBookMatch(targetTitle, targetAuthor, book)
      }))
      .filter((book) => book.score >= 55)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }
        return left.title.localeCompare(right.title);
      })
      .slice(0, 5);
  }

  function scoreBookMatch(targetTitle, targetAuthor, book) {
    const candidateTitle = normalizeMatchText(book.title);
    const candidateAuthor = normalizeMatchText(book.author);

    if (!targetTitle || !candidateTitle) {
      return 0;
    }

    const titleExact = targetTitle === candidateTitle;
    const authorExact = targetAuthor && targetAuthor === candidateAuthor;
    const titleContained = targetTitle.includes(candidateTitle) || candidateTitle.includes(targetTitle);
    const authorContained = targetAuthor && candidateAuthor && (
      targetAuthor.includes(candidateAuthor) || candidateAuthor.includes(targetAuthor)
    );
    const titleOverlap = tokenOverlapScore(targetTitle, candidateTitle);
    const authorOverlap = tokenOverlapScore(targetAuthor, candidateAuthor);

    if (titleExact && authorExact) {
      return 100;
    }

    if (titleExact && authorContained) {
      return 94;
    }

    if (titleExact && !targetAuthor) {
      return 90;
    }

    if (titleExact) {
      return 86;
    }

    if (titleContained && authorExact) {
      return 84;
    }

    if (titleContained && authorContained) {
      return 78;
    }

    if (titleOverlap >= 0.8 && authorExact) {
      return 80;
    }

    if (titleOverlap >= 0.8 && authorOverlap >= 0.5) {
      return 74;
    }

    if (titleOverlap >= 0.72) {
      return 66;
    }

    return 0;
  }

  function tokenOverlapScore(left, right) {
    const leftTokens = new Set(String(left || "").split(" ").filter(Boolean));
    const rightTokens = new Set(String(right || "").split(" ").filter(Boolean));

    if (!leftTokens.size || !rightTokens.size) {
      return 0;
    }

    let overlap = 0;
    leftTokens.forEach((token) => {
      if (rightTokens.has(token)) {
        overlap += 1;
      }
    });

    return overlap / Math.max(leftTokens.size, rightTokens.size);
  }

  function syncImportRowField(target) {
    const row = state.importer.rows.find((item) => item.id === target.dataset.rowId);
    if (!row) {
      return;
    }

    const field = target.dataset.rowField;
    const value = target.type === "number" ? target.value.trim() : target.value;

    if (field === "rank") {
      row.rank = value ? Number(value) : null;
      return;
    }

    if (field === "publication_year") {
      row.publicationYear = value;
      return;
    }

    if (field === "existing_book_id") {
      row.existingBookId = value;
      row.action = value ? ROW_ACTIONS.USE_EXISTING : row.action;
      return;
    }

    if (field === "action") {
      row.action = value;
      if (value !== ROW_ACTIONS.USE_EXISTING) {
        row.existingBookId = value === ROW_ACTIONS.USE_EXISTING ? row.existingBookId : row.existingBookId;
      }
      return;
    }

    if (field === "slug") {
      row.slug = String(value || "").trim();
      return;
    }

    if (field === "title") {
      row.title = value;
      return;
    }

    if (field === "author") {
      row.author = value;
      return;
    }

    if (field === "note") {
      row.note = value;
      return;
    }

    if (field === "cover_image_url") {
      row.coverImageUrl = value.trim();
      return;
    }

    if (field === "amazon_referral_url") {
      row.amazonReferralUrl = value.trim();
      return;
    }

    if (field === "goodreads_url") {
      row.goodreadsUrl = value.trim();
      return;
    }
  }

  function syncImportRowGenres(rowId) {
    const wrapper = state.root.querySelector(`[data-row-genres-wrap="${rowId}"]`);
    const row = state.importer.rows.find((item) => item.id === rowId);
    if (!wrapper || !row) {
      return;
    }

    row.selectedGenreIds = Array.from(wrapper.querySelectorAll("[data-row-genre]:checked")).map((checkbox) => checkbox.value);
    render();
  }

  function validateImportDraft() {
    const validationErrors = validateImportRows(state.importer.rows);
    state.importer.validationErrors = validationErrors;

    if (validationErrors.length) {
      state.importer.currentStage = "matched";
      state.importer.message = {
        type: "error",
        text: `Review required. ${validationErrors.length} row${validationErrors.length === 1 ? "" : "s"} still need fixes before import.`
      };
      render();
      return false;
    }

    state.importer.currentStage = "reviewed";
    state.importer.message = {
      type: "success",
      text: "Validation passed. The staged rows are ready to finalize."
    };
    render();
    return true;
  }

  function validateImportRows(rows) {
    return rows.reduce((errors, row) => {
      const rowErrors = [];

      if (row.action === ROW_ACTIONS.SKIP) {
        return errors;
      }

      if (!String(row.title || "").trim()) {
        rowErrors.push("Title is required unless the row is skipped.");
      }

      if (!String(row.author || "").trim()) {
        rowErrors.push("Author is required unless the row is skipped.");
      }

      if (row.action === ROW_ACTIONS.CREATE_NEW && !String(row.slug || "").trim()) {
        rowErrors.push("Slug is required for new books.");
      }

      if (row.coverImageUrl && !isValidUrl(row.coverImageUrl)) {
        rowErrors.push("Cover image URL must be valid.");
      }

      if (row.amazonReferralUrl && !isValidUrl(row.amazonReferralUrl)) {
        rowErrors.push("Amazon referral URL must be valid.");
      }

      if (row.goodreadsUrl && !isValidUrl(row.goodreadsUrl)) {
        rowErrors.push("Goodreads URL must be valid.");
      }

      if (row.publicationYear && !/^\d{4}$/.test(String(row.publicationYear))) {
        rowErrors.push("Publication year must be a four-digit year.");
      }

      if (row.action === ROW_ACTIONS.USE_EXISTING && !row.existingBookId) {
        rowErrors.push("Choose an existing book or change the action to Create new or Skip.");
      }

      if (!Object.values(ROW_ACTIONS).includes(row.action)) {
        rowErrors.push("Choose an action for this row.");
      }

      if (rowErrors.length) {
        errors.push({
          rowId: row.id,
          title: row.title || row.importedTitle || "Untitled row",
          messages: rowErrors
        });
      }

      return errors;
    }, []);
  }

  // Finalize the staged import by creating/updating source, list, books, appearances, and genres.
  async function finalizeImport() {
    if (!validateImportDraft()) {
      return;
    }

    const form = document.getElementById("import-details-form");
    if (!form) {
      return;
    }

    const detailsData = new FormData(form);
    const details = {
      sourceName: String(detailsData.get("source_name") || "").trim(),
      sourceWebsiteUrl: String(detailsData.get("source_website_url") || "").trim(),
      listName: String(detailsData.get("list_name") || "").trim(),
      listYear: Number(detailsData.get("list_year") || new Date().getFullYear()),
      listUrl: String(detailsData.get("list_url") || "").trim(),
      listType: String(detailsData.get("list_type") || "").trim(),
      countsTowardScore: String(detailsData.get("counts_toward_score") || "true") === "true"
    };

    try {
      const summary = {
        createdBooks: 0,
        matchedBooks: 0,
        updatedBooks: 0,
        skippedRows: 0,
        addedAppearances: 0,
        duplicatesAvoided: 0
      };
      const client = getClient();
      const source = await getOrUpsertSource(details);
      const list = await getOrUpsertList(details, source.id, state.importer.existingListMatch);
      const usedSlugs = new Set(state.books.map((book) => book.slug).filter(Boolean));
      const { data: existingAppearances, error: existingAppearanceError } = await client
        .from("book_list_appearances")
        .select("id,book_id,position,appearance_label")
        .eq("list_id", list.id);

      if (existingAppearanceError) {
        throw existingAppearanceError;
      }

      const appearanceByBookId = Object.fromEntries((existingAppearances || []).map((row) => [row.book_id, row]));
      const batchBookIds = {};

      for (const row of state.importer.rows) {
        if (row.action === ROW_ACTIONS.SKIP) {
          summary.skippedRows += 1;
          continue;
        }

        const dedupeKey = `${normalizeMatchText(row.title)}::${normalizeMatchText(row.author)}`;
        let bookId = batchBookIds[dedupeKey] || "";
        let didCreateBook = false;
        let didUpdateBook = false;
        const reusedBatchBook = Boolean(bookId);

        if (!bookId) {
          const bookResult = await getOrCreateBookForImportRow(row, usedSlugs);
          bookId = bookResult.bookId;
          didCreateBook = bookResult.created;
          didUpdateBook = bookResult.updated;
          batchBookIds[dedupeKey] = bookId;
        }

        if (reusedBatchBook) {
          summary.duplicatesAvoided += 1;
        } else if (didCreateBook) {
          summary.createdBooks += 1;
        } else {
          summary.matchedBooks += 1;
        }

        if (didUpdateBook) {
          summary.updatedBooks += 1;
        }

        const existingAppearance = appearanceByBookId[bookId];
        if (existingAppearance) {
          summary.duplicatesAvoided += 1;
          if (existingAppearance.position !== row.rank || (existingAppearance.appearance_label || "") !== (row.note || "")) {
            const { error } = await client
              .from("book_list_appearances")
              .update({
                position: row.rank || null,
                appearance_label: row.note || null
              })
              .eq("id", existingAppearance.id);

            if (error) {
              throw error;
            }
          }
        } else {
          const { error } = await client
            .from("book_list_appearances")
            .insert({
              list_id: list.id,
              book_id: bookId,
              position: row.rank || null,
              appearance_label: row.note || null
            });

          if (error) {
            throw error;
          }

          summary.addedAppearances += 1;
          appearanceByBookId[bookId] = {
            book_id: bookId,
            position: row.rank || null,
            appearance_label: row.note || null
          };
        }

        await syncBookGenres(bookId, row.selectedGenreIds || []);
      }

      state.importer.currentStage = "finalized";
      state.importer.summary = summary;
      state.importer.message = {
        type: "success",
        text: "Import finalized successfully."
      };
      await loadBootstrapData({ selectedBookId: state.selectedBookId });
      render();
    } catch (error) {
      state.importer.message = {
        type: "error",
        text: formatSupabaseError(error, "finalize this import")
      };
      render();
    }
  }

  async function getOrUpsertSource(details) {
    const client = getClient();
    const slug = slugify(details.sourceName);
    const existingSource = state.sources.find((source) => {
      return normalizeMatchText(source.name) === normalizeMatchText(details.sourceName) || source.slug === slug;
    });

    if (existingSource) {
      const payload = {
        name: details.sourceName,
        slug,
        homepage_url: details.sourceWebsiteUrl || existingSource.homepage_url || null,
        source_type: existingSource.source_type || "Editorial List"
      };
      const { data, error } = await client
        .from("sources")
        .update(payload)
        .eq("id", existingSource.id)
        .select("id,slug,name,homepage_url,source_type")
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    const { data, error } = await client
      .from("sources")
      .insert({
        name: details.sourceName,
        slug,
        homepage_url: details.sourceWebsiteUrl || null,
        source_type: "Editorial List"
      })
      .select("id,slug,name,homepage_url,source_type")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function getOrUpsertList(details, sourceId, existingListMatch) {
    const client = getClient();
    const payload = {
      source_id: sourceId,
      title: details.listName,
      slug: slugify(details.listName),
      list_kind: details.listType,
      list_year: details.listYear,
      ranked: state.importer.rows.some((row) => row.action !== ROW_ACTIONS.SKIP && row.rank),
      counts_toward_score: details.countsTowardScore,
      url: details.listUrl || null,
      source_updated_at: new Date().toISOString().slice(0, 10)
    };

    if (existingListMatch?.id) {
      const { data, error } = await client
        .from("lists")
        .update(payload)
        .eq("id", existingListMatch.id)
        .select("id,title,slug,list_year")
        .single();

      if (error) {
        throw error;
      }

      return data;
    }

    const { data, error } = await client
      .from("lists")
      .insert(payload)
      .select("id,title,slug,list_year")
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  async function getOrCreateBookForImportRow(row, usedSlugs) {
    const client = getClient();

    if (row.action === ROW_ACTIONS.USE_EXISTING && row.existingBookId) {
      const existingBook = state.booksById[row.existingBookId];
      if (!existingBook) {
        throw new Error("The selected existing book could not be found.");
      }

      const payload = buildImportBookUpdatePayload(existingBook, row);
      if (Object.keys(payload).length) {
        const { error } = await client
          .from("books")
          .update(payload)
          .eq("id", row.existingBookId);

        if (error) {
          throw error;
        }
      }

      return {
        bookId: row.existingBookId,
        created: false,
        updated: Boolean(Object.keys(payload).length)
      };
    }

    const slug = ensureUniqueSlug(row.slug || slugify(row.title), usedSlugs);
    const { data, error } = await client
      .from("books")
      .insert({
        title: row.title,
        author_name: row.author,
        publication_year: row.publicationYear ? Number(row.publicationYear) : null,
        slug,
        cover_image_url: row.coverImageUrl || null,
        amazon_referral_url: row.amazonReferralUrl || null,
        goodreads_url: row.goodreadsUrl || null
      })
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    return {
      bookId: data.id,
      created: true,
      updated: false
    };
  }

  function buildImportBookUpdatePayload(existingBook, row) {
    const payload = {};

    if (row.title && row.title !== existingBook.title) {
      payload.title = row.title;
    }

    if (row.author && row.author !== existingBook.author) {
      payload.author_name = row.author;
    }

    if (row.publicationYear && Number(row.publicationYear) !== Number(existingBook.publicationYear || 0)) {
      payload.publication_year = Number(row.publicationYear);
    }

    if (row.slug && row.slug !== existingBook.slug) {
      payload.slug = row.slug;
    }

    if (row.coverImageUrl && row.coverImageUrl !== existingBook.coverImageUrl) {
      payload.cover_image_url = row.coverImageUrl;
    }

    if (row.amazonReferralUrl) {
      payload.amazon_referral_url = row.amazonReferralUrl;
    }

    if (row.goodreadsUrl) {
      payload.goodreads_url = row.goodreadsUrl;
    }

    return payload;
  }

  function ensureUniqueSlug(baseSlug, usedSlugs) {
    let nextSlug = baseSlug || `book-${Date.now()}`;
    let collision = 2;

    while (usedSlugs.has(nextSlug)) {
      nextSlug = `${baseSlug}-${collision}`;
      collision += 1;
    }

    usedSlugs.add(nextSlug);
    return nextSlug;
  }

  function resetImporter() {
    state.importer = {
      message: null,
      rows: [],
      existingListMatch: null,
      summary: null,
      currentStage: "parsed",
      validationErrors: [],
      form: {
        source_name: "",
        source_website_url: "",
        list_name: "",
        list_year: String(new Date().getFullYear()),
        list_url: "",
        list_type: "Best Of",
        counts_toward_score: "true",
        pasted_books: ""
      }
    };
  }

  function render() {
    if (!state.root) {
      return;
    }

    state.root.innerHTML = `
      <section class="page-header panel">
        <div class="page-header-main">
          <p class="eyebrow">Admin</p>
          <h1 class="detail-title">Manage books and stage list imports.</h1>
          <p class="summary">
            The public site stays untouched here. This page focuses on editing books already in Supabase and reviewing list imports before anything is written.
          </p>
          <div class="admin-tablist" role="tablist" aria-label="Admin views">
            <button class="chip ${state.activeTab === TAB_EDIT ? "is-active" : ""}" type="button" role="tab" aria-selected="${state.activeTab === TAB_EDIT}" data-action="switch-tab" data-tab="${TAB_EDIT}">
              Edit Books
            </button>
            <button class="chip ${state.activeTab === TAB_IMPORT ? "is-active" : ""}" type="button" role="tab" aria-selected="${state.activeTab === TAB_IMPORT}" data-action="switch-tab" data-tab="${TAB_IMPORT}">
              Add Books From List
            </button>
          </div>
        </div>
        <div class="page-header-side">
          <div class="score-panel">
            <span class="score-label">Catalog</span>
            <strong>${state.books.length}</strong>
            <span>${state.genres.length} genres loaded</span>
          </div>
        </div>
      </section>

      ${state.loading ? renderLoadingState() : ""}
      ${state.error ? renderMessage("error", state.error) : ""}
      ${!state.loading && !state.error ? renderActiveTab() : ""}
    `;
  }

  function renderLoadingState() {
    return `
      <section class="loading-shell" aria-live="polite">
        <p class="eyebrow">Loading</p>
        <h2 class="loading-title">Connecting admin tools…</h2>
        <p class="loading-copy">Fetching books, genres, sources, and the metadata needed for review workflows.</p>
      </section>
    `;
  }

  function renderActiveTab() {
    return state.activeTab === TAB_IMPORT ? renderImporterTab() : renderEditBooksTab();
  }

  function renderEditBooksTab() {
    const filteredBooks = getFilteredBooks();
    const years = Array.from(new Set(state.books.map((book) => book.publicationYear).filter(Boolean))).sort((left, right) => Number(right) - Number(left));

    return `
      <section class="panel admin-book-browser admin-book-browser--wide">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Browse</p>
              <h2 class="section-title">Edit Books</h2>
            </div>
            <span class="meta-line">${filteredBooks.length} matching book${filteredBooks.length === 1 ? "" : "s"} · click any row to edit</span>
          </div>
          <div class="admin-filter-grid">
            <label class="field">
              <span>Search title or author</span>
              <input class="input" type="search" value="${escapeHtml(state.bookFilters.query)}" data-book-filter="query" placeholder="Search books" />
            </label>
            <label class="field">
              <span>Publication year</span>
              <select class="select" data-book-filter="year">
                <option value="all">All years</option>
                ${years.map((year) => `<option value="${year}" ${String(year) === String(state.bookFilters.year) ? "selected" : ""}>${year}</option>`).join("")}
              </select>
            </label>
            <label class="field">
              <span>Genre</span>
              <select class="select" data-book-filter="genreId">
                <option value="all">All genres</option>
                ${state.genres.map((genre) => `<option value="${genre.id}" ${genre.id === state.bookFilters.genreId ? "selected" : ""}>${escapeHtml(genre.name)}</option>`).join("")}
              </select>
            </label>
          </div>
          <div class="admin-book-table-shell">
            ${
              filteredBooks.length
                ? `
                  <table class="admin-book-table">
                    <thead>
                      <tr>
                        <th scope="col">Cover</th>
                        <th scope="col">Title</th>
                        <th scope="col">Author</th>
                        <th scope="col">Year</th>
                        <th scope="col">Genres</th>
                        <th scope="col">Slug</th>
                        <th scope="col" class="admin-book-table-action-col">Edit</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredBooks.map((book) => renderBookRow(book)).join("")}
                    </tbody>
                  </table>
                `
                : `<div class="empty-state panel-subtle"><p>No books match the current filters.</p></div>`
            }
          </div>
      </section>
      ${renderBookEditorModal()}
    `;
  }

  function renderBookRow(book) {
    const genreNames = (state.bookGenreIdsByBookId[book.id] || [])
      .map((genreId) => state.genreById[genreId]?.name)
      .filter(Boolean);

    return `
      <tr class="admin-book-table-row ${book.id === state.selectedBookId ? "is-active" : ""}" data-action="select-book" data-book-id="${book.id}">
        <td class="admin-book-table-cover">${renderCoverPreview(book.title, book.author, book.coverImageUrl, "cover-xs")}</td>
        <td>
          <strong>${escapeHtml(book.title)}</strong>
        </td>
        <td>${escapeHtml(book.author)}</td>
        <td>${book.publicationYear ? escapeHtml(String(book.publicationYear)) : "—"}</td>
        <td>
          <span class="admin-book-tags">${genreNames.length ? genreNames.map((name) => `<span class="pill">${escapeHtml(name)}</span>`).join("") : `<span class="meta-line">No genres</span>`}</span>
        </td>
        <td><code>${escapeHtml(book.slug || "")}</code></td>
        <td class="admin-book-table-action">
          <button class="ghost-button ghost-button--small" type="button" data-action="select-book" data-book-id="${book.id}">Edit</button>
        </td>
      </tr>
    `;
  }

  function renderBookEditorModal() {
    if (!state.selectedBookId && !state.selectedBookLoading) {
      return "";
    }

    return `
      <div class="admin-modal-backdrop" data-action="close-book-editor">
        <section class="panel admin-book-editor-modal" role="dialog" aria-modal="true" aria-label="Edit book details">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Details</p>
              <h2 class="section-title">${state.selectedBook ? escapeHtml(state.selectedBook.title) : "Loading book"}</h2>
            </div>
            <button class="ghost-button ghost-button--small" type="button" data-action="close-book-editor">Close</button>
          </div>
          ${state.bookMessage ? renderMessage(state.bookMessage.type, state.bookMessage.text) : ""}
          ${state.selectedBookLoading ? `<div class="helper-box"><p class="helper-text">Loading book details…</p></div>` : renderBookEditor()}
        </section>
      </div>
    `;
  }

  function renderBookEditor() {
    if (!state.selectedBook) {
      return `<div class="helper-box"><p class="helper-text">Choose a book from the left to edit it.</p></div>`;
    }

    return `
      <form id="book-edit-form" class="admin-book-form">
        <div class="admin-book-form-layout">
          <div class="admin-book-form-main">
            <div class="field-grid">
              <label class="field">
                <span>Title</span>
                <input class="input" name="title" type="text" value="${escapeHtml(state.selectedBook.title)}" required />
              </label>
              <label class="field">
                <span>Author</span>
                <input class="input" name="author" type="text" value="${escapeHtml(state.selectedBook.author)}" required />
              </label>
              <label class="field">
                <span>Publication year</span>
                <input class="input" name="publication_year" type="number" inputmode="numeric" value="${escapeHtml(String(state.selectedBook.publicationYear || ""))}" />
              </label>
              <label class="field">
                <span>Slug</span>
                <input class="input" name="slug" type="text" value="${escapeHtml(state.selectedBook.slug)}" required />
              </label>
            </div>

            <label class="field">
              <span>Description</span>
              <textarea class="textarea" name="description">${escapeHtml(state.selectedBook.description)}</textarea>
            </label>

            <div class="field-grid">
              <label class="field">
                <span>Cover image URL</span>
                <input class="input" name="cover_image_url" type="url" value="${escapeHtml(state.selectedBook.coverImageUrl)}" />
              </label>
              <label class="field">
                <span>Amazon referral URL</span>
                <input class="input" name="amazon_referral_url" type="url" value="${escapeHtml(state.selectedBook.amazonReferralUrl)}" />
              </label>
              <label class="field">
                <span>Goodreads URL</span>
                <input class="input" name="goodreads_url" type="url" value="${escapeHtml(state.selectedBook.goodreadsUrl)}" />
              </label>
            </div>

            <section class="section">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Genres</p>
                  <h3 class="subsection-title">Book genres</h3>
                </div>
              </div>
              <div class="checkbox-grid">
                ${state.genres.map((genre) => `
                  <label class="checkbox-pill">
                    <input type="checkbox" name="genre_ids" value="${genre.id}" ${state.selectedBook.genreIds.includes(genre.id) ? "checked" : ""} />
                    <span>${escapeHtml(genre.name)}</span>
                  </label>
                `).join("")}
              </div>
            </section>

            <div class="button-row">
              <button class="button" type="submit">Save</button>
              <button class="ghost-button" type="button" data-action="cancel-book-edit">Cancel</button>
            </div>
          </div>

          <aside class="admin-book-form-side">
            <div class="admin-cover-preview" data-book-cover-preview>
              ${renderCoverPreview(state.selectedBook.title, state.selectedBook.author, state.selectedBook.coverImageUrl, "cover-lg")}
            </div>
            <section class="section">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Read only</p>
                  <h3 class="subsection-title">List appearances</h3>
                </div>
              </div>
              ${renderAppearanceList()}
            </section>
            <section class="section">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Read only</p>
                  <h3 class="subsection-title">Awards</h3>
                </div>
              </div>
              ${renderAwardList()}
            </section>
          </aside>
        </div>
      </form>
    `;
  }

  function renderAppearanceList() {
    if (!state.bookReferences.appearances.length) {
      return `<div class="helper-box"><p class="helper-text">No list appearances found for this book yet.</p></div>`;
    }

    return `
      <div class="readonly-list">
        ${state.bookReferences.appearances.map((appearance) => `
          <article class="readonly-item">
            <strong>${escapeHtml(appearance.listTitle)}</strong>
            <span class="meta-line">${escapeHtml(appearance.sourceName)}${appearance.listYear ? ` · ${appearance.listYear}` : ""}${appearance.position ? ` · Rank ${appearance.position}` : ""}</span>
            ${appearance.note ? `<span class="helper-text">${escapeHtml(appearance.note)}</span>` : ""}
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderAwardList() {
    if (!state.bookReferences.awards.length) {
      return `<div class="helper-box"><p class="helper-text">No awards found for this book yet.</p></div>`;
    }

    return `
      <div class="readonly-list">
        ${state.bookReferences.awards.map((award) => `
          <article class="readonly-item">
            <strong>${escapeHtml(award.awardName)}</strong>
            <span class="meta-line">${award.awardYear ? `${award.awardYear} · ` : ""}${escapeHtml(award.recognition)}${award.category ? ` · ${escapeHtml(award.category)}` : ""}</span>
            <span class="helper-text">${escapeHtml(award.sourceName)}${award.citation ? ` · ${escapeHtml(award.citation)}` : ""}</span>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderImporterTab() {
    const rows = state.importer.rows;
    const existingMatch = state.importer.existingListMatch;

    return `
      <section class="panel admin-import-shell">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Importer</p>
            <h2 class="section-title">Add Books From List</h2>
          </div>
        </div>
        ${state.importer.message ? renderMessage(state.importer.message.type, state.importer.message.text) : ""}
        <div class="stage-strip" aria-label="Importer stages">
          ${IMPORT_STAGES.map((stage) => `<span class="stage-chip ${isStageActive(stage) ? "is-active" : ""}">${escapeHtml(capitalize(stage))}</span>`).join("")}
        </div>

        <form id="import-details-form" class="admin-import-sections">
          <section class="panel-subtle">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Stage 1</p>
                <h3 class="subsection-title">List details</h3>
              </div>
            </div>
            <div class="field-grid">
              <label class="field">
                <span>Source name</span>
                <input class="input" data-import-field="source_name" name="source_name" type="text" placeholder="The New Yorker" value="${escapeHtml(state.importer.form.source_name)}" />
              </label>
              <label class="field">
                <span>Source website URL</span>
                <input class="input" data-import-field="source_website_url" name="source_website_url" type="url" placeholder="https://www.newyorker.com" value="${escapeHtml(state.importer.form.source_website_url)}" />
              </label>
              <label class="field">
                <span>List name</span>
                <input class="input" data-import-field="list_name" name="list_name" type="text" placeholder="Best Books of 2026" value="${escapeHtml(state.importer.form.list_name)}" />
              </label>
              <label class="field">
                <span>List year</span>
                <input class="input" data-import-field="list_year" name="list_year" type="number" inputmode="numeric" value="${escapeHtml(state.importer.form.list_year)}" />
              </label>
              <label class="field">
                <span>List URL</span>
                <input class="input" data-import-field="list_url" name="list_url" type="url" placeholder="https://example.com/best-books-2026" value="${escapeHtml(state.importer.form.list_url)}" />
              </label>
              <label class="field">
                <span>List type</span>
                <input class="input" data-import-field="list_type" name="list_type" type="text" placeholder="Best Of" value="${escapeHtml(state.importer.form.list_type)}" />
              </label>
            </div>
            <label class="checkbox-pill checkbox-pill--inline">
              <input data-import-field="counts_toward_score" type="checkbox" ${state.importer.form.counts_toward_score === "true" ? "checked" : ""} />
              <span>Counts toward score</span>
            </label>
            <input name="counts_toward_score" type="hidden" value="${escapeHtml(state.importer.form.counts_toward_score)}" />
            ${existingMatch ? `
              <div class="helper-box">
                <p class="helper-text">Existing list match found: <strong>${escapeHtml(existingMatch.title)}</strong> from ${existingMatch.listYear} (${escapeHtml(existingMatch.sourceName)}). Finalize Import will update that list instead of creating a duplicate.</p>
              </div>
            ` : ""}
          </section>

          <section class="panel-subtle">
            <div class="section-heading">
              <div>
                <p class="eyebrow">Stage 2</p>
                <h3 class="subsection-title">Paste books</h3>
              </div>
            </div>
            <label class="field">
              <span>Paste one book per line</span>
              <textarea class="textarea" data-import-paste name="pasted_books" placeholder="1. Title — Author&#10;Title by Author&#10;Title, Author">${escapeHtml(state.importer.form.pasted_books)}</textarea>
            </label>
            <div class="button-row">
              <button class="button" type="submit">Parse and stage rows</button>
              <button class="ghost-button" type="button" data-action="reset-import">Reset importer</button>
            </div>
          </section>
        </form>

        <section class="panel-subtle">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Stage 3</p>
              <h3 class="subsection-title">Match existing books</h3>
            </div>
            <div class="button-row">
              <button class="ghost-button" type="button" data-action="run-match" ${rows.length ? "" : "disabled"}>Match existing books</button>
            </div>
          </div>
          <p class="helper-text">Matching compares your staged rows to the current Supabase books by title and author so you can decide whether to reuse an existing record, create a new one, or skip it.</p>
        </section>

        <section class="panel-subtle">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Stage 4</p>
              <h3 class="subsection-title">Review and edit</h3>
            </div>
          </div>
          ${
            rows.length
              ? `
                <div class="admin-import-table">
                  ${rows.map((row) => renderImportRow(row)).join("")}
                </div>
              `
              : `<div class="helper-box"><p class="helper-text">No staged rows yet. Parse a pasted list first.</p></div>`
          }
        </section>

        <section class="panel-subtle">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Stage 5</p>
              <h3 class="subsection-title">Finalize import</h3>
            </div>
            <div class="button-row">
              <button class="ghost-button" type="button" data-action="validate-import" ${rows.length ? "" : "disabled"}>Validate review</button>
              <button class="button" type="button" data-action="finalize-import" ${rows.length ? "" : "disabled"}>Finalize Import</button>
            </div>
          </div>
          <p class="helper-text">Nothing is written to Supabase until you click Finalize Import.</p>
          ${renderImportValidationSummary()}
          ${renderImportSummary()}
        </section>
      </section>
    `;
  }

  function isStageActive(stage) {
    return IMPORT_STAGES.indexOf(stage) <= IMPORT_STAGES.indexOf(state.importer.currentStage);
  }

  function renderImportRow(row) {
    const status = getRowStatus(row);
    const selectedCandidate = row.action === ROW_ACTIONS.USE_EXISTING && row.existingBookId
      ? state.booksById[row.existingBookId]
      : null;
    const genreNames = row.selectedGenreIds
      .map((genreId) => state.genreById[genreId]?.name)
      .filter(Boolean);

    return `
      <article class="preview-item preview-item--entry admin-import-row">
        <div class="admin-import-row-head">
          <div>
            <span class="status-chip">${escapeHtml(status.label)}</span>
            <strong>${escapeHtml(row.importedTitle || row.title)}</strong>
            <span class="meta-line">Imported author: ${escapeHtml(row.importedAuthor || "Not detected")}</span>
          </div>
          <span class="meta-line">${escapeHtml(status.confidence)}</span>
        </div>

        <div class="admin-import-row-layout">
          <div class="admin-import-row-fields">
            <div class="field-grid">
              <label class="field">
                <span>Action</span>
                <select class="select" data-row-id="${row.id}" data-row-field="action">
                  <option value="${ROW_ACTIONS.USE_EXISTING}" ${row.action === ROW_ACTIONS.USE_EXISTING ? "selected" : ""}>Use existing book</option>
                  <option value="${ROW_ACTIONS.CREATE_NEW}" ${row.action === ROW_ACTIONS.CREATE_NEW ? "selected" : ""}>Create new book</option>
                  <option value="${ROW_ACTIONS.SKIP}" ${row.action === ROW_ACTIONS.SKIP ? "selected" : ""}>Skip row</option>
                </select>
              </label>
              <label class="field">
                <span>Possible existing match</span>
                <select class="select" data-row-id="${row.id}" data-row-field="existing_book_id">
                  <option value="">Choose a match</option>
                  ${row.matchCandidates.map((candidate) => `<option value="${candidate.id}" ${candidate.id === row.existingBookId ? "selected" : ""}>${escapeHtml(candidate.title)} by ${escapeHtml(candidate.author)} (${candidate.score}%)</option>`).join("")}
                </select>
              </label>
              <label class="field">
                <span>Title</span>
                <input class="input" data-row-id="${row.id}" data-row-field="title" type="text" value="${escapeHtml(row.title)}" />
              </label>
              <label class="field">
                <span>Author</span>
                <input class="input" data-row-id="${row.id}" data-row-field="author" type="text" value="${escapeHtml(row.author)}" />
              </label>
              <label class="field">
                <span>Publication year</span>
                <input class="input" data-row-id="${row.id}" data-row-field="publication_year" type="number" inputmode="numeric" value="${escapeHtml(String(row.publicationYear || ""))}" />
              </label>
              <label class="field">
                <span>Slug</span>
                <input class="input" data-row-id="${row.id}" data-row-field="slug" type="text" value="${escapeHtml(row.slug)}" />
              </label>
              <label class="field">
                <span>Cover image URL</span>
                <input class="input" data-row-id="${row.id}" data-row-field="cover_image_url" type="url" value="${escapeHtml(row.coverImageUrl)}" />
              </label>
              <label class="field">
                <span>Amazon referral URL</span>
                <input class="input" data-row-id="${row.id}" data-row-field="amazon_referral_url" type="url" value="${escapeHtml(row.amazonReferralUrl)}" />
              </label>
              <label class="field">
                <span>Goodreads URL</span>
                <input class="input" data-row-id="${row.id}" data-row-field="goodreads_url" type="url" value="${escapeHtml(row.goodreadsUrl)}" />
              </label>
              <label class="field">
                <span>Rank</span>
                <input class="input" data-row-id="${row.id}" data-row-field="rank" type="number" inputmode="numeric" value="${escapeHtml(String(row.rank || ""))}" />
              </label>
            </div>

            <label class="field">
              <span>Note</span>
              <textarea class="textarea textarea--compact" data-row-id="${row.id}" data-row-field="note">${escapeHtml(row.note)}</textarea>
            </label>

            <section class="section">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">Genres</p>
                  <h4 class="subsection-title">Selected genres</h4>
                </div>
              </div>
              <div class="checkbox-grid checkbox-grid--compact" data-row-genres-wrap="${row.id}">
                ${state.genres.map((genre) => `
                  <label class="checkbox-pill">
                    <input data-row-genre type="checkbox" value="${genre.id}" ${row.selectedGenreIds.includes(genre.id) ? "checked" : ""} />
                    <span>${escapeHtml(genre.name)}</span>
                  </label>
                `).join("")}
              </div>
              <span class="meta-line">${genreNames.length ? escapeHtml(genreNames.join(", ")) : "No genres selected"}</span>
            </section>

            ${
              selectedCandidate
                ? `<p class="helper-text">Selected existing book: <strong>${escapeHtml(selectedCandidate.title)}</strong> by ${escapeHtml(selectedCandidate.author)}</p>`
                : row.matchCandidates[0]
                  ? `<p class="helper-text">Top possible duplicate: <strong>${escapeHtml(row.matchCandidates[0].title)}</strong> by ${escapeHtml(row.matchCandidates[0].author)}</p>`
                  : `<p class="helper-text">No likely duplicate found yet.</p>`
            }
          </div>

          <aside class="admin-import-row-side">
            <div class="admin-cover-preview" data-import-cover-preview="${row.id}">
              ${renderCoverPreview(row.title, row.author, row.coverImageUrl, "cover-md")}
            </div>
            <div class="helper-box">
              <p class="helper-text">Raw line: ${escapeHtml(row.rawLine)}</p>
            </div>
          </aside>
        </div>
      </article>
    `;
  }

  function renderImportValidationSummary() {
    if (!state.importer.validationErrors.length) {
      return "";
    }

    return `
      <div class="admin-validation-list">
        ${state.importer.validationErrors.map((entry) => `
          <article class="readonly-item">
            <strong>${escapeHtml(entry.title)}</strong>
            <span class="helper-text">${escapeHtml(entry.messages.join(" "))}</span>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderImportSummary() {
    const summary = state.importer.summary;
    if (!summary) {
      return "";
    }

    return `
      <div class="admin-import-summary">
        <span class="pill">${summary.createdBooks} books created</span>
        <span class="pill">${summary.matchedBooks} books matched</span>
        <span class="pill">${summary.updatedBooks} books updated</span>
        <span class="pill">${summary.skippedRows} rows skipped</span>
        <span class="pill">${summary.addedAppearances} list appearances added</span>
        <span class="pill">${summary.duplicatesAvoided} duplicates avoided</span>
      </div>
    `;
  }

  function getRowStatus(row) {
    if (row.action === ROW_ACTIONS.SKIP) {
      return {
        key: MATCH_STATUSES.SKIPPED,
        label: "skipped",
        confidence: "Skipped"
      };
    }

    const selectedCandidate = row.existingBookId
      ? row.matchCandidates.find((candidate) => candidate.id === row.existingBookId) || null
      : null;
    const bestCandidate = selectedCandidate || row.matchCandidates[0] || null;

    if (row.action === ROW_ACTIONS.USE_EXISTING && bestCandidate) {
      return {
        key: bestCandidate.score >= 90 ? MATCH_STATUSES.MATCHED : MATCH_STATUSES.DUPLICATE,
        label: bestCandidate.score >= 90 ? "matched_existing" : "possible_duplicate",
        confidence: `${bestCandidate.score}% confidence`
      };
    }

    if (row.action === ROW_ACTIONS.CREATE_NEW && row.matchCandidates.length) {
      return {
        key: MATCH_STATUSES.DUPLICATE,
        label: "possible_duplicate",
        confidence: `${row.matchCandidates[0].score}% possible match`
      };
    }

    if (row.action === ROW_ACTIONS.CREATE_NEW) {
      return {
        key: MATCH_STATUSES.NEW,
        label: "new_book",
        confidence: "No match found"
      };
    }

    return {
      key: MATCH_STATUSES.REVIEW,
      label: "needs_review",
      confidence: "Needs review"
    };
  }

  function getFilteredBooks() {
    const query = normalizeMatchText(state.bookFilters.query);
    return state.books.filter((book) => {
      const matchesQuery = !query || normalizeMatchText(`${book.title} ${book.author}`).includes(query);
      const matchesYear = state.bookFilters.year === "all" || String(book.publicationYear) === String(state.bookFilters.year);
      const matchesGenre = state.bookFilters.genreId === "all" || (state.bookGenreIdsByBookId[book.id] || []).includes(state.bookFilters.genreId);
      return matchesQuery && matchesYear && matchesGenre;
    });
  }

  function updateBookCoverPreview(url) {
    const preview = state.root.querySelector("[data-book-cover-preview]");
    if (!preview || !state.selectedBook) {
      return;
    }

    preview.innerHTML = renderCoverPreview(state.selectedBook.title, state.selectedBook.author, String(url || "").trim(), "cover-lg");
  }

  function updateImportRowCoverPreview(rowId, url) {
    const row = state.importer.rows.find((item) => item.id === rowId);
    const preview = state.root.querySelector(`[data-import-cover-preview="${rowId}"]`);
    if (!row || !preview) {
      return;
    }

    preview.innerHTML = renderCoverPreview(row.title, row.author, String(url || "").trim(), "cover-md");
  }

  function renderCoverPreview(title, author, imageUrl, sizeClass) {
    const safeImageUrl = imageUrl && isValidUrl(imageUrl) ? imageUrl : "";
    return `
      <div class="cover ${sizeClass}" style="${coverPaletteStyle(title)}">
        ${safeImageUrl ? `<img class="cover-media" src="${escapeHtml(safeImageUrl)}" alt="${escapeHtml(title || "Book")} cover" loading="lazy" />` : ""}
        <div class="cover-label">
          <span class="cover-title">${escapeHtml(title || "Untitled")}</span>
          <span class="cover-author">${escapeHtml(author || "Unknown author")}</span>
        </div>
      </div>
    `;
  }

  function coverPaletteStyle(seed) {
    const palette = createPalette(seed);
    return `--cover-a:${palette.a};--cover-b:${palette.b};`;
  }

  function createPalette(seed) {
    const value = Array.from(String(seed || "book")).reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const hue = value % 360;
    return {
      a: `hsl(${hue} 45% 42%)`,
      b: `hsl(${(hue + 36) % 360} 40% 24%)`
    };
  }

  function renderMessage(type, text) {
    return `
      <div class="admin-message admin-message--${escapeHtml(type)}">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
  }

  function getSelectedFormCheckboxValues(formData, fieldName) {
    return formData.getAll(fieldName).map((value) => String(value || "").trim()).filter(Boolean);
  }

  function normalizeMatchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/['"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function capitalize(value) {
    return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
  }

  function isValidUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol);
    } catch (error) {
      return false;
    }
  }

  function formatSupabaseError(error, action) {
    const message = error?.message || String(error || "Unknown error");
    const normalized = message.toLowerCase();

    if (normalized.includes("row-level security") || normalized.includes("permission denied") || normalized.includes("not allowed")) {
      return `Supabase blocked the attempt to ${action} with the current anon-key permissions. This page does not use a service role key, so writes will only work if your existing RLS or auth policies allow them.`;
    }

    return `Could not ${action}. ${message}`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
