import { useState, useEffect } from "react";
import { ValesList } from "./ValesList";
import { NovoValeModal } from "./NovoValeModal";
import { EmployeeAdvance } from "../../hooks/useFinanceiroData";
import { supabase } from "../../lib/supabaseClient";
import { toast } from "react-hot-toast";

export const ValesPage = () => {
  const [showNewValeModal, setShowNewValeModal] = useState(false);
  const [vales, setVales] = useState<EmployeeAdvance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Carregar vales ao montar o componente
  useEffect(() => {
    fetchVales();
  }, []);

  // Função para buscar vales do Supabase
  const fetchVales = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("professional_advances")
        .select(`
          id,
          value,
          created_at,
          professional_id,
          discounted,
          closure_date,
          professionals (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      console.log("Dados dos vales obtidos:", data);
      
      // Converter os dados para o formato esperado pela interface EmployeeAdvance
      const formattedVales: EmployeeAdvance[] = (data || []).map(vale => {
        // Usar tipo apropriado para a resposta do Supabase
        const professionalName = ((vale.professionals as any)?.name) || '—';
        
        return {
          id: vale.id,
          amount: vale.value,
          date: vale.created_at,
          professional_id: vale.professional_id,
          professional: {
            id: vale.professional_id || '',
            name: professionalName
          },
          discounted: vale.discounted || false,
          closure_date: vale.closure_date
        };
      });
      
      console.log("Vales formatados:", formattedVales);
      setVales(formattedVales);
    } catch (error) {
      console.error('Erro ao buscar vales:', error);
      toast.error('Não foi possível carregar os vales registrados.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para editar um vale existente
  const handleEditVale = (id: string) => {
    // Implementação será adicionada posteriormente
    console.log("Editar vale:", id);
  };

  // Função para excluir um vale (REMOVIDO - vales não podem mais ser excluídos)
  const handleDeleteVale = async (id: string) => {
    toast.error('Vales não podem ser excluídos. Eles são marcados como descontados durante o fechamento de caixa.');
  };

  // Função chamada quando o modal é fechado
  const handleCloseModal = () => {
    setShowNewValeModal(false);
    fetchVales(); // Atualizar a lista de vales ao fechar o modal
  };

  // Adicionar função para monitorar quando o modal é aberto
  const handleOpenModal = () => {
    console.log("Abrindo modal, estado anterior:", showNewValeModal);
    setShowNewValeModal(true);
    console.log("Modal aberto, novo estado:", true);
  };

  console.log("Estado atual do showNewValeModal:", showNewValeModal);

  return (
    <>
      <ValesList 
        vales={vales} 
        handleEditVale={handleEditVale}
        handleDeleteVale={handleDeleteVale}
        setShowNewValeModal={handleOpenModal}
        isLoading={isLoading}
      />
      {showNewValeModal && (
        <NovoValeModal onClose={handleCloseModal} />
      )}
    </>
  );
}; 