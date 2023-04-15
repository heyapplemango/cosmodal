import { OfflineAminoSigner } from "@cosmjs/amino"
import { fromBech32 } from "@cosmjs/encoding"
import { OfflineDirectSigner } from "@cosmjs/proto-signing"
import { ChainInfo } from "@keplr-wallet/types"
import { OPENLOGIN_NETWORK } from "@toruslabs/openlogin"
import { CHAIN_NAMESPACES } from "@web3auth/base"
import { Web3Auth } from "@web3auth/modal"

import { WalletClient } from "../../types"
import { Web3AuthSigner } from "./signers"
import { PromptSign } from "./types"

export class Web3AuthClient implements WalletClient {
  #client: Web3Auth
  #promptSign: PromptSign

  // Map chain ID to chain info.
  chainInfo: Record<string, ChainInfo | undefined> = {}
  // Map chain ID to signer.
  #signers: Record<string, Web3AuthSigner | undefined> = {}

  constructor(client: Web3Auth, promptSign: PromptSign) {
    this.#client = client
    this.#promptSign = promptSign
  }

  static async setup(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _options?: Record<string, any>
  ): Promise<Web3AuthClient> {
    const { clientId, web3AuthNetwork, promptSign, ...options } = _options ?? {}
    if (typeof clientId !== "string") {
      throw new Error("Invalid web3auth client ID")
    }
    if (
      typeof web3AuthNetwork !== "string" ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      !Object.values(OPENLOGIN_NETWORK).includes(web3AuthNetwork as any)
    ) {
      throw new Error("Invalid web3auth network")
    }
    if (typeof promptSign !== "function") {
      throw new Error("Invalid promptSign function")
    }

    const client = new Web3Auth({
      ...options,

      clientId,
      web3AuthNetwork:
        web3AuthNetwork as typeof OPENLOGIN_NETWORK[keyof typeof OPENLOGIN_NETWORK],
      chainConfig: {
        ...options.chainConfig,
        chainNamespace: CHAIN_NAMESPACES.OTHER,
      },
    })
    await client.initModal()

    return new Web3AuthClient(client, promptSign)
  }

  async #getPrivateKey(): Promise<Uint8Array> {
    const privateKeyHex = await this.#client.provider?.request({
      method: "private_key",
    })
    if (typeof privateKeyHex !== "string") {
      throw new Error("Invalid private key")
    }
    return Uint8Array.from(Buffer.from(privateKeyHex, "hex"))
  }

  async experimentalSuggestChain(chainInfo: ChainInfo): Promise<void> {
    this.chainInfo[chainInfo.chainId] = chainInfo
  }

  async enable(_chainIds: string | string[]) {
    const chainIds = [_chainIds].flat()
    if (chainIds.some((chainId) => !this.chainInfo[chainId])) {
      throw new Error("Chain not supported")
    }

    await this.#client.connect()

    // Create signers.
    await Promise.all(
      chainIds.map(async (chainId) => {
        const chainInfo = this.chainInfo[chainId]
        if (!chainInfo) {
          throw new Error("Chain not supported")
        }
        this.#signers[chainId] = await Web3AuthSigner.setup(
          chainInfo,
          this.#promptSign,
          this.#getPrivateKey.bind(this)
        )
      })
    )
  }

  async disconnect() {
    await this.#client.logout()
    this.#signers = {}
  }

  getOfflineSigner(chainId: string) {
    const signer = this.#signers[chainId]
    if (!signer) {
      throw new Error("Signer not enabled")
    }
    return signer
  }

  async getOfflineSignerAuto(
    chainId: string
  ): Promise<OfflineAminoSigner | OfflineDirectSigner> {
    return this.getOfflineSigner(chainId)
  }

  getOfflineSignerOnlyAmino(chainId: string): OfflineAminoSigner {
    return this.getOfflineSigner(chainId)
  }

  async getKey(chainId: string): Promise<{
    name: string
    algo: string
    pubKey: Uint8Array
    address: Uint8Array
    bech32Address: string
  }> {
    const { address, algo, pubkey } = (
      await this.getOfflineSigner(chainId).getAccounts()
    )[0]
    const info = await this.#client.getUserInfo()

    return {
      name: info.name || info.email || address,
      algo,
      pubKey: pubkey,
      address: fromBech32(address).data,
      bech32Address: address,
    }
  }
}
