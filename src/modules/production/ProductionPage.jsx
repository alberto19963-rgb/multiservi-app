import React from 'react';
import { Factory, HardHat } from 'lucide-react';

export default function ProductionPage() {
  return (
    <div className="p-8 h-full flex flex-col items-center justify-center text-center">
        <div className="bg-yellow-50 p-6 rounded-full mb-6 animate-pulse">
            <Factory className="text-yellow-600" size={64} />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Módulo de Producción</h1>
        <p className="text-xl text-gray-500 max-w-md mx-auto mb-8">
            Aquí gestionarás las recetas (Fórmulas) y convertirás Materia Prima en Producto Terminado.
        </p>
        
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl text-left w-full">
            <h3 className="text-lg font-bold mb-4 flex items-center">
                <HardHat className="mr-2 text-gray-700" size={20}/>
                Características Pendientes:
            </h3>
            <ul className="space-y-3">
                <li className="flex items-start">
                    <span className="bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">1</span>
                    <span className="text-gray-600">Creación de Recetas (Ej. 1 Galón Cloro = X ml Hipoclorito + Y ml Agua)</span>
                </li>
                <li className="flex items-start">
                    <span className="bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">2</span>
                    <span className="text-gray-600">Orden de Producción (Descontar MP {'->'} Aumentar Stock PT)</span>
                </li>
                 <li className="flex items-start">
                    <span className="bg-gray-200 text-gray-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mr-3 mt-0.5">3</span>
                    <span className="text-gray-600">Cálculo de Costo de Producción</span>
                </li>
            </ul>
        </div>
    </div>
  );
}
