import { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Obra, ModeloHerreria, Material, MaterialRequerido, Presupuesto } from '../types';

export default function Obras() {
  // ESTADOS CONECTADOS A FIREBASE EN TIEMPO REAL
  const [obras, setObras] = useState<Obra[]>([]);
  const [modelos, setModelos] = useState<ModeloHerreria[]>([]);
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  
  const [obraActiva, setObraActiva] = useState<Obra | null>(null);

  // Formulario para Crear / Editar Obra
  const [formData, setFormData] = useState({
    nombre: "", cliente: "", descripcion: "", ubicacion: "",
    contrato: "", montoSubtotal: "", fechaInicio: "", fechaFin: "", residente: ""
  });

  const [modalEditarObra, setModalEditarObra] = useState(false);
  const [editandoObraId, setEditandoObraId] = useState<string | null>(null);
  
  const [modeloSeleccionado, setModeloSeleccionado] = useState("");
  const [cantidadModelo, setCantidadModelo] = useState("");
  const [mostrarAltaModelo, setMostrarAltaModelo] = useState(false);
  const [nuevoModNombre, setNuevoModNombre] = useState("");
  const [nuevoModReceta, setNuevoModReceta] = useState<MaterialRequerido[]>([]);
  const [tempMatId, setTempMatId] = useState("");
  const [tempMatCant, setTempMatCant] = useState("");
  const [tipoImpresion, setTipoImpresion] = useState<'cliente' | 'taller' | null>(null);

  // VIGILANTES DE FIREBASE
  useEffect(() => {
    const desuscribirObras = onSnapshot(collection(db, 'obras'), (snapshot) => {
      const obrasData = snapshot.docs.map(doc => doc.data() as Obra);
      setObras(obrasData);
    });
    const desuscribirModelos = onSnapshot(collection(db, 'modelos'), (snapshot) => {
      const modelosData = snapshot.docs.map(doc => doc.data() as ModeloHerreria);
      setModelos(modelosData);
    });
    const desuscribirMateriales = onSnapshot(collection(db, 'materiales'), (snapshot) => {
      const materialesData = snapshot.docs.map(doc => doc.data() as Material);
      setMateriales(materialesData);
    });
    const desuscribirPresupuestos = onSnapshot(collection(db, 'presupuestos'), (snapshot) => {
      const presupuestosData = snapshot.docs.map(doc => doc.data() as Presupuesto);
      setPresupuestos(presupuestosData);
    });

    return () => {
      desuscribirObras();
      desuscribirModelos();
      desuscribirMateriales();
      desuscribirPresupuestos();
    };
  }, []);

  // Mantener actualizada la vista de la obra activa si hay cambios en la nube
  useEffect(() => {
    if (obraActiva) {
      const actualizada = obras.find(o => o.id === obraActiva.id);
      if (actualizada) setObraActiva(actualizada);
    }
  }, [obras]);

  useEffect(() => {
    if (tipoImpresion) {
      window.print();
      setTimeout(() => setTipoImpresion(null), 500);
    }
  }, [tipoImpresion]);

  const manejarCambioForm = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // CREAR NUEVO CONTRATO / OBRA
  const crearObra = async (e: React.FormEvent) => {
    e.preventDefault();
    const nuevaObra: Obra = {
      id: Date.now().toString(),
      ...formData,
      montoSubtotal: Number(formData.montoSubtotal) || 0,
      estatus: 'Activa',
      elementos: [],
      preciosFactura: [],
      compras: []
    };
    
    try {
      await setDoc(doc(db, 'obras', nuevaObra.id), nuevaObra);
      setFormData({ nombre: "", cliente: "", descripcion: "", ubicacion: "", contrato: "", montoSubtotal: "", fechaInicio: "", fechaFin: "", residente: "" });
      alert('Obra registrada exitosamente.');
    } catch (error) {
      console.error("Error al registrar obra en la nube:", error);
      alert('Error al registrar obra.');
    }
  };

  // ABRIR EDICIÓN DE OBRA
  const abrirEdicionObra = (obra: Obra) => {
    setEditandoObraId(obra.id);
    setFormData({
      nombre: obra.nombre || '',
      cliente: obra.cliente || '',
      descripcion: obra.descripcion || '',
      ubicacion: obra.ubicacion || '',
      contrato: obra.contrato || '',
      montoSubtotal: (obra.montoSubtotal || 0).toString(),
      fechaInicio: obra.fechaInicio || '',
      fechaFin: obra.fechaFin || '',
      residente: obra.residente || ''
    });
    setModalEditarObra(true);
  };

  // GUARDAR EDICIÓN DE OBRA
  const guardarEdicionObra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editandoObraId) return;

    try {
      await updateDoc(doc(db, 'obras', editandoObraId), {
        nombre: formData.nombre.trim(),
        cliente: formData.cliente.trim(),
        descripcion: formData.descripcion.trim(),
        ubicacion: formData.ubicacion.trim(),
        contrato: formData.contrato.trim(),
        montoSubtotal: Number(formData.montoSubtotal) || 0,
        fechaInicio: formData.fechaInicio,
        fechaFin: formData.fechaFin,
        residente: formData.residente.trim()
      });

      setModalEditarObra(false);
      setEditandoObraId(null);
      setFormData({ nombre: "", cliente: "", descripcion: "", ubicacion: "", contrato: "", montoSubtotal: "", fechaInicio: "", fechaFin: "", residente: "" });
      alert('Obra modificada correctamente.');
    } catch (error) {
      console.error('Error al editar obra:', error);
      alert('Error al guardar cambios de la obra.');
    }
  };

  // ELIMINAR OBRA
  const eliminarObra = async (id: string, nombre: string) => {
    if (confirm(`¿Estás seguro de que deseas eliminar permanentemente la obra "${nombre}"?`)) {
      try {
        await deleteDoc(doc(db, 'obras', id));
        if (obraActiva?.id === id) setObraActiva(null);
        alert('Obra eliminada del sistema.');
      } catch (error) {
        console.error('Error al eliminar obra:', error);
        alert('No se pudo eliminar la obra.');
      }
    }
  };

  // AÑADIR ELEMENTO A OBRA
  const agregarElementoAObra = async () => {
    if (!obraActiva || !modeloSeleccionado || !cantidadModelo) return;
    const modelo = modelos.find(m => m.id === modeloSeleccionado);
    const nuevosPrecios = [...(obraActiva.preciosFactura || [])];
    
    modelo?.receta.forEach(req => {
      if (!nuevosPrecios.find(p => p.materialId === req.materialId)) {
        nuevosPrecios.push({ materialId: req.materialId, costoRealPorMetro: 0 });
      }
    });

    const nuevosElementos = [...(obraActiva.elementos || []), { id: Date.now().toString(), modeloId: modeloSeleccionado, cantidad: Number(cantidadModelo) }];
    
    try {
      await updateDoc(doc(db, 'obras', obraActiva.id), {
        elementos: nuevosElementos,
        preciosFactura: nuevosPrecios
      });
      setModeloSeleccionado("");
      setCantidadModelo("");
    } catch (error) {
      console.error("Error al guardar elemento:", error);
    }
  };

  // ELIMINAR PARTIDA DE OBRA
  const eliminarElementoDeObra = async (elementoId: string) => {
    if (!obraActiva) return;
    const elementosRestantes = obraActiva.elementos.filter(el => el.id !== elementoId);
    try {
      await updateDoc(doc(db, 'obras', obraActiva.id), { elementos: elementosRestantes });
    } catch (error) {
      console.error("Error al eliminar elemento:", error);
    }
  };

  // MODIFICAR CANTIDAD DE ELEMENTO
  const actualizarCantidadElemento = async (elementoId: string, nuevaCantidad: number) => {
    if (!obraActiva || nuevaCantidad <= 0) return;
    const elementosActualizados = obraActiva.elementos.map(el => el.id === elementoId ? { ...el, cantidad: nuevaCantidad } : el);
    try {
      await updateDoc(doc(db, 'obras', obraActiva.id), { elementos: elementosActualizados });
    } catch (error) {
      console.error("Error actualizando volumen:", error);
    }
  };

  // ACTUALIZAR PRECIOS DE FACTURA
  const actualizarPrecioFactura = async (materialId: string, nuevoCosto: number) => {
    if (!obraActiva) return;
    const preciosActualizados = (obraActiva.preciosFactura || []).map(p => p.materialId === materialId ? { ...p, costoRealPorMetro: nuevoCosto } : p);
    try {
      await updateDoc(doc(db, 'obras', obraActiva.id), { preciosFactura: preciosActualizados });
    } catch (error) {
      console.error("Error actualizando finanzas:", error);
    }
  };

  const agregarInsumoAlNuevoModelo = () => {
    if (!tempMatId || !tempMatCant) return;
    setNuevoModReceta([...nuevoModReceta, { materialId: tempMatId, cantidadMetros: Number(tempMatCant) }]);
    setTempMatId(""); setTempMatCant("");
  };

  const guardarNuevoModelo = async () => {
    if (!nuevoModNombre || nuevoModReceta.length === 0) return alert("Faltan datos.");
    const nuevoModeloObj: ModeloHerreria = { id: Date.now().toString(), nombre: nuevoModNombre, receta: nuevoModReceta };
    try {
      await setDoc(doc(db, 'modelos', nuevoModeloObj.id), nuevoModeloObj);
      setModeloSeleccionado(nuevoModeloObj.id);
      setNuevoModNombre(""); setNuevoModReceta([]); setMostrarAltaModelo(false);
    } catch (error) {
      console.error('Error al guardar modelo:', error);
    }
  };

  // VISTA DE DETALLE DE LA OBRA ACTIVA
  if (obraActiva) {
    let granTotalAcero = 0;
    const presupuestosDeEstaObra = presupuestos.filter(p => p.obraId === obraActiva.id || p.desarrollo?.toLowerCase() === obraActiva.nombre?.toLowerCase());

    return (
      <div className="space-y-6">
        {/* VISTAS DE IMPRESIÓN */}
        <div className="hidden print:block bg-white text-black p-8 absolute top-0 left-0 w-full h-full z-50">
          <div className="border-b-2 border-gray-800 pb-4 mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tighter">INGENIERÍA BENCH S.A. DE C.V.</h1>
              <p className="text-sm font-bold text-gray-600">Estructuras de Concreto, Acero y Herrería</p>
            </div>
            <div className="text-right text-sm">
              <p><strong>Fecha:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>Expediente:</strong> {obraActiva.nombre}</p>
            </div>
          </div>
          {tipoImpresion === 'cliente' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-center bg-gray-100 py-2">COTIZACIÓN DE SERVICIOS</h2>
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div><p><strong>Cliente:</strong> {obraActiva.cliente}</p><p><strong>Ubicación:</strong> {obraActiva.ubicacion || 'N/D'}</p></div>
                <div><p><strong>Contrato / O.C.:</strong> {obraActiva.contrato || 'N/D'}</p><p><strong>Alcance:</strong> {obraActiva.descripcion}</p></div>
              </div>
              <table className="w-full text-left text-sm mb-6">
                <thead className="border-b-2 border-gray-800">
                  <tr><th className="py-2">Cant.</th><th className="py-2">Concepto / Partida</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {obraActiva.elementos?.map(el => (
                    <tr key={el.id}>
                      <td className="py-3 font-bold">{el.cantidad} pza</td>
                      <td className="py-3">{modelos.find(m => m.id === el.modeloId)?.nombre}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end mt-8">
                <div className="w-1/3 border-t-2 border-gray-800 pt-2 text-right">
                  <p className="text-xl font-bold">SUBTOTAL: ${obraActiva.montoSubtotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  <p className="text-xs text-gray-500 mt-1">* Precios antes de IVA. Sujeto a cambios sin previo aviso.</p>
                </div>
              </div>
            </div>
          )}
          {tipoImpresion === 'taller' && (
            <div>
              <h2 className="text-xl font-bold mb-4 text-center bg-gray-100 py-2 border-l-4 border-gray-800">ORDEN DE TRABAJO - TALLER DE HERRERÍA</h2>
              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div><p><strong>Obra:</strong> {obraActiva.nombre}</p><p><strong>Residente Autoriza:</strong> {obraActiva.residente || 'N/D'}</p></div>
                <div><p><strong>Contrato interno:</strong> {obraActiva.contrato || 'N/D'}</p><p><strong>Periodo:</strong> {obraActiva.fechaInicio} al {obraActiva.fechaFin}</p></div>
              </div>
              <table className="w-full text-left text-sm mb-6 border border-gray-300">
                <thead className="bg-gray-100 border-b border-gray-300">
                  <tr><th className="p-2">Cant.</th><th className="p-2">Elemento a Fabricar</th><th className="p-2 text-right">Destajo a Pagar (1:1)</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {obraActiva.elementos?.map(el => {
                    const mod = modelos.find(m => m.id === el.modeloId);
                    let destajoPartida = 0;
                    mod?.receta.forEach(req => {
                      const mat = materiales.find(m => m.id === req.materialId);
                      const longitudVenta = mat?.longitudTramo || 6;
                      const pf = obraActiva.preciosFactura?.find(p => p.materialId === req.materialId);
                      const precioPorTramo = pf?.costoRealPorMetro || 0;
                      destajoPartida += (req.cantidadMetros * (precioPorTramo / longitudVenta));
                    });
                    destajoPartida = destajoPartida * el.cantidad;
                    granTotalAcero += destajoPartida;
                    return (
                      <tr key={el.id}>
                        <td className="p-3 font-bold border-r border-gray-300">{el.cantidad} pza</td>
                        <td className="p-3 font-medium border-r border-gray-300">{mod?.nombre}</td>
                        <td className="p-3 text-right font-bold text-gray-800">${destajoPartida.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex justify-between mt-8 items-end">
                <div className="w-1/3 text-center border-t border-gray-400 pt-2"><p className="text-sm font-bold">Firma Residente</p></div>
                <div className="w-1/3 text-center border-t border-gray-400 pt-2"><p className="text-sm font-bold">Firma Maestro Herrero</p></div>
                <div className="w-1/4 bg-gray-100 p-3 rounded text-right border border-gray-300">
                  <p className="text-sm">TOTAL DESTAJO AUTORIZADO:</p>
                  <p className="text-xl font-black">${granTotalAcero.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* INTERFAZ PRINCIPAL DE LA APP */}
        <div className="print:hidden space-y-6">
          <div className="bg-gray-900 text-white p-6 rounded-xl shadow-lg relative">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className="text-xs text-blue-400 uppercase tracking-widest font-bold">Expediente de Obra</span>
                <h2 className="text-2xl font-black text-white">{obraActiva.nombre}</h2>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => abrirEdicionObra(obraActiva)}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold py-2 px-3 rounded shadow transition-colors"
                >
                  ✏️ Editar Obra
                </button>
                <button
                  type="button"
                  onClick={() => eliminarObra(obraActiva.id, obraActiva.nombre)}
                  className="bg-red-800 hover:bg-red-700 text-white text-xs font-bold py-2 px-3 rounded shadow transition-colors"
                >
                  🗑️ Borrar Obra
                </button>
                <button
                  type="button"
                  onClick={() => setObraActiva(null)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-xs font-bold text-gray-200"
                >
                  ✕ Cerrar Expediente
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <button onClick={() => setTipoImpresion('cliente')} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded shadow">
                🖨️ Generar PDF Cliente
              </button>
              <button onClick={() => setTipoImpresion('taller')} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded shadow">
                🔨 Generar O.T. Taller
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-xs border-t border-gray-800 pt-4">
              <div><span className="text-gray-400 block font-semibold">Cliente</span> {obraActiva.cliente}</div>
              <div><span className="text-gray-400 block font-semibold">Contrato</span> {obraActiva.contrato || 'N/A'}</div>
              <div><span className="text-gray-400 block font-semibold">Monto Subtotal</span> ${(obraActiva.montoSubtotal || 0).toLocaleString()}</div>
              <div><span className="text-gray-400 block font-semibold">Residente</span> {obraActiva.residente || 'Por asignar'}</div>
            </div>
          </div>

          {/* PRESUPUESTOS VINCULADOS A ESTA OBRA */}
          {presupuestosDeEstaObra.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl shadow-sm">
              <h4 className="text-xs font-bold uppercase tracking-wider text-blue-900 mb-2 flex items-center gap-1.5">
                <span>📝</span> Presupuestos Guardados para esta Obra ({presupuestosDeEstaObra.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {presupuestosDeEstaObra.map(p => (
                  <div key={p.id} className="bg-white p-3 rounded-lg border border-blue-200 text-xs shadow-sm">
                    <p className="font-bold text-gray-900 truncate">{p.nombre || p.desarrollo}</p>
                    <p className="text-gray-500 text-[11px] mb-1">{p.partidas?.length || 0} partidas • Fecha: {p.fecha}</p>
                    <p className="text-blue-700 font-semibold text-[11px]">
                      {p.promocion ? `Promo: ${p.promocion}` : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">1. Catálogo de Conceptos a Fabricar</h3>
                <button onClick={() => setMostrarAltaModelo(!mostrarAltaModelo)} className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded hover:bg-emerald-700 font-bold shadow">
                  {mostrarAltaModelo ? 'Cancelar Alta' : '+ Crear Nuevo Modelo'}
                </button>
              </div>
              
              {mostrarAltaModelo && (
                <div className="bg-white p-4 border border-emerald-200 rounded-lg mb-4 shadow-sm">
                  <h4 className="text-xs font-bold text-emerald-800 mb-2 border-b pb-2">Alta Rápida al Catálogo</h4>
                  <input type="text" placeholder="Nombre (Ej. Barandal Tipo 3)" className="w-full p-2 border rounded text-xs mb-3" value={nuevoModNombre} onChange={e => setNuevoModNombre(e.target.value)} />
                  <div className="flex gap-2 mb-2">
                    <select className="flex-1 p-2 border rounded text-xs" value={tempMatId} onChange={e => setTempMatId(e.target.value)}>
                      <option value="">Selecciona Perfil...</option>
                      {materiales.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                    <input type="number" placeholder="Metros" className="w-20 p-2 border rounded text-xs" value={tempMatCant} onChange={e => setTempMatCant(e.target.value)} />
                    <button onClick={agregarInsumoAlNuevoModelo} className="bg-gray-800 text-white px-3 rounded font-bold text-xs">+</button>
                  </div>
                  <ul className="text-xs text-gray-600 mb-3 list-disc pl-4">
                    {nuevoModReceta.map((r, i) => <li key={i}>{materiales.find(m => m.id === r.materialId)?.nombre} - {r.cantidadMetros}m</li>)}
                  </ul>
                  <button onClick={guardarNuevoModelo} className="w-full bg-emerald-600 text-white py-2 rounded text-xs font-bold">Guardar Modelo en Catálogo</button>
                </div>
              )}

              <div className="flex gap-2 items-end mb-4 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-blue-900 mb-1">Seleccionar Modelo</label>
                  <select className="w-full p-2 border border-blue-200 rounded text-xs bg-white" value={modeloSeleccionado} onChange={e => setModeloSeleccionado(e.target.value)}>
                    <option value="">Elija del catálogo...</option>
                    {modelos.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                  </select>
                </div>
                <div className="w-20">
                  <label className="block text-xs font-bold text-blue-900 mb-1">Cant.</label>
                  <input type="number" className="w-full p-2 border border-blue-200 rounded text-xs bg-white font-bold" value={cantidadModelo} onChange={e => setCantidadModelo(e.target.value)} />
                </div>
                <button onClick={agregarElementoAObra} className="bg-blue-600 text-white font-bold py-2 px-4 rounded text-xs hover:bg-blue-700 shadow">Añadir a Obra</button>
              </div>

              <ul className="divide-y divide-gray-200 bg-white border rounded-lg shadow-sm">
                {(!obraActiva.elementos || obraActiva.elementos.length === 0) && (
                  <li className="p-4 text-xs text-gray-400 text-center italic">Sin partidas asignadas aún</li>
                )}
                {obraActiva.elementos?.map(el => {
                  const mod = modelos.find(m => m.id === el.modeloId);
                  return (
                    <li key={el.id} className="p-3 text-xs text-gray-700 flex justify-between items-center hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-blue-300 rounded bg-blue-50 overflow-hidden shadow-sm">
                          <input type="number" className="w-14 p-1 text-center font-bold text-blue-700 bg-transparent outline-none" value={el.cantidad} onChange={e => actualizarCantidadElemento(el.id, Number(e.target.value))} min="1" title="Modificar cantidad" />
                          <span className="pr-2 text-blue-700 text-xs font-bold select-none">pzas</span>
                        </div>
                        <span className="font-semibold text-gray-800">{mod?.nombre}</span>
                      </div>
                      <button onClick={() => eliminarElementoDeObra(el.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 font-bold px-2 py-1 rounded transition-colors" title="Eliminar partida">✕</button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">2. Costos de Remisión y Destajos (1:1)</h3>
              <div className="overflow-x-auto mb-5">
                <table className="w-full text-left text-xs bg-white border rounded-lg">
                  <thead className="bg-gray-100 border-b">
                    <tr><th className="p-2 font-bold text-gray-700">Material Extraído</th><th className="p-2 font-bold text-gray-700 text-right">Precio Factura ($/Tramo)</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(!obraActiva.preciosFactura || obraActiva.preciosFactura.length === 0) && <tr><td colSpan={2} className="p-4 text-center text-gray-400 italic">Agrega conceptos para cotizar insumos.</td></tr>}
                    {obraActiva.preciosFactura?.map((pf => {
                      const mat = materiales.find(m => m.id === pf.materialId);
                      return (
                        <tr key={pf.materialId}>
                          <td className="p-2 font-medium">{mat?.nombre}</td>
                          <td className="p-2">
                            <input type="number" step="0.01" className="w-full p-1 border border-blue-200 rounded text-right font-bold text-blue-700 bg-white" value={pf.costoRealPorMetro} onChange={e => actualizarPrecioFactura(pf.materialId, Number(e.target.value))} />
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
              
              <h4 className="font-bold text-gray-800 border-t border-gray-200 pt-3 mb-2 text-xs">Estimación Financiera:</h4>
              <div className="space-y-1.5 mb-4 max-h-48 overflow-y-auto">
                {obraActiva.elementos?.map(el => {
                  const mod = modelos.find(m => m.id === el.modeloId);
                  let costoAceroModelo = 0;
                  
                  mod?.receta.forEach(req => {
                    const mat = materiales.find(m => m.id === req.materialId);
                    const longitudVenta = mat?.longitudTramo || 6;
                    const precioObj = obraActiva.preciosFactura?.find(p => p.materialId === req.materialId);
                    const precioPorTramo = precioObj ? precioObj.costoRealPorMetro : 0;
                    costoAceroModelo += (req.cantidadMetros * (precioPorTramo / longitudVenta));
                  });
                  
                  const totalAceroPartida = costoAceroModelo * el.cantidad;
                  granTotalAcero += totalAceroPartida;
                  
                  return (
                    <div key={'res-' + el.id} className="flex justify-between text-xs bg-white p-2 border rounded shadow-sm">
                      <span className="font-medium text-gray-700 truncate w-1/2">{el.cantidad}x {mod?.nombre}</span>
                      <span className="font-bold">
                        Acero: <span className="text-gray-800">${totalAceroPartida.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> | Herrero: <span className="text-emerald-600">${totalAceroPartida.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              
              <div className="bg-gray-900 text-white p-4 rounded-lg shadow">
                <div className="flex justify-between font-bold text-xs mb-2 pb-2 border-b border-gray-700">
                  <span>Gran Total Acero Neto:</span>
                  <span>${granTotalAcero.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-base text-emerald-400">
                  <span>Destajo a Pagar (1:1):</span>
                  <span>${granTotalAcero.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // VISTA PRINCIPAL: LISTADO Y ALTA DE OBRAS
  return (
    <div className="space-y-8">
      {/* FORMULARIO PARA APERTURAR OBRA */}
      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 flex items-center gap-2">
          <span>🏗️</span> Aperturar Nuevo Contrato / Obra
        </h3>
        <form onSubmit={crearObra} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Proyecto <span className="text-red-500">*</span></label>
            <input required type="text" name="nombre" placeholder="Ej. Herrería 60u Tesistán" className="w-full p-2.5 border rounded-lg text-sm" value={formData.nombre} onChange={manejarCambioForm} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Cliente <span className="text-red-500">*</span></label>
            <input required type="text" name="cliente" placeholder="Ej. GRUPO SAN CARLOS" className="w-full p-2.5 border rounded-lg text-sm" value={formData.cliente} onChange={manejarCambioForm} />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-gray-700 mb-1">Descripción de Trabajos (Alcances)</label>
            <textarea name="descripcion" rows={2} placeholder="Descripción de los alcances de herrería y estructura..." className="w-full p-2.5 border rounded-lg text-sm" value={formData.descripcion} onChange={manejarCambioForm} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Ubicación de la Obra</label>
            <input type="text" name="ubicacion" placeholder="Ej. Tesistán, Zapopan" className="w-full p-2.5 border rounded-lg text-sm" value={formData.ubicacion} onChange={manejarCambioForm} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Contrato / O.C.</label>
            <input type="text" name="contrato" placeholder="Ej. 5559" className="w-full p-2.5 border rounded-lg text-sm" value={formData.contrato} onChange={manejarCambioForm} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Monto Subtotal (Antes IVA) <span className="text-red-500">*</span></label>
            <input required type="number" step="0.01" name="montoSubtotal" placeholder="0.00" className="w-full p-2.5 border rounded-lg text-sm font-bold text-blue-800" value={formData.montoSubtotal} onChange={manejarCambioForm} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Fecha Inicio</label>
            <input type="date" name="fechaInicio" className="w-full p-2.5 border rounded-lg text-sm" value={formData.fechaInicio} onChange={manejarCambioForm} />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Fecha Fin (Programa)</label>
            <input type="date" name="fechaFin" className="w-full p-2.5 border rounded-lg text-sm" value={formData.fechaFin} onChange={manejarCambioForm} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-gray-700 mb-1">Ingeniero / Residente Asignado</label>
            <input type="text" name="residente" placeholder="Ej. Ing. Filiberto Procel" className="w-full p-2.5 border rounded-lg text-sm" value={formData.residente} onChange={manejarCambioForm} />
          </div>
          <div className="md:col-span-3 flex justify-end mt-2">
            <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-8 rounded-lg shadow transition-colors text-sm">
              + Registrar Proyecto
            </button>
          </div>
        </form>
      </div>

      {/* MODAL PARA EDITAR OBRA */}
      {modalEditarObra && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-6 border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
                <span>✏️</span> Modificar Datos de la Obra
              </h3>
              <button onClick={() => setModalEditarObra(false)} className="text-gray-400 hover:text-gray-600 font-bold">✕</button>
            </div>
            <form onSubmit={guardarEdicionObra} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Nombre del Proyecto <span className="text-red-500">*</span></label>
                <input required type="text" name="nombre" className="w-full p-2 border rounded text-sm" value={formData.nombre} onChange={manejarCambioForm} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Cliente <span className="text-red-500">*</span></label>
                <input required type="text" name="cliente" className="w-full p-2 border rounded text-sm" value={formData.cliente} onChange={manejarCambioForm} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Contrato / O.C.</label>
                <input type="text" name="contrato" className="w-full p-2 border rounded text-sm" value={formData.contrato} onChange={manejarCambioForm} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 mb-1">Descripción</label>
                <textarea name="descripcion" rows={2} className="w-full p-2 border rounded text-sm" value={formData.descripcion} onChange={manejarCambioForm} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Ubicación</label>
                <input type="text" name="ubicacion" className="w-full p-2 border rounded text-sm" value={formData.ubicacion} onChange={manejarCambioForm} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Monto Subtotal</label>
                <input required type="number" step="0.01" name="montoSubtotal" className="w-full p-2 border rounded text-sm font-bold" value={formData.montoSubtotal} onChange={manejarCambioForm} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Residente</label>
                <input type="text" name="residente" className="w-full p-2 border rounded text-sm" value={formData.residente} onChange={manejarCambioForm} />
              </div>
              <div className="flex justify-end gap-2 md:col-span-2 pt-3 border-t mt-2">
                <button type="button" onClick={() => setModalEditarObra(false)} className="px-4 py-2 border rounded text-xs font-bold text-gray-600">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 shadow">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LISTADO DE OBRAS ACTIVAS */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>📁</span> Expedientes de Obras Activas ({obras.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {obras.length === 0 ? (
            <div className="col-span-full bg-white p-10 text-center rounded-xl border border-dashed border-gray-300 text-gray-400">
              No hay obras dadas de alta en el sistema.
            </div>
          ) : (
            obras.map(obra => {
              const presDeObra = presupuestos.filter(p => p.obraId === obra.id || p.desarrollo?.toLowerCase() === obra.nombre?.toLowerCase());
              return (
                <div key={obra.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <h4 className="font-extrabold text-base text-gray-900 pr-2">{obra.nombre}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                        {obra.estatus}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2 font-medium">{obra.cliente}</p>
                    <div className="text-xs text-gray-500 space-y-1 mb-3">
                      <p><strong>Residente:</strong> {obra.residente || 'Sin asignar'}</p>
                      <p><strong>Contrato:</strong> {obra.contrato || 'N/A'}</p>
                      <p><strong>Subtotal:</strong> ${(obra.montoSubtotal || 0).toLocaleString()}</p>
                    </div>

                    {presDeObra.length > 0 && (
                      <div className="mb-3 bg-blue-50/70 p-2 rounded text-[11px] text-blue-800 font-semibold border border-blue-200/60">
                        📝 {presDeObra.length} presupuesto(s) vinculado(s)
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setObraActiva(obra)}
                      className="w-full bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-lg text-xs font-bold transition-colors shadow"
                    >
                      Abrir Cuantificación y Destajos
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => abrirEdicionObra(obra)}
                        className="bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-200 py-1.5 rounded-lg text-xs font-bold transition-colors text-center"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => eliminarObra(obra.id, obra.nombre)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 py-1.5 rounded-lg text-xs font-bold transition-colors text-center"
                      >
                        🗑️ Borrar
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
