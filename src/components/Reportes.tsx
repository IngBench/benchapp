import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export interface Machine {
  id: string;
  numero: number;
  name: string;
  marca: string;
  modelo: string;
  anio: number;
  type: string;
  currentHours: number;
}

export interface Operator {
  id: string;
  name: string;
  age: number;
  nss: string;
  phone: string;
}

export interface MachineryLocation {
  id: string;
  name: string;
  client?: string;
  city?: string;
  notes?: string;
}

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  locationId?: string;
  locationName: string;
  machineId: string;
  machineName: string;
  operatorId?: string;
  operatorName?: string;
  ticketNumber?: string;
  fuelLiters: number;
  initialHours: number;
  finalHours: number;
  hoursWorked: number;
  extraHours: number;
  billingNotes: string;
  createdAt: string;
}

type PeriodoPreset = 'hoy' | 'semana' | 'mes' | 'ultimos30' | 'personalizado' | 'historico';
type AgrupacionTipo = 'dia' | 'semana' | 'mes';

export const Reportes: React.FC = () => {
  // Pestaña principal del módulo de reportes (Extensible a otros módulos)
  const [activeReportModule, setActiveReportModule] = useState<'maquinaria' | 'obras' | 'presupuestos' | 'almacen'>('maquinaria');

  // Datos en tiempo real desde Firestore
  const [machines, setMachines] = useState<Machine[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [locations, setLocations] = useState<MachineryLocation[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados de Filtros para Maquinaria
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>('mes');
  const [agrupacion, setAgrupacion] = useState<AgrupacionTipo>('dia');
  const [filtroMaquinaId, setFiltroMaquinaId] = useState<string>('all');
  const [filtroUbicacionId, setFiltroUbicacionId] = useState<string>('all');
  const [filtroOperadorId, setFiltroOperadorId] = useState<string>('all');

  // Rango de fechas
  const todayStr = new Date().toISOString().split('T')[0];
  const [fechaDesde, setFechaDesde] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Primer día del mes actual
    return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState<string>(todayStr);

  // Suscripción a Firestore en tiempo real
  useEffect(() => {
    const unsubMachines = onSnapshot(collection(db, 'maquinaria_equipos'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Machine));
      list.sort((a, b) => a.numero - b.numero);
      setMachines(list);
    });

    const unsubLogs = onSnapshot(collection(db, 'maquinaria_registros'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DailyLog));
      setDailyLogs(list);
      setLoading(false);
    });

    const unsubLocations = onSnapshot(collection(db, 'maquinaria_ubicaciones'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as MachineryLocation));
      setLocations(list);
    });

    const unsubOperators = onSnapshot(collection(db, 'maquinaria_operadores'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Operator));
      setOperators(list);
    });

    return () => {
      unsubMachines();
      unsubLogs();
      unsubLocations();
      unsubOperators();
    };
  }, []);

  // Actualizar fechas al cambiar el preset
  const aplicarPreset = (preset: PeriodoPreset) => {
    setPeriodoPreset(preset);
    const hoy = new Date();

    if (preset === 'hoy') {
      const f = hoy.toISOString().split('T')[0];
      setFechaDesde(f);
      setFechaHasta(f);
      setAgrupacion('dia');
    } else if (preset === 'semana') {
      // Lunes de la semana actual
      const day = hoy.getDay();
      const diff = hoy.getDate() - day + (day === 0 ? -6 : 1);
      const lunes = new Date(hoy.setDate(diff));
      setFechaDesde(lunes.toISOString().split('T')[0]);
      setFechaHasta(new Date().toISOString().split('T')[0]);
      setAgrupacion('dia');
    } else if (preset === 'mes') {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      setFechaDesde(primero.toISOString().split('T')[0]);
      setFechaHasta(new Date().toISOString().split('T')[0]);
      setAgrupacion('dia');
    } else if (preset === 'ultimos30') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFechaDesde(d.toISOString().split('T')[0]);
      setFechaHasta(todayStr);
      setAgrupacion('semana');
    } else if (preset === 'historico') {
      setFechaDesde('2020-01-01');
      setFechaHasta(todayStr);
      setAgrupacion('mes');
    }
  };

  // Filtrado de registros diarios
  const logsFiltrados = useMemo(() => {
    return dailyLogs.filter((log) => {
      // 1. Filtro por fecha
      if (periodoPreset !== 'historico') {
        if (fechaDesde && log.date < fechaDesde) return false;
        if (fechaHasta && log.date > fechaHasta) return false;
      }

      // 2. Filtro por máquina
      if (filtroMaquinaId !== 'all' && log.machineId !== filtroMaquinaId) {
        return false;
      }

      // 3. Filtro por ubicación
      if (filtroUbicacionId !== 'all') {
        if (log.locationId && log.locationId !== filtroUbicacionId) return false;
        const locObj = locations.find((l) => l.id === filtroUbicacionId);
        if (locObj && log.locationName !== locObj.name) return false;
      }

      // 4. Filtro por operador
      if (filtroOperadorId !== 'all') {
        if (log.operatorId && log.operatorId !== filtroOperadorId) return false;
        const opObj = operators.find((op) => op.id === filtroOperadorId);
        if (opObj && log.operatorName !== opObj.name) return false;
      }

      return true;
    });
  }, [dailyLogs, periodoPreset, fechaDesde, fechaHasta, filtroMaquinaId, filtroUbicacionId, filtroOperadorId, locations, operators]);

  // KPIs Globales del período
  const kpis = useMemo(() => {
    const totalHoras = logsFiltrados.reduce((acc, l) => acc + (l.hoursWorked || 0), 0);
    const totalExtras = logsFiltrados.reduce((acc, l) => acc + (l.extraHours || 0), 0);
    const totalCombustible = logsFiltrados.reduce((acc, l) => acc + (l.fuelLiters || 0), 0);
    const rendimiento = totalHoras > 0 ? totalCombustible / totalHoras : 0;
    const totalVales = logsFiltrados.length;

    // Conteo de máquinas únicas que tuvieron actividad
    const maquinasActivasSet = new Set(logsFiltrados.map((l) => l.machineId));

    return {
      totalHoras,
      totalExtras,
      totalCombustible,
      rendimiento,
      totalVales,
      maquinasActivas: maquinasActivasSet.size,
    };
  }, [logsFiltrados]);

  // Resumen individual por máquina
  const resumenPorMaquina = useMemo(() => {
    const map = new Map<string, {
      machine: Machine;
      horas: number;
      extras: number;
      combustible: number;
      rendimiento: number;
      vales: number;
    }>();

    // Inicializar con las máquinas del catálogo
    machines.forEach((m) => {
      if (filtroMaquinaId === 'all' || filtroMaquinaId === m.id) {
        map.set(m.id, {
          machine: m,
          horas: 0,
          extras: 0,
          combustible: 0,
          rendimiento: 0,
          vales: 0,
        });
      }
    });

    // Sumar registros
    logsFiltrados.forEach((l) => {
      const item = map.get(l.machineId);
      if (item) {
        item.horas += l.hoursWorked || 0;
        item.extras += l.extraHours || 0;
        item.combustible += l.fuelLiters || 0;
        item.vales += 1;
      } else {
        // En caso de que la máquina no esté en el catálogo principal
        const fakeMachine: Machine = {
          id: l.machineId,
          numero: 0,
          name: l.machineName || 'Equipo sin registrar',
          marca: '',
          modelo: '',
          anio: 0,
          type: 'Maquinaria',
          currentHours: l.finalHours || 0,
        };
        map.set(l.machineId, {
          machine: fakeMachine,
          horas: l.hoursWorked || 0,
          extras: l.extraHours || 0,
          combustible: l.fuelLiters || 0,
          rendimiento: 0,
          vales: 1,
        });
      }
    });

    // Calcular rendimientos y convertir a array
    const result = Array.from(map.values()).map((item) => ({
      ...item,
      rendimiento: item.horas > 0 ? item.combustible / item.horas : 0,
      pctCombustible: kpis.totalCombustible > 0 ? (item.combustible / kpis.totalCombustible) * 100 : 0,
    }));

    // Ordenar por número de máquina
    return result.sort((a, b) => (a.machine.numero || 999) - (b.machine.numero || 999));
  }, [machines, logsFiltrados, filtroMaquinaId, kpis.totalCombustible]);

  // Helper para agrupar por semana
  const getWeekKey = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lunes
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const pad = (n: number) => String(n).padStart(2, '0');
    const label = `Semana ${pad(monday.getDate())}/${pad(monday.getMonth() + 1)} al ${pad(sunday.getDate())}/${pad(sunday.getMonth() + 1)}/${sunday.getFullYear()}`;
    const sortKey = monday.toISOString().split('T')[0];
    return { sortKey, label };
  };

  // Helper para agrupar por mes
  const getMonthKey = (dateStr: string) => {
    const [year, month] = dateStr.split('-');
    const nombresMes = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const mIdx = parseInt(month, 10) - 1;
    const label = `${nombresMes[mIdx] || month} ${year}`;
    const sortKey = `${year}-${month}`;
    return { sortKey, label };
  };

  // Agrupación temporal: Por Día, Por Semana o Por Mes
  const datosAgrupados = useMemo(() => {
    const map = new Map<string, {
      clave: string;
      label: string;
      fechaSort: string;
      horas: number;
      extras: number;
      combustible: number;
      vales: number;
      maquinasIds: Set<string>;
      logs: DailyLog[];
    }>();

    logsFiltrados.forEach((log) => {
      let clave = log.date;
      let label = log.date;
      let fechaSort = log.date;

      if (agrupacion === 'dia') {
        clave = log.date;
        label = log.date;
        fechaSort = log.date;
      } else if (agrupacion === 'semana') {
        const wk = getWeekKey(log.date);
        clave = wk.sortKey;
        label = wk.label;
        fechaSort = wk.sortKey;
      } else if (agrupacion === 'mes') {
        const mk = getMonthKey(log.date);
        clave = mk.sortKey;
        label = mk.label;
        fechaSort = mk.sortKey;
      }

      if (!map.has(clave)) {
        map.set(clave, {
          clave,
          label,
          fechaSort,
          horas: 0,
          extras: 0,
          combustible: 0,
          vales: 0,
          maquinasIds: new Set(),
          logs: [],
        });
      }

      const item = map.get(clave)!;
      item.horas += log.hoursWorked || 0;
      item.extras += log.extraHours || 0;
      item.combustible += log.fuelLiters || 0;
      item.vales += 1;
      item.maquinasIds.add(log.machineId);
      item.logs.push(log);
    });

    const list = Array.from(map.values()).map((item) => ({
      ...item,
      rendimiento: item.horas > 0 ? item.combustible / item.horas : 0,
      totalMaquinas: item.maquinasIds.size,
    }));

    // Ordenar de más reciente a más antiguo
    return list.sort((a, b) => b.fechaSort.localeCompare(a.fechaSort));
  }, [logsFiltrados, agrupacion]);

  // Exportar a CSV (Excel)
  const exportarCSV = () => {
    if (datosAgrupados.length === 0) {
      alert('No hay datos en el período seleccionado para exportar.');
      return;
    }

    const encabezados = [
      'Periodo',
      'Horas Trabajadas',
      'Horas Extras',
      'Combustible (Litros)',
      'Rendimiento (L/h)',
      'Maquinas Activas',
      'Vales Registrados',
    ];

    const filas = datosAgrupados.map((d) => [
      `"${d.label}"`,
      d.horas.toFixed(1),
      d.extras.toFixed(1),
      d.combustible.toFixed(1),
      d.rendimiento.toFixed(2),
      d.totalMaquinas,
      d.vales,
    ]);

    // Fila de totales
    filas.push([
      '"TOTALES GENERALES"',
      kpis.totalHoras.toFixed(1),
      kpis.totalExtras.toFixed(1),
      kpis.totalCombustible.toFixed(1),
      kpis.rendimiento.toFixed(2),
      kpis.maquinasActivas,
      kpis.totalVales,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [encabezados.join(','), ...filas.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Reporte_Maquinaria_Bench_${agrupacion}_${fechaDesde}_al_${fechaHasta}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Imprimir reporte
  const imprimirReporte = () => {
    window.print();
  };

  const maquinaSeleccionadaObj = machines.find((m) => m.id === filtroMaquinaId);

  return (
    <div className="space-y-6 text-gray-900 print:text-black">
      {/* ======================================================================== */}
      {/* 1. CABECERA Y SELECTOR DE MÓDULOS DE REPORTES (PANTALLA) */}
      {/* ======================================================================== */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <span>📊</span> Centro de Reportes y Analítica
              </h2>
              <span className="bg-blue-100 text-blue-800 text-xs font-black px-2.5 py-0.5 rounded-full border border-blue-200">
                ERP Bench
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Consumos, rendimientos, horas trabajadas y auditoría de operaciones en tiempo real.
            </p>
          </div>

          {/* SELECTOR DE MÓDULO A AUDITAR */}
          <div className="flex flex-wrap items-center bg-gray-100 p-1.5 rounded-xl border border-gray-200 gap-1">
            <button
              type="button"
              onClick={() => setActiveReportModule('maquinaria')}
              className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                activeReportModule === 'maquinaria'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <span>🚜</span> Maquinaria ({machines.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveReportModule('obras')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeReportModule === 'obras'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <span>🏗️</span> Obras
            </button>
            <button
              type="button"
              onClick={() => setActiveReportModule('presupuestos')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeReportModule === 'presupuestos'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <span>📝</span> Presupuestos
            </button>
            <button
              type="button"
              onClick={() => setActiveReportModule('almacen')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeReportModule === 'almacen'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <span>📦</span> Almacén
            </button>
          </div>
        </div>

        {/* ACCIONES SUPERIORES: EXPORTAR E IMPRIMIR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Auditando:</span>
            <strong className="text-gray-800 uppercase font-black">
              {activeReportModule === 'maquinaria' && 'Control de Maquinaria Pesada'}
              {activeReportModule === 'obras' && 'Obras y Contratos'}
              {activeReportModule === 'presupuestos' && 'Cotizaciones y Presupuestos'}
              {activeReportModule === 'almacen' && 'Inventario y Compras'}
            </strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportarCSV}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3.5 rounded-lg text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer"
            >
              <span>📥</span> Exportar Excel (CSV)
            </button>
            <button
              type="button"
              onClick={imprimirReporte}
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold py-1.5 px-3.5 rounded-lg text-xs flex items-center gap-1.5 shadow transition-colors cursor-pointer"
            >
              <span>🖨️</span> Imprimir / Guardar PDF
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================================== */}
      {/* CABECERA EXCLUSIVA PARA IMPRESIÓN (MEMBRETE OFICIAL) */}
      {/* ======================================================================== */}
      <div className="hidden print:block border-b-2 border-gray-800 pb-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="Bench Ingeniería" className="h-14 object-contain" />
            <div>
              <h1 className="text-xl font-black uppercase tracking-wide text-gray-900">
                Ingeniería Bench S.A. de C.V.
              </h1>
              <p className="text-xs text-gray-600 font-semibold">
                ERP Ingeniería y Herrería • Reporte Oficial de Rendimiento y Maquinaria
              </p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-bold text-gray-800">Fecha de emisión: {new Date().toLocaleDateString('es-MX')}</p>
            <p className="text-gray-500">Período: {fechaDesde} al {fechaHasta}</p>
          </div>
        </div>
      </div>

      {/* INDICADOR DE CARGA */}
      {loading && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center flex items-center justify-center gap-3 print:hidden">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-gray-500">Cargando métricas y registros de la nube...</span>
        </div>
      )}

      {/* ======================================================================== */}
      {/* CONTENIDO PRINCIPAL: REPORTE DE CONTROL DE MAQUINARIA */}
      {/* ======================================================================== */}
      {activeReportModule === 'maquinaria' && (
        <div className="space-y-6">
          {/* BARRA DE FILTROS AVANZADOS (PANTALLA) */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4 print:hidden">
            {/* FILA 1: PRESETS DE TIEMPO Y AGRUPACIÓN */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-100 pb-3">
              {/* PRESETS DE PERÍODO */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-gray-600 mr-1">Período:</span>
                {(
                  [
                    { id: 'hoy', label: 'Hoy' },
                    { id: 'semana', label: 'Esta Semana' },
                    { id: 'mes', label: 'Este Mes' },
                    { id: 'ultimos30', label: 'Últimos 30 días' },
                    { id: 'historico', label: 'Histórico Completo' },
                    { id: 'personalizado', label: 'Personalizado' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => aplicarPreset(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      periodoPreset === p.id
                        ? 'bg-blue-600 text-white shadow'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* TOGGLE AGRUPACIÓN: DÍA, SEMANA, MES */}
              <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-xl text-white">
                <span className="text-[11px] font-bold px-2 text-gray-400">Ver por:</span>
                <button
                  type="button"
                  onClick={() => setAgrupacion('dia')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    agrupacion === 'dia'
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  📅 Día
                </button>
                <button
                  type="button"
                  onClick={() => setAgrupacion('semana')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    agrupacion === 'semana'
                      ? 'bg-amber-600 text-white shadow'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  📆 Semana
                </button>
                <button
                  type="button"
                  onClick={() => setAgrupacion('mes')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    agrupacion === 'mes'
                      ? 'bg-purple-600 text-white shadow'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  🗓️ Mes
                </button>
              </div>
            </div>

            {/* FILA 2: SELECTORES DE MÁQUINA, UBICACIÓN, OPERADOR Y FECHAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
              {/* FILTRO MÁQUINA */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Máquina</label>
                <select
                  value={filtroMaquinaId}
                  onChange={(e) => setFiltroMaquinaId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-bold focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">🚜 Todas las Máquinas ({machines.length})</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      Máquina {m.numero} - {m.marca} {m.modelo}
                    </option>
                  ))}
                </select>
              </div>

              {/* FILTRO UBICACIÓN / OBRA */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Ubicación / Obra</label>
                <select
                  value={filtroUbicacionId}
                  onChange={(e) => setFiltroUbicacionId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">📍 Todas las Ubicaciones ({locations.length})</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} {loc.city ? `(${loc.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* FILTRO OPERADOR */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Operador</label>
                <select
                  value={filtroOperadorId}
                  onChange={(e) => setFiltroOperadorId(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">👷 Todos los Operadores ({operators.length})</option>
                  {operators.map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* FECHA DESDE */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Fecha Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => {
                    setFechaDesde(e.target.value);
                    setPeriodoPreset('personalizado');
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* FECHA HASTA */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Fecha Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => {
                    setFechaHasta(e.target.value);
                    setPeriodoPreset('personalizado');
                  }}
                  className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 font-medium focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* TARJETAS EJECUTIVAS DE KPIS GLOBALES */}
          {/* ==================================================================== */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* HORAS TRABAJADAS TOTALES */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-1">
                <span>TOTAL HORAS TRABAJADAS</span>
                <span className="text-base">⚡</span>
              </div>
              <div className="text-2xl font-black text-blue-600 font-mono">
                {kpis.totalHoras.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-gray-500">hrs</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                En {kpis.totalVales} jornadas auditadas
              </p>
            </div>

            {/* HORAS EXTRAS A COBRAR */}
            <div className="bg-amber-50/70 p-4 rounded-2xl shadow-sm border border-amber-200">
              <div className="flex items-center justify-between text-amber-800 text-xs font-bold mb-1">
                <span>HORAS EXTRAS (COBRO)</span>
                <span className="text-base">⭐</span>
              </div>
              <div className="text-2xl font-black text-amber-600 font-mono">
                {kpis.totalExtras.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-amber-700">hrs</span>
              </div>
              <p className="text-[11px] text-amber-700/80 mt-1 font-medium">
                Extraordinarias a facturar
              </p>
            </div>

            {/* COMBUSTIBLE TOTAL CONSUMIDO */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-1">
                <span>CONSUMO TOTAL DIESEL</span>
                <span className="text-base">⛽</span>
              </div>
              <div className="text-2xl font-black text-emerald-600 font-mono">
                {kpis.totalCombustible.toFixed(1)}{' '}
                <span className="text-xs font-semibold text-gray-500">Litros</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Cargados en obra
              </p>
            </div>

            {/* RENDIMIENTO GLOBAL PROMEDIO */}
            <div className="bg-purple-50/70 p-4 rounded-2xl shadow-sm border border-purple-200">
              <div className="flex items-center justify-between text-purple-800 text-xs font-bold mb-1">
                <span>RENDIMIENTO GLOBAL</span>
                <span className="text-base">📈</span>
              </div>
              <div className="text-2xl font-black text-purple-700 font-mono">
                {kpis.rendimiento.toFixed(2)}{' '}
                <span className="text-xs font-semibold text-purple-600">L / h</span>
              </div>
              <p className="text-[11px] text-purple-700/80 mt-1 font-medium">
                {kpis.totalHoras > 0 ? `${kpis.totalCombustible.toFixed(1)} L ÷ ${kpis.totalHoras.toFixed(1)} hrs` : 'Sin horas registradas'}
              </p>
            </div>

            {/* MÁQUINAS EN OPERACIÓN */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between text-gray-500 text-xs font-bold mb-1">
                <span>MÁQUINAS ACTIVAS</span>
                <span className="text-base">🚜</span>
              </div>
              <div className="text-2xl font-black text-gray-900 font-mono">
                {kpis.maquinasActivas}{' '}
                <span className="text-xs font-semibold text-gray-500">de {machines.length}</span>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Con actividad en el período
              </p>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* TABLA COMPARATIVA: CONSUMO Y RENDIMIENTO POR MÁQUINA */}
          {/* ==================================================================== */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                  <span>🚜</span> Consumo y Rendimiento por Máquina
                </h3>
                <p className="text-xs text-gray-500">
                  Desglose de horas trabajadas, combustible cargado y eficiencia (Litros/Hora) de cada equipo.
                </p>
              </div>
              {maquinaSeleccionadaObj && (
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full border border-blue-200">
                  Filtro: Máquina {maquinaSeleccionadaObj.numero} ({maquinaSeleccionadaObj.marca} {maquinaSeleccionadaObj.modelo})
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                  <tr>
                    <th className="p-3.5">Máquina</th>
                    <th className="p-3.5">Tipo / Clasificación</th>
                    <th className="p-3.5">Alias / Serie</th>
                    <th className="p-3.5 text-right text-blue-700">Horas Totales</th>
                    <th className="p-3.5 text-right text-amber-700">Horas Extras</th>
                    <th className="p-3.5 text-right text-emerald-700">Combustible (L)</th>
                    <th className="p-3.5 text-right text-purple-700 font-black">Rendimiento (L/h)</th>
                    <th className="p-3.5 text-center">% Consumo</th>
                    <th className="p-3.5 text-center">Jornadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resumenPorMaquina.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-gray-400 italic">
                        No hay máquinas registradas en el catálogo.
                      </td>
                    </tr>
                  ) : (
                    resumenPorMaquina.map((item) => {
                      const m = item.machine;
                      return (
                        <tr key={m.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="p-3.5 font-bold text-gray-900 flex items-center gap-2">
                            <span className="bg-gray-900 text-white w-6 h-6 rounded-md flex items-center justify-center font-black text-[11px]">
                              {m.numero || '#'}
                            </span>
                            <span>{m.marca} {m.modelo}</span>
                            {m.anio > 0 && <span className="text-gray-400 font-normal">({m.anio})</span>}
                          </td>
                          <td className="p-3.5 text-gray-600">
                            <span className="bg-gray-100 px-2 py-0.5 rounded text-[10px] font-semibold text-gray-700">
                              {m.type || 'Maquinaria'}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-gray-600 font-medium">
                            {m.name || '-'}
                          </td>
                          <td className="p-3.5 text-right font-black text-blue-700 font-mono text-sm">
                            {item.horas.toFixed(1)} hrs
                          </td>
                          <td className="p-3.5 text-right font-black text-amber-700 font-mono">
                            {item.extras > 0 ? `${item.extras.toFixed(1)} hrs` : '-'}
                          </td>
                          <td className="p-3.5 text-right font-black text-emerald-700 font-mono text-sm">
                            {item.combustible.toFixed(1)} L
                          </td>
                          <td className="p-3.5 text-right font-black text-purple-700 font-mono text-sm">
                            {item.rendimiento > 0 ? `${item.rendimiento.toFixed(2)} L/h` : '0.00 L/h'}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-emerald-500 h-2 rounded-full"
                                  style={{ width: `${Math.min(100, item.pctCombustible)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono text-gray-600 w-10 text-right">
                                {item.pctCombustible.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-bold text-gray-700 font-mono">
                            {item.vales}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {/* FILA DE TOTALES */}
                <tfoot className="bg-gray-100/80 font-black text-xs text-gray-900 border-t-2 border-gray-300">
                  <tr>
                    <td className="p-3.5 uppercase" colSpan={3}>
                      TOTALES GENERALES ({machines.length} Máquinas)
                    </td>
                    <td className="p-3.5 text-right text-blue-800 font-mono text-sm">
                      {kpis.totalHoras.toFixed(1)} hrs
                    </td>
                    <td className="p-3.5 text-right text-amber-800 font-mono">
                      {kpis.totalExtras.toFixed(1)} hrs
                    </td>
                    <td className="p-3.5 text-right text-emerald-800 font-mono text-sm">
                      {kpis.totalCombustible.toFixed(1)} L
                    </td>
                    <td className="p-3.5 text-right text-purple-800 font-mono text-sm">
                      {kpis.rendimiento.toFixed(2)} L/h
                    </td>
                    <td className="p-3.5 text-center font-mono">100%</td>
                    <td className="p-3.5 text-center font-mono">{kpis.totalVales}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* TABLA PRINCIPAL AGRUPADA: POR DÍA, POR SEMANA O POR MES */}
          {/* ==================================================================== */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                  <span>📅</span> Consumo y Horas Agrupadas ({agrupacion === 'dia' ? 'Por Día' : agrupacion === 'semana' ? 'Por Semana' : 'Por Mes'})
                </h3>
                <p className="text-xs text-gray-500">
                  Agrupación cronológica del consumo total de diesel, horas laboradas y rendimiento en el tiempo.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                <span>Período:</span>
                <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-lg border border-gray-200 font-mono">
                  {fechaDesde} al {fechaHasta}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                  <tr>
                    <th className="p-3.5">
                      {agrupacion === 'dia' && 'Fecha'}
                      {agrupacion === 'semana' && 'Semana Calendario'}
                      {agrupacion === 'mes' && 'Mes / Año'}
                    </th>
                    <th className="p-3.5 text-center">Máquinas en Operación</th>
                    <th className="p-3.5 text-right text-blue-700">Horas Trabajadas</th>
                    <th className="p-3.5 text-right text-amber-700">Horas Extras</th>
                    <th className="p-3.5 text-right text-emerald-700">Combustible Cargado</th>
                    <th className="p-3.5 text-right text-purple-700 font-black">Rendimiento (L/h)</th>
                    <th className="p-3.5 text-center">No. de Vales</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {datosAgrupados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-gray-400 italic">
                        No se encontraron registros de maquinaria para los filtros y fechas seleccionadas.
                      </td>
                    </tr>
                  ) : (
                    datosAgrupados.map((item) => (
                      <tr key={item.clave} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3.5 font-bold text-gray-900 font-mono text-sm">
                          {item.label}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className="bg-gray-100 text-gray-800 font-bold px-2.5 py-0.5 rounded-full text-xs">
                            {item.totalMaquinas} {item.totalMaquinas === 1 ? 'máquina' : 'máquinas'}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-black text-blue-700 font-mono text-sm">
                          {item.horas.toFixed(1)} hrs
                        </td>
                        <td className="p-3.5 text-right font-black text-amber-700 font-mono">
                          {item.extras > 0 ? `${item.extras.toFixed(1)} hrs` : '-'}
                        </td>
                        <td className="p-3.5 text-right font-black text-emerald-700 font-mono text-sm">
                          {item.combustible.toFixed(1)} Litros
                        </td>
                        <td className="p-3.5 text-right font-black text-purple-700 font-mono text-sm">
                          {item.rendimiento > 0 ? `${item.rendimiento.toFixed(2)} L/h` : '0.00 L/h'}
                        </td>
                        <td className="p-3.5 text-center font-bold text-gray-700 font-mono">
                          {item.vales} vales
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {/* TOTALES AL PIE */}
                <tfoot className="bg-gray-100/90 font-black text-xs text-gray-900 border-t-2 border-gray-300">
                  <tr>
                    <td className="p-3.5 uppercase">
                      TOTAL DEL PERÍODO ({datosAgrupados.length} {agrupacion === 'dia' ? 'días' : agrupacion === 'semana' ? 'semanas' : 'meses'})
                    </td>
                    <td className="p-3.5 text-center font-mono">
                      {kpis.maquinasActivas} activas
                    </td>
                    <td className="p-3.5 text-right text-blue-800 font-mono text-sm">
                      {kpis.totalHoras.toFixed(1)} hrs
                    </td>
                    <td className="p-3.5 text-right text-amber-800 font-mono">
                      {kpis.totalExtras.toFixed(1)} hrs
                    </td>
                    <td className="p-3.5 text-right text-emerald-800 font-mono text-sm">
                      {kpis.totalCombustible.toFixed(1)} L
                    </td>
                    <td className="p-3.5 text-right text-purple-800 font-mono text-sm">
                      {kpis.rendimiento.toFixed(2)} L/h
                    </td>
                    <td className="p-3.5 text-center font-mono">
                      {kpis.totalVales} vales
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* BITÁCORA DETALLADA DE JORNADAS AUDITADAS (AUDITORÍA COMPLETA) */}
          {/* ==================================================================== */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-gray-900 flex items-center gap-2">
                  <span>📜</span> Desglose de Vales y Jornadas Individuales ({logsFiltrados.length})
                </h3>
                <p className="text-xs text-gray-500">
                  Lista detallada de registros diarios con horómetros, folios de vale para cobro y notas.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-600 font-bold uppercase tracking-wider text-[11px] border-b border-gray-200">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">No. Vale</th>
                    <th className="p-3 text-cyan-700">Ubicación / Obra</th>
                    <th className="p-3">Máquina</th>
                    <th className="p-3">Operador</th>
                    <th className="p-3 text-right">Horóm. Inicial</th>
                    <th className="p-3 text-right">Horóm. Final</th>
                    <th className="p-3 text-right text-blue-700 font-bold">Horas Tot.</th>
                    <th className="p-3 text-right text-amber-700 font-bold">H. Extras</th>
                    <th className="p-3 text-right text-emerald-700 font-bold">Diesel (L)</th>
                    <th className="p-3 text-right text-purple-700 font-bold">Rendimiento</th>
                    <th className="p-3 min-w-[200px]">Notas de Cobro (Facturación)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logsFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-8 text-center text-gray-400 italic">
                        No hay registros diarios guardados para estos filtros.
                      </td>
                    </tr>
                  ) : (
                    logsFiltrados.map((log) => {
                      const rendDia = log.hoursWorked > 0 ? (log.fuelLiters / log.hoursWorked).toFixed(2) : '-';
                      return (
                        <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="p-3 font-mono text-gray-800 font-semibold">{log.date}</td>
                          <td className="p-3 font-mono font-black text-gray-900">
                            {log.ticketNumber ? (
                              <span className="bg-gray-100 text-gray-900 px-2 py-0.5 rounded border border-gray-300 font-bold">
                                {log.ticketNumber}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic font-normal">Sin vale</span>
                            )}
                          </td>
                          <td className="p-3 font-semibold text-cyan-800">{log.locationName || '-'}</td>
                          <td className="p-3 font-bold text-gray-900">{log.machineName}</td>
                          <td className="p-3 text-gray-600">{log.operatorName || '-'}</td>
                          <td className="p-3 text-right font-mono text-gray-600">{log.initialHours.toFixed(1)}</td>
                          <td className="p-3 text-right font-mono font-bold text-gray-900">{log.finalHours.toFixed(1)}</td>
                          <td className="p-3 text-right font-mono font-black text-blue-700">
                            +{log.hoursWorked.toFixed(1)} hrs
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-amber-700">
                            {log.extraHours > 0 ? `${log.extraHours.toFixed(1)} hrs` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            {log.fuelLiters > 0 ? `${log.fuelLiters.toFixed(1)} L` : '-'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-purple-700">
                            {rendDia !== '-' ? `${rendDia} L/h` : '-'}
                          </td>
                          <td className="p-3 text-gray-700 whitespace-normal max-w-xs text-[11px] italic">
                            {log.billingNotes || '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* PIE DE FIRMAS PARA IMPRESIÓN */}
          <div className="hidden print:block pt-12 mt-8 border-t border-gray-400">
            <div className="grid grid-cols-3 gap-8 text-center text-xs">
              <div>
                <div className="border-t border-gray-800 pt-2 font-bold text-gray-900">
                  Supervisor de Maquinaria
                </div>
                <p className="text-[10px] text-gray-500">Control de Horómetros y Vales</p>
              </div>
              <div>
                <div className="border-t border-gray-800 pt-2 font-bold text-gray-900">
                  Residente de Obra
                </div>
                <p className="text-[10px] text-gray-500">Validación de Trabajos y Frentes</p>
              </div>
              <div>
                <div className="border-t border-gray-800 pt-2 font-bold text-gray-900">
                  Dirección General / Administración
                </div>
                <p className="text-[10px] text-gray-500">Ingeniería Bench S.A. de C.V.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* VISTAS FUTURAS: OBRAS, PRESUPUESTOS, ALMACÉN (PROXIMAMENTE) */}
      {/* ======================================================================== */}
      {activeReportModule !== 'maquinaria' && (
        <div className="bg-white p-12 rounded-2xl shadow-sm border border-gray-200 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto font-black">
            📊
          </div>
          <h3 className="text-xl font-bold text-gray-900">
            Reporte de {activeReportModule === 'obras' ? 'Obras y Contratos' : activeReportModule === 'presupuestos' ? 'Presupuestos' : 'Almacén e Inventario'}
          </h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
            Este submódulo de reportes se integrará a continuación. Actualmente puedes consultar todas las analíticas, consumos y rendimientos completos en la pestaña de <strong>Maquinaria</strong>.
          </p>
          <button
            type="button"
            onClick={() => setActiveReportModule('maquinaria')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors shadow"
          >
            Ver Reportes de Maquinaria
          </button>
        </div>
      )}
    </div>
  );
};

export default Reportes;
