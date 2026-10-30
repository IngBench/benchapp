import { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Material } from '../types';

export default function CatalogoMateriales() {
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [busqueda, setBusqueda] = useState('');

    // Estado para altas nuevas (Formulario individual)
    const [nuevo, setNuevo] = useState({ nombre: '', pesoPorMetro: '', costoPorMetro: '0', longitudTramo: '6' });

    // Estados para la carga masiva desde Excel
    const [mostrarCarga, setMostrarCarga] = useState(false);
    const [textoExcel, setTextoExcel] = useState('');

    // Estados para la edición en línea
    const [editandoId, setEditandoId] = useState<string | null>(null);
    const [datosFila, setDatosFila] = useState({ nombre: '', longitudTramo: '6', pesoPorMetro: '' });

    // Escucha en tiempo real de Firebase
    useEffect(() => {
        const desuscribir = onSnapshot(collection(db, 'materiales'), (snapshot) => {
            const materialesData = snapshot.docs.map(doc => doc.data() as Material);
            setMateriales(materialesData);
        });
        return () => desuscribir();
    }, []);

    // Guardar alta individual
    const guardarNuevo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nuevo.nombre.trim() || !nuevo.pesoPorMetro) {
            alert('Por favor ingresa el nombre del perfil y su peso en kgs/ml.');
            return;
        }

        const nuevoId = Date.now().toString();
        const mat: Material = {
            id: nuevoId,
            nombre: nuevo.nombre.trim(),
            pesoPorMetro: Number(nuevo.pesoPorMetro),
            costoPorMetro: Number(nuevo.costoPorMetro) || 0,
            longitudTramo: Number(nuevo.longitudTramo) || 6
        };

        try {
            await setDoc(doc(db, 'materiales', nuevoId), mat);
            setNuevo({ nombre: '', pesoPorMetro: '', costoPorMetro: '0', longitudTramo: '6' });
        } catch (error) {
            console.error('Error al registrar material en la nube:', error);
            alert('No se pudo guardar el material en el servidor.');
        }
    };

    // Procesar carga masiva de Excel (Perfil | kgs/ml)
    const procesarCargaMasiva = async () => {
        if (!textoExcel.trim()) return;
        const lineas = textoExcel.trim().split('\n');
        let errores = 0;
        let agregadosCount = 0;

        try {
            for (let index = 0; index < lineas.length; index++) {
                const linea = lineas[index];
                const columnas = linea.split('\t');
                if (columnas.length >= 2 && columnas[0].trim()) {
                    const nuevoId = `${Date.now()}-${index}`;
                    const perfil: Material = {
                        id: nuevoId,
                        nombre: columnas[0].trim(),
                        pesoPorMetro: Number(columnas[1].trim().replace(',', '.')) || 0,
                        costoPorMetro: 0,
                        longitudTramo: 6
                    };
                    await setDoc(doc(db, 'materiales', nuevoId), perfil);
                    agregadosCount++;
                } else {
                    errores++;
                }
            }

            setTextoExcel('');
            setMostrarCarga(false);
            alert(`Se cargaron ${agregadosCount} perfiles exitosamente.`);
            if (errores > 0) {
                alert(`Hubo ${errores} filas que no se pudieron procesar. Verifica que tengan 2 columnas (Perfil y kgs/ml).`);
            }
        } catch (error) {
            console.error('Error en carga masiva:', error);
            alert('Ocurrió un error al procesar la carga masiva.');
        }
    };

    // Eliminar material
    const eliminarMaterial = async (id: string, nombreMat: string) => {
        if (confirm(`¿Estás seguro de eliminar el perfil "${nombreMat}" del catálogo?`)) {
            try {
                await deleteDoc(doc(db, 'materiales', id));
                if (editandoId === id) setEditandoId(null);
            } catch (error) {
                console.error('Error al eliminar material:', error);
                alert('No se pudo eliminar el registro.');
            }
        }
    };

    // Iniciar edición en línea
    const iniciarEdicionFila = (mat: Material) => {
        setEditandoId(mat.id);
        setDatosFila({
            nombre: mat.nombre,
            longitudTramo: (mat.longitudTramo || 6).toString(),
            pesoPorMetro: (mat.pesoPorMetro || 0).toString()
        });
    };

    // Guardar edición
    const guardarEdicionFila = async (id: string) => {
        try {
            await updateDoc(doc(db, 'materiales', id), {
                nombre: datosFila.nombre.trim(),
                longitudTramo: Number(datosFila.longitudTramo) || 6,
                pesoPorMetro: Number(datosFila.pesoPorMetro) || 0
            });
            setEditandoId(null);
        } catch (error) {
            console.error('Error al actualizar material:', error);
            alert('No se pudieron guardar los cambios.');
        }
    };

    // Filtrar materiales por búsqueda
    const materialesFiltrados = materiales.filter(m =>
        m.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Cabecera y acciones */}
            <div className="flex flex-wrap justify-between items-center gap-3 bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                <div>
                    <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <span>🔩</span> Catálogo de Materiales y Perfiles
                    </h3>
                    <p className="text-xs text-gray-500">
                        {materiales.length} perfiles disponibles para recetas de herrería y almacén
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setMostrarCarga(!mostrarCarga)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded text-sm font-bold shadow flex items-center gap-1 transition-colors"
                    >
                        <span>📊</span>
                        {mostrarCarga ? 'Ocultar Carga Masiva' : 'Importar desde Excel'}
                    </button>
                </div>
            </div>

            {/* Panel de Carga Masiva */}
            {mostrarCarga && (
                <div className="bg-emerald-50 p-5 rounded-lg border border-emerald-200 shadow-inner">
                    <h4 className="font-bold text-emerald-900 mb-1">Carga Masiva de Perfiles desde Excel</h4>
                    <p className="text-xs text-emerald-700 mb-3">
                        Copia las dos columnas directamente de Excel y pégalas aquí: <strong>Columna 1: Perfil | Columna 2: kgs/ml</strong>
                    </p>
                    <textarea
                        className="w-full h-36 p-3 border border-emerald-300 rounded font-mono text-xs mb-3 bg-white shadow-sm"
                        placeholder="Ejemplo:&#10;PTR 2x2 Cal 14&#9;3.55&#10;Ángulo 1 1/2 x 1/8&#9;1.83"
                        value={textoExcel}
                        onChange={(e) => setTextoExcel(e.target.value)}
                    />
                    <button
                        type="button"
                        onClick={procesarCargaMasiva}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2 px-6 rounded text-sm shadow transition-colors"
                    >
                        Procesar y Guardar Perfiles en la Nube
                    </button>
                </div>
            )}

            {/* Formulario de Alta Individual */}
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-3 text-sm flex items-center gap-2">
                    <span>➕</span> Añadir Nuevo Material al Catálogo
                </h4>
                <form onSubmit={guardarNuevo} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-5">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Perfil <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="Ej. PTR 2x2 Cal 14, Tubo 1 1/2..."
                            className="w-full p-2 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            value={nuevo.nombre}
                            onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })}
                        />
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            kgs/ml <span className="text-red-500">*</span>
                        </label>
                        <input
                            required
                            type="number"
                            step="0.001"
                            placeholder="Ej. 3.55"
                            className="w-full p-2 border border-gray-300 rounded text-sm font-bold text-blue-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            value={nuevo.pesoPorMetro}
                            onChange={e => setNuevo({ ...nuevo, pesoPorMetro: e.target.value })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Longitud Tramo (m)
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            className="w-full p-2 border border-gray-300 rounded text-sm"
                            value={nuevo.longitudTramo}
                            onChange={e => setNuevo({ ...nuevo, longitudTramo: e.target.value })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded text-sm shadow transition-colors"
                        >
                            + Guardar Perfil
                        </button>
                    </div>
                </form>
            </div>

            {/* Buscador y Tabla */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                        Lista de Perfiles Registrados
                    </span>
                    <input
                        type="text"
                        placeholder="🔍 Buscar por nombre de perfil..."
                        className="p-1.5 px-3 border border-gray-300 rounded text-xs w-64 bg-white"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-100 text-gray-700 uppercase text-xs font-bold">
                            <tr>
                                <th className="p-3 border-b">Perfil</th>
                                <th className="p-3 border-b text-center">kgs/ml</th>
                                <th className="p-3 border-b text-center">Presentación</th>
                                <th className="p-3 border-b text-center w-36">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {materialesFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-gray-400 italic">
                                        {materiales.length === 0
                                            ? 'No hay perfiles registrados en el catálogo. Añade uno arriba o importa desde Excel.'
                                            : 'No se encontraron perfiles con esa búsqueda.'}
                                    </td>
                                </tr>
                            ) : (
                                materialesFiltrados.map(m => (
                                    <tr key={m.id} className={editandoId === m.id ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                                        {editandoId === m.id ? (
                                            <>
                                                <td className="p-2">
                                                    <input
                                                        type="text"
                                                        className="w-full p-2 border border-yellow-400 rounded bg-white shadow-sm font-bold text-gray-800"
                                                        value={datosFila.nombre}
                                                        onChange={e => setDatosFila({ ...datosFila, nombre: e.target.value })}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        className="w-full p-2 border border-yellow-400 rounded text-center bg-white shadow-sm font-bold text-blue-700"
                                                        value={datosFila.pesoPorMetro}
                                                        onChange={e => setDatosFila({ ...datosFila, pesoPorMetro: e.target.value })}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <div className="flex justify-center items-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="0.1"
                                                            className="w-20 p-2 border border-yellow-400 rounded text-center bg-white shadow-sm text-gray-700"
                                                            value={datosFila.longitudTramo}
                                                            onChange={e => setDatosFila({ ...datosFila, longitudTramo: e.target.value })}
                                                        />
                                                        <span className="text-xs text-gray-500">m</span>
                                                    </div>
                                                </td>
                                                <td className="p-2 text-center space-x-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => guardarEdicionFila(m.id)}
                                                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded font-bold text-xs shadow-sm"
                                                    >
                                                        Guardar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditandoId(null)}
                                                        className="bg-gray-400 hover:bg-gray-500 text-white px-2 py-1.5 rounded font-bold text-xs shadow-sm"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="p-3 font-bold text-gray-800">
                                                    {m.nombre}
                                                </td>
                                                <td className="p-3 text-center font-bold text-blue-700 bg-blue-50/50">
                                                    {m.pesoPorMetro} <span className="text-xs text-gray-500 font-normal">kg/m</span>
                                                </td>
                                                <td className="p-3 text-center text-gray-600">
                                                    Tramo {m.longitudTramo || 6} m
                                                </td>
                                                <td className="p-3 text-center space-x-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => iniciarEdicionFila(m)}
                                                        className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded font-bold text-xs transition-colors"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => eliminarMaterial(m.id, m.nombre)}
                                                        className="bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded font-bold text-xs transition-colors"
                                                        title="Eliminar perfil"
                                                    >
                                                        ✕
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
