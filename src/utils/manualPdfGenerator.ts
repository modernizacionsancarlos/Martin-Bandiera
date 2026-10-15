import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TechnicalCostParameters } from '../types';
import { MANUAL_EXTRA_SECTIONS, MANUAL_VERSION, type ManualExtraSection } from './manualExtraSections';

/**
 * Generates a comprehensive, multi-page professional PDF manual of the entire system.
 * La versión y las secciones nuevas salen de manualExtraSections.ts (la misma fuente que la vista interactiva).
 */
const buildManual = (
  technicalParameters: TechnicalCostParameters | undefined,
  knownStarts: Record<string, number>
): { doc: jsPDF; starts: Record<string, number> } => {
  const starts: Record<string, number> = {};
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [15, 23, 42]; // Slate-900
  const accentColor = [0, 194, 255]; // Cyan-500 (#00c2ff)
  const amberColor = [245, 158, 11]; // Amber-500
  const dateStr = new Date().toLocaleDateString('es-AR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Helper to add corporate header to subsequent pages
  const addHeader = (pageNum: number, totalPages: number, sectionTitle: string) => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('JOB MARTIN BANDIERA · MANUAL OFICIAL DEL SISTEMA', 14, 10);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(sectionTitle, 196, 10, { align: 'right' });

    // Footer
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 285, 210, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 285, 210, 285);

    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Versión Oficial ${MANUAL_VERSION} · Mendoza, Argentina · Actualizado: ${dateStr}`, 14, 291);
    doc.text(`Página ${pageNum} de ${totalPages}`, 196, 291, { align: 'right' });
  };

  // ==========================================
  // PÁGINA 1: PORTADA INSTITUCIONAL
  // ==========================================
  doc.setFillColor(15, 23, 42); // Slate-900 background
  doc.rect(0, 0, 210, 297, 'F');

  // Decorative Accent Bar
  doc.setFillColor(0, 194, 255);
  doc.rect(0, 0, 210, 8, 'F');

  // Badge Versión
  doc.setFillColor(245, 158, 11);
  doc.roundedRect(14, 24, 60, 8, 2, 2, 'F');
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`VERSIÓN OFICIAL ${MANUAL_VERSION}`, 18, 29.5);

  // Logo & Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB Martin Bandiera', 14, 46);

  doc.setTextColor(0, 194, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Ingeniería, Obras Eléctricas y Mantenimiento de Pozos Profundos', 14, 55);

  doc.setTextColor(203, 213, 225);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Valle de Uco & Gran Mendoza · República Argentina', 14, 62);

  // Separator
  doc.setDrawColor(51, 65, 85);
  doc.setLineWidth(0.5);
  doc.line(14, 70, 196, 70);

  // Subtitle / Document Type Box
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(14, 78, 182, 38, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MANUAL DE USO INTEGRAL DEL SISTEMA', 20, 90);

  doc.setTextColor(226, 232, 240);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.text(
    'Guía operativa completa, paso a paso, de todas las funciones del ecosistema: desde la\nconfección del parte diario en campo hasta la auditoría técnica, cobranzas, liquidación de\ncuadrillas, administración de usuarios y configuración de costos fijos.',
    20,
    98
  );

  // Table of Contents Box
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(14, 124, 182, 150, 3, 3, 'F');

  doc.setTextColor(0, 194, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ÍNDICE GENERAL Y MÓDULOS DEL SISTEMA', 20, 134);

  const pageOf = (id: string, fallback: string) => (knownStarts[id] ? String(knownStarts[id]) : fallback);
  const indexItems = [
    { num: '1', title: 'Arquitectura General y Flujo Operativo del Negocio', page: '2' },
    { num: '2', title: 'Carga de Reporte de Campo (Remito de Papel vs Sistema, Viajes y Personal)', page: '3' },
    { num: '3', title: 'Diferenciación de Cuadrilla: Oficial vs Ayudante y Tarifas Horarias', page: '4' },
    { num: '4', title: 'Motor Matemático de Costos: Fórmulas de Combustible, Seguros y M.O.', page: '5' },
    { num: '5', title: 'Administración Operativa, Auditoría Técnica y Ciclo del Remito', page: '6' },
    { num: '6', title: 'Liquidación de Cuadrillas y Comisiones de Capataz sobre Costo de Servicio', page: '7' },
    { num: '7', title: 'Base de Clientes, Distancias KM y Fincas del Valle de Uco', page: '8' },
    { num: '8', title: 'Obras, Mantenimiento de Pozos, Stock de Materiales y Finanzas', page: '9' },
    { num: '9', title: 'Gestión de Usuarios, Control RBAC y Baja Definitiva en Base de Datos', page: '10' },
    { num: '10', title: 'Espacio de Prueba (Sandbox Aislado): Paso Seguro a Producción', page: pageOf('sandbox', '11') },
    ...MANUAL_EXTRA_SECTIONS.map(sec => ({ num: sec.num, title: sec.title, page: pageOf(sec.id, '12') })),
    { num: '16', title: 'Preguntas Frecuentes y Solución Rápida de Dudas', page: pageOf('faq', '17') }
  ];

  let indexY = 143;
  indexItems.forEach(item => {
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(20, indexY - 4, 10, 6, 1.5, 1.5, 'F');
    doc.setTextColor(245, 158, 11);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(item.num, 25, indexY + 0.4, { align: 'center' });

    doc.setTextColor(241, 245, 249);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(item.title, 34, indexY + 0.4);

    doc.setTextColor(148, 163, 184);
    doc.text(`Pág. ${item.page}`, 186, indexY + 0.4, { align: 'right' });

    doc.setDrawColor(51, 65, 85);
    doc.line(34, indexY + 2.6, 186, indexY + 2.6);

    indexY += 8;
  });

  // Footer Cover Note
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text(`Documento generado para: JOB Martin Bandiera · Última revisión: ${dateStr}`, 14, 280);

  // ==========================================
  // PÁGINA 2: ARQUITECTURA GENERAL
  // ==========================================
  doc.addPage();
  addHeader(2, 11, '1. ARQUITECTURA GENERAL');

  let y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Arquitectura General y Flujo del Negocio', 14, y);

  y += 6;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const introText =
    'El sistema de gestión de JOB Martin Bandiera es una plataforma SaaS integral concebida para digitalizar y automatizar el ciclo operativo de empresas de servicios técnicos, electromecánica y perforaciones de pozos agrícolas e industriales en Mendoza. Su misión principal es erradicar fugas de dinero por traslados no computados, calcular al instante el costo real de cada intervención y garantizar una facturación rentable y transparente.';
  const splitIntro = doc.splitTextToSize(introText, 182);
  doc.text(splitIntro, 14, y);
  y += splitIntro.length * 5 + 4;

  // Visual Pipeline Table
  autoTable(doc, {
    startY: y,
    head: [['Etapa', 'Actor Principal', 'Acción en el Sistema', 'Resultado Financiero']],
    body: [
      ['1. Reporte de Campo', 'Técnico / Responsable', 'Carga de horas, viajes, operarios y materiales.', 'Genera Remito con costo directo calculado.'],
      ['2. Auditoría Técnica', 'Auditor / Jefe Técnico', 'Verificación de márgenes (semáforo), horas y KM.', 'Aprobación técnica y fijación de precio facturable.'],
      ['3. Facturación', 'Administración', 'Emisión de Factura Fiscal (A o B), retenciones y CAE.', 'Pasa a estado Facturado (Cuenta Corriente).'],
      ['4. Remito Pasado', 'Administración / Cliente', 'Confección del comprobante comercial y materiales.', 'Documento formal de entrega de servicio.'],
      ['5. Cobranza', 'Finanzas', 'Registro de pago (Transferencia, Cheque, Retenciones).', 'Remito finalizado y archivado digitalmente.'],
      ['6. Liquidación', 'Gerencia / RRHH', 'Cálculo de haberes por hora y comisiones de capataz.', 'Pago exacto sin discrepancias ni reclamos.']
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Callout Box: Principios Fundamentales
  doc.setFillColor(240, 253, 250); // Mint
  doc.setDrawColor(45, 212, 191);
  doc.roundedRect(14, y, 182, 38, 2, 2, 'FD');

  doc.setTextColor(13, 148, 136);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('REGLAS FUNDAMENTALES DE LA OPERACIÓN:', 20, y + 8);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('• Ningún servicio se factura por debajo de su costo operativo total (Margen objetivo: 35%).', 20, y + 15);
  doc.text('• Los traslados computan kilometraje ida y vuelta multiplicado por la cantidad real de viajes.', 20, y + 21);
  doc.text('• Si el técnico no se traslada (ej. trabajo en taller o predio propio), se fija 0 VIAJES ($0 logística).', 20, y + 27);
  doc.text('• La cuadrilla distingue formalmente entre Oficial ($9.400/h) y Ayudante ($5.500/h).', 20, y + 33);

  // ==========================================
  // PÁGINA 3: CARGA DE REPORTE DE CAMPO
  // ==========================================
  doc.addPage();
  addHeader(3, 11, '2. REPORTE DE CAMPO');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Carga y Confección del Reporte de Campo', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'El formulario de reporte de campo es la puerta de entrada de todos los datos técnicos y de costos.\nEstá optimizado para pantallas táctiles y celulares de técnicos en obra.',
    14,
    y
  );
  y += 12;

  // Secuencia de pasos numerados
  const stepsFieldReport = [
    {
      step: 'PASO 1',
      title: 'Cliente, Finca y Punto de Intervención',
      desc: 'Selecciona el cliente del listado desplegable. La distancia en KM se autocompleta con la base de datos de fincas. Si es un pozo nuevo, puedes ajustar los KM manualmente.'
    },
    {
      step: 'PASO 2',
      title: 'Nº de Remito de Papel Manual',
      desc: 'Ingresa el número de talonario físico que firmó el cliente en campo (ej: 0001-0004523). El sistema mantendrá vinculados tanto el remito digital correlativo como el comprobante de papel.'
    },
    {
      step: 'PASO 3',
      title: 'Jornada de Trabajo y Viajes (Traslados)',
      desc: 'Ingresa hora de ENTRADA y SALIDA. Define la cantidad de viajes realizados. Si el servicio se realizó sin movilidad de la empresa o en planta, fija VIAJES en 0 o pulsa "Eliminar Todos los Viajes".'
    },
    {
      step: 'PASO 4',
      title: 'Equipo de Operarios en Campo (Oficial vs Ayudante)',
      desc: 'Asigna a los integrantes de la cuadrilla. Para cada uno, selecciona el botón correspondiente: Oficial ($9.400/h) o Ayudante ($5.500/h). Puedes registrar nuevos operarios directamente a la Base de Datos.'
    },
    {
      step: 'PASO 5',
      title: 'Materiales, Repuestos e Insumos',
      desc: 'Detalla los cables, guardamotores, electrodos, contactores o cañerías instaladas con su cantidad y costo de adquisición. El subtotal se suma automáticamente al costo operativo.'
    },
    {
      step: 'PASO 6',
      title: 'Pre-Auditoría Técnica en Vivo y Guardado',
      desc: 'Antes de guardar, revisa la caja resumen inferior con el Costo Logístico, Mano de Obra Directa, Costo Operativo y Precio Sugerido de Facturación con margen del 35%.'
    }
  ];

  stepsFieldReport.forEach(st => {
    const splitDesc = doc.splitTextToSize(st.desc, 172);
    const cardH = 11 + splitDesc.length * 3.8;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, y, 182, cardH, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.rect(14, y, 182, cardH);

    doc.setFillColor(0, 194, 255);
    doc.roundedRect(18, y + 2.5, 16, 5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(st.step, 26, y + 6, { align: 'center' });

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(st.title, 38, y + 6);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(splitDesc, 18, y + 11.5);

    y += cardH + 2.5;
  });

  // Callout Box: 0 Viajes
  const zeroViajesText = 'En la sección Jornada, haz clic en el botón "Eliminar Todos los Viajes" o escribe 0 en el campo de viajes. El sistema pondrá en $0 el combustible, seguros y amortizaciones de camioneta para no sobrecargar el costo.';
  const splitZeroViajes = doc.splitTextToSize(zeroViajesText, 172);
  const zeroViajesH = 11 + splitZeroViajes.length * 4;

  doc.setFillColor(254, 242, 242); // Rose-50
  doc.setDrawColor(248, 113, 113);
  doc.roundedRect(14, y + 1, 182, zeroViajesH, 2, 2, 'FD');

  doc.setTextColor(185, 28, 28);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('¿CÓMO REGISTRAR UN TRABAJO SIN LOGÍSTICA (0 VIAJES)?', 20, y + 7);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(127, 29, 29);
  doc.text(splitZeroViajes, 20, y + 12.5);

  // ==========================================
  // PÁGINA 4: DIFERENCIACIÓN OFICIAL VS AYUDANTE
  // ==========================================
  doc.addPage();
  addHeader(4, 11, '3. CUADRILLA: OFICIAL VS AYUDANTE');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Diferenciación de Personal y Cuadrillas', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'El sistema discrimina con exactitud la categoría técnica de cada operario para computar de forma\nprecisa la Mano de Obra Directa en la auditoría y evitar pagar de más o liquidar incorrectamente.',
    14,
    y
  );
  y += 12;

  // Comparison Table
  autoTable(doc, {
    startY: y,
    head: [['Categoría', 'Tarifa por Hora Base', 'Tarifa Guardia (+50%)', 'Funciones y Responsabilidades']],
    body: [
      [
        'Responsable Técnico',
        `$${(technicalParameters?.horaBase || 9400).toLocaleString('es-AR')}`,
        `Manual ($ o $/h)`,
        'Líder del servicio en campo, diagnóstico de fallas, medición de aislamientos y firma de remito.'
      ],
      [
        'Oficial Técnico',
        `$${(technicalParameters?.horaOficial || 9400).toLocaleString('es-AR')}`,
        `Manual ($ o $/h)`,
        'Montajes electromecánicos complejos, cableado de potencia, conexionado de tableros y bombas.'
      ],
      [
        'Ayudante Práctico',
        `$${(technicalParameters?.pagoAyudanteHora || 5500).toLocaleString('es-AR')}`,
        `Manual ($ o $/h)`,
        'Asistencia general, acarreo de herramientas, zanjeo, tendido físico de caños y soporte manual.'
      ],
      [
        'Capataz de Obra',
        `Comisión % s/Servicio`,
        `Comisión % s/Servicio`,
        'Supervisión global de la cuadrilla. Se liquida entre el 8% y 15% directo sobre el costo de M.O.'
      ]
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Instructions: How to change roles in field report
  const roleText =
    '1. Al asignar un operario en el reporte, verás dos botones: [ OFICIAL ] y [ AYUDANTE ].\n2. Haz clic sobre el botón deseado: el botón activo se iluminará con color distintivo (Cyan para Oficial, Púrpura para Ayudante).\n3. En tiempo real, el cálculo multiplicará las horas trabajadas por la tarifa exacta del rol seleccionado.\n4. Si el operario es nuevo, usa el campo inferior "+ Registrar nuevo operario directamente en Base de Datos", escribe su nombre, elige su categoría y pulsa "Registrar". Quedará guardado para futuros reportes.';
  const splitRoleText = doc.splitTextToSize(roleText, 172);
  const roleBoxH = 12 + splitRoleText.length * 4.2;

  doc.setFillColor(240, 249, 255); // Cyan-50
  doc.setDrawColor(0, 194, 255);
  doc.roundedRect(14, y, 182, roleBoxH, 2, 2, 'FD');

  doc.setTextColor(0, 150, 200);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CÓMO APLICAR CAMBIOS DE ROL EN UN REPORTE:', 20, y + 7.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(splitRoleText, 20, y + 13);

  // ==========================================
  // PÁGINA 5: MOTOR MATEMÁTICO DE COSTOS
  // ==========================================
  doc.addPage();
  addHeader(5, 11, '4. MOTOR MATEMÁTICO DE COSTOS');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Motor Matemático de Costos y Fórmulas', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Todas las cifras del sistema están gobernadas por fórmulas rigurosas que impiden desviaciones\nentre lo presupuestado, lo auditado y lo efectivamente cobrado.',
    14,
    y
  );
  y += 10;

  const formulas = [
    {
      title: '1. Costo de Combustible (Gasoil Grado 3)',
      formula: 'Combustible = Distancia_KM × 2 × Viajes × 0.13 L/km × Precio_Diesel',
      desc: 'Multiplica ida y vuelta por los viajes efectivos. Consumo promedio flota: 13 Litros cada 100 km (0.13 L/km).'
    },
    {
      title: '2. Seguros y Responsabilidad Civil por Viaje',
      formula: 'Seguros = Viajes × $1.318,78  (o $0 si Viajes = 0)',
      desc: 'Póliza de seguro automotor comercial prorrateada por traslado efectivo realizado a campo.'
    },
    {
      title: '3. Amortización de Camioneta y Herramientas por Viaje',
      formula: 'Amortización = Viajes × $7.587,88  (o $0 si Viajes = 0)',
      desc: 'Desgaste de neumáticos, fluidos, service y reposición de instrumental de precisión.'
    },
    {
      title: '4. Mano de Obra Directa (M.O.) y Guardias',
      formula: 'M.O. = (Horas × Tarifa_Líder) + (Horas × Tarifa_Oficiales) + (Horas × Tarifa_Ayudantes) + Guardia',
      desc: 'Al activar Guardia SÍ, el valor NO es un 50% fijo: se ingresa manualmente como Monto Fijo ($) o según Horas Trabajadas ($/h), configurable como adicional o tarifa plana.'
    },
    {
      title: '5. Costo Operativo Total',
      formula: 'Costo Operativo = Logística (Comb + Seg + Amort) + Mano de Obra + Materiales',
      desc: 'Representa el costo puro de ejecución que la empresa debe cubrir para no perder dinero.'
    },
    {
      title: '6. Precio Sugerido de Facturación (Margen Comercial Editable)',
      formula: 'Precio Sugerido = Costo Operativo / (1 - Margen % / 100)',
      desc: 'El porcentaje es editable por la empresa (opciones de 20%, 25%, 30%, 35%, 40%, 50% o manual) y permite además fijar directamente el precio sugerido deseado.'
    }
  ];

  formulas.forEach(f => {
    const splitDesc = doc.splitTextToSize(f.desc, 172);
    const cardH = 12 + splitDesc.length * 3.5;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, cardH, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, cardH);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(f.title, 18, y + 4.5);

    doc.setTextColor(0, 150, 200);
    doc.setFontSize(7.5);
    doc.setFont('courier', 'bold');
    doc.text(f.formula, 18, y + 9);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(splitDesc, 18, y + 13);

    y += cardH + 2.5;
  });

  // ==========================================
  // PÁGINA 6: AUDITORÍA TÉCNICA Y CICLO DEL REMITO
  // ==========================================
  doc.addPage();
  addHeader(6, 11, '5. ADMINISTRACIÓN OPERATIVA & AUDITORÍA');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Administración Operativa, Auditoría Técnica y Ciclo del Remito', 14, y);

  y += 6;
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'La planilla de Administración Operativa es el panel central donde se auditan, editan y valorizan los remitos antes de facturar.',
    14,
    y
  );
  y += 8;

  // Semáforo explanation
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 32, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(14, y, 182, 32);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('SISTEMA DE SEMÁFORO FINANCIERO Y ESTADOS:', 20, y + 5.5);

  doc.setFillColor(239, 68, 68); // Red
  doc.circle(24, y + 12, 2.2, 'F');
  doc.setTextColor(185, 28, 28);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ROJO (Cargado):', 29, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.2);
  doc.text(doc.splitTextToSize('Servicio ejecutado en pozo/finca, pendiente de auditoría de costos y fijación de precio.', 110), 75, y + 13);

  doc.setFillColor(59, 130, 246); // Blue
  doc.circle(24, y + 19, 2.2, 'F');
  doc.setTextColor(29, 78, 216);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('AZUL (Facturado):', 29, y + 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.2);
  doc.text(doc.splitTextToSize('Factura fiscal emitida con vencimiento y plazo en cuenta corriente del cliente.', 110), 75, y + 20);

  doc.setFillColor(16, 185, 129); // Green
  doc.circle(24, y + 26, 2.2, 'F');
  doc.setTextColor(4, 120, 87);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('VERDE (Cobrado):', 29, y + 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.2);
  doc.text(doc.splitTextToSize('Pago bancario o efectivo registrado con retenciones impositivas y remito cerrado.', 110), 75, y + 27);

  y += 36;

  // 5 Financial Columns Table
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('LAS 5 COLUMNAS FINANCIERAS DE LA PLANILLA OPERATIVA (EDITABLES):', 14, y);
  y += 3;

  autoTable(doc, {
    startY: y,
    head: [['Columna', 'Concepto y Composición', 'Regla de Cálculo', 'Edición Inline']],
    body: [
      ['1. LOGÍSTICA ($)', 'Traslado vehicular al pozo o finca.', 'KM × 2 × Viajes × Diesel + Seguros + Amort.', 'Editable celda por celda. Si viajes=0, computa $0.'],
      ['2. M.O. CAPATAZ ($)', 'Horas trabajadas por el oficial a cargo.', 'Horas Trabajadas × Tarifa Oficial ($/h).', 'Editable en celda. Muestra badge de comisión.'],
      ['3. M.O. AYUDANTE ($)', 'Horas trabajadas por el personal de apoyo.', 'Horas Trabajadas × Tarifa Ayudante ($/h).', 'Editable en celda para jornales o extras.'],
      ['4. COSTO HONORARIOS ($)', 'Valor que nosotros ponemos de ganancia.', 'Costos Directos × Margen % (+35%).', '100% editable en pesos (calcula % ganancia en vivo).'],
      ['5. COSTO TOTAL ($)', 'Suma consolidada de todo lo anterior.', 'Logística + M.O.s + Materiales + Honorarios.', 'Editable: recalcula Honorarios y margen comercial.']
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    bodyStyles: { fontSize: 6.8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  y = (doc as any).lastAutoTable.finalY + 5;

  // Step-by-step: How to transition states
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('FLUJO DEL REMITO EN EL PROCESO REAL (PASO A PASO):', 14, y);
  y += 4;

  const statesLifecycle = [
    {
      title: 'Paso 1: Auditoría y Edición Directa en Planilla',
      desc: 'En la tabla, pulsa en cualquier celda para ajustar M.O. Capataz, M.O. Ayudante o Logística. Asigna el Costo Honorarios deseado o escribe directamente el Costo Total acordado con el cliente.'
    },
    {
      title: 'Paso 2: Comprobante Consolidado (Remito Pasado formal)',
      desc: 'Pulsa el botón de documento en la fila (o selecciona varios remitos para consolidar) y genera el Remito Comercial sin costos internos para entregar en finca con detalle de tareas y firmas.'
    },
    {
      title: 'Paso 3: Transición a "Facturado" y "Cobrado"',
      desc: 'Pulsa el botón azul "Facturar", ingresa la Factura Fiscal (ej: Factura A-0005-0012903) y fecha de vencimiento. Al acreditarse el pago, registra el cobro deduciendo retenciones fiscales de IIBB/Ganancias.'
    }
  ];

  statesLifecycle.forEach(sl => {
    const splitDesc = doc.splitTextToSize(sl.desc, 172);
    const cardH = 7 + splitDesc.length * 3.3;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, y, 182, cardH, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, cardH);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(7.8);
    doc.setFont('helvetica', 'bold');
    doc.text(sl.title, 18, y + 4);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.text(splitDesc, 18, y + 7.5);

    y += cardH + 2;
  });

  // Sección Adicional: Optimización de Tabla y Navegación
  y += 1;
  const optBoxH = 46;
  doc.setFillColor(240, 249, 255); // Cyan-50
  doc.setDrawColor(0, 194, 255);
  doc.roundedRect(14, y, 182, optBoxH, 2, 2, 'FD');

  doc.setTextColor(0, 150, 200);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('OPTIMIZACIÓN DE PANTALLA, VISTA POR HOJAS Y TECLAS DE FLECHAS:', 20, y + 5.5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('1. División en Hojas (10, 20, 50 y 100 respuestas):', 20, y + 11.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(6.8);
  const p1Text = 'En la barra superior o pie de tabla, selecciona 10, 20, 50 o 100 filas para achicar el alto de la tabla y verla en una sola pantalla con paginador numérico.';
  doc.text(doc.splitTextToSize(p1Text, 170), 24, y + 15.5);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Navegación Fluida con Teclado (sin bajar al fondo):', 20, y + 23);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(6.8);
  const p2Text = 'Haz clic en la tabla: Flechas ◀ y ▶ desplazan columnas; ▲ y ▼ filas; Re Pág / Av Pág cambian de hoja; Inicio / Fin saltan a extremos.';
  doc.text(doc.splitTextToSize(p2Text, 170), 24, y + 27);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Menú Lateral Colapsable y Exportación Excel:', 20, y + 34.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(6.8);
  const p3Text = 'Al contraer el menú lateral, la tabla se expande al 100% de la pantalla. El botón Excel descarga la planilla completa con las 5 columnas financieras sincronizadas.';
  doc.text(doc.splitTextToSize(p3Text, 170), 24, y + 38.5);

  // ==========================================
  // PÁGINA 7: LIQUIDACIÓN DE CUADRILLAS
  // ==========================================
  doc.addPage();
  addHeader(7, 11, '6. LIQUIDACIÓN DE CUADRILLAS');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('6. Liquidación de Cuadrillas y Comisiones', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'El módulo de Liquidación unifica las horas efectivas y los servicios supervisados para abonar con\ntransparencia absoluta a técnicos, capataces y operarios.',
    14,
    y
  );
  y += 10;

  // Subsections
  doc.setFillColor(254, 243, 199); // Amber-100
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(14, y, 182, 34, 2, 2, 'FD');

  doc.setTextColor(180, 83, 9);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('REGLA DE ORO PARA LIQUIDAR CAPATACES:', 20, y + 8);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 53, 15);
  const liqRule =
    'Las comisiones del Capataz (ej. 10%) se calculan EXCLUSIVAMENTE sobre el Costo de Mano de Obra Directa (Costo de Servicio) de los remitos asignados a su cuadrilla.\nNUNCA sobre combustible, materiales ni repuestos, evitando distorsiones que inflen artificialmente el pago.';
  doc.text(doc.splitTextToSize(liqRule, 170), 20, y + 14.5);

  y += 40;

  // How to generate liquidation
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PROCEDIMIENTO DE LIQUIDACIÓN QUINCENAL O MENSUAL:', 14, y);
  y += 6;

  const liqSteps = [
    '1. Ingresa a la sección "Liquidación Cuadrillas" desde la barra lateral izquierda.',
    '2. Filtra por período de fechas (ej: primera quincena del mes) o selecciona al Capataz / Técnico.',
    '3. El sistema listará todos los remitos aprobados con la sumatoria de horas y servicios auditados.',
    '4. Verifica el desglose: Horas Base + Liquidación de Guardia Técnica (Monto Fijo o por Horas) + Comisión sobre Costo de Servicio.',
    '5. Haz clic en "Descargar Resumen PDF de Liquidación" para imprimir el recibo oficial de haberes.',
    '6. Haz clic en "Marcar como Liquidado" para que esos remitos no vuelvan a computarse por duplicado.'
  ];

  liqSteps.forEach(ls => {
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(8.2);
    doc.setFont('helvetica', 'normal');
    const splitLs = doc.splitTextToSize(ls, 172);
    doc.text(splitLs, 18, y);
    y += splitLs.length * 4.2 + 2;
  });

  // ==========================================
  // PÁGINA 8: CLIENTES, FINCAS Y DISTANCIAS
  // ==========================================
  doc.addPage();
  addHeader(8, 11, '7. CLIENTES Y FINCAS');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('7. Base de Clientes, Fincas y Distancias KM', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'La base de datos de clientes almacena la razón social, CUIT, teléfono de contacto y la ubicación\nexacta de cada finca o pozo con su distancia en kilómetros medida desde la base de operaciones.',
    14,
    y
  );
  y += 10;

  // Table of Sample Clients
  autoTable(doc, {
    startY: y,
    head: [['Cliente / Empresa', 'Finca / Ubicación', 'Distancia KM', 'Condición Fiscal', 'Contacto']],
    body: [
      ['FINCA LA CONSULTA S.A.', 'San Carlos, Valle de Uco', '45 km', 'Resp. Inscripto (CUIT 30-...)', 'Ing. Marcos Ruiz'],
      ['BODEGA TUPUNGATO WINERY', 'Ruta 89, Tupungato', '62 km', 'Resp. Inscripto (CUIT 30-...)', 'Lic. Clara Morales'],
      ['AGRÍCOLA SAN CARLOS', 'Tres Esquinas, San Carlos', '38 km', 'Resp. Inscripto (CUIT 30-...)', 'Sr. Daniel Videla'],
      ['FINCA EL PERAL', 'El Peral, Tupungato', '54 km', 'Resp. Inscripto (CUIT 30-...)', 'Capataz José Soto'],
      ['VIÑEDOS DE TUNUYÁN', 'Colonia Las Rosas, Tunuyán', '28 km', 'Resp. Inscripto (CUIT 30-...)', 'Ing. Valeria Ortiz']
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // How to add or edit client
  const clientSteps =
    '1. Ve a "Base de Clientes" en la barra lateral izquierda.\n2. Para modificar: haz clic en el icono del lápiz (Editar) en la fila del cliente. Podrás cambiar los KM de distancia, la dirección o los datos fiscales. Al guardar, los nuevos reportes tomarán esa distancia automáticamente.\n3. Para dar de alta: pulsa el botón "+ Nuevo Cliente / Finca", completa la ficha y pulsa "Guardar Cliente".\n4. Importancia de los KM: Definir con precisión los kilómetros garantiza que el combustible y los viáticos se coticen automáticamente sin errores humanos.';
  const splitClientSteps = doc.splitTextToSize(clientSteps, 172);
  const clientBoxH = 12 + splitClientSteps.length * 4;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, 182, clientBoxH, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CÓMO AGREGAR O MODIFICAR UN CLIENTE / FINCA:', 20, y + 7.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(splitClientSteps, 20, y + 13);

  // ==========================================
  // PÁGINA 9: PROYECTOS, MANTENIMIENTO Y MATERIALES
  // ==========================================
  doc.addPage();
  addHeader(9, 11, '8. OBRAS, MANTENIMIENTO Y STOCK');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('8. Obras, Mantenimiento de Pozos y Materiales', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'Módulos complementarios para el control técnico especializado de perforaciones y control de insumos.',
    14,
    y
  );
  y += 10;

  const modulesExtra = [
    {
      title: 'A. Proyectos de Obra Eléctrica y Pozos Nuevos',
      desc: 'Permite agrupar múltiples remitos de campo bajo un mismo proyecto o contrato global (ej: "Electrificación Pozo Nº 5"). Permite comparar el presupuesto inicial adjudicado contra los costos reales devengados en materiales, logística y mano de obra.'
    },
    {
      title: 'B. Mantenimiento de Pozos Profundos',
      desc: 'Ficha técnica histórica de cada pozo: profundidad en metros, diámetro de entubado, marca y modelo de bomba sumergible, potencia del motor (HP), caudal en litros/hora y registro de intervenciones anteriores para diagnósticos preventivos ágiles.'
    },
    {
      title: 'C. Materiales & Stock de Pañol',
      desc: 'Control de existencias de cables subterráneos, disyuntores, cañerías, electrodos de nivel, contactores y repuestos de bombas. Permite actualizar precios de reposición en pesos o dólares para que los reportes coticen siempre a valores actualizados.'
    },
    {
      title: 'D. Reportes & Métricas Financieras',
      desc: 'Gráficos de facturación mensual, rentabilidad neta por cliente, desglose de costos fijos vs variables y estado de la cartera de cuentas a cobrar (vencidas, a vencer y al día).'
    }
  ];

  modulesExtra.forEach(mx => {
    const splitDesc = doc.splitTextToSize(mx.desc, 172);
    const cardH = 9 + splitDesc.length * 3.8;

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(14, y, 182, cardH, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, cardH);

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(mx.title, 18, y + 5);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'normal');
    doc.text(splitDesc, 18, y + 9.5);

    y += cardH + 2.5;
  });

  // ==========================================
  // PÁGINA 10: USUARIOS Y PERMISOS RBAC
  // ==========================================
  doc.addPage();
  addHeader(10, 11, '9. USUARIOS Y PERMISOS RBAC');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('9. Gestión de Usuarios y Control RBAC', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    'El sistema cuenta con un robusto esquema de Roles y Permisos basados en Roles (RBAC)\npara garantizar la privacidad de los datos contables y evitar manipulaciones no autorizadas.',
    14,
    y
  );
  y += 10;

  // RBAC Matrix Table
  autoTable(doc, {
    startY: y,
    head: [['Rol de Usuario', 'Carga Remito', 'Auditoría', 'Facturación', 'Costos Fijos', 'Usuarios']],
    body: [
      ['SuperAdmin (Martin)', 'Total', 'Total', 'Total', 'Total', 'Total (Consola DB)'],
      ['Gerencia / Dirección', 'Total', 'Total', 'Total', 'Lectura/Edición', 'Lectura'],
      ['Administración', 'Total', 'Total', 'Total (Facturar)', 'Lectura', 'Sin Acceso'],
      ['Auditor Técnico', 'Total', 'Total (Aprobar)', 'Lectura', 'Sin Acceso', 'Sin Acceso'],
      ['Capataz (app de campo)', 'Parte sin valores', 'Sin Acceso', 'Sin Acceso', 'Sin Acceso', 'Sin Acceso'],
      ['Operario / Cuadrilla', 'Sin Acceso', 'Sin Acceso', 'Sin Acceso', 'Sin Acceso', 'Sin Acceso']
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 }
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // Elimination instruction (Fix highlight)
  const userSteps =
    '1. Ve a "Usuarios y Permisos" en la barra lateral.\n2. Localiza al usuario en la tabla y presiona el icono de papelera (Eliminar).\n3. Aparecerá el modal de confirmación con alerta de seguridad. Pulsa "Confirmar Eliminación".\n4. El sistema borra el perfil, da de baja la cuenta de acceso desde el servidor y registra la baja: el usuario no puede volver a ingresar ni reaparece aunque se reinicie el navegador. El alta, la clave temporal y el restablecimiento de claves están en la sección 14.';
  const splitUserSteps = doc.splitTextToSize(userSteps, 172);
  const userBoxH = 12 + splitUserSteps.length * 4;

  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(248, 113, 113);
  doc.roundedRect(14, y, 182, userBoxH, 2, 2, 'FD');

  doc.setTextColor(185, 28, 28);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CÓMO ELIMINAR O DAR DE BAJA UN USUARIO PERMANENTEMENTE:', 20, y + 7.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(127, 29, 29);
  doc.text(splitUserSteps, 20, y + 13);

  // ==========================================
  // PÁGINA 11: SANDBOX
  // ==========================================
  doc.addPage();
  starts.sandbox = doc.getNumberOfPages();
  addHeader(0, 0, '10. ESPACIO DE PRUEBA (SANDBOX)');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('10. Espacio de Prueba (Sandbox)', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Herramientas de simulación para ensayar fórmulas y remitos sin tocar la información real.', 14, y);
  y += 10;

  const sandboxText =
    '• Permite probar cualquier combinación de KM, horas, guardia (monto fijo o por horas), margen editable y cuadrilla.\n• Los remitos creados en el Sandbox NO alteran la base de datos de producción ni las finanzas reales; viven solo en ese navegador.\n• Simulador en tiempo real: muestra paso a paso cómo impacta cada cambio en el combustible, seguros y M.O.\n• Escáner con IA: lee la foto de un remito de papel y completa los datos para revisarlos.\n• A Producción: si una orden de prueba resulta correcta, el botón "A Producción" pide confirmación con el detalle, exige elegir un cliente real de la base, la crea con el siguiente número de remito real, recalcula el precio con las tarifas vigentes y la marca "En producción" para que no se cargue dos veces.';
  const splitSandbox = doc.splitTextToSize(sandboxText, 172);
  const sandboxH = 12 + splitSandbox.length * 4;

  doc.setFillColor(254, 243, 199); // Amber-50
  doc.setDrawColor(245, 158, 11);
  doc.roundedRect(14, y, 182, sandboxH, 2, 2, 'FD');

  doc.setTextColor(180, 83, 9);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('ESPACIO DE PRUEBA EXCLUSIVO (SANDBOX AISLADO):', 20, y + 7.5);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 53, 15);
  doc.text(splitSandbox, 20, y + 13);

  // ==========================================
  // SECCIONES 11 A 15: FUNCIONES NUEVAS
  // ==========================================
  const NOTE_COLORS = {
    info: { fill: [236, 254, 255], draw: [103, 232, 249], title: [14, 116, 144], text: [22, 78, 99] },
    warn: { fill: [254, 243, 199], draw: [245, 158, 11], title: [180, 83, 9], text: [120, 53, 15] },
    ok: { fill: [236, 253, 245], draw: [52, 211, 153], title: [4, 120, 87], text: [6, 78, 59] }
  } as const;
  const SHORT: Record<string, string> = {
    'panel-estado': '11. PANEL DE ESTADO Y ARCHIVO',
    'app-campo': '12. APP DEL CAPATAZ',
    canales: '13. WHATSAPP Y DRIVE',
    'usuarios-claves': '14. USUARIOS Y CLAVES',
    respaldos: '15. RESPALDOS Y SEGURIDAD'
  };

  const renderExtraSection = (section: ManualExtraSection) => {
    doc.addPage();
    starts[section.id] = doc.getNumberOfPages();
    const header = SHORT[section.id] || section.title.toUpperCase();
    addHeader(0, 0, header);
    let cy = 26;

    const ensure = (h: number) => {
      if (cy + h > 278) {
        doc.addPage();
        addHeader(0, 0, header + ' (cont.)');
        cy = 24;
      }
    };

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    const titleLines = doc.splitTextToSize(`${section.num}. ${section.title}`, 182);
    doc.text(titleLines, 14, cy);
    cy += titleLines.length * 6.5;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(section.subtitle, 14, cy);
    cy += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87);
    doc.text(`[${section.badge}]  Estado: ${section.status}`, 14, cy);
    cy += 8;

    section.blocks.forEach(block => {
      if (block.type === 'p') {
        const lines = doc.splitTextToSize(block.text, 182);
        ensure(lines.length * 4 + 3);
        doc.setTextColor(51, 65, 85);
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.text(lines, 14, cy);
        cy += lines.length * 4 + 3;
      } else if (block.type === 'steps' || block.type === 'bullets') {
        if (block.title) {
          ensure(10);
          doc.setTextColor(15, 23, 42);
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.text(block.title.toUpperCase(), 14, cy);
          cy += 5.5;
        }
        block.items.forEach((item, i) => {
          const lines = doc.splitTextToSize(item, 170);
          ensure(lines.length * 3.9 + 1.5);
          doc.setTextColor(0, 150, 200);
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          doc.text(block.type === 'steps' ? `${i + 1}.` : '•', 15, cy);
          doc.setTextColor(51, 65, 85);
          doc.setFont('helvetica', 'normal');
          doc.text(lines, 22, cy);
          cy += lines.length * 3.9 + 1.5;
        });
        cy += 3;
      } else if (block.type === 'table') {
        ensure(14 + block.rows.length * 8);
        if (block.title) {
          doc.setTextColor(15, 23, 42);
          doc.setFontSize(9.5);
          doc.setFont('helvetica', 'bold');
          doc.text(block.title.toUpperCase(), 14, cy);
          cy += 3;
        }
        autoTable(doc, {
          startY: cy,
          head: [block.head],
          body: block.rows,
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 }
        });
        cy = (doc as any).lastAutoTable.finalY + 6;
      } else {
        const colors = NOTE_COLORS[block.tone];
        const lines = doc.splitTextToSize(block.text, 172);
        const h = 12 + lines.length * 3.9;
        ensure(h + 3);
        doc.setFillColor(colors.fill[0], colors.fill[1], colors.fill[2]);
        doc.setDrawColor(colors.draw[0], colors.draw[1], colors.draw[2]);
        doc.roundedRect(14, cy, 182, h, 2, 2, 'FD');
        doc.setTextColor(colors.title[0], colors.title[1], colors.title[2]);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text(block.title.toUpperCase(), 20, cy + 7);
        doc.setTextColor(colors.text[0], colors.text[1], colors.text[2]);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(lines, 20, cy + 12);
        cy += h + 4;
      }
    });
  };

  MANUAL_EXTRA_SECTIONS.forEach(renderExtraSection);

  // ==========================================
  // PREGUNTAS FRECUENTES (FAQ)
  // ==========================================
  doc.addPage();
  starts.faq = doc.getNumberOfPages();
  addHeader(0, 0, '16. PREGUNTAS FRECUENTES');

  y = 26;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('16. Preguntas Frecuentes', 14, y);

  y += 6;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Respuestas a las consultas más habituales durante la operación.', 14, y);
  y += 10;

  // FAQ
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PREGUNTAS FRECUENTES (FAQ):', 14, y);
  y += 5;

  const faqs = [
    {
      q: '¿Por qué al poner 0 viajes el costo de combustible y seguro es $0?',
      a: 'Porque si no hubo traslado de vehículos de la empresa (por ejemplo, el cliente trajo el equipo a taller o el técnico ya estaba en la finca), no corresponde cobrar desgaste ni combustible de camioneta.'
    },
    {
      q: '¿Dónde cambio el precio del Gasoil o el valor de la hora del Oficial?',
      a: 'En el menú "Parámetros & Costos Fijos" (exclusivo Administradores). Cualquier modificación allí actualiza de forma automática todos los nuevos remitos y el simulador.'
    },
    {
      q: '¿Qué hago si se cae la conexión a internet en la finca?',
      a: 'Hoy el sistema necesita conexión para guardar: el indicador inferior muestra "Sin conexión" y cuántos cambios quedan sin sincronizar, y avisa antes de cerrar la pestaña. La carga sin conexión es parte de la aplicación instalable del capataz para Android, que está planificada (sección 12).'
    },
    {
      q: '¿El capataz puede ver precios o costos?',
      a: 'No. La aplicación del capataz solo permite cargar partes de campo y su sesión no recibe precios, tarifas, costos, sueldos ni remitos. Administración calcula los valores al convertir el parte en remito (sección 12).'
    },
    {
      q: '¿Qué hago si un usuario olvidó su contraseña o no tiene correo?',
      a: 'En "Usuarios y Permisos" presioná "Restablecer clave": se genera una clave temporal que se muestra una sola vez. Entregásela al usuario; deberá elegir una propia al ingresar (sección 14).'
    },
    {
      q: '¿Dónde están los remitos cobrados que archivé?',
      a: 'Siguen en Auditoría Técnica: salen de las listas de trabajo pero siempre aparecen en la búsqueda y con el filtro "Archivado". Se pueden desarchivar y salen en la exportación a Excel (sección 11).'
    },
    {
      q: '¿Por qué un parte que llegó por foto dice "Revisar antes de convertir"?',
      a: 'Porque la lectura de letra manuscrita puede equivocarse. El sistema marca lo que no pudo confirmar para que una persona lo verifique contra la foto antes de crear el remito (sección 13).'
    }
  ];

  faqs.forEach(item => {
    const splitQ = doc.splitTextToSize(`P: ${item.q}`, 172);
    const splitA = doc.splitTextToSize(`R: ${item.a}`, 172);
    const cardH = 7 + (splitQ.length + splitA.length) * 3.6;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, y, 182, cardH, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, y, 182, cardH);

    doc.setTextColor(0, 150, 200);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(splitQ, 18, y + 4.5);

    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7.2);
    doc.setFont('helvetica', 'normal');
    doc.text(splitA, 18, y + 4.5 + splitQ.length * 3.6);

    y += cardH + 2.5;
  });

  // End of Document note
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(8);
  doc.text('--- Fin del Manual Oficial de Usuario · JOB Martin Bandiera ---', 105, 275, { align: 'center' });

  // Pies de página con la numeración real (las páginas se agregan según el contenido).
  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page++) {
    doc.setPage(page);
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 285, 210, 12, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.line(0, 285, 210, 285);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Versión Oficial ${MANUAL_VERSION} · Mendoza, Argentina · Actualizado: ${dateStr}`, 14, 291);
    doc.text(`Página ${page} de ${total}`, 196, 291, { align: 'right' });
  }

  return { doc, starts };
};

/** Arma el manual dos veces: la primera para saber en qué página cae cada sección del índice. */
export const buildSystemManualDoc = (technicalParameters?: TechnicalCostParameters): jsPDF => {
  const { starts } = buildManual(technicalParameters, {});
  return buildManual(technicalParameters, starts).doc;
};

/** Genera y descarga el manual. */
export const generateSystemManualPDF = (technicalParameters?: TechnicalCostParameters): void => {
  const filename = `JOB_Martin_Bandiera_Manual_de_Uso_${MANUAL_VERSION}_${new Date().toISOString().split('T')[0]}.pdf`;
  buildSystemManualDoc(technicalParameters).save(filename);
};
