import React from 'react';
import { useFinancialVisibility } from '../contexts/FinancialVisibilityContext';
import { cn } from '../lib/utils';

interface FinancialValueProps {
  children: React.ReactNode;
  className?: string;
}

const FinancialValue: React.FC<FinancialValueProps> = ({ children, className }) => {
  const { isVisible } = useFinancialVisibility();

  return (
    <span className={cn(
      "transition-all duration-300",
      !isVisible && "blur-md select-none pointer-events-none",
      className
    )}>
      {isVisible ? children : "****"}
    </span>
  );
};

export default FinancialValue;
