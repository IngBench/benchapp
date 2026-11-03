import React, { useState, useEffect, useMemo } from 'react';

export interface Machine {
  id: string;
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

export interface DailyLog {
  id: string;
  date: string;
  machineId: string;
  machineName: string;
  operatorId?: string;
  operatorName?: string;
  ticketNumber?: string; // No. de Vale / Folio de Campo
  fuelLiters: number;
  initialHours: number;
  finalHours: number;
  hoursWorked: number; // Total horas = finalHours - initialHours
  extraHours: number; // Horas extraordinarias identificadas para cobro
  billingNotes: string;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  date: string;
  machineId: string;
  machineName: string;
  hoursAtService: number;
  description: string;
  createdAt: string;
}

const DEFAULT_MACHINES: Machine[] = [
  {
    id: 'retro-426f2',
    name: 'Retro 426F2',
    marca: 'Caterpillar',
    modelo: '426F2',
    anio: 2021,
    type: 'Retroexcavadora',
    currentHours: 1250.0,
  },
  {
    id: 'manipulador-dl1155',
    name: 'Manipulador DL1155',
    marca: 'Develon',
    modelo: 'DL1155',
    anio: 2020,
    type: 'Telehandler',
    currentHours: 840.0,
  },
  {
    id: 'minicargador',
    name: 'Minicargador S590',
    marca: 'Bobcat',
    modelo: 'S590',
    anio: 2022,
    type: 'Minicargador (Bobcat)',
    currentHours: 450.0,
  },
];

const DEFAULT_OPERATORS: Operator[] = [
  {
    id: 'op-1',
    name: 'Juan Carlos Ramírez Peña',
    age: 38,
    nss: '3498-82-4512-3',
    phone: '33 1234 5678',
  },
  {
    id: 'op-2',
    name: 'Roberto González Méndez',
    age: 45,
    nss: '2184-76-9021-1',
    phone: '33 9876 5432',
  },
  {
    id: 'op-3',
    name: 'Miguel Ángel Torres Ruiz',
    age: 29,
    nss: '5602-94-1189-0',
    phone: '33 5555 4321',
  },
];

const STORAGE_KEYS = {
  MACHINES: 'bench_machinery_machines',
  OPERATORS: 'bench_machinery_operators',
  DAILY_LOGS: 'bench_machinery_daily_logs',
  MAINTENANCE_LOGS: 'bench_machinery_maintenance_logs',
};

export const MachineryControl: React.FC = () => {
  // ============================================================================
  // 1. ESTADO DE MÁQUINAS (LOCALSTORAGE CON MIGRACIÓN)
  // ============================================================================
  const [machines, setMachines] = useState<Machine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MACHINES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((m: any, idx: number) => ({
            id: m.id || `mach-${Date.now()}-${idx}`,
            name: m.name || `${m.marca || ''} ${m.modelo || ''}`.trim() || 'Maquinaria',
            marca: m.marca || (m.name?.includes('Retro') ? 'Caterpillar' : m.name?.includes('Manipulador') ? 'Develon' : 'Bobcat'),
            modelo: m.modelo || (m.name?.includes('426F2') ? '426F2' : m.name?.includes('DL1155') ? 'DL1155' : 'S590'),
            anio: Number(m.anio || m.año) || 2021,
            type: m.type || 'Maquinaria Pesada',
            currentHours: Number(m.currentHours) || 0,
          }));
        }
      }
    } catch (e) {
      console.error('Error cargando máquinas:', e);
    }
    return DEFAULT_MACHINES;
  });

  // ============================================================================
  // 2. ESTADO DE OPERADORES (LOCALSTORAGE)
  // ============================================================================
  const [operators, setOperators] = useState<Operator[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.OPERATORS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error cargando operadores:', e);
    }
    return DEFAULT_OPERATORS;
  });

  // ============================================================================
  // 3. REGISTROS DIARIOS Y MANTENIMIENTOS
  // ============================================================================
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DAILY_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((log: any) => ({
            ...log,
            ticketNumber: log.ticketNumber || '',
            extraHours: Number(log.extraHours) || 0,
          }));
        }
      }
    } catch (e) {
      console.error('Error cargando registros diarios:', e);
    }
    return [];
  });

  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MAINTENANCE_LOGS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error cargando mantenimientos:', e);
    }
    return [];
  });

  // Persistir en LocalStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(machines));
  }, [machines]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OPERATORS, JSON.stringify(operators));
  }, [operators]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DAILY_LOGS, JSON.stringify(dailyLogs));
  }, [dailyLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_LOGS, JSON.stringify(maintenanceLogs));
  }, [maintenanceLogs]);

  // Pestaña activa del módulo
  const [activeTab, setActiveTab] = useState<'daily' | 'maintenance' | 'machines' | 'operators'>('daily');

  // Máquina seleccionada para el Dashboard
  const [dashboardMachineId, setDashboardMachineId] = useState<string>(
    machines[0]?.id || 'retro-426f2'
  );

  // Filtro para el historial
  const [filterMachineId, setFilterMachineId] = useState<string>('all');

  // ============================================================================
  // FORMULARIO: REGISTRO DIARIO
  // ============================================================================
  const todayStr = new Date().toISOString().split('T')[0];
  const [dailyMachineId, setDailyMachineId] = useState<string>(machines[0]?.id || '');
  const [dailyOperatorId, setDailyOperatorId] = useState<string>(operators[0]?.id || '');
  const [dailyDate, setDailyDate] = useState<string>(todayStr);
  const [ticketNumber, setTicketNumber] = useState<string>(''); // No. de Vale / Folio
  const [fuelLiters, setFuelLiters] = useState<string>('');
  const [finalHours, setFinalHours] = useState<string>('');
  const [extraHours, setExtraHours] = useState<string>(''); // Horas Extras
  const [billingNotes, setBillingNotes] = useState<string>('');
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailySuccess, setDailySuccess] = useState<string | null>(null);

  // Máquina y operador activos
  const activeDailyMachine = machines.find((m) => m.id === dailyMachineId) || machines[0];
  const activeDailyOperator = operators.find((op) => op.id === dailyOperatorId);
  const initialHours = activeDailyMachine ? activeDailyMachine.currentHours : 0;

  // Cálculo en tiempo real de horas trabajadas
  const parsedFinalHours = parseFloat(finalHours);
  const calculatedHoursWorked =
    !isNaN(parsedFinalHours) && parsedFinalHours >= initialHours
      ? parsedFinalHours - initialHours
      : null;

  const handleSaveDailyLog = (e: React.FormEvent) => {
    e.preventDefault();
    setDailyError(null);
    setDailySuccess(null);

    if (!activeDailyMachine) {
      setDailyError('Por favor selecciona una máquina válida.');
      return;
    }

    if (isNaN(parsedFinalHours)) {
      setDailyError('Ingresa un horómetro final válido.');
      return;
    }

    if (parsedFinalHours < initialHours) {
      setDailyError(
        `El horómetro final (${parsedFinalHours} hrs) no puede ser menor al horómetro inicial (${initialHours} hrs).`
      );
      return;
    }

    const liters = parseFloat(fuelLiters) || 0;
    if (liters < 0) {
      setDailyError('El combustible no puede ser negativo.');
      return;
    }

    const extras = parseFloat(extraHours) || 0;
    if (extras < 0) {
      setDailyError('Las horas extras no pueden ser un valor negativo.');
      return;
    }

    const hoursWorked = parsedFinalHours - initialHours;

    const newLog: DailyLog = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      date: dailyDate,
      machineId: activeDailyMachine.id,
      machineName: `${activeDailyMachine.marca} ${activeDailyMachine.modelo} (${activeDailyMachine.name})`,
      operatorId: activeDailyOperator?.id || '',
      operatorName: activeDailyOperator ? activeDailyOperator.name : 'Sin asignar',
      ticketNumber: ticketNumber.trim(),
      fuelLiters: liters,
      initialHours: initialHours,
      finalHours: parsedFinalHours,
      hoursWorked: hoursWorked,
      extraHours: extras,
      billingNotes: billingNotes.trim(),
      createdAt: new Date().toISOString(),
    };

    setDailyLogs((prev) => [newLog, ...prev]);

    // Actualizar el horómetro actual de la máquina
    setMachines((prev) =>
      prev.map((m) => (m.id === activeDailyMachine.id ? { ...m, currentHours: parsedFinalHours } : m))
    );

    setTicketNumber('');
    setFuelLiters('');
    setFinalHours('');
    setExtraHours('');
    setBillingNotes('');
    setDailySuccess(
      `Registro guardado. ${activeDailyMachine.marca} ${activeDailyMachine.modelo}: Horómetro final ${parsedFinalHours.toFixed(1)} hrs (${hoursWorked.toFixed(1)} hrs trab.${extras > 0 ? `, ${extras.toFixed(1)} hrs extra` : ''}).`
    );
    setTimeout(() => setDailySuccess(null), 5000);
  };

  // ============================================================================
  // FORMULARIO: REGISTRO DE MANTENIMIENTO
  // ============================================================================
  const [maintMachineId, setMaintMachineId] = useState<string>(machines[0]?.id || '');
  const [maintDate, setMaintDate] = useState<string>(todayStr);
  const activeMaintMachine = machines.find((m) => m.id === maintMachineId) || machines[0];
  const [maintHours, setMaintHours] = useState<string>(
    activeMaintMachine ? activeMaintMachine.currentHours.toString() : ''
  );
  const [maintDescription, setMaintDescription] = useState<string>('');
  const [maintError, setMaintError] = useState<string | null>(null);
  const [maintSuccess, setMaintSuccess] = useState<string | null>(null);

  const handleMaintMachineChange = (machId: string) => {
    setMaintMachineId(machId);
    const mach = machines.find((m) => m.id === machId);
    if (mach) setMaintHours(mach.currentHours.toString());
  };

  const handleSaveMaintenance = (e: React.FormEvent) => {
    e.preventDefault();
    setMaintError(null);
    setMaintSuccess(null);

    if (!activeMaintMachine) {
      setMaintError('Selecciona una máquina válida.');
      return;
    }

    const hoursVal = parseFloat(maintHours);
    if (isNaN(hoursVal) || hoursVal < 0) {
      setMaintError('Ingresa un horómetro válido al momento del servicio.');
      return;
    }

    if (!maintDescription.trim()) {
      setMaintError('Ingresa la descripción detallada del servicio o mantenimiento.');
      return;
    }

    const newMaint: MaintenanceLog = {
      id: 'maint-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      date: maintDate,
      machineId: activeMaintMachine.id,
      machineName: `${activeMaintMachine.marca} ${activeMaintMachine.modelo}`,
      hoursAtService: hoursVal,
      description: maintDescription.trim(),
      createdAt: new Date().toISOString(),
    };

    setMaintenanceLogs((prev) => [newMaint, ...prev]);
    setMaintDescription('');
    setMaintSuccess(`Servicio registrado para ${activeMaintMachine.marca} ${activeMaintMachine.modelo}.`);
    setTimeout(() => setMaintSuccess(null), 5000);
  };

  // ============================================================================
  // GESTIÓN / CRUD DE MÁQUINAS (MARCA, MODELO, AÑO)
  // ============================================================================
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [machineForm, setMachineForm] = useState({
    name: '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    type: 'Maquinaria Pesada',
    currentHours: 0,
  });

  const handleOpenAddMachine = () => {
    setEditingMachineId(null);
    setMachineForm({
      name: '',
      marca: '',
      modelo: '',
      anio: new Date().getFullYear(),
      type: 'Retroexcavadora',
      currentHours: 0,
    });
    setIsAddingMachine(true);
  };

  const handleOpenEditMachine = (m: Machine) => {
    setEditingMachineId(m.id);
    setMachineForm({
      name: m.name,
      marca: m.marca,
      modelo: m.modelo,
      anio: m.anio,
      type: m.type,
      currentHours: m.currentHours,
    });
    setIsAddingMachine(true);
  };

  const handleSaveMachine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineForm.marca.trim() || !machineForm.modelo.trim()) {
      alert('Por favor especifica la marca y el modelo de la máquina.');
      return;
    }

    const displayName = machineForm.name.trim() || `${machineForm.marca} ${machineForm.modelo}`;

    if (editingMachineId) {
      setMachines((prev) =>
        prev.map((m) =>
          m.id === editingMachineId
            ? {
                ...m,
                name: displayName,
                marca: machineForm.marca.trim(),
                modelo: machineForm.modelo.trim(),
                anio: Number(machineForm.anio) || new Date().getFullYear(),
                type: machineForm.type.trim() || 'Maquinaria Pesada',
                currentHours: Number(machineForm.currentHours) || 0,
              }
            : m
        )
      );
    } else {
      const newMach: Machine = {
        id: 'mach-' + Date.now(),
        name: displayName,
        marca: machineForm.marca.trim(),
        modelo: machineForm.modelo.trim(),
        anio: Number(machineForm.anio) || new Date().getFullYear(),
        type: machineForm.type.trim() || 'Maquinaria Pesada',
        currentHours: Number(machineForm.currentHours) || 0,
      };
      setMachines((prev) => [...prev, newMach]);
    }

    setIsAddingMachine(false);
    setEditingMachineId(null);
  };

  const handleDeleteMachine = (id: string, label: string) => {
    if (machines.length <= 1) {
      alert('Debe existir al menos una máquina en el catálogo.');
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar la máquina "${label}" del catálogo?`)) {
      setMachines((prev) => prev.filter((m) => m.id !== id));
      if (dashboardMachineId === id) {
        setDashboardMachineId(machines.find((m) => m.id !== id)?.id || '');
      }
    }
  };

  // ============================================================================
  // GESTIÓN / CRUD DE OPERADORES (NOMBRE, EDAD, NSS, TELÉFONO)
  // ============================================================================
  const [isAddingOperator, setIsAddingOperator] = useState(false);
  const [editingOperatorId, setEditingOperatorId] = useState<string | null>(null);
  const [operatorForm, setOperatorForm] = useState({
    name: '',
    age: 30,
    nss: '',
    phone: '',
  });

  const handleOpenAddOperator = () => {
    setEditingOperatorId(null);
    setOperatorForm({
      name: '',
      age: 30,
      nss: '',
      phone: '',
    });
    setIsAddingOperator(true);
  };

  const handleOpenEditOperator = (op: Operator) => {
    setEditingOperatorId(op.id);
    setOperatorForm({
      name: op.name,
      age: op.age,
      nss: op.nss,
      phone: op.phone,
    });
    setIsAddingOperator(true);
  };

  const handleSaveOperator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorForm.name.trim() || !operatorForm.nss.trim()) {
      alert('Por favor ingresa el nombre y el NSS del operador.');
      return;
    }

    if (editingOperatorId) {
      setOperators((prev) =>
        prev.map((op) =>
          op.id === editingOperatorId
            ? {
                ...op,
                name: operatorForm.name.trim(),
                age: Number(operatorForm.age) || 18,
                nss: operatorForm.nss.trim(),
                phone: operatorForm.phone.trim(),
              }
            : op
        )
      );
    } else {
      const newOp: Operator = {
        id: 'op-' + Date.now(),
        name: operatorForm.name.trim(),
        age: Number(operatorForm.age) || 18,
        nss: operatorForm.nss.trim(),
        phone: operatorForm.phone.trim(),
      };
      setOperators((prev) => [...prev, newOp]);
    }

    setIsAddingOperator(false);
    setEditingOperatorId(null);
  };

  const handleDeleteOperator = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de eliminar al operador "${name}"?`)) {
      setOperators((prev) => prev.filter((op) => op.id !== id));
    }
  };

  const handleDeleteDailyLog = (id: string) => {
    if (window.confirm('¿Deseas eliminar este registro de operación diaria?')) {
      setDailyLogs((prev) => prev.filter((log) => log.id !== id));
    }
  };

  const handleDeleteMaintLog = (id: string) => {
    if (window.confirm('¿Deseas eliminar este registro de mantenimiento?')) {
      setMaintenanceLogs((prev) => prev.filter((m) => m.id !== id));
    }
  };

  // ============================================================================
  // DASHBOARD DE RENDIMIENTO
  // ============================================================================
  const selectedDashMachine = machines.find((m) => m.id === dashboardMachineId) || machines[0];

  const dashStats = useMemo(() => {
    if (!selectedDashMachine) {
      return { totalHours: 0, totalExtraHours: 0, totalFuel: 0, litersPerHour: 0, totalLogs: 0, totalServices: 0 };
    }

    const machineLogs = dailyLogs.filter((log) => log.machineId === selectedDashMachine.id);
    const totalHours = machineLogs.reduce((acc, log) => acc + (log.hoursWorked || 0), 0);
    const totalExtraHours = machineLogs.reduce((acc, log) => acc + (log.extraHours || 0), 0);
    const totalFuel = machineLogs.reduce((acc, log) => acc + (log.fuelLiters || 0), 0);
    const litersPerHour = totalHours > 0 ? totalFuel / totalHours : 0;
    const servicesCount = maintenanceLogs.filter((m) => m.machineId === selectedDashMachine.id).length;

    return {
      totalHours,
      totalExtraHours,
      totalFuel,
      litersPerHour,
      totalLogs: machineLogs.length,
      totalServices: servicesCount,
    };
  }, [selectedDashMachine, dailyLogs, maintenanceLogs]);

  // Historial ordenado
  const filteredDailyLogs = useMemo(() => {
    let logs = [...dailyLogs];
    if (filterMachineId !== 'all') {
      logs = logs.filter((log) => log.machineId === filterMachineId);
    }
    return logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [dailyLogs, filterMachineId]);

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-700 space-y-6 text-white">
      {/* ENCABEZADO Y PESTAÑAS */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-700 pb-4">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2 text-white">
            <span>🚜</span> Control y Rendimiento de Maquinaria Pesada
          </h3>
          <p className="text-sm text-gray-400 mt-1">
            Gestión de catálogos de máquinas, operadores, horómetros diarios, horas extras, vales de campo y mantenimientos.
          </p>
        </div>

        {/* SELECTOR DE PESTAÑAS */}
        <div className="flex flex-wrap bg-gray-900 p-1 rounded-lg border border-gray-700 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`px-3 py-2 rounded-md text-xs font-bold transition-all ${
              activeTab === 'daily'
                ? 'bg-blue-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            📋 Registro Diario
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('maintenance')}
            className={`px-3 py-2 rounded-md text-xs font-bold transition-all ${
              activeTab === 'maintenance'
                ? 'bg-amber-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            🔧 Mantenimiento
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('machines')}
            className={`px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'machines'
                ? 'bg-red-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span>🚜</span> Base Máquinas ({machines.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('operators')}
            className={`px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'operators'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span>👷</span> Base Operadores ({operators.length})
          </button>
        </div>
      </div>

      {/* ======================================================================== */}
      {/* PESTAÑA: BASE DE DATOS DE MÁQUINAS (MARCA, MODELO, AÑO) */}
      {/* ======================================================================== */}
      {activeTab === 'machines' && (
        <div className="bg-gray-900/80 p-5 rounded-lg border border-gray-700 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 pb-3">
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🚜</span> Base de Datos de Maquinaria
              </h4>
              <p className="text-xs text-gray-400">
                Catálogo de máquinas disponibles. Registra marca, modelo, año y horómetro inicial.
              </p>
            </div>
            {!isAddingMachine && (
              <button
                type="button"
                onClick={handleOpenAddMachine}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors flex items-center gap-2 shadow"
              >
                <span>+</span> Dar de Alta Máquina
              </button>
            )}
          </div>

          {/* FORMULARIO DE ALTA / EDICIÓN DE MÁQUINA */}
          {isAddingMachine && (
            <form onSubmit={handleSaveMachine} className="bg-gray-800 p-4 rounded-lg border border-red-500/40 space-y-4">
              <h5 className="text-sm font-bold text-white border-b border-gray-700 pb-2">
                {editingMachineId ? '✏️ Editar Datos de la Máquina' : '➕ Dar de Alta Nueva Máquina'}
              </h5>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Marca <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Caterpillar, Bobcat, JCB"
                    value={machineForm.marca}
                    onChange={(e) => setMachineForm({ ...machineForm, marca: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Modelo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 426F2, DL1155, S590"
                    value={machineForm.modelo}
                    onChange={(e) => setMachineForm({ ...machineForm, modelo: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Año <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1980"
                    max="2035"
                    required
                    placeholder="2022"
                    value={machineForm.anio}
                    onChange={(e) => setMachineForm({ ...machineForm, anio: Number(e.target.value) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">Tipo de Máquina</label>
                  <input
                    type="text"
                    placeholder="Ej. Retroexcavadora, Telehandler"
                    value={machineForm.type}
                    onChange={(e) => setMachineForm({ ...machineForm, type: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">Identificador / Alias</label>
                  <input
                    type="text"
                    placeholder="Ej. Retro 426F2"
                    value={machineForm.name}
                    onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-300 mb-1">Horómetro Actual (hrs)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={machineForm.currentHours}
                    onChange={(e) => setMachineForm({ ...machineForm, currentHours: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-700 border border-amber-600/60 rounded p-2 text-amber-300 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingMachine(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-4 rounded text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-5 rounded text-xs shadow"
                >
                  {editingMachineId ? 'Actualizar Máquina' : 'Guardar en Catálogo'}
                </button>
              </div>
            </form>
          )}

          {/* TABLA DE MÁQUINAS */}
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900 text-gray-300 uppercase tracking-wider text-[11px] border-b border-gray-700">
                <tr>
                  <th className="p-3">Marca</th>
                  <th className="p-3">Modelo</th>
                  <th className="p-3 text-center">Año</th>
                  <th className="p-3">Tipo / Clasificación</th>
                  <th className="p-3">Alias / Identificador</th>
                  <th className="p-3 text-right text-amber-300">Horómetro Actual</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/60 bg-gray-800/60">
                {machines.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-700/40">
                    <td className="p-3 font-bold text-white uppercase">{m.marca}</td>
                    <td className="p-3 font-black text-amber-300 font-mono text-sm">{m.modelo}</td>
                    <td className="p-3 text-center font-semibold text-gray-300">{m.anio}</td>
                    <td className="p-3 text-gray-300">
                      <span className="bg-gray-700 px-2 py-0.5 rounded text-[11px] font-medium text-gray-200">
                        {m.type}
                      </span>
                    </td>
                    <td className="p-3 text-gray-400">{m.name}</td>
                    <td className="p-3 text-right font-black text-amber-400 font-mono text-sm">
                      {m.currentHours.toFixed(1)} hrs
                    </td>
                    <td className="p-3 text-center space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEditMachine(m)}
                        className="bg-blue-900/60 hover:bg-blue-700 text-blue-200 px-2.5 py-1 rounded font-bold text-[11px] border border-blue-700/50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMachine(m.id, `${m.marca} ${m.modelo}`)}
                        className="bg-red-900/40 hover:bg-red-700 text-red-300 px-2.5 py-1 rounded font-bold text-[11px] border border-red-700/50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* PESTAÑA: BASE DE DATOS DE OPERADORES (NOMBRE, EDAD, NSS, TELÉFONO) */}
      {/* ======================================================================== */}
      {activeTab === 'operators' && (
        <div className="bg-gray-900/80 p-5 rounded-lg border border-gray-700 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 pb-3">
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👷</span> Base de Datos de Operadores
              </h4>
              <p className="text-xs text-gray-400">
                Padrón de operadores autorizados para maquinaria pesada con su registro de NSS y contacto.
              </p>
            </div>
            {!isAddingOperator && (
              <button
                type="button"
                onClick={handleOpenAddOperator}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors flex items-center gap-2 shadow"
              >
                <span>+</span> Dar de Alta Operador
              </button>
            )}
          </div>

          {/* FORMULARIO DE ALTA / EDICIÓN DE OPERADOR */}
          {isAddingOperator && (
            <form onSubmit={handleSaveOperator} className="bg-gray-800 p-4 rounded-lg border border-emerald-500/40 space-y-4">
              <h5 className="text-sm font-bold text-white border-b border-gray-700 pb-2">
                {editingOperatorId ? '✏️ Editar Datos del Operador' : '➕ Dar de Alta Nuevo Operador'}
              </h5>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Nombre Completo <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Juan Carlos Ramírez Peña"
                    value={operatorForm.name}
                    onChange={(e) => setOperatorForm({ ...operatorForm, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Edad <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="18"
                    max="90"
                    required
                    placeholder="35"
                    value={operatorForm.age}
                    onChange={(e) => setOperatorForm({ ...operatorForm, age: Number(e.target.value) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    NSS (Número de Seguro Social) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 3498-82-4512-3"
                    value={operatorForm.nss}
                    onChange={(e) => setOperatorForm({ ...operatorForm, nss: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Teléfono de Contacto <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 33 1234 5678"
                    value={operatorForm.phone}
                    onChange={(e) => setOperatorForm({ ...operatorForm, phone: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingOperator(false)}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-4 rounded text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-5 rounded text-xs shadow"
                >
                  {editingOperatorId ? 'Actualizar Operador' : 'Guardar Operador'}
                </button>
              </div>
            </form>
          )}

          {/* TABLA DE OPERADORES */}
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900 text-gray-300 uppercase tracking-wider text-[11px] border-b border-gray-700">
                <tr>
                  <th className="p-3">Nombre del Operador</th>
                  <th className="p-3 text-center">Edad</th>
                  <th className="p-3 font-mono">NSS (Seguro Social)</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/60 bg-gray-800/60">
                {operators.map((op) => (
                  <tr key={op.id} className="hover:bg-gray-700/40">
                    <td className="p-3 font-bold text-white flex items-center gap-2">
                      <span className="text-base">👷</span>
                      <span>{op.name}</span>
                    </td>
                    <td className="p-3 text-center font-semibold text-gray-300">{op.age} años</td>
                    <td className="p-3 font-mono font-bold text-emerald-400">{op.nss}</td>
                    <td className="p-3 text-gray-300">{op.phone}</td>
                    <td className="p-3 text-center space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleOpenEditOperator(op)}
                        className="bg-blue-900/60 hover:bg-blue-700 text-blue-200 px-2.5 py-1 rounded font-bold text-[11px] border border-blue-700/50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOperator(op.id, op.name)}
                        className="bg-red-900/40 hover:bg-red-700 text-red-300 px-2.5 py-1 rounded font-bold text-[11px] border border-red-700/50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* DASHBOARD DE RENDIMIENTO (VISIBLE EN TODAS LAS PESTAÑAS) */}
      {/* ======================================================================== */}
      <div className="bg-gray-900/80 p-5 rounded-lg border border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div>
              <h4 className="text-base font-bold text-white uppercase tracking-wider">
                Dashboard de Rendimiento
              </h4>
              <p className="text-xs text-gray-400">
                Selecciona una máquina para auditar su rendimiento histórico, horas acumuladas y horas extras.
              </p>
            </div>
          </div>

          {/* BOTONES SELECTORES DE MÁQUINA */}
          <div className="flex flex-wrap gap-2">
            {machines.map((mach) => {
              const isSelected = mach.id === dashboardMachineId;
              return (
                <button
                  key={mach.id}
                  type="button"
                  onClick={() => setDashboardMachineId(mach.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-red-600 border-red-500 text-white shadow-lg'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span>{mach.marca} {mach.modelo}</span>
                  <span className="text-[10px] bg-black/30 px-1.5 py-0.5 rounded text-gray-200 font-mono">
                    {mach.currentHours.toFixed(1)} hrs
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* TARJETAS DE ESTADÍSTICAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Horómetro Actual */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-sm">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-1">
              <span>HORÓMETRO ACTUAL</span>
              <span className="text-base">⏱️</span>
            </div>
            <div className="text-2xl font-black text-amber-400 font-mono">
              {selectedDashMachine?.currentHours.toFixed(1)}{' '}
              <span className="text-xs font-normal text-gray-400">hrs</span>
            </div>
            <span className="text-[11px] text-gray-400 block mt-1">
              {selectedDashMachine?.marca} {selectedDashMachine?.modelo} ({selectedDashMachine?.anio})
            </span>
          </div>

          {/* Total Horas Trabajadas */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-sm">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-1">
              <span>HORAS TRABAJADAS</span>
              <span className="text-base">⚡</span>
            </div>
            <div className="text-2xl font-black text-blue-400 font-mono">
              {dashStats.totalHours.toFixed(1)}{' '}
              <span className="text-xs font-normal text-gray-400">hrs</span>
            </div>
            <span className="text-[11px] text-gray-400 block mt-1">
              En {dashStats.totalLogs} jornadas registradas
            </span>
          </div>

          {/* Total Horas Extras */}
          <div className="bg-gray-800 p-4 rounded-lg border border-amber-600/50 bg-gradient-to-br from-gray-800 to-amber-950/30 shadow-sm">
            <div className="flex items-center justify-between text-amber-300 text-xs font-bold mb-1">
              <span>HORAS EXTRAS</span>
              <span className="text-base">⭐</span>
            </div>
            <div className="text-2xl font-black text-amber-300 font-mono">
              {dashStats.totalExtraHours.toFixed(1)}{' '}
              <span className="text-xs font-normal text-amber-400">hrs</span>
            </div>
            <span className="text-[11px] text-amber-200/80 block mt-1">
              Extraordinarias a cobrar
            </span>
          </div>

          {/* Total Litros Consumidos */}
          <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 shadow-sm">
            <div className="flex items-center justify-between text-gray-400 text-xs font-semibold mb-1">
              <span>COMBUSTIBLE TOTAL</span>
              <span className="text-base">⛽</span>
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono">
              {dashStats.totalFuel.toFixed(1)}{' '}
              <span className="text-xs font-normal text-gray-400">Litros</span>
            </div>
            <span className="text-[11px] text-gray-400 block mt-1">Diesel cargado en obra</span>
          </div>

          {/* Rendimiento Litros / Hora */}
          <div className="bg-gray-800 p-4 rounded-lg border border-indigo-500/40 bg-gradient-to-br from-gray-800 to-indigo-950/40 shadow-sm">
            <div className="flex items-center justify-between text-indigo-300 text-xs font-bold mb-1">
              <span>RENDIMIENTO PROMEDIO</span>
              <span className="text-base">📈</span>
            </div>
            <div className="text-2xl font-black text-white flex items-baseline gap-1 font-mono">
              <span>{dashStats.litersPerHour.toFixed(2)}</span>
              <span className="text-xs font-semibold text-indigo-300">L / h</span>
            </div>
            <span className="text-[11px] text-indigo-200 block mt-1">
              {dashStats.totalHours > 0
                ? `${dashStats.totalFuel.toFixed(1)} L ÷ ${dashStats.totalHours.toFixed(1)} hrs`
                : 'Sin horas suficientes'}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================================== */}
      {/* FORMULARIO: REGISTRO DIARIO (SI TAB ES DAILY) */}
      {/* ======================================================================== */}
      {activeTab === 'daily' && (
        <form
          onSubmit={handleSaveDailyLog}
          className="bg-gray-900/60 p-5 rounded-lg border border-gray-700 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-gray-700 pb-2">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <span>📋</span> Nuevo Registro Diario de Operación
            </h4>
            <span className="text-xs text-gray-400">
              Registra los horómetros, horas extraordinarias y número de vale para cobro.
            </span>
          </div>

          {dailyError && (
            <div className="p-3 bg-red-950/70 border border-red-600/70 text-red-200 rounded-lg text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{dailyError}</span>
            </div>
          )}

          {dailySuccess && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-600/70 text-emerald-200 rounded-lg text-xs font-bold flex items-center gap-2">
              <span>✅</span>
              <span>{dailySuccess}</span>
            </div>
          )}

          {/* FILA 1: FECHA, NO. DE VALE, MÁQUINA, OPERADOR */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* FECHA */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Fecha <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* NO. DE VALE / FOLIO DE CAMPO */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center gap-1">
                <span>📄</span> No. de Vale / Folio de Campo
              </label>
              <input
                type="text"
                placeholder="Ej. V-1045, Folio 892"
                value={ticketNumber}
                onChange={(e) => setTicketNumber(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white font-mono uppercase focus:ring-red-500 focus:border-red-500"
              />
            </div>

            {/* MÁQUINA */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Máquina <span className="text-red-400">*</span>
              </label>
              <select
                value={dailyMachineId}
                onChange={(e) => {
                  setDailyMachineId(e.target.value);
                  setFinalHours('');
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-red-500 focus:border-red-500 font-semibold"
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.marca} {m.modelo} ({m.anio})
                  </option>
                ))}
              </select>
            </div>

            {/* OPERADOR */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Operador Responsable
              </label>
              <select
                value={dailyOperatorId}
                onChange={(e) => setDailyOperatorId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-red-500 focus:border-red-500"
              >
                <option value="">-- Sin asignar --</option>
                {operators.map((op) => (
                  <option key={op.id} value={op.id}>
                    {op.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* FILA 2: COMBUSTIBLE, HORÓMETRO INICIAL, HORÓMETRO FINAL, HORAS EXTRAS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* COMBUSTIBLE CARGADO */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Combustible (Litros)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="0.0"
                value={fuelLiters}
                onChange={(e) => setFuelLiters(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-red-500 focus:border-red-500 font-mono"
              />
            </div>

            {/* HORÓMETRO INICIAL (BLOQUEADO) */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center justify-between">
                <span>Horóm. Inicial</span>
                <span className="text-[10px] text-amber-400">🔒 Bloqueado</span>
              </label>
              <input
                type="number"
                readOnly
                disabled
                value={initialHours.toFixed(1)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-sm text-amber-300 font-black cursor-not-allowed select-none font-mono"
                title="Autocompletado con el último registro de la máquina"
              />
            </div>

            {/* HORÓMETRO FINAL */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1 flex items-center justify-between">
                <span>Horóm. Final <span className="text-red-400">*</span></span>
                {calculatedHoursWorked !== null && (
                  <span className="text-[10px] text-cyan-300 font-bold font-mono">
                    +{calculatedHoursWorked.toFixed(1)} hrs tot.
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.1"
                min={initialHours}
                required
                placeholder={initialHours.toFixed(1)}
                value={finalHours}
                onChange={(e) => setFinalHours(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white font-bold focus:ring-red-500 focus:border-red-500 font-mono"
              />
            </div>

            {/* HORAS EXTRAS (DESTACADAS PARA IDENTIFICACIÓN Y COBRO) */}
            <div>
              <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">⭐ Horas Extras (Cobro)</span>
                {calculatedHoursWorked !== null && parseFloat(extraHours) > 0 && (
                  <span className="text-[10px] text-amber-300 font-bold font-mono">
                    de {calculatedHoursWorked.toFixed(1)} hrs
                  </span>
                )}
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="0.0"
                value={extraHours}
                onChange={(e) => setExtraHours(e.target.value)}
                className="w-full bg-gray-700 border-2 border-amber-500/80 rounded-lg p-2.5 text-sm text-amber-200 font-black focus:ring-amber-500 focus:border-amber-400 font-mono shadow-inner"
              />
            </div>
          </div>

          {/* NOTAS DE COBRO */}
          <div>
            <label className="block text-xs font-bold text-amber-300 mb-1 flex items-center gap-1.5">
              <span>💰</span> Notas de Cobro y Facturación (Horas extra, descansos con el operador, zanjas, atrasos)
            </label>
            <textarea
              rows={2}
              value={billingNotes}
              onChange={(e) => setBillingNotes(e.target.value)}
              placeholder="Ej. 2 horas extras trabajadas fuera de horario de obra según vale V-1045. Operador descansó 1 hr por falta de trazo..."
              className="w-full bg-gray-700 border border-amber-600/50 rounded-lg p-2.5 text-sm text-white placeholder-gray-400 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          {/* BOTÓN GUARDAR */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-gray-400">
              Al guardar, se actualizará el horómetro actual de{' '}
              <strong className="text-white">{activeDailyMachine?.marca} {activeDailyMachine?.modelo}</strong>.
            </span>
            <button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg"
            >
              <span>💾</span> Guardar Registro Diario
            </button>
          </div>
        </form>
      )}

      {/* ======================================================================== */}
      {/* FORMULARIO: REGISTRO DE MANTENIMIENTO (SI TAB ES MAINTENANCE) */}
      {/* ======================================================================== */}
      {activeTab === 'maintenance' && (
        <form
          onSubmit={handleSaveMaintenance}
          className="bg-gray-900/60 p-5 rounded-lg border border-gray-700 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-gray-700 pb-2">
            <h4 className="text-base font-bold text-amber-300 flex items-center gap-2">
              <span>🔧</span> Registrar Servicio o Mantenimiento
            </h4>
            <span className="text-xs text-gray-400">
              Historial de cambios de aceite, filtros y servicios mecánicos.
            </span>
          </div>

          {maintError && (
            <div className="p-3 bg-red-950/70 border border-red-600/70 text-red-200 rounded-lg text-xs font-bold flex items-center gap-2">
              <span>⚠️</span>
              <span>{maintError}</span>
            </div>
          )}

          {maintSuccess && (
            <div className="p-3 bg-emerald-950/70 border border-emerald-600/70 text-emerald-200 rounded-lg text-xs font-bold flex items-center gap-2">
              <span>✅</span>
              <span>{maintSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Fecha del Servicio <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                required
                value={maintDate}
                onChange={(e) => setMaintDate(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-amber-500 focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Máquina <span className="text-red-400">*</span>
              </label>
              <select
                value={maintMachineId}
                onChange={(e) => handleMaintMachineChange(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white focus:ring-amber-500 focus:border-amber-500 font-semibold"
              >
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.marca} {m.modelo} ({m.anio})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Horómetro al Servicio (hrs) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                required
                value={maintHours}
                onChange={(e) => setMaintHours(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white font-bold focus:ring-amber-500 focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Descripción Detallada del Servicio <span className="text-red-400">*</span>
            </label>
            <textarea
              rows={3}
              required
              value={maintDescription}
              onChange={(e) => setMaintDescription(e.target.value)}
              placeholder="Ej. Cambio de aceite motor 15W-40 Caterpillar, cambio de filtro de aire primario y secundario, engrase general de articulaciones..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2.5 text-sm text-white placeholder-gray-400 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center gap-2 shadow-lg"
            >
              <span>🛠️</span> Guardar Registro de Mantenimiento
            </button>
          </div>

          {/* HISTORIAL DE MANTENIMIENTO */}
          {maintenanceLogs.length > 0 && (
            <div className="mt-6 border-t border-gray-700 pt-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                Bitácora de Servicios Recientes ({maintenanceLogs.length})
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {maintenanceLogs.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 bg-gray-800 rounded border border-gray-700 flex justify-between items-start text-xs gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-amber-300">{m.machineName}</span>
                        <span className="text-gray-400">• {m.date}</span>
                        <span className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded text-[10px] font-mono">
                          {m.hoursAtService.toFixed(1)} hrs
                        </span>
                      </div>
                      <p className="text-gray-300 mt-1 whitespace-pre-wrap">{m.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteMaintLog(m.id)}
                      className="text-gray-500 hover:text-red-400 transition-colors"
                      title="Eliminar este servicio"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>
      )}

      {/* ======================================================================== */}
      {/* HISTORIAL GENERAL DE OPERACIÓN DIARIA */}
      {/* ======================================================================== */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
              <span>📜</span> Historial General de Operación Diaria
            </h4>
            <p className="text-xs text-gray-400">
              Registros ordenados por fecha más reciente con No. de Vale, operador, desglose de horas extras y notas de cobro.
            </p>
          </div>

          {/* FILTRO POR MÁQUINA */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 font-semibold">Filtrar:</span>
            <select
              value={filterMachineId}
              onChange={(e) => setFilterMachineId(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg py-1.5 px-3 text-white text-xs font-semibold focus:ring-red-500 focus:border-red-500"
            >
              <option value="all">Todas las Máquinas ({dailyLogs.length})</option>
              {machines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.marca} {m.modelo}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* TABLA DE REGISTROS */}
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-900/90 text-gray-300 uppercase tracking-wider text-[11px] border-b border-gray-700">
              <tr>
                <th className="p-3">Fecha</th>
                <th className="p-3">No. Vale</th>
                <th className="p-3">Máquina</th>
                <th className="p-3">Operador</th>
                <th className="p-3 text-right">Horóm. Inicial</th>
                <th className="p-3 text-right">Horóm. Final</th>
                <th className="p-3 text-right text-blue-300">Horas Totales</th>
                <th className="p-3 text-right text-amber-300">H. Extras</th>
                <th className="p-3 text-right text-emerald-300">Combustible</th>
                <th className="p-3 text-right text-indigo-300">Rendimiento</th>
                <th className="p-3 min-w-[240px] text-amber-300">Notas de Cobro (Facturación)</th>
                <th className="p-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/60 bg-gray-800/60">
              {filteredDailyLogs.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-gray-400 italic">
                    No hay registros de operación diaria guardados.
                  </td>
                </tr>
              ) : (
                filteredDailyLogs.map((log) => {
                  const dailyYield =
                    log.hoursWorked > 0 && log.fuelLiters > 0
                      ? (log.fuelLiters / log.hoursWorked).toFixed(2)
                      : null;

                  return (
                    <tr key={log.id} className="hover:bg-gray-700/40 transition-colors">
                      <td className="p-3 font-semibold text-white whitespace-nowrap">
                        {log.date}
                      </td>
                      {/* NO. DE VALE */}
                      <td className="p-3 whitespace-nowrap">
                        {log.ticketNumber ? (
                          <span className="bg-slate-700 border border-slate-600 text-cyan-300 font-mono font-bold px-2 py-0.5 rounded text-[11px]">
                            📄 {log.ticketNumber}
                          </span>
                        ) : (
                          <span className="text-gray-500 font-mono text-[11px]">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-white block">{log.machineName}</span>
                      </td>
                      <td className="p-3">
                        <span className="text-gray-200 font-medium flex items-center gap-1.5">
                          <span>👷</span>
                          <span>{log.operatorName || 'Sin asignar'}</span>
                        </span>
                      </td>
                      <td className="p-3 text-right text-gray-300 font-mono">
                        {log.initialHours.toFixed(1)}
                      </td>
                      <td className="p-3 text-right text-gray-200 font-bold font-mono">
                        {log.finalHours.toFixed(1)}
                      </td>
                      {/* HORAS TOTALES */}
                      <td className="p-3 text-right font-black text-blue-400 font-mono">
                        +{log.hoursWorked.toFixed(1)} hrs
                      </td>
                      {/* HORAS EXTRAS DESTACADAS */}
                      <td className="p-3 text-right font-mono">
                        {log.extraHours > 0 ? (
                          <span className="bg-amber-950/80 border border-amber-500/80 text-amber-300 font-black px-2 py-0.5 rounded text-xs inline-block">
                            ⭐ {log.extraHours.toFixed(1)} hrs
                          </span>
                        ) : (
                          <span className="text-gray-500 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-emerald-400 font-mono">
                        {log.fuelLiters > 0 ? `${log.fuelLiters.toFixed(1)} L` : '-'}
                      </td>
                      <td className="p-3 text-right font-semibold text-indigo-300 font-mono">
                        {dailyYield ? `${dailyYield} L/h` : '-'}
                      </td>
                      {/* NOTAS DE COBRO DESTACADAS */}
                      <td className="p-3">
                        {log.billingNotes ? (
                          <div className="bg-amber-950/60 border border-amber-600/60 text-amber-200 px-3 py-1.5 rounded-md text-xs font-semibold leading-relaxed shadow-sm">
                            <span className="text-amber-400 mr-1.5 font-bold">💰 Cobro:</span>
                            {log.billingNotes}
                          </div>
                        ) : (
                          <span className="text-gray-500 italic text-[11px]">Sin notas</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteDailyLog(log.id)}
                          className="text-gray-400 hover:text-red-400 font-bold p-1 rounded transition-colors"
                          title="Eliminar registro"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MachineryControl;
