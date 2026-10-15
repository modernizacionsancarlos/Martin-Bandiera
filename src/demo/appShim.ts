/**
 * Sustituto local de 'firebase/app' para el MODO DEMO. No inicializa ningún SDK real.
 */
const apps = new Map<string, any>();

export function initializeApp(_options?: any, name: string = '[DEFAULT]') {
  const app = { name, options: _options || {} };
  apps.set(name, app);
  return app as any;
}

export function getApps() {
  return Array.from(apps.values());
}

export function getApp(name: string = '[DEFAULT]') {
  const app = apps.get(name);
  if (!app) throw new Error(`No hay app de demo con el nombre ${name}`);
  return app;
}

export async function deleteApp(app: any) {
  apps.delete(app?.name);
}
