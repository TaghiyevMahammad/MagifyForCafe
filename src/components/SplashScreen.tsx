import React, { useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { cn } from '../lib/utils';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { theme } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2000);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className={cn(
      "fixed inset-0 flex items-center justify-center z-[9999] transition-colors duration-500",
      theme === 'dark' ? "bg-[#0a0a0a]" : "bg-white"
    )}>
      <div className="flex flex-col items-center animate-fade-in">
        <img 
          src={theme === 'dark' ? "/logo.png" : "/logo1.png"} 
          alt="Magify Logo" 
          className="w-32 h-auto object-contain mb-4"
          referrerPolicy="no-referrer"
        />
        <div className="w-48 h-1 bg-blue-600/10 mt-4 rounded-full overflow-hidden">
          <div className="w-full h-full bg-blue-600 animate-loading-bar" />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
