-- =====================================================================
-- MercaFree · Fase 2AA.1 · Verificación con el criterio del moderador
-- Ejecutar en Supabase → SQL Editor (antes o después de fusionar). Es seguro repetirlo. Requiere 06.
--
-- Qué cambia:
--  · La foto de la fachada YA NO es obligatoria para verificar en persona (sigue siendo recomendable).
--  · Para aprobar basta el punto principal de la lista:
--      en persona → «El local existe y atiende en esta dirección» (lista.existe = true)
--      por teléfono → «Confirmé el nombre y la dirección» (lista.nombre_dir = true)
--    Los demás puntos son opcionales y quedan guardados tal cual en el historial (columna lista).
--  · Las verificaciones viejas no se tocan (la regla nueva solo revisa las que se registren desde ahora).
-- =====================================================================

alter table public.verificaciones_comercio drop constraint if exists verif_visita_foto;

alter table public.verificaciones_comercio drop constraint if exists verif_minimo;
alter table public.verificaciones_comercio add constraint verif_minimo check (
  resultado = 'rechazada'
  or (metodo = 'visita'   and coalesce((lista->>'existe')::boolean, false))
  or (metodo = 'telefono' and coalesce((lista->>'nombre_dir')::boolean, false))
) not valid;

-- Comprobación: debe mostrar 1 fila con foto_opcional = true y minimo = true.
select not exists (select 1 from pg_constraint where conname = 'verif_visita_foto') as foto_opcional,
       exists (select 1 from pg_constraint where conname = 'verif_minimo') as minimo;
