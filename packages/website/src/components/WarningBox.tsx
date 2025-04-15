import { IoWarningOutline } from "react-icons/io5";

type WarningBoxProps = {
  text: string;
};

function WarningBox({ text }: WarningBoxProps) {
  return (
    <div className="flex items-center p-4 bg-yellow-300 border-yellow-800 border-2 rounded-xl">
      <div className="mr-4">
        <IoWarningOutline style={{ color: "#854d0e" }} size={24} />
      </div>
      <p className="text-black text-sm">{text}</p>
    </div>
  );
}

export default WarningBox;
