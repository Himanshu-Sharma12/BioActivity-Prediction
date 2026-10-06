import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingAnimationProps {
  isLoading: boolean;
  phase?: 'analyzing' | 'generating' | 'calculating' | 'predicting' | 'exporting';
  progress?: number; // 0-100
  className?: string;
}

const loadingPhases = {
  analyzing: "Analyzing compound structure...",
  generating: "Generating 3D molecular model...",
  calculating: "Calculating molecular properties...",
  predicting: "Predicting bioactivity and safety...",
  exporting: "Preparing your report...",
};

export default function LoadingAnimation({ 
  isLoading, 
  phase = 'analyzing', 
  progress,
  className 
}: LoadingAnimationProps) {
  const [displayProgress, setDisplayProgress] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(phase);

  // Smooth progress animation
  useEffect(() => {
    if (progress !== undefined) {
      const interval = setInterval(() => {
        setDisplayProgress(prev => {
          if (prev >= progress) {
            clearInterval(interval);
            return progress;
          }
          return Math.min(prev + 1, progress);
        });
      }, 20);
      return () => clearInterval(interval);
    }
  }, [progress]);

  // Auto-cycle through phases if no specific phase provided
  useEffect(() => {
    if (!phase && isLoading) {
      const phases: Array<keyof typeof loadingPhases> = ['analyzing', 'generating', 'calculating', 'predicting'];
      let index = 0;
      
      const interval = setInterval(() => {
        index = (index + 1) % phases.length;
        setCurrentPhase(phases[index]);
      }, 2000);
      
      return () => clearInterval(interval);
    } else {
      setCurrentPhase(phase);
    }
  }, [phase, isLoading]);

  if (!isLoading) return null;

  return (
    <div className={cn(
      "flex flex-col items-center justify-center gap-6 p-8",
      className
    )}>
      {/* Animated Molecule Spinner */}
      <div className="relative w-32 h-32">
        {/* Outer orbit */}
        <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
        
        {/* Rotating electrons */}
        <div className="absolute inset-0 animate-spin-slow">
          <div className="absolute top-0 left-1/2 -ml-2 w-4 h-4 rounded-full bg-primary shadow-lg shadow-primary/50"></div>
        </div>
        
        <div className="absolute inset-0 animate-spin-slow-reverse" style={{ animationDelay: '0.5s' }}>
          <div className="absolute bottom-0 left-1/2 -ml-2 w-4 h-4 rounded-full bg-purple-500 shadow-lg shadow-purple-500/50"></div>
        </div>
        
        <div className="absolute inset-0 animate-spin-medium">
          <div className="absolute top-1/2 right-0 -mt-2 w-4 h-4 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50"></div>
        </div>
        
        {/* Center nucleus */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-purple-600 shadow-xl animate-pulse">
            <div className="absolute inset-1 rounded-full bg-background/20"></div>
          </div>
        </div>
      </div>

      {/* Loading Text */}
      <div className="text-center space-y-2">
        <p className="text-lg font-medium text-foreground animate-pulse">
          {loadingPhases[currentPhase]}
        </p>
        
        {progress !== undefined && (
          <p className="text-sm text-muted-foreground">
            {displayProgress}% complete
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {progress !== undefined && (
        <div className="w-full max-w-md">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-purple-600 transition-all duration-500 ease-out rounded-full relative overflow-hidden"
              style={{ width: `${displayProgress}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>
      )}

      {/* Spinning loader fallback */}
      <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
    </div>
  );
}

// Compact inline loading spinner for smaller spaces
export function LoadingSpinner({ className, size = "default" }: { 
  className?: string; 
  size?: "sm" | "default" | "lg" 
}) {
  const sizeClasses = {
    sm: "w-4 h-4",
    default: "w-6 h-6",
    lg: "w-8 h-8"
  };

  return (
    <Loader2 className={cn("animate-spin text-primary", sizeClasses[size], className)} />
  );
}

// Overlay loading for full-page operations
export function LoadingOverlay({ 
  isLoading, 
  phase, 
  progress,
  message
}: { 
  isLoading: boolean; 
  phase?: LoadingAnimationProps['phase'];
  progress?: number;
  message?: string;
}) {
  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card rounded-lg shadow-2xl border p-8 max-w-md w-full mx-4">
        <LoadingAnimation 
          isLoading={isLoading} 
          phase={phase} 
          progress={progress}
        />
        {message && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
