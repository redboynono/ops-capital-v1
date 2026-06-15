-- OPS Alpha · X OAuth 2.0 user tokens (PKCE)

create table if not exists social_x_oauth (
  id            tinyint      not null primary key default 1,
  access_token  text         not null,
  refresh_token text         null,
  expires_at    datetime(3)  null,
  scope         varchar(512) null,
  updated_at    datetime(3)  not null default current_timestamp(3) on update current_timestamp(3),
  constraint chk_social_x_oauth_single check (id = 1)
);
