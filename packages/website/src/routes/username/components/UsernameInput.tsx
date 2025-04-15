type UsernameInputProps = {
  username: string;
  setUsername: (s: string) => void;
};

function UsernameInput({ username, setUsername }: UsernameInputProps) {
  return (
    <div className="flex items-center p-2 rounded bg-gradient-to-tr from-purple-500 to-pink-500">
      <input
        type="text"
        className="py-1 min-w-0 grow text-sm text-center bg-zinc-800/20 rounded"
        value={username}
        onChange={(e) => {
          setUsername(e.target.value);
        }}
        id="username"
      />
      <p className="min-w-0 flex-shrink-0 ml-2 text-center text-xs">
        {"@" + new URL(import.meta.env.NPC_SERVER_URL).host}
      </p>
    </div>
  );
}

export default UsernameInput;
