import React, { useMemo, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import useFinanceiroData from '../../hooks/useFinanceiroData';

// Componentes
import TabsNavigation from '../../components/financeiro/TabsNavigation';
import ValesList from '../../components/financeiro/ValesList';
import ValesModal from '../../components/financeiro/ValesModal';
import { NovoValeModal } from '../../components/financeiro/NovoValeModal';
import PaymentFees from '../../components/financeiro/PaymentFees';
import PaymentMethodModal from '../../components/financeiro/PaymentMethodModal';
import CaixaOperacao from '../../components/financeiro/CaixaOperacao';
import HistoricoResumo from '../../components/financeiro/HistoricoResumo';
import HistoricoAtendimentos from '../../components/financeiro/HistoricoAtendimentos';
import HistoricoProdutos from '../../components/financeiro/HistoricoProdutos';
import PeriodoSelector from '../../components/financeiro/PeriodoSelector';
import MobileLayout from '../../components/financeiro/MobileLayout';
import DesktopLayout from '../../components/financeiro/DesktopLayout';

const Financeiro: React.FC = () => {
  // Usar o hook personalizado para obter todos os dados e funções
  const financeiro = useFinanceiroData();
  
  // Memoizar o handler de atualização de atendimentos para evitar recriações
  const handleAppointmentUpdated = useCallback((event: Event) => {
    // Realizar cast para CustomEvent e acessar detail
    const customEvent = event as CustomEvent;
    // Verificar se o status do atendimento é 'finalizado'
    if (customEvent.detail?.status === 'finalizado') {
      console.log('Financeiro: Atendimento finalizado detectado, atualizando relatório financeiro');
      // Verifica qual aba está ativa para atualizar os dados corretamente
      if (financeiro.activeTab === 'historico') {
        financeiro.fetchHistoricalData();
      } else if (financeiro.activeTab === 'caixa' && financeiro.selectedProfessional) {
        financeiro.handleProfessionalCashDetail(financeiro.selectedProfessional);
      }
    }
  }, [
    financeiro.activeTab, 
    financeiro.selectedProfessional, 
    financeiro.fetchHistoricalData, 
    financeiro.handleProfessionalCashDetail
  ]);

  // Listener adicional para garantir que a página seja atualizada quando um atendimento for finalizado
  useEffect(() => {
    // Adicionar o listener ao window
    window.addEventListener('appointmentUpdated', handleAppointmentUpdated);

    // Remover o listener quando o componente for desmontado
    return () => {
      window.removeEventListener('appointmentUpdated', handleAppointmentUpdated);
    };
  }, [handleAppointmentUpdated]); // Dependência do callback memoizado
  
  // Gerar o texto de período formatado
  const dateRangeText = useMemo(() => {
    if (!financeiro.dateRange.startDate || !financeiro.dateRange.endDate) {
      return 'Período não selecionado';
    }
    
    const start = format(financeiro.dateRange.startDate, 'dd/MM/yyyy', { locale: ptBR });
    const end = format(financeiro.dateRange.endDate, 'dd/MM/yyyy', { locale: ptBR });
    
    if (start === end) return `${start}`;
    return `${start} - ${end}`;
  }, [financeiro.dateRange.startDate, financeiro.dateRange.endDate]);
  
  // Memoizar componentes principais para evitar re-renderizações desnecessárias
  const valesContent = useMemo(() => (
    <>
      <ValesList 
        vales={financeiro.vales}
        onEditVale={financeiro.handleEditVale}
        onDeleteVale={financeiro.handleDeleteVale}
        isLoading={financeiro.isUpdating}
        setShowNewValeModal={financeiro.setShowNewValeModal}
      />
    </>
  ), [
    financeiro.vales, 
    financeiro.handleEditVale, 
    financeiro.handleDeleteVale, 
    financeiro.isUpdating, 
    financeiro.setShowNewValeModal
  ]);

  const taxasContent = useMemo(() => (
    <>
      <PaymentFees
        periodoInicio={financeiro.dateRange.startDate}
        periodoFim={financeiro.dateRange.endDate}
        metodosPagamento={financeiro.paymentMethods}
        isLoading={financeiro.isUpdating}
        onEdit={financeiro.handleEditPaymentMethod}
        onDelete={financeiro.handleDeletePaymentMethod}
      />
    </>
  ), [
    financeiro.dateRange.startDate,
    financeiro.dateRange.endDate,
    financeiro.paymentMethods,
    financeiro.isUpdating,
    financeiro.handleEditPaymentMethod,
    financeiro.handleDeletePaymentMethod
  ]);

  const caixaContent = useMemo(() => (
    <CaixaOperacao
      professionals={financeiro.professionals}
      isUpdating={financeiro.isUpdating}
      handleProfessionalCashDetail={financeiro.handleProfessionalCashDetail}
    />
  ), [
    financeiro.professionals,
    financeiro.isUpdating,
    financeiro.handleProfessionalCashDetail
  ]);
  
  // Função para carregar dados das abas quando necessário
  const handleHistoryTabChange = useCallback((tab: 'resumo' | 'atendimentos' | 'produtos') => {
    console.log('🎯 handleHistoryTabChange chamada:', { tab, currentTab: financeiro.activeHistoryTab });
    
    financeiro.setActiveHistoryTab(tab);
    
    // Carregar dados específicos da aba selecionada
    if (tab === 'atendimentos') {
      console.log('📋 Aba Atendimentos selecionada');
      console.log('📊 Estado atual appointmentsHistory:', {
        length: financeiro.historicalData.appointmentsHistory.length,
        loading: financeiro.historicalData.appointmentsHistoryLoading,
        data: financeiro.historicalData.appointmentsHistory
      });
      
      if (financeiro.historicalData.appointmentsHistory.length === 0) {
        console.log('🔄 Carregando dados de atendimentos...');
        financeiro.fetchAppointmentsHistory();
      } else {
        console.log('✅ Dados de atendimentos já carregados, não recarregando');
      }
    } else if (tab === 'produtos') {
      console.log('🛒 Aba Produtos selecionada');
      console.log('📊 Estado atual productsHistory:', {
        length: financeiro.historicalData.productsHistory.length,
        loading: financeiro.historicalData.productsHistoryLoading,
        data: financeiro.historicalData.productsHistory
      });
      
      if (financeiro.historicalData.productsHistory.length === 0) {
        console.log('🔄 Carregando dados de produtos...');
        financeiro.fetchProductsHistory();
      } else {
        console.log('✅ Dados de produtos já carregados, não recarregando');
      }
    } else {
      console.log('📈 Aba Resumo selecionada - sem carregamento adicional necessário');
    }
  }, [financeiro]);
  
  return (
    <>
      {/* Estilo para o DatePicker (mantido exatamente igual ao original) */}
      <style>{`
        .react-datepicker-popper {
          z-index: 9999999 !important;
        }
        
        .react-datepicker {
          font-family: 'Inter', sans-serif !important;
          font-size: 0.7rem !important;
          border-radius: 8px !important;
          border: 1px solid #e5e7eb !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
          max-width: 260px !important;
        }
        
        .react-datepicker__month-container {
          float: none !important;
          width: 100% !important;
        }
        
        .react-datepicker__header {
          padding: 0.5rem !important;
          background-color: #f9fafb !important;
          border-bottom: 1px solid #e5e7eb !important;
        }
        
        .react-datepicker__current-month {
          font-size: 0.8rem !important;
          color: #111827 !important;
          font-weight: 600 !important;
          padding: 0.2rem 0 !important;
        }
        
        .react-datepicker__day-names {
          display: flex !important;
          justify-content: space-around !important;
          padding: 0.3rem 0 !important;
          margin-bottom: 0 !important;
        }
        
        .react-datepicker__day-name {
          color: #6366f1 !important;
          font-weight: 500 !important;
          margin: 0 !important;
          width: 1.5rem !important;
          font-size: 0.65rem !important;
        }
        
        .react-datepicker__month {
          margin: 0 !important;
          padding: 0.3rem !important;
        }
        
        .react-datepicker__week {
          display: flex !important;
          justify-content: space-around !important;
        }
        
        .react-datepicker__day {
          width: 1.5rem !important;
          height: 1.5rem !important;
          line-height: 1.5rem !important;
          margin: 0 !important;
          border-radius: 50% !important;
          color: #374151 !important;
          font-size: 0.7rem !important;
        }
        
        .react-datepicker__day:hover {
          background-color: #f3f4f6 !important;
        }
        
        .react-datepicker__day--selected {
          background-color: #6366f1 !important;
          color: white !important;
          font-weight: 600 !important;
        }
        
        .react-datepicker__navigation {
          top: 0.5rem !important;
          width: 1.5rem !important;
          height: 1.5rem !important;
          border-radius: 50% !important;
          background-color: #f3f4f6 !important;
        }
        
        .react-datepicker__navigation:hover {
          background-color: #e5e7eb !important;
        }
        
        .react-datepicker__navigation--previous {
          left: 0.5rem !important;
        }
        
        .react-datepicker__navigation--next {
          right: 0.5rem !important;
        }
        
        .react-datepicker__year-dropdown,
        .react-datepicker__month-dropdown {
          background-color: white !important;
          border-radius: 0.5rem !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
          border: 1px solid #e5e7eb !important;
          padding: 0.5rem 0 !important;
          font-size: 0.7rem !important;
          max-width: 160px !important;
          max-height: 200px !important;
          overflow-y: auto !important;
        }
        
        .react-datepicker__year-option,
        .react-datepicker__month-option {
          padding: 0.3rem 1rem !important;
          cursor: pointer !important;
        }
        
        .react-datepicker__year-option:hover,
        .react-datepicker__month-option:hover {
          background-color: #f3f4f6 !important;
        }
        
        .react-datepicker__year-option--selected,
        .react-datepicker__month-option--selected {
          background-color: #6366f1 !important;
          color: white !important;
        }
        
        .react-datepicker__year-dropdown-container,
        .react-datepicker__month-dropdown-container {
          font-size: 0.7rem !important;
          margin: 0 0.3rem !important;
        }
        
        .react-datepicker__month-select,
        .react-datepicker__year-select {
          font-size: 0.7rem !important;
          padding: 0.2rem !important;
        }
        
        .react-datepicker__month-read-view,
        .react-datepicker__year-read-view {
          font-size: 0.7rem !important;
        }
        
        @media (max-width: 768px) {
          .react-datepicker-popper {
            position: fixed !important;
            top: 50% !important;
            left: 50% !important;
            transform: translate(-50%, -50%) !important;
          }
          
          .react-datepicker {
            max-width: 260px !important;
            margin: 0 auto !important;
          }
        }

        /* Sombra suave apenas para os botões */
        .btn-shadow {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }
        
        /* Transição suave para os botões */
        .menu-transition {
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
      
      <div className="py-2 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col space-y-2">
          {/* Componente de navegação por abas */}
          <TabsNavigation 
            activeTab={financeiro.activeTab} 
            setActiveTab={financeiro.setActiveTab}
            showMobileMenu={financeiro.showMobileMenu}
            setShowMobileMenu={financeiro.setShowMobileMenu}
          />
          
          {/* Conteúdo da aba Resumo (Vales) */}
          {financeiro.activeTab === 'resumo' && (
            <>
              {console.log("Financeiro: showNewValeModal =", financeiro.showNewValeModal)}
              <MobileLayout activeTab={financeiro.activeTab}>
                {valesContent}
              </MobileLayout>
              
              <DesktopLayout>
                {valesContent}
              </DesktopLayout>
              
              {/* Modal de novo vale */}
              {financeiro.showNewValeModal && (
                <>
                  {/* Versão original do modal */}
                  <ValesModal
                    professionals={financeiro.professionals}
                    newVale={financeiro.newVale}
                    setNewVale={financeiro.setNewVale}
                    isEditMode={financeiro.isEditingVale}
                    formErrors={financeiro.formErrors}
                    isLoading={financeiro.isUpdating}
                    onClose={financeiro.handleCloseValeModal}
                    onSave={financeiro.handleSaveVale}
                  />
                  
                  {/* Versão alternativa do modal como backup caso a original não funcione */}
                  <NovoValeModal onClose={financeiro.handleCloseValeModal} />
                </>
              )}
            </>
          )}
          
          {/* Conteúdo da aba Taxas */}
          {financeiro.activeTab === 'taxas' && (
            <>
              <MobileLayout activeTab={financeiro.activeTab}>
                {taxasContent}
              </MobileLayout>
              
              <DesktopLayout>
                {taxasContent}
              </DesktopLayout>
              
              {/* Modal de método de pagamento */}
              {financeiro.showNewPaymentMethodModal && (
                <PaymentMethodModal
                  newPaymentMethod={financeiro.newPaymentMethod}
                  setNewPaymentMethod={financeiro.setNewPaymentMethod}
                  isEditMode={financeiro.isEditingPaymentMethod}
                  formErrors={financeiro.formErrors}
                  isLoading={financeiro.isUpdating}
                  onClose={financeiro.handleClosePaymentMethodModal}
                  onSave={financeiro.handleSavePaymentMethod}
                />
              )}
            </>
          )}
          
          {/* Conteúdo da aba Caixa */}
          {financeiro.activeTab === 'caixa' && (
            <>
              <MobileLayout activeTab={financeiro.activeTab}>
                {caixaContent}
              </MobileLayout>
              
              <DesktopLayout>
                {caixaContent}
              </DesktopLayout>
            </>
          )}
          
          {/* Conteúdo da aba Histórico */}
          {financeiro.activeTab === 'historico' && (
            <>
              <MobileLayout activeTab={financeiro.activeTab}>
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <div className="flex flex-col mb-2 md:mb-0">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Relatório Financeiro</h2>
                      <p className="text-sm text-gray-600">{dateRangeText}</p>
                    </div>
                    <PeriodoSelector
                      dateRange={financeiro.dateRange}
                      setDateRange={financeiro.setDateRange}
                      applyQuickPeriod={financeiro.applyQuickPeriod}
                      showPeriodModal={financeiro.showPeriodModal}
                      setShowPeriodModal={financeiro.setShowPeriodModal}
                    />
                  </div>
                  
                  {/* Sub-abas do histórico */}
                  <div className="flex border-b border-gray-200 mb-4">
                    <button
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        financeiro.activeHistoryTab === 'resumo'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => handleHistoryTabChange('resumo')}
                    >
                      Resumo
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        financeiro.activeHistoryTab === 'atendimentos'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => handleHistoryTabChange('atendimentos')}
                    >
                      Atendimentos
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        financeiro.activeHistoryTab === 'produtos'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => handleHistoryTabChange('produtos')}
                    >
                      Produtos
                    </button>
                  </div>
                </div>
                
                {/* Conteúdo da sub-aba do histórico baseado na aba ativa */}
                {financeiro.activeHistoryTab === 'resumo' && (
                  <HistoricoResumo 
                    historicalData={financeiro.historicalData}
                    isUpdating={financeiro.isUpdating}
                    dateRangeText={dateRangeText}
                    periodoInicio={financeiro.dateRange.startDate}
                    periodoFim={financeiro.dateRange.endDate}
                  />
                )}
                
                {financeiro.activeHistoryTab === 'atendimentos' && (
                  <HistoricoAtendimentos 
                    dados={financeiro.historicalData.appointmentsHistory}
                    isLoading={financeiro.historicalData.appointmentsHistoryLoading}
                  />
                )}
                
                {financeiro.activeHistoryTab === 'produtos' && (
                  <HistoricoProdutos 
                    dados={financeiro.historicalData.productsHistory}
                    isLoading={financeiro.historicalData.productsHistoryLoading}
                  />
                )}
              </MobileLayout>
              
              <DesktopLayout>
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
                    <div className="flex flex-col mb-2 md:mb-0">
                      <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Relatório Financeiro</h2>
                      <p className="text-sm text-gray-600">{dateRangeText}</p>
                    </div>
                    <PeriodoSelector
                      dateRange={financeiro.dateRange}
                      setDateRange={financeiro.setDateRange}
                      applyQuickPeriod={financeiro.applyQuickPeriod}
                      showPeriodModal={financeiro.showPeriodModal}
                      setShowPeriodModal={financeiro.setShowPeriodModal}
                    />
                  </div>
                  
                  {/* Sub-abas do histórico */}
                  <div className="flex border-b border-gray-200 mb-4">
                    <button
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        financeiro.activeHistoryTab === 'resumo'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => handleHistoryTabChange('resumo')}
                    >
                      Resumo
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        financeiro.activeHistoryTab === 'atendimentos'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => handleHistoryTabChange('atendimentos')}
                    >
                      Atendimentos
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-medium border-b-2 ${
                        financeiro.activeHistoryTab === 'produtos'
                          ? 'border-indigo-500 text-indigo-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                      onClick={() => handleHistoryTabChange('produtos')}
                    >
                      Produtos
                    </button>
                  </div>
                </div>
                
                {/* Conteúdo da sub-aba do histórico baseado na aba ativa */}
                {financeiro.activeHistoryTab === 'resumo' && (
                  <HistoricoResumo 
                    historicalData={financeiro.historicalData}
                    isUpdating={financeiro.isUpdating}
                    dateRangeText={dateRangeText}
                    periodoInicio={financeiro.dateRange.startDate}
                    periodoFim={financeiro.dateRange.endDate}
                  />
                )}
                
                {financeiro.activeHistoryTab === 'atendimentos' && (
                  <HistoricoAtendimentos 
                    dados={financeiro.historicalData.appointmentsHistory}
                    isLoading={financeiro.historicalData.appointmentsHistoryLoading}
                  />
                )}
                
                {financeiro.activeHistoryTab === 'produtos' && (
                  <HistoricoProdutos 
                    dados={financeiro.historicalData.productsHistory}
                    isLoading={financeiro.historicalData.productsHistoryLoading}
                  />
                )}
              </DesktopLayout>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default React.memo(Financeiro); 