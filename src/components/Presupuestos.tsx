import { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { ModeloHerreria, Material, Presupuesto, PartidaPresupuesto, MaterialRequerido, Obra } from '../types';

export default function Presupuestos() {
    // ESTADOS EN TIEMPO REAL DESDE FIREBASE
    const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
    const [modelos, setModelos] = useState<ModeloHerreria[]>([]);
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [obras, setObras] = useState<Obra[]>([]);

    const [presupuestoActivo, setPresupuestoActivo] = useState<Presupuesto | null>(null);

    // Formulario para Crear / Editar Cabecera de Presupuesto
    const [formCabecera, setFormCabecera] = useState({
        nombre: '',
        obraId: '',
        promocion: '',
        desarrollo: '',
        ciudad: '',
        cliente: 'GRUPO SAN CARLOS',
        fecha: new Date().toISOString().split('T')[0]
    });

    // Control del Modal de edición de datos generales del presupuesto
    const [modalEditarPresupuesto, setModalEditarPresupuesto] = useState(false);
    const [editandoPresupuestoId, setEditandoPresupuestoId] = useState<string | null>(null);

    // Formulario para Conceptos / Partidas
    const [partidaEditandoId, setPartidaEditandoId] = useState<string | null>(null);
    const [modeloSel, setModeloSel] = useState('');
    const [codigo, setCodigo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [cantidad, setCantidad] = useState('1');
    const [modulos, setModulos] = useState('1');
    const [largo, setLargo] = useState('');
    const [ancho, setAncho] = useState('');
    const [tipoPintura, setTipoPintura] = useState<'Esmalte' | 'Electroestática' | 'Ninguna'>('Ninguna');

    // Alta rápida de modelo estructural dentro del cotizador
    const [mostrarAltaModelo, setMostrarAltaModelo] = useState(false);
    const [nuevoModNombre, setNuevoModNombre] = useState('');
    const [nuevoModReceta, setNuevoModReceta] = useState<MaterialRequerido[]>([]);
    const [tempMatId, setTempMatId] = useState('');
    const [tempMatCant, setTempMatCant] = useState('');

    // Edición de modelo estructural desde Presupuestos
    const [modalEditarModelo, setModalEditarModelo] = useState(false);
    const [modeloEnEdicion, setModeloEnEdicion] = useState<{
        id: string;
        nombre: string;
        receta: MaterialRequerido[];
    } | null>(null);
    const [nuevoInsumoMatId, setNuevoInsumoMatId] = useState('');
    const [nuevoInsumoMetros, setNuevoInsumoMetros] = useState('');

    // Búsqueda en listado
    const [busqueda, setBusqueda] = useState('');

    // VIGILANTES DE FIREBASE (Escuchan en tiempo real)
    useEffect(() => {
        const desuscribirPresupuestos = onSnapshot(collection(db, 'presupuestos'), (snapshot) => {
            const presupuestosData = snapshot.docs.map(doc => doc.data() as Presupuesto);
            setPresupuestos(presupuestosData);
        });
        const desuscribirModelos = onSnapshot(collection(db, 'modelos'), (snapshot) => {
            const modelosData = snapshot.docs.map(doc => doc.data() as ModeloHerreria);
            setModelos(modelosData);
        });
        const desuscribirMateriales = onSnapshot(collection(db, 'materiales'), (snapshot) => {
            const materialesData = snapshot.docs.map(doc => doc.data() as Material);
            setMateriales(materialesData);
        });
        const desuscribirObras = onSnapshot(collection(db, 'obras'), (snapshot) => {
            const obrasData = snapshot.docs.map(doc => doc.data() as Obra);
            setObras(obrasData);
        });

        return () => {
            desuscribirPresupuestos();
            desuscribirModelos();
            desuscribirMateriales();
            desuscribirObras();
        };
    }, []);

    // Mantener sincronizado el presupuesto activo con la nube
    useEffect(() => {
        if (presupuestoActivo) {
            const act = presupuestos.find(p => p.id === presupuestoActivo.id);
            if (act) setPresupuestoActivo(act);
        }
    }, [presupuestos]);

    // Cuando selecciona una Obra en el formulario, autocompletar desarrollo y cliente
    const manejarSeleccionObra = (obraId: string) => {
        const obra = obras.find(o => o.id === obraId);
        if (obra) {
            setFormCabecera(prev => ({
                ...prev,
                obraId,
                nombre: prev.nombre || `Presupuesto ${obra.nombre}`,
                desarrollo: prev.desarrollo || obra.nombre,
                cliente: obra.cliente || prev.cliente,
                ciudad: prev.ciudad || obra.ubicacion || ''
            }));
        } else {
            setFormCabecera(prev => ({ ...prev, obraId: '' }));
        }
    };

    // CREAR NUEVO PRESUPUESTO
    const crearPresupuesto = async (e: React.FormEvent) => {
        e.preventDefault();
        const [anio, mes, dia] = formCabecera.fecha.split('-');
        const fechaFormateada = dia && mes && anio ? `${dia}/${mes}/${anio}` : formCabecera.fecha;

        const nuevoId = Date.now().toString();
        const nombreFinal = formCabecera.nombre.trim() || `Presupuesto ${formCabecera.desarrollo || 'General'}`;

        const nuevo: Presupuesto = {
            id: nuevoId,
            nombre: nombreFinal,
            obraId: formCabecera.obraId || '',
            promocion: formCabecera.promocion.trim(),
            desarrollo: formCabecera.desarrollo.trim().toUpperCase(),
            ciudad: formCabecera.ciudad.trim().toUpperCase(),
            cliente: formCabecera.cliente.trim(),
            fecha: fechaFormateada,
            partidas: [],
            preciosMateriales: [],
            precioGlobalKg: 0
        };

        try {
            await setDoc(doc(db, 'presupuestos', nuevoId), nuevo);
            setPresupuestoActivo(nuevo);
            setFormCabecera({
                nombre: '',
                obraId: '',
                promocion: '',
                desarrollo: '',
                ciudad: '',
                cliente: 'GRUPO SAN CARLOS',
                fecha: new Date().toISOString().split('T')[0]
            });
        } catch (error) {
            console.error('Error al crear presupuesto en la nube:', error);
            alert('No se pudo guardar el presupuesto.');
        }
    };

    // ABRIR MODAL PARA EDITAR DATOS GENERALES
    const abrirEdicionPresupuesto = (p: Presupuesto) => {
        let fechaIso = new Date().toISOString().split('T')[0];
        if (p.fecha && p.fecha.includes('/')) {
            const [d, m, y] = p.fecha.split('/');
            if (d && m && y) fechaIso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }

        setEditandoPresupuestoId(p.id);
        setFormCabecera({
            nombre: p.nombre || p.desarrollo || '',
            obraId: p.obraId || '',
            promocion: p.promocion || '',
            desarrollo: p.desarrollo || '',
            ciudad: p.ciudad || '',
            cliente: p.cliente || '',
            fecha: fechaIso
        });
        setModalEditarPresupuesto(true);
    };

    // GUARDAR MODIFICACIÓN DE DATOS GENERALES
    const guardarEdicionPresupuesto = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editandoPresupuestoId) return;

        const [anio, mes, dia] = formCabecera.fecha.split('-');
        const fechaFormateada = dia && mes && anio ? `${dia}/${mes}/${anio}` : formCabecera.fecha;

        try {
            await updateDoc(doc(db, 'presupuestos', editandoPresupuestoId), {
                nombre: formCabecera.nombre.trim(),
                obraId: formCabecera.obraId || '',
                promocion: formCabecera.promocion.trim(),
                desarrollo: formCabecera.desarrollo.trim().toUpperCase(),
                ciudad: formCabecera.ciudad.trim().toUpperCase(),
                cliente: formCabecera.cliente.trim(),
                fecha: fechaFormateada
            });

            setModalEditarPresupuesto(false);
            setEditandoPresupuestoId(null);
            alert('Datos del presupuesto modificados y guardados con éxito.');
        } catch (error) {
            console.error('Error al actualizar presupuesto:', error);
            alert('Error al guardar cambios.');
        }
    };

    // BORRAR PRESUPUESTO COMPLETO
    const eliminarPresupuesto = async (id: string, nombreP: string) => {
        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente el presupuesto "${nombreP}"?`)) {
            try {
                await deleteDoc(doc(db, 'presupuestos', id));
                if (presupuestoActivo?.id === id) {
                    setPresupuestoActivo(null);
                }
                alert('Presupuesto eliminado correctamente.');
            } catch (error) {
                console.error('Error al eliminar presupuesto:', error);
                alert('No se pudo eliminar el presupuesto.');
            }
        }
    };

    // ALTA RÁPIDA DE MODELO
    const agregarInsumoAlNuevoModelo = () => {
        if (!tempMatId || !tempMatCant) return;
        setNuevoModReceta([...nuevoModReceta, { materialId: tempMatId, cantidadMetros: Number(tempMatCant) }]);
        setTempMatId('');
        setTempMatCant('');
    };

    const guardarNuevoModelo = async () => {
        if (!nuevoModNombre.trim() || nuevoModReceta.length === 0) {
            alert('Ingresa el nombre del modelo y al menos un insumo.');
            return;
        }

        const nuevoId = Date.now().toString();
        const nuevoModeloObj: ModeloHerreria = {
            id: nuevoId,
            nombre: nuevoModNombre.trim(),
            receta: nuevoModReceta
        };

        try {
            await setDoc(doc(db, 'modelos', nuevoId), nuevoModeloObj);
            setModeloSel(nuevoId);
            setDescripcion(nuevoModeloObj.nombre);
            setNuevoModNombre('');
            setNuevoModReceta([]);
            setMostrarAltaModelo(false);
        } catch (error) {
            console.error('Error al guardar modelo en la nube:', error);
            alert('Error al guardar modelo.');
        }
    };

    // ABRIR EDITOR DE MODELO ESTRUCTURAL
    const abrirEditorModelo = (modeloId?: string) => {
        const idParaAbrir = modeloId || modeloSel || (modelos.length > 0 ? modelos[0].id : '');
        if (!idParaAbrir) {
            alert('No hay modelos de herrería disponibles para editar.');
            return;
        }
        const mod = modelos.find(m => m.id === idParaAbrir);
        if (!mod) {
            alert('No se encontró el modelo seleccionado.');
            return;
        }
        setModeloEnEdicion({
            id: mod.id,
            nombre: mod.nombre,
            receta: mod.receta.map(r => ({ ...r }))
        });
        setNuevoInsumoMatId('');
        setNuevoInsumoMetros('');
        setModalEditarModelo(true);
    };

    // CAMBIAR MODELO EN EL SELECTOR DEL MODAL
    const cambiarModeloEnEdicion = (nuevoId: string) => {
        const mod = modelos.find(m => m.id === nuevoId);
        if (mod) {
            setModeloEnEdicion({
                id: mod.id,
                nombre: mod.nombre,
                receta: mod.receta.map(r => ({ ...r }))
            });
            setNuevoInsumoMatId('');
            setNuevoInsumoMetros('');
        }
    };

    // CAMBIAR MATERIAL / PERFIL DE UN INSUMO EN LA RECETA
    const cambiarMaterialInsumo = (index: number, nuevoMaterialId: string) => {
        if (!modeloEnEdicion) return;
        const nuevaReceta = [...modeloEnEdicion.receta];
        nuevaReceta[index] = {
            ...nuevaReceta[index],
            materialId: nuevoMaterialId
        };
        setModeloEnEdicion({
            ...modeloEnEdicion,
            receta: nuevaReceta
        });
    };

    // CAMBIAR METROS LINEALES DE UN INSUMO EN LA RECETA
    const cambiarMetrosInsumo = (index: number, metros: number) => {
        if (!modeloEnEdicion) return;
        const nuevaReceta = [...modeloEnEdicion.receta];
        nuevaReceta[index] = {
            ...nuevaReceta[index],
            cantidadMetros: metros
        };
        setModeloEnEdicion({
            ...modeloEnEdicion,
            receta: nuevaReceta
        });
    };

    // ELIMINAR INSUMO DE LA RECETA
    const eliminarInsumoDeModelo = (index: number) => {
        if (!modeloEnEdicion) return;
        if (modeloEnEdicion.receta.length <= 1) {
            alert('El modelo debe conservar al menos un perfil de acero.');
            return;
        }
        const nuevaReceta = modeloEnEdicion.receta.filter((_, i) => i !== index);
        setModeloEnEdicion({
            ...modeloEnEdicion,
            receta: nuevaReceta
        });
    };

    // AGREGAR NUEVO INSUMO A LA RECETA
    const agregarInsumoAModeloEnEdicion = () => {
        if (!modeloEnEdicion) return;
        if (!nuevoInsumoMatId) {
            alert('Por favor selecciona un perfil del catálogo.');
            return;
        }
        const cant = Number(nuevoInsumoMetros);
        if (isNaN(cant) || cant <= 0) {
            alert('Ingresa una cantidad de metros mayor a 0.');
            return;
        }

        setModeloEnEdicion({
            ...modeloEnEdicion,
            receta: [
                ...modeloEnEdicion.receta,
                { materialId: nuevoInsumoMatId, cantidadMetros: cant }
            ]
        });
        setNuevoInsumoMatId('');
        setNuevoInsumoMetros('');
    };

    // GUARDAR CAMBIOS DEL MODELO EN LA NUBE
    const guardarCambiosModelo = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!modeloEnEdicion) return;

        if (!modeloEnEdicion.nombre.trim()) {
            alert('El modelo debe tener un nombre.');
            return;
        }
        if (modeloEnEdicion.receta.length === 0) {
            alert('El modelo debe incluir al menos un material de acero.');
            return;
        }

        for (const item of modeloEnEdicion.receta) {
            if (!item.materialId) {
                alert('Todos los insumos deben tener un material asignado.');
                return;
            }
            if (item.cantidadMetros <= 0) {
                alert('La cantidad de metros de cada perfil debe ser mayor a 0.');
                return;
            }
        }

        try {
            // Guardar modelo en Firestore
            await updateDoc(doc(db, 'modelos', modeloEnEdicion.id), {
                nombre: modeloEnEdicion.nombre.trim(),
                receta: modeloEnEdicion.receta
            });

            // Si hay un presupuesto activo, asegurar que los nuevos materiales aparezcan en preciosMateriales
            if (presupuestoActivo) {
                const nuevosPrecios = [...(presupuestoActivo.preciosMateriales || [])];
                let huboNuevos = false;

                modeloEnEdicion.receta.forEach(item => {
                    if (!nuevosPrecios.some(p => p.materialId === item.materialId)) {
                        nuevosPrecios.push({ materialId: item.materialId, precioTramo: 0 });
                        huboNuevos = true;
                    }
                });

                if (huboNuevos) {
                    await updateDoc(doc(db, 'presupuestos', presupuestoActivo.id), {
                        preciosMateriales: nuevosPrecios
                    });
                }
            }

            setModalEditarModelo(false);
            setModeloEnEdicion(null);
            alert('¡Modelo actualizado exitosamente! Los cálculos y precios de las partidas se han recalculado en tiempo real.');
        } catch (error) {
            console.error('Error al actualizar el modelo:', error);
            alert('Error al guardar los cambios del modelo.');
        }
    };

    // MODAL DE EDICIÓN DE INSUMOS DEL MODELO
    const renderModalEditarModelo = () => {
        if (!modalEditarModelo || !modeloEnEdicion) return null;

        const totalMetrosModelo = modeloEnEdicion.receta.reduce((acc, r) => acc + (Number(r.cantidadMetros) || 0), 0);
        const totalKgModelo = modeloEnEdicion.receta.reduce((acc, r) => {
            const mat = materiales.find(m => m.id === r.materialId);
            return acc + ((Number(r.cantidadMetros) || 0) * (mat?.pesoPorMetro || 0));
        }, 0);

        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 border border-gray-200 my-8">
                    <div className="flex justify-between items-center border-b pb-3 mb-4">
                        <div>
                            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                <span>📐</span> Editar Insumos del Modelo
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Modifica los perfiles de acero y los metros lineales requeridos por este modelo.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setModalEditarModelo(false);
                                setModeloEnEdicion(null);
                            }}
                            className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    <form onSubmit={guardarCambiosModelo} className="space-y-5">
                        {/* Selector de modelo a editar y nombre */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Modelo a Editar:
                                </label>
                                <select
                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                                    value={modeloEnEdicion.id}
                                    onChange={e => cambiarModeloEnEdicion(e.target.value)}
                                >
                                    {modelos.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Nombre del Modelo: <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs bg-white font-bold text-gray-800"
                                    value={modeloEnEdicion.nombre}
                                    onChange={e => setModeloEnEdicion({ ...modeloEnEdicion, nombre: e.target.value })}
                                    placeholder="Nombre del modelo..."
                                />
                            </div>
                        </div>

                        {/* Listado de insumos actuales */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                    <span>🔩</span> Lista de Materiales / Perfiles ({modeloEnEdicion.receta.length})
                                </label>
                                <span className="text-[11px] text-gray-500">
                                    Cambia el perfil o ajusta la cantidad de metros
                                </span>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-100 border-b text-gray-700">
                                        <tr>
                                            <th className="p-2.5">Perfil de Acero (Material)</th>
                                            <th className="p-2.5 text-center w-28">Metros (ml)</th>
                                            <th className="p-2.5 text-center w-24">Peso kgs/ml</th>
                                            <th className="p-2.5 text-right w-28 bg-emerald-50 text-emerald-900 font-bold">Subtotal Kg</th>
                                            <th className="p-2.5 text-center w-12">Quitar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {modeloEnEdicion.receta.map((insumo, index) => {
                                            const mat = materiales.find(m => m.id === insumo.materialId);
                                            const subtotalKg = ((Number(insumo.cantidadMetros) || 0) * (mat?.pesoPorMetro || 0));

                                            return (
                                                <tr key={index} className="hover:bg-gray-50/80">
                                                    <td className="p-2">
                                                        <select
                                                            className="w-full p-1.5 border border-gray-300 rounded text-xs bg-white focus:ring-1 focus:ring-blue-500 font-medium"
                                                            value={insumo.materialId}
                                                            onChange={e => cambiarMaterialInsumo(index, e.target.value)}
                                                        >
                                                            {materiales.map(m => (
                                                                <option key={m.id} value={m.id}>
                                                                    {m.nombre} ({m.pesoPorMetro} kg/ml)
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0.01"
                                                            required
                                                            className="w-full p-1.5 border border-blue-300 rounded text-center text-xs font-bold text-blue-700 bg-blue-50/30"
                                                            value={insumo.cantidadMetros || ''}
                                                            onChange={e => cambiarMetrosInsumo(index, Number(e.target.value))}
                                                            placeholder="0.00"
                                                        />
                                                    </td>
                                                    <td className="p-2 text-center text-gray-600 font-medium">
                                                        {mat?.pesoPorMetro ? `${mat.pesoPorMetro} kg/m` : '-'}
                                                    </td>
                                                    <td className="p-2 text-right font-black text-emerald-700 bg-emerald-50/40">
                                                        {subtotalKg.toFixed(2)} kg
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => eliminarInsumoDeModelo(index)}
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded font-bold transition-colors text-sm"
                                                            title="Eliminar este perfil del modelo"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Agregar nuevo insumo a la receta */}
                        <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-200">
                            <label className="block text-xs font-bold text-blue-900 mb-2">
                                + Agregar otro perfil a este modelo:
                            </label>
                            <div className="flex flex-wrap gap-2 items-center">
                                <select
                                    className="flex-1 min-w-[220px] p-2 border border-blue-300 rounded-lg text-xs bg-white font-medium"
                                    value={nuevoInsumoMatId}
                                    onChange={e => setNuevoInsumoMatId(e.target.value)}
                                >
                                    <option value="">-- Selecciona perfil de acero... --</option>
                                    {materiales.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.nombre} ({m.pesoPorMetro} kg/ml • Tramo {m.longitudTramo || 6}m)
                                        </option>
                                    ))}
                                </select>
                                <div className="w-28 flex items-center gap-1">
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Metros"
                                        className="w-full p-2 border border-blue-300 rounded-lg text-xs bg-white font-bold text-center"
                                        value={nuevoInsumoMetros}
                                        onChange={e => setNuevoInsumoMetros(e.target.value)}
                                    />
                                    <span className="text-xs text-gray-500 font-bold">ml</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={agregarInsumoAModeloEnEdicion}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow transition-colors"
                                >
                                    + Agregar Insumo
                                </button>
                            </div>
                        </div>

                        {/* Resumen de totales del modelo */}
                        <div className="flex justify-between items-center bg-gray-900 text-white p-3.5 rounded-xl shadow-inner">
                            <div className="text-xs">
                                <span className="text-gray-400">Total Metros Lineales:</span>{' '}
                                <strong className="text-white text-sm">
                                    {totalMetrosModelo.toFixed(2)} ml
                                </strong>
                            </div>
                            <div className="text-xs">
                                <span className="text-gray-400">Peso Total por Pieza:</span>{' '}
                                <strong className="text-emerald-400 text-base">
                                    {totalKgModelo.toFixed(2)} kg
                                </strong>
                            </div>
                        </div>

                        {/* Botones de acción del modal */}
                        <div className="flex justify-end gap-2 pt-2 border-t">
                            <button
                                type="button"
                                onClick={() => {
                                    setModalEditarModelo(false);
                                    setModeloEnEdicion(null);
                                }}
                                className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow transition-colors flex items-center gap-1.5"
                            >
                                <span>💾</span> Guardar Cambios en el Modelo
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        );
    };

    // AGREGAR O ACTUALIZAR PARTIDA
    const guardarPartida = async () => {
        if (!presupuestoActivo) return;
        if (!modeloSel) {
            alert('Por favor selecciona un modelo estructural.');
            return;
        }

        const mod = modelos.find(m => m.id === modeloSel);
        const nuevosPrecios = [...(presupuestoActivo.preciosMateriales || [])];

        mod?.receta.forEach(req => {
            if (!nuevosPrecios.find(p => p.materialId === req.materialId)) {
                nuevosPrecios.push({ materialId: req.materialId, precioTramo: 0 });
            }
        });

        if (partidaEditandoId) {
            // Modificar partida existente
            const partidasActualizadas = presupuestoActivo.partidas.map(p => {
                if (p.id === partidaEditandoId) {
                    return {
                        ...p,
                        modeloId: modeloSel,
                        codigo: codigo.trim(),
                        descripcion: descripcion.trim() || mod?.nombre || '',
                        cantidad: Number(cantidad) || 1,
                        modulos: Number(modulos) || 1,
                        largo: Number(largo) || 0,
                        ancho: Number(ancho) || 0,
                        tipoPintura
                    };
                }
                return p;
            });

            try {
                await updateDoc(doc(db, 'presupuestos', presupuestoActivo.id), {
                    partidas: partidasActualizadas,
                    preciosMateriales: nuevosPrecios
                });
                cancelarEdicionPartida();
            } catch (error) {
                console.error('Error al modificar partida:', error);
                alert('Error al modificar la partida.');
            }
        } else {
            // Agregar nueva partida
            const nuevaPartida: PartidaPresupuesto = {
                id: Date.now().toString(),
                modeloId: modeloSel,
                codigo: codigo.trim(),
                descripcion: descripcion.trim() || mod?.nombre || '',
                unidad: 'PZA',
                cantidad: Number(cantidad) || 1,
                modulos: Number(modulos) || 1,
                largo: Number(largo) || 0,
                ancho: Number(ancho) || 0,
                tipoPintura
            };

            const nuevasPartidas = [...presupuestoActivo.partidas, nuevaPartida];

            try {
                await updateDoc(doc(db, 'presupuestos', presupuestoActivo.id), {
                    partidas: nuevasPartidas,
                    preciosMateriales: nuevosPrecios
                });

                setModeloSel('');
                setCodigo('');
                setDescripcion('');
                setCantidad('1');
                setModulos('1');
                setLargo('');
                setAncho('');
                setTipoPintura('Ninguna');
            } catch (error) {
                console.error('Error al agregar partida:', error);
                alert('Error al agregar partida.');
            }
        }
    };

    // CARGAR PARTIDA PARA EDITAR
    const cargarPartidaParaEditar = (p: PartidaPresupuesto) => {
        setPartidaEditandoId(p.id);
        setModeloSel(p.modeloId);
        setCodigo(p.codigo);
        setDescripcion(p.descripcion);
        setCantidad(p.cantidad.toString());
        setModulos(p.modulos.toString());
        setLargo(p.largo ? p.largo.toString() : '');
        setAncho(p.ancho ? p.ancho.toString() : '');
        setTipoPintura(p.tipoPintura || 'Ninguna');
        window.scrollTo({ top: 300, behavior: 'smooth' });
    };

    // CANCELAR EDICIÓN DE PARTIDA
    const cancelarEdicionPartida = () => {
        setPartidaEditandoId(null);
        setModeloSel('');
        setCodigo('');
        setDescripcion('');
        setCantidad('1');
        setModulos('1');
        setLargo('');
        setAncho('');
        setTipoPintura('Ninguna');
    };

    // ELIMINAR PARTIDA
    const eliminarPartida = async (id: string, desc: string) => {
        if (!presupuestoActivo) return;
        if (confirm(`¿Eliminar la partida "${desc}"?`)) {
            const partidasFiltradas = presupuestoActivo.partidas.filter(p => p.id !== id);
            try {
                await updateDoc(doc(db, 'presupuestos', presupuestoActivo.id), { partidas: partidasFiltradas });
            } catch (error) {
                console.error('Error al eliminar partida:', error);
                alert('No se pudo eliminar la partida.');
            }
        }
    };

    // ACTUALIZAR PRECIO DE MATERIAL
    const actualizarPrecioMaterial = async (materialId: string, precioTramo: number) => {
        if (!presupuestoActivo) return;
        const nuevosPrecios = (presupuestoActivo.preciosMateriales || []).map(p =>
            p.materialId === materialId ? { ...p, precioTramo } : p
        );
        try {
            await updateDoc(doc(db, 'presupuestos', presupuestoActivo.id), { preciosMateriales: nuevosPrecios });
        } catch (error) {
            console.error('Error actualizando precio:', error);
        }
    };

    // ELIMINAR PRECIO DE MATERIAL (SOLO SI NO ESTÁ EN USO)
    const eliminarPrecioMaterial = async (materialId: string, nombreMat: string, estaEnUso: boolean) => {
        if (!presupuestoActivo) return;
        if (estaEnUso) {
            alert(`El perfil "${nombreMat}" está siendo utilizado por las partidas de este presupuesto y no puede eliminarse.`);
            return;
        }

        if (confirm(`¿Deseas eliminar el perfil "${nombreMat}" de este presupuesto?`)) {
            const nuevosPrecios = (presupuestoActivo.preciosMateriales || []).filter(pm => pm.materialId !== materialId);
            try {
                await updateDoc(doc(db, 'presupuestos', presupuestoActivo.id), { preciosMateriales: nuevosPrecios });
            } catch (error) {
                console.error('Error al eliminar material:', error);
                alert('No se pudo eliminar el material del presupuesto.');
            }
        }
    };

    // LIMPIAR TODOS LOS MATERIALES OBSOLETOS DEL PRESUPUESTO
    const limpiarMaterialesObsoletos = async (idsEnUso: Set<string>) => {
        if (!presupuestoActivo) return;
        if (confirm('¿Deseas eliminar de este presupuesto todos los perfiles obsoletos que ya no se utilizan en ninguna partida?')) {
            const nuevosPrecios = (presupuestoActivo.preciosMateriales || []).filter(pm => idsEnUso.has(pm.materialId));
            try {
                await updateDoc(doc(db, 'presupuestos', presupuestoActivo.id), { preciosMateriales: nuevosPrecios });
                alert('Se eliminaron los perfiles obsoletos correctamente.');
            } catch (error) {
                console.error('Error al limpiar materiales obsoletos:', error);
                alert('Error al limpiar materiales obsoletos.');
            }
        }
    };

    // FIJAR PRECIO GLOBAL POR KILO
    const fijarPrecioGlobalKg = async (nuevoPrecio: number) => {
        if (!presupuestoActivo) return;
        try {
            await updateDoc(doc(db, 'presupuestos', presupuestoActivo.id), { precioGlobalKg: nuevoPrecio });
        } catch (error) {
            console.error('Error actualizando precio global:', error);
        }
    };

    // MOTOR FINANCIERO
    const calcularFinanzasPartida = (partida: PartidaPresupuesto, precioGlobalFijado?: number) => {
        const mod = modelos.find(m => m.id === partida.modeloId);
        let kgTotales = 0;
        let sumaCostoMaterialesBase = 0;

        mod?.receta.forEach(req => {
            const mat = materiales.find(m => m.id === req.materialId);
            if (mat) {
                kgTotales += (req.cantidadMetros * mat.pesoPorMetro);
                const longVenta = mat.longitudTramo || 6;
                const precioTramo = presupuestoActivo?.preciosMateriales?.find(p => p.materialId === mat.id)?.precioTramo || 0;
                const proporcionTramo = req.cantidadMetros / longVenta;
                sumaCostoMaterialesBase += (proporcionTramo * precioTramo);
            }
        });

        const costoMas10 = sumaCostoMaterialesBase * 1.10;
        const costoMasiva = costoMas10 * 1.16;
        const formulaTotalAcero = costoMasiva * 2.30;
        const precioKgCalculado = kgTotales > 0 ? (formulaTotalAcero / kgTotales) : 0;
        const precioKgFinal = (precioGlobalFijado && precioGlobalFijado > 0) ? precioGlobalFijado : precioKgCalculado;
        const precioAceroVenta = kgTotales * precioKgFinal;

        const m2Pintura = (partida.largo * partida.ancho) * 2;
        let costoPintura = 0;
        if (partida.tipoPintura === 'Esmalte') costoPintura = m2Pintura * 225.40;
        else if (partida.tipoPintura === 'Electroestática') costoPintura = m2Pintura * 350.00;

        const precioUnitarioFinal = precioAceroVenta + costoPintura;
        const precioKgCliente = kgTotales > 0 ? (precioUnitarioFinal / kgTotales) : 0;

        return { kgTotales, precioKgCalculado, precioKgFinal, precioKgCliente, m2Pintura, costoPintura, precioUnitarioFinal };
    };

    // EXPORTAR A EXCEL (CSV)
    const exportarExcel = () => {
        if (!presupuestoActivo) return;
        const nombreArchivo = (presupuestoActivo.nombre || presupuestoActivo.desarrollo || 'Presupuesto').replace(/[^a-zA-Z0-9_-]/g, '_');
        let csv = '\uFEFF';
        csv += `Presupuesto:,${presupuestoActivo.nombre || 'Presupuesto'}\n`;
        csv += `Subcontrato:,HERRERÍA\nPromoción:,${presupuestoActivo.promocion}\nDesarrollo:,${presupuestoActivo.desarrollo}\nCiudad:,${presupuestoActivo.ciudad}\nFecha:,${presupuestoActivo.fecha}\nPROVEEDOR:,BENCH\n\n`;
        csv += `Código, Descripción, Unidad, Cantidad, Módulos, Piezas Totales, M2 Pintura, Tipo Pintura, Kg pza, PU. Kg, P. Unitario, SUMA\n`;

        presupuestoActivo.partidas.forEach(p => {
            const finanzas = calcularFinanzasPartida(p, presupuestoActivo.precioGlobalKg);
            const piezasTotales = p.cantidad * p.modulos;
            const suma = finanzas.precioUnitarioFinal * piezasTotales;
            csv += `${p.codigo},"${p.descripcion.replace(/"/g, '""')}",${p.unidad},${p.cantidad},${p.modulos},${piezasTotales},${finanzas.m2Pintura.toFixed(2)},${p.tipoPintura},${finanzas.kgTotales.toFixed(2)},${finanzas.precioKgCliente.toFixed(2)},${finanzas.precioUnitarioFinal.toFixed(2)},${suma.toFixed(2)}\n`;
        });

        csv += `\nPRECIOS NETOS\nPRECIOS POR KG INCLUYEN PINTURA\n`;

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `${nombreArchivo}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calcular gran total de un presupuesto para mostrar en tarjeta
    const calcularTotalPresupuesto = (p: Presupuesto) => {
        let total = 0;
        p.partidas.forEach(partida => {
            const mod = modelos.find(m => m.id === partida.modeloId);
            let kg = 0;
            let sumaMateriales = 0;
            mod?.receta.forEach(req => {
                const mat = materiales.find(m => m.id === req.materialId);
                if (mat) {
                    kg += req.cantidadMetros * mat.pesoPorMetro;
                    const longV = mat.longitudTramo || 6;
                    const pr = p.preciosMateriales?.find(pm => pm.materialId === mat.id)?.precioTramo || 0;
                    sumaMateriales += (req.cantidadMetros / longV) * pr;
                }
            });
            const costoAcero = (p.precioGlobalKg && p.precioGlobalKg > 0)
                ? (kg * p.precioGlobalKg)
                : (sumaMateriales * 1.10 * 1.16 * 2.30);

            const m2P = (partida.largo * partida.ancho) * 2;
            let costoPint = 0;
            if (partida.tipoPintura === 'Esmalte') costoPint = m2P * 225.40;
            else if (partida.tipoPintura === 'Electroestática') costoPint = m2P * 350.00;

            const unitario = costoAcero + costoPint;
            total += unitario * (partida.cantidad * partida.modulos);
        });
        return total;
    };

    // Filtrar presupuestos en el listado
    const presupuestosFiltrados = presupuestos.filter(p => {
        const busq = busqueda.toLowerCase();
        const nom = (p.nombre || '').toLowerCase();
        const des = (p.desarrollo || '').toLowerCase();
        const cli = (p.cliente || '').toLowerCase();
        const pro = (p.promocion || '').toLowerCase();
        return nom.includes(busq) || des.includes(busq) || cli.includes(busq) || pro.includes(busq);
    });

    // ==========================================
    // VISTA DEL PRESUPUESTO ACTIVO (DETALLE)
    // ==========================================
    if (presupuestoActivo) {
        let granTotal = 0;
        let sumatoriaPreciosKgCalculado = 0;
        let modelosConPrecio = 0;

        presupuestoActivo.partidas.forEach(p => {
            const f = calcularFinanzasPartida(p);
            if (f.precioKgCalculado > 0) {
                sumatoriaPreciosKgCalculado += f.precioKgCalculado;
                modelosConPrecio++;
            }
        });

        const promedioCalculado = modelosConPrecio > 0 ? (sumatoriaPreciosKgCalculado / modelosConPrecio) : 0;
        const obraAsociada = obras.find(o => o.id === presupuestoActivo.obraId);

        // Identificar los materiales que realmente están en uso en las partidas actuales
        const idsMaterialesEnUso = new Set<string>();
        presupuestoActivo.partidas.forEach(p => {
            const mod = modelos.find(m => m.id === p.modeloId);
            mod?.receta.forEach(req => {
                idsMaterialesEnUso.add(req.materialId);
            });
        });

        const totalObsoletos = (presupuestoActivo.preciosMateriales || []).filter(pm => !idsMaterialesEnUso.has(pm.materialId)).length;

        return (
            <div className="space-y-6">
                {/* BARRA SUPERIOR DEL PRESUPUESTO */}
                <div className="bg-gray-900 p-5 rounded-xl text-white shadow-xl flex flex-wrap justify-between items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">📝</span>
                            <h2 className="font-extrabold text-xl md:text-2xl text-white">
                                {presupuestoActivo.nombre || `Cotización: ${presupuestoActivo.desarrollo}`}
                            </h2>
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] px-2.5 py-0.5 rounded-full font-semibold">
                                ✓ Guardado en Nube
                            </span>
                        </div>
                        <p className="text-xs text-gray-300">
                            <strong>Desarrollo:</strong> {presupuestoActivo.desarrollo} ({presupuestoActivo.promocion}) &nbsp;|&nbsp;
                            <strong> Cliente:</strong> {presupuestoActivo.cliente} &nbsp;|&nbsp;
                            <strong> Fecha:</strong> {presupuestoActivo.fecha}
                            {obraAsociada && (
                                <span className="ml-2 text-blue-400 font-semibold">
                                    • Obra vinculada: {obraAsociada.nombre}
                                </span>
                            )}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => abrirEdicionPresupuesto(presupuestoActivo)}
                            className="bg-yellow-600 hover:bg-yellow-500 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition-colors"
                            title="Editar nombre, cliente, desarrollo o fecha"
                        >
                            <span>✏️</span> Editar Datos
                        </button>
                        <button
                            type="button"
                            onClick={exportarExcel}
                            className="bg-emerald-600 hover:bg-emerald-500 px-3.5 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition-colors"
                        >
                            <span>📊</span> Excel
                        </button>
                        <button
                            type="button"
                            onClick={() => window.print()}
                            className="bg-blue-600 hover:bg-blue-500 px-3.5 py-2 rounded-lg text-xs font-bold shadow flex items-center gap-1.5 transition-colors"
                        >
                            <span>🖨️</span> PDF
                        </button>
                        <button
                            type="button"
                            onClick={() => eliminarPresupuesto(presupuestoActivo.id, presupuestoActivo.nombre || presupuestoActivo.desarrollo)}
                            className="bg-red-900/60 hover:bg-red-700 text-red-200 hover:text-white border border-red-700/60 px-3 py-2 rounded-lg text-xs font-bold transition-colors"
                            title="Eliminar este presupuesto permanentemente"
                        >
                            🗑️ Borrar
                        </button>
                        <button
                            type="button"
                            onClick={() => setPresupuestoActivo(null)}
                            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded-lg text-xs font-bold text-gray-200 transition-colors"
                        >
                            ✕ Volver al Listado
                        </button>
                    </div>
                </div>

                {/* MODAL PARA EDITAR DATOS GENERALES DEL PRESUPUESTO */}
                {modalEditarPresupuesto && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-gray-200">
                            <div className="flex justify-between items-center border-b pb-3 mb-4">
                                <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                    <span>✏️</span> Modificar Datos del Presupuesto
                                </h3>
                                <button
                                    onClick={() => setModalEditarPresupuesto(false)}
                                    className="text-gray-400 hover:text-gray-600 font-bold"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={guardarEdicionPresupuesto} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Nombre del Presupuesto <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ej. Presupuesto Herrería 60u Tesistán"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                                        value={formCabecera.nombre}
                                        onChange={e => setFormCabecera({ ...formCabecera, nombre: e.target.value })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Vincular a Obra Existente (Opcional)
                                    </label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                                        value={formCabecera.obraId}
                                        onChange={e => manejarSeleccionObra(e.target.value)}
                                    >
                                        <option value="">-- Sin obra vinculada (Independiente) --</option>
                                        {obras.map(o => (
                                            <option key={o.id} value={o.id}>
                                                {o.nombre} ({o.cliente})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Desarrollo / Proyecto</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-2 border border-gray-300 rounded text-sm uppercase"
                                            value={formCabecera.desarrollo}
                                            onChange={e => setFormCabecera({ ...formCabecera, desarrollo: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Promoción / Etapa</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-2 border border-gray-300 rounded text-sm"
                                            value={formCabecera.promocion}
                                            onChange={e => setFormCabecera({ ...formCabecera, promocion: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Cliente</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-2 border border-gray-300 rounded text-sm"
                                            value={formCabecera.cliente}
                                            onChange={e => setFormCabecera({ ...formCabecera, cliente: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">Ciudad</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full p-2 border border-gray-300 rounded text-sm uppercase"
                                            value={formCabecera.ciudad}
                                            onChange={e => setFormCabecera({ ...formCabecera, ciudad: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Fecha</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        value={formCabecera.fecha}
                                        onChange={e => setFormCabecera({ ...formCabecera, fecha: e.target.value })}
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t">
                                    <button
                                        type="button"
                                        onClick={() => setModalEditarPresupuesto(false)}
                                        className="px-4 py-2 border rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow"
                                    >
                                        Guardar Modificaciones
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL PARA EDITAR INSUMOS DEL MODELO ESTRUCTURAL */}
                {renderModalEditarModelo()}

                {/* CUERPO DEL COTIZADOR */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    {/* PANEL IZQUIERDO: PRECIOS BASE DE MATERIALES */}
                    <div className="xl:col-span-1 bg-white p-5 rounded-xl border border-gray-200 shadow-sm self-start">
                        <div className="flex justify-between items-center mb-2 border-b pb-2">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                <span>🔩</span> 1. Precios Base (Factura / Tramo)
                            </h3>
                            {totalObsoletos > 0 && (
                                <button
                                    type="button"
                                    onClick={() => limpiarMaterialesObsoletos(idsMaterialesEnUso)}
                                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 px-2 py-0.5 rounded text-[10px] font-bold transition-colors flex items-center gap-1 shadow-sm"
                                    title="Eliminar todos los materiales que ya no se usan en ninguna partida"
                                >
                                    <span>🧹</span> Limpiar obsoletos ({totalObsoletos})
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Costo por tramo de los perfiles usados en esta cotización para calcular la venta por kg.
                        </p>
                        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                            {(!presupuestoActivo.preciosMateriales || presupuestoActivo.preciosMateriales.length === 0) && (
                                <p className="text-xs italic text-gray-400 bg-gray-50 p-3 rounded">
                                    Agrega conceptos al presupuesto para ver aquí los perfiles necesarios.
                                </p>
                            )}
                            {presupuestoActivo.preciosMateriales?.map(pm => {
                                const mat = materiales.find(m => m.id === pm.materialId);
                                const estaEnUso = idsMaterialesEnUso.has(pm.materialId);
                                const nombreMostrar = mat?.nombre || pm.materialId;

                                return (
                                    <div
                                        key={pm.materialId}
                                        className={`flex justify-between items-center p-2.5 rounded-lg border text-xs transition-colors ${
                                            estaEnUso ? 'bg-gray-50 border-gray-200' : 'bg-amber-50/70 border-amber-300 shadow-sm'
                                        }`}
                                    >
                                        <div className="pr-2 truncate flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <span className="font-bold text-gray-800 truncate" title={nombreMostrar}>
                                                    {nombreMostrar}
                                                </span>
                                                {estaEnUso ? (
                                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded-full whitespace-nowrap" title="En uso por una o más partidas">
                                                        En uso
                                                    </span>
                                                ) : (
                                                    <span className="text-[9px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.2 rounded-full whitespace-nowrap" title="Obsoleto: ya no se usa en ninguna partida">
                                                        Obsoleto
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-500 block">
                                                {mat?.pesoPorMetro ? `${mat.pesoPorMetro} kg/m • ` : ''}Tramo {mat?.longitudTramo || 6}m
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <div className="flex items-center gap-1 w-24">
                                                <span className="text-gray-500 font-bold">$</span>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className="w-full p-1.5 border border-blue-300 rounded text-right font-bold text-blue-700 bg-white shadow-inner focus:ring-1 focus:ring-blue-500 text-xs"
                                                    value={pm.precioTramo || ''}
                                                    onChange={e => actualizarPrecioMaterial(pm.materialId, Number(e.target.value))}
                                                    placeholder="0.00"
                                                />
                                            </div>

                                            {/* BOTÓN DE BORRAR PERFIL: SOLO DISPONIBLE SI YA NO SE USA */}
                                            {estaEnUso ? (
                                                <span
                                                    className="p-1 text-gray-300 cursor-not-allowed text-xs select-none"
                                                    title="No se puede borrar porque está en uso en las partidas del presupuesto"
                                                >
                                                    🔒
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => eliminarPrecioMaterial(pm.materialId, nombreMostrar, estaEnUso)}
                                                    className="bg-red-50 hover:bg-red-200 text-red-600 border border-red-300 p-1.5 rounded text-xs font-bold transition-colors"
                                                    title="Eliminar este perfil obsoleto de este presupuesto"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* PANEL DERECHO: AGREGAR O MODIFICAR CONCEPTO */}
                    <div className="xl:col-span-2 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                            <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                <span>📐</span>
                                {partidaEditandoId ? (
                                    <span className="text-amber-700 font-extrabold">2. Modificando Concepto Seleccionado</span>
                                ) : (
                                    <span>2. Agregar Concepto al Presupuesto</span>
                                )}
                            </h3>
                            <div className="flex gap-2">
                                {partidaEditandoId && (
                                    <button
                                        type="button"
                                        onClick={cancelarEdicionPartida}
                                        className="text-xs bg-gray-400 hover:bg-gray-500 text-white px-3 py-1 rounded font-bold transition-colors"
                                    >
                                        Cancelar Edición
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => abrirEditorModelo(modeloSel || undefined)}
                                    className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded font-bold transition-colors shadow flex items-center gap-1"
                                    title="Editar perfiles o metros de los modelos de herrería"
                                >
                                    <span>✏️</span> Editar Modelos
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMostrarAltaModelo(!mostrarAltaModelo)}
                                    className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 font-bold transition-colors shadow"
                                >
                                    {mostrarAltaModelo ? 'Cancelar Alta' : '+ Crear Nuevo Modelo'}
                                </button>
                            </div>
                        </div>

                        {/* ALTA RÁPIDA DE MODELO */}
                        {mostrarAltaModelo && (
                            <div className="bg-emerald-50 p-4 border border-emerald-200 rounded-lg mb-5 shadow-inner">
                                <h4 className="text-xs font-bold text-emerald-900 mb-2 border-b border-emerald-200 pb-1">
                                    Alta Rápida de Modelo Estructural a la Nube
                                </h4>
                                <input
                                    type="text"
                                    placeholder="Nombre Comercial (Ej. Puerta Louver 1x2m)"
                                    className="w-full p-2 border border-emerald-300 rounded text-sm mb-3 bg-white"
                                    value={nuevoModNombre}
                                    onChange={e => setNuevoModNombre(e.target.value)}
                                />
                                <div className="flex flex-wrap gap-2 mb-2">
                                    <select
                                        className="flex-1 min-w-[200px] p-2 border border-emerald-300 rounded text-sm bg-white"
                                        value={tempMatId}
                                        onChange={e => setTempMatId(e.target.value)}
                                    >
                                        <option value="">Selecciona Perfil de Acero...</option>
                                        {materiales.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.nombre} ({m.pesoPorMetro} kgs/ml)
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number"
                                        step="0.01"
                                        placeholder="Metros"
                                        className="w-24 p-2 border border-emerald-300 rounded text-sm bg-white"
                                        value={tempMatCant}
                                        onChange={e => setTempMatCant(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={agregarInsumoAlNuevoModelo}
                                        className="bg-emerald-800 text-white px-4 rounded font-bold text-sm hover:bg-emerald-900"
                                    >
                                        +
                                    </button>
                                </div>
                                <ul className="text-xs text-gray-700 mb-3 list-disc pl-5">
                                    {nuevoModReceta.map((r, i) => (
                                        <li key={i}>
                                            {materiales.find(m => m.id === r.materialId)?.nombre} - {r.cantidadMetros} m
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    type="button"
                                    onClick={guardarNuevoModelo}
                                    className="w-full bg-emerald-700 text-white py-2 rounded text-xs font-bold hover:bg-emerald-800 transition-colors shadow"
                                >
                                    Guardar Modelo en la Nube y Usar
                                </button>
                            </div>
                        )}

                        {/* FORMULARIO DE PARTIDA */}
                        <div className={`p-4 rounded-lg border ${partidaEditandoId ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                                <div className="col-span-2">
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold text-gray-700">
                                            Modelo Estructural <span className="text-red-500">*</span>
                                        </label>
                                        {modeloSel && (
                                            <button
                                                type="button"
                                                onClick={() => abrirEditorModelo(modeloSel)}
                                                className="text-[10px] text-purple-700 hover:text-purple-900 font-bold flex items-center gap-1 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.5 rounded border border-purple-200 transition-colors"
                                                title="Editar los insumos (materiales y metros) de este modelo"
                                            >
                                                <span>✏️</span> Editar Insumos
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:ring-1 focus:ring-blue-500"
                                        value={modeloSel}
                                        onChange={e => {
                                            setModeloSel(e.target.value);
                                            const mod = modelos.find(m => m.id === e.target.value);
                                            if (mod && !descripcion) setDescripcion(mod.nombre);
                                        }}
                                    >
                                        <option value="">Selecciona modelo...</option>
                                        {modelos.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Código</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                        placeholder="Ej. H-10"
                                        value={codigo}
                                        onChange={e => setCodigo(e.target.value)}
                                    />
                                </div>
                                <div className="col-span-2 md:col-span-3">
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Descripción Comercial</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
                                        value={descripcion}
                                        onChange={e => setDescripcion(e.target.value)}
                                        placeholder="Descripción para el presupuesto..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Cant/Mod</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded text-sm bg-white font-bold"
                                        value={cantidad}
                                        onChange={e => setCantidad(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Módulos</label>
                                    <input
                                        type="number"
                                        className="w-full p-2 border border-gray-300 rounded text-sm bg-white font-bold"
                                        value={modulos}
                                        onChange={e => setModulos(e.target.value)}
                                    />
                                </div>
                                <div className="border-l border-purple-200 pl-3">
                                    <label className="block text-xs font-bold text-purple-800 mb-1">Largo (m)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full p-2 border border-purple-300 rounded text-sm bg-white"
                                        value={largo}
                                        onChange={e => setLargo(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-purple-800 mb-1">Ancho (m)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="w-full p-2 border border-purple-300 rounded text-sm bg-white"
                                        value={ancho}
                                        onChange={e => setAncho(e.target.value)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-purple-800 mb-1">Acabado (Pintura)</label>
                                    <select
                                        className="w-full p-2 border border-purple-300 rounded text-sm bg-purple-50 font-semibold"
                                        value={tipoPintura}
                                        onChange={e => setTipoPintura(e.target.value as any)}
                                    >
                                        <option value="Ninguna">Sin Pintura</option>
                                        <option value="Esmalte">Esmalte ($225.40/m²)</option>
                                        <option value="Electroestática">Electroestática ($350.00/m²)</option>
                                    </select>
                                </div>

                                <div className="col-span-2 md:col-span-6 flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={guardarPartida}
                                        className={`flex-1 font-bold py-2.5 rounded-lg text-sm text-white shadow transition-colors ${
                                            partidaEditandoId
                                                ? 'bg-amber-600 hover:bg-amber-700'
                                                : 'bg-blue-600 hover:bg-blue-700'
                                        }`}
                                    >
                                        {partidaEditandoId ? '✓ Guardar Cambios de la Partida' : '+ Añadir Concepto al Presupuesto'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* TABLA DE PARTIDAS COTIZADAS */}
                <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm mt-6">
                    <div className="p-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                            Partidas Registradas ({presupuestoActivo.partidas.length})
                        </span>
                        <span className="text-xs text-gray-500">
                            Precios calculados con base en el acero y pintura
                        </span>
                    </div>
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-gray-100 border-b text-gray-700">
                            <tr>
                                <th className="p-2.5">Cód</th>
                                <th className="p-2.5 min-w-[200px]">Descripción</th>
                                <th className="p-2.5 text-center">Pzas Tot</th>
                                <th className="p-2.5 text-center text-purple-800 bg-purple-50">M² Pintura</th>
                                <th className="p-2.5 text-center text-yellow-800 bg-yellow-50">Kg pza</th>
                                <th className="p-2.5 text-right text-gray-400">P.U. Base</th>
                                <th className="p-2.5 text-right">PU. Kg Final</th>
                                <th className="p-2.5 text-right bg-blue-50 text-blue-900 font-bold">P. Unit. (Pza)</th>
                                <th className="p-2.5 text-right font-bold text-emerald-700">SUMA TOTAL</th>
                                <th className="p-2.5 text-center min-w-[150px]">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {presupuestoActivo.partidas.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-gray-400 italic">
                                        Sin partidas agregadas. Añade conceptos arriba para armar la cotización.
                                    </td>
                                </tr>
                            ) : (
                                presupuestoActivo.partidas.map(p => {
                                    const finanzas = calcularFinanzasPartida(p, presupuestoActivo.precioGlobalKg);
                                    const piezasTotales = p.cantidad * p.modulos;
                                    const suma = finanzas.precioUnitarioFinal * piezasTotales;
                                    granTotal += suma;
                                    const estaEditando = partidaEditandoId === p.id;

                                    return (
                                        <tr key={p.id} className={estaEditando ? 'bg-amber-100/70 font-semibold' : 'hover:bg-gray-50'}>
                                            <td className="p-2.5 font-bold text-gray-800">{p.codigo || '-'}</td>
                                            <td className="p-2.5 text-gray-700 whitespace-normal min-w-[240px] text-[11px] leading-tight">
                                                <span className="block font-semibold mb-0.5">{p.descripcion}</span>
                                                {p.tipoPintura !== 'Ninguna' && (
                                                    <span className="text-purple-600 font-medium block text-[10px]">
                                                        Pintura {p.tipoPintura} ({finanzas.m2Pintura.toFixed(2)} m²) = +${finanzas.costoPintura.toFixed(2)}/pza
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2.5 text-center font-bold text-gray-900">{piezasTotales}</td>
                                            <td className="p-2.5 text-center bg-purple-50/40 text-purple-700 font-medium">
                                                {finanzas.m2Pintura.toFixed(2)} m²
                                            </td>
                                            <td className="p-2.5 text-center font-bold text-yellow-700 bg-yellow-50/40">
                                                {finanzas.kgTotales.toFixed(2)}
                                            </td>
                                            <td className="p-2.5 text-right font-medium text-gray-400 line-through">
                                                ${finanzas.precioKgCalculado.toFixed(2)}
                                            </td>
                                            <td className="p-2.5 text-right font-bold text-gray-800" title={`Base acero: $${finanzas.precioKgFinal.toFixed(2)}`}>
                                                ${finanzas.precioKgCliente.toFixed(2)}
                                            </td>
                                            <td className="p-2.5 text-right font-black text-blue-700 bg-blue-50/30">
                                                ${finanzas.precioUnitarioFinal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-2.5 text-right font-black text-emerald-700 bg-emerald-50/20">
                                                ${suma.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-2.5 text-center space-x-1 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => cargarPartidaParaEditar(p)}
                                                    className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-bold px-2 py-1 rounded text-[11px] transition-colors"
                                                    title="Modificar esta partida"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => abrirEditorModelo(p.modeloId)}
                                                    className="bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold px-2 py-1 rounded text-[11px] transition-colors"
                                                    title="Editar materiales y medidas del modelo de herrería"
                                                >
                                                    📐 Modelo
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => eliminarPartida(p.id, p.descripcion)}
                                                    className="bg-red-100 hover:bg-red-200 text-red-700 font-bold px-2 py-1 rounded text-[11px] transition-colors"
                                                    title="Eliminar partida"
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

                {/* PIE FINANCIERO Y RESUMEN */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-center">
                    <div className="bg-white border border-gray-300 p-4 rounded-xl shadow-sm text-center">
                        <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                            Promedio Base Calculado (Solo Acero):
                        </span>
                        <span className="block text-2xl font-black text-gray-700 mt-1">
                            ${promedioCalculado.toFixed(2)} <span className="text-xs font-normal text-gray-500">/ Kg</span>
                        </span>
                    </div>

                    <div className="bg-blue-50 border border-blue-300 p-4 rounded-xl shadow-sm text-center">
                        <span className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
                            Ajustar Precio Global por Kg:
                        </span>
                        <div className="flex justify-center items-center gap-1">
                            <span className="font-bold text-blue-900 text-lg">$</span>
                            <input
                                type="number"
                                step="0.01"
                                className="w-32 p-2 border border-blue-400 rounded-lg text-center font-black text-blue-900 bg-white shadow-inner text-base"
                                value={presupuestoActivo.precioGlobalKg || ''}
                                onChange={e => fijarPrecioGlobalKg(Number(e.target.value))}
                                placeholder={promedioCalculado.toFixed(2)}
                            />
                        </div>
                        <span className="block text-[10px] text-blue-700 mt-1">
                            Deja en 0 para usar los precios individuales calculados.
                        </span>
                    </div>

                    <div className="text-right bg-gray-900 text-white p-5 rounded-xl shadow-xl flex flex-col justify-center">
                        <span className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                            Gran Total Cotizado:
                        </span>
                        <span className="block text-3xl font-black text-emerald-400">
                            ${granTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>

                {/* FORMATO OCULTO PARA IMPRESIÓN (PDF) */}
                <div className="hidden print:block fixed top-0 left-0 w-full h-full z-50 bg-white p-6">
                    <style type="text/css" media="print">
                        {`@page { size: landscape; margin: 10mm; } body {-webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
                    </style>
                    <div className="flex justify-between items-start mb-6">
                        <table className="text-xs">
                            <tbody>
                                <tr><td className="font-bold pr-4">Presupuesto:</td><td className="font-bold text-base">{presupuestoActivo.nombre || presupuestoActivo.desarrollo}</td></tr>
                                <tr><td className="font-bold pr-4">Subcontrato:</td><td>HERRERÍA</td></tr>
                                <tr><td className="font-bold pr-4">Promoción:</td><td>{presupuestoActivo.promocion}</td></tr>
                                <tr><td className="font-bold pr-4">Desarrollo:</td><td>{presupuestoActivo.desarrollo}</td></tr>
                                <tr><td className="font-bold pr-4">Ciudad:</td><td>{presupuestoActivo.ciudad}</td></tr>
                                <tr><td className="font-bold pr-4">Fecha:</td><td>{presupuestoActivo.fecha}</td></tr>
                                <tr><td className="font-bold pr-4">PROVEEDOR:</td><td className="font-bold text-lg">BENCH</td></tr>
                            </tbody>
                        </table>
                        <img src="/logo.jpeg" alt="Bench" className="h-16 object-contain" />
                    </div>
                    <table className="w-full text-center border-collapse border border-black text-[10px]">
                        <thead className="bg-gray-200 font-bold">
                            <tr>
                                <th className="border border-black p-1">Código</th>
                                <th className="border border-black p-1 text-left">Descripción</th>
                                <th className="border border-black p-1">U.</th>
                                <th className="border border-black p-1">Cant</th>
                                <th className="border border-black p-1">Mod</th>
                                <th className="border border-black p-1">Pzas Tot</th>
                                <th className="border border-black p-1">PU. Kg</th>
                                <th className="border border-black p-1">Kg pza</th>
                                <th className="border border-black p-1">P. Unitario</th>
                                <th className="border border-black p-1">SUMA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {presupuestoActivo.partidas.map(p => {
                                const fin = calcularFinanzasPartida(p, presupuestoActivo.precioGlobalKg);
                                const pzas = p.cantidad * p.modulos;
                                const pinturaDesc = p.tipoPintura !== 'Ninguna' ? ` (Incluye ${fin.m2Pintura.toFixed(2)}m² de Pintura ${p.tipoPintura})` : '';
                                return (
                                    <tr key={p.id}>
                                        <td className="border border-black p-1">{p.codigo}</td>
                                        <td className="border border-black p-1 text-left">{p.descripcion}{pinturaDesc}</td>
                                        <td className="border border-black p-1">{p.unidad}</td>
                                        <td className="border border-black p-1">{p.cantidad}</td>
                                        <td className="border border-black p-1">{p.modulos}</td>
                                        <td className="border border-black p-1 font-bold">{pzas}</td>
                                        <td className="border border-black p-1">${fin.precioKgCliente.toFixed(2)}</td>
                                        <td className="border border-black p-1">{fin.kgTotales.toFixed(2)}</td>
                                        <td className="border border-black p-1">${fin.precioUnitarioFinal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        <td className="border border-black p-1 font-bold">${(fin.precioUnitarioFinal * pzas).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                );
                            })}
                            <tr>
                                <td colSpan={9} className="border border-black p-1 text-right font-bold">TOTAL:</td>
                                <td className="border border-black p-1 font-bold bg-gray-100">${granTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* LEYENDAS INFERIORES */}
                    <div className="mt-4 text-[11px] font-bold text-black uppercase space-y-1">
                        <p className="font-black tracking-wide">PRECIOS NETOS</p>
                        <p className="font-black tracking-wide">PRECIOS POR KG INCLUYEN PINTURA</p>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // VISTA PRINCIPAL: LISTADO Y ALTA DE PRESUPUESTOS
    // ==========================================
    return (
        <div className="space-y-6">
            {/* PANEL PARA CREAR Y GUARDAR UN NUEVO PRESUPUESTO */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex justify-between items-center mb-4 border-b pb-3">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>📝</span> Crear y Guardar Nuevo Presupuesto
                        </h3>
                        <p className="text-xs text-gray-500">
                            Asigna un nombre al presupuesto y selecciónalo si pertenece a una obra específica.
                        </p>
                    </div>
                </div>

                <form onSubmit={crearPresupuesto} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-5">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Nombre del Presupuesto <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="Ej. Presupuesto Herrería 60u Tesistán"
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                            value={formCabecera.nombre}
                            onChange={e => setFormCabecera({ ...formCabecera, nombre: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-4">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Vincular con Obra (Opcional)
                        </label>
                        <select
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm bg-white"
                            value={formCabecera.obraId}
                            onChange={e => manejarSeleccionObra(e.target.value)}
                        >
                            <option value="">-- Sin obra vinculada (Independiente) --</option>
                            {obras.map(o => (
                                <option key={o.id} value={o.id}>
                                    {o.nombre} ({o.cliente})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Desarrollo / Proyecto <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="Ej. TESISTÁN"
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm uppercase"
                            value={formCabecera.desarrollo}
                            onChange={e => setFormCabecera({ ...formCabecera, desarrollo: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Promoción / Etapa <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="Ej. 60u, Etapa 1"
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                            value={formCabecera.promocion}
                            onChange={e => setFormCabecera({ ...formCabecera, promocion: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Cliente <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="Ej. GRUPO SAN CARLOS"
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm"
                            value={formCabecera.cliente}
                            onChange={e => setFormCabecera({ ...formCabecera, cliente: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Ciudad</label>
                        <input
                            type="text"
                            placeholder="Ej. ZAPOPAN"
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm uppercase"
                            value={formCabecera.ciudad}
                            onChange={e => setFormCabecera({ ...formCabecera, ciudad: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Fecha</label>
                        <input
                            required
                            type="date"
                            className="w-full p-2.5 border border-gray-300 rounded-lg text-sm text-gray-800"
                            value={formCabecera.fecha}
                            onChange={e => setFormCabecera({ ...formCabecera, fecha: e.target.value })}
                        />
                    </div>

                    <div className="md:col-span-12 flex justify-end mt-2">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-lg shadow-md transition-colors text-sm flex items-center gap-2"
                        >
                            <span>💾</span> Guardar y Abrir Presupuesto
                        </button>
                    </div>
                </form>
            </div>

            {/* MODAL PARA EDITAR DATOS GENERALES (DESDE EL LISTADO) */}
            {modalEditarPresupuesto && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full p-6 border border-gray-200">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                                <span>✏️</span> Modificar Datos del Presupuesto
                            </h3>
                            <button
                                onClick={() => setModalEditarPresupuesto(false)}
                                className="text-gray-400 hover:text-gray-600 font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={guardarEdicionPresupuesto} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Nombre del Presupuesto <span className="text-red-500">*</span>
                                </label>
                                <input
                                    required
                                    type="text"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-blue-500"
                                    value={formCabecera.nombre}
                                    onChange={e => setFormCabecera({ ...formCabecera, nombre: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Vincular a Obra Existente (Opcional)
                                </label>
                                <select
                                    className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white"
                                    value={formCabecera.obraId}
                                    onChange={e => manejarSeleccionObra(e.target.value)}
                                >
                                    <option value="">-- Sin obra vinculada (Independiente) --</option>
                                    {obras.map(o => (
                                        <option key={o.id} value={o.id}>
                                            {o.nombre} ({o.cliente})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Desarrollo / Proyecto</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded text-sm uppercase"
                                        value={formCabecera.desarrollo}
                                        onChange={e => setFormCabecera({ ...formCabecera, desarrollo: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Promoción / Etapa</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        value={formCabecera.promocion}
                                        onChange={e => setFormCabecera({ ...formCabecera, promocion: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Cliente</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded text-sm"
                                        value={formCabecera.cliente}
                                        onChange={e => setFormCabecera({ ...formCabecera, cliente: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Ciudad</label>
                                    <input
                                        required
                                        type="text"
                                        className="w-full p-2 border border-gray-300 rounded text-sm uppercase"
                                        value={formCabecera.ciudad}
                                        onChange={e => setFormCabecera({ ...formCabecera, ciudad: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Fecha</label>
                                <input
                                    required
                                    type="date"
                                    className="w-full p-2 border border-gray-300 rounded text-sm"
                                    value={formCabecera.fecha}
                                    onChange={e => setFormCabecera({ ...formCabecera, fecha: e.target.value })}
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <button
                                    type="button"
                                    onClick={() => setModalEditarPresupuesto(false)}
                                    className="px-4 py-2 border rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow"
                                >
                                    Guardar Modificaciones
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL PARA EDITAR INSUMOS DEL MODELO ESTRUCTURAL */}
            {renderModalEditarModelo()}

            {/* LISTADO DE PRESUPUESTOS GUARDADOS */}
            <div>
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>📂</span> Presupuestos Guardados en la Nube ({presupuestos.length})
                        </h3>
                        <p className="text-xs text-gray-500">
                            Selecciona cualquier presupuesto para abrirlo, modificarlo o eliminarlo.
                        </p>
                    </div>

                    <input
                        type="text"
                        placeholder="🔍 Buscar presupuesto por nombre, cliente..."
                        className="p-2 px-3 border border-gray-300 rounded-lg text-xs w-72 bg-white"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {presupuestosFiltrados.length === 0 ? (
                        <div className="col-span-full bg-white p-12 text-center rounded-xl border border-dashed border-gray-300 text-gray-400">
                            {presupuestos.length === 0
                                ? 'No hay presupuestos guardados aún. Llena el formulario superior para crear el primero.'
                                : 'No se encontraron presupuestos que coincidan con la búsqueda.'}
                        </div>
                    ) : (
                        presupuestosFiltrados.map(p => {
                            const totalEstimado = calcularTotalPresupuesto(p);
                            const obraVinculada = obras.find(o => o.id === p.obraId);

                            return (
                                <div
                                    key={p.id}
                                    className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <h4 className="font-extrabold text-base text-gray-900 leading-snug">
                                                {p.nombre || p.desarrollo}
                                            </h4>
                                            <span className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-bold whitespace-nowrap">
                                                {p.partidas?.length || 0} ptds
                                            </span>
                                        </div>

                                        <p className="text-xs text-gray-600 mb-1">
                                            <strong>Cliente:</strong> {p.cliente || 'Sin cliente'}
                                        </p>
                                        <p className="text-xs text-gray-500 mb-1">
                                            <strong>Desarrollo:</strong> {p.desarrollo} {p.promocion ? `(${p.promocion})` : ''}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mb-3">
                                            Fecha: {p.fecha}
                                        </p>

                                        {obraVinculada && (
                                            <div className="mb-3 bg-gray-50 p-1.5 px-2.5 rounded border border-gray-200 text-[11px] text-blue-700 font-semibold flex items-center gap-1.5">
                                                <span>🏗️</span>
                                                <span className="truncate">Obra: {obraVinculada.nombre}</span>
                                            </div>
                                        )}

                                        <div className="bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200/60 mb-4 flex justify-between items-center">
                                            <span className="text-xs text-emerald-800 font-medium">Total Estimado:</span>
                                            <span className="text-base font-black text-emerald-700">
                                                ${totalEstimado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-gray-100">
                                        <button
                                            type="button"
                                            onClick={() => setPresupuestoActivo(p)}
                                            className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2.5 rounded-lg text-xs font-bold transition-colors shadow flex items-center justify-center gap-2"
                                        >
                                            <span>📂</span> Abrir Cuadro de Precios
                                        </button>

                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => abrirEdicionPresupuesto(p)}
                                                className="bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-200 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                                title="Cambiar nombre, obra vinculada o datos"
                                            >
                                                <span>✏️</span> Editar
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => eliminarPresupuesto(p.id, p.nombre || p.desarrollo)}
                                                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1"
                                                title="Borrar presupuesto"
                                            >
                                                <span>🗑️</span> Borrar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
