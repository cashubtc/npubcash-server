import AddressButton from "./AddressButton";
import UsernameButton from "./UsernameButton";

type InfoBoxProps = {
  info?: {
    mintUrl: string;
    npub: string;
    username?: string;
  };
};

function InfoBox({ info }: InfoBoxProps) {
  if (!info) {
    return (
      <div className="flex w-full flex-col gap-2 p-2 bg-zinc-800 rounded animate-pulse">
        <p className="text-xs text-zinc-500">Your Lightning Addresses:</p>
        <p className="flex gap-4 items-center justify-between text-sm text-zinc-400">
          ...
        </p>
        <p className="flex gap-4 items-center justify-between text-sm text-zinc-400">
          ...
        </p>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col gap-2 p-2 bg-zinc-800 rounded">
      <p className="text-xs text-zinc-500">Your Lightning Addresses:</p>
      <AddressButton
        address={`${info.npub.slice(0, 10)}...@${new URL(import.meta.env.NPC_SERVER_URL).host}`}
        onClick={() => {
          window.navigator.clipboard.writeText(
            `${info.npub}@${new URL(import.meta.env.NPC_SERVER_URL).host}`,
          );
        }}
      />
      <UsernameButton username={info.username} />
    </div>
  );
}

export default InfoBox;
