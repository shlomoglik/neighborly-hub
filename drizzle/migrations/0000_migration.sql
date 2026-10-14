
create type public.app_role as enum ('admin','user');
create type public.staff_role as enum ('project_manager','building_manager');
create type public.ownership_type as enum ('owner_resident','tenant','owner_non_resident');
create type public.household_status as enum ('pending','approved','rejected');
create type public.visibility_level as enum ('project','building','managers');
create type public.project_visibility as enum ('community','building');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text,
  visibility project_visibility not null default 'community',
  created_at timestamptz not null default now()
);
create table public.buildings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  floors int not null check (floors between 1 and 100),
  units_per_floor int not null check (units_per_floor between 1 and 50),
  created_at timestamptz not null default now()
);
create table public.apartments (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  floor int not null,
  number int not null,
  unique (building_id, number)
);
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  building_id uuid references public.buildings(id) on delete cascade,
  role staff_role not null,
  created_at timestamptz not null default now()
);
create table public.households (
  id uuid primary key default gen_random_uuid(),
  apartment_id uuid not null references public.apartments(id) on delete cascade,
  display_name text not null,
  ownership ownership_type not null,
  avatar_url text,
  status household_status not null default 'pending',
  created_by uuid,
  created_at timestamptz not null default now()
);
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  full_name text not null,
  relation text,
  is_primary boolean not null default false,
  is_child boolean not null default false,
  birth_date date,
  sort int not null default 0
);
create table public.contact_phones (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  number text not null,
  label text,
  visibility visibility_level not null default 'building'
);
create table public.contact_emails (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  email text not null,
  visibility visibility_level not null default 'building'
);

do $$ declare t text; begin
  foreach t in array array['projects','buildings','apartments','staff','households','contacts','contact_phones','contact_emails'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;

create or replace function public.is_project_manager(_uid uuid, _project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(_uid,'admin') or exists (select 1 from public.staff where user_id=_uid and project_id=_project and role='project_manager') $$;

create or replace function public.is_building_manager(_uid uuid, _building uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.buildings b where b.id=_building and (
    public.is_project_manager(_uid,b.project_id)
    or exists (select 1 from public.staff s where s.user_id=_uid and s.building_id=b.id and s.role='building_manager'))) $$;

create or replace function public.is_resident_of_building(_uid uuid, _building uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.households h join public.apartments a on a.id=h.apartment_id
    where h.created_by=_uid and h.status='approved' and a.building_id=_building) $$;

create or replace function public.is_member_of_project(_uid uuid, _project uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_project_manager(_uid,_project)
   or exists (select 1 from public.staff where user_id=_uid and project_id=_project)
   or exists (select 1 from public.households h join public.apartments a on a.id=h.apartment_id join public.buildings b on b.id=a.building_id
    where h.created_by=_uid and h.status='approved' and b.project_id=_project) $$;

create or replace function public.household_building(_hh uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select a.building_id from public.households h join public.apartments a on a.id=h.apartment_id where h.id=_hh $$;

create or replace function public.can_manage_household(_uid uuid, _hh uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_building_manager(_uid, public.household_building(_hh)) $$;

create or replace function public.can_view_household(_uid uuid, _hh uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.households h join public.apartments a on a.id=h.apartment_id join public.buildings b on b.id=a.building_id join public.projects p on p.id=b.project_id
    where h.id=_hh and (
      h.created_by=_uid
      or public.is_building_manager(_uid,b.id)
      or (h.status='approved' and (
        public.is_resident_of_building(_uid,b.id)
        or (p.visibility='community' and public.is_member_of_project(_uid,p.id))
      ))
    )) $$;

create or replace function public.can_view_contact_item(_uid uuid, _contact uuid, _vis visibility_level) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.contacts c join public.households h on h.id=c.household_id join public.apartments a on a.id=h.apartment_id join public.buildings b on b.id=a.building_id
    where c.id=_contact and (
      h.created_by=_uid
      or public.is_building_manager(_uid,b.id)
      or (h.status='approved' and (
        (_vis='building' and public.is_resident_of_building(_uid,b.id))
        or (_vis='project' and public.can_view_household(_uid,h.id))
      ))
    )) $$;

create or replace function public.can_edit_contact(_uid uuid, _contact uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.contacts c join public.households h on h.id=c.household_id
    where c.id=_contact and (h.created_by=_uid or public.can_manage_household(_uid,h.id))) $$;

create policy "own profile read" on public.profiles for select to authenticated using (id=auth.uid() or public.has_role(auth.uid(),'admin') or exists (select 1 from public.staff s where s.user_id=auth.uid() and s.role='project_manager'));
create policy "own profile write" on public.profiles for insert to authenticated with check (id=auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id=auth.uid());
create policy "own roles" on public.user_roles for select to authenticated using (user_id=auth.uid());

create policy "projects read" on public.projects for select to authenticated using (true);
create policy "projects insert" on public.projects for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "projects update" on public.projects for update to authenticated using (public.is_project_manager(auth.uid(),id));
create policy "projects delete" on public.projects for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create policy "buildings read" on public.buildings for select to authenticated using (true);
create policy "buildings write" on public.buildings for insert to authenticated with check (public.is_project_manager(auth.uid(),project_id));
create policy "buildings update" on public.buildings for update to authenticated using (public.is_project_manager(auth.uid(),project_id));
create policy "buildings delete" on public.buildings for delete to authenticated using (public.is_project_manager(auth.uid(),project_id));

create policy "apartments read" on public.apartments for select to authenticated using (true);
create policy "apartments write" on public.apartments for insert to authenticated with check (public.is_building_manager(auth.uid(),building_id));
create policy "apartments delete" on public.apartments for delete to authenticated using (public.is_building_manager(auth.uid(),building_id));

create policy "staff read" on public.staff for select to authenticated using (user_id=auth.uid() or public.is_member_of_project(auth.uid(),project_id));
create policy "staff write" on public.staff for insert to authenticated with check (public.is_project_manager(auth.uid(),project_id));
create policy "staff delete" on public.staff for delete to authenticated using (public.is_project_manager(auth.uid(),project_id));

create policy "hh read" on public.households for select to authenticated using (public.can_view_household(auth.uid(),id));
create policy "hh insert" on public.households for insert to authenticated with check (created_by=auth.uid() and status='pending');
create policy "hh update" on public.households for update to authenticated using (created_by=auth.uid() or public.can_manage_household(auth.uid(),id));
create policy "hh delete" on public.households for delete to authenticated using (created_by=auth.uid() or public.can_manage_household(auth.uid(),id));

create policy "contacts read" on public.contacts for select to authenticated using (public.can_view_household(auth.uid(),household_id));
create policy "contacts insert" on public.contacts for insert to authenticated with check (exists (select 1 from public.households h where h.id=household_id and (h.created_by=auth.uid() or public.can_manage_household(auth.uid(),h.id))));
create policy "contacts update" on public.contacts for update to authenticated using (public.can_edit_contact(auth.uid(),id));
create policy "contacts delete" on public.contacts for delete to authenticated using (public.can_edit_contact(auth.uid(),id));

create policy "phones read" on public.contact_phones for select to authenticated using (public.can_view_contact_item(auth.uid(),contact_id,visibility));
create policy "phones insert" on public.contact_phones for insert to authenticated with check (public.can_edit_contact(auth.uid(),contact_id));
create policy "phones update" on public.contact_phones for update to authenticated using (public.can_edit_contact(auth.uid(),contact_id));
create policy "phones delete" on public.contact_phones for delete to authenticated using (public.can_edit_contact(auth.uid(),contact_id));

create policy "emails read" on public.contact_emails for select to authenticated using (public.can_view_contact_item(auth.uid(),contact_id,visibility));
create policy "emails insert" on public.contact_emails for insert to authenticated with check (public.can_edit_contact(auth.uid(),contact_id));
create policy "emails update" on public.contact_emails for update to authenticated using (public.can_edit_contact(auth.uid(),contact_id));
create policy "emails delete" on public.contact_emails for delete to authenticated using (public.can_edit_contact(auth.uid(),contact_id));

create or replace function public.guard_household_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status and not public.can_manage_household(auth.uid(), new.id) then
    raise exception 'Only managers can change approval status';
  end if;
  if new.apartment_id is distinct from old.apartment_id and not public.can_manage_household(auth.uid(), new.id) then
    raise exception 'Only managers can move households';
  end if;
  return new;
end $$;
create trigger households_guard before update on public.households for each row execute function public.guard_household_status();

create or replace function public.child_phone_default() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.contacts where id=new.contact_id and is_child) and new.visibility='building' then
    new.visibility := 'managers';
  end if;
  return new;
end $$;
create trigger phones_child_default before insert on public.contact_phones for each row execute function public.child_phone_default();

create or replace function public.generate_apartments() returns trigger
language plpgsql security definer set search_path = public as $$
declare f int; u int; n int := 1;
begin
  for f in 1..new.floors loop
    for u in 1..new.units_per_floor loop
      insert into public.apartments(building_id,floor,number) values (new.id,f,n);
      n := n + 1;
    end loop;
  end loop;
  return new;
end $$;
create trigger buildings_generate after insert on public.buildings for each row execute function public.generate_apartments();

create or replace function public.assign_staff(_email text, _project uuid, _building uuid, _role staff_role) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_project_manager(auth.uid(), _project) then raise exception 'Forbidden'; end if;
  select id into uid from auth.users where lower(email)=lower(trim(_email));
  if uid is null then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.staff(user_id,project_id,building_id,role) values (uid,_project,_building,_role);
end $$;
revoke execute on function public.assign_staff from anon;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'), new.email)
  on conflict do nothing;
  insert into public.user_roles(user_id, role) values (new.id, 'user') on conflict do nothing;
  if lower(coalesce(new.email,'')) = 'shlomoglik@gmail.com' then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

do $$
declare pid uuid; bid uuid; i int; apt uuid; hh uuid; c uuid;
  names text[] := array['משפחת כהן','משפחת לוי','משפחת מזרחי','משפחת פרץ','משפחת ביטון','משפחת אברהם','משפחת פרידמן','משפחת שפירו','משפחת אזולאי','משפחת גולן','משפחת ברק','משפחת רוזן','משפחת דהן','משפחת סויסה','משפחת קפלן','משפחת איבנוב'];
  firsts text[] := array['יוסי','רונית','משה','מיכל','אבי','שירה','דוד','נועה','איתן','יעל','אלון','טל','חיים','אורית','גיל','אולגה'];
  kids text[] := array['נועם','מאיה','אורי','תמר','איתי','שקד','עומר','ליה'];
  own ownership_type[] := array['owner_resident','tenant','owner_resident','owner_non_resident']::ownership_type[];
  k int := 0;
begin
  insert into public.projects(name, city, visibility) values ('המושבה העירונית שדרות','שדרות','community') returning id into pid;
  for i in 1..8 loop
    insert into public.buildings(project_id,name,floors,units_per_floor) values (pid, 'בניין '||i, 6, 4) returning id into bid;
    for apt in select id from public.apartments where building_id=bid order by number limit 2 loop
      k := k + 1;
      insert into public.households(apartment_id,display_name,ownership,status) values (apt, names[k], own[1 + (k % 4)], 'approved') returning id into hh;
      insert into public.contacts(household_id,full_name,relation,is_primary,birth_date,sort)
        values (hh, firsts[k]||' '||replace(names[k],'משפחת ',''), 'ראש משפחה', true, (current_date - ((35 + k)*365) + (k*5 % 60)), 0) returning id into c;
      insert into public.contact_phones(contact_id,number,label,visibility) values (c, '05'||(2+(k%3))||'-'||lpad(((k*7919) % 10000000)::text,7,'0'), 'נייד', case when k%3=0 then 'building' else 'project' end::visibility_level);
      insert into public.contact_emails(contact_id,email,visibility) values (c, 'family'||k||'@example.com','building');
      insert into public.contacts(household_id,full_name,relation,is_child,birth_date,sort)
        values (hh, kids[1+(k%8)], 'ילד/ה', true, (current_date - ((6+k%10)*365) + ((k*13) % 40)), 1);
    end loop;
  end loop;
  insert into public.households(apartment_id,display_name,ownership,status)
    select a.id, 'משפחת חדשים', 'tenant', 'pending' from public.apartments a join public.buildings b on b.id=a.building_id where b.project_id=pid and b.name='בניין 1' and a.number=5;
end $$;
