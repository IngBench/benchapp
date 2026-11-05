import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signOut, 
  type User,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential 
} from 'firebase/auth';
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
import FacturacionCobranza from './components/FacturacionCobranza';
import { PERMISOS_ADMIN, type UsuarioERP, type ModuloApp } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<ModuloApp>('obras');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ============================================================================
  // MODO OSCURO / MODO CLARO
  // ============================================================================
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('bench_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bench_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bench_theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // ============================================================================
  // MODAL CAMBIAR CONTRASEÑA
  // ============================================================================
  const [modalPasswordOpen, setModalPasswordOpen] = useState(false);
  const [passActual, setPassActual] = useState('');
  const [passNueva, setPassNueva] = useState('');
  const [passConfirmar, setPassConfirmar] = useState('');
  const [mostrarPass, setMostrarPass] = useState(false);
  const [errorPass, setErrorPass] = useState('');
  const [exitoPass, setExitoPass] = useState('');
  const [cargandoPass, setCargandoPass] = useState(false);

  const abrirModalPassword = () => {
    setErrorPass('');
    setExitoPass('');
    setPassActual('');
    setPassNueva('');
    setPassConfirmar('');
    setMostrarPass(false);
    setModalPasswordOpen(true);
    setSidebarOpen(false); // Si estaba abierto en móvil, cerrarlo para ver el modal
  };

  const handleCambiarPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPass('');
    setExitoPass('');

    if (!usuarioActivo || !usuarioActivo.email) {
      setErrorPass('No hay una sesión activa de usuario.');
      return;
    }
    if (!passActual) {
      setErrorPass('Por favor ingresa tu contraseña actual.');
      return;
    }
    if (passNueva.length < 6) {
      setErrorPass('La nueva contraseña debe contener al menos 6 caracteres.');
      return;
    }
    if (passNueva !== passConfirmar) {
      setErrorPass('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    setCargandoPass(true);
    try {
      // 1. Reautenticar con la contraseña actual
      const credential = EmailAuthProvider.credential(usuarioActivo.email, passActual);
      await reauthenticateWithCredential(usuarioActivo, credential);

      // 2. Actualizar la contraseña en Firebase Auth
      await updatePassword(usuarioActivo, passNueva);

      setExitoPass('¡Contraseña actualizada exitosamente! A partir de tu próximo inicio de sesión deberás usar tu nueva clave.');
      setPassActual('');
      setPassNueva('');
      setPassConfirmar('');
    } catch (err: any) {
      console.error('Error al cambiar contraseña:', err);
      if (
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/invalid-login-credentials'
      ) {
        setErrorPass('La contraseña actual es incorrecta. Por favor verifica e intenta nuevamente.');
      } else if (err.code === 'auth/weak-password') {
        setErrorPass('La nueva contraseña es demasiado corta o débil. Debe tener al menos 6 caracteres.');
      } else if (err.code === 'auth/too-many-requests') {
        setErrorPass('Demasiados intentos fallidos. Por seguridad, espera unos minutos antes de reintentar.');
      } else {
        setErrorPass('No se pudo actualizar la contraseña. Verifica que tu contraseña actual sea correcta.');
      }
    } finally {
      setCargandoPass(false);
    }
  };
  
  // ============================================================================
  // SESIÓN Y AUTORIZACIÓN FIREBASE
  // ============================================================================
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
    { id: 'facturacion', label: 'Facturación y Cobranza', icon: '💼' },
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
      <div className="min-h-screen flex items-center justify-center font-bold text-gray-500 bg-gray-100 dark:bg-gray-950 transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Cargando ERP Ingeniería Bench...</span>
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
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border-t-4 border-red-500 border-x border-b border-gray-200 dark:border-gray-800">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 font-black">
            🚫
          </div>
          <h2 className="text-xl font-black text-gray-900 dark:text-white mb-2">Cuenta Inactiva</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
            Tu cuenta ha sido desactivada por un administrador del sistema. Si consideras que es un error, por favor contacta al administrador de Ingeniería Bench para reactivar tus accesos.
          </p>
          <button
            onClick={cerrarSesion}
            className="w-full bg-gray-900 dark:bg-gray-800 hover:bg-gray-800 dark:hover:bg-gray-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
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
    <div className="flex flex-col md:flex-row h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans print:h-auto print:block print:bg-white overflow-hidden transition-colors">
      
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

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Toggle Modo Oscuro / Claro en Móvil */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700 text-xs cursor-pointer transition-colors"
            title={darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
            aria-label="Alternar tema"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>

          {/* Botón Cambiar Contraseña en Móvil */}
          <button
            type="button"
            onClick={abrirModalPassword}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-blue-300 border border-gray-700 text-xs font-bold cursor-pointer transition-colors"
            title="Cambiar Contraseña"
            aria-label="Cambiar Contraseña"
          >
            🔑
          </button>

          {perfilUsuario?.rol && (
            <span className="text-[9px] bg-blue-900/80 text-blue-300 font-black px-2 py-0.5 rounded-full border border-blue-700/60 hidden sm:inline-block">
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
                <span className="text-[9px] bg-blue-900/60 text-blue-300 font-extrabold px-1.5 py-0.5 rounded-full border border-blue-800/40">
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
          
          {/* BOTONES DE ACCIÓN: CAMBIAR CONTRASEÑA Y TEMA */}
          <div className="space-y-1.5 mb-3">
            <button
              type="button"
              onClick={abrirModalPassword}
              className="w-full flex items-center justify-center gap-1.5 bg-gray-800/90 hover:bg-gray-700 text-blue-300 hover:text-white border border-gray-700/70 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <span>🔑</span>
              <span>Cambiar mi Contraseña</span>
            </button>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-center gap-2 bg-gray-800/90 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700/70 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <span>{darkMode ? '☀️' : '🌙'}</span>
              <span>{darkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}</span>
            </button>
          </div>

          <button 
            onClick={cerrarSesion} 
            className="w-full bg-red-900/40 text-red-400 border border-red-800/50 py-2 rounded-xl text-xs font-bold hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors shadow-sm cursor-pointer"
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
      <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-gray-100 p-3 sm:p-5 md:p-8 print:p-0 print:overflow-visible print:block print:h-auto print:max-h-none transition-colors">
        <div className="max-w-7xl mx-auto w-full">
          {activeView === 'obras' && <Obras />}
          {activeView === 'presupuestos' && <Presupuestos />}
          {activeView === 'facturacion' && <FacturacionCobranza usuarioEmail={usuarioActivo?.email || undefined} />}
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

      {/* ======================================================== */}
      {/* MODAL: CAMBIAR CONTRASEÑA */}
      {/* ======================================================== */}
      {modalPasswordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-gray-900 dark:text-gray-100 transition-colors">
            
            {/* Cabecera del Modal */}
            <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-lg">
                  🔑
                </div>
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight">
                    Cambiar Contraseña
                  </h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    {usuarioActivo.email}
                  </p>
                </div>
              </div>
              
              <button
                type="button"
                onClick={() => setModalPasswordOpen(false)}
                className="w-8 h-8 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800 flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Formulario */}
            <form onSubmit={handleCambiarPassword} className="p-5 sm:p-6 space-y-4">
              {errorPass && (
                <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                  <span className="shrink-0 text-base">⚠️</span>
                  <span>{errorPass}</span>
                </div>
              )}

              {exitoPass ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 p-4 rounded-xl text-xs font-semibold leading-relaxed flex items-start gap-2">
                    <span className="shrink-0 text-base">✅</span>
                    <span>{exitoPass}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setModalPasswordOpen(false)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                  >
                    Entendido / Cerrar
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-900 dark:text-blue-300 leading-relaxed">
                    Actualiza tu contraseña de acceso para proteger tu cuenta. Debe contener al menos 6 caracteres.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Contraseña Actual (Asignada o Previa) *
                    </label>
                    <div className="relative">
                      <input
                        type={mostrarPass ? 'text' : 'password'}
                        required
                        value={passActual}
                        onChange={(e) => setPassActual(e.target.value)}
                        placeholder="Ingresa tu contraseña actual"
                        className="w-full p-2.5 pr-10 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setMostrarPass(!mostrarPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xs cursor-pointer"
                        title={mostrarPass ? 'Ocultar' : 'Mostrar'}
                      >
                        {mostrarPass ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Nueva Contraseña *
                    </label>
                    <input
                      type={mostrarPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={passNueva}
                      onChange={(e) => setPassNueva(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                      Confirmar Nueva Contraseña *
                    </label>
                    <input
                      type={mostrarPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={passConfirmar}
                      onChange={(e) => setPassConfirmar(e.target.value)}
                      placeholder="Vuelve a escribir la nueva contraseña"
                      className="w-full p-2.5 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setModalPasswordOpen(false)}
                      disabled={cargandoPass}
                      className="px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={cargandoPass}
                      className={`bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors shadow-md cursor-pointer flex items-center gap-1.5 ${
                        cargandoPass ? 'opacity-70 cursor-wait' : ''
                      }`}
                    >
                      {cargandoPass ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <span>Guardar Nueva Contraseña</span>
                      )}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
      
    </div>
  );
}
