import { useState } from "react";
import QRCode from "react-qr-code";
import useLongPress from "../../../hooks/useLongPress";
import QRCodeSettings from "./QRCodeSettings";
import { useQRParts } from "../hooks/useQRParts";

type QRCodeElementProps = {
  value?: string;
};

function QRCodeElement({ value }: QRCodeElementProps) {
  const [isFast, setIsFast] = useState(true);
  const [isBig, setIsBig] = useState(true);
  const [settingsActive, setSettingsActive] = useState(false);

  const tokenPart = useQRParts(isBig, isFast, value);

  const onLongPress = () => {
    setSettingsActive((p) => !p);
  };

  const longpress = useLongPress(onLongPress, () => {});

  if (!tokenPart) {
    return (
      <div className="bg-zinc-700 p-2 rounded">
        <QRCode value={"21"} bgColor="#27272a" fgColor="#3f3f46" size={300} />
      </div>
    );
  }
  return (
    <div className="bg-white p-2 rounded relative">
      <div {...longpress}>
        <QRCode value={tokenPart} size={300} />
      </div>
      {settingsActive ? (
        <QRCodeSettings
          onClose={() => {
            setSettingsActive(false);
          }}
          onSize={() => {
            setIsBig((p) => !p);
          }}
          onSpeed={() => {
            setIsFast((p) => !p);
          }}
          isBig={isBig}
          isFast={isFast}
        />
      ) : undefined}
    </div>
  );
}

export default QRCodeElement;
