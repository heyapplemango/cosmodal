import { OfflineAminoSigner } from "@cosmjs/amino"
import { fromBech32 } from "@cosmjs/encoding"
import { OfflineDirectSigner } from "@cosmjs/proto-signing"
import { ChainInfo } from "@keplr-wallet/types"
import eccrypto from "@toruslabs/eccrypto"
import {
  LOGIN_PROVIDER_TYPE,
  OPENLOGIN_NETWORK,
  UX_MODE,
} from "@toruslabs/openlogin"
import { CHAIN_NAMESPACES, UserInfo, WALLET_ADAPTERS } from "@web3auth/base"
import { Web3AuthNoModal } from "@web3auth/no-modal"
import { OpenloginAdapter } from "@web3auth/openlogin-adapter"

import { WalletClient } from "../../types"
import { Web3AuthSigner } from "./signers"
import { PromptSign, Web3AuthClientOptions } from "./types"
import { decrypt, sendAndListenOnce } from "./utils"

export class Web3AuthClient implements WalletClient {
  #worker: Worker
  #clientPrivateKey: Buffer
  #userInfo: Partial<UserInfo>
  #logout: () => Promise<void>
  #promptSign: PromptSign

  // Map chain ID to chain info.
  chainInfo: Record<string, ChainInfo | undefined> = {}
  // Map chain ID to signer.
  #signers: Record<string, Web3AuthSigner | undefined> = {}

  constructor(
    worker: Worker,
    clientPrivateKey: Buffer,
    userInfo: Partial<UserInfo>,
    logout: () => Promise<void>,
    options: Web3AuthClientOptions
  ) {
    this.#worker = worker
    this.#clientPrivateKey = clientPrivateKey
    this.#userInfo = userInfo
    this.#logout = logout
    this.#promptSign = options.promptSign
  }

  static async setup(
    loginProvider: LOGIN_PROVIDER_TYPE,
    _options?: Partial<Web3AuthClientOptions>
  ): Promise<Web3AuthClient> {
    // Validate options since they're not type-checked on input.
    if (typeof _options?.client?.clientId !== "string") {
      throw new Error("Invalid web3auth client ID")
    }
    if (
      typeof _options?.client?.web3AuthNetwork !== "string" ||
      !Object.values(OPENLOGIN_NETWORK).includes(
        _options.client.web3AuthNetwork
      )
    ) {
      throw new Error("Invalid web3auth network")
    }
    if (typeof _options.promptSign !== "function") {
      throw new Error("Invalid promptSign function")
    }

    const options = _options as Web3AuthClientOptions

    const client = new Web3AuthNoModal({
      ...options.client,
      chainConfig: {
        ...options.client.chainConfig,
        chainNamespace: CHAIN_NAMESPACES.OTHER,
      },
    })

    const openloginAdapter = new OpenloginAdapter({
      adapterSettings: {
        uxMode: UX_MODE.POPUP,
      },
    })
    client.configureAdapter(openloginAdapter)

    await client.init()

    const provider =
      client.provider ??
      (await client.connectTo(WALLET_ADAPTERS.OPENLOGIN, {
        loginProvider,
      }))

    const userInfo = await client.getUserInfo()

    const privateKeyHex = await provider?.request({
      method: "private_key",
    })
    if (typeof privateKeyHex !== "string") {
      throw new Error(`Failed to connect to ${loginProvider}`)
    }

    const clientPrivateKey = eccrypto.generatePrivate()
    const clientPublicKey = eccrypto.getPublic(clientPrivateKey).toString("hex")

    const worker = new Worker(new URL("./worker.js", import.meta.url))
    // Send client public key so the worker can verify our signatures, and get
    // the worker public key for encrypting the wallet private key in the next
    // init step.
    let workerPublicKey: Buffer | undefined
    await sendAndListenOnce(
      worker,
      {
        type: "init_1",
        payload: {
          publicKey: clientPublicKey,
        },
      },
      async (data) => {
        if (data.type === "ready_1") {
          workerPublicKey = await decrypt(
            clientPrivateKey,
            data.payload.encryptedPublicKey
          )
          return true
        }

        return false
      }
    )
    if (!workerPublicKey) {
      throw new Error("Failed to authenticate with worker")
    }

    // Encrypt and send the wallet private key to the worker.
    const encryptedPrivateKey = await eccrypto.encrypt(
      workerPublicKey,
      Buffer.from(privateKeyHex, "hex")
    )
    await sendAndListenOnce(
      worker,
      {
        type: "init_2",
        payload: {
          encryptedPrivateKey,
        },
      },
      (data) => data.type === "ready_2"
    )

    return new Web3AuthClient(
      worker,
      clientPrivateKey,
      userInfo,
      client.logout.bind(client),
      options
    )
  }

  async experimentalSuggestChain(chainInfo: ChainInfo): Promise<void> {
    this.chainInfo[chainInfo.chainId] = chainInfo
  }

  async enable(_chainIds: string | string[]) {
    const chainIds = [_chainIds].flat()
    if (chainIds.some((chainId) => !this.chainInfo[chainId])) {
      throw new Error("Chain not supported")
    }

    // Create signers.
    await Promise.all(
      chainIds.map(async (chainId) => {
        const chainInfo = this.chainInfo[chainId]
        if (!chainInfo) {
          throw new Error("Chain not supported")
        }
        this.#signers[chainId] = new Web3AuthSigner(
          chainInfo,
          this.#worker,
          this.#clientPrivateKey,
          this.#promptSign
        )
      })
    )
  }

  async disconnect() {
    await this.#logout()
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

    return {
      name: this.#userInfo.name || this.#userInfo.email || address,
      algo,
      pubKey: pubkey,
      address: fromBech32(address).data,
      bech32Address: address,
    }
  }
}
