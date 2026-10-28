import { useState, useEffect } from 'react';
import type { ModeloHerreria, Material, Presupuesto, PartidaPresupuesto, MaterialRequerido } from '../types';

export default function Presupuestos() {
    const [presupuestos, setPresupuestos] = useState<Presupuesto[]>(() => JSON.parse(localStorage.getItem('bench_presupuestos') || '[]'));
    const [modelos, setModelos] = useState<ModeloHerreria[]>(() => JSON.parse(localStorage.getItem('bench_modelos') || '[]'));
    const [materiales] = useState<Material[]>(() => JSON.parse(localStorage.getItem('bench_materiales') || '[]'));

    const [presupuestoActivo, setPresupuestoActivo] = useState<Presupuesto | null>(null);

    const [formCabecera, setFormCabecera] = useState({
        promocion: '', desarrollo: '', ciudad: '', cliente: 'GRUPO SAN CARLOS',
        fecha: new Date().toISOString().split('T')[0]
    });

    const [modeloSel, setModeloSel] = useState('');
    const [codigo, setCodigo] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const [cantidad, setCantidad] = useState('1');
    const [modulos, setModulos] = useState('1');
    const [largo, setLargo] = useState('');
    const [ancho, setAncho] = useState('');
    const [tipoPintura, setTipoPintura] = useState<'Esmalte' | 'Electroestática' | 'Ninguna'>('Ninguna');

    const [mostrarAltaModelo, setMostrarAltaModelo] = useState(false);
    const [nuevoModNombre, setNuevoModNombre] = useState('');
    const [nuevoModReceta, setNuevoModReceta] = useState<MaterialRequerido[]>([]);
    const [tempMatId, setTempMatId] = useState('');
    const [tempMatCant, setTempMatCant] = useState('');

    useEffect(() => { localStorage.setItem('bench_presupuestos', JSON.stringify(presupuestos)); }, [presupuestos]);
    useEffect(() => { localStorage.setItem('bench_modelos', JSON.stringify(modelos)); }, [modelos]);

    useEffect(() => {
        if (presupuestoActivo) {
            const act = presupuestos.find(p => p.id === presupuestoActivo.id);
            if (act) setPresupuestoActivo(act);
        }
    }, [presupuestos]);

    const crearPresupuesto = (e: React.FormEvent) => {
        e.preventDefault();
        const [anio, mes, dia] = formCabecera.fecha.split('-');
        const fechaFormateada = `${dia}/${mes}/${anio}`;

        const nuevo: Presupuesto = {
            id: Date.now().toString(),
            fecha: fechaFormateada,
            ...formCabecera,
            partidas: [],
            preciosMateriales: [],
            precioGlobalKg: 0 // Inicia en 0 para usar el promedio automático
        };
        setPresupuestos([...presupuestos, nuevo]);
        setFormCabecera({ promocion: '', desarrollo: '', ciudad: '', cliente: 'GRUPO SAN CARLOS', fecha: new Date().toISOString().split('T')[0] });
    };

    const agregarInsumoAlNuevoModelo = () => {
        if (!tempMatId || !tempMatCant) return;
        setNuevoModReceta([...nuevoModReceta, { materialId: tempMatId, cantidadMetros: Number(tempMatCant) }]);
        setTempMatId(''); setTempMatCant('');
    };

    const guardarNuevoModelo = () => {
        if (!nuevoModNombre || nuevoModReceta.length === 0) return alert("Faltan datos.");
        const nuevoModeloObj: ModeloHerreria = { id: Date.now().toString(), nombre: nuevoModNombre, receta: nuevoModReceta };
        setModelos([...modelos, nuevoModeloObj]);
        setModeloSel(nuevoModeloObj.id);
        setDescripcion(nuevoModeloObj.nombre);
        setNuevoModNombre(''); setNuevoModReceta([]); setMostrarAltaModelo(false);
    };

    const agregarPartida = () => {
        if (!presupuestoActivo || !modeloSel) return;
        const nuevaPartida: PartidaPresupuesto = {
            id: Date.now().toString(),
            modeloId: modeloSel,
            codigo, descripcion,
            unidad: 'PZA',
            cantidad: Number(cantidad),
            modulos: Number(modulos),
            largo: Number(largo) || 0,
            ancho: Number(ancho) || 0,
            tipoPintura
        };

        const nuevasPartidas = [...presupuestoActivo.partidas, nuevaPartida];
        const mod = modelos.find(m => m.id === modeloSel);
        const nuevosPrecios = [...(presupuestoActivo.preciosMateriales || [])];

        mod?.receta.forEach(req => {
            if (!nuevosPrecios.find(p => p.materialId === req.materialId)) {
                nuevosPrecios.push({ materialId: req.materialId, precioTramo: 0 });
            }
        });

        const act = { ...presupuestoActivo, partidas: nuevasPartidas, preciosMateriales: nuevosPrecios };
        setPresupuestos(presupuestos.map(p => p.id === act.id ? act : p));

        setModeloSel(''); setCodigo(''); setDescripcion(''); setCantidad('1');
        setLargo(''); setAncho(''); setTipoPintura('Ninguna');
    };

    const eliminarPartida = (id: string) => {
        if (!presupuestoActivo) return;
        const act = { ...presupuestoActivo, partidas: presupuestoActivo.partidas.filter(p => p.id !== id) };
        setPresupuestos(presupuestos.map(p => p.id === act.id ? act : p));
    };

    const actualizarPrecioMaterial = (materialId: string, precioTramo: number) => {
        if (!presupuestoActivo) return;
        const nuevosPrecios = presupuestoActivo.preciosMateriales.map(p =>
            p.materialId === materialId ? { ...p, precioTramo } : p
        );
        const act = { ...presupuestoActivo, preciosMateriales: nuevosPrecios };
        setPresupuestos(presupuestos.map(p => p.id === act.id ? act : p));
    };

    const fijarPrecioGlobalKg = (nuevoPrecio: number) => {
        if (!presupuestoActivo) return;
        const act = { ...presupuestoActivo, precioGlobalKg: nuevoPrecio };
        setPresupuestos(presupuestos.map(p => p.id === act.id ? act : p));
    };

    // ============================================================================
    // MOTOR FINANCIERO CON PRECIO GLOBAL Y PINTURA PRORRATEADA EN KG
    // ============================================================================
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
        const costoMasIva = costoMas10 * 1.16;
        const formulaTotalAcero = costoMasIva * 2.30;

        const precioKgCalculado = kgTotales > 0 ? (formulaTotalAcero / kgTotales) : 0;
        const precioKgFinal = (precioGlobalFijado && precioGlobalFijado > 0) ? precioGlobalFijado : precioKgCalculado;
        const precioAceroVenta = kgTotales * precioKgFinal;

        const m2Pintura = (partida.largo * partida.ancho) * 2;
        let costoPintura = 0;
        if (partida.tipoPintura === 'Esmalte') costoPintura = m2Pintura * 225.40;
        else if (partida.tipoPintura === 'Electroestática') costoPintura = m2Pintura * 350.00;

        const precioUnitarioFinal = precioAceroVenta + costoPintura;

        // NUEVO CÁLCULO: Precio por kilo real para el cliente (absorbiendo pintura)
        const precioKgCliente = kgTotales > 0 ? (precioUnitarioFinal / kgTotales) : 0;

        return { kgTotales, precioKgCalculado, precioKgFinal, precioKgCliente, m2Pintura, costoPintura, precioUnitarioFinal };
    };

    const exportarExcel = () => {
        if (!presupuestoActivo) return;
        let csv = '\uFEFF';
        csv += `Subcontrato:,HERRERÍA\nPromoción:,${presupuestoActivo.promocion}\nDesarrollo:,${presupuestoActivo.desarrollo}\nCiudad:,${presupuestoActivo.ciudad}\nFecha:,${presupuestoActivo.fecha}\nPROVEEDOR:,BENCH\n\n`;
        csv += `Código,Descripción,Unidad,Cantidad,Módulos,Piezas Totales,M2 Pintura,Tipo Pintura,Kg pza,PU. Kg,P. Unitario,SUMA\n`;

        presupuestoActivo.partidas.forEach(p => {
            const finanzas = calcularFinanzasPartida(p, presupuestoActivo.precioGlobalKg);
            const piezasTotales = p.cantidad * p.modulos;
            const suma = finanzas.precioUnitarioFinal * piezasTotales;

            csv += `${p.codigo},"${p.descripcion.replace(/"/g, '""')}",${p.unidad},${p.cantidad},${p.modulos},${piezasTotales},${finanzas.m2Pintura.toFixed(2)},${p.tipoPintura},${finanzas.kgTotales.toFixed(2)},${finanzas.precioKgCliente.toFixed(2)},${finanzas.precioUnitarioFinal.toFixed(2)},${suma.toFixed(2)}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', `Presupuesto_${presupuestoActivo.desarrollo}.csv`);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

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

        return (
            <div className="space-y-6">
                <div className="bg-gray-900 p-4 rounded text-white flex justify-between items-center shadow">
                    <div>
                        <h2 className="font-bold text-xl">Cotización: {presupuestoActivo.desarrollo} ({presupuestoActivo.promocion})</h2>
                        <p className="text-xs text-gray-400">Cliente: {presupuestoActivo.cliente} | Fecha: {presupuestoActivo.fecha}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={exportarExcel} className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded text-sm font-bold shadow">📊 Exportar a Excel</button>
                        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded text-sm font-bold shadow">📄 Guardar PDF</button>
                        <button onClick={() => setPresupuestoActivo(null)} className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm font-bold">Cerrar</button>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                    <div className="xl:col-span-1 bg-white p-5 rounded border border-gray-200 shadow-sm self-start">
                        <h3 className="font-bold text-gray-800 mb-3 border-b pb-2">1. Precios Base (Factura/Tramo)</h3>
                        <p className="text-xs text-gray-500 mb-4">Captura el costo por pieza de los materiales usados en este presupuesto para detonar la fórmula de venta.</p>
                        <div className="space-y-2">
                            {(!presupuestoActivo.preciosMateriales || presupuestoActivo.preciosMateriales.length === 0) && (
                                <p className="text-sm italic text-gray-400">Agrega conceptos para ver los perfiles requeridos.</p>
                            )}
                            {presupuestoActivo.preciosMateriales?.map(pm => {
                                const mat = materiales.find(m => m.id === pm.materialId);
                                return (
                                    <div key={pm.materialId} className="flex justify-between items-center bg-gray-50 p-2 border rounded text-sm">
                                        <span className="font-medium text-gray-700 truncate pr-2" title={mat?.nombre}>{mat?.nombre}</span>
                                        <div className="flex items-center gap-1 w-28">
                                            <span className="text-gray-500 font-bold">$</span>
                                            <input type="number" step="0.01" className="w-full p-1 border border-blue-300 rounded text-right font-bold text-blue-700 bg-white"
                                                value={pm.precioTramo || ''} onChange={e => actualizarPrecioMaterial(pm.materialId, Number(e.target.value))} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="xl:col-span-2 bg-white p-5 rounded border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-3 border-b pb-2">
                            <h3 className="font-bold text-gray-800">2. Agregar Concepto al Presupuesto</h3>
                            <button onClick={() => setMostrarAltaModelo(!mostrarAltaModelo)} className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 font-bold transition-colors">
                                {mostrarAltaModelo ? 'Cancelar Alta' : '+ Crear Nuevo Modelo'}
                            </button>
                        </div>

                        {mostrarAltaModelo && (
                            <div className="bg-green-50 p-4 border border-green-200 rounded mb-5 shadow-inner">
                                <h4 className="text-sm font-bold text-green-800 mb-2 border-b border-green-200 pb-1">Alta Rápida de Modelo Estructural</h4>
                                <input type="text" placeholder="Nombre Comercial (Ej. Puerta Louver 1x2m)" className="w-full p-2 border rounded text-sm mb-3" value={nuevoModNombre} onChange={e => setNuevoModNombre(e.target.value)} />
                                <div className="flex gap-2 mb-2">
                                    <select className="flex-1 p-2 border rounded text-sm" value={tempMatId} onChange={e => setTempMatId(e.target.value)}>
                                        <option value="">Selecciona Perfil de Acero...</option>
                                        {materiales.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                    </select>
                                    <input type="number" step="0.01" placeholder="Metros" className="w-24 p-2 border rounded text-sm" value={tempMatCant} onChange={e => setTempMatCant(e.target.value)} />
                                    <button onClick={agregarInsumoAlNuevoModelo} className="bg-gray-800 text-white px-4 rounded font-bold text-sm hover:bg-gray-700">+</button>
                                </div>
                                <ul className="text-xs text-gray-700 mb-3 list-disc pl-5">
                                    {nuevoModReceta.map((r, i) => <li key={i}>{materiales.find(m => m.id === r.materialId)?.nombre} - {r.cantidadMetros}m</li>)}
                                </ul>
                                <button onClick={guardarNuevoModelo} className="w-full bg-green-600 text-white py-2 rounded text-sm font-bold hover:bg-green-700 transition-colors shadow">
                                    Guardar Modelo y Usar en Cotización
                                </button>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-700 mb-1">Modelo Estructural</label>
                                <select className="w-full p-2 border rounded text-sm bg-gray-50" value={modeloSel} onChange={e => { setModeloSel(e.target.value); setDescripcion(modelos.find(m => m.id === e.target.value)?.nombre || ''); }}>
                                    <option value="">Selecciona modelo...</option>
                                    {modelos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">Código</label>
                                <input type="text" className="w-full p-2 border rounded text-sm" placeholder="Ej. H-10" value={codigo} onChange={e => setCodigo(e.target.value)} />
                            </div>
                            <div className="col-span-2 md:col-span-3">
                                <label className="block text-xs font-bold text-gray-700 mb-1">Descripción Comercial</label>
                                <input type="text" className="w-full p-2 border rounded text-sm" value={descripcion} onChange={e => setDescripcion(e.target.value)} />
                            </div>

                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Cant/Mod</label><input type="number" className="w-full p-2 border rounded text-sm" value={cantidad} onChange={e => setCantidad(e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-gray-700 mb-1">Módulos</label><input type="number" className="w-full p-2 border rounded text-sm" value={modulos} onChange={e => setModulos(e.target.value)} /></div>

                            <div className="border-l pl-3"><label className="block text-xs font-bold text-purple-700 mb-1">Largo (m)</label><input type="number" step="0.01" className="w-full p-2 border border-purple-200 rounded text-sm" value={largo} onChange={e => setLargo(e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-purple-700 mb-1">Ancho (m)</label><input type="number" step="0.01" className="w-full p-2 border border-purple-200 rounded text-sm" value={ancho} onChange={e => setAncho(e.target.value)} /></div>
                            <div className="col-span-2"><label className="block text-xs font-bold text-purple-700 mb-1">Acabado (Pintura)</label>
                                <select className="w-full p-2 border border-purple-200 rounded text-sm bg-purple-50" value={tipoPintura} onChange={e => setTipoPintura(e.target.value as any)}>
                                    <option value="Ninguna">Sin Pintura</option>
                                    <option value="Esmalte">Esmalte ($225.40/m²)</option>
                                    <option value="Electroestática">Electroestática ($350.00/m²)</option>
                                </select>
                            </div>
                            <button onClick={agregarPartida} className="col-span-2 md:col-span-6 bg-gray-900 text-white font-bold py-2 rounded shadow hover:bg-gray-800 transition-colors mt-2">Añadir Concepto</button>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto bg-white rounded border border-gray-200 shadow-sm mt-6">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-gray-100 border-b">
                            <tr>
                                <th className="p-2">Cód</th>
                                <th className="p-2 min-w-[200px]">Descripción</th>
                                <th className="p-2 text-center">Pzas Tot</th>
                                <th className="p-2 text-center text-purple-800 bg-purple-50">M² Pintura</th>
                                <th className="p-2 text-center text-yellow-800 bg-yellow-50">Kg pza</th>
                                <th className="p-2 text-right text-gray-500">P.U. Original</th>
                                <th className="p-2 text-right">PU. Kg Final</th>
                                <th className="p-2 text-right bg-blue-50 text-blue-900 font-bold">P. Unit. (Pza)</th>
                                <th className="p-2 text-right font-bold text-green-700">SUMA TOTAL</th>
                                <th className="p-2 text-center">✕</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {presupuestoActivo.partidas.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-gray-400">Sin partidas registradas</td></tr>}
                            {presupuestoActivo.partidas.map(p => {
                                const finanzas = calcularFinanzasPartida(p, presupuestoActivo.precioGlobalKg);
                                const piezasTotales = p.cantidad * p.modulos;
                                const suma = finanzas.precioUnitarioFinal * piezasTotales;

                                granTotal += suma;

                                return (
                                    <tr key={p.id} className="hover:bg-gray-50">
                                        <td className="p-2 font-bold">{p.codigo}</td>
                                        <td className="p-2 text-gray-700 whitespace-normal min-w-[250px] text-[11px] leading-tight">
                                            <span className="block font-semibold mb-1">{p.descripcion}</span>
                                            {p.tipoPintura !== 'Ninguna' && <span className="text-purple-600 font-medium block">Pintura {p.tipoPintura} ({finanzas.m2Pintura.toFixed(2)} m²) = +${finanzas.costoPintura.toFixed(2)}/pza</span>}
                                        </td>
                                        <td className="p-2 text-center font-bold text-gray-900">{piezasTotales}</td>
                                        <td className="p-2 text-center bg-purple-50/30 text-purple-700 font-medium">{finanzas.m2Pintura.toFixed(2)} m²</td>
                                        <td className="p-2 text-center font-bold text-yellow-700 bg-yellow-50/30">{finanzas.kgTotales.toFixed(2)}</td>
                                        <td className="p-2 text-right font-medium text-gray-400 line-through">${finanzas.precioKgCalculado.toFixed(2)}</td>

                                        {/* AQUÍ ESTÁ EL CAMBIO A PRECIO KG CLIENTE (CON TITLE PARA VER EL BASE ACERO) */}
                                        <td className="p-2 text-right font-bold text-gray-800" title={`Base acero (sin pintura): $${finanzas.precioKgFinal.toFixed(2)}`}>
                                            ${finanzas.precioKgCliente.toFixed(2)}
                                        </td>

                                        <td className="p-2 text-right font-black text-blue-700 bg-blue-50/30">${finanzas.precioUnitarioFinal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-2 text-right font-black text-green-700 bg-green-50/20">${suma.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-2 text-center"><button onClick={() => eliminarPartida(p.id)} className="text-red-500 hover:text-red-700 font-bold px-2">✕</button></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 items-center">
                    <div className="bg-gray-100 border border-gray-300 p-4 rounded shadow-sm text-center">
                        <span className="block text-sm font-bold text-gray-600">Promedio Base Calculado (Solo Acero):</span>
                        <span className="block text-xl font-black text-gray-500">${promedioCalculado.toFixed(2)} / Kg</span>
                    </div>
                    <div className="bg-blue-50 border border-blue-300 p-4 rounded shadow-sm text-center">
                        <span className="block text-sm font-bold text-blue-800 mb-1">Ajustar Precio Base por Kg:</span>
                        <div className="flex justify-center items-center gap-1">
                            <span className="font-bold text-blue-800">$</span>
                            <input
                                type="number" step="0.01"
                                className="w-28 p-2 border border-blue-400 rounded text-center font-bold text-blue-900 bg-white shadow-inner"
                                value={presupuestoActivo.precioGlobalKg || ''}
                                onChange={e => fijarPrecioGlobalKg(Number(e.target.value))}
                                placeholder={promedioCalculado.toFixed(2)}
                            />
                        </div>
                        <span className="block text-[10px] text-blue-600 mt-1">Déjalo en 0 para usar los precios base individuales.</span>
                    </div>
                    <div className="text-right bg-gray-900 text-white p-4 rounded shadow-lg flex flex-col justify-center">
                        <span className="block text-sm font-bold text-gray-300 mb-1">Gran Total Cotizado:</span>
                        <span className="block text-3xl font-black text-green-400">${granTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                {/* CSS OCULTO PARA LA IMPRESIÓN (PDF) */}
                <div className="hidden print:block fixed top-0 left-0 w-full h-full z-50 bg-white">
                    <style type="text/css" media="print">
                        {`@page { size: landscape; margin: 10mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}
                    </style>
                    <div className="flex justify-between items-start mb-6">
                        <table className="text-xs">
                            <tbody>
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
                                const pinturaDesc = p.tipoPintura !== 'Ninguna' ? ` (Incluye ${fin.m2Pintura.toFixed(2)}m2 de Pintura ${p.tipoPintura})` : '';
                                return (
                                    <tr key={p.id}>
                                        <td className="border border-black p-1">{p.codigo}</td>
                                        <td className="border border-black p-1 text-left">{p.descripcion}{pinturaDesc}</td>
                                        <td className="border border-black p-1">{p.unidad}</td>
                                        <td className="border border-black p-1">{p.cantidad}</td>
                                        <td className="border border-black p-1">{p.modulos}</td>
                                        <td className="border border-black p-1 font-bold">{pzas}</td>

                                        {/* AQUÍ ESTÁ EL CAMBIO A PRECIO KG CLIENTE EN EL PDF */}
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
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-gray-50 p-6 rounded border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Crear Nuevo Presupuesto</h3>
                <form onSubmit={crearPresupuesto} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Promoción (Ej. 96u)</label><input required type="text" className="w-full p-2 border rounded" value={formCabecera.promocion} onChange={e => setFormCabecera({ ...formCabecera, promocion: e.target.value })} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Desarrollo (Ej. PAJARITOS)</label><input required type="text" className="w-full p-2 border rounded uppercase" value={formCabecera.desarrollo} onChange={e => setFormCabecera({ ...formCabecera, desarrollo: e.target.value })} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Ciudad</label><input required type="text" className="w-full p-2 border rounded uppercase" value={formCabecera.ciudad} onChange={e => setFormCabecera({ ...formCabecera, ciudad: e.target.value })} /></div>
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">Fecha de Cotización</label><input required type="date" className="w-full p-2 border rounded text-gray-800" value={formCabecera.fecha} onChange={e => setFormCabecera({ ...formCabecera, fecha: e.target.value })} /></div>
                    <div className="md:col-span-4 flex justify-end mt-2"><button type="submit" className="bg-blue-600 text-white font-bold py-3 px-8 rounded hover:bg-blue-700 shadow">Aperturar Formato de Cotización</button></div>
                </form>
            </div>

            <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">Presupuestos Generados</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {presupuestos.length === 0 ? <p className="text-gray-500 col-span-full">No hay presupuestos registrados.</p> : presupuestos.map(p => (
                        <div key={p.id} className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm relative hover:shadow-md transition-shadow">
                            <h4 className="font-bold text-lg text-gray-900">{p.desarrollo}</h4>
                            <p className="text-sm text-gray-600 mb-4">Promo: {p.promocion} | {p.fecha}</p>
                            <button onClick={() => setPresupuestoActivo(p)} className="w-full bg-gray-900 text-white py-2 rounded text-sm hover:bg-gray-800 font-bold transition-colors">
                                Abrir Cuadro de Precios
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}