import { useState, useEffect } from 'react';
import { collection, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Obra, Material, ModeloHerreria, CompraMaterial } from '../types';
import CatalogoMateriales from './CatalogoMateriales';

export default function Inventario() {
    // ESTADOS CONECTADOS A FIREBASE EN TIEMPO REAL
    const [obras, setObras] = useState<Obra[]>([]);
    const [materiales, setMateriales] = useState<Material[]>([]);
    const [modelos, setModelos] = useState<ModeloHerreria[]>([]);

    const [obraActivaId, setObraActivaId] = useState<string>('');
    const [mostrarCatalogo, setMostrarCatalogo] = useState(false);

    // Estados para la carga de facturas completas (Multi-partida)
    const [facturaActiva, setFacturaActiva] = useState('');
    const [matCompraId, setMatCompraId] = useState('');
    const [cantidadCompra, setCantidadCompra] = useState('');
    const [partidasFactura, setPartidasFactura] = useState<{ materialId: string; cantidad: number }[]>([]);

    // VIGILANTES DE FIREBASE
    useEffect(() => {
        const desuscribirObras = onSnapshot(collection(db, 'obras'), (snapshot) => {
            const obrasData = snapshot.docs.map(doc => doc.data() as Obra);
            setObras(obrasData);
        });
        const desuscribirMateriales = onSnapshot(collection(db, 'materiales'), (snapshot) => {
            const matData = snapshot.docs.map(doc => doc.data() as Material);
            setMateriales(matData);
        });
        const desuscribirModelos = onSnapshot(collection(db, 'modelos'), (snapshot) => {
            const modData = snapshot.docs.map(doc => doc.data() as ModeloHerreria);
            setModelos(modData);
        });

        return () => {
            desuscribirObras();
            desuscribirMateriales();
            desuscribirModelos();
        };
    }, []);

    const obraActiva = obras.find(o => o.id === obraActivaId);

    // Calcular requerimientos exactos de la obra activa
    const requerimientos = new Map<string, number>();
    if (obraActiva) {
        obraActiva.elementos.forEach(el => {
            const mod = modelos.find(m => m.id === el.modeloId);
            mod?.receta.forEach(req => {
                const actual = requerimientos.get(req.materialId) || 0;
                requerimientos.set(req.materialId, actual + (req.cantidadMetros * el.cantidad));
            });
        });
    }

    // Funciones para armar la factura
    const agregarPartidaAFactura = () => {
        if (!matCompraId || !cantidadCompra) return;
        setPartidasFactura([...partidasFactura, { materialId: matCompraId, cantidad: Number(cantidadCompra) }]);
        setMatCompraId('');
        setCantidadCompra('');
    };

    const quitarPartidaDeFactura = (index: number) => {
        setPartidasFactura(partidasFactura.filter((_, i) => i !== index));
    };

    // Detonar la entrada masiva al almacén
    const guardarFacturaCompleta = async () => {
        if (!obraActivaId || !facturaActiva || partidasFactura.length === 0) {
            alert('Ingresa el folio de la factura y al menos una partida de material para afectar el inventario.');
            return;
        }

        const obraActual = obras.find(o => o.id === obraActivaId);
        if (!obraActual) return;

        // Convertimos las partidas temporales en registros formales de compra
        const nuevasCompras: CompraMaterial[] = partidasFactura.map((partida, index) => ({
            id: `${Date.now()}-${index}`,
            materialId: partida.materialId,
            factura: facturaActiva.trim().toUpperCase(),
            cantidadTramos: partida.cantidad,
            fecha: new Date().toISOString().split('T')[0]
        }));

        const comprasActualizadas = [...(obraActual.compras || []), ...nuevasCompras];

        try {
            await updateDoc(doc(db, 'obras', obraActivaId), {
                compras: comprasActualizadas
            });

            setFacturaActiva('');
            setPartidasFactura([]);
            alert('Factura registrada y compras actualizadas exitosamente en el servidor.');
        } catch (error) {
            console.error('Error al registrar factura en la nube:', error);
            alert('Hubo un error al sincronizar la compra con el servidor.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Barra Superior con Selector de Obra y Botón de Catálogo */}
            <div className="bg-gray-900 p-4 rounded-lg text-white flex flex-wrap gap-4 items-center justify-between shadow-lg">
                <div className="flex gap-4 items-center flex-1 min-w-[280px]">
                    <h2 className="font-bold text-lg whitespace-nowrap flex items-center gap-2">
                        <span>📦</span> Almacén y Abastecimiento
                    </h2>
                    <select
                        className="flex-1 p-2 border border-gray-700 bg-gray-800 text-white rounded text-sm focus:ring-2 focus:ring-blue-500"
                        value={obraActivaId}
                        onChange={e => {
                            setObraActivaId(e.target.value);
                            setFacturaActiva('');
                            setPartidasFactura([]);
                        }}
                    >
                        <option value="">-- Seleccione una Obra para auditar insumos --</option>
                        {obras.map(o => <option key={o.id} value={o.id}>{o.nombre} ({o.cliente})</option>)}
                    </select>
                </div>

                {/* BOTÓN SOLICITADO: Catálogo de Materiales */}
                <button
                    type="button"
                    onClick={() => setMostrarCatalogo(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-lg text-sm shadow-md flex items-center gap-2 transition-all transform hover:scale-[1.02]"
                >
                    <span className="text-base">🔩</span>
                    <span>Catálogo de Materiales (Perfiles / Insumos)</span>
                </button>
            </div>

            {/* MODAL: Catálogo de Materiales */}
            {mostrarCatalogo && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-50 rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-6 relative border border-gray-200">
                        <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl">🔩</span>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900">Administrador de Catálogo de Materiales</h3>
                                    <p className="text-xs text-gray-500">Registra o importa perfiles con su peso (kgs/ml) para usarlos en modelos y almacén</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMostrarCatalogo(false)}
                                className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold w-8 h-8 rounded-full flex items-center justify-center text-sm transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        <CatalogoMateriales />
                    </div>
                </div>
            )}

            {/* Contenido cuando hay una Obra seleccionada */}
            {obraActiva ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* Panel Izquierdo: Captura Multi-Partida */}
                    <div className="xl:col-span-1 bg-white p-5 rounded-lg border border-gray-200 shadow-sm self-start">
                        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 flex items-center gap-2">
                            <span>🧾</span> Registrar Entrada (Factura Completa)
                        </h3>

                        <div className="mb-4">
                            <label className="block text-xs font-bold text-gray-700 mb-1">Folio Factura / Remisión</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-blue-300 rounded uppercase bg-blue-50 font-bold text-blue-900 text-sm"
                                placeholder="Ej. FAC-40185"
                                value={facturaActiva}
                                onChange={e => setFacturaActiva(e.target.value)}
                            />
                        </div>

                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-300 mb-4">
                            <label className="block text-xs font-bold text-gray-700 mb-2">Añadir Concepto a la Factura</label>
                            <select
                                className="w-full p-2 border rounded text-sm mb-2"
                                value={matCompraId}
                                onChange={e => setMatCompraId(e.target.value)}
                            >
                                <option value="">Selecciona material...</option>
                                {Array.from(requerimientos.keys()).map(matId => {
                                    const mat = materiales.find(m => m.id === matId);
                                    return (
                                        <option key={matId} value={matId}>
                                            {mat?.nombre || matId} {mat?.pesoPorMetro ? `(${mat.pesoPorMetro} kgs/ml)` : ''}
                                        </option>
                                    );
                                })}
                            </select>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    step="0.5"
                                    placeholder="Cant. Tramos"
                                    className="w-full p-2 border rounded text-sm"
                                    value={cantidadCompra}
                                    onChange={e => setCantidadCompra(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={agregarPartidaAFactura}
                                    className="bg-gray-800 text-white font-bold px-4 rounded hover:bg-gray-700 text-sm"
                                >
                                    +
                                </button>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h4 className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Partidas por ingresar:</h4>
                            <ul className="space-y-2">
                                {partidasFactura.length === 0 && <li className="text-sm text-gray-400 italic">Captura insumos para esta factura.</li>}
                                {partidasFactura.map((p, i) => {
                                    const mat = materiales.find(m => m.id === p.materialId);
                                    return (
                                        <li key={i} className="flex justify-between items-center text-sm bg-white p-2 border border-gray-200 rounded shadow-sm">
                                            <span className="truncate pr-2"><span className="font-bold text-blue-700">{p.cantidad}x</span> {mat?.nombre || p.materialId}</span>
                                            <button onClick={() => quitarPartidaDeFactura(i)} className="text-red-500 hover:text-red-700 font-bold px-2">✕</button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <button onClick={guardarFacturaCompleta} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition-colors shadow">
                            Afectar Inventario con Factura
                        </button>
                    </div>

                    {/* Panel Derecho: Explosión de Insumos */}
                    <div className="xl:col-span-2 bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800">Estado de Compras vs Requerimiento</h3>
                            <button
                                type="button"
                                onClick={() => setMostrarCatalogo(true)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-bold"
                            >
                                + Gestionar Materiales
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm border rounded-lg overflow-hidden">
                                <thead className="bg-gray-100 border-b text-xs uppercase text-gray-600">
                                    <tr>
                                        <th className="p-3">Material (Perfil)</th>
                                        <th className="p-3 text-center">Volumen (ml)</th>
                                        <th className="p-3 text-center">Requerido (Tramos)</th>
                                        <th className="p-3 text-blue-700 text-center">Comprado (Tramos)</th>
                                        <th className="p-3 text-center">Por Surtir</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {Array.from(requerimientos.entries()).map(([matId, totalMetros]) => {
                                        const mat = materiales.find(m => m.id === matId);
                                        const longTramo = mat?.longitudTramo || 6;
                                        const tramosRequeridos = Math.ceil(totalMetros / longTramo);

                                        const comprasMat = (obraActiva.compras || []).filter(c => c.materialId === matId);
                                        const totalComprado = comprasMat.reduce((acc, curr) => acc + curr.cantidadTramos, 0);
                                        const pendiente = tramosRequeridos - totalComprado;

                                        const folios = Array.from(new Set(comprasMat.map(c => c.factura))).join(', ');

                                        return (
                                            <tr key={matId} className={pendiente <= 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                                <td className="p-3">
                                                    <span className="font-bold block text-gray-800">{mat?.nombre || matId}</span>
                                                    <span className="text-xs text-gray-500">
                                                        Tramo de {longTramo}m {mat?.pesoPorMetro ? `• ${mat.pesoPorMetro} kgs/ml` : ''}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">{totalMetros.toFixed(2)} ml</td>
                                                <td className="p-3 text-center font-bold text-gray-700">{tramosRequeridos}</td>
                                                <td className="p-3 text-center font-bold text-blue-600">
                                                    {totalComprado}
                                                    {comprasMat.length > 0 && (
                                                        <span className="block text-xs font-normal text-gray-400">
                                                            (Docs: {folios})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {pendiente > 0 ? (
                                                        <span className="text-red-600 font-bold">{pendiente} pzas</span>
                                                    ) : (
                                                        <span className="text-green-600 font-bold">✓ Surtido</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {requerimientos.size === 0 && (
                                        <tr><td colSpan={5} className="p-6 text-center text-gray-500">La obra no tiene elementos para cuantificar.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-12 text-center rounded-lg border border-dashed border-gray-300 text-gray-500">
                    <p className="text-base font-semibold mb-2">Selecciona una obra en el selector superior para auditar requerimientos y compras.</p>
                    <p className="text-xs text-gray-400">O haz clic en el botón azul superior "Catálogo de Materiales" para añadir o editar perfiles.</p>
                </div>
            )}
        </div>
    );
}
