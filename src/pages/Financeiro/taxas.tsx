import React, { useEffect } from 'react';
import Head from 'next/head';
import PaymentFees from '../../components/financeiro/PaymentFees';
import PaymentMethodModal from '../../components/financeiro/PaymentMethodModal';
import useFinanceiroData from '../../hooks/useFinanceiroData';

const TaxasPagamentoPage: React.FC = () => {
  console.log('Renderizando página de taxas de pagamento');
  const financeiro = useFinanceiroData();
  
  useEffect(() => {
    // Carregar métodos de pagamento quando a página for montada
    console.log('Página de taxas - Carregando métodos de pagamento...');
    const carregarMetodos = async () => {
      await financeiro.fetchPaymentMethods();
    };
    carregarMetodos();
  }, []);
  
  useEffect(() => {
    console.log('Página de taxas - Estado atual:', {
      paymentMethods: financeiro.paymentMethods,
      isEditing: financeiro.isEditingPaymentMethod,
      showModal: financeiro.showNewPaymentMethodModal,
      newPaymentMethod: financeiro.newPaymentMethod
    });
  }, [
    financeiro.paymentMethods, 
    financeiro.isEditingPaymentMethod, 
    financeiro.showNewPaymentMethodModal, 
    financeiro.newPaymentMethod
  ]);
  
  // Função wrapper para depuração
  const handleEditPaymentMethod = (id: string) => {
    console.log('TaxasPagamentoPage: Solicitando edição do método com ID:', id);
    financeiro.handleEditPaymentMethod(id);
  };
  
  return (
    <>
      <Head>
        <title>Taxas de Pagamento - BelaGestão</title>
      </Head>
      
      <div className="py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-gray-900 mb-6">Taxas de Pagamento</h1>
          
          <PaymentFees 
            paymentMethods={financeiro.paymentMethods}
            handleEditPaymentMethod={handleEditPaymentMethod}
            handleDeletePaymentMethod={financeiro.handleDeletePaymentMethod}
            setShowNewPaymentMethodModal={financeiro.setShowNewPaymentMethodModal}
          />
          
          {/* Modal de métodos de pagamento */}
          <PaymentMethodModal 
            isOpen={financeiro.showNewPaymentMethodModal}
            onClose={financeiro.handleClosePaymentMethodModal}
            isEditing={financeiro.isEditingPaymentMethod}
            newPaymentMethod={financeiro.newPaymentMethod}
            setNewPaymentMethod={financeiro.setNewPaymentMethod}
            formErrors={financeiro.formErrors}
            handleSavePaymentMethod={financeiro.handleSavePaymentMethod}
            isUpdating={financeiro.isUpdating}
          />
        </div>
      </div>
    </>
  );
};

export default TaxasPagamentoPage; 