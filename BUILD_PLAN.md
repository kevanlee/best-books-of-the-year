# Booklist 2025 Build Plan

## Goal
Build a books equivalent of Album of the Year: a site that aggregates the best books of 2025 from critic lists, major awards, and longlists, with public search and a private admin workflow for ingesting new lists.

## Locked v1 Decisions
- Coverage: 2025 only
- Source weighting: every aggregation source carries equal weight
- Included source types: critic lists, awards, longlists
- Excluded source types: reader polls
- Taxonomy: small normalized set
- Public search: yes in v1
- Admin area: single-user only
- Import modes: URL paste and manual pasted list text

## Product Shape
- Home page
  - Shows the current 2025 aggregate ranking
  - Supports genre filtering
  - Highlights major lists and source coverage
- Book page
  - Shows every source list the book appears on
  - Preserves source label, list type, and placement data
- List page
  - Shows the full contents of one source list
  - Preserves the original order when available
- Search page
  - Searches books, authors, sources, list names, and genres
- Admin importer
  - Accepts URL or raw pasted list text
  - Produces a preview before save
  - Marks exact title matches against canonical books

## Taxonomy
- Fiction
- Literary Fiction
- Historical Fiction
- Mystery & Thriller
- Sci-Fi & Fantasy
- Memoir & Biography
- History & Politics
- Essays & Culture

## Aggregate Rules
- Ranked lists
  - Score by position using descending points
- Unranked lists
  - Equal points for each included book
- Awards and longlists
  - Treated as equal-weight aggregation sources
- Reader polls
  - Fully excluded from ranking and ingestion

## Local-First Scaffold
This prototype is intentionally built to run from static HTML files opened directly from disk.

Why:
- lets you QA immediately by opening `index.html`
- avoids needing a local dev server for the first review cycle
- keeps the design and data model visible before backend work begins

Current scaffold includes:
- static multipage frontend
- embedded seed data in browser-readable JavaScript
- client-side aggregate computation
- client-side public search
- client-side import preview logic

## Production Architecture After Approval
- Frontend: Next.js App Router
- Backend: Postgres + Prisma
- Auth: simple single-user auth for admin only
- Import pipeline:
  - fetch remote URL on server
  - route to parser registry by source
  - normalize title/author/rank metadata
  - preview candidate matches
  - save canonical books and list entries

## Proposed Production Data Model
- `books`
- `authors`
- `book_authors`
- `genres`
- `book_genres`
- `sources`
- `lists`
- `list_entries`
- `ingestion_runs`
- `ingestion_candidates`

## Parser Strategy
- Known-source parsers for recurring structures
  - bookstore-hosted editorial lists
  - publication CMS pages
  - award and longlist pages
- Generic fallback parser
  - extract candidate titles and authors
  - require manual review before save
- Manual paste parser
  - support both ranked and unranked line formats

## Immediate Next Build Phase
1. Replace seed data with real 2025 source data.
2. Add more list pages and source coverage.
3. Move the importer from mocked client-side preview to a real backend ingest flow.
4. Add canonical book merge and duplicate resolution tools.
5. Add source pages and genre landing pages as dedicated routes.
