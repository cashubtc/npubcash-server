import { RecipientBlock } from "./recipientBlock";

export interface RecipientBlockRepository {
  getAll(): Promise<RecipientBlock[]>;
}
