import {
  AminoSignResponse,
  OfflineAminoSigner,
  Secp256k1Wallet,
  StdSignDoc,
} from "@cosmjs/amino"
import {
  AccountData,
  DirectSecp256k1Wallet,
  DirectSignResponse,
  OfflineDirectSigner,
} from "@cosmjs/proto-signing"
import { ChainInfo } from "@keplr-wallet/types"
import { SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx"

import { PromptSign } from "./types"

export class Web3AuthSigner implements OfflineDirectSigner, OfflineAminoSigner {
  chainInfo: ChainInfo
  #promptSign: PromptSign
  #getPrivateKey: () => Promise<Uint8Array>

  constructor(
    chainInfo: ChainInfo,
    promptSign: PromptSign,
    getPrivateKey: () => Promise<Uint8Array>
  ) {
    this.chainInfo = chainInfo
    this.#promptSign = promptSign
    this.#getPrivateKey = getPrivateKey
  }

  static async setup(
    chainInfo: ChainInfo,
    promptSign: PromptSign,
    getPrivateKey: () => Promise<Uint8Array>
  ) {
    return new Web3AuthSigner(chainInfo, promptSign, getPrivateKey)
  }

  async #getDirectSigner(): Promise<DirectSecp256k1Wallet> {
    return await DirectSecp256k1Wallet.fromKey(
      await this.#getPrivateKey(),
      this.chainInfo.bech32Config.bech32PrefixAccAddr
    )
  }

  async #getAminoSigner(): Promise<Secp256k1Wallet> {
    return await Secp256k1Wallet.fromKey(
      await this.#getPrivateKey(),
      this.chainInfo.bech32Config.bech32PrefixAccAddr
    )
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return await (await this.#getDirectSigner()).getAccounts()
  }

  async signDirect(
    signerAddress: string,
    signDoc: SignDoc
  ): Promise<DirectSignResponse> {
    if (signDoc.chainId !== this.chainInfo.chainId) {
      throw new Error("Chain ID mismatch")
    }

    if (await this.#promptSign(signerAddress, signDoc)) {
      return await (
        await this.#getDirectSigner()
      ).signDirect(signerAddress, signDoc)
    } else {
      throw new Error("Request rejected")
    }
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    if (signDoc.chain_id !== this.chainInfo.chainId) {
      throw new Error("Chain ID mismatch")
    }

    if (await this.#promptSign(signerAddress, signDoc)) {
      return (await this.#getAminoSigner()).signAmino(signerAddress, signDoc)
    } else {
      throw new Error("Request rejected")
    }
  }
}
