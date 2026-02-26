import { LucideIcon, ChevronLeft } from "lucide-react";

interface NumberPadProps {
  onPress: (value: string) => void;
  onBackspace: () => void;
  className?: string;
}

const NumberPad = ({ onPress, onBackspace, className = "" }: NumberPadProps) => {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "backspace"];

  return (
    <div className={`grid grid-cols-3 gap-y-4 ${className}`}>
      {keys.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => (key === "backspace" ? onBackspace() : onPress(key))}
          className="flex h-16 items-center justify-center text-3xl font-medium text-white transition-transform active:scale-90"
        >
          {key === "backspace" ? (
            <ChevronLeft className="h-8 w-8" />
          ) : (
            key
          )}
        </button>
      ))}
    </div>
  );
};

export default NumberPad;
