import { ReactNode } from "react";

type CoinButtonProps = {
  icon: ReactNode;
  title: string;
  onClick: () => void;
};

function CoinButton({ icon, title, onClick }: CoinButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex bg-zinc-900 rounded-full text-sm items-center hover:text-purple-700 active:text-purple-700"
    >
      <div className="bg-gradient-to-tr text-sm from-purple-500 to-pink-500 p-2 rounded-full">
        {icon}
      </div>
      <p className="px-4 text-center">{title}</p>
    </button>
  );
}

export default CoinButton;
