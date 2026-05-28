create table if not exists employees (
    id bigint generated always as identity primary key,
    name text not null,
    phone text,
    default_commission_percent numeric(6, 2) not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists services (
    id bigint generated always as identity primary key,
    name text not null,
    category text not null,
    price numeric(12, 2) not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

create table if not exists invoices (
    id bigint generated always as identity primary key,
    customer_name text not null,
    vehicle_plate text,
    notes text,
    total numeric(12, 2) not null default 0,
    total_commissions numeric(12, 2) not null default 0,
    business_net numeric(12, 2) not null default 0,
    created_at timestamptz not null default now()
);

create table if not exists invoice_lines (
    id bigint generated always as identity primary key,
    invoice_id bigint not null references invoices(id) on delete cascade,
    service_id bigint not null references services(id),
    service_name text not null,
    employee_id bigint not null references employees(id),
    employee_name text not null,
    quantity integer not null default 1,
    unit_price numeric(12, 2) not null default 0,
    commission_percent numeric(6, 2) not null default 0,
    line_total numeric(12, 2) not null default 0,
    employee_earning numeric(12, 2) not null default 0
);

create table if not exists employee_payouts (
    id bigint generated always as identity primary key,
    employee_id bigint not null references employees(id),
    employee_name text not null,
    work_date date not null,
    amount numeric(12, 2) not null default 0,
    notes text,
    created_at timestamptz not null default now()
);

create table if not exists loan_movements (
    id bigint generated always as identity primary key,
    employee_id bigint not null references employees(id),
    employee_name text not null,
    movement_date date not null,
    type text not null check (type in ('LOAN', 'REPAYMENT')),
    amount numeric(12, 2) not null default 0,
    notes text,
    created_at timestamptz not null default now()
);

insert into services (name, category, price)
select 'Lavado general', 'Autolavado', 25000
where not exists (select 1 from services where name = 'Lavado general');

insert into services (name, category, price)
select 'Monta llanta', 'Monta llantas', 12000
where not exists (select 1 from services where name = 'Monta llanta');

insert into services (name, category, price)
select 'Revision mecanica', 'Mecanica', 40000
where not exists (select 1 from services where name = 'Revision mecanica');

alter table employees enable row level security;
alter table services enable row level security;
alter table invoices enable row level security;
alter table invoice_lines enable row level security;
alter table employee_payouts enable row level security;
alter table loan_movements enable row level security;

drop policy if exists "allow browser app employees" on employees;
drop policy if exists "allow browser app services" on services;
drop policy if exists "allow browser app invoices" on invoices;
drop policy if exists "allow browser app invoice lines" on invoice_lines;
drop policy if exists "allow browser app payouts" on employee_payouts;
drop policy if exists "allow browser app loans" on loan_movements;

create policy "allow browser app employees" on employees for all using (true) with check (true);
create policy "allow browser app services" on services for all using (true) with check (true);
create policy "allow browser app invoices" on invoices for all using (true) with check (true);
create policy "allow browser app invoice lines" on invoice_lines for all using (true) with check (true);
create policy "allow browser app payouts" on employee_payouts for all using (true) with check (true);
create policy "allow browser app loans" on loan_movements for all using (true) with check (true);
