insert into public.sources (id, slug, name, source_type, homepage_url, notes)
values
  ('00000000-0000-0000-0000-000000000101', 'new-yorker', 'The New Yorker', 'Critic List', 'https://brooklinebooksmith.com/list/new-yorker-best-books-2025', 'Imported via bookstore-hosted list page'),
  ('00000000-0000-0000-0000-000000000102', 'nyt', 'The New York Times', 'Critic List', '#', 'Best books editorial package'),
  ('00000000-0000-0000-0000-000000000103', 'booker', 'Booker Prize', 'Award', '#', 'Main prize longlist'),
  ('00000000-0000-0000-0000-000000000104', 'nba', 'National Book Award', 'Award', '#', 'Separate fiction and nonfiction longlists'),
  ('00000000-0000-0000-0000-000000000105', 'kirkus', 'Kirkus Reviews', 'Critic List', '#', 'Genre and general year-end lists')
on conflict (slug) do update
set
  name = excluded.name,
  source_type = excluded.source_type,
  homepage_url = excluded.homepage_url,
  notes = excluded.notes;

insert into public.genres (id, slug, name, display_order)
values
  ('00000000-0000-0000-0000-000000000201', 'fiction', 'Fiction', 1),
  ('00000000-0000-0000-0000-000000000202', 'literary-fiction', 'Literary Fiction', 2),
  ('00000000-0000-0000-0000-000000000203', 'historical-fiction', 'Historical Fiction', 3),
  ('00000000-0000-0000-0000-000000000204', 'mystery-thriller', 'Mystery & Thriller', 4),
  ('00000000-0000-0000-0000-000000000205', 'science-fantasy', 'Sci-Fi & Fantasy', 5),
  ('00000000-0000-0000-0000-000000000206', 'memoir-biography', 'Memoir & Biography', 6),
  ('00000000-0000-0000-0000-000000000207', 'history-politics', 'History & Politics', 7),
  ('00000000-0000-0000-0000-000000000208', 'essays-culture', 'Essays & Culture', 8)
on conflict (slug) do update
set
  name = excluded.name,
  display_order = excluded.display_order;

insert into public.books (
  id,
  slug,
  title,
  author_name,
  publication_year,
  publication_date,
  publisher,
  book_genre,
  page_count,
  critic_score,
  user_score,
  critic_count,
  review_count,
  trend_score,
  blurb,
  cover_image_url,
  amazon_referral_url,
  goodreads_url,
  cover_color_start,
  cover_color_end
)
values
  ('00000000-0000-0000-0000-000000000301', 'northlight', 'Northlight', 'Mira Dane', 2025, '2025-02-11', 'River House', 'Novel', 352, 91, 4.4, 24, 318, 97, 'A severe winter and a vanished translator pull a fractured family into one luminous, difficult reckoning.', 'https://images.example.com/books/northlight.jpg', 'https://www.amazon.com/dp/0593000001?tag=booklist-20', 'https://www.goodreads.com/book/show/590300001-northlight', '#7b283d', '#2f2238'),
  ('00000000-0000-0000-0000-000000000302', 'salt-atlas', 'Salt Atlas', 'Priya Narang', 2025, '2025-03-04', 'Beacon Fold', 'Essays', 288, 89, 4.2, 19, 214, 88, 'An essay collection about migration, appetite, and the strange geographies of belonging.', 'https://images.example.com/books/salt-atlas.jpg', 'https://www.amazon.com/dp/0593000002?tag=booklist-20', 'https://www.goodreads.com/book/show/590300002-salt-atlas', '#1b6b74', '#123043'),
  ('00000000-0000-0000-0000-000000000303', 'lanterns-in-winter', 'Lanterns in Winter', 'Owen Mercer', 2025, '2025-01-21', 'North Passage', 'Historical Novel', 416, 86, 4.1, 16, 176, 82, 'A wartime courier carries contraband poems through a snowbound border town.', 'https://images.example.com/books/lanterns-in-winter.jpg', 'https://www.amazon.com/dp/0593000003?tag=booklist-20', 'https://www.goodreads.com/book/show/590300003-lanterns-in-winter', '#b16b2b', '#5a2b14'),
  ('00000000-0000-0000-0000-000000000304', 'republic-of-tenderness', 'Republic of Tenderness', 'Maya Saint', 2025, '2025-04-08', 'Fieldline', 'Memoir', 304, 87, 4.3, 21, 267, 90, 'A memoir about caregiving, political awakening, and the cost of staying soft in hard times.', 'https://images.example.com/books/republic-of-tenderness.jpg', 'https://www.amazon.com/dp/0593000004?tag=booklist-20', 'https://www.goodreads.com/book/show/590300004-republic-of-tenderness', '#5e314d', '#281826'),
  ('00000000-0000-0000-0000-000000000305', 'blackwater-archive', 'Blackwater Archive', 'Tessa Clarke', 2025, '2025-06-17', 'Glass Key', 'Mystery Novel', 368, 82, 4.5, 13, 401, 95, 'An archivist finds a murder ledger that predicts the next disappearance before it happens.', 'https://images.example.com/books/blackwater-archive.jpg', 'https://www.amazon.com/dp/0593000005?tag=booklist-20', 'https://www.goodreads.com/book/show/590300005-blackwater-archive', '#224844', '#111c1b'),
  ('00000000-0000-0000-0000-000000000306', 'field-notes-from-elsewhere', 'Field Notes from Elsewhere', 'Jonas Rhee', 2025, '2025-05-06', 'Common Atlas', 'Reported Nonfiction', 336, 90, 4.0, 20, 142, 79, 'A reported history of stateless communities and the bureaucracies that try to erase them.', 'https://images.example.com/books/field-notes-from-elsewhere.jpg', 'https://www.amazon.com/dp/0593000006?tag=booklist-20', 'https://www.goodreads.com/book/show/590300006-field-notes-from-elsewhere', '#2d4465', '#151b2b'),
  ('00000000-0000-0000-0000-000000000307', 'sky-below-the-river', 'Sky Below the River', 'Arun Das', 2025, '2025-06-03', 'Cinder Orbit', 'Speculative Novel', 432, 84, 4.6, 12, 388, 92, 'A tidal city built inside a canyon confronts prophecy, engineering, and class revolt.', 'https://images.example.com/books/sky-below-the-river.jpg', 'https://www.amazon.com/dp/0593000007?tag=booklist-20', 'https://www.goodreads.com/book/show/590300007-sky-below-the-river', '#2b5da7', '#0f2b5a'),
  ('00000000-0000-0000-0000-000000000308', 'house-of-small-reckonings', 'House of Small Reckonings', 'Claire Raines', 2025, '2025-02-25', 'Marl Street', 'Novel', 384, 88, 4.3, 17, 251, 85, 'Three sisters inherit a decaying inn and the ledger of every lie told inside it.', 'https://images.example.com/books/house-of-small-reckonings.jpg', 'https://www.amazon.com/dp/0593000008?tag=booklist-20', 'https://www.goodreads.com/book/show/590300008-house-of-small-reckonings', '#7d4f25', '#362115')
on conflict (slug) do update
set
  title = excluded.title,
  author_name = excluded.author_name,
  publication_year = excluded.publication_year,
  publication_date = excluded.publication_date,
  publisher = excluded.publisher,
  book_genre = excluded.book_genre,
  page_count = excluded.page_count,
  critic_score = excluded.critic_score,
  user_score = excluded.user_score,
  critic_count = excluded.critic_count,
  review_count = excluded.review_count,
  trend_score = excluded.trend_score,
  blurb = excluded.blurb,
  cover_image_url = excluded.cover_image_url,
  amazon_referral_url = excluded.amazon_referral_url,
  goodreads_url = excluded.goodreads_url,
  cover_color_start = excluded.cover_color_start,
  cover_color_end = excluded.cover_color_end;

insert into public.awards (id, source_id, slug, name, category, award_year, description, url)
values
  ('00000000-0000-0000-0000-000000000501', '00000000-0000-0000-0000-000000000103', 'booker-prize-2025', 'Booker Prize', 'Fiction', 2025, 'Primary fiction award longlist tracked in the same aggregate, with equal source weighting.', '#'),
  ('00000000-0000-0000-0000-000000000502', '00000000-0000-0000-0000-000000000104', 'national-book-award-2025-fiction', 'National Book Award', 'Fiction', 2025, 'Fiction-specific award list feeding genre views and the overall aggregate.', '#'),
  ('00000000-0000-0000-0000-000000000503', '00000000-0000-0000-0000-000000000104', 'national-book-award-2025-nonfiction', 'National Book Award', 'Nonfiction', 2025, 'Nonfiction longlist included in the year aggregate and in the nonfiction-focused taxonomy.', '#')
on conflict (slug) do update
set
  source_id = excluded.source_id,
  name = excluded.name,
  category = excluded.category,
  award_year = excluded.award_year,
  description = excluded.description,
  url = excluded.url;

insert into public.lists (
  id,
  source_id,
  award_id,
  slug,
  title,
  list_kind,
  scope,
  ranked,
  counts_toward_score,
  list_year,
  follower_count,
  source_updated_at,
  url,
  description
)
values
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000101', null, 'new-yorker-best-books-2025', 'The New Yorker Best Books of 2025', 'Best Of', 'All Books', false, true, 2025, 1280, '2025-06-29', 'https://brooklinebooksmith.com/list/new-yorker-best-books-2025', 'Unranked editorial list collecting the publication''s most notable books of the year.'),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000102', null, 'nyt-10-best-books-2025', 'The New York Times 10 Best Books of 2025', 'Best Of', 'All Books', false, true, 2025, 1620, '2025-06-22', '#', 'A compact year-end list with fiction and nonfiction titles carrying equal source weight.'),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000501', 'booker-prize-2025-longlist', 'Booker Prize 2025 Longlist', 'Longlist', 'Fiction', false, false, 2025, 1940, '2025-06-26', '#', 'Primary fiction award longlist tracked separately from best-of ranking inputs.'),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000502', 'nba-fiction-2025-longlist', 'National Book Award 2025 Longlist for Fiction', 'Longlist', 'Fiction', false, false, 2025, 910, '2025-06-18', '#', 'Fiction-specific award list displayed separately from the main best-of score.'),
  ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000503', 'nba-nonfiction-2025-longlist', 'National Book Award 2025 Longlist for Nonfiction', 'Longlist', 'Nonfiction', false, false, 2025, 840, '2025-06-12', '#', 'Nonfiction award longlist displayed separately from the main best-of score.'),
  ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000105', null, 'kirkus-best-fiction-2025', 'Kirkus Best Fiction of 2025', 'Best Of', 'Fiction', false, true, 2025, 1130, '2025-06-25', '#', 'Genre-specific critic list used to demonstrate fiction-only category pages and filtering.')
on conflict (slug) do update
set
  source_id = excluded.source_id,
  award_id = excluded.award_id,
  title = excluded.title,
  list_kind = excluded.list_kind,
  scope = excluded.scope,
  ranked = excluded.ranked,
  counts_toward_score = excluded.counts_toward_score,
  list_year = excluded.list_year,
  follower_count = excluded.follower_count,
  source_updated_at = excluded.source_updated_at,
  url = excluded.url,
  description = excluded.description;

insert into public.book_genres (id, book_id, genre_id)
values
  ('00000000-0000-0000-0000-000000000801', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000802', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000202'),
  ('00000000-0000-0000-0000-000000000803', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000208'),
  ('00000000-0000-0000-0000-000000000804', '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000805', '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000203'),
  ('00000000-0000-0000-0000-000000000806', '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000206'),
  ('00000000-0000-0000-0000-000000000807', '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000808', '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000204'),
  ('00000000-0000-0000-0000-000000000809', '00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000207'),
  ('00000000-0000-0000-0000-000000000810', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000811', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000205'),
  ('00000000-0000-0000-0000-000000000812', '00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000201'),
  ('00000000-0000-0000-0000-000000000813', '00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000202')
on conflict (book_id, genre_id) do nothing;

insert into public.book_list_appearances (id, list_id, book_id, position, appearance_label)
values
  ('00000000-0000-0000-0000-000000000601', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000301', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000602', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000302', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000603', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000303', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000604', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000304', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000605', '00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000306', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000606', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000301', null, 'Top 10'),
  ('00000000-0000-0000-0000-000000000607', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000302', null, 'Top 10'),
  ('00000000-0000-0000-0000-000000000608', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000304', null, 'Top 10'),
  ('00000000-0000-0000-0000-000000000609', '00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000308', null, 'Top 10'),
  ('00000000-0000-0000-0000-000000000610', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000301', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000611', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000303', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000612', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000307', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000613', '00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000308', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000614', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000301', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000615', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000303', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000616', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000305', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000617', '00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000308', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000618', '00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000302', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000619', '00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000304', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000620', '00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000306', null, 'Longlist'),
  ('00000000-0000-0000-0000-000000000621', '00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000301', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000622', '00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000303', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000623', '00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000305', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000624', '00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000307', null, 'Selected'),
  ('00000000-0000-0000-0000-000000000625', '00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000308', null, 'Selected')
on conflict (list_id, book_id) do nothing;

insert into public.book_awards (id, book_id, award_id, recognition, recognition_position, citation)
values
  ('00000000-0000-0000-0000-000000000701', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000501', 'Longlist', null, 'Booker Prize 2025 Longlist'),
  ('00000000-0000-0000-0000-000000000702', '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000501', 'Longlist', null, 'Booker Prize 2025 Longlist'),
  ('00000000-0000-0000-0000-000000000703', '00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000501', 'Longlist', null, 'Booker Prize 2025 Longlist'),
  ('00000000-0000-0000-0000-000000000704', '00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000501', 'Longlist', null, 'Booker Prize 2025 Longlist'),
  ('00000000-0000-0000-0000-000000000705', '00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000502', 'Longlist', null, 'National Book Award 2025 Longlist for Fiction'),
  ('00000000-0000-0000-0000-000000000706', '00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000502', 'Longlist', null, 'National Book Award 2025 Longlist for Fiction'),
  ('00000000-0000-0000-0000-000000000707', '00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000502', 'Longlist', null, 'National Book Award 2025 Longlist for Fiction'),
  ('00000000-0000-0000-0000-000000000708', '00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000502', 'Longlist', null, 'National Book Award 2025 Longlist for Fiction'),
  ('00000000-0000-0000-0000-000000000709', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000503', 'Longlist', null, 'National Book Award 2025 Longlist for Nonfiction'),
  ('00000000-0000-0000-0000-000000000710', '00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000503', 'Longlist', null, 'National Book Award 2025 Longlist for Nonfiction'),
  ('00000000-0000-0000-0000-000000000711', '00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000503', 'Longlist', null, 'National Book Award 2025 Longlist for Nonfiction')
on conflict (book_id, award_id, recognition) do nothing;
