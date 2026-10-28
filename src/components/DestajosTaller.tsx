import { useState, useEffect } from 'react';
import type { Obra, ModeloHerreria, Material } from '../types';

export default function DestajosTaller() {
    const [obras, setObras] = useState<Obra[]>(() => JSON.parse(localStorage.getItem('bench_obras') || '[]'));
    const [modelos] = useState<ModeloHerreria[]>(() => JSON.parse(localStorage.getItem('bench_modelos') || '[]'));
    const [materiales] = useState<Material[]>(() => JSON.parse(localStorage.getItem('bench_materiales') || '[]'));

    const [obraActivaId, setObraActivaId] = useState<string>('');

    useEffect(() => { localStorage.setItem('bench_obras', JSON.stringify(obras)); }, [obras]);

    const obraActiva = obras.find(o => o.id === obraActivaId);

    // Función genérica para actualizar cantidades de taller o de pago
    const actualizarAvance = (elementoId: string, campo: 'cantFabricacion' | 'cantTerminados' | 'cantInstalados' | 'cantPagados', valor: number) => {
        if (!obraActiva) return;
        const obraActualizada = {
            ...obraActiva,
            elementos: obraActiva.elementos.map(el =>
                el.id === elementoId ? { ...el, [campo]: valor >= 0 ? valor : 0 } : el
            )
        };
        setObras(obras.map(o => o.id === obraActiva.id ? obraActualizada : o));
    };

    // Cálculos globales de la obra seleccionada
    let granTotalDestajo = 0;
    let granTotalPagado = 0;

    return (
        <div className="space-y-8">
            {/* Selector de Obra */}
            <div className="bg-gray-900 p-4 rounded text-white flex gap-4 items-center shadow">
                <h2 className="font-bold text-lg">Control de Taller y Nómina</h2>
                <select className="flex-1 p-2 border border-gray-700 bg-gray-800 text-white rounded" value={obraActivaId} onChange={e => setObraActivaId(e.target.value)}>
                    <option value="">-- Seleccione una Obra para controlar avances --</option>
                    {obras.map(o => <option key={o.id} value={o.id}>{o.nombre} ({o.cliente})</option>)}
                </select>
            </div>

            {obraActiva && (
                <>
                    {/* TABLA 1: AVANCE FÍSICO (ESTATUS DE FABRICACIÓN) */}
                    <div className="bg-white p-5 rounded border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 text-lg">1. Avance Físico y Montaje</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        <th className="p-3 text-gray-700 font-bold">Elemento / Modelo</th>
                                        <th className="p-3 text-center text-gray-700 font-bold">Meta Total</th>
                                        <th className="p-3 text-center text-yellow-700 font-bold bg-yellow-50">En Fabricación</th>
                                        <th className="p-3 text-center text-blue-700 font-bold bg-blue-50">Terminados (Taller)</th>
                                        <th className="p-3 text-center text-green-700 font-bold bg-green-50">Instalados (Obra)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {obraActiva.elementos.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-gray-500">No hay elementos en esta obra.</td></tr>}
                                    {obraActiva.elementos.map(el => {
                                        const mod = modelos.find(m => m.id === el.modeloId);
                                        return (
                                            <tr key={el.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="p-3 font-medium text-gray-800">{mod?.nombre}</td>
                                                <td className="p-3 text-center font-bold text-gray-900">{el.cantidad} pz</td>
                                                <td className="p-3 text-center bg-yellow-50/50">
                                                    <input type="number" min="0" className="w-16 p-1 border rounded text-center font-bold text-yellow-700"
                                                        value={el.cantFabricacion || 0} onChange={e => actualizarAvance(el.id, 'cantFabricacion', Number(e.target.value))} />
                                                </td>
                                                <td className="p-3 text-center bg-blue-50/50">
                                                    <input type="number" min="0" className="w-16 p-1 border rounded text-center font-bold text-blue-700"
                                                        value={el.cantTerminados || 0} onChange={e => actualizarAvance(el.id, 'cantTerminados', Number(e.target.value))} />
                                                </td>
                                                <td className="p-3 text-center bg-green-50/50">
                                                    <input type="number" min="0" className="w-16 p-1 border rounded text-center font-bold text-green-700"
                                                        value={el.cantInstalados || 0} onChange={e => actualizarAvance(el.id, 'cantInstalados', Number(e.target.value))} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* TABLA 2: AVANCE FINANCIERO (PAGOS A HERREROS) */}
                    <div className="bg-white p-5 rounded border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-4 border-b pb-2 text-lg">2. Liquidación de Destajos (Avance Financiero)</h3>
                        <div className="overflow-x-auto mb-6">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-800 text-white border-b">
                                    <tr>
                                        <th className="p-3 font-bold">Elemento / Modelo</th>
                                        <th className="p-3 text-center font-bold">Meta Total</th>
                                        <th className="p-3 text-right font-bold text-gray-300">P.U. Destajo (1 pz)</th>
                                        <th className="p-3 text-center font-bold text-green-300 bg-gray-700">Pzas Pagadas</th>
                                        <th className="p-3 text-right font-bold text-blue-300">Monto Abonado</th>
                                        <th className="p-3 text-right font-bold text-red-300">Saldo Pendiente</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {obraActiva.elementos.map(el => {
                                        const mod = modelos.find(m => m.id === el.modeloId);

                                        // Calcular el Precio Unitario (P.U.) de Destajo por 1 sola pieza
                                        let destajoUnitario = 0;
                                        mod?.receta.forEach(req => {
                                            const mat = materiales.find(m => m.id === req.materialId);
                                            const longitudVenta = mat?.longitudTramo || 6;
                                            const precioObj = obraActiva.preciosFactura.find(p => p.materialId === req.materialId);
                                            const precioPorTramo = precioObj ? precioObj.costoRealPorMetro : 0;
                                            destajoUnitario += (req.cantidadMetros * (precioPorTramo / longitudVenta));
                                        });

                                        const totalAPagar = destajoUnitario * el.cantidad;
                                        const pzasPagadas = el.cantPagados || 0;
                                        const montoPagado = destajoUnitario * pzasPagadas;
                                        const saldoPendiente = totalAPagar - montoPagado;

                                        granTotalDestajo += totalAPagar;
                                        granTotalPagado += montoPagado;

                                        return (
                                            <tr key={el.id} className="hover:bg-gray-50">
                                                <td className="p-3 font-medium text-gray-800">{mod?.nombre}</td>
                                                <td className="p-3 text-center font-bold text-gray-600">{el.cantidad} pz</td>
                                                <td className="p-3 text-right text-gray-600">${destajoUnitario.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="p-3 text-center bg-gray-100">
                                                    <input type="number" min="0" max={el.cantidad} className="w-16 p-1 border border-gray-400 rounded text-center font-black text-green-700 shadow-inner"
                                                        value={pzasPagadas} onChange={e => actualizarAvance(el.id, 'cantPagados', Number(e.target.value))} />
                                                </td>
                                                <td className="p-3 text-right font-bold text-blue-700">${montoPagado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                <td className="p-3 text-right font-bold text-red-600">${saldoPendiente.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* RESUMEN FINANCIERO */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-100 p-4 rounded text-center border">
                                <p className="text-sm text-gray-600 font-bold mb-1">Costo Total del Contrato (Mano de Obra)</p>
                                <p className="text-xl font-black text-gray-800">${granTotalDestajo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-green-50 p-4 rounded text-center border border-green-200">
                                <p className="text-sm text-green-700 font-bold mb-1">Monto Total Pagado</p>
                                <p className="text-xl font-black text-green-700">${granTotalPagado.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div className="bg-red-50 p-4 rounded text-center border border-red-200">
                                <p className="text-sm text-red-700 font-bold mb-1">Deuda Pendiente (Saldo Taller)</p>
                                <p className="text-xl font-black text-red-700">${(granTotalDestajo - granTotalPagado).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}