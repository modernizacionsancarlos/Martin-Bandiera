/**
 * Secciones del manual correspondientes a las funciones agregadas en la versión v2026.10.
 * Una sola fuente de contenido: la usan la vista interactiva (UserManualView) y el PDF (manualPdfGenerator).
 */

export type ManualBlock =
  | { type: 'p'; text: string }
  | { type: 'steps'; title?: string; items: string[] }
  | { type: 'bullets'; title?: string; items: string[] }
  | { type: 'table'; title?: string; head: string[]; rows: string[][] }
  | { type: 'note'; tone: 'info' | 'warn' | 'ok'; title: string; text: string };

export interface ManualExtraSection {
  id: string;
  num: string;
  title: string;
  subtitle: string;
  badge: string;
  /** Estado real de la función, para mostrarlo con honestidad al cliente. */
  status: string;
  /** Palabras que activan la sección en el buscador del manual. */
  keywords: string;
  blocks: ManualBlock[];
}

export const MANUAL_VERSION = 'v2026.10';
export const MANUAL_REVIEW = 'Octubre 2026';

export const MANUAL_EXTRA_SECTIONS: ManualExtraSection[] = [
  {
    id: 'panel-estado',
    num: '11',
    title: 'Panel de Estado y Archivo de Remitos Cobrados',
    subtitle: 'Resumen gráfico de la empresa y el paso final del remito',
    badge: 'Nuevo',
    status: 'Disponible',
    keywords: 'panel estado dashboard grafico archivo archivar archivado cobrados remitos mes graficos',
    blocks: [
      {
        type: 'p',
        text: 'El Panel de Estado muestra de un vistazo cómo está la empresa entre los remitos del mes: cuántos están cargados, facturados, pasados, cobrados y archivados. Está en el menú lateral, en Operaciones y Remitos, debajo de "Inicio & Dashboard". Es de solo lectura: no modifica ningún dato.'
      },
      {
        type: 'bullets',
        title: 'Qué muestra',
        items: [
          'Selector de mes (anterior, siguiente, lista de meses y "Todos los meses"). Empieza en el mes actual.',
          'Una tarjeta por etapa (Cargado, Facturado, Pasado, Cobrado, Archivado) con cantidad, porcentaje del total e importe. Cada tarjeta lleva a la pantalla de esa etapa.',
          'Remitos por etapa en el mes, y efectividad de cobro (porcentaje cobrado sobre lo facturado).',
          'Remitos por mes y etapa de los últimos 6 meses. Al pasar el cursor se ve el detalle.',
          'Requiere atención: remitos cargados hace más de 30 días sin facturar y facturados hace más de 45 días sin cobrar.',
          'Importe por etapa y clientes con más importe pendiente de cobro.',
          'Cada gráfico principal tiene una vista de Tabla equivalente.'
        ]
      },
      {
        type: 'table',
        title: 'Colores de cada etapa (los mismos en todo el sistema)',
        head: ['Etapa', 'Color'],
        rows: [
          ['Cargado', 'Rojo'],
          ['Facturado', 'Azul'],
          ['Pasado', 'Ámbar'],
          ['Cobrado', 'Verde'],
          ['Archivado', 'Gris']
        ]
      },
      {
        type: 'note',
        tone: 'info',
        title: 'Quién ve los importes',
        text: 'Los importes solo se ven con permiso de finanzas, facturación o cobranzas. Los roles que ven el panel sin esos permisos ven solamente las cantidades.'
      },
      {
        type: 'steps',
        title: 'Archivar remitos cobrados (paso posterior a Cobrado)',
        items: [
          'Entrá a Auditoría Técnica. Un remito en estado Cobrado muestra la opción ARCHIVADO en el selector de estado.',
          'Para archivar varios a la vez, usá el botón "Archivar cobrados (N)" de la barra superior, o seleccioná remitos y usá "Archivar" en la barra flotante.',
          'El remito archivado sale de las listas de trabajo (Cobrado y su contador) pero siempre aparece en la búsqueda y en el filtro "Archivado". Muestra la columna FECHA ARCHIVO.',
          'Para volver atrás, usá "Desarchivar".',
          'La exportación a Excel incluye los archivados, con las columnas Estado (figura "Archivado") y Fecha de Archivo.'
        ]
      },
      {
        type: 'note',
        tone: 'ok',
        title: 'Los totales no cambian',
        text: 'Un remito archivado sigue siendo un remito cobrado: archivarlo no modifica los importes cobrados ni las finanzas.'
      }
    ]
  },
  {
    id: 'app-campo',
    num: '12',
    title: 'Aplicación del Capataz y Partes de Campo',
    subtitle: 'Carga en la finca sin ver valores, directo a administración',
    badge: 'Nuevo',
    status: 'Disponible en la demo',
    keywords: 'capataz app campo parte partes de campo sin valores finca catalogo convertir remito descartar celular',
    blocks: [
      {
        type: 'p',
        text: 'Los capataces cargan lo que pasó en la finca sin ver ningún valor (precios, tarifas, costos ni sueldos). Lo que cargan llega a administración como un "parte de campo" pendiente, y desde ahí el proceso sigue como siempre: se convierte en remito y continúa el ciclo Cargado, Facturado, Pasado, Cobrado y Archivado.'
      },
      {
        type: 'steps',
        title: 'Lo que hace el capataz',
        items: [
          'Ingresa con su usuario. Ve solo "Mis partes" y el botón "Nuevo parte"; no tiene menú de administración.',
          'Completa fecha, cliente y finca, punto de trabajo, guardia, hora de entrada y salida, viajes, personal (como oficial o ayudante), materiales (nombre y cantidad), descripción del trabajo y firma de conformidad.',
          'Envía el parte a administración.',
          'Ve el estado de cada parte: "Enviado · en revisión", "Procesado por administración" o "Descartado" (con el motivo).'
        ]
      },
      {
        type: 'note',
        tone: 'warn',
        title: 'Qué no ve el capataz',
        text: 'No ve precios, tarifas, costos, sueldos, CUIT de clientes, remitos ni finanzas. No es solo ocultarlos en pantalla: su sesión ni siquiera recibe esos datos. Para elegir cliente, personal y materiales usa un catálogo que contiene únicamente nombres y que el sistema mantiene al día automáticamente.'
      },
      {
        type: 'steps',
        title: 'Lo que hace administración o gerencia',
        items: [
          'Abre "Partes de Campo" en el menú lateral. El contador indica cuántos partes esperan revisión.',
          'Revisa el parte (y la foto del remito de papel si vino por WhatsApp o Drive). Los datos dudosos aparecen en "Revisar antes de convertir".',
          'Presiona "Convertir en remito": se abre el formulario de remito ya cargado con los datos del parte. Ahí se calculan costos y precios con las tarifas vigentes.',
          'Al guardar, el remito entra a Auditoría Técnica en estado Cargado y el parte queda "Convertido" con su número de remito.',
          'Si el parte no corresponde, presiona "Descartar" e indica el motivo: el capataz lo ve en su lista.'
        ]
      },
      {
        type: 'table',
        title: 'Qué puede hacer cada rol con los partes',
        head: ['Rol', 'Carga partes', 'Ve valores', 'Convierte en remito'],
        rows: [
          ['Capataz (app de campo)', 'Sí', 'No', 'No'],
          ['Administración', 'No (revisa)', 'Según permisos', 'Sí'],
          ['Gerencia', 'No (revisa)', 'Según permisos', 'Sí']
        ]
      },
      {
        type: 'bullets',
        title: 'Sin señal en la finca',
        items: [
          'La aplicación se instala en el teléfono (botón "Instalar app") y abre aunque no haya señal.',
          'Los partes cargados sin conexión se guardan en el teléfono y se envían solos cuando vuelve la cobertura.',
          'Arriba aparece el aviso "Sin señal" y cada parte pendiente muestra "Sin enviar" hasta que el servidor lo confirma; después pasa a "Enviado · en revisión".',
          'La firma se guarda reducida (unos pocos KB) dentro del parte, así viaja junto con él aunque no haya conexión.'
        ]
      },
      {
        type: 'note',
        tone: 'info',
        title: 'Estado y próximos pasos',
        text: 'La aplicación instalable y la carga sin señal funcionan en la demo. Falta publicarla en Google Play (cuenta de UCO Digital Lab), que requiere un dominio propio con HTTPS, la política de privacidad definitiva y pruebas con teléfonos reales en la finca.'
      }
    ]
  },
  {
    id: 'canales',
    num: '13',
    title: 'Canales de Entrada: WhatsApp y Google Drive',
    subtitle: 'Del remito de papel al parte pendiente, leyendo la foto con IA',
    badge: 'En evaluación',
    status: 'Simulador en la demo; lectura real probada con un remito',
    keywords: 'whatsapp drive foto remito papel ia gemini lectura canal entrada simulador canales',
    blocks: [
      {
        type: 'p',
        text: 'Para acortar el proceso, el capataz puede mandar la foto del remito de papel por WhatsApp (a un número exclusivo para remitos) o subirla a su carpeta de Google Drive. El sistema lee la foto con inteligencia artificial y crea un parte pendiente. Nunca crea un remito ni un precio de forma automática: siempre lo revisa una persona.'
      },
      {
        type: 'steps',
        title: 'Cómo funciona',
        items: [
          'El capataz manda la foto (WhatsApp) o la sube a su carpeta "Pendientes" (Drive).',
          'El sistema lee la foto: cliente, fecha, número de papel, horas, personal, materiales y descripción.',
          'Compara con la base: busca el cliente, el personal y los materiales conocidos, tolerando errores de letra.',
          'Crea un parte Pendiente en "Partes de Campo", con la foto original, el origen (WhatsApp o Drive) y el porcentaje de claridad de la lectura.',
          'Administración revisa y convierte en remito. Al capataz le llega una respuesta con lo que se entendió (WhatsApp) o la foto pasa a "Procesados" (Drive).'
        ]
      },
      {
        type: 'bullets',
        title: 'Qué se marca para revisar antes de convertir',
        items: [
          'Cliente, personal o material que no coincide con la base.',
          'Fecha ilegible, o muy lejana al día en que llegó la foto (un 8 y un 3 manuscritos se confunden).',
          'Horario incompleto, o lectura con menos de 80% de claridad.',
          'El casillero PERS del papel no coincide con las personas leídas.',
          'El trabajo incluye cambios pero el papel no detalla materiales.'
        ]
      },
      {
        type: 'table',
        title: 'WhatsApp frente a Drive',
        head: ['Aspecto', 'WhatsApp', 'Google Drive'],
        rows: [
          ['Cómo carga el capataz', 'Manda la foto al número de la empresa', 'Sube la foto a su carpeta'],
          ['Respuesta al capataz', 'Inmediata, con lo que se entendió', 'La foto pasa a Procesados o Con error'],
          ['Identidad', 'Por el teléfono registrado', 'Por la carpeta de cada capataz'],
          ['Requisitos', 'Número exclusivo y verificación de empresa en Meta', 'Carpetas compartidas con el sistema'],
          ['Sin señal en la finca', 'Se envía al recuperar cobertura', 'Se sube al recuperar cobertura']
        ]
      },
      {
        type: 'note',
        tone: 'warn',
        title: 'Seguridad',
        text: 'Solo los teléfonos de capataces activos pueden cargar por WhatsApp; cada mensaje de Meta se valida con firma. Las fotos se guardan en almacenamiento en la nube y solo las ven Administración y Gerencia, nunca el capataz. Un capataz dado de baja deja de poder cargar por ambos canales.'
      },
      {
        type: 'note',
        tone: 'info',
        title: 'Estado actual',
        text: 'En la demo hay un simulador ("Canales de Entrada") con un chat de WhatsApp y carpetas de Drive, con la lectura simulada. La lectura real se probó con un remito del cliente: acertó 8 de 9 datos; el fallo fue la fecha, que quedó marcada para revisar. Falta medir con el lote de remitos reales del cliente antes de comprometer el canal.'
      }
    ]
  },
  {
    id: 'usuarios-claves',
    num: '14',
    title: 'Usuarios y Claves: Alta, Clave Temporal y Baja',
    subtitle: 'Alta de cuentas, restablecimiento de clave y bajas definitivas desde el servidor',
    badge: 'Seguridad',
    status: 'Disponible en la demo',
    keywords: 'usuarios claves contraseña temporal restablecer alta baja deshabilitar eliminar cambio obligatorio capataz sin correo',
    blocks: [
      {
        type: 'steps',
        title: 'Crear un usuario',
        items: [
          'Entrá a "Usuarios y Permisos" y presioná "Crear nuevo usuario".',
          'Completá nombre, correo, rol y permisos. Para los capataces, cargá también el teléfono (lo usa el canal de WhatsApp).',
          'Al guardar, el sistema crea la cuenta y muestra una contraseña temporal una sola vez, con botón "Copiar".',
          'Entregale esa contraseña al usuario. No se vuelve a mostrar: si se pierde, se restablece.'
        ]
      },
      {
        type: 'steps',
        title: 'Primer ingreso: clave propia obligatoria',
        items: [
          'El usuario ingresa con la clave temporal.',
          'Aparece la pantalla "Elegí tu contraseña" (mínimo 8 caracteres, con letras y números).',
          'Recién al guardarla accede al sistema. Hasta ese momento no se le entrega ningún dato.'
        ]
      },
      {
        type: 'steps',
        title: 'Restablecer una clave olvidada',
        items: [
          'En la fila del usuario, presioná "Restablecer clave".',
          'El sistema genera una clave temporal nueva (se muestra una sola vez), cierra las sesiones abiertas de esa persona y le exige cambiarla al ingresar.'
        ]
      },
      {
        type: 'bullets',
        title: 'Deshabilitar y eliminar',
        items: [
          'Alternar Activo / Inactivo bloquea el acceso del usuario y conserva su cuenta y sus datos.',
          'Eliminar da de baja definitivamente la cuenta de acceso y el perfil; no puede volver a ingresar ni reaparece.',
          'Nadie puede restablecer, deshabilitar o eliminar su propia cuenta, y solo un SuperAdmin administra a otro SuperAdmin.'
        ]
      },
      {
        type: 'note',
        tone: 'info',
        title: 'Capataces sin correo electrónico disponible',
        text: 'La clave temporal resuelve el caso: el administrador la entrega en persona o por el medio que prefiera y el capataz la reemplaza en su primer ingreso. Cuando tengan un correo real, "Olvidé mi contraseña" también funciona por correo.'
      },
      {
        type: 'note',
        tone: 'ok',
        title: 'Cómo se garantiza',
        text: 'La cuenta se crea, se restablece y se elimina desde el servidor, no desde el navegador. La obligación de cambiar la clave la controla la base de datos, no solo la pantalla.'
      }
    ]
  },
  {
    id: 'respaldos',
    num: '15',
    title: 'Respaldos, Sincronización y Seguridad de los Datos',
    subtitle: 'Cómo se cuida la información del cliente',
    badge: 'Seguridad',
    status: 'Disponible; reglas por rol preparadas para el paso a producción',
    keywords: 'respaldo backup sincronizacion guardado guardando offline restaurar borrar todo seguridad datos reglas',
    blocks: [
      {
        type: 'bullets',
        title: 'Indicador de guardado (esquina inferior derecha)',
        items: [
          '"Guardado ✓ hora": todo está en la base de datos.',
          '"Guardando… (N)": hay cambios en camino.',
          '"Sin conexión: N cambios sin sincronizar": el dispositivo no tiene señal.',
          'Un cartel rojo "Error al guardar" avisa si la base rechazó un dato. El sistema también avisa antes de cerrar la pestaña si quedan cambios sin sincronizar.'
        ]
      },
      {
        type: 'bullets',
        title: 'Respaldos',
        items: [
          'Respaldo manual completo en archivo JSON, y restauración desde un respaldo con vista previa de lo que se va a cargar y confirmación.',
          'Antes de "Poner en 0" el sistema pide escribir BORRAR TODO y descarga un respaldo automático.',
          'En el proyecto de producción están activados los respaldos diarios de la base (7 días de retención) y la recuperación a un punto en el tiempo (7 días).'
        ]
      },
      {
        type: 'bullets',
        title: 'Cómo se cuidan los datos',
        items: [
          'La base de datos es la única fuente de verdad: el sistema ya no vuelve a cargar datos de ejemplo guardados en el navegador.',
          'Al cerrar sesión se borran del navegador las copias locales de datos del sistema.',
          'Las contraseñas no se guardan en los datos del sistema: viven solo en el servicio de acceso.',
          'Reglas de acceso por rol: el capataz no puede leer remitos, finanzas ni tarifas, y solo administración ve las fotos de los remitos. Están preparadas y probadas con 50 pruebas automáticas; se activan en el paso a producción.'
        ]
      },
      {
        type: 'note',
        tone: 'warn',
        title: 'Datos de prueba',
        text: 'La demo usa datos ficticios y una base en memoria que no tiene conexión con la información real del cliente. El botón "Restablecer demo" vuelve la demostración a su estado inicial.'
      }
    ]
  }
];
