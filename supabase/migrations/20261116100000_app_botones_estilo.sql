alter table public.app_botones
  add column estilo text not null default 'azul_claro',
  add constraint app_botones_estilo_check
    check (estilo in ('azul', 'azul_claro', 'navy', 'turquesa'));

create or replace function public.estado_app_domicilio(p_domicilio_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dom record;
  v_moroso boolean;
  v_puede boolean;
begin
  if not coalesce(private.es_residente_de(p_domicilio_id), false) then
    raise exception 'No autorizado' using errcode = '42501';
  end if;

  select d.id, d.direccion, d.titular_id, f.id as fraccionamiento_id, f.nombre, f.instalacion_id
    into v_dom
  from public.domicilios d
  join public.fraccionamientos f on f.id = d.fraccionamiento_id
  where d.id = p_domicilio_id;

  v_moroso := coalesce(private.moroso_efectivo(p_domicilio_id), false);
  v_puede := not v_moroso and v_dom.instalacion_id is not null and v_dom.titular_id is not null;

  return jsonb_build_object(
    'domicilio', jsonb_build_object('id', v_dom.id, 'direccion', v_dom.direccion),
    'fraccionamiento', jsonb_build_object('nombre', v_dom.nombre),
    'moroso', v_moroso,
    'pin', (select p.pin from public.pines_acceso p where p.domicilio_id = p_domicilio_id),
    'botones', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', b.id,
               'orden', b.orden,
               'nombre', b.nombre,
               'icono', b.icono,
               'ancho_completo', b.ancho_completo,
               'estilo', b.estilo,
               'habilitado', v_puede and b.salida_id is not null
             ) order by b.orden)
      from public.app_botones b
      where b.fraccionamiento_id = v_dom.fraccionamiento_id
    ), '[]'::jsonb)
  );
end;
$$;
