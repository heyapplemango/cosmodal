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
  chainId: string
  promptSign: PromptSign
  directSigner: DirectSecp256k1Wallet
  aminoSigner: Secp256k1Wallet

  constructor(
    chainId: string,
    promptSign: PromptSign,
    directSigner: DirectSecp256k1Wallet,
    aminoSigner: Secp256k1Wallet
  ) {
    this.chainId = chainId
    this.directSigner = directSigner
    this.aminoSigner = aminoSigner
    this.promptSign = promptSign
  }

  static async setup(
    chainInfo: ChainInfo,
    promptSign: PromptSign,
    privateKey: Uint8Array
  ) {
    return new Web3AuthSigner(
      chainInfo.chainId,
      promptSign,
      await DirectSecp256k1Wallet.fromKey(
        privateKey,
        chainInfo.bech32Config.bech32PrefixAccAddr
      ),
      await Secp256k1Wallet.fromKey(privateKey)
    )
  }

  async getAccounts(): Promise<readonly AccountData[]> {
    return await this.directSigner.getAccounts()
  }

  async signDirect(
    signerAddress: string,
    signDoc: SignDoc
  ): Promise<DirectSignResponse> {
    if (signDoc.chainId !== this.chainId) {
      throw new Error("Chain ID mismatch")
    }

    if (await this.promptSign(signerAddress, signDoc)) {
      return await this.directSigner.signDirect(signerAddress, signDoc)
    } else {
      throw new Error("Request rejected")
    }
  }

  async signAmino(
    signerAddress: string,
    signDoc: StdSignDoc
  ): Promise<AminoSignResponse> {
    if (signDoc.chain_id !== this.chainId) {
      throw new Error("Chain ID mismatch")
    }

    if (await this.promptSign(signerAddress, signDoc)) {
      return this.aminoSigner.signAmino(signerAddress, signDoc)
    } else {
      throw new Error("Request rejected")
    }
  }
}
