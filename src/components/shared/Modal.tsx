import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
  className?: string;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  showCloseButton = true,
  className = '',
}: ModalProps) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`bg-white rounded-lg shadow-xl w-full relative ${maxWidth} ${className}`}>
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        
        <div className="p-4">
          {title && (
            <h3 className="text-lg font-semibold mb-3">{title}</h3>
          )}
          
          {children}
        </div>
      </div>
    </div>
  );
} 