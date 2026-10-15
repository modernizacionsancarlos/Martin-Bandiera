# Migración a Firebase Auth y reglas cerradas

Este documento describe cómo poner en producción el cambio de autenticación. El orden importa:
si se publican las reglas nuevas antes de que existan las cuentas y la versión nueva de la app,
nadie podrá entrar.

## Qué cambió

- El inicio de sesión usa Firebase Auth (correo y contraseña). Ya no hay claves maestras
  (`123456`, `admin`, el nombre del rol), ni sesión automática de SuperAdmin, ni botones
  "Probar sesión" / "Iniciar sesión como".
- Las contraseñas ya no se guardan en Firestore ni en el código. El campo `password` se elimina
  de los perfiles.
- El rol que valida Firestore está en `/userRoles/{authUid}`. Solo un administrador puede
  escribirlo. Cada perfil de `/users` guarda su `authUid`.
- Las reglas nuevas (`firestore.rules.next`) dejan de aceptar `if true` y exigen sesión y rol activo. Las colecciones
  financieras (`financials`, `archivedReceipts`) son solo para administradores.
- `/api/ai/scan-remito` exige sesión y rol activo, limita a 40 pedidos cada 10 minutos por
  usuario y acepta cuerpos de hasta 15 MB.
- El sistema es de un único cliente: el campo `tenantId` queda obsoleto y ya no se usa.

## Pasos

1. **Respaldo.** Ya existe en `backups/<fecha>/` (carpeta ignorada por git). Para repetirlo:
   `node scripts/export_firestore.mjs`. Hágalo antes de cualquier cambio de reglas.
2. **Habilitar el acceso por correo.** En la consola de Firebase: Authentication, Sign-in method,
   habilitar "Correo electrónico/contraseña".
3. **Dominios autorizados.** En Authentication, Settings, Authorized domains, agregar el dominio
   donde corre la app (necesario para el enlace de restablecer contraseña).
4. **Clave de servicio.** En Configuración del proyecto, Cuentas de servicio, generar una clave
   privada. Guárdela fuera del repositorio.
5. **Primero solo el administrador (simulación).**
   `node scripts/migrate_to_firebase_auth.mjs --key=<ruta> --only=admin@admin.com`
6. **Crear ese administrador.** Misma línea con `--apply`. Crea la cuenta con una contraseña
   temporal aleatoria y la guarda en `backups/credenciales_<fecha>.csv`. No borra ni modifica
   datos: solo agrega `authUid` al perfil y crea `/userRoles/<uid>`.
   Con esa cuenta ya se puede probar el ingreso en la versión nueva, mientras producción sigue
   funcionando con la versión anterior.
7. **Migrar al resto.** Sin `--only`, primero en simulación y luego con `--apply`.
8. **Publicar la versión nueva de la app.** Debe estar en línea antes que las reglas.
9. **Probar el ingreso** con un SuperAdmin del CSV. Cada persona debe cambiar su contraseña con
   "Olvidé mi contraseña".
10. **Publicar las reglas.** Las reglas nuevas están en `firestore.rules.next`; `firestore.rules` conserva
    las que están publicadas hoy a propósito, para que AI Studio u otra herramienta no publique las nuevas
    antes de tiempo. Recién en este paso, copie el contenido de `firestore.rules.next` sobre `firestore.rules` y
    péguelo en la consola (Firestore, Reglas) o ejecute `firebase deploy --only firestore:rules` (requiere
    `firebase login` y un `firebase.json`).
11. **Verificar por rol:** SuperAdmin, Admin, Capataz y Empleado. Pruebe cargar un remito,
    abrir proyectos y, como administrador, crear un usuario.
12. **Limpieza.** Entregue y borre el CSV de contraseñas, y elimine la clave de servicio.

## Datos en producción

Ningún paso borra datos. El respaldo (paso 1) debe repetirse justo antes de empezar, porque el
sistema sigue recibiendo remitos. La migración solo agrega `authUid` a los perfiles y crea la
colección `/userRoles`. El campo `password` se conserva hasta que se ejecute
`--strip-passwords`, para que la versión anterior siga funcionando. Hágalo después del paso 9.

## Marcha atrás

Si algo falla después de publicar las reglas, vuelva a pegar las reglas anteriores
(el `firestore.rules` original del repositorio). Los datos no se modifican salvo `authUid` y la eliminación del
campo `password` en `/users`.

## Limitaciones conocidas

- Las reglas validan el rol, no los permisos personalizados (`customPermissions`). Un permiso
  personalizado oculta pantallas en la app, pero no abre colecciones que las reglas cierran.
- El ingreso acepta el correo completo y unos pocos alias definidos en
  `src/services/authService.ts`. Ya no se puede entrar con solo el nombre.
- Los perfiles creados por un Capataz o Empleado en `/users` y `/workers` (por ejemplo, al
  agregar personal desde un parte de campo) son rechazados por las reglas, que reservan esas
  colecciones a los administradores. Se verá una advertencia en la consola del navegador.
- Eliminar un usuario desde la app desactiva su acceso (`userRoles.active = false`), pero la
  cuenta de Firebase Auth sigue existiendo. Bórrela desde la consola si corresponde.
- Mientras las reglas anteriores (`if true`) estuvieron activas, cualquier persona con el
  identificador del proyecto podía leer y modificar los datos. Revise si hubo accesos
  inesperados y cambie las contraseñas que se hayan reutilizado en otros sitios.
