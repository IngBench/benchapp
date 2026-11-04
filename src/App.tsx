import { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './components/Login';

import Obras from './components/Obras';
import Inventario from './components/Inventario';
import ModelosHerreria from './components/ModelosHerreria';
import DestajosTaller from './components/DestajosTaller';
import Presupuestos from './components/Presupuestos';
import CatalogoMateriales from './components/CatalogoMateriales';
import ControlUsuarios from './components/ControlUsuarios';
import MachineryControl from './components/MachineryControl';
import Reportes from './components/Reportes';
import { PERMISOS_ADMIN, type UsuarioERP, type ModuloApp } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<ModuloApp>('obras');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Estados para el control de acceso (Firebase)
  const [usuarioActivo, setUsuarioActivo] = useState<User | null>(null);
  const [perfilUsuario, setPerfilUsuario] = useState<UsuarioERP | null>(null);
  const [cargando, setCargando] = useState(true);

  // Efecto que vigila la sesión en Firebase Authentication
  useEffect(() => {
    const desuscribir = onAuthStateChanged(auth, (usuario) => {
      setUsuarioActivo(usuario);
      if (!usuario) {
        setPerfilUsuario(null);
        setCargando(false);
      }
    });
    return () => desuscribir();
  }, []);

  // Efecto que vigila el perfil y permisos del usuario en Firestore 'usuarios'
  useEffect(() => {
    if (!usuarioActivo) return;

    const userDocRef = doc(db, 'usuarios', usuarioActivo.uid);
    const desuscribirPerfil = onSnapshot(userDocRef, async (snapshot) => {
      if (snapshot.exists()) {
        setPerfilUsuario({ id: snapshot.id, ...snapshot.data() } as UsuarioERP);
      } else {
        // Auto-aprovisionar como Administrador principal al usuario inicial
        const autoAdmin: UsuarioERP = {
          id: usuarioActivo.uid,
          email: usuarioActivo.email || '',
          nombre: usuarioActivo.displayName || usuarioActivo.email?.split('@')[0] || 'Administrador',
          rol: 'Administrador',
          activo: true,
          permisos: PERMISOS_ADMIN,
          fechaCreacion: new Date().toLocaleDateString('es-MX', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          })
        };

        try {
          await setDoc(userDocRef, autoAdmin);
          setPerfilUsuario(autoAdmin);
        } catch (err) {
          console.error('Error al aprovisionar usuario administrador:', err);
        }
      }
      setCargando(false);
    }, (error) => {
      console.error('Error al escuchar el perfil del usuario:', error);
      setCargando(false);
    });

    return () => desuscribirPerfil();
  }, [usuarioActivo]);

  const cerrarSesion = () => {
    signOut(auth);
  };

  // Catálogo completo de navegación con iconos
  const menuCompleto: { id: ModuloApp; label: string; icon: string }[] = [
    { id: 'obras', label: 'Obras y Contratos', icon: '🏗️' },
    { id: 'presupuestos', label: 'Presupuestos (Cotizador)', icon: '📝' },
    { id: 'almacen', label: 'Almacén y Compras', icon: '📦' },
    { id: 'fabricacion', label: 'Taller y Destajos', icon: '👨‍🏭' },
    { id: 'catalogo', label: 'Modelos de Herrería', icon: '📐' },
    { id: 'materiales', label: 'Catálogo de Materiales', icon: '🔩' },
    { id: 'maquinaria', label: 'Control de Maquinaria', icon: '🚜' },
    { id: 'reportes', label: 'Reportes y Analítica', icon: '📊' },
    { id: 'usuarios', label: 'Control de Usuarios', icon: '👥' },
  ];

  // Filtrar módulos autorizados según los permisos del usuario
  const modulosAutorizados = menuCompleto.filter(item => {
    if (!perfilUsuario || perfilUsuario.rol === 'Administrador') return true;
    return perfilUsuario.permisos?.[item.id] === true;
  });

  // Redirigir si la vista activa no está permitida para este usuario
  useEffect(() => {
    if (modulosAutorizados.length > 0) {
      const tieneAcceso = modulosAutorizados.some(m => m.id === activeView);
      if (!tieneAcceso) {
        setActiveView(modulosAutorizados[0].id);
      }
    }
  }, [modulosAutorizados, activeView]);

  // 1. Pantalla de carga mientras Firebase verifica sesión y perfil
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center font-bold text-gray-500 bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-gray-700">Cargando ERP Ingeniería Bench...</span>
        </div>
      </div>
    );
  }

  // 2. Si no hay usuario autorizado, mostramos la pantalla de Login
  if (!usuarioActivo) {
    return <Login />;
  }

  // 3. Si el usuario fue desactivado por el administrador, denegamos el acceso
  if (perfilUsuario && !perfilUsuario.activo) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 font-black">
            🚫
          </div>
          <h2 className="text-xl font-black text-gray-900 mb-2">Cuenta Inactiva</h2>
          <p className="text-xs text-gray-600 mb-6 leading-relaxed">
            Tu cuenta ha sido desactivada por un administrador del sistema. Si consideras que es un error, por favor contacta al administrador de Ingeniería Bench para reactivar tus accesos.
          </p>
          <button
            onClick={cerrarSesion}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  // 4. Si el usuario está autorizado y activo, renderizamos el ERP con soporte móvil y desktop
  const moduloActual = menuCompleto.find(m => m.id === activeView);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 font-sans print:h-auto print:block print:bg-white overflow-hidden">
      
      {/* ======================================================== */}
      {/* BARRA SUPERIOR PARA CELULAR / MÓVIL (VISIBLE SOLO EN < MD) */}
      {/* ======================================================== */}
      <header className="md:hidden bg-[#0f141e] text-white px-3 py-2.5 flex items-center justify-between border-b border-gray-800 shadow-md z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 -ml-1 text-gray-300 hover:text-white rounded-lg hover:bg-gray-800 active:scale-95 transition-transform cursor-pointer"
            aria-label="Abrir menú"
          >
            <span className="text-2xl leading-none">☰</span>
          </button>
          
          <img src="/logo.jpeg" alt="Bench" className="h-8 w-8 object-contain bg-white rounded p-0.5 shadow shrink-0" />
          
          <div className="min-w-0">
            <span className="text-xs font-black tracking-wide text-white block leading-tight">BENCH ERP</span>
            <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1 leading-tight truncate">
              <span>{moduloActual?.icon}</span>
              <span className="truncate">{moduloActual?.label}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {perfilUsuario?.rol && (
            <span className="text-[9px] bg-blue-900/80 text-blue-300 font-black px-2 py-0.5 rounded-full border border-blue-700/60">
              {perfilUsuario.rol}
            </span>
          )}
          <button
            type="button"
            onClick={cerrarSesion}
            className="bg-red-950/70 border border-red-800/60 text-red-300 hover:bg-red-900 hover:text-white px-2 py-1 rounded text-xs font-bold transition-colors cursor-pointer"
            title="Cerrar sesión"
          >
            Salir
          </button>
        </div>
      </header>

      {/* ======================================================== */}
      {/* BACKDROP OSCURO PARA CERRAR EL MENÚ EN CELULAR */}
      {/* ======================================================== */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* ======================================================== */}
      {/* PANEL LATERAL (SIDEBAR): DRAWER EN MÓVIL Y FIJO EN DESKTOP */}
      {/* ======================================================== */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 md:w-64 bg-[#111827] text-white flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out flex-shrink-0 print:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex-1 flex flex-col min-h-0">
          {/* Cabecera del Sidebar */}
          <div className="p-4 border-b border-gray-800 bg-[#0f141e] flex items-center justify-between shrink-0">
            <div className="flex-1 text-center">
              <img src="/logo.jpeg" alt="Bench Ingeniería" className="h-14 mx-auto object-contain bg-white rounded p-1 mb-1 shadow" />
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">ERP Ingeniería y Herrería</p>
            </div>
            {/* Botón de cerrar en móvil */}
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="md:hidden text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 text-lg font-bold ml-1 cursor-pointer"
              aria-label="Cerrar menú"
            >
              ✕
            </button>
          </div>
          
          {/* Menú de navegación */}
          <nav className="mt-3 flex-1 flex flex-col gap-1 px-3 overflow-y-auto">
            {modulosAutorizados.map(item => (
              <button 
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  setSidebarOpen(false); // Cierra automáticamente el drawer al elegir módulo en celular
                }} 
                className={`text-left px-3.5 py-3 md:py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer shrink-0 ${
                  activeView === item.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* PIE DEL PANEL LATERAL */}
        <div className="p-4 border-t border-gray-800 bg-[#0f141e] shrink-0">
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Sesión Activa:</p>
              {perfilUsuario?.rol && (
                <span className="text-[9px] bg-blue-900/60 text-blue-300 font-extrabold px-1.5 py-0.2 rounded-full border border-blue-800/40">
                  {perfilUsuario.rol}
                </span>
              )}
            </div>
            <p className="text-xs text-white font-bold truncate">
              {perfilUsuario?.nombre || usuarioActivo.email}
            </p>
            <p className="text-[11px] text-gray-400 truncate" title={usuarioActivo.email || ''}>
              {usuarioActivo.email}
            </p>
          </div>
          
          <button 
            onClick={cerrarSesion} 
            className="w-full bg-red-900/40 text-red-400 border border-red-800/50 py-2.5 md:py-2 rounded-xl text-xs font-bold hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors shadow-sm cursor-pointer"
          >
            Cerrar Sesión
          </button>
          
          <div className="text-[10px] text-gray-600 text-center mt-3 font-medium tracking-wide">
            Ingeniería Bench S.A. de C.V.
          </div>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* ÁREA PRINCIPAL DE TRABAJO (MÓDULOS) */}
      {/* ======================================================== */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-50 p-3 sm:p-5 md:p-8 print:p-0 print:overflow-visible print:block print:h-auto print:max-h-none">
        <div className="max-w-7xl mx-auto w-full">
          {activeView === 'obras' && <Obras />}
          {activeView === 'almacen' && <Inventario />}
          {activeView === 'catalogo' && <ModelosHerreria />}
          {activeView === 'fabricacion' && <DestajosTaller />}
          {activeView === 'presupuestos' && <Presupuestos />}
          {activeView === 'materiales' && <CatalogoMateriales />}
          {activeView === 'maquinaria' && <MachineryControl />}
          {activeView === 'reportes' && <Reportes />}
          {activeView === 'usuarios' && <ControlUsuarios usuarioActualId={usuarioActivo.uid} />}
        </div>
      </main>
      
    </div>
  );
}
