-- Função para fechar o caixa de um profissional
-- Esta função marca todos os serviços não fechados (closed = false) como fechados (closed = true)
-- para um profissional específico em um período específico.
CREATE OR REPLACE FUNCTION close_professional_cashbox(
  p_professional_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS VOID AS $$
BEGIN
  -- Atualizar os serviços relacionados a atendimentos com o status "finalizado"
  -- Usando o professional_id da tabela appointments (relacionamento correto)
  UPDATE appointment_services AS aps
  SET 
    closed = TRUE,
    closure_date = NOW()
  FROM appointments a
  WHERE 
    aps.appointment_id = a.id
    AND a.professional_id = p_professional_id
    AND a.status = 'finalizado'
    AND DATE(a.updated_at) <= p_date
    AND aps.closed = FALSE;
    
  -- Registrar na tabela de histórico
  INSERT INTO professional_cash_closings (
    professional_id,
    closure_date,
    closure_period_start,
    closure_period_end
  ) VALUES (
    p_professional_id,
    NOW(),
    p_date - INTERVAL '7 days',
    p_date
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Função para obter os serviços já fechados de um profissional (histórico)
-- Versão atualizada: retorna cada serviço individualmente em vez de agrupados por data
CREATE OR REPLACE FUNCTION get_closed_services_by_professional(
  p_professional_id UUID
)
RETURNS SETOF JSONB AS $$
DECLARE
  service_record RECORD;
  service_json JSONB;
BEGIN
  -- Buscar todos os serviços fechados do profissional
  FOR service_record IN
    SELECT 
      aps.id,
      aps.custom_price,
      aps.payment_fee,
      aps.professional_profit,
      aps.net_service_value,
      aps.commission_amount,
      aps.commission_rate,
      aps.closure_date,
      aps.created_at,
      s.name AS service_name,
      s.id AS service_id,
      a.professional_id,
      a.id AS appointment_id,
      c.name AS client_name
    FROM appointment_services aps
    JOIN appointments a ON aps.appointment_id = a.id
    LEFT JOIN services s ON aps.service_id = s.id
    LEFT JOIN clients c ON a.client_id = c.id
    WHERE a.professional_id = p_professional_id
    AND aps.closed = TRUE
    ORDER BY aps.closure_date DESC
  LOOP
    -- Criar um JSON para cada serviço
    service_json := jsonb_build_object(
      'id', service_record.id,
      'service_id', service_record.service_id,
      'appointment_id', service_record.appointment_id,
      'professional_id', service_record.professional_id,
      'client_name', service_record.client_name,
      'created_at', service_record.created_at,
      'closure_date', service_record.closure_date,
      'custom_price', service_record.custom_price,
      'payment_fee', service_record.payment_fee,
      'commission_rate', service_record.commission_rate,
      'commission_amount', service_record.commission_amount,
      'professional_profit', service_record.professional_profit,
      'net_service_value', service_record.net_service_value,
      'service_name', COALESCE(service_record.service_name, 'Serviço'),
      'closed', TRUE
    );
    
    -- Manter compatibilidade com o formato anterior para a UI
    service_json := jsonb_set(service_json, '{service_names}', to_jsonb(COALESCE(service_record.service_name, 'Serviço')));
    service_json := jsonb_set(service_json, '{gross_service_value}', to_jsonb(COALESCE(service_record.custom_price, 0)));
    
    RETURN NEXT service_json;
  END LOOP;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 