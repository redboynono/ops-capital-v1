create table if not exists bookmarks (
  user_id char(36) not null,
  post_id char(36) not null,
  created_at datetime not null default current_timestamp,
  primary key (user_id, post_id),
  key idx_bookmarks_user_created (user_id, created_at),
  constraint fk_bookmarks_user foreign key (user_id) references users(id) on delete cascade,
  constraint fk_bookmarks_post foreign key (post_id) references posts(id) on delete cascade
);

create table if not exists reading_history (
  user_id char(36) not null,
  post_id char(36) not null,
  read_at datetime not null default current_timestamp,
  primary key (user_id, post_id),
  key idx_history_user_read_at (user_id, read_at),
  constraint fk_history_user foreign key (user_id) references users(id) on delete cascade,
  constraint fk_history_post foreign key (post_id) references posts(id) on delete cascade
);
