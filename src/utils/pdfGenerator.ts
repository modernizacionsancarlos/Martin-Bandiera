import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TechnicalAuditRecord, ArchivedReceipt, PaymentEntry } from '../types';
import { roundCurrency } from './calculationUtils';

/**
 * Format currency with Argentine style preserving centavos when present
 */
const formatCurrency = (amount: number): string => {
  const num = Number(amount || 0);
  const hasDecimals = !Number.isInteger(num);
  return `$${num.toLocaleString('es-AR', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
};

/**
 * Generates and downloads a PDF for Remito Pasado
 */
export const generateRemitoPasadoPDF = (record: TechnicalAuditRecord): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const totalRemito = roundCurrency((record.billedPrice && record.billedPrice > 0) ? record.billedPrice : (record.suggestedPrice || record.laborDirectCost || 0));
  const totalMateriales = roundCurrency(record.materialsCost || 0);
  const totalServicio = roundCurrency(Math.max(0, totalRemito - totalMateriales));
  const totalFinalPasado = totalRemito;

  // Header Background bar
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, 210, 28, 'F');

  // Brand Name & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB Martin Bandiera', 14, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text('Ingeniería, Obras Eléctricas y Mantenimiento de Pozos Profundos', 14, 17);
  doc.text('Mendoza - Valle de Uco · Tel: +54 9 2622 50-5195 · CUIT: 30-71720268-2', 14, 22);

  // Document Type Header Badge (Right side of header)
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.roundedRect(140, 6, 56, 16, 2, 2, 'F');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('COMPROBANTE OFICIAL', 143, 12);
  doc.setFontSize(8);
  doc.text('RECIBO / REMITO PASADO', 143, 18);

  // Info Box (Client & Record Details)
  let currentY = 36;

  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(14, currentY, 182, 34, 2, 2, 'FD');

  // Left Column: Client info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // Slate-500
  doc.text('CLIENTE / RAZÓN SOCIAL:', 18, currentY + 6);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  const singleClientLines = doc.splitTextToSize(record.clientName || 'Cliente sin asignar', 92);
  doc.text(singleClientLines, 18, currentY + 11.5);

  const singleLocY = currentY + 12 + singleClientLines.length * 4;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('UBICACIÓN / FINCA:', 18, singleLocY);
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  const singleLocLines = doc.splitTextToSize(record.siteLocation || '-', 92);
  doc.text(singleLocLines, 18, singleLocY + 4.5);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('PUNTO DE TRABAJO:', 18, currentY + 29);
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(record.workPoint || '-', 50, currentY + 29);

  // Right Column: Remito data
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Nº REMITO SISTEMA:', 115, currentY + 6);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(245, 158, 11); // Amber
  doc.text(record.remitoId, 115, currentY + 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('REMITO PAPEL:', 115, currentY + 18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(record.remitoPapel || 'S/N', 145, currentY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('FECHA DE EMISIÓN:', 115, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(record.date || '-', 145, currentY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('RESPONSABLE TÉCNICO:', 115, currentY + 29);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85);
  doc.text(record.leadTech || 'Sin Capataz (Cuadrilla)', 152, currentY + 29);

  // Main Breakdown Table
  currentY = 76;

  autoTable(doc, {
    startY: currentY,
    head: [[
      'REMITO',
      'FECHA',
      'DESCRIPCIÓN DE TAREAS',
      'TOTAL SERVICIO',
      'MATERIALES (DIF.)',
      'TOTAL FINAL (+IVA)'
    ]],
    body: [
      [
        `${record.remitoId}\n${record.remitoPapel ? `Papel: ${record.remitoPapel}` : ''}`,
        record.date,
        `${record.description || 'Mantenimiento electromecánico y asistencia técnica en pozo'}\n${record.materialsDetails ? `Mat: ${record.materialsDetails}` : ''}`,
        formatCurrency(totalServicio),
        formatCurrency(totalMateriales),
        `${formatCurrency(totalFinalPasado)} + IVA`
      ]
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 58 },
      3: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 22, halign: 'right', textColor: [180, 83, 9], fontStyle: 'bold' },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] }
    },
    margin: { left: 14, right: 14 }
  });

  // Calculate table bottom
  // @ts-ignore
  const tableBottom = (doc as any).lastAutoTable.finalY || 120;
  currentY = tableBottom + 8;

  // Safeguard: Check if totals box fits on the current page, otherwise add a new page
  if (currentY + 45 > 275) {
    doc.addPage();
    currentY = 24;
  }

  // Financial summary box
  doc.setFillColor(254, 243, 199); // Amber-100
  doc.setDrawColor(245, 158, 11); // Amber-500
  doc.roundedRect(108, currentY, 88, 38, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(120, 53, 15);
  doc.text('Subtotal Mano de Obra / Servicios:', 112, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalServicio), 192, currentY + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Materiales Computados (Diferencia):', 112, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalMateriales), 192, currentY + 12, { align: 'right' });

  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.3);
  doc.line(112, currentY + 15.5, 192, currentY + 15.5);

  // Prominent TOTAL Highlight Banner
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.roundedRect(110, currentY + 17.5, 84, 11, 1.5, 1.5, 'F');
  doc.setTextColor(15, 23, 42); // Slate-950
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL REMITO PASADO:', 112, currentY + 24.5);
  doc.setFontSize(11);
  doc.text(`${formatCurrency(totalFinalPasado)} + IVA`, 190, currentY + 24.5, { align: 'right' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 53, 15);
  doc.text('* Si el cliente requiere factura formal, se adiciona el IVA (21%).', 112, currentY + 33);

  // Technical note box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, currentY, 90, 38, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('CRITERIO ADMINISTRATIVO Y FISCAL (+IVA):', 18, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const noteLines = doc.splitTextToSize(
    'La columna de materiales se computa como diferencia complementaria en este remito pasado, sin alterar la base operativa fija de mano de obra. El total final incluye la condición "+ IVA": si el cliente requiere factura formal, a este total se le adiciona el IVA (21%).',
    82
  );
  doc.text(noteLines, 18, currentY + 12);

  // Signatures have been completely eliminated as requested by user.

  // Multi-page Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 287, 196, 287);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `JOB Martin Bandiera · Comprobante Remito Pasado Oficial · ${new Date().toLocaleString('es-AR')}`,
      14,
      291
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      196,
      291,
      { align: 'right' }
    );
  }

  // Download PDF
  const cleanId = record.remitoId.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Recibo_Remito_Pasado_${cleanId}.pdf`);
};

/**
 * Generates and downloads a PDF for Recibo Oficial de Cobro
 */
export const generateReciboCobroPDF = (data: {
  receiptNumber: string;
  clientName: string;
  date: string;
  invoiceNumber?: string;
  remitoIds: string[];
  totalAmount: number;
  retencionIVA?: number;
  retencionIIBB?: number;
  retencionGanancias?: number;
  paymentMethods?: PaymentEntry[];
  notes?: string;
}): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const iva = data.retencionIVA || 0;
  const iibb = data.retencionIIBB || 0;
  const ganancias = data.retencionGanancias || 0;
  const totalRetenciones = iva + iibb + ganancias;
  const netoPercibido = Math.max(0, data.totalAmount - totalRetenciones);

  // Header Background Bar
  doc.setFillColor(6, 78, 59); // Emerald-900
  doc.rect(0, 0, 210, 28, 'F');

  // Brand Header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB Martin Bandiera', 14, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(167, 243, 208); // Emerald-200
  doc.text('Módulo de Tesorería & Cobranzas · CUIT: 30-71720268-2', 14, 17);
  doc.text('Mendoza - Valle de Uco · Tel: +54 9 2622 50-5195', 14, 22);

  // Badge
  doc.setFillColor(16, 185, 129); // Emerald-500
  doc.roundedRect(138, 6, 58, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('RECIBO OFICIAL DE COBRO', 141, 12);
  doc.setFontSize(8);
  doc.text(`Nº ${data.receiptNumber}`, 141, 18);

  let currentY = 36;

  // Client Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, 182, 28, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE / PAGADOR:', 18, currentY + 6);
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(data.clientName, 18, currentY + 13);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('REMITOS CANCELADOS:', 18, currentY + 20);
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(data.remitoIds.join(', ') || 'N/A', 56, currentY + 20);

  // Right side of client box
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('FECHA DE PAGO / COBRO:', 120, currentY + 6);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(data.date, 120, currentY + 13);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('FACTURA VINCULADA:', 120, currentY + 20);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(data.invoiceNumber || 'S/F (Directo)', 158, currentY + 20);

  currentY = 70;

  // Fiscal Breakdown Table
  const fiscalRows: any[] = [
    ['Total Bruto Facturado / Liquidado', formatCurrency(data.totalAmount)]
  ];

  if (iva > 0) {
    fiscalRows.push(['(-) Retención IVA Deducida', `-${formatCurrency(iva)}`]);
  }
  if (iibb > 0) {
    fiscalRows.push(['(-) Retención Ingresos Brutos (IIBB) Deducida', `-${formatCurrency(iibb)}`]);
  }
  if (ganancias > 0) {
    fiscalRows.push(['(-) Retención Impuesto a las Ganancias Deducida', `-${formatCurrency(ganancias)}`]);
  }
  if (totalRetenciones > 0) {
    fiscalRows.push(['Total Retenciones Fiscales', `-${formatCurrency(totalRetenciones)}`]);
  }
  fiscalRows.push(['TOTAL NETO PERCIBIDO EFECTIVO', formatCurrency(netoPercibido)]);

  autoTable(doc, {
    startY: currentY,
    head: [['LIQUIDACIÓN & RETENCIONES IMPOSITIVAS', 'IMPORTE ($)']],
    body: fiscalRows,
    theme: 'striped',
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 52, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 8;

  // Payment Methods Table
  const paymentRows = (data.paymentMethods && data.paymentMethods.length > 0)
    ? data.paymentMethods.map(p => [
        p.method,
        p.bank || 'Caja Central',
        p.reference || 'S/Ref',
        p.paymentDate || data.date,
        formatCurrency(p.amount)
      ])
    : [['Efectivo / Transferencia', 'Banco Galicia', 'Cobro Asentado', data.date, formatCurrency(netoPercibido)]];

  autoTable(doc, {
    startY: currentY,
    head: [['FORMA DE PAGO', 'BANCO / ENTIDAD', 'REFERENCIA / Nº COMPROBANTE', 'FECHA', 'MONTO ($)']],
    body: paymentRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 38 },
      2: { cellWidth: 46 },
      3: { cellWidth: 26, halign: 'center' },
      4: { cellWidth: 34, halign: 'right', fontStyle: 'bold', textColor: [5, 150, 105] }
    },
    margin: { left: 14, right: 14 }
  });

  // @ts-ignore
  currentY = (doc as any).lastAutoTable.finalY + 10;

  // Notes box
  if (data.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Observaciones: ${data.notes}`, 14, currentY);
    currentY += 8;
  }

  // Footer note
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Documento de Cobranza Registrado en Archivo Digital · ${new Date().toLocaleString('es-AR')}`, 105, 287, { align: 'center' });

  // Save
  const cleanNum = data.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Recibo_Cobro_${cleanNum}.pdf`);
};

/**
 * Generates and downloads a consolidated PDF for an Invoice grouping multiple remitos
 */
export const generateFacturaAgrupadaPDF = (data: {
  invoiceNumber: string;
  invoiceDate: string;
  clientName: string;
  records: TechnicalAuditRecord[];
}): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const totalServicios = data.records.reduce((acc, r) => acc + (r.billedPrice > 0 ? r.billedPrice : r.suggestedPrice), 0);
  const totalMateriales = data.records.reduce((acc, r) => acc + (r.materialsCost || 0), 0);
  const totalIVA = data.records.reduce((acc, r) => acc + (r.retencionIVA || 0), 0);
  const totalIIBB = data.records.reduce((acc, r) => acc + (r.retencionIIBB || 0), 0);
  const totalGanancias = data.records.reduce((acc, r) => acc + (r.retencionGanancias || 0), 0);
  const totalRetenciones = totalIVA + totalIIBB + totalGanancias;
  const totalNeto = Math.max(0, totalServicios - totalRetenciones);

  // Top Bar
  doc.setFillColor(30, 58, 138); // Blue-900
  doc.rect(0, 0, 210, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB Martin Bandiera', 14, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(191, 219, 254); // Blue-200
  doc.text('Ingeniería, Obras Eléctricas y Mantenimiento · CUIT: 30-71720268-2', 14, 17);
  doc.text('Mendoza - Valle de Uco · Tel: +54 9 2622 50-5195', 14, 22);

  // Badge
  doc.setFillColor(59, 130, 246); // Blue-500
  doc.roundedRect(130, 6, 66, 16, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('DETALLE DE FACTURA', 133, 12);
  doc.setFontSize(8);
  doc.text(`FACTURA: ${data.invoiceNumber}`, 133, 18);

  let currentY = 36;

  // Client Box
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, currentY, 182, 26, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE / FACTURADO A:', 18, currentY + 6);
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const factClientLines = doc.splitTextToSize(data.clientName || 'Cliente', 94);
  doc.text(factClientLines, 18, currentY + 12);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CANTIDAD DE REMITOS INCLUIDOS:', 18, currentY + 20);
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`${data.records.length} remito(s)`, 72, currentY + 20);

  // Right side
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('FECHA DE FACTURACIÓN:', 120, currentY + 6);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.invoiceDate || new Date().toISOString().split('T')[0], 120, currentY + 12);

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Nº FACTURA OFICIAL:', 120, currentY + 20);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 58, 138);
  doc.text(data.invoiceNumber, 156, currentY + 20);

  currentY = 68;

  // Remitos Table
  const tableData = data.records.map(r => [
    r.remitoId,
    r.remitoPapel || '-',
    r.date,
    r.workPoint || r.siteLocation || '-',
    r.description || 'Mantenimiento preventivo',
    formatCurrency(r.billedPrice > 0 ? r.billedPrice : r.suggestedPrice)
  ]);

  autoTable(doc, {
    startY: currentY,
    head: [['REMITO', 'PAPEL', 'FECHA', 'UBICACIÓN / PUNTO', 'DESCRIPCIÓN', 'IMPORTE ($)']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 20 },
      2: { cellWidth: 22, halign: 'center' },
      3: { cellWidth: 38 },
      4: { cellWidth: 48 },
      5: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }
    },
    margin: { top: 22, bottom: 22, left: 14, right: 14 }
  });

  // @ts-ignore
  const factFinalY = (doc as any).lastAutoTable.finalY || 120;
  if (factFinalY + 44 > 270) {
    doc.addPage();
    currentY = 22;
  } else {
    currentY = factFinalY + 6;
  }

  // Financial summary
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(110, currentY, 86, 36, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Bruto Remitos:', 114, currentY + 7);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(totalServicios), 190, currentY + 7, { align: 'right' });

  if (totalRetenciones > 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('Retenciones Estimadas (IVA/IIBB/Gan):', 114, currentY + 14);
    doc.setFont('helvetica', 'bold');
    doc.text(`-${formatCurrency(totalRetenciones)}`, 190, currentY + 14, { align: 'right' });
  }

  doc.setDrawColor(147, 197, 253);
  doc.line(114, currentY + 19, 192, currentY + 19);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL FACTURADO:', 114, currentY + 27);
  doc.setFontSize(11);
  doc.setTextColor(30, 58, 138);
  doc.text(formatCurrency(totalServicios), 190, currentY + 27, { align: 'right' });

  // Multi-page Footer
  const totalFactPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalFactPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`JOB Martin Bandiera · Reporte de Facturación Agrupada · ${new Date().toLocaleString('es-AR')}`, 14, 290);
    doc.text(`Página ${i} de ${totalFactPages}`, 196, 290, { align: 'right' });
  }

  const cleanInv = data.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Factura_Detalle_${cleanInv}.pdf`);
};

/**
 * Generates and downloads an optimized consolidated PDF for Remitos Pasados
 * containing all selected remitos with multi-page support, prominent totals,
 * wrapped header text, and no signature clutter.
 */
export const generateRemitoPasadoConsolidadoPDF = (data: {
  receiptNumber?: string;
  date?: string;
  clientName: string;
  siteLocation?: string;
  records: TechnicalAuditRecord[];
  notes?: string;
}): void => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const totalFinalPasado = roundCurrency(
    data.records.reduce(
      (acc, r) => acc + ((r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || 0)) || 0),
      0
    )
  );
  const totalMateriales = roundCurrency(
    data.records.reduce(
      (acc, r) => acc + (r.materialsCost || 0),
      0
    )
  );
  const totalServicios = roundCurrency(Math.max(0, totalFinalPasado - totalMateriales));

  const receiptNumber = data.receiptNumber || `RPC-${Date.now().toString().slice(-6)}`;
  const dateStr = data.date || new Date().toISOString().split('T')[0];

  const dates = data.records.map(r => r.date).filter(Boolean).sort();
  const dateRangeStr = dates.length > 1
    ? `${dates[0]} al ${dates[dates.length - 1]}`
    : (dates[0] || dateStr);

  // Header Background Bar (Amber brand gradient style)
  doc.setFillColor(180, 83, 9); // Amber-700
  doc.rect(0, 0, 210, 28, 'F');

  // Brand Name & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB Martin Bandiera', 14, 12);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(254, 243, 199); // Amber-100
  doc.text('Ingeniería, Obras Eléctricas y Mantenimiento de Pozos Profundos', 14, 17);
  doc.text('Mendoza - Valle de Uco · Tel: +54 9 2622 50-5195 · CUIT: 30-71720268-2', 14, 22);

  // Badge (Right side of header)
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.roundedRect(124, 6, 72, 16, 2, 2, 'F');
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('REMITO PASADO CONSOLIDADO', 127, 12);
  doc.setFontSize(8);
  doc.text(`Nº ${receiptNumber}`, 127, 18);

  let currentY = 34;

  // Split client name and location text to fit strictly within 96mm left column
  // (Prevents overlapping with right column FECHA DE EMISIÓN)
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  const clientLines = doc.splitTextToSize(data.clientName || 'Cliente sin asignar', 94);
  const locationText = data.siteLocation || data.records[0]?.siteLocation || 'Mendoza / Valle de Uco';
  const locationLines = doc.splitTextToSize(locationText, 94);

  const clientBoxHeight = Math.max(30, 18 + clientLines.length * 4.5 + locationLines.length * 4);

  // Client Box Container
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.roundedRect(14, currentY, 182, clientBoxHeight, 2, 2, 'FD');

  // Left Column - Client Info
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('CLIENTE / RAZÓN SOCIAL:', 18, currentY + 6);

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(clientLines, 18, currentY + 11.5);

  const locY = currentY + 12 + clientLines.length * 4.5;
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('UBICACIÓN / ZONA:', 18, locY);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(locationLines, 18, locY + 4.5);

  // Right Column - Dates and Scope (strictly bounded at X = 120 to 192)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('FECHA DE EMISIÓN:', 120, currentY + 6);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(dateStr, 120, currentY + 11.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('REMITOS CONSOLIDADOS:', 120, locY);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 83, 9);
  doc.text(`${data.records.length} comprobante(s) detallados`, 120, locY + 4.5);

  const startY = currentY + clientBoxHeight + 5;

  // Table of Remitos
  const tableData = data.records.map(r => {
    const remitoTotal = roundCurrency((r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || 0)) || 0);
    const mat = roundCurrency(r.materialsCost || 0);
    const servicio = roundCurrency(Math.max(0, remitoTotal - mat));
    const totalRow = remitoTotal;

    let desc = r.description || r.workPoint || 'Mantenimiento electromecánico y asistencia en pozo';
    if (r.materialsDetails && r.materialsDetails.trim()) {
      desc += `\n[Mat: ${r.materialsDetails.trim()}]`;
    }

    const remitoLabel = r.remitoPapel
      ? `${r.remitoId}\n(Papel: ${r.remitoPapel})`
      : r.remitoId;

    return [
      remitoLabel,
      r.date || '-',
      desc,
      formatCurrency(servicio),
      formatCurrency(mat),
      `${formatCurrency(totalRow)} + IVA`
    ];
  });

  autoTable(doc, {
    startY: startY,
    head: [
      [
        'REMITO',
        'FECHA',
        'DESCRIPCIÓN DE TAREAS',
        'SERVICIO ($)',
        'MATERIALES ($)',
        'TOTAL (+IVA)'
      ]
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [180, 83, 9], // Amber-700
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 2
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2 }
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 62 },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 22, halign: 'right', textColor: [180, 83, 9] },
      5: { cellWidth: 26, halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42] }
    },
    margin: { top: 22, bottom: 22, left: 14, right: 14 },
    pageBreak: 'auto',
    rowPageBreak: 'avoid',
    didDrawPage: (dataHook) => {
      // Draw professional mini header banner on pages 2 and subsequent
      if (dataHook.pageNumber > 1) {
        doc.setFillColor(30, 41, 59); // Slate-800
        doc.rect(0, 0, 210, 14, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`JOB Martin Bandiera · Resumen Remito Pasado Consolidado Nº ${receiptNumber}`, 14, 9);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(203, 213, 225);
        doc.text(`Cliente: ${(data.clientName || '').slice(0, 42)}`, 196, 9, { align: 'right' });
      }
    }
  });

  // Calculate table bottom position
  // @ts-ignore
  const finalY = (doc as any).lastAutoTable.finalY || 120;
  const totalsBoxHeight = 36;
  const pageSafeBottom = 270; // safe space before footer

  // If totals box does not fit on current page, create a new page
  if (finalY + totalsBoxHeight + 6 > pageSafeBottom) {
    doc.addPage();
    // Header for totals page
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, 210, 14, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`JOB Martin Bandiera · Resumen Remito Pasado Consolidado Nº ${receiptNumber} (Totales)`, 14, 9);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(203, 213, 225);
    doc.text(`Cliente: ${(data.clientName || '').slice(0, 42)}`, 196, 9, { align: 'right' });

    currentY = 22;
  } else {
    currentY = finalY + 6;
  }

  // Left Box: Operational Summary & Notes (X = 14 to 98)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, currentY, 86, totalsBoxHeight, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('RESUMEN DE PRESTACIÓN OPERATIVA:', 18, currentY + 6);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Total Comprobantes: ${data.records.length} remitos pasados`, 18, currentY + 12);
  doc.text(`Período de Trabajos: ${dateRangeStr}`, 18, currentY + 17);

  doc.setFontSize(6.8);
  doc.setFont('helvetica', 'italic');
  const summaryNotes = data.notes
    ? `Obs: ${data.notes}`
    : 'Liquidación consolidada de remitos pasados de obras, servicios y materiales para control y facturación.';
  const noteLines = doc.splitTextToSize(summaryNotes, 78);
  doc.text(noteLines, 18, currentY + 23);

  // Right Box: Prominent High-Visibility Totals Card (X = 104 to 196)
  doc.setFillColor(254, 252, 232); // Light amber
  doc.setDrawColor(217, 119, 6); // Amber-600
  doc.setLineWidth(0.6);
  doc.roundedRect(104, currentY, 92, totalsBoxHeight, 2, 2, 'FD');

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 53, 15);
  doc.text('Subtotal Servicios (Mano de Obra):', 108, currentY + 6);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(formatCurrency(totalServicios), 192, currentY + 6, { align: 'right' });

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal Materiales Computados:', 108, currentY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(180, 83, 9);
  doc.text(formatCurrency(totalMateriales), 192, currentY + 12, { align: 'right' });

  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.3);
  doc.line(108, currentY + 15.5, 192, currentY + 15.5);

  // Prominent TOTAL Highlight Banner
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.roundedRect(107, currentY + 17.5, 86, 11, 1.5, 1.5, 'F');

  doc.setTextColor(15, 23, 42); // Slate-950
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL REMITO PASADO:', 110, currentY + 24.5);
  doc.setFontSize(11);
  doc.text(`${formatCurrency(totalFinalPasado)} + IVA`, 190, currentY + 24.5, { align: 'right' });

  // Tax note
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120, 53, 15);
  doc.text('* Valores netos. De requerir factura oficial, se adiciona el IVA (21%).', 108, currentY + 33);

  // Signatures have been completely eliminated as requested by user.

  // Multi-page Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 287, 196, 287);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text(
      `JOB Martin Bandiera · Comprobante Oficial Remito Pasado Consolidado · ${new Date().toLocaleDateString('es-AR')}`,
      14,
      291
    );
    doc.text(
      `Página ${i} de ${totalPages}`,
      196,
      291,
      { align: 'right' }
    );
  }

  const cleanClient = (data.clientName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
  doc.save(`Resumen_Remito_Pasado_${cleanClient}_${receiptNumber}.pdf`);
};

export { generateSingleLiquidationReceiptPDF, generateBatchLiquidationReceiptsPDF } from './liquidationPdfGenerator';


