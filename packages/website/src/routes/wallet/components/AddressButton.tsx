import { MouseEventHandler } from "react";
import { FaCopy } from "react-icons/fa6";

type AddressButtonProps = {
  address: string;
  onClick: MouseEventHandler<HTMLButtonElement>;
};

function AddressButton({ address, onClick }: AddressButtonProps) {
  return (
    <button onClick={onClick} className="w-full rounded ">
      <p className="flex gap-4 items-center justify-between text-sm text-zinc-400 hover:text-purple-500 active:text-purple-500">
        {address}
        <FaCopy style={{ fill: "url(#blue-gradient)" }} />
      </p>
    </button>
  );
}

export default AddressButton;
