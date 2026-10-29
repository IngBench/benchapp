import { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Material, ModeloHerreria, MaterialRequerido } from '../types';

export default function ModelosHerreria() {
    // MATERIALES SE MANTIENEN EN LOCALSTORAGE TEMPORALMENTE
    const [materiales] = useState<Material[]>(() => {
        const guardado = localStorage.getItem('bench_materiales');
        return guardado ? JSON.parse(guardado) : [];
    });

    // MODELOS AHORA VIENEN DE LA NUBE EN TIEMPO REAL
    const [modelos, setModelos] = useState<ModeloHerreria[]>([]);

    const [nombre, setNombre] = useState('');
    const [receta, setReceta] = useState<MaterialRequerido[]>([]);
    const [matId, setMatId] = useState('');
    const [cantidad, setCantidad] = useState('');

    // Estado para controlar la edición
    const [editandoId, setEditandoId] = useState<string | null>(null);

    // VIGILANTE DE FIREBASE: Escucha los modelos y recetas en tiempo real
    useEffect(() => {
        const desuscribir = onSnapshot(collection(db, 'modelos'), (snapshot) => {
            const modelosData = snapshot.docs.map(doc => doc.data() as ModeloHerreria);
            setModelos(modelosData);
        });
        return () => desuscribir();
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

    // FUNCIÓN MIGRADA A NUBE: Guardar o actualizar modelo
    const guardarModelo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (receta.length === 0) {
            alert('La receta debe incluir al menos un material de acero.');
            return;
        }

        try {
            if (editandoId) {
                // Actualizar modelo existente en Firestore
                await updateDoc(doc(db, 'modelos', editandoId), {
                    nombre,
                    receta
                });
                setEditandoId(null);
            } else {
                // Crear modelo nuevo en Firestore
                const nuevoId = Date.now().toString();
                const nuevoModelo: ModeloHerreria = {
                    id: nuevoId,
                    nombre,
                    receta
                };
                await setDoc(doc(db, 'modelos', nuevoId), nuevoModelo);
            }

            setNombre('');
            setReceta([]);
        } catch (error) {
            console.error("Error al guardar el modelo en la nube:", error);
            alert("Hubo un error al sincronizar con el servidor.");
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

    // FUNCIÓN MIGRADA A NUBE: Eliminar modelo
    const eliminarModelo = async (id: string) => {
        if (confirm('¿Estás seguro de dar de baja este modelo del catálogo?')) {
            try {
                await deleteDoc(doc(db, 'modelos', id));
                if (editandoId === id) cancelarEdicion();
            } catch (error) {
                console.error("Error al eliminar el modelo:", error);
                alert("No se pudo eliminar el registro del servidor.");
            }
        }
    };

    return (
        <div className="space-y-6">
            <div className={`p-6 rounded border ${editandoId ? 'bg-yellow-50 border-yellow-300' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">
                        {editandoId ? 'Modificar Receta Existente' : 'Armar Explosión de Insumos (Volumetría)'}
                    </h3>
                    {editandoId && (
                        <button onClick={cancelarEdicion} className="text-sm bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600 font-bold">
                            Cancelar Edición
                        </button>
                    )}
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-700 mb-1">Nombre del Elemento (Ej. Zaguán PTR 2x2)</label>
                    <input type="text" className="w-full p-2 border rounded" value={nombre} onChange={e => setNombre(e.target.value)} />
                </div>

                <div className="flex gap-2 items-end mb-4 bg-gray-200 p-3 rounded">
                    <div className="flex-1">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Perfil Requerido</label>
                        <select className="w-full p-2 border rounded" value={matId} onChange={e => setMatId(e.target.value)}>
                            <option value="">Selecciona un material de bodega...</option>
                            {materiales.map(m => (
                                <option key={m.id} value={m.id}>{m.nombre}</option>
                            ))}
                        </select>
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Metros (ml)</label>
                        <input type="number" step="0.01" className="w-full p-2 border rounded" value={cantidad} onChange={e => setCantidad(e.target.value)} />
                    </div>
                    <button type="button" onClick={agregarMaterial} className="bg-gray-800 text-white font-bold py-2 px-4 rounded hover:bg-gray-700">
                        Añadir
                    </button>
                </div>

                <ul className="mb-4 space-y-1 text-sm text-gray-700 bg-white p-3 rounded border">
                    {receta.length === 0 && <li className="text-gray-400 italic">No hay insumos en la receta.</li>}
                    {receta.map((r, i) => {
                        const mat = materiales.find(m => m.id === r.materialId);
                        return (
                            <li key={i} className="flex justify-between items-center border-b pb-1">
                                <span>{mat?.nombre} <strong>{r.cantidadMetros} ml</strong></span>
                                <button onClick={() => quitarMaterialDeReceta(i)} className="text-red-500 hover:text-red-700 font-bold px-2">✕</button>
                            </li>
                        );
                    })}
                </ul>

                <button onClick={guardarModelo} className={`w-full font-bold py-2 rounded text-white shadow ${editandoId ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                    {editandoId ? 'Guardar Cambios del Modelo' : 'Guardar Nuevo Modelo Estructural'}
                </button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left bg-white border border-gray-200 rounded text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-3 border-b">Elemento Fabricado</th>
                            <th className="p-3 border-b">Insumos Contemplados</th>
                            <th className="p-3 border-b text-center">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {modelos.length === 0 ? (
                            <tr><td colSpan={3} className="p-4 text-center text-gray-500">Sin modelos registrados</td></tr>
                        ) : (
                            modelos.map(m => (
                                <tr key={m.id} className="hover:bg-gray-50">
                                    <td className="p-3 font-bold text-gray-800">{m.nombre}</td>
                                    <td className="p-3 text-xs text-gray-600">
                                        {m.receta.map(r => {
                                            const mat = materiales.find(mat => mat.id === r.materialId);
                                            return `${mat?.nombre || 'Material'} (${r.cantidadMetros}m)`;
                                        }).join(', ')}
                                    </td>
                                    <td className="p-3 text-center space-x-2">
                                        <button onClick={() => cargarParaEditar(m)} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded font-bold transition-colors">
                                            Editar
                                        </button>
                                        <button onClick={() => eliminarModelo(m.id)} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded font-bold transition-colors">
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