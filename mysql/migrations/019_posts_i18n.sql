-- Optional English title & excerpt for analysis posts (P3 i18n)
ALTER TABLE posts
  ADD COLUMN title_en VARCHAR(512) NULL AFTER title,
  ADD COLUMN excerpt_en TEXT NULL AFTER excerpt;
