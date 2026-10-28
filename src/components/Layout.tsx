import React from 'react';

interface LayoutProps {
    children: React.ReactNode;
    activeView: string;
    setActiveView: (view: string) => void;
}

export default function Layout({ children, activeView, setActiveView }: LayoutProps) {
    const menuItems = [
        { id: 'obras', label: 'Obras y Contratos', icon: '🏗️' },
        { id: 'presupuestos', label: 'Presupuestos (Cotizador)', icon: '📝' }, // <-- NUEVA LÍNEA
        { id: 'inventario', label: 'Almacén y Compras', icon: '📦' },
        { id: 'taller', label: 'Taller y Destajos', icon: '👨‍🏭' },
        { id: 'modelos', label: 'Modelos de Herrería', icon: '📐' },
        { id: 'materiales', label: 'Catálogo de Acero', icon: '🔩' }
    ];

    return (
        <div className="flex h-screen bg-gray-100 font-sans">
            {/* Barra Lateral (Sidebar) */}
            <aside className="w-64 bg-gray-900 text-white flex flex-col shadow-xl">
                <div className="p-6 border-b border-gray-800 flex flex-col items-center">
                    {/* Aquí mandamos llamar la imagen desde la carpeta public */}
                    <img
                        src="/logo.jpeg"
                        alt="Bench Ingeniería"
                        className="w-full max-w-[180px] object-contain mb-2"
                    />
                    <p className="text-xs text-gray-400">ERP Ingeniería y Herrería</p>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveView(item.id)}
                            className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded transition-colors font-bold ${activeView === item.id
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                                }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div className="p-4 border-t border-gray-800 text-xs text-gray-500 text-center">
                    Ingeniería Bench S.A. de C.V.
                </div>
            </aside>

            {/* Área Principal de Trabajo */}
            <main className="flex-1 overflow-y-auto p-8 bg-gray-100">
                {children}
            </main>
        </div>
    );
}