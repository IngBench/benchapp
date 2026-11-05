import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';

const firebaseConfig = {
  apiKey: "AIzaSyA3fj71UAECy-6xQumx3Kxbh8vp0Jv_VdE",
  authDomain: "benchapp-30666.firebaseapp.com",
  projectId: "benchapp-30666",
  storageBucket: "benchapp-30666.firebasestorage.app",
  messagingSenderId: "707386659062",
  appId: "1:707386659062:web:c2db797a37f52f2c2edcd7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const BASE_BACKUP_DIR = 'C:\\Users\\jrodo\\OneDrive\\Escritorio\\RESPALDO_BENCH_APP_2026-11-05';
const DB_DIR = path.join(BASE_BACKUP_DIR, '01_Base_de_Datos_Nube_Firebase');

fs.mkdirSync(DB_DIR, { recursive: true });

const collectionsToExport = [
  { id: 'facturas_cobranza', label: '01_Facturas_Cobranza', sheetName: 'Facturas' },
  { id: 'obras', label: '02_Obras_Contratos', sheetName: 'Obras' },
  { id: 'materiales', label: '03_Catalogo_Materiales', sheetName: 'Materiales' },
  { id: 'modelos', label: '04_Modelos_Herreria', sheetName: 'Modelos' },
  { id: 'presupuestos', label: '05_Presupuestos', sheetName: 'Presupuestos' },
  { id: 'usuarios', label: '06_Usuarios_Sistema', sheetName: 'Usuarios' },
  { id: 'maquinaria_equipos', label: '07_Maquinaria_Equipos', sheetName: 'Maquinaria' },
  { id: 'maquinaria_operadores', label: '08_Maquinaria_Operadores', sheetName: 'Operadores' },
  { id: 'maquinaria_ubicaciones', label: '09_Maquinaria_Ubicaciones', sheetName: 'Ubicaciones' },
  { id: 'maquinaria_registros', label: '10_Maquinaria_Registros', sheetName: 'Jornadas_Maq' },
  { id: 'maquinaria_mantenimientos', label: '11_Maquinaria_Mantenimientos', sheetName: 'Mantenimientos_Maq' }
];

async function run() {
  console.log('Iniciando descarga completa de la base de datos de Firebase...');
  const fullBackup = {};
  const masterWorkbook = XLSX.utils.book_new();
  const summaryReport = [];

  for (const col of collectionsToExport) {
    try {
      console.log(`Descargando colección "${col.id}"...`);
      const snapshot = await getDocs(collection(db, col.id));
      const items = [];
      snapshot.forEach(docSnap => {
        items.push({
          id_documento: docSnap.id,
          ...docSnap.data()
        });
      });

      fullBackup[col.id] = items;
      summaryReport.push({ coleccion: col.id, nombre: col.label, total: items.length });

      // 1. Guardar archivo JSON individual
      fs.writeFileSync(
        path.join(DB_DIR, `${col.label}.json`),
        JSON.stringify(items, null, 2),
        'utf8'
      );

      // 2. Aplanar registros para hojas de cálculo de Excel
      const flatItems = items.map(item => {
        const row = {};
        for (const [k, v] of Object.entries(item)) {
          if (v === null || v === undefined) {
            row[k] = '';
          } else if (typeof v === 'object') {
            row[k] = JSON.stringify(v);
          } else {
            row[k] = v;
          }
        }
        return row;
      });

      // 3. Guardar archivo XLSX individual
      const wsInd = flatItems.length > 0 
        ? XLSX.utils.json_to_sheet(flatItems)
        : XLSX.utils.json_to_sheet([{ Nota: 'Sin registros registrados' }]);
        
      const wbInd = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wbInd, wsInd, col.sheetName);
      XLSX.writeFile(wbInd, path.join(DB_DIR, `${col.label}.xlsx`));

      // 4. Agregar como pestaña en el Libro Maestro de Excel
      XLSX.utils.book_append_sheet(masterWorkbook, wsInd, col.sheetName);

      console.log(`✓ ${col.label}: ${items.length} registros guardados en JSON y XLSX.`);
    } catch (err) {
      console.error(`Error descargando ${col.id}:`, err);
    }
  }

  // Guardar archivo JSON con toda la base de datos completa unificada
  fs.writeFileSync(
    path.join(DB_DIR, 'RESPALDO_TOTAL_BASE_DATOS_FIREBASE.json'),
    JSON.stringify(fullBackup, null, 2),
    'utf8'
  );

  // Guardar Libro Maestro Excel con todas las pestañas juntas
  XLSX.writeFile(masterWorkbook, path.join(DB_DIR, 'LIBRO_MAESTRO_BASE_DE_DATOS_BENCH.xlsx'));
  console.log('✓ Libro Maestro Excel guardado exitosamente.');

  return summaryReport;
}

run().then((report) => {
  console.log('=== DESCARGA DE FIREBASE FINALIZADA CON ÉXITO ===');
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}).catch(err => {
  console.error('Error fatal durante la descarga:', err);
  process.exit(1);
});
