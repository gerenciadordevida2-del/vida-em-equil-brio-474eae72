-- Papéis: admin (proprietário), vip (cliente VIP), user (gratuito)
create type public.app_role as enum ('admin', 'vip', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

-- Cada usuário lê apenas os próprios papéis; ninguém escreve na própria linha.
create policy "own_roles_read" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid());

-- Verificação de papel sem recursão de RLS (usada por políticas e funções).
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Papéis do usuário logado (lido pelo app em qualquer dispositivo/sessão).
create or replace function public.my_roles()
returns setof public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid()
$$;

grant execute on function public.my_roles() to authenticated;

-- Configuração inicial protegida: o PRIMEIRO usuário que chamar vira proprietário
-- somente se ainda não existir nenhum admin. Depois disso, ninguém mais consegue
-- se promover por esta função.
create or replace function public.bootstrap_owner()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.user_roles where role = 'admin') then
    return false;
  end if;
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
  return true;
end;
$$;

grant execute on function public.bootstrap_owner() to authenticated;

-- Lista de usuários para a área administrativa (somente proprietário).
create or replace function public.admin_list_users()
returns table (user_id uuid, email text, display_name text, created_at timestamptz, roles public.app_role[])
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  return query
    select u.id,
           u.email::text,
           coalesce(p.display_name, ''),
           u.created_at,
           coalesce(array_agg(r.role) filter (where r.role is not null), '{}')
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.user_roles r on r.user_id = u.id
    group by u.id, u.email, p.display_name, u.created_at
    order by u.created_at;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- Conceder/revogar VIP (somente proprietário; alvo precisa existir).
create or replace function public.admin_set_vip(_target uuid, _grant boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from auth.users where id = _target) then
    raise exception 'user_not_found';
  end if;
  if _grant then
    insert into public.user_roles (user_id, role) values (_target, 'vip')
    on conflict (user_id, role) do nothing;
  else
    delete from public.user_roles where user_id = _target and role = 'vip';
  end if;
  return true;
end;
$$;

grant execute on function public.admin_set_vip(uuid, boolean) to authenticated;

-- Limite de uso da IA com hierarquia: proprietário sem bloqueio, VIP com limite
-- maior, gratuito com o limite padrão. Mesmos contadores (chat_usage), sem duplicar.
create or replace function public.consume_chat_quota(max_per_minute integer default 10, max_per_day integer default 200)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  lim_min integer;
  lim_day integer;
  minute_count integer;
  day_count integer;
begin
  if uid is null then
    return false;
  end if;

  -- Proprietário: sem bloqueio de cliente (e sem inflar contadores).
  if public.has_role(uid, 'admin') then
    return true;
  end if;

  -- VIP: 5x os limites do plano gratuito.
  if public.has_role(uid, 'vip') then
    lim_min := max_per_minute * 5;
    lim_day := max_per_day * 5;
  else
    lim_min := max_per_minute;
    lim_day := max_per_day;
  end if;

  select coalesce(sum(c.count), 0) into minute_count
    from public.chat_usage c
    where c.user_id = uid and c.window_start >= now() - interval '1 minute';
  if minute_count >= lim_min then
    return false;
  end if;

  select coalesce(sum(c.count), 0) into day_count
    from public.chat_usage c
    where c.user_id = uid and c.window_start >= now() - interval '1 day';
  if day_count >= lim_day then
    return false;
  end if;

  insert into public.chat_usage (user_id, window_start, count) values (uid, now(), 1);
  return true;
end;
$$;

grant execute on function public.consume_chat_quota(integer, integer) to authenticated;