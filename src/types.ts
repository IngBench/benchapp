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
    promocion: string;
    desarrollo: string;
    ciudad: string;
    fecha: string;
    cliente: string;
    partidas: PartidaPresupuesto[];
    preciosMateriales: PrecioMaterialPresupuesto[]; // Precios congelados para este presupuesto
    precioGlobalKg?: number; // <--- NUEVO CAMPO AGREGADO
}