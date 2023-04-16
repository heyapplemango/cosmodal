import {
  AminoSignResponse,
  OfflineAminoSigner,
  StdSignDoc,
} from "@cosmjs/amino"
import {
  AccountData,
  DirectSignResponse,
  OfflineDirectSigner,
} from "@cosmjs/proto-signing"
import { ChainInfo } from "@keplr-wallet/types"
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx"

import { PromptSign, SignData } from "./types"
import { sendAndListenOnce } from "./utils"

export class Web3AuthSigner implements OfflineDirectSigner, OfflineAminoSigner {
  chainInfo: ChainInfo
  #worker: Worker
  #promptSign: PromptSign

  constructor(chainInfo: ChainInfo, worker: Worker, promptSign: PromptSign) {
    this.chainInfo = chainInfo
    this.#worker = worker
    this.#promptSign = promptSign
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    let accounts: AccountData[] | undefined
    // Should not resolve until accounts are received.
    await sendAndListenOnce(
      this.#worker,
      {
        type: "request_accounts",
        payload: {
          chainBech32Prefix: this.chainInfo.bech32Config.bech32PrefixAccAddr,
        },
      },
      (data) => {
        if (data.type === "accounts") {
          if (data.payload.response.type === "success") {
            accounts = data.payload.response.accounts
          } else {
            throw new Error(data.payload.response.error)
          }
          return true
        }

        return false
      }
    )

    if (!accounts) {
      throw new Error("Failed to get accounts")
    }

    return accounts
  }

  async signDirect(
    signerAddress: string,
    signDoc: SignDoc
  ): Promise<DirectSignResponse> {
    if (signDoc.chainId !== this.chainInfo.chainId) {
      throw new Error("Chain ID mismatch")
    }

    const signData: SignData = {
      type: "direct",
      value: signDoc,
    }
    if (!(await this.#promptSign(signerAddress, signData))) {
      throw new Error("Request rejected")
    }

    let response: DirectSignResponse | undefined
    const id = Date.now()
    // Should not resolve until response is received.
    await sendAndListenOnce(
      this.#worker,
      {
        type: "request_sign",
        payload: {
          id,
          signerAddress,
          chainBech32Prefix: this.chainInfo.bech32Config.bech32PrefixAccAddr,
          data: signData,
        },
      },
      (data) => {
        if (data.type === "sign" && data.payload.id === id) {
          if (data.payload.response.type === "error") {
            throw new Error(data.payload.response.value)
          }

          // Type-check, should always be true.
          if (data.payload.response.type === "direct") {
            response = data.payload.response.value
          }

          return true
        }

        return false
      }
    )

    if (!response) {
      throw new Error("Failed to get response")
    }

    return response
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    if (signDoc.chain_id !== this.chainInfo.chainId) {
      throw new Error("Chain ID mismatch")
    }

    const signData: SignData = {
      type: "amino",
      value: signDoc,
    }
    if (!(await this.#promptSign(signerAddress, signData))) {
      throw new Error("Request rejected")
    }

    let response: AminoSignResponse | undefined
    const id = Date.now()
    // Should not resolve until response is received.
    await sendAndListenOnce(
      this.#worker,
      {
        type: "request_sign",
        payload: {
          id,
          signerAddress,
          chainBech32Prefix: this.chainInfo.bech32Config.bech32PrefixAccAddr,
          data: signData,
        },
      },
      (data) => {
        if (data.type === "sign" && data.payload.id === id) {
          if (data.payload.response.type === "error") {
            throw new Error(data.payload.response.value)
          }

          // Type-check, should always be true.
          if (data.payload.response.type === "amino") {
            response = data.payload.response.value
          }

          return true
        }

        return false
      }
    )

    if (!response) {
      throw new Error("Failed to get response")
    }

    return response
  }
}
