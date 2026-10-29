import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
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