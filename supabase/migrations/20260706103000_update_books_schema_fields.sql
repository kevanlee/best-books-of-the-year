do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'books'
      and column_name = 'cover_url'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'books'
        and column_name = 'cover_image_url'
    ) then
      update public.books
      set cover_image_url = coalesce(cover_image_url, cover_url)
      where cover_url is not null;

      alter table public.books drop column cover_url;
    else
      alter table public.books rename column cover_url to cover_image_url;
    end if;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'books'
      and column_name = 'book_format'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'books'
        and column_name = 'book_genre'
    ) then
      update public.books
      set book_genre = coalesce(book_genre, book_format)
      where book_format is not null;

      alter table public.books drop column book_format;
    else
      alter table public.books rename column book_format to book_genre;
    end if;
  end if;
end $$;

alter table public.books
  add column if not exists cover_image_url text,
  add column if not exists amazon_referral_url text,
  add column if not exists goodreads_url text;
