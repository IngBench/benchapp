import { useState, useEffect } from 'react';
import { collection, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Obra, Material, ModeloHerreria, CompraMaterial } from '../types';

export default function Inventario() {
    // OBRAS AHORA VIENEN DE LA NUBE EN TIEMPO REAL
    const [obras, setObras] = useState<Obra[]>([]);
    
    // Mantenemos modelos y materiales en localStorage temporalmente hasta su migración completa
    const [materiales] = useState<Material[]>(() => JSON.parse(localStorage.getItem('bench_materiales') || '[]'));
    const [modelos] = useState<ModeloHerreria[]>(() => JSON.parse(localStorage.getItem('bench_modelos') || '[]'));

    const [obraActivaId, setObraActivaId] = useState<string>('');

    // Estados para la carga de facturas completas (Multi-partida)
    const [facturaActiva, setFacturaActiva] = useState('');
    const [matCompraId, setMatCompraId] = useState('');
    const [cantidadCompra, setCantidadCompra] = useState('');
    const [partidasFactura, setPartidasFactura] = useState<{ materialId: string; cantidad: number }[]>([]);

    // VIGILANTE DE FIREBASE: Escucha los expedientes de obra en tiempo real
    useEffect(() => {
        const desuscribir = onSnapshot(collection(db, 'obras'), (snapshot) => {
            const obrasData = snapshot.docs.map(doc => doc.data() as Obra);
            setObras(obrasData);
        });
        return () => desuscribir();
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

    // FUNCIÓN MIGRADA A NUBE: Detonar la entrada masiva al almacén
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
            // Actualización directa en Firestore
            await updateDoc(doc(db, 'obras', obraActivaId), {
                compras: comprasActualizadas
            });

            // Limpiar formulario para la siguiente captura
            setFacturaActiva('');
            setPartidasFactura([]);
        } catch (error) {
            console.error("Error al registrar factura en la nube:", error);
            alert("Hubo un error al sincronizar la compra con el servidor.");
        }
    };

    return (
        <div className="space-y-6">
            {/* Selector Principal de Obra */}
            <div className="bg-gray-900 p-4 rounded text-white flex gap-4 items-center shadow">
                <h2 className="font-bold text-lg">Almacén y Abastecimiento</h2>
                <select className="flex-1 p-2 border border-gray-700 bg-gray-800 text-white rounded" value={obraActivaId} onChange={e => {
                    setObraActivaId(e.target.value);
                    setFacturaActiva('');
                    setPartidasFactura([]);
                }}>
                    <option value="">-- Seleccione una Obra para auditar insumos --</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nombre} ({o.cliente})</option>)}
                </select>
            </div>

            {obraActiva && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

                    {/* Panel Izquierdo: Captura Multi-Partida */}
                    <div className="xl:col-span-1 bg-white p-5 rounded border border-gray-200 shadow-sm self-start">
                        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Registrar Entrada (Factura Completa)</h3>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Folio Factura / Remisión</label>
                            <input
                                type="text"
                                className="w-full p-2 border border-blue-300 rounded uppercase bg-blue-50 font-bold text-blue-900"
                                placeholder="Ej. FAC-40185"
                                value={facturaActiva}
                                onChange={e => setFacturaActiva(e.target.value)}
                            />
                        </div>

                        <div className="bg-gray-50 p-4 rounded border border-gray-300 mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2">Añadir Concepto a la Factura</label>
                            <select className="w-full p-2 border rounded text-sm mb-2" value={matCompraId} onChange={e => setMatCompraId(e.target.value)}>
                                <option value="">Selecciona material...</option>
                                {Array.from(requerimientos.keys()).map(matId => {
                                    const mat = materiales.find(m => m.id === matId);
                                    return <option key={matId} value={matId}>{mat?.nombre}</option>;
                                })}
                            </select>
                            <div className="flex gap-2">
                                <input type="number" step="0.5" placeholder="Cant. Tramos" className="w-full p-2 border rounded text-sm" value={cantidadCompra} onChange={e => setCantidadCompra(e.target.value)} />
                                <button type="button" onClick={agregarPartidaAFactura} className="bg-gray-800 text-white font-bold px-4 rounded hover:bg-gray-700 text-sm">+</button>
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
                                            <span className="truncate pr-2"><span className="font-bold text-blue-700">{p.cantidad}x</span> {mat?.nombre}</span>
                                            <button onClick={() => quitarPartidaDeFactura(i)} className="text-red-500 hover:text-red-700 font-bold px-2">✕</button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>

                        <button onClick={guardarFacturaCompleta} className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700 transition-colors shadow">
                            Afectar Inventario con Factura
                        </button>
                    </div>

                    {/* Panel Derecho: Explosión de Insumos */}
                    <div className="xl:col-span-2 bg-gray-50 p-5 rounded border border-gray-200">
                        <h3 className="font-bold text-gray-800 mb-4">Estado de Compras vs Requerimiento</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm bg-white border rounded">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        <th className="p-3 text-gray-700">Material</th>
                                        <th className="p-3 text-gray-700 text-center">Volumen Base (ml)</th>
                                        <th className="p-3 text-gray-700 text-center">Requerido (Tramos)</th>
                                        <th className="p-3 text-blue-700 text-center">Comprado (Tramos)</th>
                                        <th className="p-3 text-gray-700 text-center">Por Surtir</th>
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

                                        // Extraer folios únicos para no repetir en pantalla si hay múltiples entradas en la misma factura
                                        const folios = Array.from(new Set(comprasMat.map(c => c.factura))).join(', ');

                                        return (
                                            <tr key={matId} className={pendiente <= 0 ? 'bg-green-50' : ''}>
                                                <td className="p-3">
                                                    <span className="font-bold block text-gray-800">{mat?.nombre}</span>
                                                    <span className="text-xs text-gray-500">Tramo de {longTramo}m</span>
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
            )}
        </div>
    );
}