# Cambios pedidos por el cliente

Cada cambio se hace en la rama `feat/firebase-auth-rules`, se prueba en la demo (`npm run demo`) y no se publica en producción hasta que la persona propietaria lo apruebe.

## 1. Archivar remitos cobrados (Auditoría Técnica)

**Pedido:** en Auditoría Técnica, después de Facturado y Cobrado debe haber un paso más que permita archivar los remitos, y los archivados siempre deben seguir disponibles en la búsqueda.

**Estado:** hecho en la rama y probado en la demo. Sin publicar.

**Cómo funciona**
- En el selector de estado de cada remito cobrado aparece una opción nueva, `ARCHIVADO`, después de `COBRADO`. Solo se ofrece en remitos que ya están cobrados.
- Un remito archivado sale de la lista normal de Auditoría Técnica y de la pantalla Cobrado, y deja de contarse en el contador de Cobrado del menú lateral.
- Siempre se encuentra de dos formas: escribiendo en el buscador (la búsqueda incluye los archivados, con cualquier filtro de estado) o eligiendo el filtro `ARCHIVADO`.
- Se puede volver atrás: en un remito archivado, elegir `COBRADO` lo desarchiva.
- El remito conserva el estado `Cobrado` y se agrega una marca (`archivado` y `fechaArchivado`). Por eso los totales financieros, los comprobantes y las liquidaciones no cambian.
- Los remitos que ya existen no se tocan: el campo nuevo es opcional y la marca solo se guarda en los que se archiven.

**Archivos:** `src/types/index.ts`, `src/components/TechnicalAuditTable.tsx`, `src/components/CobradoView.tsx`, `src/components/Sidebar.tsx`.

**Decisiones del cliente (14 de octubre de 2026), también hechas en la rama y probadas en la demo**
- **Archivar en bloque.** Botón "Archivar cobrados (N)" junto al filtro de estados. Archiva los cobrados que se ven con los filtros actuales (por ejemplo, de un cliente o de un rango de fechas), pide confirmación y se puede deshacer. Con el filtro `ARCHIVADO` aparece "Desarchivar (N)". Al seleccionar remitos con las casillas, la barra inferior suma "Archivar (N)".
- **Columna "Fecha de archivo"** en la tabla, a continuación de Estado. Quienes ya tenían una selección de columnas guardada la reciben una sola vez y pueden ocultarla desde "Vista".
- **Exportación a Excel con los archivados.** El archivo incluye siempre los remitos archivados (salvo que se filtre por otro estado), con la columna **Estado** (un remito archivado figura como "Archivado") y la columna **Fecha de Archivo**, aunque estén ocultas en pantalla.

**Archivos adicionales:** `src/context/DataContext.tsx` (`bulkSetArchived`, una sola escritura por lote) y `src/utils/excelParser.ts`.

## 2. Panel de Estado (resumen gráfico de la empresa)

**Pedido:** una pestaña de dashboard para que el cliente vea gráficamente el estado general de la empresa entre los remitos del mes, los pasados, facturados, cobrados y archivados.

**Estado:** hecho en la rama y probado en la demo. Sin publicar.

**Dónde está:** menú lateral, en Operaciones y Remitos, justo debajo de "Inicio & Dashboard", con el nombre "Panel de Estado". Es una pantalla nueva; el dashboard actual no se modificó. Solo lectura: no cambia ningún dato.

**Qué muestra**
- **Selector de mes** (anterior, siguiente, lista de meses y "Todos los meses"). Empieza en el mes actual, o en el último mes con remitos si el actual todavía no tiene.
- **Indicadores:** remitos del mes (con la diferencia contra el mes anterior) y una tarjeta por etapa: cargados, facturados, pasados, cobrados y archivados, con cantidad, porcentaje del total e importe. Cada tarjeta lleva a la pantalla de su etapa.
- **Remitos por etapa:** barra con la proporción de cada etapa en el mes.
- **Efectividad de cobro:** porcentaje cobrado sobre lo facturado en el período.
- **Remitos por mes y etapa:** columnas apiladas de los últimos 6 meses. Pasar el cursor muestra el detalle; tocar una columna selecciona ese mes.
- **Requiere atención:** remitos cargados hace más de 30 días sin facturar y facturados hace más de 45 días sin cobrar, con el más antiguo y un enlace a la pantalla correspondiente.
- **Importe por etapa** y **clientes con más importe pendiente de cobro** (facturado y pasado sin cobrar).
- Cada gráfico principal tiene una vista de **Tabla** equivalente.

**Reglas**
- Un remito archivado cuenta como "Archivado" y no como "Cobrado" (por dentro sigue cobrado, por eso el importe cobrado total no cambia).
- Los importes solo se ven con permiso de finanzas, facturación o cobranzas. Los roles que ven el dashboard pero no tienen esos permisos ven solo las cantidades.
- Los remitos con fecha faltante o inválida (por ejemplo, el año 0009 que hay en producción) no entran en los gráficos por mes; el panel avisa cuántos son.
- Los colores de cada etapa son los del menú (rojo, azul, ámbar, verde y gris), validados para modo claro y oscuro, y son siempre los mismos en todos los gráficos.

**Archivos:** `src/components/EstadoGeneralView.tsx`, `src/utils/dashboardMetrics.ts` (cálculos), `src/components/Sidebar.tsx` y `src/App.tsx`. En `src/demo/demoData.ts` los remitos de la demo ahora quedan ordenados como en la realidad: los más antiguos cobrados y los más nuevos cargados.

## 3. App de campo: partes del capataz sin valores

**Pedido:** que los capataces carguen los datos en la finca sin ver valores, y que lo cargado llegue directo a administración para continuar el proceso. La app se publicará en Google Play (cuenta de UcoDigitalLab).

**Estado:** primera etapa hecha en la rama y probada en la demo. Sin publicar. No toca producción.

**Cómo funciona**
1. El capataz entra y ve solo la **app de campo** (`FieldApp`): "Mis partes" y el botón "Nuevo parte". No tiene menú de administración.
2. El parte lleva solo hechos: fecha, cliente y finca, punto de trabajo, guardia, entrada, salida, viajes, personal (oficial o ayudante), materiales (nombre y cantidad), descripción y firma. **No muestra ni guarda precios, tarifas ni costos.**
3. El parte se guarda en una colección nueva, `fieldReports`, con estado Pendiente.
4. Administración y Gerencia ven la bandeja **Partes de Campo** (menú lateral, con contador de pendientes). Cada parte tiene "Convertir en remito" y "Descartar".
5. "Convertir en remito" abre el formulario de remito ya cargado con los datos del parte. Ahí se calculan costos y precios con las tarifas vigentes, igual que hoy. Al guardar se crea el remito (estado Cargado) y el parte pasa a Convertido con el número de remito. Desde ahí sigue el flujo existente: Facturado, Pasado, Cobrado, Archivado.
6. El capataz ve el estado de cada parte: en revisión, procesado o descartado (con el motivo).

**Qué se ocultó de verdad**
- La sesión de un capataz no se suscribe a remitos, finanzas, comprobantes, tarifas, personal, clientes, materiales, proyectos, mantenimiento ni flota. Esos datos no llegan a su dispositivo.
- Para elegir cliente, compañeros y materiales usa un **catálogo de campo** (`catalogoCampo/actual`) con solo nombres: razón social y finca, nombre y categoría del personal, y nombre y unidad del material. No lleva CUIT, tarifas, sueldos ni precios. Lo mantiene al día una sesión de Administración o Gerencia (se actualiza solo a los 3 segundos de cualquier cambio).
- Su perfil se pide con una consulta propia (solo su documento), no la lista completa de usuarios.
- Al cerrar sesión, y antes de abrir una sesión de capataz, se borran del navegador las copias locales de datos del sistema. Antes quedaban copias de remitos, tarifas y finanzas en el navegador después de cerrar sesión.

**Reglas de Firestore (`firestore.rules.next`, sin publicar)**
- El capataz solo lee: su rol, su propio perfil, el catálogo de campo, el estado general del sistema y sus propios partes. Todo lo demás queda denegado.
- El capataz solo crea partes a su nombre, en estado Pendiente y sin campos de precio. No puede modificarlos ni borrarlos. Convertir o descartar lo hacen Administración y Gerencia.
- Materiales, proyectos, mantenimiento y flota pasan a escritura solo de administradores (antes escribía el capataz).
- **Probadas con el emulador de Firestore:** 46 pruebas (capataz, gerente, empleado, cuenta desactivada y sin sesión) en `scripts/rules-test/`; todas pasan. Se ejecutan con `npm install` y `npm test` dentro de esa carpeta (requiere Java). Conviene repetirlas cada vez que se cambien las reglas.
- Orden de publicación: primero el sistema nuevo, después las reglas (ver `docs/MIGRACION_AUTH.md`). Si se publican antes, los capataces y el sistema actual dejan de poder leer.

**Pendiente (siguientes etapas)**
- **Usuarios por servidor:** alta, reseteo de clave y baja de usuarios con firebase-admin (los capataces tienen mail real, pero hoy no están disponibles; mientras tanto, clave temporal que entrega el administrador y cambio obligatorio en el primer ingreso).
- **Sin conexión:** persistencia offline de Firestore y cola de envío, porque en la finca puede no haber señal.
- **Fotos:** guardarlas en Cloud Storage (hoy la firma viaja como imagen dentro del documento).
- **Google Play:** envolver la app web instalable (PWA) como aplicación Android con Trusted Web Activity o Capacitor, publicar desde la cuenta de UcoDigitalLab. Requiere un dominio propio con HTTPS estable (también resuelve el problema de cambiar la URL), política de privacidad e ícono.

**Archivos:** `firestore.rules.next`, `src/components/FieldApp.tsx`, `src/components/PartesCampoView.tsx`, `src/context/AuthContext.tsx` (perfil propio y borrado de copias locales), `src/demo/firestoreShim.ts` (consultas `where ==`), `src/components/FieldReportModal.tsx` (admite precarga desde un parte), `src/context/DataContext.tsx` (partes y suscripciones por rol), `src/services/firestoreSync.ts`, `src/types/index.ts`, `src/components/Sidebar.tsx` y `src/App.tsx`.

## 4. Espacio de Prueba (Sandbox): paso a producción seguro

**Origen:** auditoría de la sección Espacio de Prueba. El botón "A Producción" creaba remitos reales sin confirmación, podía repetirse, usaba el número de prueba y llevaba datos de prueba a la base real.

**Estado:** corregido en la rama y probado en la demo. Sin publicar.

**Qué cambió**
- "A Producción" abre una **confirmación** con el detalle del remito (fecha, papel, horas, kilómetros, viajes, responsable, personal y materiales).
- **Cliente real obligatorio:** hay que elegir un cliente de la base de Clientes. Si el cliente del remito de prueba no existe, el sistema lo avisa y no deja continuar.
- **Número real:** el remito se crea con el siguiente número de la secuencia de producción (por ejemplo `#380-2026`), no con el número de prueba. No se rompe la numeración.
- **Una sola vez:** el remito de prueba queda marcado "En producción #N" y el botón desaparece. Probado con doble clic: se crea un solo remito.
- **Precio recalculado** con las tarifas vigentes (antes arrastraba el precio calculado en el sandbox).
- **Materiales:** el escáner con IA ahora guarda el detalle de materiales detectados, que pasa al remito.
- Solo los roles con permiso para crear remitos ven el botón.
- Se corrigió el texto que decía "100% aislado": ahora aclara que el paso a producción es explícito y con confirmación.

**Pendiente de la auditoría (no incluido):** pestaña de Google Drive vacía por defecto, cuadrilla inventada cuando la IA no lee personal, validación de la respuesta de la IA en el servidor, remito real de ejemplo incrustado en el código, y restricción del Sandbox por permiso (hoy lo ve cualquier rol).

**Archivos:** `src/components/SandboxView.tsx`, `src/components/SandboxRemitoOcr.tsx`.
