(function () {
  const DATA_SOURCE_LOCAL = "local";
  const DATA_SOURCE_SUPABASE = "supabase";

  window.BOOKLIST_DATA_ACCESS = {
    loadAppData
  };

  async function loadAppData(options) {
    const seedData = normalizeSeedData(options.seedData || window.BOOKLIST_DATA || {});
    const client = window.supabaseClient && typeof window.supabaseClient.from === "function"
      ? window.supabaseClient
      : null;

    if (!client) {
      return {
        data: seedData,
        source: DATA_SOURCE_LOCAL,
        reason: "missing-config"
      };
    }

    try {
      const availableYears = await fetchAvailableYears(client, seedData);
      const requestedYear = Number(options.requestedYear);
      const activeYear = pickActiveYear(requestedYear, availableYears, seedData.year);
      const supabaseData = await fetchYearDataset(client, activeYear, seedData);

      return {
        data: {
          ...supabaseData,
          availableYears
        },
        source: DATA_SOURCE_SUPABASE,
        reason: "configured"
      };
    } catch (error) {
      console.warn("Falling back to local book data because Supabase could not be loaded.", error);
      return {
        data: seedData,
        source: DATA_SOURCE_LOCAL,
        reason: "query-error",
        error
      };
    }
  }

  function normalizeSeedData(seedData) {
    const year = Number(seedData.year) || new Date().getFullYear();
    return {
      ...seedData,
      year,
      taxonomy: Array.isArray(seedData.taxonomy) ? seedData.taxonomy : [],
      sources: Array.isArray(seedData.sources) ? seedData.sources : [],
      books: Array.isArray(seedData.books) ? seedData.books : [],
      lists: Array.isArray(seedData.lists) ? seedData.lists : [],
      entries: Array.isArray(seedData.entries) ? seedData.entries : [],
      awards: Array.isArray(seedData.awards) ? seedData.awards : [],
      reviews: Array.isArray(seedData.reviews) ? seedData.reviews : [],
      importPresets: Array.isArray(seedData.importPresets) ? seedData.importPresets : [],
      availableYears: Array.isArray(seedData.availableYears) && seedData.availableYears.length
        ? seedData.availableYears
        : [year, year - 1, year - 2]
    };
  }

  async function selectRows(client, table, options) {
    let query = client.from(table).select(options.select || "*");

    (options.filters || []).forEach((filter) => {
      if (!filter || !filter.column || !filter.operator) {
        return;
      }

      if (filter.operator === "in") {
        const values = Array.isArray(filter.value) ? filter.value.filter(Boolean) : [];
        if (!values.length) {
          return;
        }
        query = query.in(filter.column, values);
        return;
      }

      if (filter.value === undefined || filter.value === null || filter.value === "") {
        return;
      }

      if (filter.operator === "eq") {
        query = query.eq(filter.column, filter.value);
      }
    });

    if (options.order && options.order.column) {
      query = query.order(options.order.column, { ascending: Boolean(options.order.ascending) });
    }

    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Supabase query failed for ${table}: ${error.message}`);
    }

    return data || [];
  }

  async function fetchAvailableYears(client, seedData) {
    const rows = await selectRows(client, "lists", {
      select: "list_year",
      order: { column: "list_year", ascending: false },
      limit: 500
    });

    const years = Array.from(
      new Set(
        rows
          .map((row) => Number(row.list_year))
          .filter(Boolean)
      )
    );

    return years.length ? years : seedData.availableYears;
  }

  function pickActiveYear(requestedYear, availableYears, fallbackYear) {
    if (requestedYear && availableYears.includes(requestedYear)) {
      return requestedYear;
    }

    return availableYears[0] || fallbackYear;
  }

  async function fetchYearDataset(client, year, seedData) {
    // Home, Books, Genres, and Search all depend on the same year-scoped aggregate:
    // lists -> book_list_appearances -> books, plus book_genres -> genres and sources for labels/context.
    const [genres, lists, awards] = await Promise.all([
      fetchGenres(client),
      fetchListsForYear(client, year),
      fetchAwardsForYear(client, year)
    ]);

    const [appearances, bookAwards] = await Promise.all([
      fetchAppearancesForLists(client, lists.map((list) => list.id)),
      fetchBookAwardsForAwards(client, awards.map((award) => award.id))
    ]);

    const sourceIds = uniqueValues(
      lists.map((list) => list.source_id).concat(awards.map((award) => award.source_id)).filter(Boolean)
    );
    const bookIds = uniqueValues(
      appearances.map((appearance) => appearance.book_id).concat(bookAwards.map((award) => award.book_id)).filter(Boolean)
    );

    const [sources, books, bookGenres] = await Promise.all([
      fetchSourcesByIds(client, sourceIds),
      fetchBooksByIds(client, bookIds),
      fetchBookGenresForBooks(client, bookIds)
    ]);

    // Book detail pages also hydrate book_awards -> awards so the existing recognition section can show database-backed awards.
    // List and Awards pages reuse the same lists/sources/appearances dataset, with award-related lists filtered in the UI layer.
    return mapSupabaseDataToAppShape({
      year,
      seedData,
      genres,
      sources,
      books,
      lists,
      appearances,
      awards,
      bookAwards,
      bookGenres
    });
  }

  function uniqueValues(values) {
    return Array.from(new Set((values || []).filter(Boolean)));
  }

  async function fetchGenres(client) {
    return selectRows(client, "genres", {
      select: "id,slug,name,display_order",
      order: { column: "display_order", ascending: true },
      limit: 500
    });
  }

  async function fetchSourcesByIds(client, sourceIds) {
    if (!sourceIds.length) {
      return [];
    }

    return selectRows(client, "sources", {
      select: "id,slug,name,source_type,homepage_url,notes",
      filters: [{ column: "id", operator: "in", value: sourceIds }],
      limit: 500
    });
  }

  async function fetchListsForYear(client, year) {
    return selectRows(client, "lists", {
      select: "id,source_id,award_id,slug,title,list_kind,scope,ranked,counts_toward_score,list_year,follower_count,source_updated_at,url,description",
      filters: [{ column: "list_year", operator: "eq", value: year }],
      order: { column: "source_updated_at", ascending: false },
      limit: 1000
    });
  }

  async function fetchAppearancesForLists(client, listIds) {
    if (!listIds.length) {
      return [];
    }

    return selectRows(client, "book_list_appearances", {
      select: "id,list_id,book_id,position,appearance_label",
      filters: [{ column: "list_id", operator: "in", value: listIds }],
      limit: 5000
    });
  }

  async function fetchAwardsForYear(client, year) {
    return selectRows(client, "awards", {
      select: "id,source_id,slug,name,category,award_year,description,url",
      filters: [{ column: "award_year", operator: "eq", value: year }],
      limit: 1000
    });
  }

  async function fetchBookAwardsForAwards(client, awardIds) {
    if (!awardIds.length) {
      return [];
    }

    return selectRows(client, "book_awards", {
      select: "id,book_id,award_id,recognition,recognition_position,citation",
      filters: [{ column: "award_id", operator: "in", value: awardIds }],
      limit: 5000
    });
  }

  async function fetchBooksByIds(client, bookIds) {
    if (!bookIds.length) {
      return [];
    }

    return selectRows(client, "books", {
      select: "id,slug,title,author_name,publication_year,publication_date,publisher,book_genre,page_count,critic_score,user_score,critic_count,review_count,trend_score,blurb,cover_image_url,amazon_referral_url,goodreads_url,cover_color_start,cover_color_end",
      filters: [{ column: "id", operator: "in", value: bookIds }],
      limit: 5000
    });
  }

  async function fetchBookGenresForBooks(client, bookIds) {
    if (!bookIds.length) {
      return [];
    }

    return selectRows(client, "book_genres", {
      select: "book_id,genre:genres(id,slug,name,display_order)",
      filters: [{ column: "book_id", operator: "in", value: bookIds }],
      limit: 5000
    });
  }

  function mapSupabaseDataToAppShape(payload) {
    const taxonomy = payload.genres.map((genre) => ({
      id: genre.slug,
      dbId: genre.id,
      name: genre.name,
      displayOrder: Number(genre.display_order) || 0
    }));

    const taxonomyByDbId = new Map(payload.genres.map((genre) => [genre.id, genre.slug]));

    const sources = payload.sources.map((source) => ({
      id: source.slug,
      dbId: source.id,
      name: source.name,
      type: source.source_type,
      url: source.homepage_url || "#",
      note: source.notes || ""
    }));

    const sourcesByDbId = new Map(sources.map((source) => [source.dbId, source]));

    const lists = payload.lists.map((list) => ({
      id: list.slug,
      dbId: list.id,
      sourceId: sourcesByDbId.get(list.source_id)?.id || list.source_id,
      title: list.title,
      kind: list.list_kind,
      scope: list.scope || "All Books",
      ranked: Boolean(list.ranked),
      countsTowardScore: Boolean(list.counts_toward_score),
      year: Number(list.list_year) || payload.year,
      followers: Number(list.follower_count) || 0,
      updatedAt: list.source_updated_at || `${payload.year}-01-01`,
      url: list.url || "#",
      description: list.description || ""
    }));

    const listIdByDbId = new Map(lists.map((list) => [list.dbId, list.id]));

    const bookGenresByBookId = new Map();
    payload.bookGenres.forEach((row) => {
      const mappedGenreId = row.genre && taxonomyByDbId.get(row.genre.id);
      if (!mappedGenreId) {
        return;
      }

      if (!bookGenresByBookId.has(row.book_id)) {
        bookGenresByBookId.set(row.book_id, []);
      }

      bookGenresByBookId.get(row.book_id).push({
        id: mappedGenreId,
        displayOrder: Number(row.genre.display_order) || 0
      });
    });

    const books = payload.books.map((book) => {
      const genres = (bookGenresByBookId.get(book.id) || [])
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((genre) => genre.id);

      return {
        id: book.slug,
        dbId: book.id,
        slug: book.slug,
        title: book.title,
        author: book.author_name,
        year: Number(book.publication_year) || payload.year,
        published: book.publication_date || `${payload.year}-01-01`,
        publisher: book.publisher || "Publisher TBD",
        format: book.book_genre || "Book",
        pages: book.page_count ? Number(book.page_count) : null,
        genres,
        criticScore: book.critic_score === null ? null : Number(book.critic_score),
        userScore: book.user_score === null ? null : Number(book.user_score),
        criticCount: book.critic_count === null ? null : Number(book.critic_count),
        reviewCount: book.review_count === null ? null : Number(book.review_count),
        trendScore: book.trend_score === null ? null : Number(book.trend_score),
        blurb: book.blurb || "",
        coverImage: book.cover_image_url || "",
        amazonReferralUrl: book.amazon_referral_url || "",
        goodreadsUrl: book.goodreads_url || "",
        cover: {
          a: book.cover_color_start || "",
          b: book.cover_color_end || ""
        }
      };
    });

    const booksByDbId = new Map(books.map((book) => [book.dbId, book]));

    const entries = payload.appearances
      .map((appearance) => {
        const book = booksByDbId.get(appearance.book_id);
        const listId = listIdByDbId.get(appearance.list_id);
        if (!book || !listId) {
          return null;
        }

        return {
          id: appearance.id,
          listId,
          bookId: book.id,
          position: appearance.position === null ? null : Number(appearance.position),
          label: appearance.appearance_label || "Listed"
        };
      })
      .filter(Boolean);

    const awardsByDbId = new Map(
      payload.awards.map((award) => [
        award.id,
        {
          id: award.slug,
          dbId: award.id,
          sourceId: sourcesByDbId.get(award.source_id)?.id || award.source_id,
          name: award.name,
          category: award.category || "",
          year: Number(award.award_year) || payload.year,
          description: award.description || "",
          url: award.url || "#"
        }
      ])
    );

    const awardRecognitions = payload.bookAwards
      .map((bookAward) => {
        const book = booksByDbId.get(bookAward.book_id);
        const award = awardsByDbId.get(bookAward.award_id);
        if (!book || !award) {
          return null;
        }

        return {
          id: bookAward.id,
          bookId: book.id,
          awardId: award.id,
          recognition: bookAward.recognition,
          position: bookAward.recognition_position === null ? null : Number(bookAward.recognition_position),
          citation: bookAward.citation || "",
          award
        };
      })
      .filter(Boolean);

    return {
      year: payload.year,
      availableYears: payload.seedData.availableYears,
      taxonomy,
      sources,
      books,
      lists,
      entries,
      awards: awardRecognitions,
      reviews: payload.seedData.reviews,
      importPresets: payload.seedData.importPresets
    };
  }
})();
