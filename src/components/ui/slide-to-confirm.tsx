import * as React from "react";
import { ChevronRight, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import TransactionPinModal from "@/components/TransactionPinModal";

interface SlideToConfirmProps {
  onConfirm: () => void;
  onPaymentComplete?: () => void;
  disabled?: boolean;
  loading?: boolean;
  text?: string;
  className?: string;
}

const SlideToConfirm = React.forwardRef<HTMLDivElement, SlideToConfirmProps>(
  ({ onConfirm, onPaymentComplete, disabled = false, loading = false, text = "Slide to Pay", className, ...props }, ref) => {
    const [isSliding, setIsSliding] = React.useState(false);
    const [sliderPosition, setSliderPosition] = React.useState(0);
    const [isConfirmed, setIsConfirmed] = React.useState(false);
    const sliderRef = React.useRef<HTMLDivElement>(null);
    const thumbRef = React.useRef<HTMLDivElement>(null);

    const handleConfirm = React.useCallback(() => {
      if (disabled || loading) return;
      setIsConfirmed(true);
      onConfirm();
      if (onPaymentComplete) {
        onPaymentComplete();
      }
    }, [onConfirm, onPaymentComplete]);

    const handleMouseMove = React.useCallback(
      (e: MouseEvent) => {
        if (!isSliding || !sliderRef.current || !thumbRef.current) return;

        const sliderRect = sliderRef.current.getBoundingClientRect();
        const thumbRect = thumbRef.current.getBoundingClientRect();

        let newPosition = e.clientX - sliderRect.left - thumbRect.width / 2;

        newPosition = Math.max(0, Math.min(newPosition, sliderRect.width - thumbRect.width));

        const percentage = (newPosition / (sliderRect.width - thumbRect.width)) * 100;
        setSliderPosition(percentage);

        if (percentage > 95) {
          handleConfirm();
        }
      },
      [isSliding, handleConfirm]
    );

    const handleMouseUp = React.useCallback(() => {
      if (isSliding) {
        setIsSliding(false);
        if (sliderPosition < 95) {
          setSliderPosition(0);
        }
      }
    }, [isSliding, sliderPosition]);

    const handleTouchMove = React.useCallback(
      (e: TouchEvent) => {
        if (!isSliding || !sliderRef.current || !thumbRef.current) return;

        const sliderRect = sliderRef.current.getBoundingClientRect();
        const thumbRect = thumbRef.current.getBoundingClientRect();

        let newPosition = e.touches[0].clientX - sliderRect.left - thumbRect.width / 2;

        // Ensure thumb stays within bounds of slider
        newPosition = Math.max(0, Math.min(newPosition, sliderRect.width - thumbRect.width));

        const percentage = (newPosition / (sliderRect.width - thumbRect.width)) * 100;
        setSliderPosition(percentage);

        if (percentage > 95) {
          handleConfirm();
        }
      },
      [isSliding, handleConfirm]
    );

    const handleMouseDown = (e: React.MouseEvent) => {
      if (disabled || loading || isConfirmed) return;
      setIsSliding(true);
      e.preventDefault();
    };

    const handleTouchStart = (e: React.TouchEvent) => {
      if (disabled || loading || isConfirmed) return;
      setIsSliding(true);
      e.preventDefault();
    };

    React.useEffect(() => {
      if (isSliding) {
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('touchend', handleMouseUp);
        
        return () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
          document.removeEventListener('touchmove', handleTouchMove);
          document.removeEventListener('touchend', handleMouseUp);
        };
      }
    }, [isSliding, handleMouseMove, handleMouseUp, handleTouchMove]);

    return (
    <>
      <div
        ref={ref}
        className={cn(
          "relative h-11 w-full overflow-hidden rounded-full",
          isConfirmed 
            ? "bg-paypal-blue" 
            : isSliding 
              ? "bg-gray-300" 
              : "bg-gray-200",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        {...props}
      >
        <div
          ref={sliderRef}
          className={cn(
            "absolute inset-0 flex items-center px-4",
            isSliding && "cursor-grabbing"
          )}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          {!isConfirmed && (
            <span className="absolute left-4 text-sm font-medium select-none pointer-events-none z-10"
              style={{
                color: isSliding ? '#6b7280' : '#374151'
              }}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </span>
              ) : isSliding ? (
                "Release"
              ) : (
                text
              )}
            </span>
          )}
          
          {isConfirmed ? (
            <div className="flex items-center justify-center w-full">
              <Check className="h-5 w-5 text-white" />
              <span className="ml-2 text-sm font-medium text-white">Confirmed!</span>
            </div>
          ) : (
            <div
              ref={thumbRef}
              className={cn(
                "absolute left-1 h-9 w-9 rounded-full shadow-md flex items-center justify-center transition-all duration-200",
                isSliding ? "cursor-grabbing scale-110" : "cursor-grab hover:scale-105",
                disabled && "cursor-not-allowed opacity-50"
              )}
              style={{
                backgroundColor: isSliding ? '#6b7280' : '#374151',
                transform: `translateX(${sliderPosition * (sliderRef.current ? (sliderRef.current.offsetWidth - 40) / 100 : 0)}px)`,
                transition: isSliding ? 'none' : 'transform 0.2s ease-out, background-color 0.2s ease-out'
              }}
            >
              <ChevronRight className="h-5 w-5 transition-colors duration-200" 
                style={{
                  color: '#ffffff'
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
});

SlideToConfirm.displayName = "SlideToConfirm";

export { SlideToConfirm };
