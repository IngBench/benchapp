import { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Material, ModeloHerreria, MaterialRequerido } from '../types';

export default function ModelosHerreria() {
    // MATERIALES Y MODELOS CONECTADOS A FIREBASE EN TIEMPO REAL
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [modelos, setModelos] = useState<ModeloHerreria[]>([]);

    const [nombre, setNombre] = useState('');
    const [receta, setReceta] = useState<MaterialRequerido[]>([]);
    const [matId, setMatId] = useState('');
    const [cantidad, setCantidad] = useState('');

    // Estado para controlar la edición
    const [editandoId, setEditandoId] = useState<string | null>(null);

    // VIGILANTES DE FIREBASE
    useEffect(() => {
        const desuscribirModelos = onSnapshot(collection(db, 'modelos'), (snapshot) => {
            const modelosData = snapshot.docs.map(doc => doc.data() as ModeloHerreria);
            setModelos(modelosData);
        });
        const desuscribirMateriales = onSnapshot(collection(db, 'materiales'), (snapshot) => {
            const matData = snapshot.docs.map(doc => doc.data() as Material);
            setMateriales(matData);
        });
        return () => {
            desuscribirModelos();
            desuscribirMateriales();
        };
    }, []);

    const agregarMaterial = () => {
        if (!matId || !cantidad) return;
        setReceta([...receta, { materialId: matId, cantidadMetros: Number(cantidad) }]);
        setMatId('');
        setCantidad('');
    };

    const quitarMaterialDeReceta = (index: number) => {
        setReceta(receta.filter((_, i) => i !== index));
    };

    // Guardar o actualizar modelo
    const guardarModelo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nombre.trim()) {
            alert('Por favor asigna un nombre al modelo.');
            return;
        }
        if (receta.length === 0) {
            alert('La receta debe incluir al menos un material de acero.');
            return;
        }

        try {
            if (editandoId) {
                await updateDoc(doc(db, 'modelos', editandoId), {
                    nombre: nombre.trim(),
                    receta
                });
                setEditandoId(null);
            } else {
                const nuevoId = Date.now().toString();
                const nuevoModelo: ModeloHerreria = {
                    id: nuevoId,
                    nombre: nombre.trim(),
                    receta
                };
                await setDoc(doc(db, 'modelos', nuevoId), nuevoModelo);
            }

            setNombre('');
            setReceta([]);
        } catch (error) {
            console.error('Error al guardar el modelo en la nube:', error);
            alert('Hubo un error al sincronizar con el servidor.');
        }
    };

    const cargarParaEditar = (modelo: ModeloHerreria) => {
        setNombre(modelo.nombre);
        setReceta(modelo.receta);
        setEditandoId(modelo.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const cancelarEdicion = () => {
        setNombre('');
        setReceta([]);
        setEditandoId(null);
        setMatId('');
        setCantidad('');
    };

    // Eliminar modelo
    const eliminarModelo = async (id: string) => {
        if (confirm('¿Estás seguro de dar de baja este modelo del catálogo?')) {
            try {
                await deleteDoc(doc(db, 'modelos', id));
                if (editandoId === id) cancelarEdicion();
            } catch (error) {
                console.error('Error al eliminar el modelo:', error);
                alert('No se pudo eliminar el registro del servidor.');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className={`p-6 rounded-lg border shadow-sm ${editandoId ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <span>📐</span>
                        {editandoId ? 'Modificar Receta Existente' : 'Armar Explosión de Insumos (Volumetría de Modelo)'}
                    </h3>
                    {editandoId && (
                        <button onClick={cancelarEdicion} className="text-xs bg-gray-500 text-white px-3 py-1.5 rounded hover:bg-gray-600 font-bold">
                            Cancelar Edición
                        </button>
                    )}
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Elemento / Modelo (Ej. Zaguán PTR 2x2, Reja Tipo A...)</label>
                    <input
                        type="text"
                        placeholder="Escribe el nombre del modelo..."
                        className="w-full p-2.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        value={nombre}
                        onChange={e => setNombre(e.target.value)}
                    />
                </div>

                {/* Selección de material del catálogo */}
                <div className="flex flex-wrap gap-2 items-end mb-4 bg-gray-100 p-4 rounded-lg border border-gray-200">
                    <div className="flex-1 min-w-[240px]">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Perfil Requerido (Catálogo de Materiales)
                        </label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded text-sm bg-white focus:ring-2 focus:ring-blue-500"
                            value={matId}
                            onChange={e => setMatId(e.target.value)}
                        >
                            <option value="">-- Selecciona un perfil del catálogo ({materiales.length} disponibles) --</option>
                            {materiales.map(m => (
                                <option key={m.id} value={m.id}>
                                    {m.nombre} {m.pesoPorMetro ? `(${m.pesoPorMetro} kgs/ml)` : ''}
                                </option>
                            ))}
                        </select>
                        {materiales.length === 0 && (
                            <p className="text-xs text-amber-700 mt-1">
                                ⚠️ No hay materiales registrados. Ve a <strong>Almacén y Compras</strong> y haz clic en <strong>"Catálogo de Materiales"</strong> para registrarlos.
                            </p>
                        )}
                    </div>
                    <div className="w-36">
                        <label className="block text-xs font-bold text-gray-700 mb-1">Metros Lineales (ml)</label>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-blue-800"
                            value={cantidad}
                            onChange={e => setCantidad(e.target.value)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={agregarMaterial}
                        className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-5 rounded text-sm transition-colors shadow"
                    >
                        + Añadir
                    </button>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Insumos de la Receta:</label>
                    <ul className="space-y-1.5 text-sm text-gray-700 bg-white p-3 rounded-lg border border-gray-200">
                        {receta.length === 0 && <li className="text-gray-400 italic text-xs">No hay insumos agregados a este modelo.</li>}
                        {receta.map((r, i) => {
                            const mat = materiales.find(m => m.id === r.materialId);
                            return (
                                <li key={i} className="flex justify-between items-center border-b border-gray-100 pb-1.5 text-sm">
                                    <span>
                                        <strong className="text-gray-800">{mat?.nombre || 'Perfil'}</strong>{' '}
                                        {mat?.pesoPorMetro ? <span className="text-blue-600 text-xs">({mat.pesoPorMetro} kgs/ml)</span> : null}{' '}
                                        <span className="text-gray-500 font-semibold">— {r.cantidadMetros} ml</span>
                                    </span>
                                    <button onClick={() => quitarMaterialDeReceta(i)} className="text-red-500 hover:text-red-700 font-bold px-2 text-sm">✕</button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                <button
                    onClick={guardarModelo}
                    className={`w-full font-bold py-2.5 rounded-lg text-white shadow transition-colors ${editandoId ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                    {editandoId ? 'Guardar Cambios del Modelo' : 'Guardar Nuevo Modelo Estructural'}
                </button>
            </div>

            {/* Listado de modelos */}
            <div className="overflow-x-auto bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="p-3 bg-gray-50 border-b border-gray-200 font-bold text-xs uppercase tracking-wider text-gray-600">
                    Modelos Registrados ({modelos.length})
                </div>
                <table className="w-full text-left text-sm">
                    <thead className="bg-gray-100 text-xs uppercase text-gray-600">
                        <tr>
                            <th className="p-3 border-b">Elemento Fabricado</th>
                            <th className="p-3 border-b">Insumos Contemplados</th>
                            <th className="p-3 border-b text-center w-32">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {modelos.length === 0 ? (
                            <tr><td colSpan={3} className="p-6 text-center text-gray-400 italic">Sin modelos registrados todavía.</td></tr>
                        ) : (
                            modelos.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-bold text-gray-800">{m.nombre}</td>
                                    <td className="p-3 text-xs text-gray-600">
                                        {m.receta.map(r => {
                                            const mat = materiales.find(mat => mat.id === r.materialId);
                                            return `${mat?.nombre || 'Perfil'} (${r.cantidadMetros}m)`;
                                        }).join(', ')}
                                    </td>
                                    <td className="p-3 text-center space-x-1">
                                        <button onClick={() => cargarParaEditar(m)} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded font-bold text-xs transition-colors">
                                            Editar
                                        </button>
                                        <button onClick={() => eliminarModelo(m.id)} className="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded font-bold text-xs transition-colors">
                                            Borrar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
