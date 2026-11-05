import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WorkerLiquidationDetail } from '../types';
import { todayLocalISO } from './dateUtils';

/**
 * Formats a number to Argentine currency string
 */
const formatCurrency = (amount: number): string => {
  return `$${Math.round(amount || 0).toLocaleString('es-AR')}`;
};

/**
 * Draws the enterprise header for a liquidation receipt
 */
const drawHeader = (doc: jsPDF, receiptId: string, isGrupalSummary = false): number => {
  // Header background bar (Slate-900)
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 28, 'F');

  // Cyan accent line
  doc.setFillColor(6, 182, 212); // Cyan-500
  doc.rect(0, 28, 210, 1.5, 'F');

  // Brand Name & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB Martin Bandiera', 14, 11);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text('Ingeniería, Obras Eléctricas y Mantenimiento de Pozos Profundos', 14, 16);
  doc.text('Mendoza - Valle de Uco · Tel: +54 9 2622 50-5195 · CUIT: 30-71720268-2', 14, 21);
  doc.text('Dirección de Operaciones y Servicios Electromecánicos', 14, 25);

  // Document Type Header Badge (Right side of header)
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.roundedRect(125, 5, 71, 18, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  if (isGrupalSummary) {
    doc.text('LIQUIDACIÓN CONSOLIDADA', 128, 11);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('RESUMEN GRUPAL CUADRILLAS', 128, 17);
  } else {
    doc.text('RECIBO DE LIQUIDACIÓN', 128, 11);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`HABERES CUADRILLA · Nº ${receiptId}`, 128, 17);
  }

  return 34; // Next Y position
};

/**
 * Draws the individual worker receipt onto the provided jsPDF document
 */
const renderIndividualWorkerReceipt = (
  doc: jsPDF,
  worker: WorkerLiquidationDetail,
  receiptIndex?: number,
  totalReceipts?: number
) => {
  const receiptId = `LIQ-${worker.name.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase()}-${Date.now().toString().slice(-4)}`;
  let currentY = drawHeader(doc, receiptId, false);

  // Worker Info Card
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(14, currentY, 182, 30, 2, 2, 'FD');

  // Worker Info - Left Column
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('OPERARIO / BENEFICIARIO:', 18, currentY + 6);
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(worker.name, 18, currentY + 12);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CARGO / ESPECIALIDAD:', 18, currentY + 18);
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(worker.cargo || worker.role, 18, currentY + 23);

  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CUADRILLA / SEDE:', 18, currentY + 28);
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(worker.cuadrilla || 'Cuadrilla 1 - Valle de Uco', 52, currentY + 28);

  // Worker Info - Right Column
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('FECHA DE EMISIÓN:', 120, currentY + 6);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }), 155, currentY + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('ROL ASIGNADO:', 120, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(worker.isCapataz ? 180 : 51, worker.isCapataz ? 83 : 65, worker.isCapataz ? 9 : 85);
  doc.text(worker.role, 155, currentY + 12);

  if (worker.isCapataz) {
    doc.setFontSize(7.5);
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text('COMISIÓN CAPATAZ:', 120, currentY + 18);
    doc.setFont('helvetica', 'bold');
    doc.text(`${worker.capatazPercentage}% s/ Costo Servicio`, 155, currentY + 18);
  }

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('SERVICIOS / HS:', 120, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${worker.totalServices} reportes (${worker.totalHours} hs)`, 155, currentY + 24);

  currentY += 34;

  // Concepts Summary Table
  const conceptRows: (string | number)[][] = [
    ['Servicios y Mano de Obra (Técnico Responsable / Líder)', `${worker.hoursAsLead} hs`, formatCurrency(worker.payAsLead)],
    ['Servicios en Cuadrilla (Ayudante Especializado)', `${worker.hoursAsHelper} hs`, formatCurrency(worker.payAsHelper)]
  ];

  if (worker.isCapataz || worker.capatazProfitTotal > 0) {
    conceptRows.push([
      `Comisión Ganancia Capataz (${worker.capatazPercentage}% sobre M.O. Directa de Servicios)`,
      `${worker.records.filter(r => r.leadTech?.toLowerCase() === worker.name.toLowerCase()).length} remitos`,
      formatCurrency(worker.capatazProfitTotal)
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: [['CONCEPTO DE HABERES LIQUIDADOS', 'COMPUTO / HORAS', 'SUBTOTAL ($)']],
    body: conceptRows,
    foot: [['TOTAL NETO A PERCIBIR / LIQUIDAR', `${worker.totalHours} HS TRABAJADAS`, formatCurrency(worker.totalPay)]],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240]
    },
    footStyles: {
      fillColor: [16, 185, 129], // Emerald-500
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 108 },
      1: { cellWidth: 38, halign: 'center' },
      2: { cellWidth: 36, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // Detailed Remitos / Services Section Header
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('DESGLOSE DETALLADO DE REMITOS Y SERVICIOS LIQUIDADOS', 14, currentY);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Detalle individual de los ${worker.records.length} servicios de campo en los que participó`, 14, currentY + 4);

  currentY += 6;

  // Remitos Detail Table
  const detailTableBody = worker.records.map(record => {
    const isLead = record.leadTech?.toLowerCase() === worker.name.toLowerCase();
    const helpersCount = Math.max(1, (record.helpers || []).length);
    let amount = 0;
    let rolText = '';

    if (isLead) {
      const capProfit = worker.isCapataz
        ? (record.capatazProfit || Math.round((record.laborDirectCost || 0) * (worker.capatazPercentage / 100)))
        : 0;
      amount = (record.techPay || 0) + capProfit;
      rolText = worker.isCapataz ? `Capataz (${worker.capatazPercentage}%)` : 'Técnico Líder';
    } else {
      amount = Math.round((record.helperPay || 0) / helpersCount);
      rolText = 'Ayudante';
    }

    const desc = record.description || record.workPoint || 'Mantenimiento Electromecánico';

    return [
      record.date || '-',
      record.remitoId || '-',
      record.clientName || 'Cliente',
      desc,
      rolText,
      `${record.hoursWorked || 0} hs`,
      record.isGuardia ? 'SÍ' : 'No',
      formatCurrency(amount)
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [['FECHA', 'REMITO', 'CLIENTE / FINCA', 'DESCRIPCIÓN DE TRABAJOS LIQUIDADOS', 'ROL', 'HS', 'GD.', 'LIQUIDADO']],
    body: detailTableBody,
    foot: [
      ['TOTALES', `${worker.records.length} serv.`, '', '', '', `${worker.totalHours} hs`, `${worker.guardiasCount} gd.`, formatCurrency(worker.totalPay)]
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [51, 65, 85], // Slate-700
      textColor: [255, 255, 255],
      fontSize: 6.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 6.5,
      textColor: [30, 41, 59],
      lineColor: [241, 245, 249]
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontSize: 7,
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 32 },
      3: { cellWidth: 54 },
      4: { cellWidth: 20, halign: 'center' },
      5: { cellWidth: 13, halign: 'center' },
      6: { cellWidth: 11, halign: 'center' },
      7: { cellWidth: 16, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Check if we need space for signatures or a new page
  if (currentY > 238) {
    doc.addPage();
    currentY = 24;
  }

  // Legal / Conformity Text
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Recibí de JOB Martin Bandiera el importe neto especificado precedentemente, en concepto de liquidación final por los servicios y horas detalladas.',
    14,
    currentY
  );
  doc.text('Declaro no tener reclamo alguno pendiente derivado de los trabajos precedentemente consignados.', 14, currentY + 3.5);

  currentY += 14;

  // Signatures have been completely removed as requested by user.

  // Bottom Footer
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  const footerPageText = totalReceipts && receiptIndex !== undefined ? ` · Recibo ${receiptIndex + 1} de ${totalReceipts}` : '';
  doc.text(
    `Comprobante Oficial de Liquidación Cuadrilla · JOB Martin Bandiera · Generado el ${new Date().toLocaleString('es-AR')}${footerPageText}`,
    105,
    288,
    { align: 'center' }
  );
};

/**
 * Draws the consolidated summary sheet for batch/grupal liquidations
 */
const renderGrupalSummarySheet = (doc: jsPDF, workers: WorkerLiquidationDetail[]) => {
  let currentY = drawHeader(doc, 'GRUPAL-ALL', true);

  const totalPayrollAll = workers.reduce((acc, w) => acc + w.totalPay, 0);
  const totalHoursAll = workers.reduce((acc, w) => acc + w.totalHours, 0);
  const totalServicesAll = workers.reduce((acc, w) => acc + w.totalServices, 0);
  const totalCapatazProfitAll = workers.reduce((acc, w) => acc + w.capatazProfitTotal, 0);

  // Group KPI Highlights Box
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, 182, 22, 2, 2, 'FD');

  // KPI 1: Total Payroll
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL HABERES A LIQUIDAR:', 18, currentY + 6);
  doc.setFontSize(11);
  doc.setTextColor(16, 185, 129); // Emerald-600
  doc.text(formatCurrency(totalPayrollAll), 18, currentY + 13);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${workers.length} operarios seleccionados`, 18, currentY + 18);

  // KPI 2: Total Hours
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('HORAS HOMBRE:', 72, currentY + 6);
  doc.setFontSize(11);
  doc.setTextColor(6, 182, 212); // Cyan-600
  doc.text(`${totalHoursAll} HS`, 72, currentY + 13);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${totalServicesAll} intervenciones en campo`, 72, currentY + 18);

  // KPI 3: Total Capataz Profits
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('COMISIONES CAPATACES:', 125, currentY + 6);
  doc.setFontSize(11);
  doc.setTextColor(217, 119, 6); // Amber-600
  doc.text(formatCurrency(totalCapatazProfitAll), 125, currentY + 13);
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Sobre Costo de Servicio', 125, currentY + 18);

  currentY += 26;

  // Title for the summary table
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('RESUMEN DE NÓMINA LIQUIDADA POR TRABAJADOR', 14, currentY);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('A continuación de esta planilla resumen, se adjunta el recibo individual detallado de cada operario.', 14, currentY + 4);

  currentY += 6;

  // Summary Table of all workers
  const summaryRows = workers.map(w => [
    w.name,
    w.cargo || w.role,
    w.totalServices,
    `${w.totalHours} hs`,
    formatCurrency(w.payAsLead),
    formatCurrency(w.payAsHelper),
    w.capatazProfitTotal > 0 ? formatCurrency(w.capatazProfitTotal) : '—',
    formatCurrency(w.totalPay)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['EMPLEADO / OPERARIO', 'CARGO / PUESTO', 'SERV.', 'HS', 'PAGO TÉCNICO', 'PAGO AYUDANTE', 'GAN. CAPATAZ', 'TOTAL LIQUIDADO']],
    body: summaryRows,
    foot: [
      ['TOTAL GENERAL', `${workers.length} operarios`, totalServicesAll, `${totalHoursAll} hs`, '', '', formatCurrency(totalCapatazProfitAll), formatCurrency(totalPayrollAll)]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate-800
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [15, 23, 42],
      lineColor: [226, 232, 240]
    },
    footStyles: {
      fillColor: [16, 185, 129], // Emerald-500
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold' },
      1: { cellWidth: 36 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 12;

  // Signatures have been completely removed as requested by user.

  // Summary Footer
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Planilla Resumen Consolidada de Liquidaciones · JOB Martin Bandiera · Generado el ${new Date().toLocaleString('es-AR')}`,
    105,
    288,
    { align: 'center' }
  );
};

/**
 * Generates an INDIVIDUAL Liquidation Receipt PDF for a single worker
 */
export const generateSingleLiquidationReceiptPDF = (worker: WorkerLiquidationDetail): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  renderIndividualWorkerReceipt(doc, worker);

  const cleanName = worker.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dateStr = todayLocalISO();
  doc.save(`Recibo_Liquidacion_${cleanName}_${dateStr}.pdf`);
};

/**
 * Generates a BATCH / GRUPAL Liquidation Receipt PDF for multiple selected workers
 * Includes a Consolidated Summary Sheet first, followed by each employee's individual detailed receipt
 */
export const generateBatchLiquidationReceiptsPDF = (workers: WorkerLiquidationDetail[]): void => {
  if (!workers || workers.length === 0) return;

  // If only one worker selected, generate their individual receipt
  if (workers.length === 1) {
    generateSingleLiquidationReceiptPDF(workers[0]);
    return;
  }

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  // 1. First Page: Consolidated Summary Sheet
  renderGrupalSummarySheet(doc, workers);

  // 2. Subsequent Pages: One Detailed Receipt per Worker
  workers.forEach((worker, index) => {
    doc.addPage();
    renderIndividualWorkerReceipt(doc, worker, index, workers.length);
  });

  const dateStr = todayLocalISO();
  doc.save(`Recibos_Liquidacion_Grupal_${workers.length}_Empleados_${dateStr}.pdf`);
};
