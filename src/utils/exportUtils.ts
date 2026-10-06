import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { FinancialMetricRecord } from '../types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0
  }).format(amount || 0);
};

export const exportFinancialReportToPDF = (
  reports: FinancialMetricRecord[],
  meta: {
    title?: string;
    userName?: string;
    userRole?: string;
    periodFilter?: string;
  }
) => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4'
  });

  const totalCargado = reports.reduce((s, r) => s + (r.cargado || 0), 0);
  const totalFacturado = reports.reduce((s, r) => s + (r.facturado || 0), 0);
  const totalCobrado = reports.reduce((s, r) => s + (r.cobrado || 0), 0);
  const totalPendiente = Math.max(0, totalFacturado - totalCobrado);
  const ratio = totalFacturado > 0 ? ((totalCobrado / totalFacturado) * 100).toFixed(1) : '0';

  // Corporate Banner Header
  doc.setFillColor(10, 25, 47); // Dark navy
  doc.rect(0, 0, doc.internal.pageSize.width, 70, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('JOB MARTIN BANDIERA', 40, 35);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 210, 255); // Cyan highlight
  doc.text('ECOSISTEMA SAAS V5.0 - GESTIÓN EMPRESARIAL & AUDITORÍA FINANCIERA', 40, 52);

  // Metadata block
  doc.setTextColor(50, 60, 80);
  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Fecha de emisión: ${dateStr}`, doc.internal.pageSize.width - 240, 32);
  doc.text(`Generado por: ${meta.userName || 'Martin Bandiera'} (${meta.userRole || 'SuperAdmin'})`, doc.internal.pageSize.width - 240, 48);

  // KPI Summary Boxes
  const kpiTop = 85;
  const boxWidth = 145;
  const boxHeight = 46;
  const startX = 40;

  const kpis = [
    { label: 'TOTAL CARGADO', val: formatCurrency(totalCargado), color: [14, 116, 144] },
    { label: 'TOTAL FACTURADO', val: formatCurrency(totalFacturado), color: [30, 64, 175] },
    { label: 'TOTAL COBRADO', val: formatCurrency(totalCobrado), color: [16, 149, 100] },
    { label: 'PENDIENTE DE COBRO', val: formatCurrency(totalPendiente), color: [217, 119, 6] },
    { label: 'EFECTIVIDAD COBRO', val: `${ratio}%`, color: [88, 28, 135] }
  ];

  kpis.forEach((kpi, index) => {
    const x = startX + index * (boxWidth + 8);
    doc.setFillColor(245, 248, 252);
    doc.setDrawColor(220, 226, 235);
    doc.roundedRect(x, kpiTop, boxWidth, boxHeight, 4, 4, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.label, x + 10, kpiTop + 16);

    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, x + 10, kpiTop + 34);
  });

  // Main Data Table
  const tableData = reports.map(r => [
    r.code,
    r.periodLabel,
    r.clientName,
    r.projectName.length > 35 ? `${r.projectName.slice(0, 32)}...` : r.projectName,
    r.category,
    formatCurrency(r.cargado),
    formatCurrency(r.facturado),
    formatCurrency(r.cobrado),
    formatCurrency(r.pendingBalance),
    r.status
  ]);

  autoTable(doc, {
    startY: 145,
    margin: { left: 40, right: 40 },
    head: [
      [
        'Código',
        'Período',
        'Cliente',
        'Proyecto / Servicio',
        'Categoría',
        'Cargado',
        'Facturado',
        'Cobrado',
        'Saldo Pendiente',
        'Estado'
      ]
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: 'bold' },
      1: { cellWidth: 60 },
      2: { cellWidth: 105 },
      3: { cellWidth: 150 },
      4: { cellWidth: 70 },
      5: { cellWidth: 65, halign: 'right' },
      6: { cellWidth: 65, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 65, halign: 'right', textColor: [16, 149, 100] },
      8: { cellWidth: 65, halign: 'right', textColor: [217, 119, 6] },
      9: { cellWidth: 60, halign: 'center' }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    didDrawPage: data => {
      // Footer
      const totalPages = (data as any).pageCount || 1;
      const str = `Página ${data.pageNumber} de ${totalPages} | JOB Martin Bandiera S.A. - Documento Confidencial`;
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(str, 40, doc.internal.pageSize.height - 20);
    }
  });

  doc.save(`JOB_Martin_Bandiera_Reporte_Financiero_${new Date().toISOString().slice(0, 10)}.pdf`);
};

export const exportFinancialReportToExcel = (
  reports: FinancialMetricRecord[],
  meta: {
    title?: string;
    userName?: string;
  }
) => {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Detalle de Reportes
  const detailData = reports.map(r => ({
    'Código Reporte': r.code,
    'Período': r.periodLabel,
    'Cliente': r.clientName,
    'Proyecto / Servicio': r.projectName,
    'Categoría': r.category,
    'Monto Cargado (ARS)': r.cargado,
    'Monto Facturado (ARS)': r.facturado,
    'Monto Cobrado (ARS)': r.cobrado,
    'Saldo Pendiente (ARS)': r.pendingBalance,
    'Estado Cobranza': r.status,
    'Fecha': r.date,
    'Responsable': r.createdBy,
    'Observaciones': r.notes || ''
  }));

  const wsDetail = XLSX.utils.json_to_sheet(detailData);

  // Set column widths
  wsDetail['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 28 },
    { wch: 40 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 16 },
    { wch: 14 },
    { wch: 22 },
    { wch: 35 }
  ];

  XLSX.utils.book_append_sheet(wb, wsDetail, 'Reportes Detallados');

  // Sheet 2: Resumen Ejecutivo
  const totalCargado = reports.reduce((s, r) => s + (r.cargado || 0), 0);
  const totalFacturado = reports.reduce((s, r) => s + (r.facturado || 0), 0);
  const totalCobrado = reports.reduce((s, r) => s + (r.cobrado || 0), 0);
  const totalPendiente = Math.max(0, totalFacturado - totalCobrado);
  const ratio = totalFacturado > 0 ? ((totalCobrado / totalFacturado) * 100).toFixed(2) : '0';

  const summaryData = [
    { 'MÉTRICA CLAVE': 'Empresa', 'VALOR': 'JOB Martin Bandiera S.A.' },
    { 'MÉTRICA CLAVE': 'Generado por', 'VALOR': meta.userName || 'Martin Bandiera' },
    { 'MÉTRICA CLAVE': 'Fecha de Exportación', 'VALOR': new Date().toISOString().split('T')[0] },
    { 'MÉTRICA CLAVE': 'Cantidad de Registros', 'VALOR': reports.length },
    { 'MÉTRICA CLAVE': 'Total Cargado (ARS)', 'VALOR': totalCargado },
    { 'MÉTRICA CLAVE': 'Total Facturado (ARS)', 'VALOR': totalFacturado },
    { 'MÉTRICA CLAVE': 'Total Cobrado (ARS)', 'VALOR': totalCobrado },
    { 'MÉTRICA CLAVE': 'Saldo Pendiente de Cobro (ARS)', 'VALOR': totalPendiente },
    { 'MÉTRICA CLAVE': 'Ratio de Efectividad (%)', 'VALOR': `${ratio}%` }
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen Ejecutivo');

  XLSX.writeFile(wb, `JOB_Martin_Bandiera_Metricas_${new Date().toISOString().slice(0, 10)}.xlsx`);
};
