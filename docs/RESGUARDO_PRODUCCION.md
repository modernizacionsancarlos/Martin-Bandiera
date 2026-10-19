# Resguardo de la producción

Objetivo: que el cliente no pierda nada de lo que ya cargó (remitos, clientes, capataces, empleados, ayudantes, parámetros, vehículos, recibos) al aplicar cualquier cambio del sistema.

Este documento describe las copias que existen, cómo hacer una nueva, cómo comprobar que nada se perdió después de un cambio y cómo recuperar algo si faltara. Los comandos de esta guía no modifican la base real salvo el último (restaurar), que está bloqueado a menos que se confirme.

## 1. Qué protege cada capa

| Capa | Qué guarda | Dónde está | Estado |
|---|---|---|---|
| Copias diarias de Firestore | Toda la base, 7 días | Google Cloud (programadas) | Activas desde el 14/10/2026 |
| Recuperación a un instante (PITR) | Cualquier momento de los últimos 7 días | Google Cloud | Activa desde el 14/10/2026 |
| Copia local verificable (este documento) | Toda la base en archivos, con huella digital por archivo | Carpeta `backups/` de esta computadora | Disponible; la última copia real es del 14/10/2026 |
| Copia fuera de esta computadora | La carpeta anterior, copiada a otro lugar | Pendiente de elegir (disco externo o Drive de la empresa) | **Pendiente** |
| Código | El sistema | GitHub | Solo el código; no contiene datos |

Una copia local que está únicamente en esta computadora no alcanza: si la computadora falla, se pierde con ella. Copie la carpeta de cada copia a un segundo lugar.

## 2. Qué NO queda cubierto y por qué

- **Datos que solo existan en el navegador de alguien** (localStorage o IndexedDB de una dirección web anterior). Ninguna copia del servidor los ve. Antes de aplicar cambios, pida a quien cargaba datos con la dirección anterior que no limpie su navegador.
- **Cuentas de acceso (Firebase Auth).** Hoy los usuarios del sistema están en la colección `users`. Las cuentas reales de acceso se crean en la migración (`docs/MIGRACION_AUTH.md`). Esa colección sí queda en la copia.
- **Archivos de firma en Storage.** Aún no existen en producción: la firma se guarda dentro del documento y queda incluida en la copia.
- **Los 48 remitos, 1 recibo y 3 perfiles que solo están en la base anterior** (`future-apricot-m8chg`). Están en `backups/base-anterior-future-apricot.json`. Es una decisión del cliente si se incorporan; no se mezclan solos.

## 3. Cómo hacer una copia nueva (antes de cualquier cambio)

Lectura solamente. No escribe nada en la base real. Se ejecuta en esta computadora, en la carpeta del proyecto.

```bash
npm run resguardo:exportar
```

Al terminar, el comando verifica por su cuenta que los archivos quedaron completos y muestra la cantidad de documentos de cada colección. Si alguna colección falla, avisa que la copia quedó incompleta y no debe usarse.

La carpeta nueva queda en `backups/<fecha>/` e incluye `MANIFIESTO.json`: fecha, base de origen, versión del código, y para cada archivo la cantidad de documentos y su huella digital (SHA-256).

Para comprobar más tarde que una copia no cambió ni se dañó (no necesita conexión):

```bash
npm run resguardo:verificar backups/<fecha>
```

Después, copie la carpeta completa a un segundo lugar.

## 4. Orden recomendado al aplicar los cambios

1. `npm run resguardo:exportar` y copiar la carpeta a un segundo lugar.
2. Anotar la hora. Con la recuperación a un instante activa, Google puede devolver la base a cualquier momento de los últimos 7 días.
3. Aplicar el cambio, siguiendo `docs/MIGRACION_AUTH.md`.
4. `npm run resguardo:comparar backups/<fecha>` (solo lectura). Dice, colección por colección, si falta algo de lo que había en la copia. Los documentos "modificados desde la copia" son normales si se siguió trabajando.
5. Si el comando termina sin faltantes, no se perdió ningún documento. Si avisa que faltan, no siga cargando datos y pase a la sección 5.

## 5. Si faltara algo: recuperar

Hay tres caminos, de menos a más invasivo.

**A. Revisar qué falta.** `npm run resguardo:comparar backups/<fecha>` lista los identificadores que faltan.

**B. Recuperar solo lo que falta (modo seguro).** Primero una simulación, que no escribe nada:

```bash
node scripts/resguardo.mjs restaurar backups/<fecha> --base <id-de-la-base>
```

Muestra cuántos documentos crearía. En este modo solo crea los que faltan y nunca pisa ni borra uno existente. Para aplicar de verdad, agregue `--aplicar`. Si el destino es la base de producción, el comando se niega salvo que se agregue `--confirmo-produccion`. Hágalo únicamente cuando la comparación haya mostrado faltantes reales.

**C. Reemplazar documentos que cambiaron.** Agregue `--sobrescribir`. Pisa los documentos que difieran de la copia, incluso los que se editaron después. Úselo solo si hay documentos dañados y se acepta perder lo editado desde la copia.

Para volver toda la base a un momento anterior, use en cambio la recuperación a un instante de Google Cloud (consola de Firestore). Es una decisión del dueño del proyecto y se debe hacer con calma.

## 6. Pruebas hechas

`npm run test:resguardo` ensaya todo el circuito contra un emulador local, con la última copia real. Comprueba que:

- una copia alterada se detecta;
- restaurar en una base vacía la deja completa (1.049 documentos con la copia del 14/10);
- aplicar dos veces no duplica ni pisa nada;
- borrar remitos se detecta y la restauración segura los recupera sin pisar lo modificado;
- escribir en producción se rechaza sin confirmación explícita.

Estas pruebas no usaron la base real. Falta una prueba contra la base real, que consistiría en exportar y comparar de inmediato. Esa lectura requiere la autorización del dueño de la cuenta.

## 7. Qué hay hoy en `backups/`

Los manifiestos de las tres copias anteriores se crearon el 19/10/2026 a partir de lo que ya había en las carpetas. Sirven para detectar cambios desde ese día, no prueban cómo estaban los archivos antes.

| Copia | Documentos |
|---|---|
| 2026-10-08 | 1.049 |
| 2026-10-13 | 1.046 |
| 2026-10-14 (la más reciente) | 1.049 |

Han pasado varios días desde la última: antes de aplicar cambios, haga una copia nueva (sección 3).
