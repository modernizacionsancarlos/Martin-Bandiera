import * as XLSX from 'xlsx';
import { TechnicalAuditRecord, RemitoStatus, ClientItem, MaterialItem, VehicleItem, VehicleEventItem, WorkerItem, WorkerCategory, UserRole } from '../types';
import { roundCurrency, formatCurrency } from './calculationUtils';
import { todayLocalISO } from './dateUtils';

export interface ParsedClientRow {
  clientName: string;
  cuit?: string;
  location?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface ExcelImportResult {
  records: Partial<TechnicalAuditRecord>[];
  errors: string[];
  totalRows: number;
}

export interface ExcelClientImportResult {
  clients: Partial<ClientItem>[];
  errors: string[];
  totalRows: number;
}

export interface ExcelMaterialImportResult {
  materials: Omit<MaterialItem, 'id'>[];
  errors: string[];
  totalRows: number;
}

export interface ExcelWorkerImportResult {
  workers: Omit<WorkerItem, 'id'>[];
  errors: string[];
  totalRows: number;
}

/**
 * Format date from Excel numeric date serial or standard string
 */
export const formatExcelDate = (val: any): string => {
  if (!val) return todayLocalISO();

  if (typeof val === 'number') {
    // Excel base date serial number to JS Date
    const utcDays = Math.floor(val - 25569);
    const utcValue = utcDays * 86400;
    const dateInfo = new Date(utcValue * 1000);
    const yyyy = dateInfo.getUTCFullYear();
    const mm = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateInfo.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const str = String(val).trim();
  // If in DD/MM/YYYY format
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // If in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return todayLocalISO();
};

/**
 * Normalizes column header name for flexible matching
 */
const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

/**
 * Parse Excel file containing Remitos / Auditoría Técnica
 */
export const parseRemitosExcel = async (file: File): Promise<ExcelImportResult> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const records: Partial<TechnicalAuditRecord>[] = [];
  const errors: string[] = [];

  rawRows.forEach((row, index) => {
    try {
      // Find field values based on multiple possible header variants
      const keys = Object.keys(row);
      const getVal = (...variants: string[]): any => {
        for (const v of variants) {
          const normV = normalizeHeader(v);
          const foundKey = keys.find(k => normalizeHeader(k) === normV || normalizeHeader(k).includes(normV));
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
            return row[foundKey];
          }
        }
        return undefined;
      };

      const remitoIdRaw = getVal('remito', 'nro remito', 'remitoid', 'id', 'numero', 'codigo');
      const remitoPapelRaw = getVal('papel', 'remito papel', 'nro papel', 'talonario');
      const dateRaw = getVal('fecha', 'date', 'emision');
      const clientRaw = getVal('cliente', 'razon social', 'empresa', 'client');
      const locationRaw = getVal('ubicacion', 'finca', 'lugar', 'sitio', 'localidad', 'zona');
      const workPointRaw = getVal('punto de trabajo', 'punto', 'pozo', 'sector', 'descripcion punto', 'instalacion', 'lugar de trabajo');
      const descRaw = getVal(
        'descripcion de tareas',
        'descripcion de tarea',
        'descripcion',
        'detalle de tareas',
        'detalle de tarea',
        'detalle',
        'trabajos realizados',
        'trabajo realizado',
        'trabajos efectuados',
        'trabajo efectuado',
        'trabajos',
        'trabajo',
        'tareas realizadas',
        'tarea realizada',
        'tareas desarrolladas',
        'tareas',
        'tarea',
        'actividades realizadas',
        'actividad realizada',
        'actividades',
        'actividad',
        'servicio realizado',
        'servicios realizados',
        'servicio',
        'servicios',
        'labores',
        'labor',
        'observaciones',
        'informe tecnico',
        'informe',
        'motivo',
        'concepto'
      );
      const horasTrabajoRaw = getVal('horas trabajo', 'horas', 'hs trabajo', 'tiempo');
      const horasViajeRaw = getVal('horas viaje', 'hs viaje');
      const distanceKmRaw = getVal('km', 'kilometros', 'distancia');
      const laborCostRaw = getVal('mano de obra', 'servicio', 'costo servicio', 'mo');
      const materialsCostRaw = getVal('materiales', 'costo materiales', 'mat');
      const materialsDetailsRaw = getVal('detalle materiales', 'descripcion materiales');
      const billedPriceRaw = getVal('total facturado', 'monto facturado', 'total', 'precio');
      const statusRaw = getVal('estado', 'status', 'solapa');
      const invoiceNumberRaw = getVal('factura', 'nro factura', 'numero factura', 'fac');
      const invoiceDateRaw = getVal('fecha factura', 'fecha facturacion');
      const retIVARaw = getVal('ret iva', 'retencion iva', 'iva');
      const retIIBBRaw = getVal('ret iibb', 'retencion iibb', 'iibb', 'ingresos brutos');
      const retGanRaw = getVal('ret ganancias', 'retencion ganancias', 'ganancias');
      const leadTechRaw = getVal('tecnico', 'responsable', 'operario');

      const clientName = clientRaw ? String(clientRaw).trim() : 'Cliente Importado';
      const remitoId = remitoIdRaw ? String(remitoIdRaw).trim() : `R-IMP-${1000 + index}`;
      const date = formatExcelDate(dateRaw);
      const fechaFactura = invoiceDateRaw ? formatExcelDate(invoiceDateRaw) : undefined;

      let status: RemitoStatus = 'Cargado';
      if (statusRaw) {
        const s = String(statusRaw).toLowerCase();
        if (s.includes('factur')) status = 'Facturado';
        else if (s.includes('pasad')) status = 'Pasado';
        else if (s.includes('cobr')) status = 'Cobrado';
      } else if (invoiceNumberRaw) {
        status = 'Facturado';
      }

      const laborDirectCost = Number(laborCostRaw) || 0;
      const materialsCost = Number(materialsCostRaw) || 0;
      const hoursWorked = Number(horasTrabajoRaw) || 4;
      const travelHours = Number(horasViajeRaw) || 1;
      const distanceKm = Number(distanceKmRaw) || 30;

      const billedPrice = Number(billedPriceRaw) || (laborDirectCost + materialsCost);
      const suggestedPrice = billedPrice > 0 ? billedPrice : 150000;

      records.push({
        remitoId,
        remitoPapel: remitoPapelRaw ? String(remitoPapelRaw).trim() : undefined,
        date,
        clientName,
        siteLocation: locationRaw ? String(locationRaw).trim() : 'Mendoza / Valle de Uco',
        workPoint: workPointRaw ? String(workPointRaw).trim() : 'Pozo / Tablero Eléctrico',
        isGuardia: false,
        hoursWorked,
        travelHours,
        distanceKm,
        horaEntrada: '08:00',
        horaSalida: '12:30',
        logisticsCost: 0,
        laborDirectCost: laborDirectCost || suggestedPrice * 0.7,
        operatingCost: laborDirectCost + materialsCost,
        materialsCost,
        materialsDetails: materialsDetailsRaw ? String(materialsDetailsRaw).trim() : undefined,
        description: descRaw ? String(descRaw).trim() : 'Mantenimiento preventivo e inspección técnica',
        suggestedPrice,
        billedPrice,
        collectedPrice: status === 'Cobrado' ? billedPrice : 0,
        leadTech: leadTechRaw ? String(leadTechRaw).trim() : 'Ing. Matías Calderón',
        helpers: [],
        status,
        semaforo: status === 'Cobrado' ? 'verde' : status === 'Facturado' ? 'verde' : status === 'Pasado' ? 'naranja' : 'rojo',
        numeroFactura: invoiceNumberRaw ? String(invoiceNumberRaw).trim() : undefined,
        fechaFactura,
        retencionIVA: Number(retIVARaw) || 0,
        retencionIIBB: Number(retIIBBRaw) || 0,
        retencionGanancias: Number(retGanRaw) || 0
      });
    } catch (err: any) {
      errors.push(`Fila ${index + 2}: ${err.message || 'Error al procesar fila'}`);
    }
  });

  return {
    records,
    errors,
    totalRows: rawRows.length
  };
};

/**
 * Generate and download an Excel template for Remitos
 */
export const downloadRemitosExcelTemplate = (): void => {
  const sampleData = [
    {
      'Nº Remito': 'R-2026-001',
      'Remito Papel': '0001-000452',
      'Fecha': '2026-03-01',
      'Cliente': 'Bodega Catena Zapata',
      'Ubicación': 'Agrelo, Luján de Cuyo',
      'Punto de Trabajo': 'Pozo Nº 3 - Sector Bodega',
      'Descripción': 'Reemplazo de contactores y calibración de relé térmico',
      'Mano de Obra': 280000,
      'Materiales': 85000,
      'Detalle Materiales': 'Contactor Siemens 40A, terminales',
      'Total Facturado': 365000,
      'Estado': 'Facturado',
      'Nº Factura': 'FAC-A-0001-00004523',
      'Fecha Factura': '2026-03-05',
      'Ret IVA': 0,
      'Ret IIBB': 0,
      'Ret Ganancias': 0,
      'Técnico': 'Ing. Matías Calderón'
    },
    {
      'Nº Remito': 'R-2026-002',
      'Remito Papel': '0001-000453',
      'Fecha': '2026-03-02',
      'Cliente': 'Bodega Catena Zapata',
      'Ubicación': 'Agrelo, Luján de Cuyo',
      'Punto de Trabajo': 'Pozo Nº 1 - Riego por Goteo',
      'Descripción': 'Medición de aislamiento y rearme de protección',
      'Mano de Obra': 240000,
      'Materiales': 0,
      'Detalle Materiales': '',
      'Total Facturado': 240000,
      'Estado': 'Facturado',
      'Nº Factura': 'FAC-A-0001-00004523',
      'Fecha Factura': '2026-03-05',
      'Ret IVA': 0,
      'Ret IIBB': 0,
      'Ret Ganancias': 0,
      'Técnico': 'Ing. Matías Calderón'
    },
    {
      'Nº Remito': 'R-2026-003',
      'Remito Papel': '0001-000454',
      'Fecha': '2026-03-04',
      'Cliente': 'Finca Flichman',
      'Ubicación': 'Barrancas, Maipú',
      'Punto de Trabajo': 'Tablero de Bombeo Principal',
      'Descripción': 'Mantenimiento de pozo profundo y prueba hidráulica',
      'Mano de Obra': 350000,
      'Materiales': 120000,
      'Detalle Materiales': 'Cables sumergibles 3x16mm',
      'Total Facturado': 470000,
      'Estado': 'Cargado',
      'Nº Factura': '',
      'Fecha Factura': '',
      'Ret IVA': 0,
      'Ret IIBB': 0,
      'Ret Ganancias': 0,
      'Técnico': 'Carlos Gómez'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Remitos');
  XLSX.writeFile(wb, 'Plantilla_Importacion_Remitos_JOB_Bandiera.xlsx');
};

/**
 * Parse Excel file containing Clientes matching user image:
 * [Razon Social | Cuit | Finca / Locacion | Email | Telefono | Direccion Fiscal | Latitud | Longitud | Distancia KM]
 */
export const parseClientesExcel = async (file: File): Promise<ExcelClientImportResult> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const clients: Partial<ClientItem>[] = [];
  const errors: string[] = [];

  const parseNumber = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return val;
    const str = String(val).trim().replace(',', '.');
    const n = parseFloat(str);
    return isNaN(n) ? undefined : n;
  };

  rawRows.forEach((row, index) => {
    try {
      const keys = Object.keys(row);
      const getVal = (...variants: string[]): any => {
        for (const v of variants) {
          const normV = normalizeHeader(v);
          const foundKey = keys.find(k => normalizeHeader(k) === normV || normalizeHeader(k).includes(normV));
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
            return row[foundKey];
          }
        }
        return undefined;
      };

      const razonSocialRaw = getVal('razon social', 'razonsocial', 'cliente', 'empresa', 'nombre');
      const cuitRaw = getVal('cuit', 'cuit/cuil', 'cuil', 'identificacion');
      const fincaLocacionRaw = getVal('finca / locacion', 'fincalocacion', 'finca', 'locacion', 'sede', 'sucursal', 'ubicacion');
      const emailRaw = getVal('email', 'correo', 'mail', 'contacto');
      const telefonoRaw = getVal('telefono', 'tel', 'celular', 'phone');
      const direccionFiscalRaw = getVal('direccion fiscal', 'direccionfiscal', 'direccion', 'domicilio', 'calle');
      const latitudRaw = getVal('latitud', 'lat');
      const longitudRaw = getVal('longitud', 'lng', 'lon');
      const distanciaKmRaw = getVal('distancia km', 'distanciakm', 'distancia', 'km', 'kms');

      if (!razonSocialRaw) {
        // Skip empty spacer rows
        return;
      }

      const razonSocial = String(razonSocialRaw).trim();
      const cuit = cuitRaw ? String(cuitRaw).trim() : '';
      const fincaLocacion = fincaLocacionRaw ? String(fincaLocacionRaw).trim() : '';
      const email = emailRaw ? String(emailRaw).trim() : '';
      const telefono = telefonoRaw ? String(telefonoRaw).trim() : '';
      const direccionFiscal = direccionFiscalRaw ? String(direccionFiscalRaw).trim() : '';
      const latitud = parseNumber(latitudRaw);
      const longitud = parseNumber(longitudRaw);
      const distanciaKm = parseNumber(distanciaKmRaw) || 0;

      clients.push({
        id: `CLI-${Date.now().toString().slice(-4)}-${index + 1}`,
        razonSocial,
        cuit,
        fincaLocacion,
        email,
        telefono,
        direccionFiscal,
        latitud,
        longitud,
        distanciaKm,
        createdAt: new Date().toISOString()
      });
    } catch (err: any) {
      errors.push(`Fila ${index + 2}: ${err.message || 'Error al procesar cliente'}`);
    }
  });

  return {
    clients,
    errors,
    totalRows: rawRows.length
  };
};

/**
 * Generate and download an Excel template for Clientes matching image
 */
export const downloadClientesExcelTemplate = (): void => {
  const sampleClientes = [
    {
      'Razon Social': 'TechCorp S.A.',
      'Cuit': '30-12345678-9',
      'Finca / Locacion': 'Sede Central',
      'Email': 'adm@cliente.com',
      'Telefono': '2614556677',
      'Direccion Fiscal': 'Calle Principal 100, Mendoza',
      'Latitud': -32.8895,
      'Longitud': -68.8451,
      'Distancia KM': 15.5
    },
    {
      'Razon Social': '1 AGRODAY SA',
      'Cuit': '30-71123456-9',
      'Finca / Locacion': 'Paso de las Carretas',
      'Email': 'administracion@agroday.com.ar',
      'Telefono': '2614890012',
      'Direccion Fiscal': 'Ruta 40 Km 3120, San Carlos',
      'Latitud': -33.7842,
      'Longitud': -69.0432,
      'Distancia KM': 35.0
    },
    {
      'Razon Social': '1 AGUSTIN CASTILLO',
      'Cuit': '20-25443210-4',
      'Finca / Locacion': 'Pareditas',
      'Email': 'agustin.castillo@fincas.com',
      'Telefono': '2622450119',
      'Direccion Fiscal': 'Carril Nacional s/n, Pareditas',
      'Latitud': -33.9512,
      'Longitud': -69.0711,
      'Distancia KM': 30.0
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleClientes);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  XLSX.writeFile(wb, 'Plantilla_Importacion_Clientes_JOB_Bandiera.xlsx');
};

/**
 * Export existing Clientes to Excel in the exact image structure
 */
export const exportClientesToExcel = (clients: ClientItem[]): void => {
  const exportData = clients.map(c => ({
    'Razon Social': c.razonSocial,
    'Cuit': c.cuit,
    'Finca / Locacion': c.fincaLocacion,
    'Email': c.email,
    'Telefono': c.telefono,
    'Direccion Fiscal': c.direccionFiscal,
    'Latitud': c.latitud ?? '',
    'Longitud': c.longitud ?? '',
    'Distancia KM': c.distanciaKm
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
  const dateStr = todayLocalISO();
  XLSX.writeFile(wb, `Base_Clientes_JOB_Bandiera_${dateStr}.xlsx`);
};

/**
 * Generate and download an Excel template for Materiales (.xlsx)
 */
export const downloadMaterialesExcelTemplate = (): void => {
  const sampleMateriales = [
    {
      'Codigo': 'CAB-XLPE-3x95',
      'Nombre / Descripcion': 'Cable Subterráneo XLPE Aluminio 3x95+50 mm²',
      'Categoria': 'Electricidad',
      'Stock Inicial': 450,
      'Unidad de Medida': 'Metros',
      'Stock Minimo': 200,
      'Precio Unitario ($)': 28500,
      'Ubicacion / Deposito': 'Depósito Central - Bahía B3'
    },
    {
      'Codigo': 'VALV-MAR-4P',
      'Nombre / Descripcion': 'Válvula Mariposa Wafer 4" Tipo EPDM palanca',
      'Categoria': 'Cañerías y Válvulas',
      'Stock Inicial': 14,
      'Unidad de Medida': 'Unidades',
      'Stock Minimo': 6,
      'Precio Unitario ($)': 94000,
      'Ubicacion / Deposito': 'Depósito Central - Bahía A1'
    },
    {
      'Codigo': 'TERM-ABB-250',
      'Nombre / Descripcion': 'Interruptor Termomagnético Moldeado 3x250A ABB',
      'Categoria': 'Electricidad',
      'Stock Inicial': 5,
      'Unidad de Medida': 'Unidades',
      'Stock Minimo': 3,
      'Precio Unitario ($)': 380000,
      'Ubicacion / Deposito': 'Gabinete de Seguridad Eléctrica'
    },
    {
      'Codigo': 'ROD-SKF-6312',
      'Nombre / Descripcion': 'Rodamiento Blindado 2RS SKF 6312/C3',
      'Categoria': 'Herramientas',
      'Stock Inicial': 22,
      'Unidad de Medida': 'Unidades',
      'Stock Minimo': 10,
      'Precio Unitario ($)': 42000,
      'Ubicacion / Deposito': 'Estantería Mecánica 2'
    },
    {
      'Codigo': 'LUB-ISO-VG68',
      'Nombre / Descripcion': 'Aceite Hidráulico Sintético ISO VG 68',
      'Categoria': 'Químicos y Fluidos',
      'Stock Inicial': 8,
      'Unidad de Medida': 'Tambores 200L',
      'Stock Minimo': 4,
      'Precio Unitario ($)': 410000,
      'Ubicacion / Deposito': 'Zona Inflamables con Batea'
    },
    {
      'Codigo': 'SEG-ARN-COMP',
      'Nombre / Descripcion': 'Arnés de Seguridad Anticaídas 4 Puntos Dieléctrico',
      'Categoria': 'Seguridad',
      'Stock Inicial': 12,
      'Unidad de Medida': 'Unidades',
      'Stock Minimo': 5,
      'Precio Unitario ($)': 88000,
      'Ubicacion / Deposito': 'Depósito EPP y Protección'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleMateriales);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Materiales');
  XLSX.writeFile(wb, 'Plantilla_Importacion_Materiales_JOB_Bandiera.xlsx');
};

/**
 * Parse an Excel file (.xlsx / .xls / .csv) into MaterialItem items
 */
export const parseMaterialesExcel = async (file: File): Promise<ExcelMaterialImportResult> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const materials: Omit<MaterialItem, 'id'>[] = [];
  const errors: string[] = [];

  const parseNumber = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return val;
    const str = String(val).trim().replace(',', '.');
    const n = parseFloat(str);
    return isNaN(n) ? undefined : n;
  };

  const validCategories: MaterialItem['category'][] = [
    'Electricidad',
    'Cañerías y Válvulas',
    'Herramientas',
    'Químicos y Fluidos',
    'Seguridad'
  ];

  const normalizeCategory = (val: string): MaterialItem['category'] => {
    const v = (val || '').toLowerCase().trim();
    if (v.includes('elect') || v.includes('cable') || v.includes('tablero') || v.includes('termic') || v.includes('motor')) {
      return 'Electricidad';
    }
    if (v.includes('cañ') || v.includes('can') || v.includes('valv') || v.includes('val') || v.includes('tubo') || v.includes('brida') || v.includes('fitting')) {
      return 'Cañerías y Válvulas';
    }
    if (v.includes('herram') || v.includes('mecan') || v.includes('rodam') || v.includes('bomba') || v.includes('maquin')) {
      return 'Herramientas';
    }
    if (v.includes('quim') || v.includes('fluid') || v.includes('aceite') || v.includes('lubric') || v.includes('grasa') || v.includes('liquido')) {
      return 'Químicos y Fluidos';
    }
    if (v.includes('segur') || v.includes('epp') || v.includes('casco') || v.includes('arnes') || v.includes('guante') || v.includes('gafa') || v.includes('protec')) {
      return 'Seguridad';
    }
    const matched = validCategories.find(c => c.toLowerCase() === v);
    return matched || 'Electricidad';
  };

  rawRows.forEach((row, index) => {
    try {
      const keys = Object.keys(row);
      const getVal = (...variants: string[]): any => {
        for (const v of variants) {
          const normV = normalizeHeader(v);
          const foundKey = keys.find(k => normalizeHeader(k) === normV || normalizeHeader(k).includes(normV));
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
            return row[foundKey];
          }
        }
        return undefined;
      };

      const nameRaw = getVal('nombre / descripcion', 'nombre descripcion', 'nombre', 'descripcion', 'material', 'insumo', 'producto', 'articulo', 'item');
      const codeRaw = getVal('codigo', 'cod', 'sku', 'art', 'id', 'clave');
      const categoryRaw = getVal('categoria', 'rubro', 'tipo', 'familia', 'grupo');
      const stockRaw = getVal('stock inicial', 'stock actual', 'stock', 'cantidad', 'cant', 'existencia');
      const unitRaw = getVal('unidad de medida', 'unidad', 'medida', 'um');
      const minStockRaw = getVal('stock minimo', 'minimo', 'alerta', 'min');
      const unitPriceRaw = getVal('precio unitario', 'precio', 'costo unitario', 'costo', 'valor');
      const locationRaw = getVal('ubicacion deposito', 'ubicacion', 'deposito', 'almacen', 'estanteria', 'sector');

      if (!nameRaw && !codeRaw) {
        // Skip empty rows
        return;
      }

      const name = String(nameRaw || codeRaw || 'Material Sin Nombre').trim();
      const code = String(codeRaw || `MAT-${Date.now().toString().slice(-4)}-${index + 1}`).trim();
      const category = normalizeCategory(String(categoryRaw || ''));
      const stock = parseNumber(stockRaw) ?? 0;
      const unit = String(unitRaw || 'Unidades').trim();
      const minStock = parseNumber(minStockRaw) ?? 0;
      const unitPrice = parseNumber(unitPriceRaw) ?? 0;
      const location = String(locationRaw || 'Depósito Central').trim();

      materials.push({
        code,
        name,
        category,
        stock,
        unit,
        minStock,
        unitPrice,
        location,
        tenantId: 'tenant_bandiera_hq',
        lastUpdated: todayLocalISO()
      });
    } catch (err: any) {
      errors.push(`Fila ${index + 2}: ${err.message || 'Error al procesar material'}`);
    }
  });

  return {
    materials,
    errors,
    totalRows: rawRows.length
  };
};

/**
 * Export Materiales to Excel (.xlsx)
 */
export const exportMaterialesToExcel = (materials: MaterialItem[]): void => {
  const exportData = materials.map(m => ({
    'Código': m.code,
    'Nombre / Descripción': m.name,
    'Categoría': m.category,
    'Stock Actual': m.stock,
    'Unidad de Medida': m.unit,
    'Stock Mínimo': m.minStock,
    'Precio Unitario ($)': m.unitPrice,
    'Valor Total en Stock ($)': m.stock * m.unitPrice,
    'Ubicación / Depósito': m.location,
    'Última Actualización': m.lastUpdated || ''
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Materiales');
  const dateStr = todayLocalISO();
  XLSX.writeFile(wb, `Inventario_Materiales_JOB_Bandiera_${dateStr}.xlsx`);
};


/**
 * Export Technical Audit Remitos to Excel (.xlsx)
 * Supports exporting ONLY the columns that are currently visible in the view.
 */
export const exportRemitosToExcel = (
  records: TechnicalAuditRecord[],
  customName?: string,
  visibleColumnKeys?: string[]
): void => {
  const exportData = records.map(r => {
    // If specific columns are requested, export only those columns
    if (visibleColumnKeys && visibleColumnKeys.length > 0) {
      const row: Record<string, any> = {};

      if (visibleColumnKeys.includes('semaforo')) {
        row['Semáforo'] = (r.semaforo || 'neutro').toUpperCase();
      }
      if (visibleColumnKeys.includes('sistema')) {
        row['Nº Remito (Sistema)'] = r.remitoId;
      }
      if (visibleColumnKeys.includes('papel')) {
        row['Remito Papel'] = r.remitoPapel || '';
      }
      if (visibleColumnKeys.includes('fecha')) {
        row['Fecha'] = r.date;
      }
      if (visibleColumnKeys.includes('cliente')) {
        row['Cliente'] = r.clientName;
        row['Ubicación / Sede'] = r.siteLocation;
      }
      if (visibleColumnKeys.includes('punto')) {
        row['Punto de Trabajo'] = r.workPoint;
      }
      if (visibleColumnKeys.includes('descripcion') || visibleColumnKeys.includes('tarea') || visibleColumnKeys.includes('tareas')) {
        row['Descripción de Tareas'] = r.description || '';
      }
      if (visibleColumnKeys.includes('guardia')) {
        row['Guardia'] = r.isGuardia ? 'SÍ' : 'NO';
      }
      if (visibleColumnKeys.includes('hs')) {
        row['Horas Trabajo (HS)'] = r.hoursWorked;
      }
      if (visibleColumnKeys.includes('logistica')) {
        row['Logística ($)'] = r.logisticsCost;
      }
      if (visibleColumnKeys.includes('mo_dir') || visibleColumnKeys.includes('mo_capataz')) {
        row['M.O. Capataz ($)'] = r.techPay; // el valor de las horas trabajadas por el oficial
      }
      if (visibleColumnKeys.includes('costo_ayudantes') || visibleColumnKeys.includes('mo_ayudante')) {
        row['M.O. Ayudante ($)'] = r.helperPay; // el valor de las horas trabajadas por el ayudante
      }
      if (visibleColumnKeys.includes('mat')) {
        row['Materiales ($)'] = r.materialsCost || 0;
        if (r.materialsDetails) {
          row['Detalle Materiales'] = r.materialsDetails;
        }
      }
      if (visibleColumnKeys.includes('equipo')) {
        row['Equipo / Cuadrilla'] = [r.leadTech, ...(r.helpers || [])].filter(Boolean).join(', ');
      }
      if (visibleColumnKeys.includes('costo_honorarios') || visibleColumnKeys.includes('honorarios')) {
        const baseCost = (r.logisticsCost || 0) + (r.techPay || 0) + (r.helperPay || 0) + (r.materialsCost || 0);
        row['Costo Honorarios ($)'] = r.honorarios !== undefined ? r.honorarios : Math.max(0, (r.billedPrice || r.suggestedPrice || 0) - baseCost);
      }
      if (visibleColumnKeys.includes('costo_total_remito') || visibleColumnKeys.includes('facturado')) {
        const baseCost = (r.logisticsCost || 0) + (r.techPay || 0) + (r.helperPay || 0) + (r.materialsCost || 0);
        const hon = r.honorarios !== undefined ? r.honorarios : Math.max(0, (r.billedPrice || r.suggestedPrice || 0) - baseCost);
        row['Costo Total del Remito ($)'] = r.billedPrice || (baseCost + hon);
      }
      if (visibleColumnKeys.includes('costo_op')) {
        row['Costo Operativo ($)'] = r.operatingCost;
      }
      if (visibleColumnKeys.includes('pago_tec')) {
        row['Pago Técnico ($)'] = r.techPay;
      }
      if (visibleColumnKeys.includes('estado')) {
        row['Estado'] = r.status;
      }

      return row;
    }

    // Default fallback: all columns
    return {
      'Estado': r.status,
      'Semáforo': (r.semaforo || 'neutro').toUpperCase(),
      'Nº Remito': r.remitoId,
      'Remito Papel': r.remitoPapel || '',
      'Fecha': r.date,
      'Cliente': r.clientName,
      'Ubicación / Finca': r.siteLocation,
      'Punto de Trabajo': r.workPoint,
      'Descripción de Tareas': r.description,
      'Guardia': r.isGuardia ? 'SÍ' : 'NO',
      'Horas Trabajo': r.hoursWorked,
      'Horas Viaje': r.travelHours,
      'Distancia KM': r.distanceKm,
      'Mano de Obra ($)': r.laborDirectCost,
      'Materiales ($)': r.materialsCost,
      'Detalle Materiales': r.materialsDetails || '',
      'Costo Operativo Total ($)': r.operatingCost,
      'Precio Billeado / Facturado ($)': r.billedPrice,
      'Pago Técnico ($)': r.techPay,
      'Pago Ayudantes ($)': r.helperPay,
      'Técnico Responsable': r.leadTech,
      'Ayudantes': (r.helpers || []).join(', '),
      'Nº Factura': r.numeroFactura || '',
      'Fecha Factura': r.fechaFactura || '',
      'Monto Cobrado ($)': r.collectedPrice || 0
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Auditoria_Tecnica');
  const dateStr = todayLocalISO();
  XLSX.writeFile(wb, `${customName || 'Auditoria_Tecnica_Bandiera'}_${dateStr}.xlsx`);
};

/**
 * Export Facturados to Excel (.xlsx)
 */
export const exportFacturadosToExcel = (records: TechnicalAuditRecord[]): void => {
  const exportData = records.map(r => {
    const totalRet = (r.retencionIVA || 0) + (r.retencionIIBB || 0) + (r.retencionGanancias || 0);
    const montoNeto = Math.max(0, (r.billedPrice || r.suggestedPrice) - totalRet);
    return {
      'Nº Factura': r.numeroFactura || 'PENDIENTE ASIGNAR',
      'Fecha Factura': r.fechaFactura || r.date,
      'Nº Remito': r.remitoId,
      'Remito Papel': r.remitoPapel || '',
      'Cliente': r.clientName,
      'Ubicación / Finca': r.siteLocation,
      'Punto de Trabajo': r.workPoint,
      'Descripción de Tareas': r.description || '',
      'Monto Facturado ($)': r.billedPrice || r.suggestedPrice,
      'Ret. IVA ($)': r.retencionIVA || 0,
      'Ret. IIBB ($)': r.retencionIIBB || 0,
      'Ret. Ganancias ($)': r.retencionGanancias || 0,
      'Total Retenciones ($)': totalRet,
      'Monto Neto a Cobrar ($)': montoNeto,
      'Técnico Responsable': r.leadTech,
      'Estado': r.status
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Facturado');
  const dateStr = todayLocalISO();
  XLSX.writeFile(wb, `Facturacion_Remitos_Bandiera_${dateStr}.xlsx`);
};

/**
 * Export Pasados to Excel (.xlsx)
 * Computes Service + Materials, and labels Total Final Pasado with '+IVA'
 */
export const exportPasadosToExcel = (records: TechnicalAuditRecord[]): void => {
  const exportData = records.map(r => {
    const totalFinal = (r.billedPrice > 0 ? r.billedPrice : (r.suggestedPrice || 0)) || 0;
    const materiales = r.materialsCost || 0;
    const servicio = Math.max(0, totalFinal - materiales);

    return {
      'Nº Remito': r.remitoId,
      'Remito Papel': r.remitoPapel || '',
      'Fecha': r.date,
      'Cliente': r.clientName,
      'Ubicación / Finca': r.siteLocation,
      'Punto de Trabajo': r.workPoint,
      'Descripción Tareas': r.description,
      'Mano de Obra / Servicios ($)': servicio,
      'Materiales Utilizados ($)': materiales,
      'Detalle de Materiales': r.materialsDetails || '',
      'Total Final Pasado ($)': totalFinal,
      'Total Final Pasado (+IVA)': `$${(totalFinal || 0).toLocaleString('es-AR')} + IVA`,
      'Condición Fiscal': '+ IVA (Si el cliente necesita factura formal)',
      'Técnico': r.leadTech,
      'Estado': r.status
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Remitos_Pasados');
  const dateStr = todayLocalISO();
  XLSX.writeFile(wb, `Remitos_Pasados_Bandiera_${dateStr}.xlsx`);
};

/**
 * Export a Single Remito Pasado to Excel (.xlsx) with +IVA
 */
export const exportRemitoPasadoSingleToExcel = (record: TechnicalAuditRecord): void => {
  const totalFinal = roundCurrency((record.billedPrice && record.billedPrice > 0) ? record.billedPrice : (record.suggestedPrice || record.laborDirectCost || 0));
  const materiales = roundCurrency(record.materialsCost || 0);
  const servicio = roundCurrency(Math.max(0, totalFinal - materiales));

  const exportData = [
    {
      'Nº Remito': record.remitoId,
      'Remito Papel': record.remitoPapel || 'S/N',
      'Fecha': record.date,
      'Cliente / Razón Social': record.clientName,
      'Ubicación / Finca': record.siteLocation,
      'Punto de Trabajo': record.workPoint,
      'Responsable Técnico': record.leadTech,
      'Descripción de Tareas': record.description || 'Mantenimiento preventivo e inspección técnica',
      'Total Servicio ($)': servicio,
      'Materiales (Col. Diferencia) ($)': materiales,
      'Total Final Pasado ($)': totalFinal,
      'Total Final Pasado (+IVA)': `$${formatCurrency(totalFinal)} + IVA`,
      'Nota Fiscal': 'Si el cliente requiere factura formal, a este valor se le debe adicionar el IVA (21%)'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Remito_Pasado');
  const cleanId = record.remitoId.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Remito_Pasado_${cleanId}.xlsx`);
};

/**
 * Export Consolidated Remitos Pasados to Excel (.xlsx) with +IVA
 */
export const exportRemitoPasadoConsolidadoToExcel = (
  recordsOrOptions:
    | TechnicalAuditRecord[]
    | {
        records: TechnicalAuditRecord[];
        clientName?: string;
        receiptNumber?: string;
        date?: string;
      },
  clientNameParam?: string
): void => {
  const records = Array.isArray(recordsOrOptions) ? recordsOrOptions : recordsOrOptions.records;
  const clientName = Array.isArray(recordsOrOptions)
    ? clientNameParam
    : recordsOrOptions.clientName;
  const receiptNumber = !Array.isArray(recordsOrOptions) ? recordsOrOptions.receiptNumber : undefined;

  let sumServicio = 0;
  let sumMateriales = 0;
  let sumTotalFinal = 0;

  const exportData: Record<string, any>[] = records.map(r => {
    const totalFinal = roundCurrency((r.billedPrice && r.billedPrice > 0) ? r.billedPrice : (r.suggestedPrice || 0));
    const materiales = roundCurrency(r.materialsCost || 0);
    const servicio = roundCurrency(Math.max(0, totalFinal - materiales));

    sumServicio = roundCurrency(sumServicio + servicio);
    sumMateriales = roundCurrency(sumMateriales + materiales);
    sumTotalFinal = roundCurrency(sumTotalFinal + totalFinal);

    return {
      'Nº Remito': r.remitoId,
      'Remito Papel': r.remitoPapel || '',
      'Fecha': r.date,
      'Cliente': r.clientName,
      'Punto de Trabajo': r.workPoint,
      'Descripción de Tareas': r.description || 'Mantenimiento preventivo e inspección técnica',
      'Total Servicio ($)': servicio,
      'Materiales ($)': materiales,
      'Total Final Pasado ($)': totalFinal,
      'Total Final (+IVA)': `$${formatCurrency(totalFinal)} + IVA`
    };
  });

  // Append Total row
  exportData.push({
    'Nº Remito': receiptNumber ? `COMPROBANTE: ${receiptNumber}` : 'TOTAL GENERAL',
    'Remito Papel': `${records.length} remitos`,
    'Fecha': '',
    'Cliente': clientName || records[0]?.clientName || '',
    'Punto de Trabajo': '',
    'Descripción de Tareas': 'Consolidado (+IVA si factura fiscal)',
    'Total Servicio ($)': sumServicio,
    'Materiales ($)': sumMateriales,
    'Total Final Pasado ($)': sumTotalFinal,
    'Total Final (+IVA)': `$${formatCurrency(sumTotalFinal)} + IVA`
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Consolidado_Pasados');
  const dateStr = todayLocalISO();
  const cleanClient = (clientName || records[0]?.clientName || 'Cliente').replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `Remitos_Pasados_Consolidado_${cleanClient}_${dateStr}.xlsx`);
};

/**
 * Export Cobrados to Excel (.xlsx)
 */
export const exportCobradosToExcel = (records: TechnicalAuditRecord[]): void => {
  const exportData = records.map(r => {
    const totalRet = (r.retencionIVA || 0) + (r.retencionIIBB || 0) + (r.retencionGanancias || 0);
    const methodsStr = (r.paymentMethods || []).map(p => `${p.method} ($${(p.amount || 0).toLocaleString('es-AR')})`).join('; ');
    return {
      'Nº Remito': r.remitoId,
      'Remito Papel': r.remitoPapel || '',
      'Fecha Remito': r.date,
      'Fecha Cobro': r.fechaCobro || r.date,
      'Cliente': r.clientName,
      'Factura Nº': r.numeroFactura || '',
      'Total Facturado ($)': r.billedPrice || r.suggestedPrice,
      'Total Retenciones ($)': totalRet,
      'Monto Cobrado Efectivo ($)': r.collectedPrice || r.billedPrice || r.suggestedPrice,
      'Medios de Pago': methodsStr || 'Contado / Transferencia',
      'Estado': 'Cobrado'
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cobrados');
  const dateStr = todayLocalISO();
  XLSX.writeFile(wb, `Cobranzas_Remitos_Bandiera_${dateStr}.xlsx`);
};

/**
 * Export Liquidación Cuadrillas to Excel (.xlsx)
 */
export const exportLiquidacionesToExcel = (liquidations: any[]): void => {
  const exportData = liquidations.map(w => ({
    'Nombre Empleado': w.name,
    'Rol / Puesto': w.role,
    'Servicios Realizados': w.totalServices,
    'Horas Totales Trabajadas': w.totalHours,
    'Guardias Realizadas': w.guardiasCount,
    'Liquidación Rol Técnico ($)': w.payAsLead,
    'Liquidación Rol Ayudante ($)': w.payAsHelper,
    'Comisión Capataz s/ Servicio ($)': w.capatazProfitTotal || 0,
    'Total a Liquidar ($)': w.totalPay
  }));

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Liquidaciones');
  const dateStr = todayLocalISO();
  XLSX.writeFile(wb, `Liquidacion_Cuadrillas_Bandiera_${dateStr}.xlsx`);
};

// -------------------------------------------------------------
// RECOVERY & BATCH UPDATE OF DESCRIPTIONS FROM EXCEL
// -------------------------------------------------------------

export interface ExcelColumnInfo {
  sheetName: string;
  columns: string[];
  totalRows: number;
  sampleRows: Record<string, any>[];
  suggestedRemitoCol?: string;
  suggestedDescCol?: string;
}

export interface MatchedDescriptionItem {
  recordId: string;
  remitoId: string;
  remitoPapel?: string;
  clientName: string;
  date: string;
  currentDescription: string;
  newDescription: string;
  matchType: 'remitoPapel' | 'remitoId' | 'clientAndDate';
}

export interface DescriptionMatchResult {
  matches: MatchedDescriptionItem[];
  unmatchedExcelRows: number;
  totalExcelRows: number;
  matchedCount: number;
  sheetName: string;
  usedRemitoCol: string;
  usedDescCol: string;
}

/**
 * Inspects an Excel file to extract available columns and sample data
 */
export const inspectExcelFile = async (file: File): Promise<ExcelColumnInfo> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0] || 'Hoja1';
  const worksheet = workbook.Sheets[firstSheetName];
  
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  const columns = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];

  // Suggest columns based on common patterns
  let suggestedRemitoCol: string | undefined;
  let suggestedDescCol: string | undefined;

  for (const col of columns) {
    const norm = normalizeHeader(col);
    if (!suggestedRemitoCol && (norm.includes('papel') || norm.includes('remito') || norm.includes('talonario') || norm.includes('numero'))) {
      suggestedRemitoCol = col;
    }
    if (!suggestedDescCol && (
      norm.includes('tarea') || 
      norm.includes('descrip') || 
      norm.includes('detalle') || 
      norm.includes('activid') || 
      norm.includes('trabajo') ||
      norm.includes('servicio') ||
      norm.includes('labor') ||
      norm.includes('informe')
    )) {
      suggestedDescCol = col;
    }
  }

  return {
    sheetName: firstSheetName,
    columns,
    totalRows: rawRows.length,
    sampleRows: rawRows.slice(0, 5),
    suggestedRemitoCol,
    suggestedDescCol
  };
};

/**
 * Matches existing technical audit records against rows in an Excel file to recover descriptions
 */
export const matchDescriptionsFromExcel = async (
  file: File,
  existingRecords: TechnicalAuditRecord[],
  options?: {
    remitoCol?: string;
    descCol?: string;
    sheetName?: string;
  }
): Promise<DescriptionMatchResult> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = options?.sheetName || workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  if (rawRows.length === 0) {
    return {
      matches: [],
      unmatchedExcelRows: 0,
      totalExcelRows: 0,
      matchedCount: 0,
      sheetName,
      usedRemitoCol: '',
      usedDescCol: ''
    };
  }

  const columns = Object.keys(rawRows[0]);
  
  // Find or use remito column
  let remitoCol = options?.remitoCol;
  if (!remitoCol) {
    for (const c of columns) {
      const n = normalizeHeader(c);
      if (n.includes('papel') || n === 'remito' || n.includes('nroremito') || n.includes('talonario')) {
        remitoCol = c;
        break;
      }
    }
    if (!remitoCol) {
      remitoCol = columns.find(c => normalizeHeader(c).includes('remito') || normalizeHeader(c).includes('numero'));
    }
  }

  // Find or use description column
  let descCol = options?.descCol;
  if (!descCol) {
    for (const c of columns) {
      const n = normalizeHeader(c);
      if (
        n.includes('tarea') ||
        n.includes('descrip') ||
        n.includes('detalle') ||
        n.includes('trabajo') ||
        n.includes('activid') ||
        n.includes('servicio') ||
        n.includes('labor') ||
        n.includes('informe')
      ) {
        descCol = c;
        break;
      }
    }
  }

  if (!remitoCol || !descCol) {
    throw new Error('No se pudo identificar automáticamente la columna de remito o la de descripción. Por favor elija las columnas manualmente.');
  }

  const cleanNum = (str: any): string => {
    if (!str) return '';
    return String(str).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  // Build lookups for fast matching
  const recordsByPapel = new Map<string, TechnicalAuditRecord>();
  const recordsByRemitoId = new Map<string, TechnicalAuditRecord>();
  const recordsByNumericSuffix = new Map<string, TechnicalAuditRecord>();

  for (const r of existingRecords) {
    if (r.remitoPapel) {
      recordsByPapel.set(cleanNum(r.remitoPapel), r);
      // Also index trailing numbers e.g. "2-11124" -> "11124"
      const numMatch = r.remitoPapel.match(/\d+$/);
      if (numMatch) {
        recordsByNumericSuffix.set(numMatch[0], r);
      }
    }
    if (r.remitoId) {
      recordsByRemitoId.set(cleanNum(r.remitoId), r);
      const numMatch = r.remitoId.match(/\d+$/);
      if (numMatch) {
        recordsByNumericSuffix.set(numMatch[0], r);
      }
    }
  }

  const matches: MatchedDescriptionItem[] = [];
  let unmatchedCount = 0;
  const processedRecordIds = new Set<string>();

  for (const row of rawRows) {
    const rawRemitoVal = row[remitoCol];
    const rawDescVal = row[descCol];

    if (!rawRemitoVal && !rawDescVal) continue;

    const descStr = rawDescVal ? String(rawDescVal).trim() : '';
    // Skip if new description is empty or already the generic placeholder
    if (!descStr || descStr.toLowerCase() === 'mantenimiento preventivo e inspección técnica'.toLowerCase()) {
      continue;
    }

    const cleanedVal = cleanNum(rawRemitoVal);
    let matchedRecord: TechnicalAuditRecord | undefined;
    let matchType: 'remitoPapel' | 'remitoId' | 'clientAndDate' = 'remitoPapel';

    // 1. Try exact remitoPapel match
    if (cleanedVal && recordsByPapel.has(cleanedVal)) {
      matchedRecord = recordsByPapel.get(cleanedVal);
      matchType = 'remitoPapel';
    } 
    // 2. Try exact remitoId match
    else if (cleanedVal && recordsByRemitoId.has(cleanedVal)) {
      matchedRecord = recordsByRemitoId.get(cleanedVal);
      matchType = 'remitoId';
    } 
    // 3. Try trailing numeric match (e.g. 11124)
    else if (cleanedVal) {
      const matchNum = String(rawRemitoVal).match(/\d{3,}/);
      if (matchNum && recordsByNumericSuffix.has(matchNum[0])) {
        matchedRecord = recordsByNumericSuffix.get(matchNum[0]);
        matchType = 'remitoPapel';
      }
    }

    if (matchedRecord && !processedRecordIds.has(matchedRecord.id)) {
      processedRecordIds.add(matchedRecord.id);
      matches.push({
        recordId: matchedRecord.id,
        remitoId: matchedRecord.remitoId,
        remitoPapel: matchedRecord.remitoPapel,
        clientName: matchedRecord.clientName,
        date: matchedRecord.date,
        currentDescription: matchedRecord.description || '',
        newDescription: descStr,
        matchType
      });
    } else {
      unmatchedCount++;
    }
  }

  return {
    matches,
    unmatchedExcelRows: unmatchedCount,
    totalExcelRows: rawRows.length,
    matchedCount: matches.length,
    sheetName,
    usedRemitoCol: remitoCol,
    usedDescCol: descCol
  };
};

/**
 * Export vehicles fleet and events to a multi-sheet Excel spreadsheet
 */
export const exportVehiclesToExcel = (
  vehicles: VehicleItem[],
  events: VehicleEventItem[]
) => {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Flota y Amortización
  const vehiclesData = vehicles.map(v => {
    const depreciableBase = Math.max(0, v.purchasePrice - v.residualValue);
    const ratePerKm = v.usefulLifeKm > 0 ? depreciableBase / v.usefulLifeKm : 0;
    const accumulatedKm = Math.max(0, v.currentMileageKm - v.initialMileageKm);
    const accumulatedDepreciation = accumulatedKm * ratePerKm;
    const bookValue = Math.max(v.residualValue, v.purchasePrice - accumulatedDepreciation);
    const consumedPct = v.usefulLifeKm > 0 ? ((accumulatedKm / v.usefulLifeKm) * 100).toFixed(1) : '0';

    // Total de gastos de mantenimiento
    const vehEvents = events.filter(e => e.vehicleId === v.id || e.patente === v.patente);
    const totalMaintenanceCost = vehEvents.reduce((acc, e) => acc + (e.cost || 0), 0);

    return {
      'Patente': v.patente,
      'Marca': v.brand,
      'Modelo': v.model,
      'Año': v.year,
      'Tipo / Carrocería': v.type,
      'Estado': v.status,
      'Chofer Asignado': v.assignedDriver || '-',
      'Fecha Compra': v.purchaseDate,
      'Valor Compra ($)': v.purchasePrice,
      'Valor Residual ($)': v.residualValue,
      'Vida Útil (Km)': v.usefulLifeKm,
      'Odómetro Inicial (Km)': v.initialMileageKm,
      'Odómetro Actual (Km)': v.currentMileageKm,
      'Km Recorridos Flota': accumulatedKm,
      'Amortización por Km ($/km)': Number(ratePerKm.toFixed(2)),
      'Amortización Acumulada ($)': Math.round(accumulatedDepreciation),
      'Valor Contable / Libros ($)': Math.round(bookValue),
      'Vida Útil Consumida (%)': `${consumedPct}%`,
      'Gastos Mantenimiento Acum. ($)': totalMaintenanceCost,
      'Último Cambio Aceite (Km)': v.lastOilChangeKm || '-',
      'Intervalo Service (Km)': v.oilChangeIntervalKm,
      'Vencimiento VTV/RTO': v.vtvExpirationDate || '-',
      'Seguro': v.insuranceCompany || '-',
      'Póliza': v.policyNumber || '-'
    };
  });

  const wsVehicles = XLSX.utils.json_to_sheet(vehiclesData);
  XLSX.utils.book_append_sheet(wb, wsVehicles, 'Flota y Amortización');

  // Hoja 2: Eventos y Mantenimientos
  const eventsData = events.map(e => ({
    'ID Evento': e.id,
    'Patente': e.patente,
    'Tipo de Evento': e.type,
    'Fecha': e.date,
    'Odómetro (Km)': e.mileageKm,
    'Título': e.title,
    'Detalle / Descripción': e.description,
    'Costo ($)': e.cost,
    'Taller / Proveedor': e.workshopOrProvider || '-',
    'Nº Factura / Remito': e.invoiceNumber || '-',
    'Responsable / Chofer': e.performedBy || '-',
    'Aceite Tipo': e.oilChangeDetails?.oilType || '-',
    'Aceite Marca': e.oilChangeDetails?.oilBrand || '-',
    'Filtro Aceite Reemplazado': e.oilChangeDetails?.filterReplaced ? 'SÍ' : 'NO',
    'Filtro Aire Reemplazado': e.oilChangeDetails?.airFilterReplaced ? 'SÍ' : 'NO',
    'Próximo Service (Km)': e.oilChangeDetails?.nextChangeKm || '-'
  }));

  const wsEvents = XLSX.utils.json_to_sheet(eventsData);
  XLSX.utils.book_append_sheet(wb, wsEvents, 'Historial Eventos');

  const today = todayLocalISO();
  XLSX.writeFile(wb, `Informe_Amortizacion_Flota_${today}.xlsx`);
};

/**
  * Download an official Excel template for Personnel / Employees (.xlsx)
  */
export const downloadWorkersExcelTemplate = (): void => {
  const sampleWorkers = [
    {
      'Nombre y Apellido': 'RAMON BARROSO',
      'Categoria Operativa': 'Capataz',
      'Cargo Especifico': 'Capataz de Obra',
      'Rol Sistema': 'Capataz',
      '% Ganancia Capataz': 25,
      'Costo Hora ($/h)': 9400,
      'Cuadrilla / Sede': 'Cuadrilla 1 - Valle de Uco',
      'Telefono': '+54 9 261 455-1101',
      'Email': 'ramon.barroso@bandiera.com',
      'Sueldo Mensual': 1250000,
      'Estado': 'Activo'
    },
    {
      'Nombre y Apellido': 'JEREMÍAS POLLA',
      'Categoria Operativa': 'Capataz',
      'Cargo Especifico': 'Capataz de Obra',
      'Rol Sistema': 'Capataz',
      '% Ganancia Capataz': 25,
      'Costo Hora ($/h)': 9400,
      'Cuadrilla / Sede': 'Cuadrilla 2 - Mendoza',
      'Telefono': '+54 9 261 455-1102',
      'Email': 'jeremias.polla@bandiera.com',
      'Sueldo Mensual': 1250000,
      'Estado': 'Activo'
    },
    {
      'Nombre y Apellido': 'FACUNDO MORALES',
      'Categoria Operativa': 'Capataz',
      'Cargo Especifico': 'Capataz de Obra',
      'Rol Sistema': 'Capataz',
      '% Ganancia Capataz': 20,
      'Costo Hora ($/h)': 9400,
      'Cuadrilla / Sede': 'Cuadrilla 3 - Este',
      'Telefono': '+54 9 261 455-1103',
      'Email': 'facundo.morales@bandiera.com',
      'Sueldo Mensual': 1250000,
      'Estado': 'Activo'
    },
    {
      'Nombre y Apellido': 'MATIAS CALDERON',
      'Categoria Operativa': 'Ayudante',
      'Cargo Especifico': 'Ayudante de Cuadrilla',
      'Rol Sistema': 'Empleado',
      '% Ganancia Capataz': 0,
      'Costo Hora ($/h)': 9400,
      'Cuadrilla / Sede': 'Cuadrilla 1 - Valle de Uco',
      'Telefono': '+54 9 261 455-1105',
      'Email': 'matias.calderon@bandiera.com',
      'Sueldo Mensual': 980000,
      'Estado': 'Activo'
    },
    {
      'Nombre y Apellido': 'GABRIEL RODRIGUEZ',
      'Categoria Operativa': 'Oficial',
      'Cargo Especifico': 'Oficial Especialista',
      'Rol Sistema': 'Empleado',
      '% Ganancia Capataz': 0,
      'Costo Hora ($/h)': 9400,
      'Cuadrilla / Sede': 'Cuadrilla 1 - Valle de Uco',
      'Telefono': '+54 9 261 455-1107',
      'Email': 'gabriel.rodriguez@bandiera.com',
      'Sueldo Mensual': 1100000,
      'Estado': 'Activo'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleWorkers);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Personal');
  XLSX.writeFile(wb, 'Plantilla_Importacion_Personal_JOB_Bandiera.xlsx');
};

/**
 * Export full Workers / Employees list to genuine Excel (.xlsx)
 */
export const exportWorkersToExcel = (workers: WorkerItem[]): void => {
  const exportData = workers.map(w => {
    const isAdm = w.isAdministrative || w.category === 'Administrativo';
    return {
      'ID': w.id,
      'Personal / Empleado': w.name,
      'Categoría Operativa': w.category || (isAdm ? 'Administrativo' : w.role === 'Capataz' ? 'Capataz' : 'Ayudante'),
      'Cargo Específico': w.cargo || w.specialty || '',
      'Rol Sistema': w.role,
      '% Ganancia Capataz': w.capatazPercentage ?? (w.role === 'Capataz' ? 10 : 0),
      'Hora Base ($/h)': w.hourlyRate ?? (isAdm ? 0 : 9400),
      'Cuadrilla / Sede': w.cuadrilla || '',
      'Teléfono': w.phone || '',
      'Email': w.email || '',
      'Sueldo Ref. Mensual': w.salaryMonthly || 0,
      'Estado': w.active !== false ? 'Activo' : 'Inactivo'
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Nomina Personal');
  const dateStr = todayLocalISO();
  XLSX.writeFile(wb, `Nomina_Personal_JOB_Bandiera_${dateStr}.xlsx`);
};

/**
 * Parse an Excel file (.xlsx / .xls) into Worker items
 */
export const parseWorkersExcel = async (file: File): Promise<ExcelWorkerImportResult> => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

  const workers: Omit<WorkerItem, 'id'>[] = [];
  const errors: string[] = [];

  const parseNumber = (val: any, fallback = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const clean = String(val).replace(/[$%.\s]/g, '').replace(',', '.').trim();
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? fallback : parsed;
  };

  const parsePercentage = (val: any): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') {
      // If entered as 0.25 in Excel, convert to 25%
      return val > 0 && val <= 1 ? Math.round(val * 100) : val;
    }
    const clean = String(val).replace('%', '').replace(',', '.').trim();
    const parsed = parseFloat(clean);
    if (isNaN(parsed)) return 0;
    return parsed > 0 && parsed <= 1 ? Math.round(parsed * 100) : parsed;
  };

  rawRows.forEach((row, index) => {
    try {
      const keys = Object.keys(row);
      const getVal = (...variants: string[]): any => {
        for (const v of variants) {
          const normV = normalizeHeader(v);
          const foundKey = keys.find(k => normalizeHeader(k) === normV || normalizeHeader(k).includes(normV));
          if (foundKey && row[foundKey] !== undefined && row[foundKey] !== '') {
            return row[foundKey];
          }
        }
        return undefined;
      };

      const nameRaw = getVal('nombre y apellido', 'nombre / apellido', 'personal / empleado', 'personal', 'nombre', 'empleado', 'operario', 'trabajador', 'name');
      if (!nameRaw || String(nameRaw).trim() === '') {
        return; // Skip empty row
      }

      const name = String(nameRaw).trim();
      const cargoRaw = getVal('cargo especifico', 'cargo', 'puesto', 'especialidad', 'funcion', 'tarea', 'tarea principal');
      const categoryRaw = getVal('categoria operativa', 'categoria', 'tipo', 'clasificacion', 'rango');
      const roleRaw = getVal('rol sistema', 'rol', 'perfil', 'jerarquia');
      const capatazPctRaw = getVal('% ganancia capataz', '% capataz', 'ganancia capataz', 'porcentaje capataz', 'porcentaje', 'comision', '% comision', 'comision %');
      const hourlyRateRaw = getVal('costo hora ($/h)', 'costo hora', 'hora base ($/h)', 'hora base', 'tarifa $/h', 'tarifa', '$/h', 'hora', 'precio hora');
      const cuadrillaRaw = getVal('cuadrilla / sede', 'cuadrilla', 'sede', 'zona', 'locacion', 'destino');
      const phoneRaw = getVal('telefono', 'tel', 'celular', 'movil', 'contacto');
      const emailRaw = getVal('email', 'correo', 'correo electronico', 'mail');
      const salaryRaw = getVal('sueldo ref. mensual', 'sueldo mensual', 'sueldo', 'remuneracion', 'salario');
      const activeRaw = getVal('estado', 'activo', 'condicion', 'status');

      // Determine Category
      const catLower = (categoryRaw ? String(categoryRaw) : '').toLowerCase();
      const cargoLower = (cargoRaw ? String(cargoRaw) : '').toLowerCase();
      const roleLower = (roleRaw ? String(roleRaw) : '').toLowerCase();

      let category: WorkerCategory = 'Ayudante';
      if (catLower.includes('capat') || roleLower.includes('capat') || cargoLower.includes('capat')) {
        category = 'Capataz';
      } else if (catLower.includes('admin') || roleLower.includes('admin') || cargoLower.includes('admin')) {
        category = 'Administrativo';
      } else if (catLower.includes('oficial') || cargoLower.includes('oficial') || roleLower.includes('oficial')) {
        category = 'Oficial';
      }

      // Determine System Role
      let role: UserRole = 'Empleado';
      if (category === 'Capataz' || roleLower.includes('capat')) {
        role = 'Capataz';
      } else if (category === 'Administrativo' || roleLower.includes('admin')) {
        role = roleLower.includes('super') ? 'SuperAdmin' : 'Admin';
      }

      const isAdm = category === 'Administrativo';
      const parsedPct = parsePercentage(capatazPctRaw);
      const capatazPercentage = category === 'Capataz' ? (parsedPct > 0 ? parsedPct : 10) : 0;
      const parsedHourly = parseNumber(hourlyRateRaw, isAdm ? 0 : 9400);
      const parsedSalary = parseNumber(salaryRaw, isAdm ? 1100000 : category === 'Capataz' ? 1250000 : 980000);

      const isActive = activeRaw === undefined
        ? true
        : !String(activeRaw).toLowerCase().includes('inactiv') && !String(activeRaw).toLowerCase().includes('no') && !String(activeRaw).toLowerCase().includes('baja');

      const defaultEmail = `${name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@bandiera.com`;

      workers.push({
        name,
        role,
        category,
        isAdministrative: isAdm,
        specialty: cargoRaw ? String(cargoRaw).trim() : (isAdm ? 'Personal Administrativo' : category === 'Capataz' ? 'Capataz de Obra' : category === 'Oficial' ? 'Oficial Especialista' : 'Ayudante de Cuadrilla'),
        cargo: cargoRaw ? String(cargoRaw).trim() : (isAdm ? 'Personal Administrativo' : category === 'Capataz' ? 'Capataz de Obra' : category === 'Oficial' ? 'Oficial Especialista' : 'Ayudante de Cuadrilla'),
        capatazPercentage: category === 'Capataz' ? capatazPercentage : undefined,
        cuadrilla: cuadrillaRaw ? String(cuadrillaRaw).trim() : (isAdm ? 'Sede Central / Administración' : 'Cuadrilla 1 - Valle de Uco'),
        phone: phoneRaw ? String(phoneRaw).trim() : '',
        email: emailRaw ? String(emailRaw).trim() : defaultEmail,
        active: isActive,
        assignedProjectsCount: isAdm ? 0 : 1,
        salaryMonthly: parsedSalary,
        hourlyRate: isAdm ? 0 : parsedHourly
      });
    } catch (err: any) {
      errors.push(`Fila ${index + 2}: ${err.message || 'Error de lectura'}`);
    }
  });

  return {
    workers,
    errors,
    totalRows: rawRows.length
  };
};


