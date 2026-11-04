import { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState('');
  const [mensajeExito, setMensajeExito] = useState('');
  const [cargando, setCargando] = useState(false);

  // Modo: login o recuperación
  const [modoRecuperar, setModoRecuperar] = useState(false);

  // Iniciar Sesión normal
  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');
    setCargando(true);
    try {
      await signInWithEmailAndPassword(auth, correo.trim(), password);
    } catch (err: any) {
      console.error('Error de login:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Correo electrónico o contraseña incorrectos.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Intenta más tarde o recupera tu contraseña.');
      } else {
        setError('No se pudo iniciar sesión. Verifica tus credenciales.');
      }
    } finally {
      setCargando(false);
    }
  };

  // Enviar correo de restablecimiento de contraseña
  const enviarRecuperacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');

    if (!correo.trim()) {
      setError('Por favor ingresa tu correo electrónico.');
      return;
    }

    setCargando(true);
    try {
      await sendPasswordResetEmail(auth, correo.trim());
      setMensajeExito(
        `Se ha enviado un correo con instrucciones para restablecer tu contraseña a "${correo.trim()}". Por favor revisa tu bandeja de entrada o carpeta de spam.`
      );
    } catch (err: any) {
      console.error('Error enviando recuperación:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No existe ninguna cuenta registrada con este correo electrónico.');
      } else if (err.code === 'auth/invalid-email') {
        setError('El formato del correo electrónico no es válido.');
      } else {
        setError('Ocurrió un error al enviar el correo. Intenta nuevamente.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4 transition-colors">
      <div className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-blue-600 dark:border-blue-500 border-x border-b border-gray-200 dark:border-gray-800">
        
        {/* CABECERA CON LOGOTIPO */}
        <div className="text-center mb-6">
          <img src="/logo.jpeg" alt="Bench Logo" className="h-16 mx-auto object-contain mb-3 bg-white p-1 rounded shadow-sm" />
          <h2 className="text-2xl font-black text-gray-900 dark:text-white">ERP Ingeniería Bench</h2>
          <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Gestión de Obras, Presupuestos y Maquinaria</p>
        </div>

        {/* ALERTA DE ERROR */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 p-3 rounded-xl mb-4 text-xs font-bold text-center flex items-center justify-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* ALERTA DE ÉXITO */}
        {mensajeExito && (
          <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-3.5 rounded-xl mb-4 text-xs font-semibold leading-relaxed">
            <span className="font-bold block mb-1">✉️ Correo enviado exitosamente</span>
            {mensajeExito}
          </div>
        )}

        {/* ================================================================== */}
        {/* MODO 1: INICIO DE SESIÓN */}
        {/* ================================================================== */}
        {!modoRecuperar ? (
          <form onSubmit={iniciarSesion} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Correo Electrónico
              </label>
              <input 
                type="email" 
                required 
                placeholder="ejemplo@ingenieriabench.mx"
                className="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                value={correo} 
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
                  Contraseña
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setModoRecuperar(true);
                    setError('');
                    setMensajeExito('');
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-semibold hover:underline cursor-pointer"
                >
                  ¿Olvidé mi contraseña?
                </button>
              </div>
              <div className="relative">
                <input 
                  type={mostrarPassword ? 'text' : 'password'} 
                  required 
                  placeholder="••••••••"
                  className="w-full p-2.5 sm:p-3 pr-10 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm cursor-pointer"
                  title={mostrarPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {mostrarPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={cargando}
              className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md text-sm cursor-pointer flex items-center justify-center gap-2 ${
                cargando ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <span>Ingresar al Sistema</span>
              )}
            </button>
          </form>
        ) : (
          /* ================================================================== */
          /* MODO 2: RECUPERACIÓN DE CONTRASEÑA */
          /* ================================================================== */
          <form onSubmit={enviarRecuperacion} className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
              <strong>Recuperación de Acceso:</strong> Ingresa tu correo electrónico registrado y te enviaremos un enlace oficial de Firebase para generar una nueva contraseña.
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1">
                Correo Electrónico Registrado
              </label>
              <input 
                type="email" 
                required 
                placeholder="ejemplo@ingenieriabench.mx"
                className="w-full p-2.5 sm:p-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none transition-colors"
                value={correo} 
                onChange={(e) => setCorreo(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={cargando}
              className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors shadow-md text-sm cursor-pointer flex items-center justify-center gap-2 ${
                cargando ? 'opacity-70 cursor-wait' : ''
              }`}
            >
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enviando correo...</span>
                </>
              ) : (
                <span>Enviar Enlace de Recuperación</span>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setModoRecuperar(false);
                  setError('');
                }}
                className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-bold cursor-pointer"
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          </form>
        )}

        <div className="text-center mt-6 text-[10px] text-gray-400 dark:text-gray-500 font-medium border-t border-gray-100 dark:border-gray-800 pt-3">
          Ingeniería Bench S.A. de C.V. • Acceso Restringido a Colaboradores
        </div>
      </div>
    </div>
  );
}
