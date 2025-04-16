type ButtonProps = {
  text: string;
  onClick: React.MouseEventHandler<HTMLButtonElement> | undefined;
};

function Button({ text, onClick }: ButtonProps) {
  return (
    <button
      className="px-4 py-2 bg-gradient-to-tr from-purple-500 to-pink-500 text-white rounded hover:from-purple-700 hover:to-pink-700 transition"
      onClick={onClick}
    >
      {text}
    </button>
  );
}

export default Button;
