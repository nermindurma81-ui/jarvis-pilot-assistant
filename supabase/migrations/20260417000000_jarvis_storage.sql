-- Jarvis uploads bucket (any file, any size — practically unlimited via service role)
insert into storage.buckets (id, name, public, file_size_limit)
values ('jarvis-uploads', 'jarvis-uploads', true, null)
on conflict (id) do update set public = true, file_size_limit = null;

-- Public read, anonymous write (no auth required for this single-user tool)
create policy "jarvis_uploads_read"
on storage.objects for select
using (bucket_id = 'jarvis-uploads');

create policy "jarvis_uploads_write"
on storage.objects for insert
with check (bucket_id = 'jarvis-uploads');

create policy "jarvis_uploads_update"
on storage.objects for update
using (bucket_id = 'jarvis-uploads');

create policy "jarvis_uploads_delete"
on storage.objects for delete
using (bucket_id = 'jarvis-uploads');
