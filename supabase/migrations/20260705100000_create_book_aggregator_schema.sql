create extension if not exists pgcrypto;

create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  source_type text not null,
  homepage_url text,
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_sources_source_type on public.sources (source_type);

create table if not exists public.awards (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources (id) on delete set null,
  slug text not null unique,
  name text not null,
  category text,
  award_year integer not null,
  description text,
  url text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint awards_name_category_year_key unique (name, category, award_year)
);

create index if not exists idx_awards_source_id on public.awards (source_id);
create index if not exists idx_awards_award_year on public.awards (award_year);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  author_name text not null,
  publication_year integer,
  publication_date date,
  publisher text,
  book_format text,
  page_count integer check (page_count is null or page_count > 0),
  critic_score numeric(5, 2),
  user_score numeric(3, 2),
  critic_count integer check (critic_count is null or critic_count >= 0),
  review_count integer check (review_count is null or review_count >= 0),
  trend_score integer check (trend_score is null or trend_score between 0 and 100),
  blurb text,
  cover_color_start text,
  cover_color_end text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_books_title on public.books (title);
create index if not exists idx_books_author_name on public.books (author_name);
create index if not exists idx_books_publication_year on public.books (publication_year);

create table if not exists public.genres (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  display_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_genres_display_order on public.genres (display_order);

create table if not exists public.book_genres (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  genre_id uuid not null references public.genres (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  constraint book_genres_book_id_genre_id_key unique (book_id, genre_id)
);

create index if not exists idx_book_genres_book_id on public.book_genres (book_id);
create index if not exists idx_book_genres_genre_id on public.book_genres (genre_id);

create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete restrict,
  award_id uuid references public.awards (id) on delete set null,
  slug text not null unique,
  title text not null,
  list_kind text not null,
  scope text,
  ranked boolean not null default false,
  counts_toward_score boolean not null default true,
  list_year integer not null,
  follower_count integer check (follower_count is null or follower_count >= 0),
  source_updated_at date,
  url text,
  description text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_lists_source_id on public.lists (source_id);
create index if not exists idx_lists_award_id on public.lists (award_id);
create index if not exists idx_lists_list_year on public.lists (list_year);
create index if not exists idx_lists_list_kind on public.lists (list_kind);
create index if not exists idx_lists_counts_toward_score on public.lists (counts_toward_score);

create table if not exists public.book_list_appearances (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists (id) on delete cascade,
  book_id uuid not null references public.books (id) on delete cascade,
  position integer check (position is null or position > 0),
  appearance_label text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint book_list_appearances_list_id_book_id_key unique (list_id, book_id)
);

create index if not exists idx_book_list_appearances_list_id on public.book_list_appearances (list_id);
create index if not exists idx_book_list_appearances_book_id on public.book_list_appearances (book_id);
create index if not exists idx_book_list_appearances_position on public.book_list_appearances (position);

create table if not exists public.book_awards (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  award_id uuid not null references public.awards (id) on delete cascade,
  recognition text not null,
  recognition_position integer check (recognition_position is null or recognition_position > 0),
  citation text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint book_awards_book_id_award_id_recognition_key unique (book_id, award_id, recognition)
);

create index if not exists idx_book_awards_book_id on public.book_awards (book_id);
create index if not exists idx_book_awards_award_id on public.book_awards (award_id);
create index if not exists idx_book_awards_recognition on public.book_awards (recognition);
