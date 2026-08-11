const AIRTABLE_API_ROOT = "https://api.airtable.com/v0";
const ACTIVE_YEAR = 2025;

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

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const config = readConfig();
  if (config.missing.length) {
    return response.status(500).json({
      error: `Missing server configuration: ${config.missing.join(", ")}`
    });
  }

  try {
    const [bookRecords, listRecords, awardRecords] = await Promise.all([
      fetchTable(config.baseId, config.booksTableId, config.token),
      fetchTable(config.baseId, config.listsTableId, config.token),
      fetchTable(config.baseId, config.awardsTableId, config.token)
    ]);

    const normalized = normalizeAirtableData(bookRecords, listRecords, awardRecords);
    response.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=900");
    return response.status(200).json(normalized);
  } catch (error) {
    console.error("Airtable data request failed.", error);
    return response.status(502).json({ error: "Airtable data could not be loaded." });
  }
}

function readConfig() {
  const values = {
    token: process.env.AIRTABLE_PAT,
    baseId: process.env.AIRTABLE_BASE_ID,
    booksTableId: process.env.AIRTABLE_BOOKS_TABLE_ID,
    listsTableId: process.env.AIRTABLE_LISTS_TABLE_ID,
    awardsTableId: process.env.AIRTABLE_AWARDS_TABLE_ID
  };
  const names = {
    token: "AIRTABLE_PAT",
    baseId: "AIRTABLE_BASE_ID",
    booksTableId: "AIRTABLE_BOOKS_TABLE_ID",
    listsTableId: "AIRTABLE_LISTS_TABLE_ID",
    awardsTableId: "AIRTABLE_AWARDS_TABLE_ID"
  };
  return {
    ...values,
    missing: Object.keys(values).filter((key) => !values[key]).map((key) => names[key])
  };
}

async function fetchTable(baseId, tableId, token) {
  const records = [];
  let offset = "";

  do {
    const url = new URL(`${AIRTABLE_API_ROOT}/${encodeURIComponent(baseId)}/${encodeURIComponent(tableId)}`);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const airtableResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!airtableResponse.ok) {
      throw new Error(`Airtable returned ${airtableResponse.status} for table ${tableId}.`);
    }

    const payload = await airtableResponse.json();
    records.push(...(Array.isArray(payload.records) ? payload.records : []));
    offset = payload.offset || "";
  } while (offset);

  return records;
}

function normalizeAirtableData(bookRecords, listRecords, awardRecords) {
  const warnings = [];
  const bookIds = new Set(bookRecords.map((record) => record.id));
  const sources = new Map();

  const books = bookRecords.map((record) => {
    const fields = record.fields || {};
    const title = text(fields.Title);
    const author = text(fields.Author);
    if (!title) warnings.push(`Book record ${record.id} has no Title.`);
    if (!author) warnings.push(`Book record ${record.id}${title ? ` (${title})` : ""} has no Author.`);
    const genre = text(fields.Genre);
    const slug = slugify(fields.Slug || title) || record.id.toLowerCase();
    const coverImage = attachmentUrl(fields["Cover Image"]) || validHttpUrl(fields["Book cover URL"]);

    return {
      id: record.id,
      dbId: record.id,
      slug,
      title: title || "Untitled",
      author,
      year: ACTIVE_YEAR,
      published: `${ACTIVE_YEAR}-01-01`,
      publisher: "",
      format: genre || "Book",
      pages: null,
      genres: [normalizeGenre(genre)],
      criticScore: null,
      userScore: null,
      criticCount: null,
      reviewCount: null,
      trendScore: null,
      blurb: text(fields.Description),
      coverImage,
      amazonReferralUrl: validHttpUrl(fields["Amazon URL"]),
      goodreadsUrl: "",
      isbn10: "",
      isbn13: "",
      cover: palette(title)
    };
  });

  const lists = [];
  const entries = [];
  listRecords.forEach((record) => {
    const fields = record.fields || {};
    const title = text(fields.Name) || "Untitled list";
    const year = integer(fields.Year) || ACTIVE_YEAR;
    const sourceName = text(fields.Source) || title;
    const sourceId = slugify(sourceName) || `source-${record.id.toLowerCase()}`;
    if (!sources.has(sourceId)) {
      sources.set(sourceId, {
        id: sourceId,
        name: sourceName,
        type: "Editorial List",
        url: validHttpUrl(fields.URL) || "#",
        note: "From the Airtable editorial database"
      });
    }

    lists.push({
      id: record.id,
      sourceId,
      title,
      slug: slugify(fields.Slug || title),
      kind: "Best Of",
      scope: "All Books",
      ranked: false,
      countsTowardScore: true,
      year,
      followers: 0,
      updatedAt: `${year}-01-01`,
      url: validHttpUrl(fields.URL) || "#",
      coverImage: attachmentUrl(fields["Cover Photo"]),
      description: text(fields.Summary) || "Editorial best-of list from the Books of the Year database."
    });

    linkedIds(fields.Books).forEach((bookId) => {
      if (!bookIds.has(bookId)) {
        warnings.push(`List ${title} links to unavailable book ${bookId}.`);
        return;
      }
      entries.push({ id: `${record.id}-${bookId}`, listId: record.id, bookId, position: null, label: "Listed" });
    });
  });

  const awards = [];
  awardRecords.forEach((record) => {
    const fields = record.fields || {};
    const name = text(fields["Award Name"]) || "Untitled award";
    const year = integer(fields.Year) || ACTIVE_YEAR;
    const sourceName = text(fields["Awarding Body"]) || name;
    const sourceId = slugify(sourceName) || `award-source-${record.id.toLowerCase()}`;
    const awardId = record.id;
    const award = {
      id: awardId,
      sourceId,
      name,
      slug: slugify(fields["Award Slug"] || name),
      category: text(fields.Category),
      year,
      description: text(fields["Award Description"]),
      url: validHttpUrl(fields["Official website"]) || "#",
      image: attachmentUrl(fields["Award Image"])
    };
    if (!sources.has(sourceId)) {
      sources.set(sourceId, {
        id: sourceId,
        name: sourceName,
        type: "Award",
        url: award.url,
        note: "From the Airtable editorial database"
      });
    }

    [
      ["Longlist", "Longlist"],
      ["Shortlist", "Shortlist"],
      ["Winner", "Winner"]
    ].forEach(([fieldName, recognition]) => {
      linkedIds(fields[fieldName]).forEach((bookId) => {
        if (!bookIds.has(bookId)) {
          warnings.push(`${name} ${recognition} links to unavailable book ${bookId}.`);
          return;
        }
        awards.push({
          id: `${bookId}-${awardId}-${slugify(recognition)}`,
          bookId,
          awardId,
          recognition,
          position: null,
          citation: "",
          award
        });
      });
    });
  });

  const availableYears = unique([
    ...books.map((book) => book.year),
    ...lists.map((list) => list.year),
    ...awards.map((recognition) => recognition.award.year)
  ]).sort((left, right) => right - left);

  return {
    data: {
      year: availableYears.includes(ACTIVE_YEAR) ? ACTIVE_YEAR : (availableYears[0] || ACTIVE_YEAR),
      availableYears: availableYears.length ? availableYears : [ACTIVE_YEAR],
      taxonomy: GENRES.map(([id, name], index) => ({ id, name, displayOrder: index + 1 })),
      sources: Array.from(sources.values()),
      books,
      lists,
      entries,
      awards,
      reviews: [],
      importPresets: []
    },
    warnings
  };
}

function text(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  if (value && typeof value === "object") return text(value.name || value.value || "");
  return value === null || value === undefined ? "" : String(value).trim();
}

function linkedIds(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.startsWith("rec")) : [];
}

function attachmentUrl(value) {
  if (!Array.isArray(value) || !value.length) return "";
  return validHttpUrl(value[0] && value[0].url);
}

function integer(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function normalizeGenre(input) {
  const value = text(input).toLowerCase();
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

function slugify(input) {
  return text(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function palette(seed) {
  const hue = Array.from(text(seed) || "book").reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;
  return { a: `hsl(${hue} 45% 42%)`, b: `hsl(${(hue + 36) % 360} 40% 24%)` };
}

function validHttpUrl(input) {
  try {
    const url = new URL(text(input));
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch (error) {
    return "";
  }
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== null && value !== undefined && value !== "")));
}
