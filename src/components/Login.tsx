import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const iniciarSesion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, correo, password);
      // Si el acceso es correcto, Firebase avisará a la App automáticamente
    } catch (err: any) {
      setError('Credenciales incorrectas o acceso denegado.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md border-t-4 border-blue-600">
        <div className="text-center mb-8">
          <img src="/logo.jpeg" alt="Bench Logo" className="h-20 mx-auto object-contain mb-4" />
          <h2 className="text-2xl font-black text-gray-900">ERP Ingeniería</h2>
          <p className="text-gray-500 text-sm">Control de Obras y Presupuestos</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm font-bold text-center">{error}</div>}

        <form onSubmit={iniciarSesion} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Correo Electrónico</label>
            <input 
              type="email" required className="w-full p-3 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              value={correo} onChange={(e) => setCorreo(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Contraseña</label>
            <input 
              type="password" required className="w-full p-3 border rounded bg-gray-50 focus:ring-2 focus:ring-blue-600 focus:outline-none"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" className="w-full bg-gray-900 text-white font-bold py-3 rounded hover:bg-gray-800 transition-colors shadow-md">
            Ingresar al Sistema
          </button>
        </form>
      </div>
    </div>
  );
}