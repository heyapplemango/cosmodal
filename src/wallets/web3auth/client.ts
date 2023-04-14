import { OfflineAminoSigner } from "@cosmjs/amino"
import { fromBech32 } from "@cosmjs/encoding"
import { OfflineDirectSigner } from "@cosmjs/proto-signing"
import { ChainInfo } from "@keplr-wallet/types"
import { CHAIN_NAMESPACES } from "@web3auth/base"
import { Web3Auth } from "@web3auth/modal"

import { WalletClient } from "../../types"
import { Web3AuthSigner } from "./signers"
import { PromptSign } from "./types"

export class Web3AuthClient implements WalletClient {
  client: Web3Auth
  chainInfo: ChainInfo
  promptSign: PromptSign
  signer: Web3AuthSigner | undefined

  constructor(client: Web3Auth, chainInfo: ChainInfo, promptSign: PromptSign) {
    this.client = client
    this.chainInfo = chainInfo
    this.promptSign = promptSign
  }

  static async setup(
    chainInfo: ChainInfo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options?: Record<string, any>
  ): Promise<Web3AuthClient> {
    const client = new Web3Auth({
      // Get from developer dashboard.
      clientId: "randomlocalhost",
      chainConfig: {
        chainNamespace: CHAIN_NAMESPACES.OTHER,
      },
    })
    await client.initModal()

    // Get promptSign from options and ensure it is valid.
    const promptSign = options?.promptSign
    if (typeof promptSign !== "function") {
      throw new Error("Invalid promptSign")
    }

    return new Web3AuthClient(client, chainInfo, promptSign)
  }

  async getPrivateKey(): Promise<Uint8Array> {
    const privateKeyHex = await this.client.provider?.request({
      method: "private_key",
    })
    if (typeof privateKeyHex !== "string") {
      throw new Error("Invalid private key")
    }
    return Uint8Array.from(Buffer.from(privateKeyHex, "hex"))
  }

  async enable(_chainIds: string | string[]) {
    const chainIds = [_chainIds].flat()
    if (chainIds.length !== 1 || chainIds[0] !== this.chainInfo.chainId) {
      throw new Error(`Expected ${this.chainInfo.chainId}`)
    }

    await this.client.connect()

    // Get private key.
    const privateKey = await this.getPrivateKey()

    // Create signer.
    this.signer = await Web3AuthSigner.setup(
      this.chainInfo,
      this.promptSign,
      privateKey
    )
  }

  async disconnect() {
    await this.client.logout()
    this.signer = undefined
  }

  getOfflineSigner(chainId: string) {
    if (chainId !== this.chainInfo.chainId) {
      throw new Error(`Expected ${this.chainInfo.chainId}`)
    }
    if (!this.signer) {
      throw new Error("Signer not enabled")
    }
    return this.signer
  }

  async getOfflineSignerAuto(
    chainId: string
  ): Promise<OfflineAminoSigner | OfflineDirectSigner> {
    return this.getOfflineSigner(chainId)
  }

  getOfflineSignerOnlyAmino(chainId: string): OfflineAminoSigner {
    if (chainId !== this.chainInfo.chainId) {
      throw new Error(`Expected ${this.chainInfo.chainId}`)
    }
    if (!this.signer) {
      throw new Error("Signer not enabled")
    }
    return this.signer
  }

  async getKey(chainId: string): Promise<{
    name: string
    algo: string
    pubKey: Uint8Array
    address: Uint8Array
    bech32Address: string
  }> {
    if (chainId !== this.chainInfo.chainId) {
      throw new Error(`Expected ${this.chainInfo.chainId}`)
    }
    if (!this.signer) {
      throw new Error("Signer not enabled")
    }

    const info = await this.client.getUserInfo()
    const { address, algo, pubkey } = (await this.signer.getAccounts())[0]

    return {
      name: info.name || info.email || address,
      algo,
      pubKey: pubkey,
      address: fromBech32(address).data,
      bech32Address: address,
    }
  }
}
