import { AminoSignResponse, StdSignDoc } from "@cosmjs/amino"
import { AccountData, DirectSignResponse } from "@cosmjs/proto-signing"
import { OPENLOGIN_NETWORK_TYPE } from "@toruslabs/openlogin"
import { Web3AuthNoModalOptions } from "@web3auth/no-modal"
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx"

export type Web3AuthClientOptions = {
  // Web3Auth client options.
  client: {
    clientId: string
    web3AuthNetwork: OPENLOGIN_NETWORK_TYPE
  } & Web3AuthNoModalOptions

  // Function to prompt the user to sign a transaction.
  promptSign: PromptSign
}

export type PromptSign = (
  signerAddress: string,
  data: SignData
) => Promise<boolean>

export type SignData =
  | {
      type: "direct"
      value: SignDoc
    }
  | {
      type: "amino"
      value: StdSignDoc
    }

// Message the worker expects to receive.
export type ToWorkerMessage =
  | {
      type: "init"
      payload: {
        privateKey: Uint8Array
      }
    }
  | {
      type: "request_accounts"
      payload: {
        chainBech32Prefix: string
      }
    }
  | {
      type: "request_sign"
      payload: {
        id: number
        signerAddress: string
        chainBech32Prefix: string
        data: SignData
      }
    }

// Message the worker sends to the main thread.
export type FromWorkerMessage =
  | {
      type: "ready"
    }
  | {
      type: "accounts"
      payload: {
        response:
          | {
              type: "success"
              accounts: AccountData[]
            }
          | {
              type: "error"
              error: string
            }
      }
    }
  | {
      type: "sign"
      payload: {
        id: number
        response:
          | {
              type: "error"
              value: string
            }
          | {
              type: "direct"
              value: DirectSignResponse
            }
          | {
              type: "amino"
              value: AminoSignResponse
            }
      }
    }
