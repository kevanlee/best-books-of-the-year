# Books of the Year

A static editorial site that aggregates notable books across year-end lists and awards.

## Run locally

The Airtable API runs as a server-side Vercel Function, so do not open `index.html` directly as a `file://` URL. Run the project through Vercel's local development server:

```bash
npx vercel link
npx vercel env pull .env.local
npx vercel dev
```

During `vercel link`, select the existing `best-books-of-the-year-kevan2` project. Then open the localhost URL printed by `vercel dev`, normally `http://localhost:3000`.

The `.env.local` file contains the Airtable token pulled from Vercel. Keep it out of Git and never share or commit it.

Because the live data is loaded from Airtable through a Vercel Function, the browser must be online.

## Data source

Public data comes from three linked Airtable tables: Books, Lists, and Awards. A server-side Vercel Function reads those tables, resolves their linked records, and returns a normalized public dataset. The Airtable Personal Access Token is stored only in Vercel environment variables and is never sent to the browser.

Airtable changes normally appear on the site within 15 minutes. The server response is cached for five minutes and normalized data is cached in the browser for 15 minutes. If Airtable is temporarily unavailable, the last valid browser-cached dataset is used. Fictional seed data is never used as an undisclosed production fallback.

Required Vercel environment variables:

- `AIRTABLE_PAT`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_BOOKS_TABLE_ID`
- `AIRTABLE_LISTS_TABLE_ID`
- `AIRTABLE_AWARDS_TABLE_ID`

## Airtable structure

- Books: `Title`, `Author`, `Slug`, `Genre`, `Description`, `Amazon URL`, `Book cover URL`
- Lists: `Name`, `Slug`, `Source`, `Year`, `URL`, `Cover Photo`, `Summary`, and linked `Books`
- Awards: `Award Name`, `Award Slug`, `Award Description`, `Category`, `Year`, `Official website`, `Awarding Body`, `Award Image`, and linked `Longlist`, `Shortlist`, and `Winner`

## Editing rules

- Keep linked Books, Lists, and Awards records intact; the API joins tables using Airtable record IDs.
- Use lowercase, hyphenated, unique slugs.
- Prefer a durable `Book cover URL` for books. Airtable attachment URLs can expire.
- List membership comes from the Lists table's linked `Books` field.
- Award recognition comes from the Awards table's linked `Longlist`, `Shortlist`, and `Winner` fields.

## Runtime files

- `api/books.js`: securely loads, joins, and normalizes Airtable data.
- `data-access.js`: loads and caches the public normalized API response.
- `app.js`: renders pages and derives rankings.
- `styles.css`: shared styles.
- `app-data.js`: legacy test fixture only; public pages do not load it.
- `admin.html`: directs editors to Airtable.

## Pages

- `index.html`: aggregate Best Of ranking
- `books.html`: all books
- `book.html`: book details
- `genres.html`: genre index
- `lists.html`: derived editorial lists
- `list.html`: list details
- `awards.html`: award recognitions
- `search.html`: site search

## Ranking

The Airtable-backed ranking counts linked book-list appearances. Ranked-position weighting is not applied because the current Lists relationship does not store positions.

## Diagnostics

Open the browser console and inspect `window.BOOKLIST_RUNTIME_DETAILS` for:

- active data source
- retrieval time
- book and list counts
- normalization warnings
- load errors

Records with missing optional values continue to load. An unavailable API produces an explicit error state rather than demo records.
