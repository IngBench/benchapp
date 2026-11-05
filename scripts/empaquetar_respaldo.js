import fs from 'fs';
import path from 'path';

const SRC_APP = 'C:\\Users\\jrodo\\OneDrive\\Escritorio\\APPs\\Bench_App_V3';
const BACKUP_ROOT = 'C:\\Users\\jrodo\\OneDrive\\Escritorio\\RESPALDO_BENCH_APP_2026-11-05';
const SRC_DEST = path.join(BACKUP_ROOT, '02_Codigo_Fuente_App_V3');
const BUILD_DEST = path.join(BACKUP_ROOT, '03_Build_Produccion_Listo_Para_Usar');

fs.mkdirSync(SRC_DEST, { recursive: true });
fs.mkdirSync(BUILD_DEST, { recursive: true });

// Copy function with exclusions
function copyDirRecursive(src, dest, excludeDirs = []) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) {
        continue;
      }
      copyDirRecursive(srcPath, destPath, excludeDirs);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('1. Copiando código fuente limpio a 02_Codigo_Fuente_App_V3...');
copyDirRecursive(SRC_APP, SRC_DEST, ['node_modules', '.git', 'dist', '.vscode']);
console.log('✓ Código fuente copiado con éxito.');

console.log('2. Copiando build de producción a 03_Build_Produccion_Listo_Para_Usar...');
copyDirRecursive(path.join(SRC_APP, 'dist'), BUILD_DEST, []);
console.log('✓ Build copiado con éxito.');

// Crear README descriptivo
const readmeContent = `================================================================================
RESPALDO INTEGRAL DEL SISTEMA BENCH ERP (INGENIERÍA BENCH)
Fecha de creación: 05 de Noviembre de 2026
Destino: Escritorio del Usuario
================================================================================

Este paquete contiene la copia de seguridad completa del sistema, incluyendo
toda la base de datos descargada directamente desde la nube de Firebase Firestore,
el código fuente íntegro de la aplicación y la versión de producción compilada.

--------------------------------------------------------------------------------
ESTRUCTURA DEL RESPALDO:
--------------------------------------------------------------------------------

01_Base_de_Datos_Nube_Firebase/
  Contiene los datos extraídos en tiempo real de Firebase Firestore:
  - LIBRO_MAESTRO_BASE_DE_DATOS_BENCH.xlsx:
      Archivo Excel consolidado que reúne TODAS las tablas en un único libro,
      con pestañas separadas para Facturas, Materiales, Obras, Modelos, etc.
  - RESPALDO_TOTAL_BASE_DATOS_FIREBASE.json:
      Copia total de la base de datos en formato JSON listo para restauraciones.
  - Archivos individuales por colección (en formato .xlsx y .json):
      * 01_Facturas_Cobranza.xlsx / .json  (606 registros de facturación con abonos y saldos)
      * 02_Obras_Contratos.xlsx / .json   (1 contrato/obra registrado)
      * 03_Catalogo_Materiales.xlsx / .json (312 materiales del catálogo)
      * 04_Modelos_Herreria.xlsx / .json  (9 modelos de herrería)
      * 05_Presupuestos.xlsx / .json      (2 presupuestos)
      * 06_Usuarios_Sistema.xlsx / .json  (6 usuarios de acceso)
      * 07_Maquinaria_Equipos.xlsx / .json (9 equipos de maquinaria)
      * 08_Maquinaria_Operadores.xlsx / .json (3 operadores)
      * 09_Maquinaria_Ubicaciones.xlsx / .json (6 ubicaciones)
      * 10_Maquinaria_Registros.xlsx / .json
      * 11_Maquinaria_Mantenimientos.xlsx / .json

02_Codigo_Fuente_App_V3/
  Código fuente completo de la aplicación (React 19 + TypeScript + Vite + Tailwind CSS):
  - Incluye todos los componentes, vistas de Cobranza, Obras, Presupuestos,
    Maquinaria, Catálogo de Materiales y configuraciones de sincronización en la nube.
  - Excluye "node_modules" para mantener el tamaño ligero.
  - Para volver a correrlo en cualquier computadora:
      1. Abrir terminal en la carpeta
      2. Ejecutar: npm install
      3. Ejecutar: npm run dev

03_Build_Produccion_Listo_Para_Usar/
  Versión web optimizada y compilada (HTML/JS/CSS listos).
  - Es exactamente la misma compilación que se sube al servidor web (hosting).
  - Puede previsualizarse con cualquier servidor local (npx serve / live server)
    o subirse a cualquier servicio de hosting (Hostinger, cPanel, Vercel, Firebase Hosting, etc.).

--------------------------------------------------------------------------------
RESUMEN DE REGISTROS EN NUBE:
--------------------------------------------------------------------------------
- Facturas y Cobranza:  606 registros
- Catálogo Materiales:  312 registros
- Modelos Herrería:       9 registros
- Equipos Maquinaria:     9 registros
- Ubicaciones Obras:      6 registros
- Cuentas de Usuario:     6 registros
- Operadores:             3 registros
- Presupuestos:           2 registros
- Obras / Contratos:      1 registro
================================================================================
`;

fs.writeFileSync(path.join(BACKUP_ROOT, 'README_RESPALDO.txt'), readmeContent, 'utf8');
console.log('✓ README_RESPALDO.txt generado.');
