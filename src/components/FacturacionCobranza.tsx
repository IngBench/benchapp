import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

// ============================================================================
// TIPOS E INTERFACES DEL MÓDULO
// ============================================================================

export type ConceptoFactura = 'Anticipo' | 'Estimación' | 'Renta Maquinaria' | 'Finiquito' | string;
export type EstatusFactura = 'Pendiente' | 'Pagada' | 'Cancelada';

export interface Invoice {
  id: string;
  folio: string;
  obraId: string;
  concepto: ConceptoFactura;
  fechaEmision: string; // YYYY-MM-DD
  monto: number;
  estatus: EstatusFactura;
  notas?: string;
  createdAt?: string;
}

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

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================
export default function FacturacionCobranza() {
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
  // 4. ESTADOS PARA FORMULARIO DE NUEVA FACTURA
  // --------------------------------------------------------------------------
  const hoyStr = new Date().toISOString().split('T')[0];
  const [folio, setFolio] = useState('');
  const [concepto, setConcepto] = useState<ConceptoFactura>('Estimación');
  const [conceptoPersonalizado, setConceptoPersonalizado] = useState('');
  const [monto, setMonto] = useState<string>('');
  const [fechaEmision, setFechaEmision] = useState<string>(hoyStr);
  const [estatusInicial, setEstatusInicial] = useState<EstatusFactura>('Pendiente');
  const [notas, setNotas] = useState('');
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exitoForm, setExitoForm] = useState<string | null>(null);

  // Filtros de la tabla de facturas
  const [filtroEstatus, setFiltroEstatus] = useState<'Todos' | EstatusFactura>('Todos');
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

    // Facturas Pagadas (Cobrado real)
    const facturasPagadas = facturasDeObra.filter((f) => f.estatus === 'Pagada');
    const totalCobrado = facturasPagadas.reduce((sum, f) => sum + (Number(f.monto) || 0), 0);

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

  // Registrar nueva factura
  const handleRegistrarFactura = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    setExitoForm(null);

    const folioLimpio = folio.trim().toUpperCase();
    if (!folioLimpio) {
      setErrorForm('Por favor especifica el Folio de la factura.');
      return;
    }

    // Validar duplicidad de folio en la misma obra
    const folioExiste = invoices.some(
      (inv) => inv.obraId === obraSeleccionada.id && inv.folio.toUpperCase() === folioLimpio
    );
    if (folioExiste) {
      setErrorForm(`El folio "${folioLimpio}" ya fue registrado para esta obra. Por favor verifica.`);
      return;
    }

    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) {
      setErrorForm('Por favor ingresa un monto válido mayor a 0.');
      return;
    }

    const conceptoFinal = concepto === 'Otro' ? conceptoPersonalizado.trim() || 'Otro' : concepto;

    const nuevaFactura: Invoice = {
      id: `inv-${Date.now()}`,
      folio: folioLimpio,
      obraId: obraSeleccionada.id,
      concepto: conceptoFinal,
      fechaEmision: fechaEmision || hoyStr,
      monto: montoNum,
      estatus: estatusInicial,
      notas: notas.trim(),
      createdAt: new Date().toISOString(),
    };

    setInvoices((prev) => [nuevaFactura, ...prev]);
    setExitoForm(`Factura ${folioLimpio} guardada exitosamente con estatus "${estatusInicial}".`);

    // Limpiar formulario
    setFolio('');
    setMonto('');
    setNotas('');
    setConceptoPersonalizado('');
    setTimeout(() => setExitoForm(null), 4000);
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

  // Exportar facturas de la obra a formato CSV (Excel)
  const handleExportarCSV = () => {
    if (facturasDeObra.length === 0) {
      alert('No hay facturas registradas en esta obra para exportar.');
      return;
    }

    const encabezados = ['Folio', 'Concepto', 'Fecha Emision', 'Monto MXN', 'Estatus', 'Notas'];
    const filas = facturasDeObra.map((f) => [
      `"${f.folio}"`,
      `"${f.concepto}"`,
      `"${f.fechaEmision}"`,
      f.monto.toFixed(2),
      `"${f.estatus}"`,
      `"${(f.notas || '').replace(/"/g, '""')}"`,
    ]);

    const contenidoCSV = 'sep=,\n' + [encabezados.join(','), ...filas.map((r) => r.join(','))].join('\n');
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Facturacion_${obraSeleccionada?.contrato || 'Obra'}_${hoyStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --------------------------------------------------------------------------
  // 8. FACTURAS FILTRADAS PARA LA TABLA
  // --------------------------------------------------------------------------
  const facturasFiltradas = useMemo(() => {
    return facturasDeObra.filter((inv) => {
      const coincideEstatus = filtroEstatus === 'Todos' || inv.estatus === filtroEstatus;
      const busqNorm = busqueda.trim().toLowerCase();
      const coincideBusq =
        !busqNorm ||
        inv.folio.toLowerCase().includes(busqNorm) ||
        inv.concepto.toLowerCase().includes(busqNorm) ||
        (inv.notas && inv.notas.toLowerCase().includes(busqNorm));
      return coincideEstatus && coincideBusq;
    });
  }, [facturasDeObra, filtroEstatus, busqueda]);

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
        <div className="border-b border-gray-100 dark:border-gray-800 pb-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
              📝
            </span>
            <div>
              <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                Registrar Nueva Factura
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Alta de factura para <strong>{obraSeleccionada?.nombre}</strong>
              </p>
            </div>
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* FOLIO */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Folio / No. Factura *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. FAC-0115, EST-02"
                value={folio}
                onChange={(e) => setFolio(e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
              />
            </div>

            {/* CONCEPTO */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Concepto de Facturación *
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

            {/* MONTO */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Monto Facturado ($ MXN) *
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
                  className="w-full p-2.5 pl-7 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* FECHA DE EMISIÓN */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Fecha de Emisión *
              </label>
              <input
                type="date"
                required
                value={fechaEmision}
                onChange={(e) => setFechaEmision(e.target.value)}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* CONCEPTO PERSONALIZADO SI SELECCIONA 'OTRO' */}
          {concepto === 'Otro' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Especifica el Concepto Personalizado *
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
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

            {/* NOTAS / OBSERVACIONES */}
            <div className="sm:col-span-2">
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
        {/* BARRA SUPERIOR DE LA TABLA (FILTROS Y BÚSQUEDA) */}
        <div className="p-4 sm:p-5 border-b border-gray-200 dark:border-gray-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-50/50 dark:bg-gray-800/40">
          <div>
            <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <span>📋</span> Control de Facturas Registradas
              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold px-2 py-0.5 rounded-full">
                {facturasFiltradas.length}
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Modifica el estatus con un clic para actualizar automáticamente los saldos del Dashboard.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* BUSCADOR */}
            <input
              type="text"
              placeholder="Buscar por folio o concepto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="p-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors w-full sm:w-56"
            />

            {/* BOTÓN EXPORTAR CSV */}
            <button
              type="button"
              onClick={handleExportarCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl text-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              title="Descargar lista de facturas en Excel CSV"
            >
              <span>📊</span>
              <span>Exportar Excel</span>
            </button>
          </div>
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
                <th className="py-3 px-4">Folio</th>
                <th className="py-3 px-4">Concepto</th>
                <th className="py-3 px-4">Fecha Emisión</th>
                <th className="py-3 px-4 text-right">Monto ($ MXN)</th>
                <th className="py-3 px-4 text-center">Estatus</th>
                <th className="py-3 px-4">Notas / Observaciones</th>
                <th className="py-3 px-4 text-center">Acciones Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800 font-medium">
              {facturasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400 dark:text-gray-500">
                    <span className="text-2xl block mb-1">📭</span>
                    <span>No hay facturas que coincidan con los criterios seleccionados.</span>
                  </td>
                </tr>
              ) : (
                facturasFiltradas.map((inv) => (
                  <tr
                    key={inv.id}
                    className="hover:bg-blue-50/40 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    {/* FOLIO */}
                    <td className="py-3 px-4 font-black text-gray-900 dark:text-white">
                      {inv.folio}
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
                        <span>{inv.concepto}</span>
                      </span>
                    </td>

                    {/* FECHA */}
                    <td className="py-3 px-4 text-gray-600 dark:text-gray-300">
                      {inv.fechaEmision}
                    </td>

                    {/* MONTO */}
                    <td className="py-3 px-4 text-right font-black text-sm text-gray-900 dark:text-white">
                      {formatPesos(inv.monto)}
                    </td>

                    {/* ESTATUS BADGE */}
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        inv.estatus === 'Pagada'
                          ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : inv.estatus === 'Pendiente'
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 animate-pulse'
                          : 'bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-300 dark:border-red-800 line-through'
                      }`}>
                        {inv.estatus === 'Pagada' && '🟢 PAGADA'}
                        {inv.estatus === 'Pendiente' && '🟡 PENDIENTE'}
                        {inv.estatus === 'Cancelada' && '🔴 CANCELADA'}
                      </span>
                    </td>

                    {/* NOTAS */}
                    <td className="py-3 px-4 text-gray-500 dark:text-gray-400 text-[11px] max-w-xs truncate" title={inv.notas || ''}>
                      {inv.notas || '—'}
                    </td>

                    {/* BOTONES RÁPIDOS DE CAMBIO DE ESTATUS */}
                    <td className="py-3 px-4">
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* PIE DE TABLA CON TOTALES FILTRADOS */}
        {facturasFiltradas.length > 0 && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800/60 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              Mostrando {facturasFiltradas.length} de {facturasDeObra.length} factura(s) de esta obra.
            </span>
            <div className="flex items-center gap-2 font-bold text-gray-700 dark:text-gray-300">
              <span>Suma Subtotal Filtrada:</span>
              <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                {formatPesos(
                  facturasFiltradas
                    .filter((f) => f.estatus !== 'Cancelada')
                    .reduce((sum, f) => sum + (Number(f.monto) || 0), 0)
                )}
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
