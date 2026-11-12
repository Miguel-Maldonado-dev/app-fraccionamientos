begin;
select plan(4);

select is_empty($$
  select c.relname, a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join lateral aclexplode(c.relacl) a
  where c.relkind in ('r','v','m','p','f','S')
    and a.grantee = 'anon'::regrole
$$, 'anon no tiene privilegios sobre tablas, vistas ni secuencias de public');

select is_empty($$
  select p.proname
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace and n.nspname = 'public'
  where has_function_privilege('anon', p.oid, 'execute')
$$, 'anon no puede ejecutar funciones de public');

select is_empty($$
  select c.relname, a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join lateral aclexplode(c.relacl) a
  where c.relkind in ('r','v','m','p','f')
    and a.grantee = 'authenticated'::regrole
    and a.privilege_type in ('TRUNCATE','TRIGGER','REFERENCES','MAINTAIN')
$$, 'authenticated no tiene TRUNCATE/TRIGGER/REFERENCES/MAINTAIN en public');

select is_empty($$
  select c.relname, a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  cross join lateral aclexplode(c.relacl) a
  where c.relkind in ('r','v','m','p','f')
    and a.grantee = 0
$$, 'PUBLIC no tiene privilegios sobre relaciones de public');

select * from finish();
rollback;
