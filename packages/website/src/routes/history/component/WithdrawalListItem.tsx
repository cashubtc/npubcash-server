import { useSearchParams } from "react-router-dom";
import { getTimeAgoString } from "../../../utils/time";

type WithdrawlListItemProps = {
  id: number;
  amount: number;
  created_at: number;
};

function WithdrawlListItem({ id, amount, created_at }: WithdrawlListItemProps) {
  const time = getTimeAgoString(created_at);
  const [_, setSerachParams] = useSearchParams();
  return (
    <button
      className="flex w-full justify-between items-center p-2 rounded-xl bg-zinc-700"
      onClick={() => {
        setSerachParams(`id=${id}`);
      }}
    >
      <p>{amount} SATS</p>
      <p className="text-xs text-zinc-400">{time}</p>
    </button>
  );
}

export default WithdrawlListItem;
