import { useNavigate } from "react-router-dom";
import AddressButton from "./AddressButton";

type UsernameButtonProps = {
  username?: string;
};

function UsernameButton({ username }: UsernameButtonProps) {
  const navigate = useNavigate();
  if (!username) {
    return (
      <button
        onClick={() => {
          navigate("/username");
        }}
        className="w-full p-0.5 bg-gradient-to-tr from-purple-500 to-pink-500 rounded"
      >
        <div className="bg-zinc-800 px-2 py-1 rounded">
          <p className="flex gap-1 items-center text-sm bg-gradient-to-tr from-purple-500 to-pink-500 text-transparent bg-clip-text hover:text-purple-700 active:text-purple-700">
            No username... Claim one!
          </p>
        </div>
      </button>
    );
  }
  return (
    <AddressButton
      address={`${username}@${new URL(import.meta.env.NPC_SERVER_URL).host}`}
      onClick={() => {
        window.navigator.clipboard.writeText(
          `${username}@${new URL(import.meta.env.NPC_SERVER_URL).host}`,
        );
      }}
    />
  );
}

export default UsernameButton;
