drop table if exists alerts;
drop table if exists subscriptions;

create table subscriptions (
    subscription_id integer auto_increment primary key,
    endpoint        varchar(256) not null,
    p256dh          varchar(256),
    auth            varchar(256),
    created_at      datetime default current_timestamp,
    last_seen       datetime default current_timestamp
                        on update current_timestamp,
    unique key (endpoint)
);

create table alerts (
    subscription_id integer not null,
    event_id        integer not null,
    send_at         datetime,
    alert_sent      integer default 0,
    message         varchar(128),
    primary key (subscription_id, event_id),
    foreign key (subscription_id)
        references subscriptions (subscription_id)
        on delete cascade
);
create index alert_send_at on alerts(send_at);

drop table if exists tenants;
create table tenants (
	tenant_id		integer auto_increment primary key,
    name            varchar(64),
    description     varchar(256),
    location        varchar(64),
    times           varchar(64),
    icon            varchar(128),
    icon_version    integer not null default 0,
    type            varchar(32),
    outdoor         integer default 0,
    featured        integer default 0
);
create index tenants_type on tenants(type);

drop table if exists sponsors;
create table sponsors (
	sponsor_id		integer auto_increment primary key,
    name            varchar(64),
    description     varchar(512),
    website         varchar(128),
    icon            varchar(128),
    icon_version    integer not null default 0,
    tier            varchar(32)
);

drop table if exists events;
create table events (
	event_id		integer auto_increment primary key,
    type            varchar(32),
    name            varchar(64),
    description     varchar(128),
    icon            varchar(128),
    icon_version    integer not null default 0,
    location        varchar(64),
    price           varchar(64),
    start_time      datetime,
    end_time        datetime,
    duration_hrs    float,
    status          varchar(32),
    featured        integer default 0
);
create index events_type on events(type);

drop table if exists device_first_seen;
create table device_first_seen (
    device_id       varchar(64) primary key,
    first_seen      datetime default current_timestamp
);

drop table if exists vote_totals;
create table vote_totals (
    category        varchar(20),
    vendor_id       integer,
    vendor_name     varchar(100),
    vote_count      integer default 0,
    primary key     (category, vendor_id)
);

drop table if exists votes;
create table votes (
    vote_id         integer auto_increment primary key,
    device_id       varchar(64),
    vote_date       date not null default (current_date),
    category        varchar(20),
    vendor_id       integer,
    created_at      datetime default current_timestamp,
    vote_status     varchar(16),
    unique key (device_id, vote_date, category)
);

drop table if exists analytics_events;
create table analytics_events (
    id           bigint auto_increment primary key,
    event_type   varchar(32),
    event_value  varchar(64),
    device_id    varchar(64),
    created_at   datetime default current_timestamp
);

drop table if exists submitted_surveys;
create table submitted_surveys (
    survey_id      int auto_increment primary key,
    device_id      varchar(64) unique,
    submitted_at   datetime,
    comment        text
);

drop table if exists survey_answers;
create table survey_answers (
    id           int auto_increment primary key,
    survey_id    int,
    question_id  int,
    answer_id    int,
    index (survey_id)
);

drop table if exists resource;
create table resource (
  resource_id    int auto_increment primary key,
  resource       varchar(32),
  version        int not null default 1,
  updated        datetime default current_timestamp
                   on update current_timestamp
);

insert into resource (resource) values
("event"), ("tenant"), ("sponsor"),("direction"),("food"),
("music"),("artist"),("search"),("vote"),
("about"), ("ticket"), ("facility"),("first_aid"),("faq"),
("parking"),("media");

drop table if exists media;
create table media (
  media_id       int auto_increment primary key,
  name           varchar(128),
  version        int not null default 1,
  media_size     int,
  updated        datetime default current_timestamp
                   on update current_timestamp
);

drop table booth_load;
create table booth_load (
    vendor_name         varchar(64),
    vendor_id           integer,
    zone_name           varchar(32),
    zone_id             integer,
    booth_number        varchar(32),
    login_number        integer,
    latitude            double,
    longitude           double
);

drop table if exists zone;
create table zone (
    zone_id             integer auto_increment primary key,
    zone_name           varchar(64),
    zone_color          varchar(7),
    vertices            varchar(512),
    profile_version     int not null default 1,
    last_updated        datetime
                            default current_timestamp
                            on update current_timestamp
);

drop table if exists vendor;
create table vendor (
	vendor_id		    integer auto_increment primary key,
    vendor_name         varchar(64),
    description         varchar(512),
    category            varchar(128),
    booth_number        varchar(32),
    vendor_type         varchar(32),
    pin                 varchar(6),
    vendor_code         varchar(8),
    phone_number        varchar(16),
    email_address       varchar(64),
    contact_name        varchar(64),
    invite_sent         datetime,
    icon                varchar(256),
    website_url         varchar(256),
    featured_vendor     bit(1) default 0,
    featured_product_1  varchar(64),
    featured_product_2  varchar(64),
    featured_product_3  varchar(64),
    keyword_1           varchar(32),
    keyword_2           varchar(32),
    keyword_3           varchar(32),
    keyword_4           varchar(32),
    keyword_5           varchar(32),
    keyword_6           varchar(32),
    keyword_7           varchar(32),
    keyword_8           varchar(32),
    specialty_woman_owned          BIT(1) DEFAULT b'0',
    specialty_veteran_owned        BIT(1) DEFAULT b'0',
    specialty_live_demonstrations  BIT(1) DEFAULT b'0',
    specialty_kid_friendly         BIT(1) DEFAULT b'0',
    specialty_pet_products         BIT(1) DEFAULT b'0',
    specialty_organic              BIT(1) DEFAULT b'0',
    specialty_dietary_options      BIT(1) DEFAULT b'0',
    specialty_local_sourced        BIT(1) DEFAULT b'0',
    specialty_eco_friendly         BIT(1) DEFAULT b'0',
    specialty_fair_trade           BIT(1) DEFAULT b'0',
    specialty_personalized         BIT(1) DEFAULT b'0',
    specialty_custom_work          BIT(1) DEFAULT b'0',
    specialty_gift_wrapped         BIT(1) DEFAULT b'0',
    ai_keywords         varchar(1024),
    profile_complete    bit(1) default 0,
    profile_version     int not null default 1,
    active              bit(1) default 1,
    ai_generated        bit(1) default 0,
    search_index        text,
    first_updated       datetime,
    last_login          datetime,
    login_count         int not null default 0,
    last_updated        datetime
                            default current_timestamp
                            on update current_timestamp
);
alter table vendor auto_increment = 1001;

create unique index vendor_code_idx
    on vendor(vendor_code);

drop table if exists booth;
create table booth (
	booth_id		    integer auto_increment primary key,
	vendor_id           integer,
	zone_id             integer,
    booth_number        varchar(32),
    booth_type          varchar(16),
    display_order       integer,
    latitude            double,
    longitude           double,
    active              bit(1) default 1,
    profile_version     int not null default 1,
    last_updated        datetime
                            default current_timestamp
                            on update current_timestamp
);

create index idx_vendor_booth
    on booth(vendor_id);

create index idx_zone_booth
    on booth(zone_id);
