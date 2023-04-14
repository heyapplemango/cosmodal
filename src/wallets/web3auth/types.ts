import { StdSignDoc } from "@cosmjs/amino"
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx"

export type PromptSign = (
  signerAddress: string,
  signDoc: SignDoc | StdSignDoc
) => Promise<boolean>
