# Análisis de la consola de Firebase y de las bases de datos

Fecha: 14 de octubre de 2026. Todo lo que figura aquí se obtuvo en modo solo lectura: se miraron pantallas de la consola y se leyeron las bases con el SDK del navegador, sin escribir, borrar ni cambiar ninguna configuración. Se hicieron varios miles de lecturas de documentos (respaldos y comparación), que figuran en el uso de Firestore.

## 1. Proyecto actual (producción)

- **Proyecto:** "Default Gemini Project" (`gen-lang-client-0133313162`), creado por AI Studio. Plan Blaze con un crédito de USD 299,99 que vence el 28 de diciembre de 2026. Después de esa fecha se paga por uso: conviene confirmar que la cuenta de facturación tiene un medio de pago vigente.
- **Base de datos:** una sola, `ai-studio-jobmartinbandier-d44d882d-1592-4457-b7d7-d21ee05f7b01`, modo nativo, edición Enterprise, región `us-west1`.
  - Está marcada "cuota compartida de IA": la consola avisa que está sujeta a límites de cuota y ofrece "Actualizar base de datos" para pasar a facturación de pago por uso.
  - **Copias de seguridad programadas: deshabilitadas.** No se pudo ver el estado de la recuperación a un punto en el tiempo.
  - No hay presupuesto ni alertas de gasto creadas (la consola lo sugiere).
- **Reglas publicadas hoy:** abiertas, `allow read, write: if true` en todas las colecciones. Cualquiera con el identificador del proyecto puede leer y modificar los datos.
- **Authentication:** correo/contraseña y Google están habilitados. Existe **un solo usuario** de acceso. Autenticación en dos pasos y verificación de aplicaciones sin configurar. Por eso no hay cuentas para el personal: el sistema actual valida las claves en el navegador.
- **Permisos (IAM):** hay **un único miembro humano**, con rol Propietario y una cuenta personal de Gmail, más 7 cuentas de servicio. Si esa cuenta se pierde o se bloquea, nadie más puede administrar el proyecto ni la base del cliente.
- **Servidor:** un servicio de Cloud Run, `job-martin-bandiera` (`us-west1`), actualizado por última vez el 28 de septiembre de 2026. Tiene una asignación de dominio: `job-martin-bandiera-1.ai.studio`, agregada el 28 de septiembre de 2026. Es un subdominio de AI Studio, no un dominio del cliente.
- **Dominios autorizados de Authentication:** 10, de al menos tres proyectos de Google distintos (números 259895764830, 192820061976 y 565708535243), más `job-martin-bandiera.ai.studio` y `job-martin-bandiera-1.ai.studio`.

## 2. Qué pasó con el cambio de URL

La consola muestra que la aplicación vivió en **tres proyectos de Google distintos**. Cada vez que AI Studio la recreó, generó un proyecto, una URL y una base nuevos:

| Proyecto (número) | Qué queda |
|---|---|
| 259895764830 (`us-east1`) | Solo sus URLs `ais-dev/pre/shared/mob` en los dominios autorizados. No aparece en la cuenta. |
| 192820061976, `future-apricot-m8chg` | **Sigue activo** y contiene una base con el mismo nombre que la actual, con datos reales hasta el 24 de septiembre de 2026. También tiene otras dos bases de otras apps. |
| 565708535243, `gen-lang-client-0133313162` | Producción actual. La URL cambió el 28 de septiembre de 2026 (`job-martin-bandiera.ai.studio` pasó a `job-martin-bandiera-1.ai.studio`). |

El nombre de la base se conservó, pero cada proyecto tiene su propia copia. Lo cargado en el proyecto anterior no pasa solo al nuevo. Además, el sistema guarda copias en el navegador, que pertenecen a cada URL.

## 3. Comparación de las dos bases

Cantidades de documentos. "Distintos" son los que existen en ambas con contenido diferente.

| Colección | Actual | Anterior | Solo anterior | Solo actual | Distintos |
|---|---|---|---|---|---|
| Remitos (`auditRecords`) | 496 | 417 | 48 | 127 | 316 |
| Clientes | 466 | 461 | 0 | 5 | 0 |
| Usuarios | 21 | 26 | 16 | 11 | 10 |
| Personal (`workers`) | 17 | 19 | 9 | 7 | 3 |
| Comprobantes | 25 | 1 | 1 | 25 | 0 |
| Materiales | 6 | 6 | 0 | 0 | 0 |
| Vehículos y eventos | 4 y 12 | 0 y 0 | 0 | 16 | 0 |

**La base actual es la más reciente y la que usa el cliente.** Su último comprobante se creó el 13 de octubre de 2026; la anterior terminó el 24 de septiembre. De los 316 remitos distintos, 32 avanzaron de estado en la actual (25 de Cargado a Facturado y 7 de Facturado a Cobrado) y ninguno retrocedió. Por eso la regla para no generar conflictos es: **la actual manda; nada de la anterior pisa a la actual.**

### Lo que existe solo en la base anterior

- **48 remitos** con identificador `AUD-IMP-…` (importados desde Excel; 47 de ellos), fechados entre el 7 de abril y el 1 de septiembre de 2026, todos en estado "Cargado", de 18 clientes. Solo 1 de los 48 remitos pertenece a un cliente que existe hoy en la base de clientes, y ninguno tiene su número de remito ya presente con otro identificador. Todo indica una importación anterior que después se reemplazó, pero **solo el cliente puede confirmarlo.**
- **1 comprobante** de remito pasado (`ARC-887879`, 24 de septiembre de 2026, $1.384.534,30) que referencia 4 remitos que hoy no existen en ninguna de las dos bases.
- **2 perfiles de usuario y 1 de personal** cuyo correo no existe hoy. Los otros 14 perfiles de usuario y 8 del personal son duplicados de personas que sí están en la base actual con otro identificador.
- Documentos de configuración (`connection_audit` y `status`).

El archivo `backups/REVISAR_datos_solo_en_base_anterior.csv` (52 filas, fuera de git) lista todo esto para que el cliente decida qué recuperar.

## 4. Problemas de calidad en la base actual

- **Contraseñas en texto plano:** 21 de 21 usuarios tienen la clave guardada en su documento.
- **Una fecha mal cargada:** el remito `AUD-9185` figura con fecha `0009-09-23`. Lo más probable es un error de tipeo del año.
- **Datos que coinciden con los de ejemplo del código:** los 4 vehículos y los 12 eventos de vehículos tienen identificadores del código (`veh_01`, `evt_001`…), y los 6 materiales también. Los escribió el relleno automático del sistema. Puede que el cliente los haya editado y sean reales; conviene confirmarlo.
- Los remitos con identificador de ejemplo son 0, y los clientes con identificador de ejemplo, 1 de 466.

## 4 bis. Lo observado en la aplicación en producción (14 de octubre de 2026)

Se miró la pestaña abierta en `job-martin-bandiera-1.ai.studio`, sin hacer clic en nada que guarde datos.

- **Funciona y está conectada a la base correcta.** Sin errores en la consola; el navegador guarda estado de Firestore del proyecto `gen-lang-client-0133313162` y de la base `ai-studio-jobmartinbandier-...`.
- **Los números de la pantalla coinciden con la base:** 496 remitos (373 cargados, 110 facturados, 4 pasados y 9 cobrados), 466 clientes, 25 comprobantes, 4 vehículos con 12 eventos y 6 materiales. Los identificadores de estas seis colecciones son idénticos a los de la base: no hay datos que existan solo en el navegador.
- **Entra sin pedir clave.** La sesión abrió directamente como "Juan Pablo, SuperAdmin". Es el comportamiento que se corrige en la rama.
- **El navegador guarda una copia completa de los datos** (684 KB en 34 claves de localStorage: remitos, clientes, comprobantes, personal, flota) y **dos claves con contraseñas en texto** (la lista de usuarios y la sesión actual).
- **Diferencias entre la pantalla y la base, sin impacto en los datos:**
  - Personal: 19 en pantalla y 17 en la base. Las dos diferencias (`WRK-SUPER_ALIAS` y `WRK-VALENTIN_KOREIN`) son entradas que la propia aplicación arma en el navegador para dos cuentas de administración.
  - Usuarios: 19 en pantalla y 21 en la base. Faltan `usr_adm_04` (Admin) y `usr_admin_02` (Owner): se "eliminaron" desde la aplicación el 28 de septiembre, pero eso solo las marca en `systemSettings/deleted_users`; **sus documentos siguen en la base.**
- Proyectos y mantenimiento figuran en 0, igual que en la base.

La migración de usuarios (`scripts/migrate_to_firebase_auth.mjs`) ya omite a los usuarios marcados como eliminados, para no crear cuentas de acceso a personas dadas de baja.

## 4 ter. Cambios hechos en la consola

- **14 de octubre de 2026: copias de seguridad programadas activadas** en la base `ai-studio-jobmartinbandier-d44d882d-...`: frecuencia diaria, retención de 7 días (el valor por defecto de la consola era 98), sin copias semanales. Autorizado expresamente por la persona propietaria del proyecto. Se cobra por el almacenamiento de las copias. La recuperación a un punto en el tiempo sigue desactivada, porque no se autorizó.
- **14 de octubre de 2026: recuperación a un punto en el tiempo activada**, con 7 días de retención. Permite volver a ver y recuperar datos borrados o cambiados por error en la última semana.
- **14 de octubre de 2026: base pasada al modelo de pago por uso.** Se quitaron los límites de la "cuota compartida de IA"; el uso se factura según los precios de Firestore (hay un crédito de USD 299,99 hasta el 28 de diciembre de 2026).
- **14 de octubre de 2026: presupuesto "Alerta mensual Bandiera USD 5"** en la cuenta de facturación `01C4A2-037EB1-924D5D`: mensual, todos los proyectos y servicios, **solo alertas** por correo al 50 %, 90 % y 100 % (USD 2,5 / 4,5 / 5). Se eligió "solo alertas" y no "aplicación del límite de inversión" porque esta última suspende servicios al llegar al monto y dejaría sin sistema al cliente. El presupuesto descuenta los créditos, por lo que avisará cuando el costo real a pagar llegue a esos montos.
- **14 de octubre de 2026: segundo propietario.** Se envió la invitación con rol Propietario a `jpkorein@gmail.com`, a pedido de la persona propietaria. Queda pendiente que la acepte desde ese correo.
- Para ver las copias: Firestore, Recuperación ante desastres, "Ver todas las copias de seguridad". Una copia se restaura en una base nueva, no sobre la actual.

## 5. Qué conviene hacer, en orden

**Cambios en la consola (requieren la decisión de la persona propietaria; no se hizo ninguno):**

1. ~~Agregar un segundo propietario~~ **(invitación enviada el 14 de octubre)**. Conviene sumar más adelante una cuenta del cliente o de la empresa, para no depender de cuentas personales.
2. ~~Activar copias de seguridad programadas~~ **(hecho el 14 de octubre)**. Falta decidir si se activa la recuperación a un punto en el tiempo (retención de 7 días).
3. **Crear un presupuesto con alertas** y revisar qué pasa con el crédito el 28 de diciembre.
4. **Actualizar la base a pago por uso** para salir de la "cuota compartida de IA", antes de que el volumen del cliente la alcance.
5. **No borrar el proyecto `future-apricot-m8chg`** hasta decidir qué se recupera. Es el único lugar donde está la información anterior (también se guardó una copia local en `backups/`).

**Cambios en el código (ya hechos en la rama, sin publicar):** login real, reglas nuevas, indicador de guardado, respaldos reales, borrado protegido y modo demo. Ver `docs/MIGRACION_AUTH.md` y `docs/PLAN_ESTABILIDAD.md`.

**Datos:**

6. Que el cliente revise el CSV y decida sobre los 48 remitos, el comprobante y los 3 perfiles. Lo que se apruebe se agrega a la base actual sin tocar nada de lo existente.
7. Corregir la fecha del remito `AUD-9185` y confirmar si los vehículos y materiales son reales.

**URL estable:**

8. Registrar un dominio o subdominio del cliente y asociarlo al servicio de Cloud Run con "Asignaciones de dominios", agregarlo a los dominios autorizados de Authentication y usar siempre esa dirección. Así, un cambio de proyecto o de servicio deja de afectar a las personas.

## 6. Qué no se pudo verificar

- El estado de la recuperación a un punto en el tiempo y el historial de versiones de las reglas.
- La cuenta de facturación (medio de pago, titular) y los límites exactos de la cuota compartida.
- El proyecto 259895764830: no aparece en la cuenta, por lo que no se sabe si se eliminó o pertenece a otra.
- Si el cliente borró a propósito los 48 remitos importados.
