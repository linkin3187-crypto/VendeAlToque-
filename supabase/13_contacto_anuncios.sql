-- =====================================================================
-- MercaFree · Fase 2S (parte 1 de 2) · Teléfono en anuncios + contacto con cuenta
-- Ejecutar en Supabase → SQL Editor ANTES de fusionar el PR de la fase 2S. Es seguro repetirlo.
-- No quita nada: la página actual sigue funcionando igual después de ejecutarlo.
-- La parte 2 (13b_proteger_contacto.sql) se ejecuta DESPUÉS de fusionar.
--
-- Qué hace:
--  1) `anuncios.telefono`: número para llamadas (celular 3XXXXXXXXX o fijo 60XXXXXXXX). El WhatsApp
--     pasa a ser opcional, pero cada anuncio debe tener al menos uno de los dos.
--  2) `tiene_whatsapp` y `tiene_telefono`: columnas automáticas (sí/no) para saber qué botones mostrar
--     SIN revelar el número.
--  3) `contacto_anuncio(id)`: entrega el WhatsApp y el teléfono SOLO a personas con cuenta.
--     Límite: 60 anuncios distintos por persona al día (contra robots que copian números).
--     El dueño y los moderadores no tienen límite.
--  4) `contactos_anuncio`: registro privado de quién pidió el contacto de qué anuncio (sirve para el
--     límite y, más adelante, para mostrarle al vendedor cuántas personas lo contactaron).
-- =====================================================================

-- ---------- 1. Teléfono y WhatsApp opcional (al menos uno) ----------
alter table public.anuncios
  add column if not exists telefono text check (telefono is null or telefono ~ '^(3[0-9]{9}|60[1-8][0-9]{7})$');

alter table public.anuncios alter column whatsapp drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'anuncios_contacto_requerido') then
    alter table public.anuncios add constraint anuncios_contacto_requerido
      check (whatsapp is not null or telefono is not null);
  end if;
end $$;

-- ---------- 2. ¿Qué botones mostrar? (sin revelar números) ----------
alter table public.anuncios
  add column if not exists tiene_whatsapp boolean generated always as (whatsapp is not null) stored,
  add column if not exists tiene_telefono boolean generated always as (telefono is not null) stored;

-- ---------- 3. Registro privado de contactos ----------
create table if not exists public.contactos_anuncio (
  anuncio_id      bigint not null references public.anuncios(id) on delete cascade,
  usuario_id      uuid   not null references public.perfiles(id) on delete cascade,
  primer_contacto timestamptz not null default now(),
  ultimo_contacto timestamptz not null default now(),
  veces           integer not null default 1,
  primary key (anuncio_id, usuario_id)
);
create index if not exists contactos_usuario_idx on public.contactos_anuncio (usuario_id, primer_contacto desc);
-- Nadie lo lee ni lo escribe directamente: solo la función de abajo (security definer).
alter table public.contactos_anuncio enable row level security;
revoke all on public.contactos_anuncio from anon, authenticated;

-- ---------- 4. Entregar el contacto (solo con cuenta) ----------
create or replace function public.contacto_anuncio(p_id bigint)
returns table (whatsapp text, telefono text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
  v_visible boolean;
begin
  if v_uid is null then
    raise exception 'Crea tu cuenta gratis para ver el contacto del vendedor';
  end if;
  select a.owner_id, (a.estado_publicacion = 'activo' and a.expira_en > now())
    into v_owner, v_visible
    from public.anuncios a where a.id = p_id;
  if not found then
    raise exception 'Este anuncio ya no está disponible';
  end if;

  if v_owner <> v_uid and not public.es_moderador() then
    if not v_visible then
      raise exception 'Este anuncio ya no está disponible';
    end if;
    -- Límite: 60 anuncios DISTINTOS por día (volver a abrir uno ya contactado no cuenta)
    if not exists (select 1 from public.contactos_anuncio c where c.anuncio_id = p_id and c.usuario_id = v_uid)
       and (select count(*) from public.contactos_anuncio c
            where c.usuario_id = v_uid and c.primer_contacto > now() - interval '1 day') >= 60 then
      raise exception 'Llegaste al máximo de contactos por hoy. Vuelve mañana';
    end if;
    insert into public.contactos_anuncio (anuncio_id, usuario_id) values (p_id, v_uid)
    on conflict (anuncio_id, usuario_id)
      do update set ultimo_contacto = now(), veces = public.contactos_anuncio.veces + 1;
  end if;

  return query select a.whatsapp, a.telefono from public.anuncios a where a.id = p_id;
end $$;
revoke execute on function public.contacto_anuncio(bigint) from public, anon;
grant execute on function public.contacto_anuncio(bigint) to authenticated;

-- ---------- 5. Comprobación ----------
-- Debe mostrar 3 filas: telefono, tiene_telefono y tiene_whatsapp.
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'anuncios'
   and column_name in ('telefono', 'tiene_whatsapp', 'tiene_telefono')
 order by column_name;
