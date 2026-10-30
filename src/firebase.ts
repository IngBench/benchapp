import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";

export const firebaseConfig = {
  apiKey: "AIzaSyA3fj71UAECy-6xQumx3Kxbh8vp0Jv_VdE",
  authDomain: "benchapp-30666.firebaseapp.com",
  projectId: "benchapp-30666",
  storageBucket: "benchapp-30666.firebasestorage.app",
  messagingSenderId: "707386659062",
  appId: "1:707386659062:web:c2db797a37f52f2c2edcd7"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar la Base de Datos y la Autenticación para usarlas en toda la app
export const db = getFirestore(app);
export const auth = getAuth(app);

// Helper para crear un nuevo usuario en Firebase Auth sin cerrar la sesión actual del administrador
export const registrarNuevoUsuarioAuth = async (email: string, pass: string) => {
  const secondaryAppName = "BenchAppAuthAdmin";
  const existingApp = getApps().find(a => a.name === secondaryAppName);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
  await signOut(secondaryAuth);
  return userCredential.user;
};
