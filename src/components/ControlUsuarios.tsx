import { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth, registrarNuevoUsuarioAuth } from '../firebase';
import {
    LISTA_MODULOS,
    PERMISOS_DEFAULT,
    PERMISOS_ADMIN,
    type UsuarioERP,
    type ModuloApp,
    type RolUsuario,
    type PermisosUsuario
} from '../types';

interface ControlUsuariosProps {
    usuarioActualId?: string;
}

export default function ControlUsuarios({ usuarioActualId }: ControlUsuariosProps) {
    const [usuarios, setUsuarios] = useState<UsuarioERP[]>([]);
    const [cargando, setCargando] = useState(true);

    // Filtros de búsqueda
    const [busqueda, setBusqueda] = useState('');
    const [filtroRol, setFiltroRol] = useState<string>('Todos');
    const [filtroEstado, setFiltroEstado] = useState<string>('Todos');

    // Modales
    const [modalCrear, setModalCrear] = useState(false);
    const [modalEditar, setModalEditar] = useState(false);
    const [usuarioEditando, setUsuarioEditando] = useState<UsuarioERP | null>(null);

    // Formulario de creación
    const [nuevoNombre, setNuevoNombre] = useState('');
    const [nuevoEmail, setNuevoEmail] = useState('');
    const [nuevoPassword, setNuevoPassword] = useState('');
    const [nuevoRol, setNuevoRol] = useState<RolUsuario>('Cotizador');
    const [nuevoActivo, setNuevoActivo] = useState(true);
    const [nuevosPermisos, setNuevosPermisos] = useState<PermisosUsuario>({
        ...PERMISOS_DEFAULT,
        presupuestos: true,
        catalogo: true,
        materiales: true
    });
    const [mostrarPassword, setMostrarPassword] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorFormulario, setErrorFormulario] = useState('');

    // Escuchar la colección de usuarios en tiempo real
    useEffect(() => {
        const desuscribir = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
            const data = snapshot.docs.map(docSnap => ({
                id: docSnap.id,
                ...docSnap.data()
            } as UsuarioERP));
            setUsuarios(data);
            setCargando(false);
        }, (error) => {
            console.error('Error al escuchar usuarios en Firebase:', error);
            setCargando(false);
        });

        return () => desuscribir();
    }, []);

    // Plantillas rápidas de permisos según rol
    const obtenerPlantillaRol = (rol: RolUsuario): PermisosUsuario => {
        switch (rol) {
            case 'Administrador':
                return { ...PERMISOS_ADMIN };
            case 'Cotizador':
                return {
                    obras: false,
                    presupuestos: true,
                    almacen: false,
                    fabricacion: false,
                    catalogo: true,
                    materiales: true,
                    usuarios: false,
                };
            case 'Residente':
                return {
                    obras: true,
                    presupuestos: false,
                    almacen: true,
                    fabricacion: false,
                    catalogo: false,
                    materiales: false,
                    usuarios: false,
                };
            case 'Taller':
                return {
                    obras: false,
                    presupuestos: false,
                    almacen: true,
                    fabricacion: true,
                    catalogo: true,
                    materiales: false,
                    usuarios: false,
                };
            case 'Personalizado':
            default:
                return { ...PERMISOS_DEFAULT, presupuestos: true };
        }
    };

    // Cambiar rol al crear
    const manejarCambioRolNuevo = (rol: RolUsuario) => {
        setNuevoRol(rol);
        setNuevosPermisos(obtenerPlantillaRol(rol));
    };

    // Cambiar rol al editar
    const manejarCambioRolEdicion = (rol: RolUsuario) => {
        if (!usuarioEditando) return;
        setUsuarioEditando({
            ...usuarioEditando,
            rol,
            permisos: obtenerPlantillaRol(rol)
        });
    };

    // TOGGLE DIRECTO EN LA TABLA DE CONTROL DE ACCESOS
    const togglePermisoDirecto = async (usuario: UsuarioERP, modulo: ModuloApp) => {
        if (usuario.id === usuarioActualId && modulo === 'usuarios') {
            alert('Por seguridad no puedes retirarte el permiso de Control de Usuarios a ti mismo.');
            return;
        }

        const valorActual = usuario.permisos ? usuario.permisos[modulo] : false;
        const nuevoValor = !valorActual;

        try {
            await updateDoc(doc(db, 'usuarios', usuario.id), {
                [`permisos.${modulo}`]: nuevoValor
            });
        } catch (error) {
            console.error('Error al actualizar permiso:', error);
            alert('No se pudo guardar el cambio en la nube.');
        }
    };

    // ACTIVAR / DESACTIVAR USUARIO CON 1 CLIC
    const toggleEstadoUsuario = async (usuario: UsuarioERP) => {
        if (usuario.id === usuarioActualId) {
            alert('No puedes desactivar tu propia cuenta activa.');
            return;
        }

        try {
            await updateDoc(doc(db, 'usuarios', usuario.id), {
                activo: !usuario.activo
            });
        } catch (error) {
            console.error('Error al cambiar estado del usuario:', error);
            alert('No se pudo modificar el estado del usuario.');
        }
    };

    // ENVIAR CORREO DE RECUPERACIÓN / RESET DE PASSWORD
    const enviarRecuperacionPassword = async (email: string, nombre: string) => {
        if (!email) {
            alert('El usuario no tiene un correo válido registrado.');
            return;
        }
        if (confirm(`¿Deseas enviar un correo oficial de Firebase a "${email}" (${nombre}) para que restablezca su contraseña?`)) {
            try {
                await sendPasswordResetEmail(auth, email);
                alert(`¡Correo enviado! Se envió un enlace seguro a ${email} para restablecer la contraseña.`);
            } catch (error: any) {
                console.error('Error al enviar correo de recuperación:', error);
                alert(`Error al enviar correo: ${error.message || 'Intenta de nuevo.'}`);
            }
        }
    };

    // ELIMINAR USUARIO
    const eliminarUsuario = async (usuario: UsuarioERP) => {
        if (usuario.id === usuarioActualId) {
            alert('No puedes eliminar la cuenta con la que tienes la sesión iniciada.');
            return;
        }

        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a "${usuario.nombre}" (${usuario.email})? Perderá todos sus accesos al sistema.`)) {
            try {
                await deleteDoc(doc(db, 'usuarios', usuario.id));
                alert('Usuario eliminado del sistema correctamente.');
            } catch (error) {
                console.error('Error al eliminar usuario:', error);
                alert('No se pudo eliminar el usuario de la base de datos.');
            }
        }
    };

    // CREAR USUARIO EN FIREBASE AUTH Y FIRESTORE
    const crearUsuario = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorFormulario('');

        const emailTrim = nuevoEmail.trim().toLowerCase();
        const nombreTrim = nuevoNombre.trim();

        if (!nombreTrim) {
            setErrorFormulario('Por favor escribe el nombre completo del usuario.');
            return;
        }

        if (!emailTrim || !emailTrim.includes('@')) {
            setErrorFormulario('Por favor ingresa un correo electrónico válido.');
            return;
        }

        if (nuevoPassword.length < 6) {
            setErrorFormulario('La contraseña debe tener un mínimo de 6 caracteres.');
            return;
        }

        setGuardando(true);

        try {
            let uidFinal = '';

            // 1. Intentar registrar en Firebase Authentication usando secondary app
            try {
                const userAuth = await registrarNuevoUsuarioAuth(emailTrim, nuevoPassword);
                uidFinal = userAuth.uid;
            } catch (authError: any) {
                if (authError.code === 'auth/email-already-in-use') {
                    // Si el correo ya existía en Auth, usamos un ID generado o su ID existente
                    uidFinal = `usr_${Date.now()}`;
                    console.warn('El correo ya existe en Firebase Auth, vinculando a la base de usuarios...');
                } else {
                    throw authError;
                }
            }

            // 2. Guardar perfil y permisos en la colección 'usuarios' de Firestore
            const nuevoDoc: UsuarioERP = {
                id: uidFinal,
                nombre: nombreTrim,
                email: emailTrim,
                rol: nuevoRol,
                activo: nuevoActivo,
                permisos: nuevosPermisos,
                fechaCreacion: new Date().toLocaleDateString('es-MX', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                })
            };

            await setDoc(doc(db, 'usuarios', uidFinal), nuevoDoc);

            // Limpiar formulario y cerrar modal
            setNuevoNombre('');
            setNuevoEmail('');
            setNuevoPassword('');
            setNuevoRol('Cotizador');
            setNuevoActivo(true);
            setNuevosPermisos(obtenerPlantillaRol('Cotizador'));
            setModalCrear(false);
            setGuardando(false);
            alert(`¡Usuario "${nombreTrim}" creado exitosamente! Ya puede iniciar sesión con su correo y contraseña.`);
        } catch (error: any) {
            console.error('Error al crear usuario:', error);
            setGuardando(false);
            setErrorFormulario(error.message || 'Error al crear usuario en el servidor.');
        }
    };

    // ABRIR MODAL PARA EDITAR
    const abrirEdicion = (u: UsuarioERP) => {
        setUsuarioEditando({
            ...u,
            permisos: {
                ...PERMISOS_DEFAULT,
                ...(u.permisos || {})
            }
        });
        setModalEditar(true);
    };

    // GUARDAR MODIFICACIONES DE USUARIO
    const guardarEdicionUsuario = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!usuarioEditando) return;

        setGuardando(true);
        try {
            await updateDoc(doc(db, 'usuarios', usuarioEditando.id), {
                nombre: usuarioEditando.nombre.trim(),
                rol: usuarioEditando.rol,
                activo: usuarioEditando.activo,
                permisos: usuarioEditando.permisos
            });

            setModalEditar(false);
            setUsuarioEditando(null);
            setGuardando(false);
            alert('Datos del usuario y permisos actualizados correctamente.');
        } catch (error) {
            console.error('Error al actualizar usuario:', error);
            setGuardando(false);
            alert('No se pudieron guardar los cambios.');
        }
    };

    // FILTRADO DE USUARIOS
    const usuariosFiltrados = usuarios.filter(u => {
        const textoBusqueda = busqueda.toLowerCase().trim();
        const coincideTexto = !textoBusqueda ||
            (u.nombre && u.nombre.toLowerCase().includes(textoBusqueda)) ||
            (u.email && u.email.toLowerCase().includes(textoBusqueda));

        const coincideRol = filtroRol === 'Todos' || u.rol === filtroRol;
        const coincideEstado = filtroEstado === 'Todos' ||
            (filtroEstado === 'Activos' && u.activo) ||
            (filtroEstado === 'Inactivos' && !u.activo);

        return coincideTexto && coincideRol && coincideEstado;
    });

    // Estadísticas rápidas
    const totalUsuarios = usuarios.length;
    const activosCount = usuarios.filter(u => u.activo).length;
    const inactivosCount = totalUsuarios - activosCount;
    const adminsCount = usuarios.filter(u => u.rol === 'Administrador').length;

    // Colores de badges según rol
    const badgeColorRol = (rol: RolUsuario) => {
        switch (rol) {
            case 'Administrador':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'Cotizador':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Residente':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Taller':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };

    return (
        <div className="space-y-6">
            {/* CABECERA PRINCIPAL */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-900 flex items-center gap-2.5">
                        <span className="p-2 bg-blue-50 text-blue-600 rounded-xl text-lg">👥</span>
                        Control de Usuarios y Accesos
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                        Crea cuentas para tu equipo, asigna roles y administra qué módulos puede ver y usar cada colaborador.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setNuevoNombre('');
                        setNuevoEmail('');
                        setNuevoPassword('');
                        setNuevoRol('Cotizador');
                        setNuevoActivo(true);
                        setNuevosPermisos(obtenerPlantillaRol('Cotizador'));
                        setErrorFormulario('');
                        setModalCrear(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                >
                    <span className="text-base font-black">+</span>
                    Crear Nuevo Usuario
                </button>
            </div>

            {/* TARJETAS RESUMEN */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-lg font-bold">
                        👥
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Usuarios</p>
                        <p className="text-xl font-black text-gray-900">{totalUsuarios}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold">
                        ✓
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Activos</p>
                        <p className="text-xl font-black text-emerald-600">{activosCount}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-lg font-bold">
                        ⭐
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Administradores</p>
                        <p className="text-xl font-black text-purple-700">{adminsCount}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-lg font-bold">
                        🚫
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Inactivos</p>
                        <p className="text-xl font-black text-amber-600">{inactivosCount}</p>
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS Y BÚSQUEDA */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[260px]">
                    <input
                        type="text"
                        placeholder="🔍 Buscar por nombre o correo electrónico..."
                        className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500"
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-bold">
                        <span>Rol:</span>
                        <select
                            className="p-2 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                            value={filtroRol}
                            onChange={e => setFiltroRol(e.target.value)}
                        >
                            <option value="Todos">Todos los roles</option>
                            <option value="Administrador">Administrador</option>
                            <option value="Cotizador">Cotizador</option>
                            <option value="Residente">Residente</option>
                            <option value="Taller">Taller</option>
                            <option value="Personalizado">Personalizado</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-bold">
                        <span>Estado:</span>
                        <select
                            className="p-2 border border-gray-300 rounded-lg text-xs bg-white font-medium"
                            value={filtroEstado}
                            onChange={e => setFiltroEstado(e.target.value)}
                        >
                            <option value="Todos">Todos los estados</option>
                            <option value="Activos">Solo Activos</option>
                            <option value="Inactivos">Solo Inactivos</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* TABLA DE CONTROL DE ACCESOS (MATRIZ DE PERMISOS) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-wrap justify-between items-center gap-2">
                    <div>
                        <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2">
                            <span>🔐</span> Tabla de Control de Accesos por Módulo
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            Haz clic directamente sobre cualquier interruptor para asignar o quitar accesos al instante.
                        </p>
                    </div>
                    <span className="text-[11px] font-semibold bg-gray-200/80 text-gray-700 px-2.5 py-1 rounded-full">
                        {usuariosFiltrados.length} {usuariosFiltrados.length === 1 ? 'usuario' : 'usuarios'}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                        <thead className="bg-gray-100/80 text-gray-700 border-b border-gray-200">
                            <tr>
                                <th className="p-3.5 min-w-[200px] font-bold">Colaborador / Usuario</th>
                                <th className="p-3 text-center font-bold">Rol</th>
                                <th className="p-3 text-center font-bold">Estado</th>
                                {LISTA_MODULOS.map(mod => (
                                    <th
                                        key={mod.id}
                                        className="p-3 text-center font-bold min-w-[100px] border-l border-gray-200/60"
                                        title={`${mod.nombre}: ${mod.descripcion}`}
                                    >
                                        <div className="flex flex-col items-center">
                                            <span className="text-base leading-none mb-1">{mod.icono}</span>
                                            <span className="text-[10px] leading-tight text-gray-600 uppercase">
                                                {mod.nombre.split(' ')[0]}
                                            </span>
                                        </div>
                                    </th>
                                ))}
                                <th className="p-3 text-center font-bold min-w-[130px] border-l border-gray-200">Acciones</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-gray-200">
                            {cargando ? (
                                <tr>
                                    <td colSpan={11} className="p-12 text-center text-gray-400 font-semibold italic">
                                        Cargando lista de usuarios y accesos...
                                    </td>
                                </tr>
                            ) : usuariosFiltrados.length === 0 ? (
                                <tr>
                                    <td colSpan={11} className="p-12 text-center text-gray-400 italic">
                                        No se encontraron usuarios que coincidan con la búsqueda.
                                    </td>
                                </tr>
                            ) : (
                                usuariosFiltrados.map(u => {
                                    const esUsuarioActual = u.id === usuarioActualId;
                                    const iniciales = (u.nombre || u.email || 'U')
                                        .split(' ')
                                        .filter(Boolean)
                                        .map(w => w[0])
                                        .slice(0, 2)
                                        .join('')
                                        .toUpperCase();

                                    return (
                                        <tr key={u.id} className="hover:bg-gray-50/70 transition-colors">
                                            {/* DATOS DEL COLABORADOR */}
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shadow-inner flex-shrink-0 ${
                                                        u.rol === 'Administrador'
                                                            ? 'bg-purple-600 text-white'
                                                            : u.activo
                                                            ? 'bg-blue-600 text-white'
                                                            : 'bg-gray-300 text-gray-600'
                                                    }`}>
                                                        {iniciales}
                                                    </div>
                                                    <div className="truncate max-w-[200px]">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-bold text-gray-900 text-xs truncate">
                                                                {u.nombre || 'Sin nombre'}
                                                            </span>
                                                            {esUsuarioActual && (
                                                                <span className="bg-blue-100 text-blue-700 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                                                                    Tú
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] text-gray-500 block truncate" title={u.email}>
                                                            {u.email}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* ROL */}
                                            <td className="p-3 text-center">
                                                <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${badgeColorRol(u.rol)}`}>
                                                    {u.rol}
                                                </span>
                                            </td>

                                            {/* ESTADO ACTIVO / INACTIVO */}
                                            <td className="p-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => toggleEstadoUsuario(u)}
                                                    disabled={esUsuarioActual}
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold transition-all border ${
                                                        u.activo
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                            : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                                                    } ${esUsuarioActual ? 'cursor-not-allowed opacity-80' : 'cursor-pointer'}`}
                                                    title={esUsuarioActual ? 'No puedes desactivar tu propia cuenta' : 'Clic para activar o desactivar usuario'}
                                                >
                                                    {u.activo ? '● Activo' : '○ Inactivo'}
                                                </button>
                                            </td>

                                            {/* COLUMNAS DE MÓDULOS (SWITCHES INTERACTIVOS) */}
                                            {LISTA_MODULOS.map(mod => {
                                                const tieneAcceso = u.permisos ? u.permisos[mod.id] : false;
                                                const esModuloBloqueado = esUsuarioActual && mod.id === 'usuarios';

                                                return (
                                                    <td
                                                        key={mod.id}
                                                        className="p-3 text-center border-l border-gray-100"
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() => togglePermisoDirecto(u, mod.id)}
                                                            disabled={esModuloBloqueado}
                                                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                                                tieneAcceso ? 'bg-blue-600' : 'bg-gray-200'
                                                            } ${esModuloBloqueado ? 'opacity-60 cursor-not-allowed' : 'hover:ring-2 hover:ring-blue-300'}`}
                                                            title={
                                                                esModuloBloqueado
                                                                    ? 'No puedes remover tu propio acceso de administrador de usuarios'
                                                                    : `${tieneAcceso ? 'Desactivar' : 'Activar'} acceso a ${mod.nombre}`
                                                            }
                                                        >
                                                            <span
                                                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                                                    tieneAcceso ? 'translate-x-4' : 'translate-x-0'
                                                                }`}
                                                            />
                                                        </button>
                                                    </td>
                                                );
                                            })}

                                            {/* ACCIONES */}
                                            <td className="p-3 text-center border-l border-gray-100 space-x-1.5 whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onClick={() => abrirEdicion(u)}
                                                    className="bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                                    title="Editar datos y permisos"
                                                >
                                                    ✏️ Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => enviarRecuperacionPassword(u.email, u.nombre)}
                                                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                                    title="Enviar correo para restablecer contraseña"
                                                >
                                                    🔑 Reset
                                                </button>
                                                {!esUsuarioActual && (
                                                    <button
                                                        type="button"
                                                        onClick={() => eliminarUsuario(u)}
                                                        className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                                        title="Eliminar usuario"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PIE DE LA TABLA: EXPLICACIÓN DE MÓDULOS */}
                <div className="p-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-[11px] font-bold text-gray-700 mb-2">📌 Referencia de Módulos del ERP:</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-[10px] text-gray-600">
                        {LISTA_MODULOS.map(m => (
                            <div key={m.id} className="bg-white p-2 rounded-lg border border-gray-200 flex items-start gap-1.5">
                                <span className="text-sm">{m.icono}</span>
                                <div>
                                    <strong className="block text-gray-800">{m.nombre}</strong>
                                    <span className="text-gray-500 leading-tight block">{m.descripcion}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* MODAL: CREAR NUEVO USUARIO */}
            {modalCrear && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-gray-200 my-8">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <div>
                                <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-2">
                                    <span>➕</span> Crear Nuevo Usuario
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    El usuario podrá ingresar con su correo y contraseña a los módulos autorizados.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setModalCrear(false)}
                                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 rounded-lg hover:bg-gray-100"
                            >
                                ✕
                            </button>
                        </div>

                        {errorFormulario && (
                            <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl mb-4 font-semibold">
                                ⚠️ {errorFormulario}
                            </div>
                        )}

                        <form onSubmit={crearUsuario} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Nombre Completo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej. Ing. Carlos Mendoza"
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
                                    value={nuevoNombre}
                                    onChange={e => setNuevoNombre(e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Correo Electrónico <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        placeholder="carlos@ingenieriabench.mx"
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
                                        value={nuevoEmail}
                                        onChange={e => setNuevoEmail(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Contraseña Inicial <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={mostrarPassword ? 'text' : 'password'}
                                            required
                                            minLength={6}
                                            placeholder="Mínimo 6 caracteres"
                                            className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-white font-medium pr-10 focus:ring-2 focus:ring-blue-500"
                                            value={nuevoPassword}
                                            onChange={e => setNuevoPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setMostrarPassword(!mostrarPassword)}
                                            className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-700 font-bold"
                                        >
                                            {mostrarPassword ? '🙈' : '👁️'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Plantilla de Rol
                                    </label>
                                    <select
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-white font-bold text-gray-800"
                                        value={nuevoRol}
                                        onChange={e => manejarCambioRolNuevo(e.target.value as RolUsuario)}
                                    >
                                        <option value="Administrador">Administrador (Todos los módulos)</option>
                                        <option value="Cotizador">Cotizador (Presupuestos, Catálogos)</option>
                                        <option value="Residente">Residente (Obras, Almacén)</option>
                                        <option value="Taller">Taller (Destajos, Inventario)</option>
                                        <option value="Personalizado">Personalizado (Selección libre)</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-3 pt-5">
                                    <label className="text-xs font-bold text-gray-700">Estado de cuenta:</label>
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={nuevoActivo}
                                            onChange={e => setNuevoActivo(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                                        <span className="ms-2 text-xs font-bold text-gray-800">
                                            {nuevoActivo ? 'Activa' : 'Desactivada'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* SELECCIÓN DE PERMISOS MÓDULO POR MÓDULO */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="flex justify-between items-center mb-2.5">
                                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <span>🔑</span> Asignación de Permisos por Módulo:
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setNuevosPermisos({ ...PERMISOS_ADMIN })}
                                            className="text-[10px] text-blue-700 hover:underline font-bold"
                                        >
                                            Todos
                                        </button>
                                        <span className="text-gray-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setNuevosPermisos({ ...PERMISOS_DEFAULT })}
                                            className="text-[10px] text-gray-500 hover:underline font-bold"
                                        >
                                            Ninguno
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {LISTA_MODULOS.map(m => {
                                        const marcado = nuevosPermisos[m.id];
                                        return (
                                            <label
                                                key={m.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                                    marcado
                                                        ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-bold'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={marcado}
                                                    onChange={e => {
                                                        setNuevosPermisos({
                                                            ...nuevosPermisos,
                                                            [m.id]: e.target.checked
                                                        });
                                                        setNuevoRol('Personalizado');
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-sm">{m.icono}</span>
                                                <span className="truncate">{m.nombre}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setModalCrear(false)}
                                    className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                                >
                                    {guardando ? (
                                        <>
                                            <span className="animate-spin text-sm">⏳</span>
                                            Creando Usuario...
                                        </>
                                    ) : (
                                        <>
                                            <span>💾</span>
                                            Guardar y Dar Acceso
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: EDITAR USUARIO Y PERMISOS */}
            {modalEditar && usuarioEditando && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-gray-200 my-8">
                        <div className="flex justify-between items-center border-b pb-3 mb-4">
                            <div>
                                <h3 className="font-extrabold text-lg text-gray-900 flex items-center gap-2">
                                    <span>✏️</span> Editar Usuario: {usuarioEditando.nombre}
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Correo: <strong>{usuarioEditando.email}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setModalEditar(false);
                                    setUsuarioEditando(null);
                                }}
                                className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 rounded-lg hover:bg-gray-100"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={guardarEdicionUsuario} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 mb-1">
                                    Nombre Completo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-white font-medium focus:ring-2 focus:ring-blue-500"
                                    value={usuarioEditando.nombre}
                                    onChange={e => setUsuarioEditando({ ...usuarioEditando, nombre: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Rol Asignado
                                    </label>
                                    <select
                                        className="w-full p-2.5 border border-gray-300 rounded-lg text-xs bg-white font-bold text-gray-800"
                                        value={usuarioEditando.rol}
                                        onChange={e => manejarCambioRolEdicion(e.target.value as RolUsuario)}
                                    >
                                        <option value="Administrador">Administrador (Todos los módulos)</option>
                                        <option value="Cotizador">Cotizador (Presupuestos, Catálogos)</option>
                                        <option value="Residente">Residente (Obras, Almacén)</option>
                                        <option value="Taller">Taller (Destajos, Inventario)</option>
                                        <option value="Personalizado">Personalizado</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-3 pt-5">
                                    <label className="text-xs font-bold text-gray-700">Estado de cuenta:</label>
                                    <label className="inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={usuarioEditando.activo}
                                            disabled={usuarioEditando.id === usuarioActualId}
                                            onChange={e => setUsuarioEditando({ ...usuarioEditando, activo: e.target.checked })}
                                            className="sr-only peer"
                                        />
                                        <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600" />
                                        <span className="ms-2 text-xs font-bold text-gray-800">
                                            {usuarioEditando.activo ? 'Activa' : 'Desactivada'}
                                        </span>
                                    </label>
                                </div>
                            </div>

                            {/* SELECCIÓN DE PERMISOS */}
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <div className="flex justify-between items-center mb-2.5">
                                    <label className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                        <span>🔑</span> Permisos de Acceso Asignados:
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setUsuarioEditando({
                                                ...usuarioEditando,
                                                permisos: { ...PERMISOS_ADMIN }
                                            })}
                                            className="text-[10px] text-blue-700 hover:underline font-bold"
                                        >
                                            Marcar todos
                                        </button>
                                        <span className="text-gray-300">|</span>
                                        <button
                                            type="button"
                                            onClick={() => setUsuarioEditando({
                                                ...usuarioEditando,
                                                permisos: { ...PERMISOS_DEFAULT }
                                            })}
                                            className="text-[10px] text-gray-500 hover:underline font-bold"
                                        >
                                            Desmarcar todos
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {LISTA_MODULOS.map(m => {
                                        const marcado = usuarioEditando.permisos ? usuarioEditando.permisos[m.id] : false;
                                        const bloqueado = usuarioEditando.id === usuarioActualId && m.id === 'usuarios';

                                        return (
                                            <label
                                                key={m.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                                    marcado
                                                        ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-bold'
                                                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                } ${bloqueado ? 'opacity-60 cursor-not-allowed' : ''}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={marcado}
                                                    disabled={bloqueado}
                                                    onChange={e => {
                                                        setUsuarioEditando({
                                                            ...usuarioEditando,
                                                            rol: 'Personalizado',
                                                            permisos: {
                                                                ...usuarioEditando.permisos,
                                                                [m.id]: e.target.checked
                                                            }
                                                        });
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                />
                                                <span className="text-sm">{m.icono}</span>
                                                <span className="truncate">{m.nombre}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => enviarRecuperacionPassword(usuarioEditando.email, usuarioEditando.nombre)}
                                    className="text-xs text-blue-700 hover:text-blue-900 font-bold flex items-center gap-1.5 underline"
                                >
                                    <span>🔑</span> Enviar correo de restablecer contraseña
                                </button>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalEditar(false);
                                            setUsuarioEditando(null);
                                        }}
                                        className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={guardando}
                                        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow flex items-center gap-2 cursor-pointer"
                                    >
                                        {guardando ? 'Guardando...' : 'Guardar Cambios'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
