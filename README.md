# Booklist 2025 Prototype

This folder now contains a local-first scaffold for a books-of-the-year aggregation site.

## Open Locally
- Open [index.html](/Users/kevanlee/Desktop/books/index.html) directly in your browser.
- This app is a plain static HTML/CSS/JavaScript site. There is no Next.js, Vite, npm, or build step.
- From there you can click into books, lists, search, and the admin importer.

## Included Pages
- [index.html](/Users/kevanlee/Desktop/books/index.html): 2025 aggregate homepage
- [book.html](/Users/kevanlee/Desktop/books/book.html): book detail page
- [list.html](/Users/kevanlee/Desktop/books/list.html): source list detail page
- [search.html](/Users/kevanlee/Desktop/books/search.html): public search
- [admin.html](/Users/kevanlee/Desktop/books/admin.html): Supabase-backed admin tools for editing books and staging list imports
- [BUILD_PLAN.md](/Users/kevanlee/Desktop/books/BUILD_PLAN.md): product and architecture plan

## Notes
- UI behavior and rendering live in [app.js](/Users/kevanlee/Desktop/books/app.js).
- The browser Supabase config lives in [supabase-config.js](/Users/kevanlee/Desktop/books/supabase-config.js).
- The Supabase client helper lives in [supabase-client.js](/Users/kevanlee/Desktop/books/supabase-client.js).
- The page data access layer lives in [data-access.js](/Users/kevanlee/Desktop/books/data-access.js).
- [app-data.js](/Users/kevanlee/Desktop/books/app-data.js) is now a deprecated fallback/reference source. The live app stops using it when Supabase config is present and queries succeed.
- Styles live in [styles.css](/Users/kevanlee/Desktop/books/styles.css).
- URL import is mocked for known sources because direct remote fetches from `file://` pages are unreliable in browsers.
- `admin.html` uses only the public anon/publishable Supabase key. If inserts or updates fail because of RLS or auth policies, the page surfaces that error instead of weakening security in frontend code.

## Supabase Setup
This app uses the Supabase browser CDN and a plain JavaScript config file. Do not use `.env.local`, a service role key, or a build step.

1. Leave the CDN script include in the HTML pages as-is.
2. Open [supabase-config.js](/Users/kevanlee/Desktop/books/supabase-config.js).
3. Paste your project values into the two fields below.

```js
window.BOOKLIST_SUPABASE_CONFIG = {
  SUPABASE_URL: "https://YOUR_PROJECT.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY"
};
```

Use only the public anon/publishable key in this static frontend.

## Data Flow
- [data-access.js](/Users/kevanlee/Desktop/books/data-access.js) loads the year-scoped dataset from Supabase and reshapes it into the same objects the current UI already expects.
- Editorial ranking is built from `book_list_appearances` joined to `lists`, and only rows where `lists.counts_toward_score = true` contribute to aggregate score and list counts.
- Book genres come from `book_genres` joined to `genres`.
- Book awards come from `book_awards` joined to `awards`.
- Book covers and outbound links now use `cover_image_url`, `amazon_referral_url`, and `goodreads_url`.

## Admin Usage
- Open [admin.html](/Users/kevanlee/Desktop/books/admin.html) in the browser after Supabase is configured.
- `Edit Books` loads all books from Supabase, lets you search and filter them, and saves updates back to `books` and `book_genres`.
- `Add Books From List` is a staged workflow: enter list details, paste the books, run match detection, review each staged row, validate, then click `Finalize Import`.
- `Finalize Import` creates or updates `sources`, `lists`, `books`, `book_list_appearances`, and `book_genres`, while trying to avoid duplicate books and duplicate list appearances.
- If your anon-key session does not have write permission under the current RLS or auth setup, the admin page will show a clear permission error and stop there.

## Supabase Ranking Query
Use only editorial list appearances for the main aggregate score by filtering to lists where `counts_toward_score = true`.

```sql
select
  b.id,
  b.slug,
  b.title,
  b.author_name,
  count(bla.id) as score_appearance_count
from public.books b
join public.book_list_appearances bla
  on bla.book_id = b.id
join public.lists l
  on l.id = bla.list_id
where l.counts_toward_score = true
group by b.id, b.slug, b.title, b.author_name
order by score_appearance_count desc, b.title asc;
```
