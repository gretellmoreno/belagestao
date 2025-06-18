-- Migração para corrigir o tratamento de products_data e sincronização com product_sales
-- Data: 30/09/2024

DO $$
BEGIN
    -- 1. Garantir que a coluna products_data existe e está corretamente configurada
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'appointments' 
        AND column_name = 'products_data'
    ) THEN
        ALTER TABLE appointments ADD COLUMN products_data JSONB DEFAULT '[]'::jsonb;
        COMMENT ON COLUMN appointments.products_data IS 'Dados dos produtos vendidos durante o atendimento no formato: [{product_id, product_name, quantity, unit_price}]';
    END IF;

    -- 2. Criar ou atualizar a função que processa os produtos ao finalizar o atendimento
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
                'appointment',
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

    -- 3. Criar a trigger se não existir
    DROP TRIGGER IF EXISTS trg_process_appointment_products ON appointments;
    
    CREATE TRIGGER trg_process_appointment_products
        AFTER UPDATE OF status, products_data
        ON appointments
        FOR EACH ROW
        EXECUTE FUNCTION process_appointment_products();

    -- 4. Criar índices para melhorar performance
    CREATE INDEX IF NOT EXISTS idx_appointments_products_data ON appointments USING gin (products_data);
    CREATE INDEX IF NOT EXISTS idx_appointments_status_products ON appointments (status) WHERE products_data IS NOT NULL;

    RAISE NOTICE 'Migração concluída com sucesso!';
    RAISE NOTICE 'O campo products_data agora está configurado e sincronizado com product_sales.';
END;
$$; 