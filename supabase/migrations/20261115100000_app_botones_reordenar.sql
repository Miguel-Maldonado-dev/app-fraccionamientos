-- Reordenar botones de la app sin violar el único (fraccionamiento_id, orden) ni el check 1–8:
-- el único pasa a diferible y una RPC reasigna `orden` 1..n dentro de una transacción.

alter table public.app_botones
  drop constraint app_botones_fraccionamiento_orden_key,
  add constraint app_botones_fraccionamiento_orden_key
    unique (fraccionamiento_id, orden) deferrable initially immediate;

create function public.reordenar_app_botones(p_fraccionamiento_id bigint, p_ids bigint[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not (select private.es_super_admin()) then
    raise exception 'Sin permiso' using errcode = '42501';
  end if;
  if (select count(*) from public.app_botones where fraccionamiento_id = p_fraccionamiento_id)
       <> coalesce(array_length(p_ids, 1), 0)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) x
                where not exists (select 1 from public.app_botones b
                                  where b.id = x and b.fraccionamiento_id = p_fraccionamiento_id)) then
    raise exception 'La lista no coincide con los botones del fraccionamiento' using errcode = '22023';
  end if;
  set constraints public.app_botones_fraccionamiento_orden_key deferred;
  update public.app_botones b
     set orden = t.n
    from unnest(p_ids) with ordinality as t(id, n)
   where b.id = t.id and b.fraccionamiento_id = p_fraccionamiento_id;
end;
$$;

revoke execute on function public.reordenar_app_botones(bigint, bigint[]) from public, anon;
grant execute on function public.reordenar_app_botones(bigint, bigint[]) to authenticated;
