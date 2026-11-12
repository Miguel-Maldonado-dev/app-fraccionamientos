begin;
select plan(7);

select results_eq('select id, name from public.estatus order by id',
  $$values (1::bigint,'Pendiente'),(2,'Pagado'),(3,'Vencido')$$, 'estatus con ids fijos');
select results_eq('select count(*)::int from public.anios', 'values (11)', '11 años');

set local role authenticated;
select isnt_empty('select 1 from public.meses', 'authenticated lee meses');
select throws_ok('insert into public.meses (name) values (''X'')', '42501', null, 'authenticated no escribe catálogos');

reset role;
set local role anon;
select throws_ok('select 1 from public.meses', '42501', null, 'anon no lee catálogos');

select is_empty($$
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join lateral aclexplode(c.relacl) a
  join pg_roles r on r.oid = a.grantee
  where c.relname in ('estatus','meses','anios','metodos_pago','tipo_pago','tipos_movimientos')
    and r.rolname = 'anon'
$$, 'anon no tiene ningún privilegio en catálogos');
select is_empty($$
  select c.relname, a.privilege_type from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join lateral aclexplode(c.relacl) a
  join pg_roles r on r.oid = a.grantee
  where c.relname in ('estatus','meses','anios','metodos_pago','tipo_pago','tipos_movimientos')
    and r.rolname = 'authenticated' and a.privilege_type <> 'SELECT'
$$, 'authenticated solo tiene SELECT en catálogos');

select * from finish();
rollback;
