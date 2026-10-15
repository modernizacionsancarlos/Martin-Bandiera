# Administración de usuarios desde el servidor

**Estado:** hecho en la rama y probado (emuladores de Auth y Firestore, y demo). Sin publicar. No toca producción.

## Qué resuelve
Antes, el navegador del administrador creaba las cuentas con una app secundaria de Firebase. Eso exigía dejar abierto el registro público, no permitía fijar la clave de otro usuario, y "eliminar" un usuario solo lo marcaba inactivo (la cuenta de acceso seguía viva). Ahora esas operaciones las hace el servidor (`server/adminUsers.ts`, con firebase-admin).

## Qué puede hacer un administrador
Todas las operaciones exigen una cuenta con rol SuperAdmin, Owner, Gerente o Admin, activa y sin clave temporal pendiente.

| Operación | Ruta | Resultado |
|---|---|---|
| Crear cuenta | `POST /api/admin/users` | Crea la cuenta con una clave temporal de 12 caracteres. La clave se devuelve una sola vez y no se guarda. |
| Restablecer clave | `POST /api/admin/users/:authUid/reset-password` | Nueva clave temporal, cierra las sesiones abiertas del usuario. |
| Habilitar o deshabilitar | `POST /api/admin/users/:authUid/disabled` | Bloquea o devuelve el acceso; la cuenta y sus datos se conservan. |
| Eliminar | `DELETE /api/admin/users/:authUid` | Borra la cuenta de acceso y su rol. |
| Cambiar la clave propia | `POST /api/admin/me/change-password` | El usuario elige su clave definitiva. |

Reglas de negocio: nadie opera sobre su propia cuenta en restablecer, deshabilitar o eliminar; solo un SuperAdmin crea o administra a otro SuperAdmin.

## Clave temporal con cambio obligatorio
1. La cuenta nueva (o con clave restablecida) queda marcada con `mustChangePassword` en `userRoles/{uid}`.
2. Mientras exista esa marca, **las reglas de Firestore no le dan acceso a ningún dato** (solo puede leer su propio rol). No depende de la pantalla.
3. Al ingresar, la aplicación muestra la pantalla "Elegí tu contraseña" (mínimo 8 caracteres, con letras y números).
4. El cambio lo hace el servidor, que recién entonces quita la marca. El navegador no puede quitarla (las reglas lo impiden).
5. La interfaz de administración muestra la clave temporal una sola vez, con botón para copiarla.

Esto resuelve el caso de los capataces cuyo correo todavía no está disponible: el administrador entrega la clave temporal en persona o por el medio que prefiera, y el capataz la reemplaza en su primer ingreso. Cuando los correos reales estén disponibles, "Olvidé mi contraseña" sigue funcionando por correo.

## Pruebas (requieren Java)
En `scripts/rules-test/`: `npm install`, y luego:
- `npm test`: 50 pruebas de las reglas de Firestore (incluye la clave temporal pendiente).
- `npm run test:admin`: 40 pruebas del servidor de usuarios contra emuladores de Auth y Firestore (acceso, alta, cambio de clave, restablecer, deshabilitar, eliminar, permisos entre roles).

## Antes de publicar en producción
1. **Credenciales del servidor.** firebase-admin necesita una cuenta de servicio. En Cloud Run se usa la cuenta de servicio del servicio, con los roles **Firebase Authentication Admin** y **Cloud Datastore User**. En una máquina local requiere `GOOGLE_APPLICATION_CREDENTIALS`. Sin credenciales, las rutas devuelven error y el resto del sistema sigue funcionando.
2. **Desactivar el registro público** (alta de usuarios por el cliente) en Firebase Authentication, una vez publicado el sistema nuevo.
3. Publicar primero el sistema nuevo y recién después `firestore.rules.next` (ver `docs/MIGRACION_AUTH.md`). Las reglas nuevas exigen el campo `mustChangePassword` ausente o falso; las cuentas existentes no lo tienen, por lo que no se ven afectadas.
4. `firebase-admin` pasó de devDependencies a dependencies (lo necesita el servidor en ejecución).

## Archivos
`server/adminUsers.ts`, `server.ts` (monta las rutas, deshabilitadas en la demo), `src/services/adminUsersApi.ts`, `src/components/ChangePasswordPage.tsx`, `src/context/AuthContext.tsx`, `src/components/UserManagementView.tsx`, `src/services/firestoreSync.ts`, `firestore.rules.next`, `src/demo/adminUsersDemo.ts` y `src/demo/authShim.ts` (la demo hace lo mismo en el navegador), `scripts/admin-api.test.ts`, `scripts/rules-test/`.
