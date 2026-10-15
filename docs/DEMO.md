# Modo demo

Permite ver y probar el sistema completo sin tocar la base de datos real.

## Cómo iniciarlo

```
npm run demo
```

Abre `http://localhost:3100`. En la pantalla de ingreso hay un botón por cada rol de prueba
(Administrador, Gerente, Facturación, Capataz y Empleado). La contraseña de todos es `Demo2026!`.

## Qué es y qué no es

- Los datos son ficticios: 8 clientes, 8 personas de campo, 44 remitos en todos los estados,
  vehículos, materiales, proyectos y servicios. Se generan en `src/demo/demoData.ts`.
- Todo vive en el navegador (localStorage de `localhost:3100`). Los cambios que se hagan
  persisten hasta tocar "Restablecer demo" en la franja amarilla.
- No hay ninguna conexión con Firebase: el comando compila el sistema con una base local en
  memoria (`src/demo/firestoreShim.ts` y `authShim.ts`) en lugar del SDK real.
- El escaneo de remitos con IA no está disponible en la demo.
- El modo demo solo se activa con `npm run demo`. El sistema normal (`npm run dev`, `npm run build`)
  no incluye ni un archivo de la demo.

## Limitaciones

- Algunos textos fijos del sistema (por ejemplo, el recuadro "Infraestructura Firebase" del tablero)
  son los mismos que en producción y no reflejan la demo.
- Los datos se generan al abrir la demo; las fechas siempre quedan relativas al día actual.
