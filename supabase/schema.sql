-- Database rules of JOB Bandiera: tables, permissions, numbering, trash and access register.
-- Snapshot of the Supabase project taken on 2026-11-25. It holds no data, accounts or keys.
-- Can be run again: it creates what is missing and replaces functions, policies and triggers.
--
-- Not included, to be set by hand in a new project:
--   1. The account allowed to see the register:
--        insert into private.audit_viewers select id from auth.users where email = '<account>';
--   2. The vault secret "firestore_sync_token" and the pg_cron job "firestore-sync" ('0 */3 * * *'), which calls
--      the edge function with that secret in the x-sync-token header (only while the old system is in use).

set check_function_bodies = off;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
grant usage on schema private to authenticated;

create sequence if not exists public.firestore_sync_runs_id_seq;

create sequence if not exists public.audit_log_id_seq;

create table if not exists public.documents (
  collection text not null,
  id text not null,
  data jsonb default '{}'::jsonb not null,
  updated_at timestamp with time zone default now() not null,
  updated_by uuid default auth.uid(),
  constraint documents_pkey PRIMARY KEY (collection, id)
);

create table if not exists public.app_roles (
  user_id uuid not null,
  email text not null,
  role text default 'Empleado'::text not null,
  profile_uid text,
  created_at timestamp with time zone default now() not null,
  must_change_password boolean default false not null,
  constraint app_roles_email_key UNIQUE (email),
  constraint app_roles_pkey PRIMARY KEY (user_id),
  constraint app_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  constraint app_roles_role_check CHECK ((role = ANY (ARRAY['SuperAdmin'::text, 'Admin'::text, 'Gerente'::text, 'Capataz'::text, 'Empleado'::text, 'Owner'::text, 'Administrativo'::text, 'Cliente'::text])))
);

create table if not exists public.documents_trash (
  trash_id uuid default gen_random_uuid() not null,
  collection text not null,
  doc_id text not null,
  data jsonb not null,
  deleted_at timestamp with time zone default now() not null,
  deleted_by text,
  constraint documents_trash_pkey PRIMARY KEY (trash_id)
);

create table if not exists public.firestore_sync_state (
  collection text not null,
  id text not null,
  hash text not null,
  synced_at timestamp with time zone default now() not null,
  constraint firestore_sync_state_pkey PRIMARY KEY (collection, id)
);

create table if not exists public.firestore_sync_runs (
  id bigint default nextval('public.firestore_sync_runs_id_seq'::regclass) not null,
  ran_at timestamp with time zone default now() not null,
  summary jsonb not null,
  constraint firestore_sync_runs_pkey PRIMARY KEY (id)
);

create table if not exists public.audit_log (
  id bigint default nextval('public.audit_log_id_seq'::regclass) not null,
  at timestamp with time zone default now() not null,
  actor text not null,
  actor_role text,
  action text not null,
  collection text,
  doc_id text,
  label text,
  detail text,
  changes jsonb,
  ip text,
  device text,
  origin text,
  constraint audit_log_pkey PRIMARY KEY (id)
);

create table if not exists private.audit_viewers (
  user_id uuid not null,
  constraint audit_viewers_pkey PRIMARY KEY (user_id)
);

alter table public.documents enable row level security;

alter table public.app_roles enable row level security;

alter table public.documents_trash enable row level security;

alter table public.firestore_sync_state enable row level security;

alter table public.firestore_sync_runs enable row level security;

alter table public.audit_log enable row level security;

create index if not exists documents_collection_idx ON public.documents USING btree (collection);

create index if not exists documents_trash_deleted_at_idx ON public.documents_trash USING btree (deleted_at DESC);

create index if not exists audit_log_at_idx ON public.audit_log USING btree (at DESC);

create index if not exists audit_log_actor_idx ON public.audit_log USING btree (actor, id DESC);

create index if not exists audit_log_doc_idx ON public.audit_log USING btree (collection, doc_id);

CREATE OR REPLACE FUNCTION public.strip_password()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  new.data := new.data - 'password';
  new.updated_at := now();
  return new;
end $function$
;

CREATE OR REPLACE FUNCTION private.private_create_auth_user(p_email text, p_password text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  v_uid uuid := gen_random_uuid();
  v_email text := lower(trim(p_email));
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_uid, v_uid::text,
          jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_uid;
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_create_user(p_email text, p_password text, p_role text, p_profile_uid text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  v_uid uuid;
  v_email text := lower(trim(p_email));
begin
  if not private.is_admin() then raise exception 'Solo administradores pueden crear usuarios'; end if;
  if p_role = 'SuperAdmin' and not private.is_superadmin() then raise exception 'Solo un SuperAdmin puede crear otro SuperAdmin'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'La clave debe tener al menos 8 caracteres'; end if;
  if exists (select 1 from auth.users where email = v_email) then raise exception 'Ya existe una cuenta con ese correo'; end if;
  v_uid := private.private_create_auth_user(v_email, p_password);
  insert into public.app_roles (user_id, email, role, profile_uid, must_change_password) values (v_uid, v_email, p_role, p_profile_uid, true);
  return v_uid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_set_password(p_email text, p_password text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  v_target_role text;
  v_target_id uuid;
begin
  if not private.is_admin() then raise exception 'Solo administradores pueden cambiar claves'; end if;
  if private.is_protected_account(p_email) then raise exception 'Esta cuenta solo puede modificarla su titular'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'La clave debe tener al menos 8 caracteres'; end if;
  select role, user_id into v_target_role, v_target_id from public.app_roles where email = lower(trim(p_email));
  if v_target_role is null then raise exception 'No existe cuenta de acceso para ese correo'; end if;
  if v_target_role = 'SuperAdmin' and not private.is_superadmin() then raise exception 'Solo un SuperAdmin puede cambiar la clave de otro SuperAdmin'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
   where email = lower(trim(p_email));
  update public.app_roles set must_change_password = (v_target_id <> auth.uid()) where user_id = v_target_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_delete_login(p_email text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_target_role text;
begin
  if not private.is_admin() then raise exception 'Solo administradores pueden eliminar accesos'; end if;
  if private.is_protected_account(p_email) then raise exception 'Esta cuenta solo puede modificarla su titular'; end if;
  select role into v_target_role from public.app_roles where email = lower(trim(p_email));
  if v_target_role = 'SuperAdmin' and not private.is_superadmin() then raise exception 'Solo un SuperAdmin puede eliminar otro SuperAdmin'; end if;
  delete from auth.users where email = lower(trim(p_email));
end;
$function$;

CREATE OR REPLACE FUNCTION public.merge_documents(p_rows jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  insert into public.documents as d (collection, id, data)
  select r->>'collection', r->>'id', coalesce(r->'data', '{}'::jsonb)
    from jsonb_array_elements(p_rows) r
  on conflict (collection, id)
  do update set data = d.data || excluded.data;
end $function$
;

CREATE OR REPLACE FUNCTION private.role_name()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from public.app_roles where user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION private.account_email()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select email from public.app_roles where user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION private.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(private.role_name() in ('SuperAdmin','Owner','Gerente','Admin'), false)
$function$;

CREATE OR REPLACE FUNCTION private.is_superadmin()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(private.role_name() = 'SuperAdmin', false)
$function$;

CREATE OR REPLACE FUNCTION private.can_read(p_collection text, p_data jsonb)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case
    when private.role_name() is null then false
    when private.is_admin() then true
    when p_collection = 'users' then lower(coalesce(p_data->>'email','')) = private.account_email()
    when private.is_field_role() then p_collection = 'systemSettings'
    when p_collection in ('financials','archivedReceipts','workers','auditRecords','clients') then false
    else true
  end
$function$;

CREATE OR REPLACE FUNCTION private.can_write(p_collection text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select case
    when private.role_name() is null then false
    when private.is_admin() then true
    else false
  end
$function$;

CREATE OR REPLACE FUNCTION private.is_field_role()
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(private.role_name() in ('Capataz','Empleado'), false)
$function$;

CREATE OR REPLACE FUNCTION public.submit_field_report(p_id text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := private.account_email();
  v_year int := extract(year from (now() at time zone 'America/Argentina/Mendoza'))::int;
  v_existing jsonb;
  v_next int;
  v_remito text;
  v_data jsonb;
begin
  if not (private.is_field_role() or private.is_admin()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_id is null or p_id !~ '^AUD-[A-Z0-9-]{4,40}$' then
    raise exception 'invalid remito id';
  end if;
  if length(coalesce(p_data->>'signatureUrl','')) > 600000 then
    raise exception 'signature too large';
  end if;

  -- Idempotent: an offline queue may resend the same remito.
  select data into v_existing from documents where collection = 'auditRecords' and id = p_id;
  if found then
    return jsonb_build_object('remitoId', v_existing->>'remitoId', 'duplicate', true);
  end if;

  perform pg_advisory_xact_lock(hashtext('auditRecords_remito_seq'));
  select coalesce(max((regexp_match(data->>'remitoId', '^#?(\d+)-' || v_year || '$'))[1]::int), 0)
    into v_next
    from documents where collection = 'auditRecords';
  v_next := greatest(v_next, case when v_year = 2026 then 379 else 0 end) + 1;
  v_remito := '#' || v_next || '-' || v_year;

  v_data := private.field_whitelist(p_data) || jsonb_build_object(
    'id', p_id,
    'remitoId', v_remito,
    'teamMembers', private.field_team(p_data),
    'status', 'Cargado',
    'semaforo', 'rojo',
    'origenCampo', true,
    'costosPendientes', true,
    'cargadoPor', v_email,
    'cargadoPorNombre', private.account_display_name(),
    'asignadoA', v_email,
    'asignadoNombre', private.account_display_name(),
    'cargadoEn', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'logisticsCost', 0, 'laborDirectCost', 0, 'operatingCost', 0, 'materialsCost', 0,
    'suggestedPrice', 0, 'billedPrice', 0, 'collectedPrice', 0, 'helperPay', 0, 'techPay', 0
  );

  insert into documents(collection, id, data) values ('auditRecords', p_id, v_data);
  return jsonb_build_object('remitoId', v_remito, 'duplicate', false);
end;
$function$;

CREATE OR REPLACE FUNCTION public.field_directory()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not (private.is_field_role() or private.is_admin()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'clients', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id,
        'razonSocial', data->>'razonSocial',
        'fincaLocacion', data->>'fincaLocacion',
        'direccionFiscal', data->>'direccionFiscal',
        'distanciaKm', case when jsonb_typeof(data->'distanciaKm') = 'number' then data->'distanciaKm' else null end
      ) order by data->>'razonSocial')
      from documents where collection = 'clients' and coalesce(data->>'razonSocial','') <> ''), '[]'::jsonb),
    'workers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', data->>'name', 'role', data->>'role',
        'cargo', data->>'cargo', 'category', data->>'category', 'cuadrilla', data->>'cuadrilla'
      ) order by data->>'name')
      from documents where collection = 'workers' and coalesce(data->>'name','') <> ''
        and coalesce(data->>'active','true') <> 'false'
        and coalesce(data->>'isAdministrative','false') <> 'true'), '[]'::jsonb),
    'capataces', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.data->>'displayName', 'cuadrilla', d.data->>'cuadrilla',
                                          'hasAccount', r.user_id is not null)
                       order by d.data->>'displayName')
      from documents d
      left join app_roles r on r.profile_uid = d.id and r.role = 'Capataz'
      where d.collection = 'users' and d.data->>'role' = 'Capataz'
        and coalesce(d.data->>'displayName','') <> '' and coalesce(d.data->>'active','true') <> 'false'), '[]'::jsonb),
    'materials', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', data->>'name', 'unit', data->>'unit') order by data->>'name')
      from documents where collection = 'materials' and coalesce(data->>'name','') <> ''), '[]'::jsonb)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION private.account_display_name()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(nullif(d.data->>'displayName',''), r.email)
    from public.app_roles r
    left join public.documents d on d.collection = 'users' and d.id = r.profile_uid
   where r.user_id = auth.uid()
$function$;

CREATE OR REPLACE FUNCTION private.field_whitelist(p_data jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
    from jsonb_each(coalesce(p_data, '{}'::jsonb))
   where key in ('remitoPapel','date','clientName','siteLocation','workPoint','isGuardia','guardiaType',
                 'hoursWorked','travelHours','viajes','distanceKm','horaEntrada','horaSalida',
                 'materialsDetails','fieldMaterials','description','leadTech','helpers','supportStaff',
                 'signatureUrl','jornadas')
$function$;

CREATE OR REPLACE FUNCTION private.field_team(p_data jsonb)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object('name', m->>'name', 'role', coalesce(m->>'role','Ayudante'))), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(p_data->'teamMembers') = 'array' then p_data->'teamMembers' else '[]'::jsonb end) m
$function$;

CREATE OR REPLACE FUNCTION public.field_my_reports()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := private.account_email();
begin
  if not (private.is_field_role() or private.is_admin()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(item order by item->>'date' desc, item->>'cargadoEn' desc)
      from (
        select private.field_whitelist(data) || jsonb_build_object(
                 'id', id,
                 'remitoId', data->>'remitoId',
                 'teamMembers', private.field_team(data),
                 'status', data->>'status',
                 'editable', data->>'status' = 'Cargado',
                 'cargadoPor', data->>'cargadoPor',
                 'cargadoPorNombre', data->>'cargadoPorNombre',
                 'cargadoEn', data->>'cargadoEn',
                 'transferencias', coalesce(data->'transferencias', '[]'::jsonb)
               ) as item
          from documents
         where collection = 'auditRecords'
           and data->>'origenCampo' = 'true'
           and lower(coalesce(data->>'asignadoA', data->>'cargadoPor', '')) = lower(v_email)
           and (data->>'status' = 'Cargado' or coalesce(data->>'cargadoEn','') >= to_char(now() - interval '45 days', 'YYYY-MM-DD'))
         limit 150
      ) s
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_field_report(p_id text, p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := private.account_email();
  v_row jsonb;
  v_patch jsonb;
begin
  if not (private.is_field_role() or private.is_admin()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if length(coalesce(p_data->>'signatureUrl','')) > 600000 then
    raise exception 'signature too large';
  end if;
  select data into v_row from documents where collection = 'auditRecords' and id = p_id for update;
  if not found or v_row->>'origenCampo' is distinct from 'true' then
    raise exception 'remito no encontrado';
  end if;
  if lower(coalesce(v_row->>'asignadoA', v_row->>'cargadoPor', '')) <> lower(v_email) and not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_row->>'status' <> 'Cargado' then
    raise exception 'remito cerrado por administracion';
  end if;

  v_patch := private.field_whitelist(p_data);
  if p_data ? 'teamMembers' then
    v_patch := v_patch || jsonb_build_object('teamMembers', private.field_team(p_data));
  end if;
  v_patch := v_patch || jsonb_build_object(
    'costosPendientes', true,
    'editadoEnCampo', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'editadoPor', private.account_display_name(),
    'edicionesCampo', coalesce((v_row->>'edicionesCampo')::int, 0) + 1
  );
  update documents set data = data || v_patch, updated_at = now() where collection = 'auditRecords' and id = p_id;
  return jsonb_build_object('remitoId', v_row->>'remitoId');
end;
$function$;

CREATE OR REPLACE FUNCTION public.transfer_field_report(p_id text, p_to text, p_nota text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_email text := private.account_email();
  v_row jsonb;
  v_to_email text;
  v_to_name text;
  v_entry jsonb;
begin
  if not (private.role_name() = 'Capataz' or private.is_admin()) then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select data into v_row from documents where collection = 'auditRecords' and id = p_id for update;
  if not found or v_row->>'origenCampo' is distinct from 'true' then
    raise exception 'remito no encontrado';
  end if;
  if lower(coalesce(v_row->>'asignadoA', v_row->>'cargadoPor', '')) <> lower(v_email) and not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if v_row->>'status' <> 'Cargado' then
    raise exception 'remito cerrado por administracion';
  end if;

  select r.email, coalesce(nullif(d.data->>'displayName',''), r.email)
    into v_to_email, v_to_name
    from app_roles r
    left join documents d on d.collection = 'users' and d.id = r.profile_uid
   where r.profile_uid = p_to and r.role = 'Capataz'
     and coalesce(d.data->>'active','true') <> 'false';
  if v_to_email is null then
    raise exception 'capataz destino no valido';
  end if;
  if lower(v_to_email) = lower(coalesce(v_row->>'asignadoA', v_row->>'cargadoPor', '')) then
    -- Already in that capataz's charge (e.g. queued twice): nothing to do.
    return jsonb_build_object('remitoId', v_row->>'remitoId', 'duplicate', true);
  end if;

  v_entry := jsonb_build_object(
    'de', coalesce(v_row->>'asignadoNombre', v_row->>'cargadoPorNombre', v_row->>'cargadoPor'),
    'deEmail', coalesce(v_row->>'asignadoA', v_row->>'cargadoPor'),
    'a', v_to_name,
    'aEmail', v_to_email,
    'fecha', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'nota', nullif(left(trim(coalesce(p_nota, '')), 500), '')
  );
  update documents
     set data = data || jsonb_build_object(
           'asignadoA', v_to_email,
           'asignadoNombre', v_to_name,
           'transferido', true,
           'transferencias', coalesce(data->'transferencias', '[]'::jsonb) || jsonb_build_array(v_entry)),
         updated_at = now()
   where collection = 'auditRecords' and id = p_id;
  return jsonb_build_object('remitoId', v_row->>'remitoId', 'asignadoNombre', v_to_name);
end;
$function$;

CREATE OR REPLACE FUNCTION private.trash_document()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Personnel and settings are excluded: logins and system flags are handled elsewhere.
  if old.collection not in ('users', 'workers', 'systemSettings', 'technicalParameters') then
    insert into documents_trash (collection, doc_id, data, deleted_by)
    values (old.collection, old.id, old.data, private.account_email());
  end if;
  return old;
end;
$function$;

CREATE OR REPLACE FUNCTION public.list_trash()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(item order by item->>'deletedAt' desc)
      from (
        select jsonb_build_object(
                 'trashId', trash_id,
                 'collection', collection,
                 'docId', doc_id,
                 'deletedAt', deleted_at,
                 'deletedBy', deleted_by,
                 'title', coalesce(data->>'remitoId', data->>'receiptNumber', data->>'razonSocial', data->>'name', data->>'code', doc_id),
                 'subtitle', coalesce(data->>'clientName', data->>'fincaLocacion', data->>'description', ''),
                 'date', coalesce(data->>'date', ''),
                 'amount', case when jsonb_typeof(data->'billedPrice') = 'number' then data->'billedPrice'
                                when jsonb_typeof(data->'totalAmount') = 'number' then data->'totalAmount' end,
                 'status', data->>'status'
               ) as item
          from documents_trash
         order by deleted_at desc
         limit 1000
      ) s
  ), '[]'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION public.restore_trash_item(p_trash_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row documents_trash%rowtype;
begin
  if not private.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select * into v_row from documents_trash where trash_id = p_trash_id for update;
  if not found then
    raise exception 'elemento no encontrado en la papelera';
  end if;
  if exists (select 1 from documents where collection = v_row.collection and id = v_row.doc_id) then
    raise exception 'ya existe un documento activo con ese identificador';
  end if;
  insert into documents (collection, id, data) values (v_row.collection, v_row.doc_id, v_row.data);
  delete from documents_trash where trash_id = p_trash_id;
  return jsonb_build_object('collection', v_row.collection, 'id', v_row.doc_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.purge_trash_item(p_trash_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_row documents_trash%rowtype;
begin
  if not private.is_superadmin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  delete from documents_trash where trash_id = p_trash_id returning * into v_row;
  if not found then
    return;
  end if;
  -- Without a trace there is no permanent deletion: an error here cancels it.
  perform private.audit_write('borrar', v_row.collection, v_row.doc_id,
    coalesce(v_row.data->>'remitoId', v_row.data->>'receiptNumber', v_row.data->>'razonSocial', v_row.data->>'name', v_row.doc_id),
    'Borrado definitivo de la Papelera · ' || left(coalesce(v_row.data->>'clientName', v_row.data->>'fincaLocacion', ''), 120)
      || case when v_row.collection = 'auditRecords' then ' · ' || coalesce(v_row.data->>'status', '') || ' · $' || coalesce(v_row.data->>'billedPrice', '0') else '' end,
    null);
end;
$function$;

CREATE OR REPLACE FUNCTION private.assign_remito_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_match text[];
  v_id text := new.data->>'remitoId';
begin
  if new.collection <> 'auditRecords' then
    return new;
  end if;
  -- Copies from the old system keep their number during the migration.
  if new.data ? 'keepRemitoNumber' then
    new.data := new.data - 'keepRemitoNumber';
    return new;
  end if;
  -- Upserts of an existing remito also pass here: only real inserts count.
  if exists (select 1 from documents where collection = new.collection and id = new.id) then
    return new;
  end if;
  if coalesce(v_id, '') = '' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('auditRecords_remito_seq'));
  if not exists (
    select 1 from documents
     where collection = 'auditRecords' and ltrim(data->>'remitoId', '#') = ltrim(v_id, '#')
  ) then
    return new;
  end if;

  v_match := regexp_match(v_id, '^#?(\d+)-(\d{4})$');
  if v_match is not null then
    new.data := jsonb_set(new.data, '{remitoId}', to_jsonb(private.next_remito_number(v_match[2]::int)));
  elsif v_id ~ '^R-IMP-\d+$' then
    new.data := jsonb_set(new.data, '{remitoId}', to_jsonb('R-IMP-' || (
      select max((regexp_match(data->>'remitoId', '^R-IMP-(\d+)$'))[1]::int) + 1 from documents where collection = 'auditRecords')));
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION private.keep_remito_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old text := old.data->>'remitoId';
  v_new text := new.data->>'remitoId';
  v_rescue_id text;
  v_year text;
begin
  if new.collection <> 'auditRecords' or v_new is not distinct from v_old then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('auditRecords_remito_seq'));

  if coalesce(v_old, '') <> '' and coalesce(v_new, '') <> '' and (
       (new.data->>'remitoPapel') is distinct from (old.data->>'remitoPapel')
       or (new.data->>'clientName') is distinct from (old.data->>'clientName')) then
    -- Different remito on the same id.
    if not exists (
      select 1 from documents
       where collection = 'auditRecords' and id <> old.id and data->>'remitoId' = v_old
         and (data->>'remitoPapel') is not distinct from (old.data->>'remitoPapel')
    ) then
      v_rescue_id := 'AUD-REC-' || regexp_replace(old.id, '^AUD-', '') || '-' || regexp_replace(v_old, '[^A-Za-z0-9]', '', 'g');
      insert into documents (collection, id, data)
      values ('auditRecords', v_rescue_id, old.data || jsonb_build_object(
        'id', v_rescue_id, 'keepRemitoNumber', true, 'recuperado', true, 'recuperadoDe', old.id,
        'recuperadoEn', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')))
      on conflict (collection, id) do nothing;
    end if;
    -- A merge leaves the previous invoice behind: a remito not invoiced has none.
    if new.data->>'status' = 'Cargado' then
      new.data := new.data || '{"numeroFactura":"","fechaFactura":""}'::jsonb;
    end if;
    if exists (select 1 from documents where collection = 'auditRecords' and id <> new.id
                and ltrim(data->>'remitoId', '#') = ltrim(v_new, '#')) then
      v_year := (regexp_match(v_new, '^#?\d+-(\d{4})$'))[1];
      if v_year is not null then
        new.data := jsonb_set(new.data, '{remitoId}', to_jsonb(private.next_remito_number(v_year::int)));
      end if;
    end if;
    return new;
  end if;

  if exists (select 1 from documents where collection = 'auditRecords' and id <> new.id
              and ltrim(data->>'remitoId', '#') = ltrim(v_new, '#')) then
    new.data := jsonb_set(new.data, '{remitoId}', old.data->'remitoId');
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.admin_import_account(p_email text, p_password text, p_role text, p_profile_uid text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  v_uid uuid;
  v_email text := lower(trim(p_email));
begin
  if not private.is_superadmin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if length(coalesce(p_password, '')) = 0 then
    raise exception 'la cuenta no tiene clave';
  end if;
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'ya existe una cuenta con ese correo';
  end if;
  v_uid := private.private_create_auth_user(v_email, p_password);
  insert into public.app_roles (user_id, email, role, profile_uid, must_change_password)
  values (v_uid, v_email, p_role, p_profile_uid, true);
  return v_uid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.change_own_password(p_password text, p_current text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'extensions'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_forced boolean;
begin
  if v_uid is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  select must_change_password into v_forced from public.app_roles where user_id = v_uid;
  if not coalesce(v_forced, false) and not exists (
    select 1 from auth.users where id = v_uid and encrypted_password = extensions.crypt(coalesce(p_current, ''), encrypted_password)
  ) then
    raise exception 'La clave actual no es correcta';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'La clave debe tener al menos 8 caracteres';
  end if;
  if exists (select 1 from auth.users where id = v_uid and encrypted_password = extensions.crypt(p_password, encrypted_password)) then
    raise exception 'La clave nueva debe ser distinta de la anterior';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now() where id = v_uid;
  update public.app_roles set must_change_password = false where user_id = v_uid;
end;
$function$;

CREATE OR REPLACE FUNCTION public.keepalive()
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select now()
$function$;

CREATE OR REPLACE FUNCTION public.firestore_sync_token_ok(p_token text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from vault.decrypted_secrets where name = 'firestore_sync_token' and decrypted_secret = p_token)
$function$;

CREATE OR REPLACE FUNCTION private.next_remito_number(p_year integer)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select '#' || (greatest(
           coalesce(max((regexp_match(data->>'remitoId', '^#?(\d+)-' || p_year || '$'))[1]::int), 0),
           case when p_year = 2026 then 379 else 0 end) + 1) || '-' || p_year
    from documents where collection = 'auditRecords'
$function$;

CREATE OR REPLACE FUNCTION private.is_audit_viewer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from private.audit_viewers where user_id = auth.uid())
$function$;

CREATE OR REPLACE FUNCTION private.audit_write(p_action text, p_collection text, p_doc_id text, p_label text, p_detail text, p_changes jsonb, p_actor text DEFAULT NULL::text, p_ip text DEFAULT NULL::text, p_device text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_uid uuid := auth.uid();
  v_actor text := p_actor;
  v_role text;
begin
  if v_actor is null and v_uid is not null then
    v_actor := coalesce((select email from auth.users where id = v_uid), v_uid::text);
    select role into v_role from app_roles where user_id = v_uid;
  elsif v_actor is not null then
    select r.role into v_role from app_roles r join auth.users u on u.id = r.user_id where u.email = v_actor;
  end if;
  if v_actor is null then
    v_actor := case when coalesce(auth.role(), '') = 'service_role' then 'Copia automática' else 'Sistema' end;
  end if;
  insert into audit_log (actor, actor_role, action, collection, doc_id, label, detail, changes, ip, device, origin)
  values (v_actor, v_role, p_action, p_collection, p_doc_id, p_label, p_detail, p_changes,
          coalesce(p_ip, split_part(coalesce(v_headers->>'cf-connecting-ip', v_headers->>'x-forwarded-for', ''), ',', 1)),
          left(coalesce(p_device, v_headers->>'user-agent', ''), 300),
          left(coalesce(v_headers->>'origin', ''), 120));
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_documents()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_data jsonb := case when tg_op = 'DELETE' then old.data else new.data end;
  v_col text := case when tg_op = 'DELETE' then old.collection else new.collection end;
  v_id text := case when tg_op = 'DELETE' then old.id else new.id end;
  v_changes jsonb;
begin
  begin
    if tg_op = 'UPDATE' then
      select jsonb_object_agg(k, case when k in ('signatureUrl', 'photoUrl', 'imageUrl')
               then jsonb_build_object('antes', '(imagen)', 'despues', '(imagen)')
               else jsonb_build_object('antes', case when length((old.data->k)::text) > 600 then to_jsonb(left((old.data->k)::text, 600)) else old.data->k end,
                                       'despues', case when length((new.data->k)::text) > 600 then to_jsonb(left((new.data->k)::text, 600)) else new.data->k end) end)
        into v_changes
        from (select jsonb_object_keys(old.data || new.data) k) keys
       where (old.data->k) is distinct from (new.data->k) and k <> 'updatedAt';
      if v_changes is null then
        return null;
      end if;
    end if;
    perform private.audit_write(
      case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'editar' else 'borrar' end,
      v_col, v_id,
      coalesce(v_data->>'remitoId', v_data->>'receiptNumber', v_data->>'razonSocial', v_data->>'displayName', v_data->>'name', v_id),
      left(coalesce(v_data->>'clientName', v_data->>'fincaLocacion', ''), 120)
        || case when v_col = 'auditRecords' then ' · ' || coalesce(v_data->>'status', '') || ' · $' || coalesce(v_data->>'billedPrice', '0') else '' end,
      v_changes);
  exception when others then
    -- The register must never stop the work of the users.
    raise warning 'audit_documents: %', sqlerrm;
  end;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_sessions()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_actor text;
begin
  begin
    if tg_op = 'INSERT' then
      select email into v_actor from auth.users where id = new.user_id;
      perform private.audit_write('ingreso', 'acceso', new.id::text, v_actor, null, null, v_actor, host(new.ip), new.user_agent);
    else
      select email into v_actor from auth.users where id = old.user_id;
      if v_actor is not null then
        perform private.audit_write('cierre', 'acceso', old.id::text, v_actor, null, null, v_actor, host(old.ip), old.user_agent);
      end if;
    end if;
  exception when others then
    raise warning 'audit_sessions: %', sqlerrm;
  end;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_accounts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  begin
    if tg_op = 'INSERT' then
      perform private.audit_write('cuenta_creada', 'cuenta', new.id::text, new.email, null, null);
    elsif tg_op = 'DELETE' then
      perform private.audit_write('cuenta_borrada', 'cuenta', old.id::text, old.email, null, null);
    else
      if new.encrypted_password is distinct from old.encrypted_password then
        perform private.audit_write('cambio_clave', 'cuenta', new.id::text, new.email, null, null);
      end if;
      if new.email is distinct from old.email then
        perform private.audit_write('cambio_rol', 'cuenta', new.id::text, old.email, 'Cambio de correo de ingreso',
          jsonb_build_object('email', jsonb_build_object('antes', old.email, 'despues', new.email)));
      end if;
    end if;
  exception when others then
    raise warning 'audit_accounts: %', sqlerrm;
  end;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.audit_roles()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_old jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  v_new jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  v_changes jsonb;
begin
  begin
    select jsonb_object_agg(k, jsonb_build_object('antes', v_old->k, 'despues', v_new->k))
      into v_changes
      from unnest(array['email', 'role', 'profile_uid', 'user_id']) k
     where (v_old->k) is distinct from (v_new->k);
    if v_changes is not null then
      perform private.audit_write('cambio_rol', 'cuenta', coalesce(v_old->>'user_id', v_new->>'user_id'),
        coalesce(v_old->>'email', v_new->>'email'),
        case tg_op when 'INSERT' then 'Permiso otorgado' when 'DELETE' then 'Permiso quitado' end, v_changes);
    end if;
  exception when others then
    raise warning 'audit_roles: %', sqlerrm;
  end;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION private.protect_audit_viewer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is not null and auth.uid() <> old.user_id
     and exists (select 1 from private.audit_viewers where user_id = old.user_id) then
    raise exception 'Esta cuenta solo puede modificarla su titular' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

CREATE OR REPLACE FUNCTION private.is_protected_account(p_login text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from private.audit_viewers v join auth.users u on u.id = v.user_id
                  where u.email = lower(trim(p_login)) and u.id is distinct from auth.uid())
$function$;

CREATE OR REPLACE FUNCTION public.audit_is_viewer()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select private.is_audit_viewer()
$function$;

CREATE OR REPLACE FUNCTION public.audit_list(p_from timestamp with time zone DEFAULT NULL::timestamp with time zone, p_to timestamp with time zone DEFAULT NULL::timestamp with time zone, p_actor text DEFAULT NULL::text, p_action text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_before bigint DEFAULT NULL::bigint, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not private.is_audit_viewer() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'actors', (select coalesce(jsonb_agg(actor order by actor), '[]'::jsonb) from (select distinct actor from audit_log) a),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.id desc) from (
        select * from audit_log
         where (p_from is null or at >= p_from)
           and (p_to is null or at < p_to)
           and (coalesce(p_actor, '') = '' or actor = p_actor)
           and (coalesce(p_action, '') = '' or action = any(string_to_array(p_action, ',')))
           and (coalesce(p_search, '') = '' or label ilike '%' || p_search || '%' or detail ilike '%' || p_search || '%' or doc_id ilike '%' || p_search || '%')
           and (p_before is null or id < p_before)
         order by id desc
         limit least(greatest(coalesce(p_limit, 100), 1), 500)
      ) s), '[]'::jsonb));
end;
$function$;

CREATE OR REPLACE FUNCTION public.audit_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not private.is_audit_viewer() then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'login', u.email, 'role', r.role, 'name', d.data->>'displayName',
      'mustChangePassword', r.must_change_password,
      'lastSignIn', u.last_sign_in_at,
      'logins', (select count(*) from audit_log l where l.action = 'ingreso' and l.actor = u.email),
      'changes', (select count(*) from audit_log l where l.actor = u.email and l.action in ('crear', 'editar', 'borrar')),
      'sessions', coalesce((select jsonb_agg(jsonb_build_object('since', s.created_at, 'lastUse', coalesce(s.refreshed_at at time zone 'UTC', s.updated_at), 'ip', host(s.ip), 'device', s.user_agent) order by s.created_at desc)
                              from auth.sessions s where s.user_id = r.user_id), '[]'::jsonb)
    ) order by u.last_sign_in_at desc nulls last, u.email)
    from app_roles r
    join auth.users u on u.id = r.user_id
    left join documents d on d.collection = 'users' and d.id = r.profile_uid), '[]'::jsonb);
end;
$function$;

revoke all on function public.strip_password() from public, anon, authenticated, service_role;
grant execute on function public.strip_password() to public, anon, authenticated, service_role;

revoke all on function private.private_create_auth_user(p_email text, p_password text) from public, anon, authenticated, service_role;
grant execute on function private.private_create_auth_user(p_email text, p_password text) to service_role;

revoke all on function public.admin_create_user(p_email text, p_password text, p_role text, p_profile_uid text) from public, anon, authenticated, service_role;
grant execute on function public.admin_create_user(p_email text, p_password text, p_role text, p_profile_uid text) to authenticated, service_role;

revoke all on function public.admin_set_password(p_email text, p_password text) from public, anon, authenticated, service_role;
grant execute on function public.admin_set_password(p_email text, p_password text) to authenticated, service_role;

revoke all on function public.admin_delete_login(p_email text) from public, anon, authenticated, service_role;
grant execute on function public.admin_delete_login(p_email text) to authenticated, service_role;

revoke all on function public.merge_documents(p_rows jsonb) from public, anon, authenticated, service_role;
grant execute on function public.merge_documents(p_rows jsonb) to authenticated, service_role;

revoke all on function private.role_name() from public, anon, authenticated, service_role;
grant execute on function private.role_name() to authenticated;

revoke all on function private.account_email() from public, anon, authenticated, service_role;
grant execute on function private.account_email() to authenticated;

revoke all on function private.is_admin() from public, anon, authenticated, service_role;
grant execute on function private.is_admin() to authenticated;

revoke all on function private.is_superadmin() from public, anon, authenticated, service_role;
grant execute on function private.is_superadmin() to authenticated;

revoke all on function private.can_read(p_collection text, p_data jsonb) from public, anon, authenticated, service_role;
grant execute on function private.can_read(p_collection text, p_data jsonb) to authenticated;

revoke all on function private.can_write(p_collection text) from public, anon, authenticated, service_role;
grant execute on function private.can_write(p_collection text) to authenticated;

revoke all on function public.submit_field_report(p_id text, p_data jsonb) from public, anon, authenticated, service_role;
grant execute on function public.submit_field_report(p_id text, p_data jsonb) to authenticated, service_role;

revoke all on function public.field_directory() from public, anon, authenticated, service_role;
grant execute on function public.field_directory() to authenticated, service_role;

revoke all on function private.account_display_name() from public, anon, authenticated, service_role;
grant execute on function private.account_display_name() to authenticated;

revoke all on function private.field_whitelist(p_data jsonb) from public, anon, authenticated, service_role;
grant execute on function private.field_whitelist(p_data jsonb) to authenticated;

revoke all on function private.field_team(p_data jsonb) from public, anon, authenticated, service_role;
grant execute on function private.field_team(p_data jsonb) to authenticated;

revoke all on function public.field_my_reports() from public, anon, authenticated, service_role;
grant execute on function public.field_my_reports() to authenticated, service_role;

revoke all on function public.update_field_report(p_id text, p_data jsonb) from public, anon, authenticated, service_role;
grant execute on function public.update_field_report(p_id text, p_data jsonb) to authenticated, service_role;

revoke all on function public.transfer_field_report(p_id text, p_to text, p_nota text) from public, anon, authenticated, service_role;
grant execute on function public.transfer_field_report(p_id text, p_to text, p_nota text) to authenticated, service_role;

revoke all on function public.list_trash() from public, anon, authenticated, service_role;
grant execute on function public.list_trash() to authenticated, service_role;

revoke all on function public.restore_trash_item(p_trash_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.restore_trash_item(p_trash_id uuid) to authenticated, service_role;

revoke all on function public.purge_trash_item(p_trash_id uuid) from public, anon, authenticated, service_role;
grant execute on function public.purge_trash_item(p_trash_id uuid) to authenticated, service_role;

revoke all on function public.admin_import_account(p_email text, p_password text, p_role text, p_profile_uid text) from public, anon, authenticated, service_role;
grant execute on function public.admin_import_account(p_email text, p_password text, p_role text, p_profile_uid text) to authenticated, service_role;

revoke all on function public.change_own_password(p_password text, p_current text) from public, anon, authenticated, service_role;
grant execute on function public.change_own_password(p_password text, p_current text) to authenticated, service_role;

revoke all on function public.keepalive() from public, anon, authenticated, service_role;
grant execute on function public.keepalive() to anon, authenticated, service_role;

revoke all on function public.firestore_sync_token_ok(p_token text) from public, anon, authenticated, service_role;
grant execute on function public.firestore_sync_token_ok(p_token text) to service_role;

revoke all on function private.next_remito_number(p_year integer) from public, anon, authenticated, service_role;

revoke all on function private.is_audit_viewer() from public, anon, authenticated, service_role;

revoke all on function private.audit_write(p_action text, p_collection text, p_doc_id text, p_label text, p_detail text, p_changes jsonb, p_actor text, p_ip text, p_device text) from public, anon, authenticated, service_role;

revoke all on function private.is_protected_account(p_login text) from public, anon, authenticated, service_role;

revoke all on function public.audit_is_viewer() from public, anon, authenticated, service_role;
grant execute on function public.audit_is_viewer() to authenticated, service_role;

revoke all on function public.audit_list(p_from timestamp with time zone, p_to timestamp with time zone, p_actor text, p_action text, p_search text, p_before bigint, p_limit integer) from public, anon, authenticated, service_role;
grant execute on function public.audit_list(p_from timestamp with time zone, p_to timestamp with time zone, p_actor text, p_action text, p_search text, p_before bigint, p_limit integer) to authenticated, service_role;

revoke all on function public.audit_access() from public, anon, authenticated, service_role;
grant execute on function public.audit_access() to authenticated, service_role;

revoke all on table public.documents from public, anon, authenticated, service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.documents to service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.documents to authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.documents to anon;

revoke all on table public.app_roles from public, anon, authenticated, service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.app_roles to service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.app_roles to authenticated;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.app_roles to anon;

revoke all on table public.documents_trash from public, anon, authenticated, service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.documents_trash to service_role;

revoke all on table public.firestore_sync_state from public, anon, authenticated, service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.firestore_sync_state to service_role;

revoke all on table public.firestore_sync_runs from public, anon, authenticated, service_role;
grant insert, select, update, delete, truncate, references, trigger, maintain on table public.firestore_sync_runs to service_role;

revoke all on table public.audit_log from public, anon, authenticated, service_role;

revoke all on table private.audit_viewers from public, anon, authenticated, service_role;

drop policy if exists app_roles_select_self_or_admin on public.app_roles;
create policy app_roles_select_self_or_admin on public.app_roles for select to authenticated using (((user_id = auth.uid()) OR private.is_admin()));

drop policy if exists app_roles_write_superadmin on public.app_roles;
create policy app_roles_write_superadmin on public.app_roles for all to authenticated using (private.is_superadmin()) with check (private.is_superadmin());

drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated using (private.is_admin());

drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated with check (private.can_write(collection));

drop policy if exists documents_select on public.documents;
create policy documents_select on public.documents for select to authenticated using (private.can_read(collection, data));

drop policy if exists documents_update on public.documents;
create policy documents_update on public.documents for update to authenticated using ((private.can_read(collection, data) AND private.can_write(collection))) with check (private.can_write(collection));

drop trigger if exists documents_strip_password on public.documents;
CREATE TRIGGER documents_strip_password BEFORE INSERT OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.strip_password();

drop trigger if exists documents_to_trash on public.documents;
CREATE TRIGGER documents_to_trash AFTER DELETE ON public.documents FOR EACH ROW EXECUTE FUNCTION private.trash_document();

drop trigger if exists documents_remito_number on public.documents;
CREATE TRIGGER documents_remito_number BEFORE INSERT ON public.documents FOR EACH ROW EXECUTE FUNCTION private.assign_remito_number();

drop trigger if exists documents_keep_remito_number on public.documents;
CREATE TRIGGER documents_keep_remito_number BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION private.keep_remito_number();

drop trigger if exists documents_audit on public.documents;
CREATE TRIGGER documents_audit AFTER INSERT OR DELETE OR UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION private.audit_documents();

drop trigger if exists sessions_audit on auth.sessions;
CREATE TRIGGER sessions_audit AFTER INSERT OR DELETE ON auth.sessions FOR EACH ROW EXECUTE FUNCTION private.audit_sessions();

drop trigger if exists users_audit on auth.users;
CREATE TRIGGER users_audit AFTER INSERT OR DELETE OR UPDATE OF encrypted_password, email ON auth.users FOR EACH ROW EXECUTE FUNCTION private.audit_accounts();

drop trigger if exists app_roles_audit on public.app_roles;
CREATE TRIGGER app_roles_audit AFTER INSERT OR DELETE OR UPDATE ON public.app_roles FOR EACH ROW EXECUTE FUNCTION private.audit_roles();

drop trigger if exists app_roles_protect_viewer on public.app_roles;
CREATE TRIGGER app_roles_protect_viewer BEFORE DELETE OR UPDATE ON public.app_roles FOR EACH ROW EXECUTE FUNCTION private.protect_audit_viewer();

alter sequence public.firestore_sync_runs_id_seq owned by public.firestore_sync_runs.id;
alter sequence public.audit_log_id_seq owned by public.audit_log.id;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents') then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;
