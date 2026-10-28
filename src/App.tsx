import { useState } from 'react';
import Layout from './components/Layout';
import CatalogoMateriales from './components/CatalogoMateriales';
import ModelosHerreria from './components/ModelosHerreria';
import Obras from './components/Obras';
import Inventario from './components/Inventario';
import DestajosTaller from './components/DestajosTaller';
import Presupuestos from './components/Presupuestos'; // <-- NUEVA LÍNEA

function App() {
  const [activeView, setActiveView] = useState('obras');

  return (
    <Layout activeView={activeView} setActiveView={setActiveView}>
      <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 min-h-full">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 capitalize">
          Módulo: {activeView.replace('-', ' ')}
        </h2>

        {activeView === 'obras' ? <Obras />
          : activeView === 'presupuestos' ? <Presupuestos /> // <-- NUEVA LÍNEA
            : activeView === 'materiales' ? <CatalogoMateriales />
              : activeView === 'modelos' ? <ModelosHerreria />
                : activeView === 'inventario' ? <Inventario />
                  : activeView === 'taller' ? <DestajosTaller />
                    : <p className="text-gray-600">Módulo en construcción.</p>}
      </div>
    </Layout>
  );
}

export default App;