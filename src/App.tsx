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
import { PERMISOS_ADMIN, type UsuarioERP, type ModuloApp } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<ModuloApp>('obras');
  
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
        // Si el usuario acaba de iniciar sesión por primera vez y no existe en Firestore,
        // lo auto-aprovisionamos como Administrador principal para que nunca quede bloqueado
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
    { id: 'usuarios', label: 'Control de Usuarios', icon: '👥' },
  ];

  // Filtrar módulos autorizados según los permisos del usuario
  const modulosAutorizados = menuCompleto.filter(item => {
    // Si no ha terminado de cargar el perfil o es Administrador, tiene acceso total
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

  // 4. Si el usuario está autorizado y activo, renderizamos el ERP
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
          
          <nav className="mt-4 flex flex-col gap-1.5 px-3">
            {modulosAutorizados.map(item => (
              <button 
                key={item.id}
                onClick={() => setActiveView(item.id)} 
                className={`text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
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
        <div className="p-4 border-t border-gray-800 bg-[#0f141e]">
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
            className="w-full bg-red-900/40 text-red-400 border border-red-800/50 py-2 rounded-xl text-xs font-bold hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors shadow-sm cursor-pointer"
          >
            Cerrar Sesión
          </button>
          
          <div className="text-[10px] text-gray-600 text-center mt-4 font-medium tracking-wide">
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
        {activeView === 'materiales' && <CatalogoMateriales />}
        {activeView === 'usuarios' && <ControlUsuarios usuarioActualId={usuarioActivo.uid} />}
      </div>
      
    </div>
  );
}
