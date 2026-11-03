import React, { useState, useEffect, useMemo } from 'react';

export interface Machine {
  id: string;
  numero: number; // Número único de la máquina (1, 2, 3...)
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
  name: string; // Nombre del frente u obra (ej. "Parques del Palmar")
  client?: string; // Cliente o desarrollador
  city?: string; // Ubicación, municipio o dirección
  notes?: string; // Notas adicionales
}

export interface DailyLog {
  id: string;
  date: string;
  locationId?: string;
  locationName: string; // Ubicación / Obra donde laboró la máquina
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

const DEFAULT_LOCATIONS: MachineryLocation[] = [
  {
    id: 'loc-1',
    name: 'Parques del Palmar',
    client: 'Grupo San Carlos',
    city: 'Tlaquepaque, Jal.',
    notes: 'Frente principal / Herrería general',
  },
  {
    id: 'loc-2',
    name: 'Taller Central Bench',
    client: 'Bench Ingeniería',
    city: 'Guadalajara, Jal.',
    notes: 'Patio de maniobras y resguardo de equipo',
  },
  {
    id: 'loc-3',
    name: 'Desarrollo La Cima',
    client: 'Constructora Atlas',
    city: 'Zapopan, Jal.',
    notes: 'Movimiento de tierra y plataformas',
  },
];

const DEFAULT_MACHINES: Machine[] = [
  {
    id: 'retro-426f2',
    numero: 1,
    name: 'Retro 426F2',
    marca: 'Caterpillar',
    modelo: '426F2',
    anio: 2021,
    type: 'Retroexcavadora',
    currentHours: 1250.0,
  },
  {
    id: 'manipulador-dl1155',
    numero: 2,
    name: 'Manipulador DL1155',
    marca: 'Develon',
    modelo: 'DL1155',
    anio: 2020,
    type: 'Telehandler',
    currentHours: 840.0,
  },
  {
    id: 'minicargador',
    numero: 3,
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
  LOCATIONS: 'bench_machinery_locations',
  DAILY_LOGS: 'bench_machinery_daily_logs',
  MAINTENANCE_LOGS: 'bench_machinery_maintenance_logs',
};

export const MachineryControl: React.FC = () => {
  // ============================================================================
  // 1. ESTADO DE MÁQUINAS (LOCALSTORAGE CON MIGRACIÓN Y CONTROL DE NÚMERO ÚNICO)
  // ============================================================================
  const [machines, setMachines] = useState<Machine[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MACHINES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const usedNums = new Set<number>();
          return parsed.map((m: any, idx: number) => {
            let num = parseInt(m.numero, 10);
            if (!num || num <= 0 || usedNums.has(num)) {
              num = idx + 1;
              while (usedNums.has(num)) {
                num++;
              }
            }
            usedNums.add(num);

            return {
              id: m.id || `mach-${Date.now()}-${idx}`,
              numero: num,
              name: m.name || `${m.marca || ''} ${m.modelo || ''}`.trim() || `Máquina ${num}`,
              marca: m.marca || (m.name?.includes('Retro') ? 'Caterpillar' : m.name?.includes('Manipulador') ? 'Develon' : 'Bobcat'),
              modelo: m.modelo || (m.name?.includes('426F2') ? '426F2' : m.name?.includes('DL1155') ? 'DL1155' : 'S590'),
              anio: Number(m.anio || m.año) || 2021,
              type: m.type || 'Maquinaria Pesada',
              currentHours: Number(m.currentHours) || 0,
            };
          }).sort((a, b) => a.numero - b.numero);
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
  // 3. ESTADO DE UBICACIONES / OBRAS (LOCALSTORAGE)
  // ============================================================================
  const [locations, setLocations] = useState<MachineryLocation[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error cargando ubicaciones:', e);
    }
    return DEFAULT_LOCATIONS;
  });

  // ============================================================================
  // 4. REGISTROS DIARIOS Y MANTENIMIENTOS
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
            locationId: log.locationId || '',
            locationName: log.locationName || log.ubicacion || 'Parques del Palmar',
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
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DAILY_LOGS, JSON.stringify(dailyLogs));
  }, [dailyLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE_LOGS, JSON.stringify(maintenanceLogs));
  }, [maintenanceLogs]);

  // Pestaña activa del módulo
  const [activeTab, setActiveTab] = useState<'daily' | 'maintenance' | 'machines' | 'operators' | 'locations'>('daily');

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
  const [dailyLocationId, setDailyLocationId] = useState<string>(locations[0]?.id || '');
  const [dailyDate, setDailyDate] = useState<string>(todayStr);
  const [ticketNumber, setTicketNumber] = useState<string>(''); // No. de Vale / Folio
  const [fuelLiters, setFuelLiters] = useState<string>('');
  const [finalHours, setFinalHours] = useState<string>('');
  const [extraHours, setExtraHours] = useState<string>(''); // Horas Extras
  const [billingNotes, setBillingNotes] = useState<string>('');
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [dailySuccess, setDailySuccess] = useState<string | null>(null);

  // Máquina, operador y ubicación activos
  const activeDailyMachine = machines.find((m) => m.id === dailyMachineId) || machines[0];
  const activeDailyOperator = operators.find((op) => op.id === dailyOperatorId);
  const activeDailyLocation = locations.find((l) => l.id === dailyLocationId) || locations[0];
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
      locationId: activeDailyLocation?.id || '',
      locationName: activeDailyLocation ? activeDailyLocation.name : 'Ubicación General',
      machineId: activeDailyMachine.id,
      machineName: `Máquina ${activeDailyMachine.numero} - ${activeDailyMachine.marca} ${activeDailyMachine.modelo}`,
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
      prev
        .map((m) => (m.id === activeDailyMachine.id ? { ...m, currentHours: parsedFinalHours } : m))
        .sort((a, b) => a.numero - b.numero)
    );

    setTicketNumber('');
    setFuelLiters('');
    setFinalHours('');
    setExtraHours('');
    setBillingNotes('');
    setDailySuccess(
      `Registro guardado. Máquina ${activeDailyMachine.numero} (${activeDailyMachine.marca} ${activeDailyMachine.modelo}): Horómetro final ${parsedFinalHours.toFixed(1)} hrs (${hoursWorked.toFixed(1)} hrs trab.${extras > 0 ? `, ${extras.toFixed(1)} hrs extra` : ''}).`
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
      machineName: `Máquina ${activeMaintMachine.numero} - ${activeMaintMachine.marca} ${activeMaintMachine.modelo}`,
      hoursAtService: hoursVal,
      description: maintDescription.trim(),
      createdAt: new Date().toISOString(),
    };

    setMaintenanceLogs((prev) => [newMaint, ...prev]);
    setMaintDescription('');
    setMaintSuccess(`Servicio registrado para Máquina ${activeMaintMachine.numero} (${activeMaintMachine.marca} ${activeMaintMachine.modelo}).`);
    setTimeout(() => setMaintSuccess(null), 5000);
  };

  // ============================================================================
  // GESTIÓN / CRUD DE MÁQUINAS (NÚMERO ÚNICO, MARCA, MODELO, AÑO)
  // ============================================================================
  const [isAddingMachine, setIsAddingMachine] = useState(false);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [machineError, setMachineError] = useState<string | null>(null);
  const [machineForm, setMachineForm] = useState({
    numero: 1,
    name: '',
    marca: '',
    modelo: '',
    anio: new Date().getFullYear(),
    type: 'Retroexcavadora',
    currentHours: 0,
  });

  // Verificación en tiempo real si el número ya existe en otra máquina
  const duplicateNumberCheck = useMemo(() => {
    const num = parseInt(String(machineForm.numero), 10);
    if (!num || num <= 0) return null;
    return machines.find((m) => m.numero === num && m.id !== editingMachineId) || null;
  }, [machineForm.numero, machines, editingMachineId]);

  const handleOpenAddMachine = () => {
    setEditingMachineId(null);
    setMachineError(null);
    // Sugerir el siguiente número disponible sin duplicar
    const used = machines.map((m) => m.numero || 0);
    const nextNum = used.length > 0 ? Math.max(...used) + 1 : 1;

    setMachineForm({
      numero: nextNum,
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
    setMachineError(null);
    setMachineForm({
      numero: m.numero || 1,
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
    setMachineError(null);

    const num = parseInt(String(machineForm.numero), 10);
    if (isNaN(num) || num <= 0) {
      setMachineError('Por favor especifica un número de máquina válido (entero mayor a 0).');
      return;
    }

    // Validar duplicidad de número de máquina
    const duplicate = machines.find((m) => m.numero === num && m.id !== editingMachineId);
    if (duplicate) {
      setMachineError(
        `El número de máquina ${num} ya está asignado a "${duplicate.marca} ${duplicate.modelo}". Los números de máquina deben ser únicos.`
      );
      return;
    }

    if (!machineForm.marca.trim() || !machineForm.modelo.trim()) {
      setMachineError('Por favor especifica la marca y el modelo de la máquina.');
      return;
    }

    const displayName = machineForm.name.trim() || `${machineForm.marca} ${machineForm.modelo}`;

    if (editingMachineId) {
      setMachines((prev) =>
        prev
          .map((m) =>
            m.id === editingMachineId
              ? {
                  ...m,
                  numero: num,
                  name: displayName,
                  marca: machineForm.marca.trim(),
                  modelo: machineForm.modelo.trim(),
                  anio: Number(machineForm.anio) || new Date().getFullYear(),
                  type: machineForm.type.trim() || 'Maquinaria Pesada',
                  currentHours: Number(machineForm.currentHours) || 0,
                }
              : m
          )
          .sort((a, b) => a.numero - b.numero)
      );
    } else {
      const newMach: Machine = {
        id: 'mach-' + Date.now(),
        numero: num,
        name: displayName,
        marca: machineForm.marca.trim(),
        modelo: machineForm.modelo.trim(),
        anio: Number(machineForm.anio) || new Date().getFullYear(),
        type: machineForm.type.trim() || 'Maquinaria Pesada',
        currentHours: Number(machineForm.currentHours) || 0,
      };
      setMachines((prev) => [...prev, newMach].sort((a, b) => a.numero - b.numero));
    }

    setIsAddingMachine(false);
    setEditingMachineId(null);
  };

  const handleDeleteMachine = (id: string, label: string) => {
    if (machines.length <= 1) {
      alert('Debe existir al menos una máquina en el catálogo.');
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar ${label} del catálogo?`)) {
      setMachines((prev) => prev.filter((m) => m.id !== id).sort((a, b) => a.numero - b.numero));
      if (dashboardMachineId === id) {
        const remaining = machines.filter((m) => m.id !== id);
        setDashboardMachineId(remaining[0]?.id || '');
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

  // ============================================================================
  // GESTIÓN / CRUD DE UBICACIONES / OBRAS
  // ============================================================================
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: '',
    client: '',
    city: '',
    notes: '',
  });

  const handleOpenAddLocation = () => {
    setEditingLocationId(null);
    setLocationError(null);
    setLocationForm({
      name: '',
      client: '',
      city: '',
      notes: '',
    });
    setIsAddingLocation(true);
  };

  const handleOpenEditLocation = (loc: MachineryLocation) => {
    setEditingLocationId(loc.id);
    setLocationError(null);
    setLocationForm({
      name: loc.name,
      client: loc.client || '',
      city: loc.city || '',
      notes: loc.notes || '',
    });
    setIsAddingLocation(true);
  };

  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    setLocationError(null);

    const trimmedName = locationForm.name.trim();
    if (!trimmedName) {
      setLocationError('Por favor ingresa el nombre de la obra o ubicación.');
      return;
    }

    const duplicate = locations.find(
      (l) => l.name.toLowerCase().trim() === trimmedName.toLowerCase() && l.id !== editingLocationId
    );
    if (duplicate) {
      setLocationError(`Ya existe una ubicación registrada como "${duplicate.name}".`);
      return;
    }

    if (editingLocationId) {
      setLocations((prev) =>
        prev.map((l) =>
          l.id === editingLocationId
            ? {
                ...l,
                name: trimmedName,
                client: locationForm.client.trim(),
                city: locationForm.city.trim(),
                notes: locationForm.notes.trim(),
              }
            : l
        )
      );
    } else {
      const newLoc: MachineryLocation = {
        id: 'loc-' + Date.now(),
        name: trimmedName,
        client: locationForm.client.trim(),
        city: locationForm.city.trim(),
        notes: locationForm.notes.trim(),
      };
      setLocations((prev) => [...prev, newLoc]);
      if (!dailyLocationId) {
        setDailyLocationId(newLoc.id);
      }
    }

    setIsAddingLocation(false);
    setEditingLocationId(null);
  };

  const handleDeleteLocation = (id: string, name: string) => {
    if (locations.length <= 1) {
      alert('Debe existir al menos una ubicación en el catálogo.');
      return;
    }
    if (window.confirm(`¿Estás seguro de eliminar la ubicación "${name}" del catálogo?`)) {
      setLocations((prev) => prev.filter((l) => l.id !== id));
      if (dailyLocationId === id) {
        const remaining = locations.filter((l) => l.id !== id);
        setDailyLocationId(remaining[0]?.id || '');
      }
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
          <button
            type="button"
            onClick={() => setActiveTab('locations')}
            className={`px-3 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'locations'
                ? 'bg-cyan-600 text-white shadow'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            <span>📍</span> Base Ubicaciones ({locations.length})
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
              <div className="flex items-center justify-between border-b border-gray-700 pb-2">
                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>{editingMachineId ? '✏️ Editar Datos de la Máquina' : '➕ Dar de Alta Nueva Máquina'}</span>
                </h5>
                <span className="text-xs text-amber-300 font-semibold">
                  * Cada máquina debe tener un número único
                </span>
              </div>

              {machineError && (
                <div className="p-3 bg-red-950/80 border border-red-600 text-red-200 rounded-lg text-xs font-bold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{machineError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                {/* NÚMERO DE MÁQUINA */}
                <div>
                  <label className="block font-bold text-amber-300 mb-1 flex items-center justify-between">
                    <span>No. Máquina <span className="text-red-400">*</span></span>
                    {duplicateNumberCheck && (
                      <span className="text-[10px] text-red-400 font-black">Duplicado</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="1, 2, 3..."
                    value={machineForm.numero || ''}
                    onChange={(e) => {
                      setMachineForm({ ...machineForm, numero: parseInt(e.target.value, 10) || 0 });
                      setMachineError(null);
                    }}
                    className={`w-full bg-gray-700 border rounded p-2 text-white font-mono font-black text-center ${
                      duplicateNumberCheck ? 'border-red-500 ring-2 ring-red-500/50 bg-red-950/30' : 'border-amber-500/80'
                    }`}
                  />
                  {duplicateNumberCheck ? (
                    <span className="text-[10px] text-red-400 block mt-0.5 leading-tight font-semibold">
                      Ya asignado a {duplicateNumberCheck.marca} {duplicateNumberCheck.modelo}
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-400 block mt-0.5 leading-tight font-semibold">
                      ✓ Número único
                    </span>
                  )}
                </div>

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
                  <label className="block font-bold text-gray-300 mb-1">Alias / Identificador</label>
                  <input
                    type="text"
                    placeholder="Ej. Retro 426F2"
                    value={machineForm.name}
                    onChange={(e) => setMachineForm({ ...machineForm, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-amber-300 mb-1">Horómetro Inicial (hrs)</label>
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
                  onClick={() => {
                    setIsAddingMachine(false);
                    setMachineError(null);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!!duplicateNumberCheck}
                  className={`font-bold py-1.5 px-5 rounded text-xs shadow flex items-center gap-1.5 ${
                    duplicateNumberCheck
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                  }`}
                >
                  <span>💾</span>
                  <span>{editingMachineId ? 'Actualizar Máquina' : 'Guardar en Catálogo'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TABLA DE MÁQUINAS */}
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900 text-gray-300 uppercase tracking-wider text-[11px] border-b border-gray-700">
                <tr>
                  <th className="p-3 text-center">No. Máquina</th>
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
                    <td className="p-3 text-center">
                      <span className="bg-red-950/80 border border-red-500/60 text-white font-black px-2.5 py-1 rounded text-xs font-mono inline-flex items-center gap-1">
                        <span>🚜</span>
                        <span>Máquina {m.numero}</span>
                      </span>
                    </td>
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
                        className="bg-blue-900/60 hover:bg-blue-700 text-blue-200 px-2.5 py-1 rounded font-bold text-[11px] border border-blue-700/50 cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMachine(m.id, `Máquina ${m.numero} (${m.marca} ${m.modelo})`)}
                        className="bg-red-900/40 hover:bg-red-700 text-red-300 px-2.5 py-1 rounded font-bold text-[11px] border border-red-700/50 cursor-pointer"
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
      {/* PESTAÑA: BASE DE DATOS DE UBICACIONES / OBRAS */}
      {/* ======================================================================== */}
      {activeTab === 'locations' && (
        <div className="bg-gray-900/80 p-5 rounded-lg border border-gray-700 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-700 pb-3">
            <div>
              <h4 className="text-lg font-bold text-white flex items-center gap-2">
                <span>📍</span> Base de Datos de Ubicaciones / Obras
              </h4>
              <p className="text-xs text-gray-400">
                Catálogo de obras, desarrollos y frentes de trabajo donde opera la maquinaria pesada.
              </p>
            </div>
            {!isAddingLocation && (
              <button
                type="button"
                onClick={handleOpenAddLocation}
                className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors flex items-center gap-2 shadow cursor-pointer"
              >
                <span>+</span> Dar de Alta Ubicación
              </button>
            )}
          </div>

          {/* FORMULARIO DE ALTA / EDICIÓN DE UBICACIÓN */}
          {isAddingLocation && (
            <form onSubmit={handleSaveLocation} className="bg-gray-800 p-4 rounded-lg border border-cyan-500/40 space-y-4">
              <h5 className="text-sm font-bold text-white border-b border-gray-700 pb-2">
                {editingLocationId ? '✏️ Editar Datos de la Ubicación' : '➕ Dar de Alta Nueva Ubicación'}
              </h5>

              {locationError && (
                <div className="p-3 bg-red-950/80 border border-red-600 text-red-200 rounded-lg text-xs font-bold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{locationError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Nombre del Frente / Obra <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Parques del Palmar, Desarrollo La Cima"
                    value={locationForm.name}
                    onChange={(e) => {
                      setLocationForm({ ...locationForm, name: e.target.value });
                      setLocationError(null);
                    }}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Ciudad / Dirección / Referencia
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Tlaquepaque, Jal. / Periférico Sur"
                    value={locationForm.city}
                    onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-300 mb-1">
                    Cliente / Desarrollador
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Grupo San Carlos, Constructora Atlas"
                    value={locationForm.client}
                    onChange={(e) => setLocationForm({ ...locationForm, client: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block font-bold text-gray-300 mb-1">Notas Adicionales</label>
                  <input
                    type="text"
                    placeholder="Ej. Tramo de terracerías, acceso por puerta 2..."
                    value={locationForm.notes}
                    onChange={(e) => setLocationForm({ ...locationForm, notes: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingLocation(false);
                    setLocationError(null);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-1.5 px-4 rounded text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-5 rounded text-xs shadow cursor-pointer"
                >
                  {editingLocationId ? 'Actualizar Ubicación' : 'Guardar en Catálogo'}
                </button>
              </div>
            </form>
          )}

          {/* TABLA DE UBICACIONES */}
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-900 text-gray-300 uppercase tracking-wider text-[11px] border-b border-gray-700">
                <tr>
                  <th className="p-3">Nombre del Frente / Obra</th>
                  <th className="p-3">Ciudad / Dirección</th>
                  <th className="p-3">Cliente / Desarrollador</th>
                  <th className="p-3">Notas</th>
                  <th className="p-3 text-center">Jornadas Registradas</th>
                  <th className="p-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/60 bg-gray-800/60">
                {locations.map((loc) => {
                  const usageCount = dailyLogs.filter(
                    (log) => log.locationId === loc.id || log.locationName === loc.name
                  ).length;
                  return (
                    <tr key={loc.id} className="hover:bg-gray-700/40">
                      <td className="p-3 font-bold text-white flex items-center gap-2">
                        <span className="text-base text-cyan-400">📍</span>
                        <span className="text-cyan-300">{loc.name}</span>
                      </td>
                      <td className="p-3 text-gray-300">{loc.city || '-'}</td>
                      <td className="p-3 text-gray-300 font-semibold">{loc.client || '-'}</td>
                      <td className="p-3 text-gray-400 italic">{loc.notes || '-'}</td>
                      <td className="p-3 text-center">
                        <span className="bg-gray-700 text-gray-200 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                          {usageCount} jornadas
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleOpenEditLocation(loc)}
                          className="bg-blue-900/60 hover:bg-blue-700 text-blue-200 px-2.5 py-1 rounded font-bold text-[11px] border border-blue-700/50 cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLocation(loc.id, loc.name)}
                          className="bg-red-900/40 hover:bg-red-700 text-red-300 px-2.5 py-1 rounded font-bold text-[11px] border border-red-700/50 cursor-pointer"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

          {/* BOTONES SELECTORES DE MÁQUINA: ÍCONO Y NÚMERO */}
          <div className="flex flex-wrap items-center gap-2">
            {machines.map((mach) => {
              const isSelected = mach.id === dashboardMachineId;
              return (
                <button
                  key={mach.id}
                  type="button"
                  onClick={() => setDashboardMachineId(mach.id)}
                  title={`Máquina ${mach.numero}: ${mach.marca} ${mach.modelo} (${mach.anio}) - ${mach.currentHours.toFixed(1)} hrs`}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black border transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isSelected
                      ? 'bg-red-600 border-red-500 text-white shadow-lg ring-2 ring-red-400/50 scale-105'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  <span className="text-base leading-none">🚜</span>
                  <span>Máquina {mach.numero}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANEL DE DETALLE DE LA MÁQUINA SELECCIONADA */}
        {selectedDashMachine && (
          <div className="mb-4 bg-gray-800/90 rounded-lg p-3.5 border border-gray-700/80 flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center text-xl shrink-0">
                🚜
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-white font-black text-sm uppercase tracking-wide">
                    Máquina {selectedDashMachine.numero}: {selectedDashMachine.marca} {selectedDashMachine.modelo}
                  </span>
                  <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-[10px] font-bold">
                    Año {selectedDashMachine.anio}
                  </span>
                  <span className="bg-blue-950/80 border border-blue-500/50 text-blue-300 px-2 py-0.5 rounded text-[10px] font-semibold">
                    {selectedDashMachine.type}
                  </span>
                  {selectedDashMachine.name && (
                    <span className="text-gray-400 text-[11px]">
                      • Alias: <span className="text-gray-300 font-medium">{selectedDashMachine.name}</span>
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-1">
                  <span>
                    Horómetro actual: <strong className="text-amber-400 font-mono font-bold">{selectedDashMachine.currentHours.toFixed(1)} hrs</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Jornadas registradas: <strong className="text-blue-300 font-mono font-bold">{dashStats.totalLogs}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Servicios mecánicos: <strong className="text-indigo-300 font-mono font-bold">{dashStats.totalServices}</strong>
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveTab('machines');
                handleOpenEditMachine(selectedDashMachine);
              }}
              className="text-[11px] bg-gray-700 hover:bg-gray-600 text-gray-200 border border-gray-600 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>✏️</span>
              <span>Ver / Editar Ficha Máquina {selectedDashMachine.numero}</span>
            </button>
          </div>
        )}

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
              Máquina #{selectedDashMachine?.numero} • {selectedDashMachine?.marca} {selectedDashMachine?.modelo}
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

          {/* FILA 1: FECHA, NO. DE VALE, UBICACIÓN / OBRA, MÁQUINA, OPERADOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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

            {/* UBICACIÓN / OBRA */}
            <div>
              <label className="block text-xs font-bold text-cyan-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1">📍 Ubicación / Obra <span className="text-red-400">*</span></span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('locations');
                    handleOpenAddLocation();
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-200 underline font-semibold cursor-pointer"
                  title="Dar de alta nueva ubicación en el catálogo"
                >
                  + Nueva
                </button>
              </label>
              <select
                required
                value={dailyLocationId}
                onChange={(e) => setDailyLocationId(e.target.value)}
                className="w-full bg-gray-700 border border-cyan-600/50 rounded-lg p-2.5 text-sm text-white focus:ring-cyan-500 focus:border-cyan-500 font-semibold"
              >
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    📍 {loc.name} {loc.city ? `(${loc.city})` : ''}
                  </option>
                ))}
              </select>
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
                    🚜 Máquina {m.numero} - {m.marca} {m.modelo} ({m.anio})
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
                    🚜 Máquina {m.numero} - {m.marca} {m.modelo} ({m.anio})
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
                  🚜 Máquina {m.numero} - {m.marca} {m.modelo}
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
                <th className="p-3 text-cyan-300">Ubicación / Obra</th>
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
                  <td colSpan={13} className="p-8 text-center text-gray-400 italic">
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
                      {/* UBICACIÓN */}
                      <td className="p-3 whitespace-nowrap">
                        <span className="bg-cyan-950/80 border border-cyan-600/50 text-cyan-300 font-bold px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-1">
                          <span>📍</span>
                          <span>{log.locationName || 'General'}</span>
                        </span>
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
