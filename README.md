# Booklist 2025 Prototype

This folder now contains a local-first scaffold for a books-of-the-year aggregation site.

## Open Locally
- Open [index.html](/Users/kevanlee/Desktop/books/index.html) in your browser.
- From there you can click into books, lists, search, and the admin importer.

## Included Pages
- [index.html](/Users/kevanlee/Desktop/books/index.html): 2025 aggregate homepage
- [book.html](/Users/kevanlee/Desktop/books/book.html): book detail page
- [list.html](/Users/kevanlee/Desktop/books/list.html): source list detail page
- [search.html](/Users/kevanlee/Desktop/books/search.html): public search
- [admin.html](/Users/kevanlee/Desktop/books/admin.html): single-user import prototype
- [BUILD_PLAN.md](/Users/kevanlee/Desktop/books/BUILD_PLAN.md): product and architecture plan

## Notes
- Data is seeded in [app-data.js](/Users/kevanlee/Desktop/books/app-data.js) for prototype purposes.
- UI behavior and rendering live in [app.js](/Users/kevanlee/Desktop/books/app.js).
- Styles live in [styles.css](/Users/kevanlee/Desktop/books/styles.css).
- URL import is mocked for known sources because direct remote fetches from `file://` pages are unreliable in browsers.
