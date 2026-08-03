# Books of the Year

A static editorial site that aggregates notable books across year-end lists and awards.

## Run locally

Open `index.html` directly in a browser. The app is plain HTML, CSS, and JavaScript with no package installation or build step.

Because the live data is loaded from Google Sheets, the browser must be online.

## Data source

Public data comes from the **books import** Google spreadsheet:

https://docs.google.com/spreadsheets/d/1L_KTNG2FuY4kphCUgb3nt7MwmoSQtzWMVnlbGGOfuIY/edit

The current canonical book data is on Sheet2 (gid `2039015008`). The site reads it through Google's public Visualization response. No API key, Supabase project, or database credentials are required.

Spreadsheet changes normally appear on the site within 15 minutes. Normalized data is cached in the browser for that period. If Google Sheets is temporarily unavailable, the last valid cached dataset is used. Fictional seed data is never used as an undisclosed production fallback.

## Required spreadsheet fields

- `Title`
- `Author`

The current importer also recognizes:

- `Genre`
- `Book Summary (AI)`
- `Book cover URL`
- `Cover Image`
- `Amazon URL`
- `Goodreads URL`
- `Lists`
- `Times in Best Of Lists`
- `ISBN-10`
- `ISBN-13`
- `Book Awards`
- `Longlisted`
- `Awards`
- `Shortlisted`
- `Last Modified`
- `Popularity`
- `Published`

Header matching is case-insensitive and punctuation-tolerant.

## Editing rules

- Keep the spreadsheet shared as **Anyone with the link can view**.
- Use stable IDs when an `ID` column is added.
- Use lowercase, hyphenated, unique slugs when a `Slug` column is added.
- Prefer a durable `Book cover URL`. Airtable attachment URLs can expire.
- Store ISBN values as text so leading zeroes are preserved.
- Use a pipe character (`|`) between list names when possible. The loader also supports quoted comma-separated values.
- Add a `Published` column to control visibility. Blank currently counts as published; explicit false/no/0 hides a row.

## Runtime files

- `data-access.js`: loads, validates, normalizes, and caches Google Sheets data.
- `app.js`: renders pages and derives rankings.
- `styles.css`: shared styles.
- `app-data.js`: legacy test fixture only; public pages do not load it.
- `admin.html`: directs editors to the spreadsheet.

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

The initial spreadsheet-backed ranking counts unique parsed list appearances. Ranked-position weighting is not applied because the current spreadsheet does not store reliable positions.

## Diagnostics

Open the browser console and inspect `window.BOOKLIST_RUNTIME_DETAILS` for:

- active data source
- retrieval time
- book and list counts
- normalization warnings
- load errors

Rows with missing optional values continue to load. Missing required columns or an unavailable spreadsheet produce an explicit error state rather than demo records.

## Future spreadsheet structure

For accurate list metadata and ranked lists, split the workbook into three tabs:

- `Books`
- `Lists`
- `Appearances`

This avoids embedding relational data in comma-separated cells and allows sources, URLs, positions, and scoring eligibility to be modeled directly.
