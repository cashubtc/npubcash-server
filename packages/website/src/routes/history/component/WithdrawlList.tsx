import useHistory from "../hooks/useHistory";
import WithdrawlListItem from "./WithdrawalListItem";

function WithdrawalList() {
  const data = useHistory();
  if (data.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-2 w-full">
      {data.map((w) => (
        <WithdrawlListItem
          amount={w.amount}
          created_at={w.created_at}
          id={w.id}
        />
      ))}
    </div>
  );
}

export default WithdrawalList;
