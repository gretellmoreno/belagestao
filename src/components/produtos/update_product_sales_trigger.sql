-- Script para corrigir a inserção de dados na tabela product_sales
-- Este script garante a consistência entre os campos appointment_id e source

DO $$
BEGIN
    -- 1. Verificação da estrutura da tabela product_sales
    RAISE NOTICE 'Verificando estrutura da tabela product_sales...';
    
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'product_sales' 
        AND column_name = 'source'
    ) THEN
        RAISE NOTICE 'Adicionando coluna source à tabela product_sales...';
        ALTER TABLE product_sales ADD COLUMN source VARCHAR(20) DEFAULT 'direct';
        COMMENT ON COLUMN product_sales.source IS 'Origem da venda: appointment (atendimento) ou direct/sale (venda direta)';
    END IF;
    
    -- 2. Atualizar ou criar a função de trigger para processar produtos de atendimentos
    RAISE NOTICE 'Atualizando função de processamento de produtos em atendimentos...';
    
    CREATE OR REPLACE FUNCTION process_appointment_products()
    RETURNS TRIGGER AS $$
    DECLARE
        product_record JSONB;
        sale_id UUID;
    BEGIN
        -- Só processar se houver produtos e o status for 'finalizado'
        IF NEW.status = 'finalizado' AND 
           NEW.products_data IS NOT NULL AND 
           jsonb_array_length(NEW.products_data) > 0 THEN
            
            -- Criar o registro principal na tabela product_sales
            INSERT INTO product_sales (
                appointment_id,
                client_id,
                professional_id,
                payment_method_id,
                sale_date,
                source,
                status
            ) VALUES (
                NEW.id,
                NEW.client_id,
                NEW.professional_id,
                NEW.payment_method_id,
                NEW.date,
                'appointment',  -- Definir explicitamente como 'appointment' para vendas de atendimentos
                'completed'
            ) RETURNING id INTO sale_id;
            
            -- Para cada produto no products_data
            FOR i IN 0..jsonb_array_length(NEW.products_data) - 1 LOOP
                product_record := NEW.products_data->i;
                
                -- Inserir na tabela product_sales_items
                INSERT INTO product_sales_items (
                    sale_id,
                    product_id,
                    product_name,
                    quantity,
                    unit_price,
                    gross_total,
                    created_at
                ) VALUES (
                    sale_id,
                    (product_record->>'product_id')::UUID,
                    product_record->>'product_name',
                    COALESCE((product_record->>'quantity')::INTEGER, 1),
                    COALESCE((product_record->>'unit_price')::DECIMAL, 0),
                    COALESCE((product_record->>'unit_price')::DECIMAL, 0) * COALESCE((product_record->>'quantity')::INTEGER, 1),
                    NOW()
                );
            END LOOP;
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- 3. Atualizar ou criar a função de trigger para vendas diretas (via ProductSaleForm)
    RAISE NOTICE 'Criando função para validar vendas diretas antes da inserção...';
    
    CREATE OR REPLACE FUNCTION validate_product_sales_before_insert()
    RETURNS TRIGGER AS $$
    BEGIN
        -- Regra 1: Se source = 'appointment', appointment_id deve estar preenchido
        IF NEW.source = 'appointment' AND (NEW.appointment_id IS NULL) THEN
            RAISE EXCEPTION 'Inconsistência de dados: source = appointment mas appointment_id está vazio';
        END IF;
        
        -- Regra 2: Se source = 'direct' ou 'sale', appointment_id deve ser NULL
        IF (NEW.source = 'direct' OR NEW.source = 'sale') AND NEW.appointment_id IS NOT NULL THEN
            -- Auto-correção: para vendas diretas, sempre definir appointment_id como NULL
            NEW.appointment_id := NULL;
        END IF;
        
        -- Regra 3: Se appointment_id está preenchido, definir source como 'appointment'
        IF NEW.appointment_id IS NOT NULL AND NEW.source != 'appointment' THEN
            NEW.source := 'appointment';
        END IF;
        
        -- Regra 4: Se appointment_id está vazio, definir source como 'direct' por padrão
        IF NEW.appointment_id IS NULL AND (NEW.source IS NULL OR NEW.source NOT IN ('direct', 'sale')) THEN
            NEW.source := 'direct';
        END IF;
        
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    
    -- 4. Criar trigger para validação antes da inserção
    DROP TRIGGER IF EXISTS trg_validate_product_sales ON product_sales;
    
    CREATE TRIGGER trg_validate_product_sales
    BEFORE INSERT OR UPDATE ON product_sales
    FOR EACH ROW
    EXECUTE FUNCTION validate_product_sales_before_insert();
    
    -- 5. Corrigir dados existentes
    RAISE NOTICE 'Corrigindo dados existentes na tabela product_sales...';
    
    -- a) Corrigir vendas de atendimentos sem source definida
    UPDATE product_sales
    SET source = 'appointment'
    WHERE appointment_id IS NOT NULL 
    AND (source IS NULL OR source != 'appointment');
    
    -- b) Corrigir vendas diretas com appointment_id definido
    UPDATE product_sales
    SET appointment_id = NULL
    WHERE source IN ('direct', 'sale') 
    AND appointment_id IS NOT NULL;
    
    -- c) Definir source para vendas sem source
    UPDATE product_sales
    SET source = 'direct'
    WHERE source IS NULL
    AND appointment_id IS NULL;
    
    RAISE NOTICE 'Migração concluída com sucesso!';
    RAISE NOTICE 'A tabela product_sales agora mantém consistência entre appointment_id e source.';
END;
$$; 