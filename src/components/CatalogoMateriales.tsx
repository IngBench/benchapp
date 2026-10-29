import { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Material } from '../types';

export default function CatalogoMateriales() {
    // MATERIALES AHORA VIENEN DE LA NUBE EN TIEMPO REAL
    const [materiales, setMateriales] = useState<Material[]>([]);

    // Estado para altas nuevas (Formulario superior)
    const [nuevo, setNuevo] = useState({ nombre: "", pesoPorMetro: "", costoPorMetro: "", longitudTramo: '6' });

    // Estados para la carga masiva desde Excel
    const [mostrarCarga, setMostrarCarga] = useState(false);
    const [textoExcel, setTextoExcel] = useState("");

    // Estados exclusivos para la edición en línea (misma fila)
    const [editandold, setEditandold] = useState<string | null>(null);
    const [datosFila, setDatosFila] = useState({ nombre: "", longitudTramo: '6', pesoPorMetro: "" });

    // VIGILANTE DE FIREBASE: Escucha el catálogo de materiales en tiempo real
    useEffect(() => {
        const desuscribir = onSnapshot(collection(db, 'materiales'), (snapshot) => {
            const materialesData = snapshot.docs.map(doc => doc.data() as Material);
            setMateriales(materialesData);
        });
        return () => desuscribir();
    }, []);

    // FUNCIÓN MIGRADA A NUBE: Guardar ALTA NUEVA (Registro Individual)
    const guardarNuevo = async (e: React.FormEvent) => {
        e.preventDefault();
        const nuevoId = Date.now().toString();
        const mat: Material = {
            id: nuevoId,
            nombre: nuevo.nombre,
            pesoPorMetro: Number(nuevo.pesoPorMetro),
            costoPorMetro: Number(nuevo.costoPorMetro),
            longitudTramo: Number(nuevo.longitudTramo)
        };

        try {
            await setDoc(doc(db, 'materiales', nuevoId), mat);
            setNuevo({ nombre: "", pesoPorMetro: "", costoPorMetro: "", longitudTramo: '6' });
        } catch (error) {
            console.error("Error al registrar material en la nube:", error);
            alert("No se pudo guardar el material en el servidor.");
        }
    };

    // FUNCIÓN MIGRADA A NUBE: Carga masiva
    const procesarCargaMasiva = async () => {
        if (!textoExcel.trim()) return;
        const lineas = textoExcel.trim().split('\n');
        let errores = 0;
        let agregadosCount = 0;

        try {
            for (let index = 0; index < lineas.length; index++) {
                const linea = lineas[index];
                const columnas = linea.split('\t');
                if (columnas.length >= 2) {
                    const nuevoId = `${Date.now()}-${index}`;
                    const perfil: Material = {
                        id: nuevoId,
                        nombre: columnas[0].trim(),
                        pesoPorMetro: Number(columnas[1].trim()) || 0,
                        costoPorMetro: 0,
                        longitudTramo: 6
                    };
                    await setDoc(doc(db, 'materiales', nuevoId), perfil);
                    agregadosCount++;
                } else {
                    errores++;
                }
            }

            setTextoExcel("");
            setMostrarCarga(false);
            alert(`Se cargaron ${agregadosCount} perfiles estructurales al catálogo en la nube.`);
            if (errores > 0) {
                alert(`Hubo ${errores} filas que no se pudieron leer. Asegúrate de copiar solo 2 columnas (Nombre y Peso).`);
            }
        } catch (error) {
            console.error("Error en carga masiva:", error);
            alert("Ocurrió un error al procesar la carga masiva en el servidor.");
        }
    };

    // FUNCIÓN MIGRADA A NUBE: Eliminar material
    const eliminarMaterial = async (id: string) => {
        if (confirm('¿Seguro que deseas dar de baja este perfil del catálogo general?')) {
            try {
                await deleteDoc(doc(db, 'materiales', id));
                if (editandold === id) setEditandold(null);
            } catch (error) {
                console.error("Error al eliminar material:", error);
                alert("No se pudo eliminar el registro del servidor.");
            }
        }
    };

    // --- FUNCIONES DE EDICIÓN EN LÍNEA
    const iniciarEdicionFila = (mat: Material) => {
        setEditandold(mat.id);
        setDatosFila({
            nombre: mat.nombre,
            longitudTramo: mat.longitudTramo.toString(),
            pesoPorMetro: mat.pesoPorMetro.toString()
        });
    };

    const guardarEdicionFila = async (id: string) => {
        try {
            await updateDoc(doc(db, 'materiales', id), {
                nombre: datosFila.nombre,
                longitudTramo: Number(datosFila.longitudTramo),
                pesoPorMetro: Number(datosFila.pesoPorMetro)
            });
            setEditandold(null);
        } catch (error) {
            console.error("Error al actualizar material en línea:", error);
            alert("No se pudieron guardar los cambios en el servidor.");
        }
    };

    return (
        <div className="space-y-6">
            {/* Controles Superiores */}
            <div className="flex justify-between items-center bg-white p-4 rounded border border-gray-200 shadow-sm">
                <h3 className="font-bold text-gray-800 text-lg">Catálogo General de Acero</h3>
                <button
                    onClick={() => setMostrarCarga(!mostrarCarga)}
                    className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 text-sm shadow"
                >
                    {mostrarCarga ? 'Ocultar Carga Masiva' : 'Importar desde Excel'}
                </button>
            </div>

            {/* Panel de Carga Masiva */}
            {mostrarCarga && (
                <div className="bg-green-50 p-4 rounded border border-green-200 shadow-inner">
                    <h4 className="font-bold text-green-800 mb-2">Carga Masiva de Perfiles</h4>
                    <p className="text-sm text-green-700 mb-3">Copia las celdas directamente desde tu Excel y pégalas aquí. <strong>Solo 2 columnas (Nombre | Peso).</strong></p>
                    <textarea className="w-full h-40 p-3 border border-green-300 rounded text-sm mb-3 shadow-sm" value={textoExcel} onChange={(e) => setTextoExcel(e.target.value)}></textarea>
                    <button onClick={procesarCargaMasiva} className="w-full bg-green-700 text-white font-bold py-2 rounded hover:bg-green-800">Procesar y Guardar Perfiles</button>
                </div>
            )}

            {/* Formulario Individual (Solo para Altas Nuevas) */}
            <div className="bg-gray-50 p-4 rounded border border-gray-200">
                <h4 className="font-bold text-gray-800 mb-3">Alta / Registro Individual</h4>
                <form onSubmit={guardarNuevo} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Perfil / Insumo</label>
                        <input required type="text" className="w-full p-2 border rounded" value={nuevo.nombre} onChange={e => setNuevo({ ...nuevo, nombre: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Longitud Venta (m)</label>
                        <input required type="number" step="0.01" className="w-full p-2 border rounded" value={nuevo.longitudTramo} onChange={e => setNuevo({ ...nuevo, longitudTramo: e.target.value })} title="6 para tramos estándar, 1 para venta por metro lineal" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Peso (kg/m)</label>
                        <input required type="number" step="0.01" className="w-full p-2 border rounded" value={nuevo.pesoPorMetro} onChange={e => setNuevo({ ...nuevo, pesoPorMetro: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Costo Base ($/m)</label>
                        <input required type="number" step="0.01" className="w-full p-2 border rounded" value={nuevo.costoPorMetro} onChange={e => setNuevo({ ...nuevo, costoPorMetro: e.target.value })} />
                    </div>
                    <button type="submit" className="md:col-span-5 bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 shadow">
                        Registrar Material Individual
                    </button>
                </form>
            </div>

            {/* Tabla de Catálogo con Edición en Línea */}
            <div className="overflow-x-auto">
                <table className="w-full text-left bg-white border border-gray-200 rounded text-sm">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-3 border-b">Perfil/Insumo</th>
                            <th className="p-3 border-b text-center">Presentación (Longitud)</th>
                            <th className="p-3 border-b text-center">Peso (kg/m)</th>
                            <th className="p-3 border-b text-center w-40">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {materiales.length === 0 && (
                            <tr><td colSpan={4} className="p-4 text-center text-gray-500">Catálogo vacío. Registra o importa perfiles.</td></tr>
                        )}
                        {materiales.map(m => (
                            <tr key={m.id} className={editandold === m.id ? 'bg-yellow-50' : 'hover:bg-gray-50'}>
                                {editandold === m.id ? (
                                    <>
                                        <td className="p-2">
                                            <input type="text" className="w-full p-2 border border-yellow-400 rounded bg-white shadow-sm font-bold text-gray-800" value={datosFila.nombre} onChange={e => setDatosFila({ ...datosFila, nombre: e.target.value })} />
                                        </td>
                                        <td className="p-2">
                                            <div className="flex justify-center items-center gap-1">
                                                <span className="text-gray-500">Tramo</span>
                                                <input type="number" step="0.01" className="w-20 p-2 border border-yellow-400 rounded text-center bg-white shadow-sm font-bold text-blue-700" value={datosFila.longitudTramo} onChange={e => setDatosFila({ ...datosFila, longitudTramo: e.target.value })} />
                                                <span className="text-gray-500">m</span>
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <input type="number" step="0.01" className="w-full p-2 border border-yellow-400 rounded text-center bg-white shadow-sm font-bold text-gray-800" value={datosFila.pesoPorMetro} onChange={e => setDatosFila({ ...datosFila, pesoPorMetro: e.target.value })} />
                                        </td>
                                        <td className="p-2 text-center space-x-1">
                                            <button onClick={() => guardarEdicionFila(m.id)} className="bg-green-600 text-white hover:bg-green-700 px-3 py-1.5 rounded font-bold shadow-sm">
                                                Guardar
                                            </button>
                                            <button onClick={() => setEditandold(null)} className="bg-gray-500 text-white hover:bg-gray-600 px-2 py-1.5 rounded font-bold shadow-sm">
                                                X
                                            </button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="p-3 font-medium text-gray-800">{m.nombre}</td>
                                        <td className="p-3 text-center text-gray-600">Tramo de {m.longitudTramo || 6}m</td>
                                        <td className="p-3 text-center font-bold text-gray-700">{m.pesoPorMetro}</td>
                                        <td className="p-3 text-center space-x-2">
                                            <button onClick={() => iniciarEdicionFila(m)} className="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded font-bold transition-colors">
                                                Editar
                                            </button>
                                            <button onClick={() => eliminarMaterial(m.id)} className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded font-bold transition-colors" title="Eliminar perfil">
                                                X
                                            </button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}