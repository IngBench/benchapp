import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';

import Obras from './components/Obras';
import Inventario from './components/Inventario';
import ModelosHerreria from './components/ModelosHerreria';
import DestajosTaller from './components/DestajosTaller';
import Presupuestos from './components/Presupuestos';

export default function App() {
  const [activeView, setActiveView] = useState('obras');
  
  // Estados para el control de acceso (Firebase)
  const [usuarioActivo, setUsuarioActivo] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  // Efecto que vigila si hay una sesión iniciada al cargar la página
  useEffect(() => {
    const desuscribir = onAuthStateChanged(auth, (usuario) => {
      setUsuarioActivo(usuario);
      setCargando(false); // Termina de cargar la validación
    });
    return () => desuscribir();
  }, []);

  const cerrarSesion = () => {
    signOut(auth);
  };

  // 1. Pantalla de carga mientras Firebase verifica las llaves
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-gray-500 bg-gray-100">
        Cargando ERP Ingeniería Bench...
      </div>
    );
  }

  // 2. Si no hay usuario autorizado, mostramos la caseta de vigilancia (Login)
  if (!usuarioActivo) {
    return <Login />;
  }

  // 3. Si el usuario está autorizado, renderizamos el ERP completo
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      
      {/* PANEL LATERAL (SIDEBAR) */}
      <div className="w-64 bg-[#111827] text-white flex flex-col justify-between shadow-xl z-10 flex-shrink-0">
        <div>
          <div className="p-4 text-center border-b border-gray-800 bg-[#0f141e]">
            {/* Logo de la empresa */}
            <img src="/logo.jpeg" alt="Bench Ingeniería" className="h-16 mx-auto object-contain bg-white rounded p-1 mb-2 shadow" />
            <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">ERP Ingeniería y Herrería</p>
          </div>
          
          <nav className="mt-6 flex flex-col gap-2 px-3">
            <button 
              onClick={() => setActiveView('obras')} 
              className={`text-left px-4 py-3 rounded text-sm font-bold transition-all ${activeView === 'obras' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              Obras y Contratos
            </button>
            <button 
              onClick={() => setActiveView('presupuestos')} 
              className={`text-left px-4 py-3 rounded text-sm font-bold transition-all ${activeView === 'presupuestos' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              Presupuestos (Cotizador)
            </button>
            <button 
              onClick={() => setActiveView('almacen')} 
              className={`text-left px-4 py-3 rounded text-sm font-bold transition-all ${activeView === 'almacen' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              Almacén y Compras
            </button>
            <button 
              onClick={() => setActiveView('fabricacion')} 
              className={`text-left px-4 py-3 rounded text-sm font-bold transition-all ${activeView === 'fabricacion' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              Taller y Destajos
            </button>
            <button 
              onClick={() => setActiveView('catalogo')} 
              className={`text-left px-4 py-3 rounded text-sm font-bold transition-all ${activeView === 'catalogo' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
            >
              Modelos y Catálogo
            </button>
          </nav>
        </div>

        {/* PIE DEL PANEL LATERAL */}
        <div className="p-4 border-t border-gray-800 bg-[#0f141e]">
          <div className="mb-3">
            <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Sesión Activa:</p>
            <p className="text-xs text-blue-400 truncate" title={usuarioActivo.email}>{usuarioActivo.email}</p>
          </div>
          
          <button 
            onClick={cerrarSesion} 
            className="w-full bg-red-900/40 text-red-400 border border-red-800/50 py-2 rounded text-xs font-bold hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors shadow-sm"
          >
            Cerrar Sesión
          </button>
          
          <div className="text-[10px] text-gray-600 text-center mt-5 font-medium tracking-wide">
            Ingeniería Bench S.A. de C.V.
          </div>
        </div>
      </div>

     {/* ÁREA PRINCIPAL DE TRABAJO (MÓDULOS) */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-8">
        {activeView === 'obras' && <Obras />}
        {activeView === 'almacen' && <Inventario />}
        {activeView === 'catalogo' && <ModelosHerreria />}
        {activeView === 'fabricacion' && <DestajosTaller />}
        {activeView === 'presupuestos' && <Presupuestos />}
      </div>
      
    </div>
  );
}