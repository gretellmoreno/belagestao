import { supabase } from './supabase';

export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  profit_margin: number;
  stock: number;
  description: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function getProducts() {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name');
    
    if (error) {
      // Si el error es que la tabla no existe, devolvemos un array vacío
      if (error.code === '42P01') {
        console.warn('La tabla products todavía no existe. Devolviendo array vacío.');
        return [];
      }
      
      console.error('Error fetching products:', error);
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error en getProducts:', error);
    return [];
  }
}

export async function getProductById(id: string) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error(`Error fetching product with id ${id}:`, error);
    throw error;
  }
  
  return data;
}

export const createProduct = async (newProduct: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> => {
  const productData = {
    name: newProduct.name,
    price: newProduct.price ?? 0,
    cost_price: newProduct.cost_price ?? 0,
    profit_margin: newProduct.profit_margin ?? 0,
    stock: newProduct.stock ?? 0,
    description: newProduct.description,
    active: newProduct.active
  };

  const { data, error } = await supabase
    .from('products')
    .insert([productData])
    .select();

  if (error) {
    console.error('Error creating product', error);
    throw new Error(error.message);
  }

  return data[0];
};

export const updateProduct = async (id: string, updatedProduct: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product> => {
  const updateData: Record<string, any> = {};
  
  if (updatedProduct.name !== undefined) updateData.name = updatedProduct.name;
  if (updatedProduct.price !== undefined) updateData.price = updatedProduct.price ?? 0;
  if (updatedProduct.cost_price !== undefined) updateData.cost_price = updatedProduct.cost_price ?? 0;
  if (updatedProduct.profit_margin !== undefined) updateData.profit_margin = updatedProduct.profit_margin ?? 0;
  if (updatedProduct.stock !== undefined) updateData.stock = updatedProduct.stock ?? 0;
  if (updatedProduct.description !== undefined) updateData.description = updatedProduct.description;
  if (updatedProduct.active !== undefined) updateData.active = updatedProduct.active;

  const { data, error } = await supabase
    .from('products')
    .update(updateData)
    .eq('id', id)
    .select();

  if (error) {
    console.error('Error updating product', error);
    throw new Error(error.message);
  }

  return data[0];
};

export async function deleteProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error(`Error deleting product with id ${id}:`, error);
    throw error;
  }
  
  return true;
} 