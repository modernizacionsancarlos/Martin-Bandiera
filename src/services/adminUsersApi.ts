import { getCurrentIdToken } from './authService';

/**
 * Operaciones de cuentas de acceso que solo puede hacer el servidor (firebase-admin):
 * alta con clave temporal, restablecer clave, deshabilitar, eliminar y cambio de clave propio.
 * En la demo se resuelven en el navegador (src/demo/adminUsersDemo.ts).
 */
export type ApiResult<T = {}> = ({ success: true } & T) | { success: false; message: string };

async function request<T>(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<ApiResult<T>> {
  const token = await getCurrentIdToken();
  if (!token) return { success: false, message: 'Se requiere iniciar sesión.' };
  try {
    const res = await fetch(`/api/admin${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) return data as ApiResult<T>;
    return { success: false, message: data.error || 'No se pudo completar la operación.' };
  } catch {
    return { success: false, message: 'Sin conexión con el servidor. Verifique su acceso a internet.' };
  }
}

export interface CreateAccountInput {
  email: string;
  displayName?: string;
  role?: string;
  active?: boolean;
}

export async function createManagedAccount(
  input: CreateAccountInput
): Promise<ApiResult<{ authUid: string; temporaryPassword: string }>> {
  if (__DEMO__) return (await import('../demo/adminUsersDemo')).createAccount(input);
  return request('POST', '/users', input);
}

export async function resetManagedPassword(authUid: string): Promise<ApiResult<{ temporaryPassword: string }>> {
  if (__DEMO__) return (await import('../demo/adminUsersDemo')).resetPassword(authUid);
  return request('POST', `/users/${encodeURIComponent(authUid)}/reset-password`);
}

export async function setManagedAccountDisabled(authUid: string, disabled: boolean): Promise<ApiResult> {
  if (__DEMO__) return (await import('../demo/adminUsersDemo')).setDisabled(authUid, disabled);
  return request('POST', `/users/${encodeURIComponent(authUid)}/disabled`, { disabled });
}

export async function deleteManagedAccount(authUid: string): Promise<ApiResult> {
  if (__DEMO__) return (await import('../demo/adminUsersDemo')).removeAccount(authUid);
  return request('DELETE', `/users/${encodeURIComponent(authUid)}`);
}

/** El usuario elige su clave definitiva. Después hay que volver a iniciar sesión con la clave nueva. */
export async function changeOwnPassword(newPassword: string): Promise<ApiResult> {
  if (__DEMO__) return (await import('../demo/adminUsersDemo')).changeOwnPassword(newPassword);
  return request('POST', '/me/change-password', { newPassword });
}
