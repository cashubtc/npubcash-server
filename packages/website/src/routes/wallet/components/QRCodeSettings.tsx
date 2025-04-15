import Button from "../../../components/Button";

type QRCodeSettingsProps = {
  onClose: () => void;
  onSpeed: () => void;
  onSize: () => void;
  isFast: boolean;
  isBig: boolean;
};

function QRCodeSettings({
  onClose,
  onSpeed,
  onSize,
  isFast,
  isBig,
}: QRCodeSettingsProps) {
  return (
    <div className="absolute z-10 inset-0 bg-zinc-700 rounded flex flex-col justify-between items-center py-4">
      <div className="flex flex-col gap-2">
        <div className="flex gap-4 items-center w-64 justify-between">
          <p className="text-zinc-50">
            Speed:{" "}
            <span className="text-purple-500">{isFast ? "High" : "Low"}</span>
          </p>
          <button
            onClick={onSpeed}
            className="py-1 px-2 rounded bg-zinc-800 text-zinc-50 text-sm"
          >
            Change
          </button>
        </div>
        <div className="flex gap-4 items-center w-64 justify-between">
          <p className="text-zinc-50">
            Size:{" "}
            <span className="text-purple-500">{isBig ? "Large" : "Small"}</span>
          </p>
          <button
            onClick={onSize}
            className="py-1 px-2 rounded bg-zinc-800 text-zinc-50 text-sm"
          >
            Change
          </button>
        </div>
      </div>

      <Button text="Close" onClick={onClose} />
    </div>
  );
}

export default QRCodeSettings;
