-- Meera's draft bot — memory layer.
-- Paste this whole file into Supabase → SQL Editor → New query, and press Run.

create table if not exists notes (
  id                  bigint generated always as identity primary key,
  created_at          timestamptz not null default now(),
  chat_id             bigint not null,
  telegram_update_id  bigint unique,          -- stops a re-sent Telegram message being processed twice
  kind                text not null default 'text',   -- 'text' or 'voice'
  text                text not null,
  score               int,
  score_reason        text,
  status              text not null default 'received', -- received | rejected_by_score | drafted | error
  error               text
);

create table if not exists drafts (
  id                    bigint generated always as identity primary key,
  created_at            timestamptz not null default now(),
  note_id               bigint references notes(id),
  chat_id               bigint not null,
  model                 text,
  content               text not null,
  news_query            text,
  used_news             boolean not null default false,
  news_headline         text,
  news_source           text,
  news_date             text,
  news_link             text,
  status                text not null default 'pending'
                          check (status in ('pending', 'approved', 'rejected')),
  decided_at            timestamptz,
  telegram_message_ids  bigint[] not null default '{}'  -- lets Meera reply APPROVE/REJECT to the draft
);

create table if not exists voice_skill (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  content     text not null                -- the newest row is the one the bot uses
);

create index if not exists drafts_chat_status_idx on drafts (chat_id, status, created_at desc);

-- Lock the tables: only the bot's secret key (which bypasses these rules) can read or write.
alter table notes enable row level security;
alter table drafts enable row level security;
alter table voice_skill enable row level security;
