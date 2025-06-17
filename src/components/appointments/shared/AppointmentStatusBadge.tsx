import React from 'react';

type AppointmentStatus = 'agendado' | 'realizado' | 'ausente' | 'cancelado' | 'pendente' | string;

interface AppointmentStatusBadgeProps {
  status: AppointmentStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Configuração movida para fora do componente para evitar recriação a cada renderização
const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: string }> = {
  agendado: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    icon: '🕒'
  },
  realizado: {
    bg: 'bg-green-100',
    text: 'text-green-800',
    icon: '✓'
  },
  ausente: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    icon: '⚠️'
  },
  cancelado: {
    bg: 'bg-red-100',
    text: 'text-red-800',
    icon: '✗'
  },
  pendente: {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    icon: '⏳'
  }
};

// Classes de tamanho também movidas para fora do componente
const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-0.5',
  lg: 'text-base px-3 py-1'
};

export default function AppointmentStatusBadge({
  status,
  size = 'md',
  className = ''
}: AppointmentStatusBadgeProps) {
  const statusLower = status?.toLowerCase() || 'agendado';
  
  const config = STATUS_CONFIG[statusLower] || {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    icon: '❓'
  };

  // Capitalização simples da primeira letra
  const displayStatus = statusLower.charAt(0).toUpperCase() + statusLower.slice(1);

  return (
    <span
      className={`
        inline-flex items-center justify-center rounded-full 
        ${config.bg} ${config.text} font-medium
        ${SIZE_CLASSES[size]}
        ${className}
      `}
    >
      <span className="mr-1">{config.icon}</span>
      {displayStatus}
    </span>
  );
} 