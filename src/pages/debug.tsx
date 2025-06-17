import React from 'react';
import CheckTableStructure from '../components/financeiro/CheckTableStructure';

const DebugPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Página de Debug</h1>
      <CheckTableStructure />
    </div>
  );
};

export default DebugPage; 