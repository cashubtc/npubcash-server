import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/Button";
import CardWrapper from "../../components/CardWrapper";
import WithdrawalList from "./component/WithdrawlList";
import WithdrawalDetailsModal from "./component/WithdrawalDetailsModal";

function HistoryRoute() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id");
  return (
    <>
      <CardWrapper>
        <WithdrawalList />
        <Button
          onClick={() => {
            navigate("/wallet");
          }}
          text="Back"
        />
      </CardWrapper>
      {id ? <WithdrawalDetailsModal id={id} /> : undefined}
    </>
  );
}

export default HistoryRoute;
