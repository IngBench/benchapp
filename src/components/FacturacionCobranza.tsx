import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import * as XLSX from 'xlsx';
import { auth, db } from '../firebase';
import type { Obra } from '../types';

// ============================================================================
// TIPOS E INTERFACES DEL MÓDULO
// ============================================================================

export type ConceptoFactura = 'Anticipo' | 'Estimación' | 'Renta Maquinaria' | 'Finiquito' | string;
export type EstatusFactura = 'Pendiente' | 'Pagada' | 'Cancelada';

export interface Invoice {
  id: string;
  folio: string; // Folio unificado (ej. "A-101" o "101")
  serie?: string; // Columna Excel: Serie
  numeroFactura?: string; // Columna Excel: Número de factura
  obraId: string;
  concepto: ConceptoFactura; // Columna Excel: Descripción
  descripcion?: string; // Descripción detallada
  fechaEmision: string; // Columna Excel: Fecha factura (YYYY-MM-DD)
  monto: number; // Columna Excel: Monto factura

  // Abonos 1 al 4 y sus fechas
  abono1?: number;
  fechaAbono1?: string;
  abono2?: number;
  fechaAbono2?: string;
  abono3?: number;
  fechaAbono3?: string;
  abono4?: number;
  fechaAbono4?: string;

  totalAbonado?: number; // Suma de abono 1 + 2 + 3 + 4
  saldoPendiente?: number; // Monto - totalAbonado

  estatus: EstatusFactura;
  notas?: string;
  createdAt?: string;
}

// ============================================================================
// FUNCIONES AUXILIARES PARA LECTURA Y CONVERSIÓN DE EXCEL
// ============================================================================

export const parseExcelDate = (val: any): string => {
  if (!val && val !== 0) return '';
  if (val instanceof Date) {
    // Usar métodos UTC para evitar desfase de -1 día por zonas horarias locales
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    // Número serial de Excel (ej: 45620)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const millis = excelEpoch.getTime() + val * 86400000;
    const dateObj = new Date(millis);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getUTCFullYear();
      const m = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  if (typeof val === 'string') {
    const str = val.trim();
    if (!str) return '';
    // DD/MM/YYYY o D/M/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(str)) {
      const parts = str.split('/');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
      return `${year}-${month}-${day}`;
    }
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }
    // DD-MM-YYYY
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(str)) {
      const parts = str.split('-');
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
    return str;
  }
  return '';
};

export const parseExcelNumber = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    // Elimina signos de moneda, comas, espacios y cualquier caracter no numérico (excepto punto decimal y guión)
    const cleaned = val.replace(/[^0-9.-]/g, '').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
};

export const procesarFilaExcel = (row: Record<string, any>, index: number, obraIdTarget: string): Invoice | null => {
  const mapa: Record<string, any> = {};
  Object.keys(row).forEach((k) => {
    const keyNorm = k
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
    mapa[keyNorm] = row[k];
  });

  const rawFecha =
    mapa['fechafactura'] ||
    mapa['fecha'] ||
    mapa['fechaemision'] ||
    mapa['fechadeemision'] ||
    mapa['emision'] ||
    mapa['fechadoc'] ||
    mapa['fechadocto'] ||
    mapa['fecfactura'] ||
    mapa['fecfac'] ||
    mapa['date'];
  const fechaFactura = parseExcelDate(rawFecha) || new Date().toISOString().split('T')[0];

  const serie = String(
    mapa['serie'] || mapa['ser'] || mapa['seriefactura'] || mapa['seriefac'] || ''
  ).trim();

  const numeroFactura = String(
    mapa['numerodefactura'] ||
      mapa['numerofactura'] ||
      mapa['numfactura'] ||
      mapa['nofactura'] ||
      mapa['numerofac'] ||
      mapa['nofac'] ||
      mapa['nofact'] ||
      mapa['numfac'] ||
      mapa['factura'] ||
      mapa['folio'] ||
      mapa['foliodocto'] ||
      mapa['numero'] ||
      mapa['num'] ||
      mapa['no'] ||
      mapa['docto'] ||
      ''
  ).trim();

  const descripcion = String(
    mapa['descripcion'] ||
      mapa['concepto'] ||
      mapa['conceptofacturacion'] ||
      mapa['detalle'] ||
      mapa['trabajos'] ||
      mapa['observaciones'] ||
      mapa['referencia'] ||
      mapa['alcance'] ||
      ''
  ).trim();

  const rawMonto =
    mapa['montofactura'] ||
    mapa['monto'] ||
    mapa['montototal'] ||
    mapa['totalfactura'] ||
    mapa['total'] ||
    mapa['importe'] ||
    mapa['importefactura'] ||
    mapa['subtotal'] ||
    mapa['neto'] ||
    mapa['totalneto'] ||
    mapa['amount'];
  const montoFactura = parseExcelNumber(rawMonto);

  const abono1 = parseExcelNumber(
    mapa['abono1'] ||
      mapa['abono01'] ||
      mapa['pago1'] ||
      mapa['pago01'] ||
      mapa['cobro1'] ||
      mapa['anticipo1'] ||
      mapa['primerabono'] ||
      mapa['1erabono']
  );
  const fechaAbono1 = parseExcelDate(
    mapa['fechaabono1'] ||
      mapa['fechaabono01'] ||
      mapa['fechapago1'] ||
      mapa['fechapago01'] ||
      mapa['fechacobro1'] ||
      mapa['fecha1']
  );

  const abono2 = parseExcelNumber(
    mapa['abono2'] ||
      mapa['abono02'] ||
      mapa['pago2'] ||
      mapa['pago02'] ||
      mapa['cobro2'] ||
      mapa['segundoabono'] ||
      mapa['2doabono']
  );
  const fechaAbono2 = parseExcelDate(
    mapa['fechaabono2'] ||
      mapa['fechaabono02'] ||
      mapa['fechapago2'] ||
      mapa['fechapago02'] ||
      mapa['fechacobro2'] ||
      mapa['fecha2']
  );

  const abono3 = parseExcelNumber(
    mapa['abono3'] ||
      mapa['abono03'] ||
      mapa['pago3'] ||
      mapa['pago03'] ||
      mapa['cobro3'] ||
      mapa['tercerabono'] ||
      mapa['3erabono']
  );
  const fechaAbono3 = parseExcelDate(
    mapa['fechaabono3'] ||
      mapa['fechaabono03'] ||
      mapa['fechapago3'] ||
      mapa['fechapago03'] ||
      mapa['fechacobro3'] ||
      mapa['fecha3']
  );

  const abono4 = parseExcelNumber(
    mapa['abono4'] ||
      mapa['abono04'] ||
      mapa['pago4'] ||
      mapa['pago04'] ||
      mapa['cobro4'] ||
      mapa['cuartoabono'] ||
      mapa['4toabono']
  );
  const fechaAbono4 = parseExcelDate(
    mapa['fechaabono4'] ||
      mapa['fechaabono04'] ||
      mapa['fechapago4'] ||
      mapa['fechapago04'] ||
      mapa['fechacobro4'] ||
      mapa['fecha4']
  );

  const totalAbonado = abono1 + abono2 + abono3 + abono4;
  const saldoPendiente = Math.max(0, montoFactura - totalAbonado);

  // VALIDACIÓN ESTRICTA: si no tiene número de factura, ni serie, ni monto > 0, ni abonos > 0, ni descripción real, es una fila vacía o basura
  if (!serie && !numeroFactura && montoFactura === 0 && totalAbonado === 0 && !descripcion) {
    return null;
  }

  let folio = '';
  if (serie && numeroFactura) {
    folio = `${serie}-${numeroFactura}`;
  } else if (numeroFactura) {
    folio = numeroFactura;
  } else if (serie) {
    folio = serie;
  } else {
    folio = `FAC-${String(index + 1).padStart(3, '0')}`;
  }

  let estatus: EstatusFactura = 'Pendiente';
  if (montoFactura > 0 && totalAbonado >= montoFactura) {
    estatus = 'Pagada';
  } else {
    estatus = 'Pendiente';
  }

  return {
    id: `inv-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 6)}`,
    folio,
    serie,
    numeroFactura,
    obraId: obraIdTarget,
    concepto: descripcion || 'Estimación de Obra',
    descripcion: descripcion || 'Estimación de Obra',
    fechaEmision: fechaFactura,
    monto: montoFactura,
    abono1,
    fechaAbono1,
    abono2,
    fechaAbono2,
    abono3,
    fechaAbono3,
    abono4,
    fechaAbono4,
    totalAbonado,
    saldoPendiente,
    estatus,
    createdAt: new Date().toISOString(),
  };
};

export interface ObraItem {
  id: string;
  nombre: string;
  cliente: string;
  descripcion?: string;
  ubicacion?: string;
  contrato?: string;
  montoSubtotal: number;
  estatus?: string;
  residente?: string;
}

export interface MachineryItem {
  id: string;
  numero?: number;
  name?: string;
  marca?: string;
  modelo?: string;
  type?: string;
  currentHours?: number;
}

export interface MachineryDailyRecord {
  id: string;
  date: string;
  locationId?: string;
  locationName: string;
  machineId: string;
  machineName?: string;
  operatorName?: string;
  ticketNumber?: string;
  fuelLiters?: number;
  hoursWorked: number;
  extraHours?: number;
  billingNotes?: string;
}

export interface GrupoMaquinariaCobro {
  mesKey: string; // ej. "2026-11"
  mesLabel: string; // ej. "Noviembre 2026"
  machineId: string;
  machineLabel: string;
  totalHorasNormales: number;
  totalHorasExtras: number;
  totalHoras: number;
  vales: string[];
  diasLaborados: number;
}

// ============================================================================
// CLAVES DE LOCALSTORAGE
// ============================================================================
const STORAGE_KEYS = {
  INVOICES: 'invoices_db',
  OBRAS_PRIMARY: 'obras',
  OBRAS_FALLBACK: 'bench_obras',
  MACHINERY_RECORDS_PRIMARY: 'machinery_daily_records',
  MACHINERY_RECORDS_FALLBACK: 'bench_machinery_daily_logs',
  MACHINERY_LIST_PRIMARY: 'machinery_list',
  MACHINERY_LIST_FALLBACK: 'bench_machinery_machines',
};

// ============================================================================
// DATOS INICIALES DE EJEMPLO (POR SI LOCALSTORAGE ESTÁ VACÍO)
// ============================================================================
const DEFAULT_OBRAS: ObraItem[] = [
  {
    id: 'obra-1',
    nombre: 'Parques del Palmar - Herrería Estructural',
    cliente: 'Desarrolladora Urbana del Centro',
    contrato: 'CONT-2026-PAL-01',
    montoSubtotal: 850000,
    ubicacion: 'Parques del Palmar, Zapopan',
    residente: 'Ing. Alejandro Ruiz',
    estatus: 'Activa',
  },
  {
    id: 'obra-2',
    nombre: 'Privada Los Encinos - Portones y Protecciones',
    cliente: 'Grupo Constructor Encinos S.A.',
    contrato: 'CONT-2026-ENC-04',
    montoSubtotal: 420000,
    ubicacion: 'Los Encinos, Tlajomulco',
    residente: 'Arq. Mariana Mendoza',
    estatus: 'Activa',
  },
  {
    id: 'obra-3',
    nombre: 'Nave Industrial El Salto - Mantenimiento y Terracerías',
    cliente: 'Logística y Almacenaje del Bajío',
    contrato: 'CONT-2026-NAV-12',
    montoSubtotal: 1250000,
    ubicacion: 'Parque Industrial El Salto',
    residente: 'Ing. Roberto Silva',
    estatus: 'Activa',
  },
];

const DEFAULT_INVOICES: Invoice[] = [
  {
    id: 'inv-1',
    folio: 'FAC-0101',
    obraId: 'obra-1',
    concepto: 'Anticipo',
    fechaEmision: '2026-10-15',
    monto: 255000,
    estatus: 'Pagada',
    notas: 'Anticipo del 30% pactado en contrato',
  },
  {
    id: 'inv-2',
    folio: 'FAC-0108',
    obraId: 'obra-1',
    concepto: 'Estimación',
    fechaEmision: '2026-11-01',
    monto: 180000,
    estatus: 'Pendiente',
    notas: 'Estimación No. 1 avance herrería y montajes',
  },
  {
    id: 'inv-3',
    folio: 'FAC-0095',
    obraId: 'obra-2',
    concepto: 'Anticipo',
    fechaEmision: '2026-10-20',
    monto: 126000,
    estatus: 'Pagada',
    notas: 'Anticipo 30% según contrato',
  },
];

const DEFAULT_MACHINERY_LIST: MachineryItem[] = [
  { id: 'mach-1', numero: 1, name: 'Máquina 1 - CATERPILLAR 426F2', marca: 'CATERPILLAR', modelo: '426F2', type: 'Retroexcavadora' },
  { id: 'mach-2', numero: 2, name: 'Máquina 2 - DEVELON DL1155', marca: 'DEVELON', modelo: 'DL1155', type: 'Manipulador' },
  { id: 'mach-3', numero: 3, name: 'Máquina 3 - CATERPILLAR 426F2', marca: 'CATERPILLAR', modelo: '426F2', type: 'Retroexcavadora' },
];

const DEFAULT_MACHINERY_RECORDS: MachineryDailyRecord[] = [
  {
    id: 'log-1',
    date: '2026-11-02',
    locationId: 'obra-1',
    locationName: 'Parques del Palmar, Zapopan',
    machineId: 'mach-1',
    machineName: 'Máquina 1 - CATERPILLAR 426F2',
    operatorName: 'Juan Carlos Pérez',
    ticketNumber: 'VAL-5510',
    hoursWorked: 8.5,
    extraHours: 1.5,
    billingNotes: 'Nivelación de terreno y zanja de cimentación',
  },
  {
    id: 'log-2',
    date: '2026-11-03',
    locationId: 'obra-1',
    locationName: 'Parques del Palmar, Zapopan',
    machineId: 'mach-1',
    machineName: 'Máquina 1 - CATERPILLAR 426F2',
    operatorName: 'Juan Carlos Pérez',
    ticketNumber: 'VAL-5518',
    hoursWorked: 8.0,
    extraHours: 0.0,
    billingNotes: 'Carga de escombro y retiro',
  },
  {
    id: 'log-3',
    date: '2026-11-04',
    locationId: 'obra-1',
    locationName: 'Parques del Palmar, Zapopan',
    machineId: 'mach-2',
    machineName: 'Máquina 2 - DEVELON DL1155',
    operatorName: 'Héctor Ramírez',
    ticketNumber: 'VAL-5524',
    hoursWorked: 7.0,
    extraHours: 2.0,
    billingNotes: 'Izaje y descarga de perfiles de acero',
  },
];

export interface FacturacionCobranzaProps {
  usuarioEmail?: string;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function FacturacionCobranza({ usuarioEmail }: FacturacionCobranzaProps = {}) {
  // Administrador maestro exclusivo para funciones críticas (Borrar Todo)
  const ADMIN_MAESTRO_EMAIL = 'jrodolforubalcava@gmail.com';
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(
    () => (usuarioEmail || auth.currentUser?.email || '').trim().toLowerCase()
  );

  useEffect(() => {
    if (usuarioEmail) {
      setCurrentUserEmail(usuarioEmail.trim().toLowerCase());
    }
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setCurrentUserEmail(user.email.trim().toLowerCase());
      }
    });
    return () => unsub();
  }, [usuarioEmail]);

  const esAdminMaestro = useMemo(() => {
    const email = (currentUserEmail || '').trim().toLowerCase();
    return email === ADMIN_MAESTRO_EMAIL.toLowerCase();
  }, [currentUserEmail]);
  // --------------------------------------------------------------------------
  // 1. CARGA Y PERSISTENCIA DE OBRAS
  // --------------------------------------------------------------------------
  const [obras, setObras] = useState<ObraItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.OBRAS_PRIMARY) || localStorage.getItem(STORAGE_KEYS.OBRAS_FALLBACK);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      console.warn('Error leyendo obras de LocalStorage:', err);
    }
    return DEFAULT_OBRAS;
  });

  // Escuchar cambios de Obras en LocalStorage (multitarea entre pestañas)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.OBRAS_PRIMARY || e.key === STORAGE_KEYS.OBRAS_FALLBACK) {
        try {
          const updated = JSON.parse(e.newValue || '[]');
          if (Array.isArray(updated) && updated.length > 0) {
            setObras(updated);
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Obra seleccionada en el menú principal
  const [obraIdSeleccionada, setObraIdSeleccionada] = useState<string>(() => {
    return obras[0]?.id || 'obra-1';
  });

  // Obra actualmente activa en el contexto
  const obraSeleccionada = useMemo(() => {
    return obras.find((o) => o.id === obraIdSeleccionada) || obras[0];
  }, [obras, obraIdSeleccionada]);

  // --------------------------------------------------------------------------
  // 2. CARGA Y PERSISTENCIA DE FACTURAS (invoices_db)
  // --------------------------------------------------------------------------
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.INVOICES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      console.warn('Error leyendo invoices_db de LocalStorage:', err);
    }
    // Si no existía, inicializamos con datos de ejemplo y los guardamos
    try {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(DEFAULT_INVOICES));
    } catch {}
    return DEFAULT_INVOICES;
  });

  // Guardar en LocalStorage cada vez que cambien las facturas
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(invoices));
    } catch (err) {
      console.error('Error guardando invoices_db en LocalStorage:', err);
    }
  }, [invoices]);

  // --------------------------------------------------------------------------
  // 3. CARGA DE REGISTROS DE MAQUINARIA (machinery_daily_records / machinery_list)
  // --------------------------------------------------------------------------
  const [machineryList, setMachineryList] = useState<MachineryItem[]>(() => {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEYS.MACHINERY_LIST_PRIMARY) ||
        localStorage.getItem(STORAGE_KEYS.MACHINERY_LIST_FALLBACK);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_MACHINERY_LIST;
  });

  const [machineryRecords, setMachineryRecords] = useState<MachineryDailyRecord[]>(() => {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEYS.MACHINERY_RECORDS_PRIMARY) ||
        localStorage.getItem(STORAGE_KEYS.MACHINERY_RECORDS_FALLBACK);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_MACHINERY_RECORDS;
  });

  // Sincronización en tiempo real con Firestore (con persistencia LocalStorage)
  useEffect(() => {
    // 1. Escuchar obras de Firestore si existen
    const unsubObras = onSnapshot(collection(db, 'obras'), (snapshot) => {
      if (!snapshot.empty) {
        const cloudObras = snapshot.docs.map(docSnap => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            nombre: d.nombre || 'Obra sin nombre',
            cliente: d.cliente || '',
            descripcion: d.descripcion || '',
            ubicacion: d.ubicacion || '',
            contrato: d.contrato || '',
            montoSubtotal: Number(d.montoSubtotal) || 0,
            estatus: d.estatus || 'Activa',
            residente: d.residente || ''
          } as ObraItem;
        });
        setObras(cloudObras);
        try {
          localStorage.setItem(STORAGE_KEYS.OBRAS_PRIMARY, JSON.stringify(cloudObras));
        } catch {}
      }
    }, (err) => console.warn('Firestore obras listener:', err));

    // 2. Escuchar máquinas de Firestore
    const unsubMachines = onSnapshot(collection(db, 'maquinaria_equipos'), (snapshot) => {
      if (!snapshot.empty) {
        const cloudMachines = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as MachineryItem));
        setMachineryList(cloudMachines);
        try {
          localStorage.setItem(STORAGE_KEYS.MACHINERY_LIST_PRIMARY, JSON.stringify(cloudMachines));
        } catch {}
      }
    }, (err) => console.warn('Firestore maquinaria_equipos listener:', err));

    // 3. Escuchar partes diarios de maquinaria de Firestore
    const unsubLogs = onSnapshot(collection(db, 'maquinaria_registros'), (snapshot) => {
      if (!snapshot.empty) {
        const cloudLogs = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as MachineryDailyRecord));
        setMachineryRecords(cloudLogs);
        try {
          localStorage.setItem(STORAGE_KEYS.MACHINERY_RECORDS_PRIMARY, JSON.stringify(cloudLogs));
        } catch {}
      }
    }, (err) => console.warn('Firestore maquinaria_registros listener:', err));

    return () => {
      unsubObras();
      unsubMachines();
      unsubLogs();
    };
  }, []);

  // --------------------------------------------------------------------------
  // 4. ESTADOS PARA FORMULARIO DE NUEVA FACTURA Y ASIGNACIÓN DE OBRA
  // --------------------------------------------------------------------------
  const hoyStr = new Date().toISOString().split('T')[0];

  // Obra / Contrato al que se asignará la nueva factura
  const [obraDestinoFacturaId, setObraDestinoFacturaId] = useState<string>(() => obraIdSeleccionada);

  useEffect(() => {
    setObraDestinoFacturaId(obraIdSeleccionada);
  }, [obraIdSeleccionada]);

  const obraDestinoFactura = useMemo(() => {
    return obras.find((o) => o.id === obraDestinoFacturaId) || obraSeleccionada;
  }, [obras, obraDestinoFacturaId, obraSeleccionada]);

  // Modal para dar de alta una nueva obra directamente en Obras y Contratos
  const [modalNuevaObraOpen, setModalNuevaObraOpen] = useState(false);
  const [nuevaObraForm, setNuevaObraForm] = useState({
    nombre: '',
    cliente: '',
    contrato: '',
    montoSubtotal: '',
    ubicacion: '',
    residente: '',
    descripcion: '',
    fechaInicio: hoyStr,
    fechaFin: '',
  });
  const [cargandoNuevaObra, setCargandoNuevaObra] = useState(false);
  const [errorNuevaObra, setErrorNuevaObra] = useState<string | null>(null);

  // ==========================================================================
  // ESTADOS PARA CARGA MASIVA DESDE EXCEL
  // ==========================================================================
  const [modalImportarExcelOpen, setModalImportarExcelOpen] = useState(false);
  const [archivoExcelSeleccionado, setArchivoExcelSeleccionado] = useState<File | null>(null);
  const [filasExcelPrevia, setFilasExcelPrevia] = useState<Invoice[]>([]);
  const [errorImportarExcel, setErrorImportarExcel] = useState<string | null>(null);
  const [cargandoImportacion, setCargandoImportacion] = useState(false);
  const [modoImportacion, setModoImportacion] = useState<'agregar' | 'reemplazar'>('agregar');
  const [obraDestinoImportId, setObraDestinoImportId] = useState<string>(() => obraIdSeleccionada);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal para ver y editar desglose de Abonos 1 al 4 y estatus de una factura
  const [facturaAbonosEditando, setFacturaAbonosEditando] = useState<Invoice | null>(null);
  const [formAbono1, setFormAbono1] = useState('');
  const [formFechaAbono1, setFormFechaAbono1] = useState('');
  const [formAbono2, setFormAbono2] = useState('');
  const [formFechaAbono2, setFormFechaAbono2] = useState('');
  const [formAbono3, setFormAbono3] = useState('');
  const [formFechaAbono3, setFormFechaAbono3] = useState('');
  const [formAbono4, setFormAbono4] = useState('');
  const [formFechaAbono4, setFormFechaAbono4] = useState('');
  const [formEstatusModal, setFormEstatusModal] = useState<EstatusFactura>('Pendiente');
  const [formNotasModal, setFormNotasModal] = useState('');

  // Estados del Formulario Manual de Factura
  const [folio, setFolio] = useState('');
  const [serieManual, setSerieManual] = useState('');
  const [numeroFacturaManual, setNumeroFacturaManual] = useState('');
  const [concepto, setConcepto] = useState<ConceptoFactura>('Estimación');
  const [conceptoPersonalizado, setConceptoPersonalizado] = useState('');
  const [monto, setMonto] = useState<string>('');
  const [fechaEmision, setFechaEmision] = useState<string>(hoyStr);
  const [estatusInicial, setEstatusInicial] = useState<EstatusFactura>('Pendiente');
  const [notas, setNotas] = useState('');
  
  // Abonos manuales 1 al 4 (opcionales)
  const [mostrarAbonosForm, setMostrarAbonosForm] = useState(false);
  const [abono1Form, setAbono1Form] = useState('');
  const [fechaAbono1Form, setFechaAbono1Form] = useState('');
  const [abono2Form, setAbono2Form] = useState('');
  const [fechaAbono2Form, setFechaAbono2Form] = useState('');
  const [abono3Form, setAbono3Form] = useState('');
  const [fechaAbono3Form, setFechaAbono3Form] = useState('');
  const [abono4Form, setAbono4Form] = useState('');
  const [fechaAbono4Form, setFechaAbono4Form] = useState('');

  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exitoForm, setExitoForm] = useState<string | null>(null);

  // Sincronizar obra destino de importación
  useEffect(() => {
    setObraDestinoImportId(obraIdSeleccionada);
  }, [obraIdSeleccionada]);

  // Filtros de la tabla de facturas
  const [filtroEstatus, setFiltroEstatus] = useState<'Todos' | EstatusFactura>('Todos');
  const [filtroSerie, setFiltroSerie] = useState<string>('Todas');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState<string>('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState<string>('');
  const [busqueda, setBusqueda] = useState('');

  // --------------------------------------------------------------------------
  // 5. CÁLCULOS DEL DASHBOARD FINANCIERO DE LA OBRA
  // --------------------------------------------------------------------------
  const facturasDeObra = useMemo(() => {
    if (!obraSeleccionada) return [];
    return invoices.filter((inv) => inv.obraId === obraSeleccionada.id);
  }, [invoices, obraSeleccionada]);

  const metricasFinancieras = useMemo(() => {
    // Monto Subtotal proveniente del módulo de Obras y Contratos
    const subtotalContrato = Number(obraSeleccionada?.montoSubtotal) || 0;
    // Cálculo del 16% de IVA
    const ivaContrato = subtotalContrato * 0.16;
    // MONTO CONTRATO NETO = Subtotal + 16% de IVA
    const montoContratoNeto = subtotalContrato * 1.16;

    // Facturas emitidas (Pendientes + Pagadas; se ignoran Canceladas)
    const facturasValidas = facturasDeObra.filter((f) => f.estatus !== 'Cancelada');
    const totalFacturado = facturasValidas.reduce((sum, f) => sum + (Number(f.monto) || 0), 0);

    // Facturas Pagadas / Cobradas (Suma de abonos si existen, o monto completo si fue marcada como Pagada)
    const totalCobrado = facturasValidas.reduce((sum, f) => {
      const abonado = Number(f.totalAbonado) || 0;
      if (abonado > 0) return sum + abonado;
      if (f.estatus === 'Pagada') return sum + (Number(f.monto) || 0);
      return sum;
    }, 0);

    // Saldo Pendiente por Facturar = Monto Contrato Neto - Total Facturado
    const saldoPendienteFacturar = Math.max(0, montoContratoNeto - totalFacturado);
    const excedenteFacturado = totalFacturado > montoContratoNeto ? totalFacturado - montoContratoNeto : 0;

    // Saldo Pendiente por Cobrar = Total Facturado - Total Cobrado
    const saldoPendienteCobrar = Math.max(0, totalFacturado - totalCobrado);

    // Porcentajes para barras de progreso respecto al Monto Contrato Neto
    const pctFacturado = montoContratoNeto > 0 ? Math.min(100, (totalFacturado / montoContratoNeto) * 100) : 0;
    const pctCobrado = totalFacturado > 0 ? Math.min(100, (totalCobrado / totalFacturado) * 100) : 0;

    return {
      subtotalContrato,
      ivaContrato,
      montoContratoNeto,
      totalFacturado,
      totalCobrado,
      saldoPendienteFacturar,
      saldoPendienteCobrar,
      excedenteFacturado,
      pctFacturado,
      pctCobrado,
      totalFacturas: facturasDeObra.length,
      facturasPendientesCount: facturasDeObra.filter((f) => f.estatus === 'Pendiente').length,
    };
  }, [obraSeleccionada, facturasDeObra]);

  // --------------------------------------------------------------------------
  // 6. SECCIÓN DE MAQUINARIA POR COBRAR
  // Filtra registros de maquinaria de la obra, agrupa por mes y máquina
  // --------------------------------------------------------------------------
  const maquinariaPorCobrar = useMemo(() => {
    if (!obraSeleccionada) return [];

    const obraNombreNorm = (obraSeleccionada.nombre || '').toLowerCase();
    const obraUbicacionNorm = (obraSeleccionada.ubicacion || '').toLowerCase();

    // Coincidencia por locationId, nombre de obra o ubicación
    const registrosObra = machineryRecords.filter((rec) => {
      if (rec.locationId && rec.locationId === obraSeleccionada.id) return true;
      const locName = (rec.locationName || '').toLowerCase();
      if (!locName) return false;
      return (
        locName.includes(obraNombreNorm) ||
        obraNombreNorm.includes(locName) ||
        (obraUbicacionNorm && (locName.includes(obraUbicacionNorm) || obraUbicacionNorm.includes(locName)))
      );
    });

    // Agrupar por mes (YYYY-MM) y máquina
    const mapa = new Map<string, GrupoMaquinariaCobro>();

    registrosObra.forEach((rec) => {
      const fecha = rec.date || '';
      const mesKey = fecha.length >= 7 ? fecha.substring(0, 7) : 'Sin fecha';

      // Etiqueta legible de mes (ej. "Noviembre 2026")
      let mesLabel = mesKey;
      if (mesKey.includes('-')) {
        const [anio, mes] = mesKey.split('-');
        const dateObj = new Date(Number(anio), Number(mes) - 1, 1);
        const nombreMes = dateObj.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
        mesLabel = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
      }

      // Nombre de la máquina
      const machObj = machineryList.find((m) => m.id === rec.machineId);
      const machLabel =
        rec.machineName ||
        (machObj ? `Máquina ${machObj.numero || ''} - ${machObj.marca || ''} ${machObj.modelo || ''}` : rec.machineId);

      const grupoKey = `${mesKey}_${rec.machineId}`;

      if (!mapa.has(grupoKey)) {
        mapa.set(grupoKey, {
          mesKey,
          mesLabel,
          machineId: rec.machineId,
          machineLabel: machLabel,
          totalHorasNormales: 0,
          totalHorasExtras: 0,
          totalHoras: 0,
          vales: [],
          diasLaborados: 0,
        });
      }

      const item = mapa.get(grupoKey)!;
      const horasNorm = Number(rec.hoursWorked) || 0;
      const horasExt = Number(rec.extraHours) || 0;

      item.totalHorasNormales += horasNorm;
      item.totalHorasExtras += horasExt;
      item.totalHoras += horasNorm + horasExt;
      item.diasLaborados += 1;

      if (rec.ticketNumber && !item.vales.includes(rec.ticketNumber)) {
        item.vales.push(rec.ticketNumber);
      }
    });

    return Array.from(mapa.values()).sort((a, b) => b.mesKey.localeCompare(a.mesKey));
  }, [obraSeleccionada, machineryRecords, machineryList]);

  // --------------------------------------------------------------------------
  // 7. MANEJADORES DE ACCIONES (CREAR, CAMBIAR ESTATUS, ELIMINAR)
  // --------------------------------------------------------------------------

  // Pre-llenar formulario de factura a partir de una sugerencia de maquinaria
  const handlePrellenarDesdeMaquinaria = (grupo: GrupoMaquinariaCobro) => {
    setConcepto('Renta Maquinaria');
    setFolio(`RM-${grupo.mesKey.replace('-', '')}-${grupo.vales[0] || '01'}`);
    setNotas(
      `Renta de ${grupo.machineLabel} durante ${grupo.mesLabel}. Total acumulado: ${grupo.totalHoras.toFixed(1)} hrs (${grupo.diasLaborados} jornadas). Vales: ${
        grupo.vales.length > 0 ? grupo.vales.join(', ') : 'Pendientes de relacionar'
      }.`
    );
    // Desplazamiento suave al formulario
    const el = document.getElementById('seccion-registro-factura');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Dar de alta una nueva obra directamente en Firebase (módulo Obras y Contratos)
  const handleGuardarNuevaObra = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorNuevaObra(null);

    if (!nuevaObraForm.nombre.trim()) {
      setErrorNuevaObra('Por favor ingresa el nombre de la obra.');
      return;
    }
    if (!nuevaObraForm.cliente.trim()) {
      setErrorNuevaObra('Por favor ingresa el nombre del cliente.');
      return;
    }
    if (!nuevaObraForm.contrato.trim()) {
      setErrorNuevaObra('Por favor especifica el número o folio de contrato.');
      return;
    }
    const montoSub = parseFloat(nuevaObraForm.montoSubtotal);
    if (isNaN(montoSub) || montoSub <= 0) {
      setErrorNuevaObra('Por favor ingresa un monto subtotal válido mayor a 0.');
      return;
    }

    setCargandoNuevaObra(true);
    try {
      const newId = Date.now().toString();
      const obraData: Obra = {
        id: newId,
        nombre: nuevaObraForm.nombre.trim(),
        cliente: nuevaObraForm.cliente.trim(),
        contrato: nuevaObraForm.contrato.trim(),
        descripcion: nuevaObraForm.descripcion.trim(),
        ubicacion: nuevaObraForm.ubicacion.trim(),
        residente: nuevaObraForm.residente.trim(),
        montoSubtotal: montoSub,
        fechaInicio: nuevaObraForm.fechaInicio || hoyStr,
        fechaFin: nuevaObraForm.fechaFin || '',
        estatus: 'Activa',
        elementos: [],
        preciosFactura: [],
        compras: [],
      };

      // 1. Guardar en Firestore colección 'obras' (se sincroniza con el módulo Obras y Contratos)
      await setDoc(doc(db, 'obras', newId), obraData);

      // 2. Actualizar lista de obras localmente
      const updatedObras = [obraData as ObraItem, ...obras];
      setObras(updatedObras);
      try {
        localStorage.setItem(STORAGE_KEYS.OBRAS_PRIMARY, JSON.stringify(updatedObras));
      } catch {}

      // 3. Asignar de inmediato la nueva obra para esta factura y en el visor del dashboard
      setObraDestinoFacturaId(newId);
      setObraIdSeleccionada(newId);

      setModalNuevaObraOpen(false);
      setNuevaObraForm({
        nombre: '',
        cliente: '',
        contrato: '',
        montoSubtotal: '',
        ubicacion: '',
        residente: '',
        descripcion: '',
        fechaInicio: hoyStr,
        fechaFin: '',
      });
      setExitoForm(`¡Obra "${obraData.nombre}" registrada en Obras y Contratos y asignada a esta factura!`);
      setTimeout(() => setExitoForm(null), 5000);
    } catch (err: any) {
      console.error('Error al registrar nueva obra en Firestore:', err);
      setErrorNuevaObra('No se pudo guardar la obra en la nube. Por favor intenta de nuevo.');
    } finally {
      setCargandoNuevaObra(false);
    }
  };

  // Registrar nueva factura
  const handleRegistrarFactura = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    setExitoForm(null);

    const serieLimpia = serieManual.trim().toUpperCase();
    const numeroLimpio = numeroFacturaManual.trim().toUpperCase();

    let folioFinal = folio.trim().toUpperCase();
    if (!folioFinal) {
      if (serieLimpia && numeroLimpio) {
        folioFinal = `${serieLimpia}-${numeroLimpio}`;
      } else if (numeroLimpio) {
        folioFinal = numeroLimpio;
      } else if (serieLimpia) {
        folioFinal = serieLimpia;
      }
    }

    if (!folioFinal) {
      setErrorForm('Por favor especifica el Folio o Número de factura.');
      return;
    }

    const idObraAsignada = obraDestinoFacturaId || obraSeleccionada.id;

    // Validar duplicidad de folio en la misma obra
    const folioExiste = invoices.some(
      (inv) => inv.obraId === idObraAsignada && inv.folio.toUpperCase() === folioFinal
    );
    if (folioExiste) {
      setErrorForm(`El folio "${folioFinal}" ya fue registrado para este contrato. Por favor verifica.`);
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setErrorForm('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    const conceptoFinal = concepto === 'Otro' ? conceptoPersonalizado.trim() || 'Otro' : concepto;

    // Abonos 1 al 4
    const ab1 = parseExcelNumber(abono1Form);
    const ab2 = parseExcelNumber(abono2Form);
    const ab3 = parseExcelNumber(abono3Form);
    const ab4 = parseExcelNumber(abono4Form);
    const totAbonado = ab1 + ab2 + ab3 + ab4;
    const saldo = Math.max(0, montoNum - totAbonado);

    let estatusFinal = estatusInicial;
    if (montoNum > 0 && totAbonado >= montoNum) {
      estatusFinal = 'Pagada';
    }

    const nuevaFactura: Invoice = {
      id: `inv-${Date.now()}`,
      folio: folioFinal,
      serie: serieLimpia,
      numeroFactura: numeroLimpio,
      obraId: idObraAsignada,
      concepto: conceptoFinal,
      descripcion: conceptoFinal,
      fechaEmision: fechaEmision || hoyStr,
      monto: montoNum,
      abono1: ab1,
      fechaAbono1: fechaAbono1Form,
      abono2: ab2,
      fechaAbono2: fechaAbono2Form,
      abono3: ab3,
      fechaAbono3: fechaAbono3Form,
      abono4: ab4,
      fechaAbono4: fechaAbono4Form,
      totalAbonado: totAbonado,
      saldoPendiente: saldo,
      estatus: estatusFinal,
      notas: notas.trim(),
      createdAt: new Date().toISOString(),
    };

    setInvoices((prev) => [nuevaFactura, ...prev]);
    setExitoForm(`Factura ${folioFinal} guardada exitosamente con estatus "${estatusFinal}".`);

    // Si la obra asignada es diferente a la que estábamos viendo en el dashboard, cambiar la vista a ella
    if (obraIdSeleccionada !== idObraAsignada) {
      setObraIdSeleccionada(idObraAsignada);
    }

    // Limpiar formulario
    setFolio('');
    setSerieManual('');
    setNumeroFacturaManual('');
    setMonto('');
    setNotas('');
    setConceptoPersonalizado('');
    setAbono1Form('');
    setFechaAbono1Form('');
    setAbono2Form('');
    setFechaAbono2Form('');
    setAbono3Form('');
    setFechaAbono3Form('');
    setAbono4Form('');
    setFechaAbono4Form('');
    setTimeout(() => setExitoForm(null), 4000);
  };

  // ==========================================================================
  // MANEJADORES DE IMPORTACIÓN Y EXPORTACIÓN DESDE EXCEL
  // ==========================================================================

  // Procesar archivo Excel subido con detección inteligente de encabezados y múltiples hojas
  const handleProcesarArchivoExcel = (file: File) => {
    setErrorImportarExcel(null);
    setArchivoExcelSeleccionado(file);
    setCargandoImportacion(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          setErrorImportarExcel('El archivo no contiene ninguna hoja de cálculo.');
          setCargandoImportacion(false);
          return;
        }

        // Palabras clave para identificar la fila que realmente contiene los encabezados
        const palabrasClave = [
          'fecha',
          'serie',
          'factura',
          'folio',
          'descripcion',
          'concepto',
          'monto',
          'total',
          'importe',
          'abono',
          'pago',
          'cobro',
          'numero',
        ];

        // Buscar entre todas las hojas del libro cuál tiene los datos y encabezados
        let selectedSheetName = workbook.SheetNames[0];
        let bestMatrix: any[][] = [];
        let bestHeaderIndex = 0;
        let maxKeywordsFound = -1;

        for (const sName of workbook.SheetNames) {
          const ws = workbook.Sheets[sName];
          if (!ws) continue;
          const matrix: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!matrix || matrix.length === 0) continue;

          // Revisar las primeras 30 filas de cada hoja
          for (let r = 0; r < Math.min(30, matrix.length); r++) {
            const fila = matrix[r];
            if (!Array.isArray(fila)) continue;
            let count = 0;
            for (const cell of fila) {
              if (cell !== null && cell !== undefined) {
                const cellStr = String(cell)
                  .toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9]/g, '');
                if (palabrasClave.some((p) => cellStr.includes(p))) {
                  count++;
                }
              }
            }
            if (count > maxKeywordsFound) {
              maxKeywordsFound = count;
              bestHeaderIndex = r;
              selectedSheetName = sName;
              bestMatrix = matrix;
            }
          }
        }

        if (bestMatrix.length === 0) {
          const firstWs = workbook.Sheets[workbook.SheetNames[0]];
          bestMatrix = XLSX.utils.sheet_to_json(firstWs, { header: 1, defval: '' });
          bestHeaderIndex = 0;
        }

        const encabezados = (bestMatrix[bestHeaderIndex] || []).map((h: any) => String(h || '').trim());
        const filasDatos = bestMatrix.slice(bestHeaderIndex + 1);

        const jsonData: Record<string, any>[] = [];
        for (const fila of filasDatos) {
          if (!Array.isArray(fila)) continue;
          // Ignorar fila si todas las celdas están vacías
          if (fila.every((c) => c === '' || c === null || c === undefined)) continue;

          const obj: Record<string, any> = {};
          encabezados.forEach((enc, colIdx) => {
            if (enc) {
              obj[enc] = fila[colIdx] ?? '';
            }
          });
          jsonData.push(obj);
        }

        if (jsonData.length === 0) {
          setErrorImportarExcel(
            `La hoja "${selectedSheetName}" no contiene registros de datos después de la fila de encabezados.`
          );
          setFilasExcelPrevia([]);
          setCargandoImportacion(false);
          return;
        }

        const targetObra = obraDestinoImportId || obraSeleccionada.id;
        const facturasProcesadas: Invoice[] = jsonData
          .map((row, idx) => procesarFilaExcel(row, idx, targetObra))
          .filter(
            (f): f is Invoice =>
              f !== null &&
              (f.monto > 0 ||
                Boolean(f.numeroFactura) ||
                Boolean(f.serie) ||
                (f.totalAbonado || 0) > 0)
          );

        if (facturasProcesadas.length === 0) {
          setErrorImportarExcel(
            `No se detectaron facturas válidas en la hoja "${selectedSheetName}" (fila de encabezados detectada: #${bestHeaderIndex + 1}). Por favor verifica que las columnas correspondan a Fecha factura, Serie, Número de factura, Descripción, Monto factura, Abonos...`
          );
          setFilasExcelPrevia([]);
        } else {
          setFilasExcelPrevia(facturasProcesadas);
        }
      } catch (err: any) {
        console.error('Error al procesar archivo Excel:', err);
        setErrorImportarExcel('Ocurrió un error al leer el archivo. Asegúrate de que sea un archivo válido de Excel (.xlsx, .xls o .csv).');
      } finally {
        setCargandoImportacion(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Confirmar importación a la base de datos
  const handleConfirmarImportacionExcel = () => {
    if (filasExcelPrevia.length === 0) {
      setErrorImportarExcel('No hay facturas válidas para importar.');
      return;
    }

    const targetObraId = obraDestinoImportId || obraSeleccionada.id;

    // Asignar el obraId definitivo a todas las facturas
    const facturasListas = filasExcelPrevia.map((f) => ({
      ...f,
      obraId: targetObraId,
    }));

    if (modoImportacion === 'reemplazar') {
      // Reemplaza las facturas existentes de esta obra
      setInvoices((prev) => [
        ...facturasListas,
        ...prev.filter((inv) => inv.obraId !== targetObraId),
      ]);
    } else {
      // Agrega a las existentes
      setInvoices((prev) => [...facturasListas, ...prev]);
    }

    setObraIdSeleccionada(targetObraId);
    setObraDestinoFacturaId(targetObraId);

    setExitoForm(`¡Se importaron exitosamente ${facturasListas.length} facturas desde Excel para esta obra!`);
    setModalImportarExcelOpen(false);
    setArchivoExcelSeleccionado(null);
    setFilasExcelPrevia([]);
    setTimeout(() => setExitoForm(null), 5000);
  };

  // Descargar plantilla Excel oficial con las columnas exactas solicitadas
  const handleDescargarPlantillaExcel = () => {
    const encabezados = [
      'Fecha factura',
      'Serie',
      'Número de factura',
      'Descripción',
      'Monto factura',
      'Abono 1',
      'Fecha abono 1',
      'Abono 2',
      'Fecha abono 2',
      'Abono 3',
      'Fecha abono 3',
      'Abono 4',
      'Fecha abono 4',
    ];

    const datosEjemplo = [
      {
        'Fecha factura': '2026-11-01',
        'Serie': 'A',
        'Número de factura': '101',
        'Descripción': 'Anticipo contractual 30%',
        'Monto factura': 250000,
        'Abono 1': 250000,
        'Fecha abono 1': '2026-11-02',
        'Abono 2': '',
        'Fecha abono 2': '',
        'Abono 3': '',
        'Fecha abono 3': '',
        'Abono 4': '',
        'Fecha abono 4': '',
      },
      {
        'Fecha factura': '2026-11-03',
        'Serie': 'A',
        'Número de factura': '102',
        'Descripción': 'Estimación No. 1 Avance de Herrería y Estructura',
        'Monto factura': 180000,
        'Abono 1': 90000,
        'Fecha abono 1': '2026-11-04',
        'Abono 2': 90000,
        'Fecha abono 2': '2026-11-05',
        'Abono 3': '',
        'Fecha abono 3': '',
        'Abono 4': '',
        'Fecha abono 4': '',
      },
      {
        'Fecha factura': '2026-11-05',
        'Serie': 'RM',
        'Número de factura': '5510',
        'Descripción': 'Renta Maquinaria Retroexcavadora Cat 426F2',
        'Monto factura': 85000,
        'Abono 1': '',
        'Fecha abono 1': '',
        'Abono 2': '',
        'Fecha abono 2': '',
        'Abono 3': '',
        'Fecha abono 3': '',
        'Abono 4': '',
        'Fecha abono 4': '',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(datosEjemplo, { header: encabezados });
    ws['!cols'] = [
      { wch: 14 },
      { wch: 8 },
      { wch: 18 },
      { wch: 40 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas');
    XLSX.writeFile(wb, `Plantilla_Facturas_${obraSeleccionada?.contrato || 'Obra'}.xlsx`);
  };

  // Exportar facturas de la obra actual a Excel (.xlsx) con las 13 columnas completas
  const handleExportarExcel = () => {
    if (facturasDeObra.length === 0) {
      alert('No hay facturas registradas en esta obra para exportar.');
      return;
    }

    const encabezados = [
      'Fecha factura',
      'Serie',
      'Número de factura',
      'Descripción',
      'Monto factura',
      'Abono 1',
      'Fecha abono 1',
      'Abono 2',
      'Fecha abono 2',
      'Abono 3',
      'Fecha abono 3',
      'Abono 4',
      'Fecha abono 4',
      'Total Cobrado',
      'Saldo Pendiente',
      'Estatus',
    ];

    const dataRows = facturasDeObra.map((f) => {
      const totAbonado =
        Number(f.totalAbonado) > 0 ? Number(f.totalAbonado) : f.estatus === 'Pagada' ? f.monto : 0;
      const saldo = Math.max(0, f.monto - totAbonado);
      return {
        'Fecha factura': f.fechaEmision,
        'Serie': f.serie || '',
        'Número de factura': f.numeroFactura || f.folio,
        'Descripción': f.descripcion || f.concepto,
        'Monto factura': f.monto,
        'Abono 1': f.abono1 || '',
        'Fecha abono 1': f.fechaAbono1 || '',
        'Abono 2': f.abono2 || '',
        'Fecha abono 2': f.fechaAbono2 || '',
        'Abono 3': f.abono3 || '',
        'Fecha abono 3': f.fechaAbono3 || '',
        'Abono 4': f.abono4 || '',
        'Fecha abono 4': f.fechaAbono4 || '',
        'Total Cobrado': totAbonado,
        'Saldo Pendiente': saldo,
        'Estatus': f.estatus,
      };
    });

    const ws = XLSX.utils.json_to_sheet(dataRows, { header: encabezados });
    ws['!cols'] = [
      { wch: 14 },
      { wch: 8 },
      { wch: 18 },
      { wch: 40 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Facturas_Obra');
    XLSX.writeFile(wb, `Facturacion_${obraSeleccionada?.contrato || 'Obra'}_${hoyStr}.xlsx`);
  };

  // Cambiar estatus de una factura rápidamente
  const handleCambiarEstatus = (id: string, nuevoEstatus: EstatusFactura) => {
    setInvoices((prev) =>
      prev.map((inv) => (inv.id === id ? { ...inv, estatus: nuevoEstatus } : inv))
    );
  };

  // Eliminar factura
  const handleEliminarFactura = (id: string, folioEliminar: string) => {
    if (window.confirm(`¿Estás seguro de eliminar la factura "${folioEliminar}"? Esta acción no se puede deshacer.`)) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    }
  };

  // Eliminar todas las facturas de la obra actual (Exclusivo Administrador Maestro)
  const handleEliminarTodasFacturasObra = () => {
    if (!esAdminMaestro) {
      alert('Acción restringida. Solo el usuario administrador maestro (jrodolforubalcava@gmail.com) puede eliminar todas las facturas.');
      return;
    }
    const cant = facturasDeObra.length;
    if (cant === 0) return;
    if (
      window.confirm(
        `¿Estás seguro de que deseas eliminar las ${cant} facturas registradas en "${obraSeleccionada?.nombre || 'esta obra'}"?\n\nEsta acción borrará todas estas facturas de la memoria para que puedas volver a cargarlas limpiamente desde tu archivo de Excel.`
      )
    ) {
      setInvoices((prev) => prev.filter((inv) => inv.obraId !== obraSeleccionada.id));
      setExitoForm(`Se eliminaron las ${cant} facturas correctamente.`);
      setTimeout(() => setExitoForm(null), 5000);
    }
  };

  // Abrir modal para cargar y gestionar abonos a una factura
  const handleAbrirAbonosModal = (inv: Invoice) => {
    setFacturaAbonosEditando(inv);
    setFormAbono1(inv.abono1 ? String(inv.abono1) : '');
    setFormFechaAbono1(inv.fechaAbono1 || '');
    setFormAbono2(inv.abono2 ? String(inv.abono2) : '');
    setFormFechaAbono2(inv.fechaAbono2 || '');
    setFormAbono3(inv.abono3 ? String(inv.abono3) : '');
    setFormFechaAbono3(inv.fechaAbono3 || '');
    setFormAbono4(inv.abono4 ? String(inv.abono4) : '');
    setFormFechaAbono4(inv.fechaAbono4 || '');
    setFormEstatusModal(inv.estatus);
    setFormNotasModal(inv.notas || '');
  };

  // Guardar abonos y estatus modificados en la factura
  const handleGuardarAbonosModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!facturaAbonosEditando) return;

    const ab1 = parseExcelNumber(formAbono1);
    const ab2 = parseExcelNumber(formAbono2);
    const ab3 = parseExcelNumber(formAbono3);
    const ab4 = parseExcelNumber(formAbono4);
    const totalAbonado = ab1 + ab2 + ab3 + ab4;
    const saldoPendiente = Math.max(0, facturaAbonosEditando.monto - totalAbonado);

    let estatusFinal = formEstatusModal;
    // Si el usuario tenía estatus 'Pendiente' pero el monto está totalmente cubierto:
    if (
      facturaAbonosEditando.monto > 0 &&
      totalAbonado >= facturaAbonosEditando.monto &&
      estatusFinal === 'Pendiente'
    ) {
      estatusFinal = 'Pagada';
    }

    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === facturaAbonosEditando.id
          ? {
              ...inv,
              abono1: ab1,
              fechaAbono1: formFechaAbono1,
              abono2: ab2,
              fechaAbono2: formFechaAbono2,
              abono3: ab3,
              fechaAbono3: formFechaAbono3,
              abono4: ab4,
              fechaAbono4: formFechaAbono4,
              totalAbonado,
              saldoPendiente,
              estatus: estatusFinal,
              notas: formNotasModal.trim(),
            }
          : inv
      )
    );

    setExitoForm(`¡Abonos y estatus de la factura ${facturaAbonosEditando.folio} actualizados correctamente!`);
    setFacturaAbonosEditando(null);
    setTimeout(() => setExitoForm(null), 4000);
  };

  // --------------------------------------------------------------------------
  // 8. SERIES DISPONIBLES Y FACTURAS FILTRADAS
  // --------------------------------------------------------------------------

  // Series únicas presentes en las facturas de la obra actual
  const seriesDisponibles = useMemo(() => {
    const mapa = new Map<string, number>();
    let sinSerieCount = 0;
    facturasDeObra.forEach((f) => {
      const s = (f.serie || '').trim();
      if (s) {
        mapa.set(s, (mapa.get(s) || 0) + 1);
      } else {
        sinSerieCount++;
      }
    });
    return {
      series: Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0])),
      sinSerieCount,
    };
  }, [facturasDeObra]);

  // Facturas filtradas combinando Serie, Rango de Fecha, Estatus y Búsqueda
  const facturasFiltradas = useMemo(() => {
    return facturasDeObra.filter((inv) => {
      // 1. Filtro por Estatus
      if (filtroEstatus !== 'Todos' && inv.estatus !== filtroEstatus) {
        return false;
      }

      // 2. Filtro por Serie
      if (filtroSerie !== 'Todas') {
        const s = (inv.serie || '').trim();
        if (filtroSerie === '__SIN_SERIE__') {
          if (s) return false;
        } else {
          if (s.toLowerCase() !== filtroSerie.trim().toLowerCase()) return false;
        }
      }

      // 3. Filtro por Rango de Fechas (YYYY-MM-DD)
      const fecha = (inv.fechaEmision || '').trim();
      if (filtroFechaDesde && fecha) {
        if (fecha < filtroFechaDesde) return false;
      }
      if (filtroFechaHasta && fecha) {
        if (fecha > filtroFechaHasta) return false;
      }
      if ((filtroFechaDesde || filtroFechaHasta) && !fecha) {
        return false;
      }

      // 4. Filtro por Búsqueda de texto
      const busqNorm = busqueda.trim().toLowerCase();
      if (busqNorm) {
        const coincide =
          inv.folio.toLowerCase().includes(busqNorm) ||
          (inv.serie && inv.serie.toLowerCase().includes(busqNorm)) ||
          (inv.numeroFactura && inv.numeroFactura.toLowerCase().includes(busqNorm)) ||
          inv.concepto.toLowerCase().includes(busqNorm) ||
          (inv.descripcion && inv.descripcion.toLowerCase().includes(busqNorm)) ||
          (inv.notas && inv.notas.toLowerCase().includes(busqNorm));
        if (!coincide) return false;
      }

      return true;
    });
  }, [facturasDeObra, filtroEstatus, filtroSerie, filtroFechaDesde, filtroFechaHasta, busqueda]);

  // Totales financieros calculados sobre las facturas actualmente filtradas
  const totalesFiltrados = useMemo(() => {
    const validas = facturasFiltradas.filter((f) => f.estatus !== 'Cancelada');
    const totalFacturado = validas.reduce((sum, f) => sum + (Number(f.monto) || 0), 0);
    const totalCobrado = validas.reduce((sum, f) => {
      const abonado = Number(f.totalAbonado) || 0;
      if (abonado > 0) return sum + abonado;
      if (f.estatus === 'Pagada') return sum + (Number(f.monto) || 0);
      return sum;
    }, 0);
    const saldoPendiente = Math.max(0, totalFacturado - totalCobrado);
    return { totalFacturado, totalCobrado, saldoPendiente };
  }, [facturasFiltradas]);

  // Indicador de si existe algún filtro activo
  const hayFiltrosActivos = useMemo(() => {
    return (
      filtroEstatus !== 'Todos' ||
      filtroSerie !== 'Todas' ||
      filtroFechaDesde !== '' ||
      filtroFechaHasta !== '' ||
      busqueda.trim() !== ''
    );
  }, [filtroEstatus, filtroSerie, filtroFechaDesde, filtroFechaHasta, busqueda]);

  // Limpiar todos los filtros aplicados
  const handleLimpiarFiltros = () => {
    setFiltroEstatus('Todos');
    setFiltroSerie('Todas');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setBusqueda('');
  };

  // Formateador de moneda
  const formatPesos = (val: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6 text-gray-900 dark:text-gray-100 transition-colors">
      
      {/* ====================================================================== */}
      {/* CABECERA PRINCIPAL Y SELECTOR DE OBRA */}
      {/* ====================================================================== */}
      <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-2 bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 rounded-xl">
              💼
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                Facturación y Control de Cobranza
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Seguimiento de montos contractuales, emisión de facturas y conciliación de maquinaria.
              </p>
            </div>
          </div>
        </div>

        {/* SELECTOR DESPLEGABLE DE OBRA / CONTRATO */}
        <div className="w-full lg:w-96 flex flex-col gap-1">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center justify-between">
            <span>Seleccionar Obra / Contrato:</span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
              {obras.length} obra(s) disponible(s)
            </span>
          </label>
          <div className="relative">
            <select
              value={obraIdSeleccionada}
              onChange={(e) => setObraIdSeleccionada(e.target.value)}
              className="w-full p-2.5 sm:p-3 pr-8 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors cursor-pointer appearance-none shadow-sm"
            >
              {obras.map((o) => {
                const sub = Number(o.montoSubtotal) || 0;
                const neto = sub * 1.16;
                return (
                  <option key={o.id} value={o.id}>
                    {o.nombre} ({o.cliente ? `${o.cliente} - ` : ''}Neto: {formatPesos(neto)})
                  </option>
                );
              })}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* FICHA TÉCNICA RÁPIDA DE LA OBRA ACTIVA */}
      {/* ====================================================================== */}
      {obraSeleccionada && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-blue-800/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[240px]">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30 px-2 py-0.5 rounded-md">
                Obra en Análisis
              </span>
              <span className="text-xs text-blue-200 font-bold">
                Contrato: {obraSeleccionada.contrato || 'S/N'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white leading-snug">
              {obraSeleccionada.nombre}
            </h2>
            <p className="text-xs text-blue-200/90 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>👤 Cliente: <strong>{obraSeleccionada.cliente || 'No especificado'}</strong></span>
              <span>📍 Ubicación: <strong>{obraSeleccionada.ubicacion || 'No especificada'}</strong></span>
              {obraSeleccionada.residente && (
                <span>👷 Residente: <strong>{obraSeleccionada.residente}</strong></span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/10 shrink-0">
            <div>
              <span className="block text-[10px] text-blue-200 uppercase font-bold tracking-wider">
                MONTO CONTRATO NETO
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">
                {formatPesos(metricasFinancieras.montoContratoNeto)}
              </span>
              <span className="block text-[10px] text-blue-200/80 mt-0.5">
                Subtotal: {formatPesos(metricasFinancieras.subtotalContrato)} + 16% IVA
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================== */}
      {/* DASHBOARD FINANCIERO DE LA OBRA (5 TARJETAS RESUMEN) */}
      {/* ====================================================================== */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-black uppercase tracking-wider text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <span>📊</span> Dashboard Financiero de Cobranza
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Moneda: Pesos Mexicanos (MXN)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* TARJETA 1: MONTO CONTRATO NETO */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                MONTO CONTRATO NETO
              </span>
              <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-black">
                📑
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl font-black text-gray-900 dark:text-white">
                {formatPesos(metricasFinancieras.montoContratoNeto)}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Subtotal: {formatPesos(metricasFinancieras.subtotalContrato)} + 16% IVA
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/80 text-[10px] text-blue-600 dark:text-blue-400 font-bold flex justify-between items-center">
              <span>IVA (16%):</span>
              <span>{formatPesos(metricasFinancieras.ivaContrato)}</span>
            </div>
          </div>

          {/* TARJETA 2: TOTAL FACTURADO */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Total Facturado
              </span>
              <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-black">
                📤
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-400">
                {formatPesos(metricasFinancieras.totalFacturado)}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                {metricasFinancieras.totalFacturas} factura(s) emitidas
              </p>
            </div>
            {/* Barra de progreso de facturación */}
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/80">
              <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-bold">
                <span>Avance facturación:</span>
                <span>{metricasFinancieras.pctFacturado.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metricasFinancieras.pctFacturado}%` }}
                />
              </div>
            </div>
          </div>

          {/* TARJETA 3: TOTAL COBRADO */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Total Cobrado
              </span>
              <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-sm font-black">
                💰
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">
                {formatPesos(metricasFinancieras.totalCobrado)}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Ingresado a caja / banco
              </p>
            </div>
            {/* Barra de cobrado vs facturado */}
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/80">
              <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mb-1 font-bold">
                <span>Efectividad cobro:</span>
                <span className="text-emerald-600 dark:text-emerald-400">
                  {metricasFinancieras.pctCobrado.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${metricasFinancieras.pctCobrado}%` }}
                />
              </div>
            </div>
          </div>

          {/* TARJETA 4: PENDIENTE POR FACTURAR */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Por Facturar
              </span>
              <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 flex items-center justify-center text-sm font-black">
                ⏳
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
                {formatPesos(metricasFinancieras.saldoPendienteFacturar)}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Contrato neto remanente
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/80 text-[10px] text-amber-700 dark:text-amber-400 font-bold">
              {metricasFinancieras.excedenteFacturado > 0 ? (
                <span className="text-purple-600 dark:text-purple-400">
                  + {formatPesos(metricasFinancieras.excedenteFacturado)} facturado extra
                </span>
              ) : (
                `${(100 - metricasFinancieras.pctFacturado).toFixed(1)}% por amortizar`
              )}
            </div>
          </div>

          {/* TARJETA 5: PENDIENTE POR COBRAR */}
          <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-red-200 dark:border-red-900/60 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                Por Cobrar
              </span>
              <span className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 flex items-center justify-center text-sm font-black">
                🚨
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg sm:text-xl font-black text-red-600 dark:text-red-400">
                {formatPesos(metricasFinancieras.saldoPendienteCobrar)}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                Facturas emitidas pendientes
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/80 text-[10px] text-red-600 dark:text-red-400 font-bold flex items-center justify-between">
              <span>{metricasFinancieras.facturasPendientesCount} factura(s) pendientes</span>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================== */}
      {/* SECCIÓN DE MAQUINARIA POR COBRAR (SUGERENCIAS DE AUDITORÍA) */}
      {/* ====================================================================== */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-b border-amber-200 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl p-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl">
              🚜
            </span>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                Horas de Maquinaria por Cobrar (Sugerencias de Conciliación)
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Resumen de horas laboradas en esta obra extraídas de los partes diarios de campo.
              </p>
            </div>
          </div>

          <span className="text-xs bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold px-3 py-1 rounded-full self-start sm:self-auto border border-amber-300 dark:border-amber-800">
            {maquinariaPorCobrar.length} periodo(s) detectado(s)
          </span>
        </div>

        <div className="p-4 sm:p-5">
          {maquinariaPorCobrar.length === 0 ? (
            <div className="text-center py-8 px-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
              <span className="text-3xl block mb-2">🚜</span>
              <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                No se encontraron partes diarios de maquinaria para "{obraSeleccionada?.nombre}".
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">
                Los registros guardados en el módulo de Maquinaria con la ubicación o nombre de esta obra aparecerán automáticamente aquí para sugerirte horas por facturar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {maquinariaPorCobrar.map((item, idx) => (
                <div
                  key={`${item.mesKey}-${item.machineId}-${idx}`}
                  className="bg-gray-50 dark:bg-gray-800/80 rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-col justify-between hover:border-amber-400 dark:hover:border-amber-500 transition-colors shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-md">
                        {item.mesLabel}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 font-bold">
                        {item.diasLaborados} día(s) en campo
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-gray-900 dark:text-white leading-tight mb-2">
                      {item.machineLabel}
                    </h4>

                    <div className="grid grid-cols-2 gap-2 bg-white dark:bg-gray-900 p-2.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs mb-3">
                      <div>
                        <span className="block text-[10px] text-gray-400 font-bold uppercase">
                          Horas Normales
                        </span>
                        <span className="text-sm font-black text-gray-800 dark:text-gray-200">
                          {item.totalHorasNormales.toFixed(1)} hrs
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">
                          Horas Extras
                        </span>
                        <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                          {item.totalHorasExtras.toFixed(1)} hrs
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                        <span className="text-[10px] text-gray-500 font-bold">TOTAL ACUMULADO:</span>
                        <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                          {item.totalHoras.toFixed(1)} hrs
                        </span>
                      </div>
                    </div>

                    {item.vales.length > 0 && (
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-3 truncate">
                        <span className="font-bold text-gray-700 dark:text-gray-300">Vales: </span>
                        <span>{item.vales.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePrellenarDesdeMaquinaria(item)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-gray-900 font-black py-2 rounded-lg text-xs transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>⚡</span>
                    <span>Facturar este Periodo</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ====================================================================== */}
      {/* FORMULARIO DE REGISTRO DE NUEVA FACTURA */}
      {/* ====================================================================== */}
      <div
        id="seccion-registro-factura"
        className="bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800"
      >
        <div className="border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
              📝
            </span>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                Registrar Nueva Factura
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Alta de factura para <strong>{obraDestinoFactura?.nombre || obraSeleccionada?.nombre}</strong>
              </p>
            </div>
          </div>

          {/* BOTÓN PROMINENTE PARA CARGAR FACTURAS DESDE EXCEL */}
          <button
            type="button"
            onClick={() => {
              setErrorImportarExcel(null);
              setFilasExcelPrevia([]);
              setArchivoExcelSeleccionado(null);
              setModalImportarExcelOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap self-start sm:self-auto"
            title="Cargar facturas masivamente desde un archivo de Excel (.xlsx, .xls)"
          >
            <span className="text-base">📥</span>
            <span>Cargar Facturas desde Excel</span>
          </button>
        </div>

        {errorForm && (
          <div className="mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorForm}</span>
          </div>
        )}

        {exitoForm && (
          <div className="mb-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-3 rounded-xl text-xs font-bold flex items-center gap-2">
            <span>✅</span>
            <span>{exitoForm}</span>
          </div>
        )}

        <form onSubmit={handleRegistrarFactura} className="space-y-4">
          {/* ASIGNACIÓN DE OBRA / CONTRATO */}
          <div className="bg-blue-50/70 dark:bg-blue-950/40 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-xs font-black text-gray-800 dark:text-gray-200 mb-1">
                  Obra / Contrato al que se Asigna la Factura *
                </label>
                <div className="relative">
                  <select
                    value={obraDestinoFacturaId}
                    onChange={(e) => setObraDestinoFacturaId(e.target.value)}
                    className="w-full p-2.5 pr-8 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors cursor-pointer"
                  >
                    {obras.map((o) => {
                      const neto = (Number(o.montoSubtotal) || 0) * 1.16;
                      return (
                        <option key={o.id} value={o.id}>
                          {o.nombre} — {o.cliente ? `${o.cliente} | ` : ''}Contrato: {o.contrato || 'S/N'} (Neto: {formatPesos(neto)})
                        </option>
                      );
                    })}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                    ▼
                  </span>
                </div>
              </div>

              <div className="sm:self-end">
                <button
                  type="button"
                  onClick={() => {
                    setErrorNuevaObra(null);
                    setModalNuevaObraOpen(true);
                  }}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-black px-4 py-2.5 rounded-xl text-xs transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                  title="Dar de alta una nueva obra o contrato que se guardará en Obras y Contratos"
                >
                  <span>➕</span>
                  <span>Nueva Obra / Contrato</span>
                </button>
              </div>
            </div>
            
            <p className="text-[11px] text-blue-800 dark:text-blue-300 mt-2 font-medium">
              💡 Si el contrato deseado no aparece en la lista, da clic en <strong>"Nueva Obra / Contrato"</strong> para crearlo de inmediato; se guardará automáticamente en el módulo de <strong>Obras y Contratos</strong>.
            </p>
          </div>

          {/* CAMPOS DE FACTURA CON SERIE Y NÚMERO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
            {/* SERIE */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Serie (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej. A, B, FAC"
                value={serieManual}
                onChange={(e) => {
                  setSerieManual(e.target.value);
                  const s = e.target.value.trim().toUpperCase();
                  const n = numeroFacturaManual.trim().toUpperCase();
                  if (s && n) setFolio(`${s}-${n}`);
                  else if (n) setFolio(n);
                  else if (s) setFolio(s);
                }}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
              />
            </div>

            {/* NÚMERO DE FACTURA */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Número Factura *
              </label>
              <input
                type="text"
                placeholder="Ej. 101, 5510"
                value={numeroFacturaManual}
                onChange={(e) => {
                  setNumeroFacturaManual(e.target.value);
                  const s = serieManual.trim().toUpperCase();
                  const n = e.target.value.trim().toUpperCase();
                  if (s && n) setFolio(`${s}-${n}`);
                  else if (n) setFolio(n);
                  else if (s) setFolio(s);
                }}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
              />
            </div>

            {/* FOLIO IDENTIFICADOR */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Folio Unificado *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. A-101, FAC-0115"
                value={folio}
                onChange={(e) => setFolio(e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
              />
            </div>

            {/* MONTO FACTURA */}
            <div className="lg:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Monto Factura ($ MXN) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  placeholder="0.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  className="w-full p-2.5 pl-7 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-black focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {/* CONCEPTO / DESCRIPCIÓN */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Descripción / Concepto *
              </label>
              <select
                value={concepto}
                onChange={(e) => setConcepto(e.target.value as ConceptoFactura)}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="Estimación">Estimación de Obra</option>
                <option value="Anticipo">Anticipo Contractual</option>
                <option value="Renta Maquinaria">Renta de Maquinaria</option>
                <option value="Finiquito">Finiquito de Contrato</option>
                <option value="Otro">Otro / Extraordinario</option>
              </select>
            </div>

            {/* FECHA DE EMISIÓN */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Fecha Factura *
              </label>
              <input
                type="date"
                required
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
              />
            </div>

            {/* ESTATUS INICIAL */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Estatus Inicial *
              </label>
              <select
                value={estatusInicial}
                onChange={(e) => setEstatusInicial(e.target.value as EstatusFactura)}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="Pendiente">🟡 Pendiente de Pago</option>
                <option value="Pagada">🟢 Pagada / Cobrada</option>
                <option value="Cancelada">🔴 Cancelada</option>
              </select>
            </div>
          </div>

          {/* CONCEPTO PERSONALIZADO SI SELECCIONA 'OTRO' */}
          {concepto === 'Otro' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Especifica la Descripción Detallada *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Trabajos extraordinarios de soldadura, Flete especial..."
                value={conceptoPersonalizado}
                onChange={(e) => setConceptoPersonalizado(e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
              />
            </div>
          )}

          {/* SECCIÓN DESPLEGABLE DE ABONOS 1 AL 4 */}
          <div className="bg-gray-50 dark:bg-gray-800/60 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setMostrarAbonosForm(!mostrarAbonosForm)}
              className="w-full flex items-center justify-between text-xs font-black text-gray-800 dark:text-gray-200 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>💳</span>
                <span>Desglose de Abonos / Cobros Recibidos (Abono 1 al 4 opcionales)</span>
                {(parseExcelNumber(abono1Form) + parseExcelNumber(abono2Form) + parseExcelNumber(abono3Form) + parseExcelNumber(abono4Form)) > 0 && (
                  <span className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full text-[10px]">
                    Total Cobrado: {formatPesos(parseExcelNumber(abono1Form) + parseExcelNumber(abono2Form) + parseExcelNumber(abono3Form) + parseExcelNumber(abono4Form))}
                  </span>
                )}
              </span>
              <span className="text-blue-600 dark:text-blue-400 font-bold text-[11px]">
                {mostrarAbonosForm ? '▲ Ocultar Abonos' : '▼ Capturar Abonos (1 al 4)'}
              </span>
            </button>

            {mostrarAbonosForm && (
              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Puedes capturar hasta 4 abonos parciales con sus fechas correspondientes. Si el total abonado cubre el monto de la factura, se marcará automáticamente como <strong>Pagada</strong>.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* ABONO 1 */}
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="block text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1.5">
                      Abono 1
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Monto $ 0.00"
                      value={abono1Form}
                      onChange={(e) => setAbono1Form(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white mb-2"
                    />
                    <label className="block text-[10px] text-gray-500 mb-0.5">Fecha Abono 1:</label>
                    <input
                      type="date"
                      value={fechaAbono1Form}
                      onChange={(e) => setFechaAbono1Form(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300"
                    />
                  </div>

                  {/* ABONO 2 */}
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="block text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1.5">
                      Abono 2
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Monto $ 0.00"
                      value={abono2Form}
                      onChange={(e) => setAbono2Form(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white mb-2"
                    />
                    <label className="block text-[10px] text-gray-500 mb-0.5">Fecha Abono 2:</label>
                    <input
                      type="date"
                      value={fechaAbono2Form}
                      onChange={(e) => setFechaAbono2Form(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300"
                    />
                  </div>

                  {/* ABONO 3 */}
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="block text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1.5">
                      Abono 3
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Monto $ 0.00"
                      value={abono3Form}
                      onChange={(e) => setAbono3Form(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white mb-2"
                    />
                    <label className="block text-[10px] text-gray-500 mb-0.5">Fecha Abono 3:</label>
                    <input
                      type="date"
                      value={fechaAbono3Form}
                      onChange={(e) => setFechaAbono3Form(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300"
                    />
                  </div>

                  {/* ABONO 4 */}
                  <div className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                    <span className="block text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1.5">
                      Abono 4
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Monto $ 0.00"
                      value={abono4Form}
                      onChange={(e) => setAbono4Form(e.target.value)}
                      className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white mb-2"
                    />
                    <label className="block text-[10px] text-gray-500 mb-0.5">Fecha Abono 4:</label>
                    <input
                      type="date"
                      value={fechaAbono4Form}
                      onChange={(e) => setFechaAbono4Form(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* NOTAS / OBSERVACIONES */}
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
              Notas / Referencia de Cobro (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Transferencia Bancomer #88392, o detalle de retenciones..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl text-xs transition-colors shadow-md cursor-pointer flex items-center gap-2"
            >
              <span>💾</span>
              <span>Guardar Factura</span>
            </button>
          </div>
        </form>
      </div>

      {/* ====================================================================== */}
      {/* TABLA DE CONTROL DE FACTURAS Y ESTATUS DE COBRANZA */}
      {/* ====================================================================== */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* BARRA SUPERIOR DE LA TABLA (TÍTULO Y ACCIONES PRINCIPALES) */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/40">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>📋</span> Control de Facturas Registradas
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold px-2.5 py-0.5 rounded-full">
                {facturasFiltradas.length}{facturasFiltradas.length !== facturasDeObra.length ? ` de ${facturasDeObra.length}` : ''}
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Filtra por fecha, serie o estatus, y gestiona abonos o cambios de estatus con un clic.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* BOTÓN CARGAR DESDE EXCEL */}
            <button
              type="button"
              onClick={() => {
                setErrorImportarExcel(null);
                setFilasExcelPrevia([]);
                setArchivoExcelSeleccionado(null);
                setModalImportarExcelOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Cargar facturas masivamente desde archivo Excel (.xlsx)"
            >
              <span>📥</span>
              <span>Cargar Excel</span>
            </button>

            {/* BOTÓN EXPORTAR EXCEL (.xlsx) */}
            <button
              type="button"
              onClick={handleExportarExcel}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Descargar lista de facturas completa en Excel (.xlsx)"
            >
              <span>📊</span>
              <span>Exportar Excel</span>
            </button>

            {/* BOTÓN BORRAR TODAS LAS FACTURAS DE ESTA OBRA (EXCLUSIVO ADMINISTRADOR MAESTRO) */}
            {esAdminMaestro && facturasDeObra.length > 0 && (
              <button
                type="button"
                onClick={handleEliminarTodasFacturasObra}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                title="Eliminar todas las facturas de esta obra (Solo Administrador Maestro)"
              >
                <span>🗑️</span>
                <span>Borrar Todo ({facturasDeObra.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* PANEL DE FILTROS AVANZADOS (FECHA, SERIE, BÚSQUEDA) */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-800/25 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* 1. BUSCADOR */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                🔍 Buscar por Folio / Descripción
              </label>
              <input
                type="text"
                placeholder="Ej. RR-3001, GSCM, San Isidro..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
              />
            </div>

            {/* 2. FILTRO POR SERIE */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                🏷️ Filtrar por Serie
              </label>
              <select
                value={filtroSerie}
                onChange={(e) => setFiltroSerie(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="Todas">Todas las Series ({facturasDeObra.length})</option>
                {seriesDisponibles.series.map(([serieNombre, count]) => (
                  <option key={serieNombre} value={serieNombre}>
                    Serie {serieNombre} ({count})
                  </option>
                ))}
                {seriesDisponibles.sinSerieCount > 0 && (
                  <option value="__SIN_SERIE__">
                    Sin Serie ({seriesDisponibles.sinSerieCount})
                  </option>
                )}
              </select>
            </div>

            {/* 3. FECHA DESDE */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                📅 Fecha Factura Desde
              </label>
              <input
                type="date"
                value={filtroFechaDesde}
                onChange={(e) => setFiltroFechaDesde(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors cursor-pointer"
              />
            </div>

            {/* 4. FECHA HASTA */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 dark:text-gray-300 mb-1">
                📅 Fecha Factura Hasta
              </label>
              <input
                type="date"
                value={filtroFechaHasta}
                onChange={(e) => setFiltroFechaHasta(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors cursor-pointer"
              />
            </div>
          </div>

          {/* BARRA DE RESUMEN Y BOTÓN LIMPIAR FILTROS */}
          {hayFiltrosActivos && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-200 dark:border-gray-700/60 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-gray-600 dark:text-gray-300">
                <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                  Filtro activo: {facturasFiltradas.length} de {facturasDeObra.length}
                </span>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <span>Facturado: <strong className="text-gray-900 dark:text-white">{formatPesos(totalesFiltrados.totalFacturado)}</strong></span>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <span className="text-emerald-600 dark:text-emerald-400">Cobrado: <strong>{formatPesos(totalesFiltrados.totalCobrado)}</strong></span>
                <span className="text-gray-300 dark:text-gray-700">|</span>
                <span className="text-red-500 dark:text-red-400">Saldo: <strong>{formatPesos(totalesFiltrados.saldoPendiente)}</strong></span>
              </div>
              <button
                type="button"
                onClick={handleLimpiarFiltros}
                className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold px-3 py-1 rounded-lg text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span>✕</span>
                <span>Limpiar Filtros</span>
              </button>
            </div>
          )}
        </div>

        {/* PESTAÑAS DE FILTRO RÁPIDO POR ESTATUS */}
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex flex-wrap gap-1.5 bg-gray-50/30 dark:bg-gray-900">
          {(['Todos', 'Pendiente', 'Pagada', 'Cancelada'] as const).map((est) => {
            const count =
              est === 'Todos'
                ? facturasDeObra.length
                : facturasDeObra.filter((f) => f.estatus === est).length;
            const activo = filtroEstatus === est;
            return (
              <button
                key={est}
                type="button"
                onClick={() => setFiltroEstatus(est)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activo
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
              >
                <span>
                  {est === 'Todos' && '📁'}
                  {est === 'Pendiente' && '🟡'}
                  {est === 'Pagada' && '🟢'}
                  {est === 'Cancelada' && '🔴'}
                </span>
                <span>{est === 'Todos' ? 'Todas' : est}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  activo ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-black tracking-wider border-b border-gray-200 dark:border-gray-700">
                <th className="py-3 px-4">Folio / Factura</th>
                <th className="py-3 px-4">Descripción / Concepto</th>
                <th className="py-3 px-4">Fecha Emisión</th>
                <th className="py-3 px-4 text-right">Monto Factura</th>
                <th className="py-3 px-4 text-right">Cobrado / Saldo</th>
                <th className="py-3 px-4 text-center">Estatus</th>
                <th className="py-3 px-4 text-center">Abonos (1-4)</th>
                <th className="py-3 px-4">Observaciones</th>
                <th className="py-3 px-4 text-center">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-medium">
              {facturasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-gray-400 dark:text-gray-500">
                    <span className="text-2xl block mb-1">📭</span>
                    <span>No hay facturas que coincidan con los criterios seleccionados.</span>
                  </td>
                </tr>
              ) : (
                facturasFiltradas.map((inv) => {
                  const cobradoReal =
                    Number(inv.totalAbonado) > 0
                      ? Number(inv.totalAbonado)
                      : inv.estatus === 'Pagada'
                      ? inv.monto
                      : 0;
                  const saldoReal = Math.max(0, inv.monto - cobradoReal);
                  const abonosCount = [inv.abono1, inv.abono2, inv.abono3, inv.abono4].filter(
                    (a) => Number(a) > 0
                  ).length;

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-blue-50/40 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      {/* FOLIO Y SERIE */}
                      <td className="py-3 px-4">
                        <span className="font-black text-gray-900 dark:text-white block">
                          {inv.folio}
                        </span>
                        {(inv.serie || inv.numeroFactura) && (
                          <span className="text-[10px] text-gray-500 dark:text-gray-400">
                            {inv.serie ? `Serie: ${inv.serie}` : ''}
                            {inv.serie && inv.numeroFactura ? ' | ' : ''}
                            {inv.numeroFactura ? `No. ${inv.numeroFactura}` : ''}
                          </span>
                        )}
                      </td>

                      {/* CONCEPTO */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-md text-[11px] ${
                          inv.concepto === 'Anticipo'
                            ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300'
                            : inv.concepto === 'Estimación'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                            : inv.concepto === 'Renta Maquinaria'
                            ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}>
                          <span>
                            {inv.concepto === 'Anticipo' && '🎯'}
                            {inv.concepto === 'Estimación' && '📈'}
                            {inv.concepto === 'Renta Maquinaria' && '🚜'}
                            {inv.concepto !== 'Anticipo' && inv.concepto !== 'Estimación' && inv.concepto !== 'Renta Maquinaria' && '🏷️'}
                          </span>
                          <span>{inv.descripcion || inv.concepto}</span>
                        </span>
                      </td>

                      {/* FECHA */}
                      <td className="py-3 px-4 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {inv.fechaEmision}
                      </td>

                      {/* MONTO */}
                      <td className="py-3 px-4 text-right font-black text-sm text-gray-900 dark:text-white whitespace-nowrap">
                        {formatPesos(inv.monto)}
                      </td>

                      {/* COBRADO / SALDO */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                          {formatPesos(cobradoReal)}
                        </div>
                        <div className={`text-[10px] font-semibold ${saldoReal > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                          Saldo: {formatPesos(saldoReal)}
                        </div>
                      </td>

                      {/* ESTATUS BADGE Y SELECTOR MANUAL */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <select
                          value={inv.estatus}
                          onChange={(e) => handleCambiarEstatus(inv.id, e.target.value as EstatusFactura)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors shadow-xs ${
                            inv.estatus === 'Pagada'
                              ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : inv.estatus === 'Pendiente'
                              ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                              : 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800 line-through'
                          }`}
                          title="Cambiar estatus de la factura manualmente"
                        >
                          <option value="Pendiente" className="bg-white dark:bg-gray-800 text-amber-700 font-bold">🟡 PENDIENTE</option>
                          <option value="Pagada" className="bg-white dark:bg-gray-800 text-emerald-700 font-bold">🟢 PAGADA</option>
                          <option value="Cancelada" className="bg-white dark:bg-gray-800 text-red-700 font-bold">🔴 CANCELADA</option>
                        </select>
                      </td>

                      {/* BOTÓN CARGAR Y EDITAR ABONOS */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleAbrirAbonosModal(inv)}
                          className="bg-blue-50 dark:bg-blue-950/70 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold px-2.5 py-1 rounded-lg text-[10px] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-xs"
                          title="Cargar o modificar abonos y fechas de cobro"
                        >
                          <span>💳</span>
                          <span>{abonosCount > 0 ? `${abonosCount} Abono(s) / Editar` : '+ Cargar Abono'}</span>
                        </button>
                      </td>

                      {/* NOTAS */}
                      <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-[11px] max-w-xs truncate" title={inv.notas || ''}>
                        {inv.notas || '—'}
                      </td>

                      {/* BOTONES RÁPIDOS DE CAMBIO DE ESTATUS */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {inv.estatus !== 'Pagada' && (
                            <button
                              type="button"
                              onClick={() => handleCambiarEstatus(inv.id, 'Pagada')}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors shadow-xs cursor-pointer"
                              title="Marcar como cobrada / pagada (actualiza Dashboard)"
                            >
                              ✓ Pagada
                            </button>
                          )}

                          {inv.estatus !== 'Pendiente' && (
                            <button
                              type="button"
                              onClick={() => handleCambiarEstatus(inv.id, 'Pendiente')}
                              className="bg-amber-500 hover:bg-amber-600 text-gray-900 px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors shadow-xs cursor-pointer"
                              title="Marcar como pendiente de cobro"
                            >
                              ⏳ Pendiente
                            </button>
                          )}

                          {inv.estatus !== 'Cancelada' && (
                            <button
                              type="button"
                              onClick={() => handleCambiarEstatus(inv.id, 'Cancelada')}
                              className="bg-gray-200 dark:bg-gray-800 hover:bg-red-100 dark:hover:bg-red-950/70 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-300 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                              title="Cancelar factura"
                            >
                              ✕ Cancelar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleEliminarFactura(inv.id, inv.folio)}
                            className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-xs font-bold transition-colors cursor-pointer ml-1"
                            title="Eliminar factura de la base de datos"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PIE DE TABLA CON TOTALES FILTRADOS */}
        {facturasFiltradas.length > 0 && (
          <div className="p-3.5 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              Mostrando <strong className="text-gray-800 dark:text-gray-200">{facturasFiltradas.length}</strong> de <strong className="text-gray-800 dark:text-gray-200">{facturasDeObra.length}</strong> factura(s) de esta obra.
            </span>
            <div className="flex flex-wrap items-center gap-4 font-bold text-gray-700 dark:text-gray-300">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Monto Facturado:</span>
                <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                  {formatPesos(totalesFiltrados.totalFacturado)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Total Cobrado:</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                  {formatPesos(totalesFiltrados.totalCobrado)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Saldo Pendiente:</span>
                <span className={`text-sm font-black ${totalesFiltrados.saldoPendiente > 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-400'}`}>
                  {formatPesos(totalesFiltrados.saldoPendiente)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL: CREAR NUEVA OBRA / CONTRATO (SINCRONIZADO CON OBRAS) */}
      {/* ======================================================== */}
      {modalNuevaObraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden text-gray-900 dark:text-gray-100 transition-colors">
            
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-lg">
                  🏗️
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                    Dar de Alta Nueva Obra / Contrato
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Se guardará en la base de datos de <strong>Obras y Contratos</strong> en Firebase
                  </p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setModalNuevaObraOpen(false)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Formulario de Alta de Obra */}
            <form onSubmit={handleGuardarNuevaObra} className="p-5 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorNuevaObra && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 text-base">⚠️</span>
                  <span>{errorNuevaObra}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* NOMBRE DE LA OBRA */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Nombre de la Obra o Proyecto *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Torre Alborada - Herrería Estructural"
                    value={nuevaObraForm.nombre}
                    onChange={(e) => setNuevaObraForm({ ...nuevaObraForm, nombre: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* CLIENTE */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Cliente / Desarrollador *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. GSC Constructora"
                    value={nuevaObraForm.cliente}
                    onChange={(e) => setNuevaObraForm({ ...nuevaObraForm, cliente: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* NO. DE CONTRATO */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    No. de Contrato / Folio *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. CONT-5560, ALB-2026"
                    value={nuevaObraForm.contrato}
                    onChange={(e) => setNuevaObraForm({ ...nuevaObraForm, contrato: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* MONTO SUBTOTAL */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Monto Contrato Subtotal (Sin IVA) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                      $
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      placeholder="0.00"
                      value={nuevaObraForm.montoSubtotal}
                      onChange={(e) => setNuevaObraForm({ ...nuevaObraForm, montoSubtotal: e.target.value })}
                      className="w-full p-2.5 pl-7 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-black focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                    />
                  </div>
                  
                  {/* CÁLCULO EN VIVO DE IVA Y MONTO NETO */}
                  {Number(nuevaObraForm.montoSubtotal) > 0 && (
                    <div className="mt-2 p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-900/60 text-xs flex flex-wrap justify-between items-center text-blue-900 dark:text-blue-200 font-bold">
                      <span>+ 16% IVA: {formatPesos(Number(nuevaObraForm.montoSubtotal) * 0.16)}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">
                        MONTO CONTRATO NETO: {formatPesos(Number(nuevaObraForm.montoSubtotal) * 1.16)}
                      </span>
                    </div>
                  )}
                </div>

                {/* UBICACIÓN */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Ubicación / Municipio
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Tesistán, Zapopan"
                    value={nuevaObraForm.ubicacion}
                    onChange={(e) => setNuevaObraForm({ ...nuevaObraForm, ubicacion: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* RESIDENTE */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Residente / Encargado
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Ing. Filiberto Procel"
                    value={nuevaObraForm.residente}
                    onChange={(e) => setNuevaObraForm({ ...nuevaObraForm, residente: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                  />
                </div>

                {/* DESCRIPCIÓN */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Descripción / Alcance de Trabajos (Opcional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Detalle o notas contractuales..."
                    value={nuevaObraForm.descripcion}
                    onChange={(e) => setNuevaObraForm({ ...nuevaObraForm, descripcion: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* ACCIONES DEL MODAL */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setModalNuevaObraOpen(false)}
                  disabled={cargandoNuevaObra}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={cargandoNuevaObra}
                  className={`bg-blue-600 hover:bg-blue-700 text-white font-black px-5 py-2 rounded-xl text-xs transition-colors shadow-md cursor-pointer flex items-center gap-2 ${
                    cargandoNuevaObra ? 'opacity-70 cursor-wait' : ''
                  }`}
                >
                  {cargandoNuevaObra ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando en Firebase...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Guardar Obra y Asignar</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CARGAR FACTURAS DESDE EXCEL */}
      {/* ======================================================== */}
      {modalImportarExcelOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden text-gray-900 dark:text-gray-100 transition-colors">
            
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 dark:from-emerald-950/40 dark:via-gray-900 dark:to-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-sm">
                  📥
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight">
                    Cargar Facturas desde Excel
                  </h3>
                  <p className="text-[11px] text-gray-600 dark:text-gray-400">
                    Importa facturas masivamente con sus abonos y fechas de cobro
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalImportarExcelOpen(false);
                  setFilasExcelPrevia([]);
                  setArchivoExcelSeleccionado(null);
                  setErrorImportarExcel(null);
                }}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Contenido con scroll */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
              
              {/* GUÍA DE COLUMNAS REQUERIDAS Y BOTÓN DE PLANTILLA */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                  <span className="font-black text-emerald-900 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                    <span>📋</span>
                    <span>13 Columnas requeridas en la tabla de Excel:</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleDescargarPlantillaExcel}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-3 py-1.5 rounded-lg text-[11px] transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
                    title="Descargar archivo Excel con los encabezados exactos y filas de ejemplo"
                  >
                    <span>📊</span>
                    <span>Descargar Plantilla Oficial (.xlsx)</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Fecha factura',
                    'Serie',
                    'Número de factura',
                    'Descripción',
                    'Monto factura',
                    'Abono 1',
                    'Fecha abono 1',
                    'Abono 2',
                    'Fecha abono 2',
                    'Abono 3',
                    'Fecha abono 3',
                    'Abono 4',
                    'Fecha abono 4',
                  ].map((col, idx) => (
                    <span
                      key={col}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-800 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-md font-bold text-[10px]"
                    >
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400">#{idx + 1}</span>
                      <span>{col}</span>
                    </span>
                  ))}
                </div>
              </div>

              {/* SELECTOR DE OBRA Y MODO DE IMPORTACIÓN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Obra / Contrato Destino *
                  </label>
                  <div className="relative">
                    <select
                      value={obraDestinoImportId}
                      onChange={(e) => setObraDestinoImportId(e.target.value)}
                      className="w-full p-2.5 pr-8 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-600 focus:outline-none transition-colors cursor-pointer"
                    >
                      {obras.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre} ({o.cliente ? `${o.cliente} | ` : ''}Contrato: {o.contrato || 'S/N'})
                        </option>
                      ))}
                    </select>
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-xs">
                      ▼
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Modo de Importación *
                  </label>
                  <div className="flex gap-2">
                    <label className={`flex-1 p-2 rounded-xl border cursor-pointer flex items-center gap-2 transition-colors ${
                      modoImportacion === 'agregar'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <input
                        type="radio"
                        name="modoImportacion"
                        checked={modoImportacion === 'agregar'}
                        onChange={() => setModoImportacion('agregar')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span className="text-[11px]">➕ Agregar a las actuales</span>
                    </label>

                    <label className={`flex-1 p-2 rounded-xl border cursor-pointer flex items-center gap-2 transition-colors ${
                      modoImportacion === 'reemplazar'
                        ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 text-amber-900 dark:text-amber-200 font-bold'
                        : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                      <input
                        type="radio"
                        name="modoImportacion"
                        checked={modoImportacion === 'reemplazar'}
                        onChange={() => setModoImportacion('reemplazar')}
                        className="text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-[11px]">🔄 Reemplazar obra</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* ZONA DE CARGA DEL ARCHIVO (DROPZONE) */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleProcesarArchivoExcel(f);
                  }}
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-emerald-400 dark:border-emerald-600 hover:border-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 p-6 rounded-2xl text-center cursor-pointer transition-all bg-gray-50/60 dark:bg-gray-800/40"
                >
                  <span className="text-4xl block mb-2">📁</span>
                  <p className="text-sm font-black text-gray-800 dark:text-gray-200">
                    {archivoExcelSeleccionado
                      ? `Archivo: ${archivoExcelSeleccionado.name} (${(archivoExcelSeleccionado.size / 1024).toFixed(1)} KB)`
                      : 'Haz clic aquí o arrastra tu archivo de Excel (.xlsx, .xls o .csv)'}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                    El sistema detectará automáticamente los importes, fechas y abonos 1 al 4.
                  </p>
                </div>
              </div>

              {/* MENSAJES DE ERROR */}
              {errorImportarExcel && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-xl text-xs font-semibold flex items-start gap-2">
                  <span className="text-base shrink-0">⚠️</span>
                  <span>{errorImportarExcel}</span>
                </div>
              )}

              {/* SPINNER DE PROCESAMIENTO */}
              {cargandoImportacion && (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-bold">Procesando y validando filas del archivo Excel...</span>
                </div>
              )}

              {/* PREVISUALIZACIÓN DE FACTURAS LEÍDAS */}
              {filasExcelPrevia.length > 0 && !cargandoImportacion && (
                <div className="space-y-3">
                  {/* RESUMEN DE IMPORTACIÓN */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-blue-50 dark:bg-blue-950/50 p-3 rounded-xl border border-blue-200 dark:border-blue-900/60">
                      <span className="block text-[10px] text-blue-700 dark:text-blue-300 uppercase font-black">Facturas</span>
                      <span className="text-lg font-black text-blue-900 dark:text-blue-100">{filasExcelPrevia.length}</span>
                    </div>

                    <div className="bg-emerald-50 dark:bg-emerald-950/50 p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                      <span className="block text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-black">Total Facturado</span>
                      <span className="text-sm sm:text-base font-black text-emerald-900 dark:text-emerald-100">
                        {formatPesos(filasExcelPrevia.reduce((s, f) => s + f.monto, 0))}
                      </span>
                    </div>

                    <div className="bg-teal-50 dark:bg-teal-950/50 p-3 rounded-xl border border-teal-200 dark:border-teal-900/60">
                      <span className="block text-[10px] text-teal-700 dark:text-teal-300 uppercase font-black">Total en Abonos</span>
                      <span className="text-sm sm:text-base font-black text-teal-900 dark:text-teal-100">
                        {formatPesos(filasExcelPrevia.reduce((s, f) => s + (f.totalAbonado || 0), 0))}
                      </span>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-900/60">
                      <span className="block text-[10px] text-amber-700 dark:text-amber-300 uppercase font-black">Saldo Pendiente</span>
                      <span className="text-sm sm:text-base font-black text-amber-900 dark:text-amber-100">
                        {formatPesos(filasExcelPrevia.reduce((s, f) => s + (f.saldoPendiente || 0), 0))}
                      </span>
                    </div>
                  </div>

                  {/* TABLA PREVIA DE FILAS */}
                  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                    <div className="p-2.5 bg-gray-100 dark:bg-gray-800 text-[11px] font-black text-gray-700 dark:text-gray-300 flex justify-between items-center">
                      <span>Vista previa de registros detectados ({filasExcelPrevia.length} facturas)</span>
                      <span className="text-[10px] text-gray-500">Mostrando primeras filas</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-gray-50 dark:bg-gray-800/80 sticky top-0 text-[10px] uppercase font-bold text-gray-500 border-b border-gray-200 dark:border-gray-700">
                          <tr>
                            <th className="p-2">Fecha</th>
                            <th className="p-2">Folio (Serie-No)</th>
                            <th className="p-2">Descripción</th>
                            <th className="p-2 text-right">Monto</th>
                            <th className="p-2 text-right">Abonos</th>
                            <th className="p-2 text-center">Estatus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {filasExcelPrevia.slice(0, 15).map((f, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                              <td className="p-2 whitespace-nowrap">{f.fechaEmision}</td>
                              <td className="p-2 font-bold whitespace-nowrap">{f.folio}</td>
                              <td className="p-2 max-w-xs truncate">{f.descripcion}</td>
                              <td className="p-2 text-right font-black whitespace-nowrap">{formatPesos(f.monto)}</td>
                              <td className="p-2 text-right text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                                {formatPesos(f.totalAbonado || 0)}
                              </td>
                              <td className="p-2 text-center whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                  f.estatus === 'Pagada'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                                }`}>
                                  {f.estatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Acciones del Modal */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setModalImportarExcelOpen(false);
                  setFilasExcelPrevia([]);
                  setArchivoExcelSeleccionado(null);
                }}
                className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleConfirmarImportacionExcel}
                disabled={filasExcelPrevia.length === 0}
                className={`bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 rounded-xl text-xs transition-colors shadow-md flex items-center gap-2 cursor-pointer ${
                  filasExcelPrevia.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <span>✅</span>
                <span>Confirmar e Importar {filasExcelPrevia.length > 0 ? `(${filasExcelPrevia.length}) Facturas` : ''}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: CARGAR Y EDITAR ABONOS DE LA FACTURA */}
      {/* ======================================================== */}
      {facturaAbonosEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-gray-900 dark:text-gray-100 transition-colors">
            
            {/* Cabecera */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-sm">
                  💳
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-tight">
                    Cargar Abonos — Folio: {facturaAbonosEditando.folio}
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {facturaAbonosEditando.descripcion || facturaAbonosEditando.concepto} | Monto Factura:{' '}
                    <strong className="text-gray-800 dark:text-gray-200 font-black">
                      {formatPesos(facturaAbonosEditando.monto)}
                    </strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFacturaAbonosEditando(null)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Formulario de Carga y Edición de Abonos */}
            <form onSubmit={handleGuardarAbonosModal} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Registra o modifica los abonos recibidos con su fecha de cobro correspondiente. Los saldos del Dashboard se actualizarán automáticamente.
              </p>

              {/* 4 Tarjetas Editables de Abonos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* ABONO 1 */}
                <div className="bg-gray-50 dark:bg-gray-800/70 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                      Abono 1 ($ MXN)
                    </span>
                    <span className="text-[10px] text-gray-400">Primer cobro</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formAbono1}
                      onChange={(e) => setFormAbono1(e.target.value)}
                      className="w-full p-2 pl-6 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Fecha Abono 1:</label>
                    <input
                      type="date"
                      value={formFechaAbono1}
                      onChange={(e) => setFormFechaAbono1(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* ABONO 2 */}
                <div className="bg-gray-50 dark:bg-gray-800/70 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                      Abono 2 ($ MXN)
                    </span>
                    <span className="text-[10px] text-gray-400">Segundo cobro</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formAbono2}
                      onChange={(e) => setFormAbono2(e.target.value)}
                      className="w-full p-2 pl-6 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Fecha Abono 2:</label>
                    <input
                      type="date"
                      value={formFechaAbono2}
                      onChange={(e) => setFormFechaAbono2(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* ABONO 3 */}
                <div className="bg-gray-50 dark:bg-gray-800/70 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                      Abono 3 ($ MXN)
                    </span>
                    <span className="text-[10px] text-gray-400">Tercer cobro</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formAbono3}
                      onChange={(e) => setFormAbono3(e.target.value)}
                      className="w-full p-2 pl-6 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Fecha Abono 3:</label>
                    <input
                      type="date"
                      value={formFechaAbono3}
                      onChange={(e) => setFormFechaAbono3(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* ABONO 4 */}
                <div className="bg-gray-50 dark:bg-gray-800/70 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                      Abono 4 ($ MXN)
                    </span>
                    <span className="text-[10px] text-gray-400">Cuarto cobro / Liquidación</span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formAbono4}
                      onChange={(e) => setFormAbono4(e.target.value)}
                      className="w-full p-2 pl-6 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs font-black text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-0.5">Fecha Abono 4:</label>
                    <input
                      type="date"
                      value={formFechaAbono4}
                      onChange={(e) => setFormFechaAbono4(e.target.value)}
                      className="w-full p-1.5 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* CAMBIO MANUAL DE ESTATUS Y NOTAS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-gray-50 dark:bg-gray-800/50 p-3.5 rounded-xl border border-gray-200 dark:border-gray-700">
                <div>
                  <label className="block text-xs font-black text-gray-800 dark:text-gray-200 mb-1">
                    Estatus de la Factura *
                  </label>
                  <select
                    value={formEstatusModal}
                    onChange={(e) => setFormEstatusModal(e.target.value as EstatusFactura)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    <option value="Pendiente">🟡 Pendiente de Pago</option>
                    <option value="Pagada">🟢 Pagada / Cobrada</option>
                    <option value="Cancelada">🔴 Cancelada</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                    Notas / Referencia de Pago (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Transferencia Bancomer #88392, cheque o retenciones..."
                    value={formNotasModal}
                    onChange={(e) => setFormNotasModal(e.target.value)}
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* RESUMEN FINANCIERO EN VIVO */}
              {(() => {
                const a1 = parseExcelNumber(formAbono1);
                const a2 = parseExcelNumber(formAbono2);
                const a3 = parseExcelNumber(formAbono3);
                const a4 = parseExcelNumber(formAbono4);
                const tot = a1 + a2 + a3 + a4;
                const saldo = Math.max(0, facturaAbonosEditando.monto - tot);
                const cubierto = tot >= facturaAbonosEditando.monto && facturaAbonosEditando.monto > 0;

                return (
                  <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/50 to-teal-50/60 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-teal-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 dark:text-gray-300 font-semibold">Monto Total Factura:</span>
                      <span className="font-black text-gray-900 dark:text-white">{formatPesos(facturaAbonosEditando.monto)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-emerald-700 dark:text-emerald-400 font-bold">
                      <span>Total Cobrado en Abonos:</span>
                      <span className="text-sm font-black">{formatPesos(tot)}</span>
                    </div>

                    <div className="flex justify-between items-center text-xs pt-1.5 border-t border-gray-200 dark:border-gray-700 font-black">
                      <span className="text-gray-800 dark:text-gray-200">Saldo Pendiente por Cobrar:</span>
                      <span className={`text-sm ${saldo > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {formatPesos(saldo)}
                      </span>
                    </div>

                    {cubierto && (
                      <div className="text-[10px] bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 p-1.5 rounded-lg text-center font-bold">
                        ✓ El monto total está cubierto. Al guardar se marcará automáticamente como PAGADA.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Botones de acción del modal */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setFacturaAbonosEditando(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-2.5 rounded-xl text-xs transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span>💾</span>
                  <span>Guardar Abonos y Cambios</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
