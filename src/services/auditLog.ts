/**
 * Register of logins and changes. The database writes it on its own and only lets
 * the account set as viewer read it; hiding the screen here is just for tidiness.
 */
import { useEffect, useState } from 'react';
import { supabase } from './supabase';

export interface AuditRow {
  id: number;
  at: string;
  actor: string;
  actor_role?: string | null;
  action: string;
  collection?: string | null;
  doc_id?: string | null;
  label?: string | null;
  detail?: string | null;
  changes?: Record<string, { antes: unknown; despues: unknown }> | null;
  ip?: string | null;
  device?: string | null;
  origin?: string | null;
}

export interface AuditAccess {
  login: string;
  role: string;
  name?: string | null;
  mustChangePassword: boolean;
  lastSignIn?: string | null;
  logins: number;
  changes: number;
  sessions: { since: string; lastUse?: string | null; ip?: string | null; device?: string | null }[];
}

export interface AuditFilter {
  from?: string;
  to?: string;
  actor?: string;
  action?: string;
  search?: string;
  before?: number;
  limit?: number;
}

export async function listAudit(filter: AuditFilter): Promise<{ rows: AuditRow[]; actors: string[] }> {
  // Days are taken in local time; "to" includes the whole day.
  const end = filter.to ? new Date(`${filter.to}T00:00:00`) : null;
  if (end) end.setDate(end.getDate() + 1);
  const { data, error } = await supabase.rpc('audit_list', {
    p_from: filter.from ? new Date(`${filter.from}T00:00:00`).toISOString() : null,
    p_to: end ? end.toISOString() : null,
    p_actor: filter.actor || null,
    p_action: filter.action || null,
    p_search: filter.search?.trim() || null,
    p_before: filter.before ?? null,
    p_limit: filter.limit ?? 100
  });
  if (error) throw new Error(error.message);
  return data as { rows: AuditRow[]; actors: string[] };
}

export async function listAccess(): Promise<AuditAccess[]> {
  const { data, error } = await supabase.rpc('audit_access');
  if (error) throw new Error(error.message);
  return (data as AuditAccess[]) || [];
}

// Whether the signed-in account may open the register.
export function useAuditViewer(accountKey?: string | null): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    setAllowed(false);
    if (!accountKey) return;
    supabase.rpc('audit_is_viewer').then(({ data }: { data: unknown }) => {
      if (active) setAllowed(data === true);
    });
    return () => {
      active = false;
    };
  }, [accountKey]);
  return allowed;
}

// "Android 14 · Chrome", "App Android", "Windows · Edge"…
export function describeDevice(device?: string | null, origin?: string | null): string {
  const d = device || '';
  if (/^https:\/\/localhost$/.test(origin || '') || /; wv\)/.test(d)) return 'App Android';
  if (!d) return '-';
  const os = /Android/.test(d) ? 'Android' : /iPhone|iPad/.test(d) ? 'iPhone/iPad' : /Windows/.test(d) ? 'Windows' : /Mac OS/.test(d) ? 'Mac' : /Linux/.test(d) ? 'Linux' : '';
  const browser = /Edg\//.test(d) ? 'Edge' : /OPR\//.test(d) ? 'Opera' : /Firefox\//.test(d) ? 'Firefox' : /Chrome\//.test(d) ? 'Chrome' : /Safari\//.test(d) ? 'Safari' : '';
  return [os, browser].filter(Boolean).join(' · ') || d.slice(0, 30);
}
