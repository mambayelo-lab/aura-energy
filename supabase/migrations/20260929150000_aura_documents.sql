-- Dépôt des gros documents (au-delà de 50 Mo) : chaque utilisateur n'accède qu'à son dossier.
insert into storage.buckets (id, name, public, file_size_limit)
values ('aura-documents', 'aura-documents', false, 524288000)
on conflict (id) do nothing;

create policy "aura_documents_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'aura-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "aura_documents_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'aura-documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "aura_documents_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'aura-documents' and (storage.foldername(name))[1] = auth.uid()::text);
