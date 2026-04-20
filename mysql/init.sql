create table if not exists users (
  id char(36) primary key,
  email varchar(255) not null unique,
  password_hash text not null,
  full_name varchar(255) null,
  password_reset_token_hash varchar(64) null,
  password_reset_expires_at datetime null,
  stripe_customer_id varchar(255) null,
  subscription_status enum('inactive', 'active') not null default 'inactive',
  subscription_end_date datetime null,
  created_at datetime not null default current_timestamp
);

create table if not exists posts (
  id char(36) primary key,
  title text not null,
  slug varchar(255) not null unique,
  excerpt text not null,
  content longtext not null,
  is_premium boolean not null default true,
  is_published boolean not null default false,
  created_at datetime not null default current_timestamp,
  author_id char(36) null,
  constraint fk_posts_author foreign key (author_id) references users(id) on delete set null
);
