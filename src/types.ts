export interface Material {
    id: string;
    nombre: string;
    pesoPorMetro: number;
    costoPorMetro: number;
    longitudTramo: number;
}

export interface MaterialRequerido {
    materialId: string;
    cantidadMetros: number;
}

export interface ModeloHerreria {
    id: string;
    nombre: string;
    receta: MaterialRequerido[];
}

export interface ElementoObra {
    id: string;
    modeloId: string;
    cantidad: number;
    // Nuevos campos de control de taller y nómina
    cantFabricacion?: number;
    cantTerminados?: number;
    cantInstalados?: number;
    cantPagados?: number;
}

export interface PrecioFactura {
    materialId: string;
    costoRealPorMetro: number;
}

export interface CompraMaterial {
    id: string;
    materialId: string;
    factura: string;
    cantidadTramos: number;
    fecha: string;
}

export interface Obra {
    id: string;
    nombre: string;
    cliente: string;
    descripcion: string;
    ubicacion: string;
    contrato: string;
    montoSubtotal: number;
    fechaInicio: string;
    fechaFin: string;
    residente: string;
    estatus: 'Activa' | 'Terminada';
    elementos: ElementoObra[];
    preciosFactura: PrecioFactura[];
    compras: CompraMaterial[];
}

export interface PrecioMaterialPresupuesto {
    materialId: string;
    precioTramo: number;
}

export interface PartidaPresupuesto {
    id: string;
    modeloId: string;
    codigo: string;
    descripcion: string;
    unidad: string;
    cantidad: number;
    modulos: number;
    // Nuevos campos para pintura
    largo: number;
    ancho: number;
    tipoPintura: 'Esmalte' | 'Electroestática' | 'Ninguna';
}

export interface Presupuesto {
    id: string;
    nombre?: string;
    obraId?: string;
    promocion: string;
    desarrollo: string;
    ciudad: string;
    fecha: string;
    cliente: string;
    partidas: PartidaPresupuesto[];
    preciosMateriales: PrecioMaterialPresupuesto[]; // Precios congelados para este presupuesto
    precioGlobalKg?: number; // <--- NUEVO CAMPO AGREGADO
}

// CONTROL DE USUARIOS Y ACCESOS
export type ModuloApp = 
    | 'obras' 
    | 'presupuestos' 
    | 'almacen' 
    | 'fabricacion' 
    | 'catalogo' 
    | 'materiales' 
    | 'usuarios';

export interface PermisosUsuario {
    obras: boolean;
    presupuestos: boolean;
    almacen: boolean;
    fabricacion: boolean;
    catalogo: boolean;
    materiales: boolean;
    usuarios: boolean;
}

export type RolUsuario = 'Administrador' | 'Cotizador' | 'Residente' | 'Taller' | 'Personalizado';

export interface UsuarioERP {
    id: string; // UID de Firebase Auth o ID del documento
    email: string;
    nombre: string;
    rol: RolUsuario;
    activo: boolean;
    permisos: PermisosUsuario;
    fechaCreacion?: string;
    creadoPor?: string;
}

export const LISTA_MODULOS: { id: ModuloApp; nombre: string; icono: string; descripcion: string }[] = [
    { id: 'obras', nombre: 'Obras y Contratos', icono: '🏗️', descripcion: 'Gestión de obras, clientes, contratos y avance' },
    { id: 'presupuestos', nombre: 'Presupuestos (Cotizador)', icono: '📝', descripcion: 'Cotizaciones, precios por kg y reportes' },
    { id: 'almacen', nombre: 'Almacén y Compras', icono: '📦', descripcion: 'Inventario, registro de facturas y tramos' },
    { id: 'fabricacion', nombre: 'Taller y Destajos', icono: '👨‍🏭', descripcion: 'Control de destajos, taller y nómina' },
    { id: 'catalogo', nombre: 'Modelos de Herrería', icono: '📐', descripcion: 'Catálogo de modelos estructurales e insumos' },
    { id: 'materiales', nombre: 'Catálogo de Materiales', icono: '🔩', descripcion: 'Perfiles de acero, pesos y medidas' },
    { id: 'usuarios', nombre: 'Control de Usuarios', icono: '👥', descripcion: 'Cuentas de usuario y tabla de permisos de acceso' },
];

export const PERMISOS_DEFAULT: PermisosUsuario = {
    obras: false,
    presupuestos: false,
    almacen: false,
    fabricacion: false,
    catalogo: false,
    materiales: false,
    usuarios: false,
};

export const PERMISOS_ADMIN: PermisosUsuario = {
    obras: true,
    presupuestos: true,
    almacen: true,
    fabricacion: true,
    catalogo: true,
    materiales: true,
    usuarios: true,
};

