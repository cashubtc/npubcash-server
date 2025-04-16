import { FaList, FaMoneyBill } from "react-icons/fa6";
import { useNavigate, useSearchParams } from "react-router-dom";

function ActionButtons() {
  const [, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 md:grid-cols-2 gap-2 w-full mb-4 max-w-screen-md">
      <button
        onClick={() => {
          const autoConfirm = localStorage.getItem("npc_auto_confirm");
          if (autoConfirm) {
            navigate("/claim");
            return;
          }
          setSearchParams("confirm=true");
        }}
        className="flex justify-center gap-2 items-center bg-zinc-800 p-4 rounded active:bg-zinc-600 hover:bg-zinc-700"
      >
        <FaMoneyBill style={{ fill: "url(#blue-gradient)" }} />
        <p>Withdraw</p>
      </button>
      <button
        onClick={() => {
          navigate("/history");
        }}
        className="flex gap-2 justify-center items-center bg-zinc-800 p-4 rounded active:bg-zinc-600 hover:bg-zinc-700"
      >
        <FaList style={{ fill: "url(#blue-gradient)" }} />
        <p>History</p>
      </button>
    </div>
  );
}

export default ActionButtons;
