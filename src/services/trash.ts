/**
 * Recycle bin. The database copies every deleted business document to
 * `documents_trash`; these calls list, restore or permanently remove them.
 */
import { supabase } from './supabase';

export interface TrashItem {
  trashId: string;
  collection: string;
  docId: string;
  deletedAt: string;
  deletedBy?: string | null;
  title: string;
  subtitle?: string;
  date?: string;
  amount?: number | null;
  status?: string | null;
}

export async function listTrash(): Promise<TrashItem[]> {
  const { data, error } = await supabase.rpc('list_trash');
  if (error) throw new Error(error.message);
  return (data as TrashItem[]) || [];
}

export async function restoreTrashItem(trashId: string): Promise<void> {
  const { error } = await supabase.rpc('restore_trash_item', { p_trash_id: trashId });
  if (error) throw new Error(error.message);
}

export async function purgeTrashItem(trashId: string): Promise<void> {
  const { error } = await supabase.rpc('purge_trash_item', { p_trash_id: trashId });
  if (error) throw new Error(error.message);
}
