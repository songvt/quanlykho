-- Isolated data model for exam campaigns. These tables deliberately do not
-- reference products, transactions, or inventory tables used by GGS warehouse.
create table if not exists public.exam_campaigns (
    id uuid primary key default gen_random_uuid(),
    campaign_code text not null unique check (btrim(campaign_code) <> ''),
    campaign_name text not null check (btrim(campaign_name) <> ''),
    description text,
    status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'CLOSED')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.exam_sites (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.exam_campaigns(id) on delete cascade,
    site_code text not null check (btrim(site_code) <> ''),
    site_name text not null check (btrim(site_name) <> ''),
    address text,
    contact_name text,
    contact_phone text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (campaign_id, site_code)
);

create table if not exists public.campaign_inventory_items (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.exam_campaigns(id) on delete restrict,
    item_code text not null check (btrim(item_code) <> ''),
    item_name text not null check (btrim(item_name) <> ''),
    unit text not null check (btrim(unit) <> ''),
    quantity_received numeric(14, 2) not null check (quantity_received > 0),
    quantity_available numeric(14, 2) not null check (quantity_available >= 0),
    serial_numbers text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (campaign_id, item_code)
);

create table if not exists public.campaign_export_documents (
    id uuid primary key default gen_random_uuid(),
    document_number text not null unique check (btrim(document_number) <> ''),
    campaign_id uuid not null references public.exam_campaigns(id) on delete restrict,
    site_id uuid references public.exam_sites(id) on delete restrict,
    recipient_employee_id text not null check (btrim(recipient_employee_id) <> ''),
    export_date date not null,
    status text not null default 'ISSUED' check (status in ('ISSUED', 'CANCELLED')),
    notes text,
    created_by text not null check (btrim(created_by) <> ''),
    cancelled_at timestamptz,
    cancelled_by text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.campaign_export_lines (
    id uuid primary key default gen_random_uuid(),
    document_id uuid not null references public.campaign_export_documents(id) on delete cascade,
    inventory_item_id uuid not null references public.campaign_inventory_items(id) on delete restrict,
    quantity numeric(14, 2) not null check (quantity > 0),
    serial_numbers text,
    unique (document_id, inventory_item_id)
);

create table if not exists public.campaign_export_idempotency (
    operation text not null check (operation in ('ISSUE', 'CANCEL')),
    idempotency_key uuid not null,
    request_hash text not null check (btrim(request_hash) <> ''),
    response jsonb,
    created_at timestamptz not null default now(),
    primary key (operation, idempotency_key)
);

create index if not exists idx_exam_sites_campaign_id on public.exam_sites(campaign_id);
create index if not exists idx_campaign_inventory_items_campaign_id on public.campaign_inventory_items(campaign_id);
create index if not exists idx_campaign_export_documents_campaign_id on public.campaign_export_documents(campaign_id, export_date desc);

-- New tables are private to the server API. The API must use the service-role
-- client only after validating the signed GGS application session and permission.
alter table public.exam_campaigns enable row level security;
alter table public.exam_sites enable row level security;
alter table public.campaign_inventory_items enable row level security;
alter table public.campaign_export_documents enable row level security;
alter table public.campaign_export_lines enable row level security;
alter table public.campaign_export_idempotency enable row level security;

revoke all on table public.exam_campaigns, public.exam_sites, public.campaign_inventory_items,
    public.campaign_export_documents, public.campaign_export_lines, public.campaign_export_idempotency
    from anon, authenticated;
grant all on table public.exam_campaigns, public.exam_sites, public.campaign_inventory_items,
    public.campaign_export_documents, public.campaign_export_lines, public.campaign_export_idempotency
    to service_role;

create or replace function public.issue_campaign_export(
    p_idempotency_key uuid,
    p_request_hash text,
    p_document_number text,
    p_campaign_id uuid,
    p_site_id uuid,
    p_recipient_employee_id text,
    p_export_date date,
    p_notes text,
    p_created_by text,
    p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing public.campaign_export_idempotency%rowtype;
    v_document_id uuid;
    v_response jsonb;
    v_requested_count integer;
    v_locked_count integer;
begin
    if p_idempotency_key is null or btrim(coalesce(p_request_hash, '')) = '' then
        raise exception 'Idempotency key and request hash are required' using errcode = '22023';
    end if;

    insert into public.campaign_export_idempotency (operation, idempotency_key, request_hash)
    values ('ISSUE', p_idempotency_key, p_request_hash)
    on conflict do nothing;

    if not found then
        select * into v_existing
        from public.campaign_export_idempotency
        where operation = 'ISSUE' and idempotency_key = p_idempotency_key;

        if v_existing.request_hash <> p_request_hash then
            raise exception 'Idempotency key was already used with a different request' using errcode = '23505';
        end if;
        if v_existing.response is null then
            raise exception 'The matching request is still processing' using errcode = '55P03';
        end if;
        return v_existing.response;
    end if;

    if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
        raise exception 'At least one export line is required' using errcode = '22023';
    end if;

    select count(*), count(distinct "inventoryItemId") into v_requested_count, v_locked_count
    from jsonb_to_recordset(p_lines) as line("inventoryItemId" uuid, quantity numeric);
    if v_requested_count <> v_locked_count then
        raise exception 'Duplicate inventory item in export lines' using errcode = '22023';
    end if;

    perform 1 from public.exam_campaigns
    where id = p_campaign_id and status = 'ACTIVE'
    for key share;
    if not found then
        raise exception 'Active campaign was not found' using errcode = 'P0002';
    end if;

    if p_site_id is not null and not exists (
        select 1 from public.exam_sites where id = p_site_id and campaign_id = p_campaign_id
    ) then
        raise exception 'Exam site does not belong to campaign' using errcode = '22023';
    end if;

    select count(*) into v_locked_count
    from (
        select item.id
        from public.campaign_inventory_items item
        join jsonb_to_recordset(p_lines) as line("inventoryItemId" uuid, quantity numeric)
          on line."inventoryItemId" = item.id
        where item.campaign_id = p_campaign_id
        for update of item
    ) as locked_items;
    if v_locked_count <> v_requested_count then
        raise exception 'Campaign inventory item was not found' using errcode = 'P0002';
    end if;

    if exists (
        select 1
        from public.campaign_inventory_items item
        join jsonb_to_recordset(p_lines) as line("inventoryItemId" uuid, quantity numeric)
          on line."inventoryItemId" = item.id
        where line.quantity <= 0 or item.quantity_available < line.quantity
    ) then
        raise exception 'Insufficient available inventory' using errcode = '22023';
    end if;

    insert into public.campaign_export_documents (
        document_number, campaign_id, site_id, recipient_employee_id, export_date, notes, created_by
    ) values (
        btrim(p_document_number), p_campaign_id, p_site_id, btrim(p_recipient_employee_id),
        p_export_date, nullif(btrim(coalesce(p_notes, '')), ''), btrim(p_created_by)
    ) returning id into v_document_id;

    insert into public.campaign_export_lines (document_id, inventory_item_id, quantity, serial_numbers)
    select v_document_id, line."inventoryItemId", line.quantity, nullif(btrim(coalesce(line."serialNumbers", '')), '')
    from jsonb_to_recordset(p_lines) as line("inventoryItemId" uuid, quantity numeric, "serialNumbers" text);

    update public.campaign_inventory_items item
    set quantity_available = item.quantity_available - line.quantity, updated_at = now()
    from jsonb_to_recordset(p_lines) as line("inventoryItemId" uuid, quantity numeric)
    where item.id = line."inventoryItemId";

    select jsonb_build_object('documentId', v_document_id, 'documentNumber', p_document_number, 'status', 'ISSUED')
    into v_response;
    update public.campaign_export_idempotency
    set response = v_response
    where operation = 'ISSUE' and idempotency_key = p_idempotency_key;
    return v_response;
end;
$$;

revoke all on function public.issue_campaign_export(uuid, text, text, uuid, uuid, text, date, text, text, jsonb) from public;
grant execute on function public.issue_campaign_export(uuid, text, text, uuid, uuid, text, date, text, text, jsonb) to service_role;

create or replace function public.cancel_campaign_export(
    p_idempotency_key uuid,
    p_request_hash text,
    p_document_id uuid,
    p_cancelled_by text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing public.campaign_export_idempotency%rowtype;
    v_document public.campaign_export_documents%rowtype;
    v_response jsonb;
begin
    if p_idempotency_key is null or btrim(coalesce(p_request_hash, '')) = '' then
        raise exception 'Idempotency key and request hash are required' using errcode = '22023';
    end if;

    insert into public.campaign_export_idempotency (operation, idempotency_key, request_hash)
    values ('CANCEL', p_idempotency_key, p_request_hash)
    on conflict do nothing;

    if not found then
        select * into v_existing
        from public.campaign_export_idempotency
        where operation = 'CANCEL' and idempotency_key = p_idempotency_key;
        if v_existing.request_hash <> p_request_hash then
            raise exception 'Idempotency key was already used with a different request' using errcode = '23505';
        end if;
        if v_existing.response is null then
            raise exception 'The matching request is still processing' using errcode = '55P03';
        end if;
        return v_existing.response;
    end if;

    select * into v_document
    from public.campaign_export_documents
    where id = p_document_id
    for update;
    if not found then
        raise exception 'Export document was not found' using errcode = 'P0002';
    end if;
    if v_document.status = 'CANCELLED' then
        raise exception 'Export document was already cancelled' using errcode = '23505';
    end if;

    update public.campaign_inventory_items item
    set quantity_available = item.quantity_available + totals.quantity,
        updated_at = now()
    from (
        select inventory_item_id, sum(quantity) as quantity
        from public.campaign_export_lines
        where document_id = p_document_id
        group by inventory_item_id
    ) as totals
    where item.id = totals.inventory_item_id;

    update public.campaign_export_documents
    set status = 'CANCELLED', cancelled_at = now(), cancelled_by = btrim(p_cancelled_by), updated_at = now()
    where id = p_document_id;

    select jsonb_build_object('documentId', p_document_id, 'documentNumber', v_document.document_number, 'status', 'CANCELLED')
    into v_response;
    update public.campaign_export_idempotency
    set response = v_response
    where operation = 'CANCEL' and idempotency_key = p_idempotency_key;
    return v_response;
end;
$$;

revoke all on function public.cancel_campaign_export(uuid, text, uuid, text) from public;
grant execute on function public.cancel_campaign_export(uuid, text, uuid, text) to service_role;

notify pgrst, 'reload schema';
